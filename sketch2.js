// --- Global Variables & Parameters ---
let cogents = [];
let simulationSpeed = 1; // Updates per frame

CANVAS_WIDTH = 1200;
CANVAS_HEIGHT = 800;
// Default Parameter Values (will be controlled by sliders)
let params = {
    numCogentsPerType: 10 * 2,
    perceptionRadius: 60,
    interactionRadius: 25,
    maxSpeedMultiplier: 3.0,
    maxForceMultiplier: 1.0,
    seekerProcessingTime: 90, // frames
    reviserProcessingTime: 240, // frames
    directorCohesionStrength: 0.5, // Multiplier
    conferrerExplorationUrgency: 0.1, // Chance to find new target
    separationForceMultiplier: 1.3
};

// Slider objects
let sliders = {};
let sliderTexts = {};

// --- Agent Class (Mostly Unchanged, but uses params) ---
class Cogent {
    constructor(x, y, animalType) {
        this.pos = createVector(x, y);
        this.vel = p5.Vector.random2D().mult(random(0.5, 2));
        this.acc = createVector(0, 0);
        this.baseMaxSpeed = 2.5; // Base speed, will be multiplied
        this.baseMaxForce = 0.15; // Base force, will be multiplied
        this.animalType = animalType;
        this.color = color(255);
        this.target = null;
        this.isProcessing = false;
        this.processingTimer = 0;
        this.lastTarget = null;

        // Assign color and potentially adjust baseMaxSpeed based on animal type
        if (animalType === 'Seeker') {
            this.color = color(255, 165, 0, 180); this.baseMaxSpeed = 3.0;
        } else if (animalType === 'Director') {
            this.color = color(0, 150, 255, 180); this.baseMaxSpeed = 2.2;
        } else if (animalType === 'Conferrer') {
            this.color = color(255, 0, 255, 180); this.baseMaxSpeed = 3.5;
        } else if (animalType === 'Reviser') {
            this.color = color(100, 100, 100, 200); this.baseMaxSpeed = 1.8;
        }
    }

    // Use params.maxSpeedMultiplier and params.maxForceMultiplier
    get maxSpeed() { return this.baseMaxSpeed * params.maxSpeedMultiplier; }
    get maxForce() { return this.baseMaxForce * params.maxForceMultiplier; }


    applyForce(force) {
        this.acc.add(force);
    }

    behave(others) {
        let steer = createVector(0, 0);

        if (this.isProcessing) {
            this.processingTimer--;
            if (this.processingTimer <= 0) {
                this.isProcessing = false;
            }
            this.vel.mult(0.95);
            if (this.vel.mag() < 0.1) this.vel.setMag(0);
            this.applyForce(steer);
            return;
        }

        if (this.animalType === 'Seeker') {
            steer.add(this.seekBehavior(others));
        } else if (this.animalType === 'Director') {
            steer.add(this.directBehavior(others));
        } else if (this.animalType === 'Conferrer') {
            steer.add(this.conferBehavior(others));
        } else if (this.animalType === 'Reviser') {
            steer.add(this.reviseBehavior(others));
        }

        steer.add(this.separationFromAll(others, params.interactionRadius * 0.9).mult(params.separationForceMultiplier));
        this.applyForce(steer);
    }

    seekBehavior(others) { // Consume
        let steer = createVector(0, 0);
        if (!this.target || random(1) < 0.05 || p5.Vector.dist(this.pos, this.target.pos) < params.interactionRadius * 0.5 ) {
            let potentialTargets = others.filter(o => o !== this && o !== this.lastTarget);
            if (potentialTargets.length > 0) {
                this.target = random(potentialTargets);
            } else {
                this.target = null;
            }
            this.lastTarget = this.target;
        }

        if (this.target) {
            let distToTarget = p5.Vector.dist(this.pos, this.target.pos);
            if (distToTarget < params.interactionRadius) {
                this.isProcessing = true;
                this.processingTimer = params.seekerProcessingTime;
                this.target = null;
                steer.add(this.vel.copy().mult(-0.5));
            } else {
                steer.add(this.seek(this.target.pos, 1.0, this.maxSpeed * 0.8));
            }
        } else {
            steer.add(this.exploreRandomly(1.2));
        }
        return steer.limit(this.maxForce);
    }

    directBehavior(others) { // Blast
        let steer = createVector(0,0);
        let centerOfMass = createVector(0,0);
        let avgVel = createVector(0,0);
        let perceivedNeighbors = 0;

        for (let other of others) {
            // Directors might try to organize anyone, or primarily their own "followers"
            // For simplicity, let's say they focus on nearby agents regardless of type for now
            if (other !== this) {
                let d = p5.Vector.dist(this.pos, other.pos);
                if (d < params.perceptionRadius * 1.2) { // Directors have slightly larger perception for organizing
                    centerOfMass.add(other.pos);
                    avgVel.add(other.vel);
                    perceivedNeighbors++;
                }
            }
        }

        if (perceivedNeighbors > 0) {
            centerOfMass.div(perceivedNeighbors);
            avgVel.div(perceivedNeighbors);

            steer.add(this.seek(centerOfMass, 0.8, this.maxSpeed * 0.5).mult(params.directorCohesionStrength));
            let desiredVel = avgVel.copy().setMag(this.maxSpeed * 0.2); // Target a slow, ordered speed
            let velSteer = p5.Vector.sub(desiredVel, this.vel);
            steer.add(velSteer.mult(0.5 * params.directorCohesionStrength));
        } else {
            steer.add(this.seek(createVector(width/2, height/2), 1.0, this.maxSpeed * 0.2));
        }
        return steer.limit(this.maxForce * 1.1);
    }

    conferBehavior(others) { // Play
        let steer = createVector(0,0);
        if (!this.target || random(1) < params.conferrerExplorationUrgency || p5.Vector.dist(this.pos, this.targetPos || this.pos) < params.interactionRadius * 1.5) {
            let potentialTargets = others.filter(o => o !== this);
            if (potentialTargets.length > 0) {
                let chosen = random(potentialTargets);
                this.targetPos = chosen.pos.copy();

                if (random(1) < 0.3 && potentialTargets.length > 1) {
                    let t1Agent = random(potentialTargets);
                    let t2Agent = random(potentialTargets.filter(o => o !== t1Agent));
                    if (t1Agent && t2Agent) {
                       this.targetPos = p5.Vector.lerp(t1Agent.pos, t2Agent.pos, 0.5);
                    }
                }
            } else {this.targetPos = null;}
        }


        if (this.targetPos) {
            steer.add(this.seek(this.targetPos, 1.0, this.maxSpeed));
        } else {
            steer.add(this.exploreRandomly(1.5));
        }
        // Conferrers might "disrupt" overly static agents
        for(let other of others) {
            if (other.animalType === 'Reviser' && other.isProcessing) {
                 let d = p5.Vector.dist(this.pos, other.pos);
                 if (d < params.perceptionRadius * 0.6 && random(1) < 0.005) { // Low chance to "poke" a deep reviser
                    let pokeForce = p5.Vector.sub(other.pos, this.pos).rotate(PI/3).setMag(this.maxForce * 2);
                    steer.add(pokeForce);
                    other.isProcessing = false; // Interrupt their processing
                 }
            }
        }
        return steer.limit(this.maxForce * 0.9); // Conferrers are agile, not forceful
    }

    reviseBehavior(others) { // Sleep
        let steer = createVector(0,0);
        let nearbyCount = 0;
        let sumNeighborPos = createVector(0,0);
        for (let other of others) {
            if (other !== this) {
                let d = p5.Vector.dist(this.pos, other.pos);
                if (d < params.perceptionRadius * 0.8) {
                    nearbyCount++;
                    sumNeighborPos.add(other.pos);
                }
            }
        }
        if(nearbyCount > 0) sumNeighborPos.div(nearbyCount);


        if (this.isProcessing) {
             this.vel.mult(0.90);
             if (this.vel.mag() < 0.05) this.vel.setMag(0);
             if (nearbyCount > 0 && p5.Vector.dist(this.pos, sumNeighborPos) < params.interactionRadius * 1.2) {
                let diff = p5.Vector.sub(this.pos, sumNeighborPos); // Move away slightly from avg
                steer.add(diff.normalize().mult(this.maxForce * 0.2));
             }
        } else {
            // Find a quiet spot
            if (nearbyCount < 2 ) { // If few enough neighbors
                this.isProcessing = true;
                this.processingTimer = params.reviserProcessingTime;
            } else { // Too crowded, move away from average neighbor position or explore gently
                if (nearbyCount > 3) { // If crowded, move away
                    let desired = p5.Vector.sub(this.pos, sumNeighborPos);
                     steer.add(this.seek(p5.Vector.add(this.pos, desired), 1.0, this.maxSpeed * 0.4));
                } else { // Just right or slightly too few, explore gently
                    steer.add(this.exploreRandomly(0.3));
                }
            }
        }
        return steer.limit(this.maxForce * 0.7);
    }

    exploreRandomly(strength = 1) {
        if (random(1) < 0.05 * strength) {
            this.vel.add(p5.Vector.random2D().mult(this.maxSpeed * 0.4 * strength));
            this.vel.limit(this.maxSpeed);
        }
        return p5.Vector.random2D().mult(this.maxForce * 0.15 * strength);
    }

    seek(targetPos, arrivalSlowingFactor = 1.0, speed = this.maxSpeed) {
        if (!targetPos) return createVector(0,0);
        let desired = p5.Vector.sub(targetPos, this.pos);
        let d = desired.mag();
        if (d < params.perceptionRadius * arrivalSlowingFactor) {
            let m = map(d, 0, params.perceptionRadius * arrivalSlowingFactor, 0, speed);
            desired.setMag(m);
        } else {
            desired.setMag(speed);
        }
        let steer = p5.Vector.sub(desired, this.vel);
        steer.limit(this.maxForce);
        return steer;
    }

    separationFromAll(others, separationDistance) {
        let steer = createVector(0,0);
        let count = 0;
        for (let other of others) {
            if (other !== this) {
                let d = dist(this.pos.x, this.pos.y, other.pos.x, other.pos.y);
                if (d > 0 && d < separationDistance) {
                    let diff = p5.Vector.sub(this.pos, other.pos);
                    diff.normalize();
                    diff.div(d*0.8); // Stronger repulsion for closer agents
                    steer.add(diff);
                    count++;
                }
            }
        }
        if (count > 0) {
            steer.div(count);
        }
        if (steer.mag() > 0) {
            steer.setMag(this.maxSpeed);
            steer.sub(this.vel);
            steer.limit(this.maxForce * 1.2);
        }
        return steer;
    }

    update() {
        this.vel.add(this.acc);
        this.vel.limit(this.maxSpeed); // Use the getter for maxSpeed
        this.pos.add(this.vel);
        this.acc.mult(0);
        this.edges();
    }

    display() {
        push();
        translate(this.pos.x, this.pos.y);
        rotate(this.vel.heading() + HALF_PI);
        fill(this.color);
        stroke(0);
        if (this.animalType === 'Seeker') { beginShape(); vertex(0, -8); vertex(-5, 5); vertex(5, 5); endShape(CLOSE); }
        else if (this.animalType === 'Director') { rectMode(CENTER); rect(0, 0, 12, 12); }
        else if (this.animalType === 'Conferrer') { ellipse(0, 0, 12, 12); }
        else if (this.animalType === 'Reviser') { beginShape(); vertex(0, -8); vertex(6, 0); vertex(0, 8); vertex(-6, 0); endShape(CLOSE); }
        if (this.isProcessing) { noFill(); stroke(255,255,255,80); ellipse(0,0,20,20); }
        pop();
    }

    edges() {
        if (this.pos.x > width + 10) this.pos.x = -10; else if (this.pos.x < -10) this.pos.x = width + 10;
        if (this.pos.y > height + 10) this.pos.y = -10; else if (this.pos.y < -10) this.pos.y = height + 10;
    }
}

// --- P5.js Sketch Functions ---
function setup() {
    createCanvas(CANVAS_WIDTH, CANVAS_HEIGHT);
    createSliders();
    resetSimulation(); // Initialize cogents
}

function createSliders() {
    let yPos = height - 130;
    const xStart = 10;
    const sliderWidth = 150;
    const spacing = 25;
    const col2XStart = xStart + sliderWidth + 70;

    sliders.numCogents = createSlider(1, 30, params.numCogentsPerType, 1);
    sliders.numCogents.position(xStart, yPos); sliders.numCogents.style('width', sliderWidth + 'px');
    sliderTexts.numCogents = createP('Agents/Type:'); sliderTexts.numCogents.position(xStart, yPos - 20);

    yPos += spacing;
    sliders.perceptionRadius = createSlider(10, 150, params.perceptionRadius, 1);
    sliders.perceptionRadius.position(xStart, yPos); sliders.perceptionRadius.style('width', sliderWidth + 'px');
    sliderTexts.perceptionRadius = createP('Perception Radius:'); sliderTexts.perceptionRadius.position(xStart, yPos - 20);

    yPos += spacing;
    sliders.interactionRadius = createSlider(5, 50, params.interactionRadius, 1);
    sliders.interactionRadius.position(xStart, yPos); sliders.interactionRadius.style('width', sliderWidth + 'px');
    sliderTexts.interactionRadius = createP('Interaction Radius:'); sliderTexts.interactionRadius.position(xStart, yPos - 20);
    
    yPos += spacing;
    sliders.separationForce = createSlider(0.1, 2.0, params.separationForceMultiplier, 0.1);
    sliders.separationForce.position(xStart, yPos); sliders.separationForce.style('width', sliderWidth + 'px');
    sliderTexts.separationForce = createP('Separation Force:'); sliderTexts.separationForce.position(xStart, yPos - 20);


    yPos = height - 130; // Reset for second column
    sliders.maxSpeedMult = createSlider(1, 5, params.maxSpeedMultiplier, 0.1);
    sliders.maxSpeedMult.position(col2XStart, yPos); sliders.maxSpeedMult.style('width', sliderWidth + 'px');
    sliderTexts.maxSpeedMult = createP('Max Speed Mult:'); sliderTexts.maxSpeedMult.position(col2XStart, yPos - 20);

    yPos += spacing;
    sliders.maxForceMult = createSlider(0.1, 3, params.maxForceMultiplier, 0.1);
    sliders.maxForceMult.position(col2XStart, yPos); sliders.maxForceMult.style('width', sliderWidth + 'px');
    sliderTexts.maxForceMult = createP('Max Force Mult:'); sliderTexts.maxForceMult.position(col2XStart, yPos - 20);

    yPos += spacing;
    sliders.seekerProcTime = createSlider(10, 300, params.seekerProcessingTime, 10);
    sliders.seekerProcTime.position(col2XStart, yPos); sliders.seekerProcTime.style('width', sliderWidth + 'px');
    sliderTexts.seekerProcTime = createP('Seeker Proc. Time:'); sliderTexts.seekerProcTime.position(col2XStart, yPos - 20);

    yPos += spacing;
    sliders.reviserProcTime = createSlider(30, 600, params.reviserProcessingTime, 10);
    sliders.reviserProcTime.position(col2XStart, yPos); sliders.reviserProcTime.style('width', sliderWidth + 'px');
    sliderTexts.reviserProcTime = createP('Reviser Proc. Time:'); sliderTexts.reviserProcTime.position(col2XStart, yPos - 20);


    const col3XStart = col2XStart + sliderWidth + 70;
    yPos = height - 130;
    sliders.directorCohesion = createSlider(0.1, 2.0, params.directorCohesionStrength, 0.1);
    sliders.directorCohesion.position(col3XStart, yPos); sliders.directorCohesion.style('width', sliderWidth + 'px');
    sliderTexts.directorCohesion = createP('Director Cohesion:'); sliderTexts.directorCohesion.position(col3XStart, yPos - 20);

    yPos += spacing;
    sliders.conferrerUrgency = createSlider(0.01, 0.5, params.conferrerExplorationUrgency, 0.01);
    sliders.conferrerUrgency.position(col3XStart, yPos); sliders.conferrerUrgency.style('width', sliderWidth + 'px');
    sliderTexts.conferrerUrgency = createP('Conferrer Urgency:'); sliderTexts.conferrerUrgency.position(col3XStart, yPos - 20);

    yPos += spacing;
    sliders.simSpeed = createSlider(1, 10, simulationSpeed, 1);
    sliders.simSpeed.position(col3XStart, yPos); sliders.simSpeed.style('width', sliderWidth + 'px');
    sliderTexts.simSpeed = createP('Simulation Speed:'); sliderTexts.simSpeed.position(col3XStart, yPos - 20);

    // Style all slider text
    for (let key in sliderTexts) {
        sliderTexts[key].style('color', 'white');
        sliderTexts[key].style('font-size', '10px');
    }

    let resetButton = createButton('Reset Simulation');
    resetButton.position(col3XStart, yPos + spacing + 5);
    resetButton.mousePressed(resetSimulation);
}


function updateParamsFromSliders() {
    params.numCogentsPerType = sliders.numCogents.value();
    params.perceptionRadius = sliders.perceptionRadius.value();
    params.interactionRadius = sliders.interactionRadius.value();
    params.maxSpeedMultiplier = sliders.maxSpeedMult.value();
    params.maxForceMultiplier = sliders.maxForceMult.value();
    params.seekerProcessingTime = sliders.seekerProcTime.value();
    params.reviserProcessingTime = sliders.reviserProcTime.value();
    params.directorCohesionStrength = sliders.directorCohesion.value();
    params.conferrerExplorationUrgency = sliders.conferrerUrgency.value();
    params.separationForceMultiplier = sliders.separationForce.value();
    simulationSpeed = sliders.simSpeed.value();

    // Update displayed values next to sliders (optional, but good UX)
    sliderTexts.numCogents.html('Agents/Type: ' + params.numCogentsPerType);
    sliderTexts.perceptionRadius.html('Perception Radius: ' + params.perceptionRadius);
    sliderTexts.interactionRadius.html('Interaction Radius: ' + params.interactionRadius);
    sliderTexts.maxSpeedMult.html('Max Speed Mult: ' + params.maxSpeedMultiplier.toFixed(1));
    sliderTexts.maxForceMult.html('Max Force Mult: ' + params.maxForceMultiplier.toFixed(1));
    sliderTexts.seekerProcTime.html('Seeker Proc. Time: ' + params.seekerProcessingTime);
    sliderTexts.reviserProcTime.html('Reviser Proc. Time: ' + params.reviserProcessingTime);
    sliderTexts.directorCohesion.html('Director Cohesion: ' + params.directorCohesionStrength.toFixed(1));
    sliderTexts.conferrerUrgency.html('Conferrer Urgency: ' + params.conferrerExplorationUrgency.toFixed(2));
    sliderTexts.separationForce.html('Separation Force: ' + params.separationForceMultiplier.toFixed(1));
    sliderTexts.simSpeed.html('Simulation Speed: ' + simulationSpeed + 'x');
}

function resetSimulation() {
    cogents = [];
    // Use current slider value for numCogentsPerType if sliders are initialized
    let num = sliders.numCogents ? sliders.numCogents.value() : params.numCogentsPerType;
    for (let i = 0; i < num; i++) {
        cogents.push(new Cogent(random(width), random(height), 'Seeker'));
        cogents.push(new Cogent(random(width), random(height), 'Director'));
        cogents.push(new Cogent(random(width), random(height), 'Conferrer'));
        cogents.push(new Cogent(random(width), random(height), 'Reviser'));
    }
}


function draw() {
    background(30);
    updateParamsFromSliders(); // Update params each frame from sliders

    for (let s = 0; s < simulationSpeed; s++) { // Simulation speed loop
        for (let cogent of cogents) {
            cogent.behave(cogents);
            cogent.update();
        }
    }

    for (let cogent of cogents) {
        cogent.display();
    }

    // Display legend (adjusted for more slider space)
    fill(255);
    noStroke();
    textSize(10);
    const legendYStart = 20;
    const legendSpacing = 15;
    text("Orange Triangle (Seeker/Consume)", 10, legendYStart);
    text("Blue Square (Director/Blast)", 10, legendYStart + legendSpacing);
    text("Magenta Circle (Conferrer/Play)", 10, legendYStart + legendSpacing * 2);
    text("Grey Diamond (Reviser/Sleep)", 10, legendYStart + legendSpacing * 3);
}

// Mouse pressed handled by reset button now.
// function mousePressed() {
//     if (mouseY < height - 150) { // Avoid triggering reset if clicking on sliders
//          resetSimulation();
//     }
// }