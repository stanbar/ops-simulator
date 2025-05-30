// --- Global Variables & Parameters ---
let cogents = [];
let simulationSpeed = 1;
let landscape; // Global landscape object

let params = {
    numCogentsPerType: 7, // Adjusted for potentially more complex interactions
    perceptionRadius: 70,
    interactionRadius: 25,
    maxSpeedMultiplier: 1.0,
    maxForceMultiplier: 1.0,
    separationForceMultiplier: 1.2,
    seekerProcessingTime: 90,
    reviserProcessingTime: 240,
    directorCohesionStrength: 0.5,
    conferrerExplorationUrgency: 0.15,
    // Landscape Parameters
    landscapeResolution: 20, // Size of each landscape cell in pixels
    landscapeNoiseScale: 0.03, // Perlin noise scale
    // Animal-Landscape Interaction Parameters
    sleepEntropyThreshold: 0.35, // Below this, Sleep agent considers settling
    sleepSteepnessSensitivity: 0.8, // How strongly Sleep seeks lower entropy
    consumeGradientPreference: 0.3 // How much Consume leans towards gradients
};

let sliders = {};
let sliderTexts = {};

const PERSONALITY_TYPES = { /* ... (same as before) ... */
    "CP/S(B)": { Consume: 9, Play: 6, Sleep: 3, Blast: 1 },
    "SC/B(P)": { Sleep: 9, Consume: 6, Blast: 3, Play: 1 },
    "PB/C(S)": { Play: 9, Blast: 6, Consume: 3, Sleep: 1 },
    "BS/P(C)": { Blast: 9, Sleep: 6, Play: 3, Consume: 1 }
};
const personalityTypeKeys = Object.keys(PERSONALITY_TYPES);

// --- Landscape Class ---
class Landscape {
    constructor(cols, rows, resolution, noiseScale) {
        this.cols = cols;
        this.rows = rows;
        this.resolution = resolution;
        this.noiseScale = noiseScale;
        this.grid = [];
        this.generate();
    }

    generate() {
        this.grid = []; // Clear previous grid
        for (let i = 0; i < this.cols; i++) {
            this.grid[i] = [];
            for (let j = 0; j < this.rows; j++) {
                // Generate Perlin noise value (0 to 1)
                let noiseVal = noise(i * this.noiseScale, j * this.noiseScale);
                this.grid[i][j] = noiseVal;
            }
        }
    }

    display() {
        for (let i = 0; i < this.cols; i++) {
            for (let j = 0; j < this.rows; j++) {
                let entropyVal = this.grid[i][j];
                // Color mapping: Low entropy (blue/green), High entropy (red/orange)
                let from = color(0, 50, 150); // Deep Blue (Low Entropy)
                let mid = color(50, 150, 50); // Green (Mid-Low)
                let to = color(200, 50, 0);   // Deep Red (High Entropy)
                
                let c;
                if (entropyVal < 0.5) {
                    c = lerpColor(from, mid, map(entropyVal, 0, 0.5, 0, 1));
                } else {
                    c = lerpColor(mid, to, map(entropyVal, 0.5, 1, 0, 1));
                }

                noStroke();
                fill(c);
                rect(i * this.resolution, j * this.resolution, this.resolution, this.resolution);
            }
        }
    }

    getValue(x, y) {
        let i = floor(x / this.resolution);
        let j = floor(y / this.resolution);
        // Clamp indices to be within grid bounds
        i = constrain(i, 0, this.cols - 1);
        j = constrain(j, 0, this.rows - 1);
        if (this.grid[i] && typeof this.grid[i][j] !== 'undefined') {
            return this.grid[i][j];
        }
        return 0.5; // Default if out of bounds (should not happen with constrain)
    }

    // Get approximated gradient vector (direction of steepest ascent)
    getGradient(x, y) {
        let valCenter = this.getValue(x, y);
        // Check neighbors (small step)
        let step = this.resolution / 4 > 0 ? this.resolution / 4 : 1; // Ensure step is at least 1
        let valRight = this.getValue(x + step, y);
        let valLeft = this.getValue(x - step, y);
        let valUp = this.getValue(x, y - step);
        let valDown = this.getValue(x, y + step);

        let dx = (valRight - valLeft) / (2*step) ; // Approximate derivative in x
        let dy = (valDown - valUp) / (2*step) ; // Approximate derivative in y
        
        let grad = createVector(dx, dy);
        // Normalize if magnitude is not zero, otherwise return zero vector
        if (grad.magSq() > 0) { // Use magSq for efficiency
            return grad.normalize();
        }
        return createVector(0, 0);
    }
}


// --- Agent Class (Modifications for Landscape Interaction) ---
class Cogent {
    constructor(x, y, personalityTypeName) {
        // ... (most of the constructor is the same as previous version) ...
        this.pos = createVector(x, y);
        this.vel = p5.Vector.random2D().mult(random(1, 2.5));
        this.acc = createVector(0, 0);

        this.personalityTypeName = personalityTypeName;
        this.animalPreferences = PERSONALITY_TYPES[personalityTypeName];
        this.currentAnimalBehavior = null;
        this.baseMaxSpeed = 2.5;
        this.baseMaxForce = 0.15;

        this.color = this.getPersonalityColor(personalityTypeName);
        this.activeAnimalIndicatorColor = color(255);

        this.target = null;
        this.isProcessing = false;
        this.processingTimer = 0;
        this.lastTarget = null;
        this.selectActiveAnimalBehavior();
    }
    getPersonalityColor(typeName) { /* ... same ... */
        if (typeName.startsWith("CP")) return color(255, 100, 0, 200);
        if (typeName.startsWith("PB")) return color(200, 50, 50, 200);
        if (typeName.startsWith("SC")) return color(50, 200, 50, 200);
        if (typeName.startsWith("BS")) return color(50, 50, 200, 200);
        return color(128);
    }
    get maxSpeed() { /* ... same, uses params.maxSpeedMultiplier ... */
        let speed = this.baseMaxSpeed;
        if (this.currentAnimalBehavior === 'Play') speed *= 1.2;
        else if (this.currentAnimalBehavior === 'Consume') speed *= 1.1;
        else if (this.currentAnimalBehavior === 'Sleep') speed *= 0.7;
        else if (this.currentAnimalBehavior === 'Blast') speed *= 0.9;
        return speed * params.maxSpeedMultiplier;
    }
    get maxForce() { return this.baseMaxForce * params.maxForceMultiplier; }

    selectActiveAnimalBehavior() { /* ... (same as previous version) ... */
        if (this.isProcessing) {
            if (this.currentAnimalBehavior === 'Consume' || this.currentAnimalBehavior === 'Sleep') return;
            else this.isProcessing = false;
        }
        let tempPreferences = {...this.animalPreferences};
        if (this.currentAnimalBehavior && this.currentAnimalBehavior !== 'Sleep' && this.currentAnimalBehavior !== 'Consume' && !this.isProcessing) {
            if (tempPreferences[this.currentAnimalBehavior]) tempPreferences[this.currentAnimalBehavior] *= 0.7;
        }
        let choices = []; let totalWeight = 0;
        for (const animal in tempPreferences) {
            choices.push({ animal: animal, weight: tempPreferences[animal] });
            totalWeight += tempPreferences[animal];
        }
        let rand = random(totalWeight); let cumulativeWeight = 0; let chosenAnimal = null;
        for (const choice of choices) {
            cumulativeWeight += choice.weight;
            if (rand <= cumulativeWeight) { chosenAnimal = choice.animal; break; }
        }
        this.currentAnimalBehavior = chosenAnimal;
        if (this.currentAnimalBehavior === 'Consume') this.activeAnimalIndicatorColor = color(255, 165, 0);
        else if (this.currentAnimalBehavior === 'Blast') this.activeAnimalIndicatorColor = color(0, 150, 255);
        else if (this.currentAnimalBehavior === 'Play') this.activeAnimalIndicatorColor = color(255, 0, 255);
        else if (this.currentAnimalBehavior === 'Sleep') this.activeAnimalIndicatorColor = color(200, 200, 200);
    }

    applyForce(force) { this.acc.add(force); }

    behave(others, lscape) { // Added lscape parameter
        let steer = createVector(0, 0);

        if (this.isProcessing) {
            // ... (same processing logic) ...
            this.processingTimer--;
            if (this.processingTimer <= 0) {
                this.isProcessing = false;
                this.selectActiveAnimalBehavior();
            }
            this.vel.mult(0.90);
            if (this.vel.mag() < 0.05) this.vel.setMag(0);
            steer.add(this.separationFromAll(others, params.interactionRadius * 0.5).mult(0.1));
            this.applyForce(steer);
            return;
        }

        if (frameCount % 30 === 0 || random(1) < 0.02) {
            this.selectActiveAnimalBehavior();
        }

        // --- Pass landscape to animal behaviors ---
        if (this.currentAnimalBehavior === 'Consume') {
            steer.add(this.consumeBehavior(others, lscape));
        } else if (this.currentAnimalBehavior === 'Blast') {
            steer.add(this.blastBehavior(others, lscape));
        } else if (this.currentAnimalBehavior === 'Play') {
            steer.add(this.playBehavior(others, lscape));
        } else if (this.currentAnimalBehavior === 'Sleep') {
            steer.add(this.sleepBehavior(others, lscape));
        }

        steer.add(this.separationFromAll(others, params.interactionRadius * 0.8).mult(params.separationForceMultiplier));
        this.applyForce(steer);
    }

    // --- ANIMAL BEHAVIORS MODIFIED FOR LANDSCAPE ---
    consumeBehavior(others, lscape) {
        let steer = createVector(0, 0);
        let localEntropy = lscape.getValue(this.pos.x, this.pos.y);
        let landscapeGradient = lscape.getGradient(this.pos.x, this.pos.y);

        // Tendency to explore gradients
        if (landscapeGradient.magSq() > 0.01 && random(1) < params.consumeGradientPreference) { // Only if gradient is somewhat significant
            // Move somewhat along or across the gradient
            let gradientExploreForce = landscapeGradient.copy().rotate(random(-PI / 3, PI / 3));
            steer.add(gradientExploreForce.setMag(this.maxForce * 0.3));
        }

        // ... (rest of consumeBehavior mostly same, target selection logic) ...
        if (!this.target || random(1) < 0.05 || (this.target && p5.Vector.dist(this.pos, this.target.pos) < params.interactionRadius * 0.5) ) {
            let potentialTargets = others.filter(o => o !== this && o !== this.lastTarget);
            if (potentialTargets.length > 0) this.target = random(potentialTargets);
            else this.target = null;
            this.lastTarget = this.target;
        }
        if (this.target) {
            let distToTarget = p5.Vector.dist(this.pos, this.target.pos);
            if (distToTarget < params.interactionRadius) {
                this.isProcessing = true;
                this.processingTimer = params.seekerProcessingTime || 90;
                this.target = null;
                steer.add(this.vel.copy().mult(-0.2));
            } else {
                steer.add(this.seek(this.target.pos, 1.0, this.maxSpeed * 0.9));
            }
        } else {
            steer.add(this.exploreRandomly(1.1));
        }
        return steer.limit(this.maxForce);
    }

    blastBehavior(others, lscape) {
        let steer = createVector(0,0);
        let localEntropy = lscape.getValue(this.pos.x, this.pos.y);
        
        // Blast prefers moderately stable, not too chaotic areas for organizing
        if (localEntropy > 0.65 && random(1) < 0.1) { // If landscape is too chaotic
            let gradient = lscape.getGradient(this.pos.x, this.pos.y);
            steer.add(gradient.mult(-1).setMag(this.maxForce * 0.4)); // Move towards less entropy
        }

        // ... (rest of blastBehavior mostly same, group forming logic) ...
        let centerOfMass = createVector(0,0); let avgVel = createVector(0,0); let perceivedNeighbors = 0;
        for (let other of others) {
            if (other !== this) {
                let d = p5.Vector.dist(this.pos, other.pos);
                if (d < params.perceptionRadius * 1.1) {
                    centerOfMass.add(other.pos); avgVel.add(other.vel); perceivedNeighbors++;
                }
            }
        }
        if (perceivedNeighbors > 1) { // Reduced from 2 for smaller groups
            centerOfMass.div(perceivedNeighbors); avgVel.div(perceivedNeighbors);
            steer.add(this.seek(centerOfMass, 0.8, this.maxSpeed * 0.6).mult(params.directorCohesionStrength || 0.5));
            let desiredVel = avgVel.copy().setMag(this.maxSpeed * 0.3);
            let velSteer = p5.Vector.sub(desiredVel, this.vel);
            steer.add(velSteer.mult(0.4 * (params.directorCohesionStrength || 0.5) ));
        } else {
            steer.add(this.seek(createVector(width/2, height/2), 1.0, this.maxSpeed * 0.4));
        }
        return steer.limit(this.maxForce * 1.05);
    }

    playBehavior(others, lscape) {
        let steer = createVector(0,0);
        // Play is less directly driven by landscape minima/maxima for self,
        // but uses it as a stage. Might favor areas with activity or varied features.
        let localEntropy = lscape.getValue(this.pos.x, this.pos.y);
        if (localEntropy < 0.2 && random(1) < 0.05) { // If too "boring" might seek more varied areas
            let gradient = lscape.getGradient(this.pos.x, this.pos.y);
            steer.add(gradient.mult(1).setMag(this.maxForce * 0.3)); // Move towards more entropy
        }

        // ... (rest of playBehavior mostly same, target interaction logic) ...
        if (!this.target || random(1) < (params.conferrerExplorationUrgency || 0.15) || (this.target && p5.Vector.dist(this.pos, this.target.pos) < params.interactionRadius * 1.2)) {
            let potentialTargets = others.filter(o => o !== this);
            if (potentialTargets.length > 0) {
                let chosen = random(potentialTargets); this.target = chosen;
                if (random(1) < 0.4 && potentialTargets.length > 1) {
                    let t1Agent = random(potentialTargets); let t2Agent = random(potentialTargets.filter(o => o !== t1Agent));
                    if (t1Agent && t2Agent) this.target = { pos: p5.Vector.lerp(t1Agent.pos, t2Agent.pos, 0.5) };
                }
            } else {this.target = null;}
        }
        if (this.target && this.target.pos) {
            steer.add(this.seek(this.target.pos, 1.0, this.maxSpeed));
            if (p5.Vector.dist(this.pos, this.target.pos) < params.interactionRadius * 1.5 && this.target !== this) {
                if(random(1) < 0.1) {
                    let dodge = p5.Vector.sub(this.pos, this.target.pos).rotate(random(-PI/2, PI/2));
                    dodge.setMag(this.maxSpeed); steer.add(p5.Vector.sub(dodge, this.vel).limit(this.maxForce * 1.5));
                }
                if (this.target.currentAnimalBehavior === 'Sleep' && this.target.isProcessing && random(1) < 0.03) this.target.isProcessing = false;
            }
        } else { steer.add(this.exploreRandomly(1.6)); }
        return steer.limit(this.maxForce);
    }

    sleepBehavior(others, lscape) {
        let steer = createVector(0,0);
        let localEntropy = lscape.getValue(this.pos.x, this.pos.y);
        let landscapeGradient = lscape.getGradient(this.pos.x, this.pos.y);

        if (this.isProcessing) {
            this.vel.mult(0.88);
            if (this.vel.mag() < 0.03) this.vel.setMag(0);
            // If landscape shifts or pushed, try to re-settle
            if (localEntropy > params.sleepEntropyThreshold + 0.1 && landscapeGradient.magSq() > 0.001) {
                 steer.add(landscapeGradient.mult(-1).setMag(this.maxForce * params.sleepSteepnessSensitivity * 0.5));
            }
        } else {
            // Primary drive: move towards lower entropy if not already low enough
            if (localEntropy > params.sleepEntropyThreshold && landscapeGradient.magSq() > 0.001) {
                let seekLowerEntropy = landscapeGradient.mult(-1); // Move against gradient
                steer.add(seekLowerEntropy.setMag(this.maxForce * params.sleepSteepnessSensitivity));
            } else if (localEntropy <= params.sleepEntropyThreshold) {
                // Found a good spot, start processing
                this.isProcessing = true;
                this.processingTimer = params.reviserProcessingTime || 240;
                this.vel.mult(0.5); // Dampen velocity upon starting processing
            } else {
                // If landscape is flat and not low enough, explore gently for a better spot
                steer.add(this.exploreRandomly(0.15));
            }
        }
        // ... (neighbor-based logic for solitude remains, but landscape is primary) ...
        let nearbyCount = 0; /* ... */
        // if (nearbyCount > 1 && this.isProcessing) { /* slightly nudge away from crowd if processing */ }

        return steer.limit(this.maxForce * 0.8); // Sleep is not forceful
    }

    // --- Helper Behaviors, Update, Display, Edges ---
    exploreRandomly(strength = 1) { /* ... same ... */
        if (random(1) < 0.06 * strength) {
            this.vel.add(p5.Vector.random2D().mult(this.maxSpeed * 0.5 * strength));
            this.vel.limit(this.maxSpeed);
        }
        return p5.Vector.random2D().mult(this.maxForce * 0.2 * strength);
    }
    seek(targetPos, arrivalSlowingFactor = 1.0, speed = this.maxSpeed) { /* ... same ... */
        if (!targetPos) return createVector(0,0);
        let desired = p5.Vector.sub(targetPos, this.pos); let d = desired.mag();
        let perception = params.perceptionRadius || 60;
        if (d < perception * arrivalSlowingFactor) desired.setMag(map(d, 0, perception * arrivalSlowingFactor, 0, speed));
        else desired.setMag(speed);
        let s = p5.Vector.sub(desired, this.vel); s.limit(this.maxForce); return s;
    }
    separationFromAll(others, separationDistance) { /* ... same ... */
        let steer = createVector(0,0); let count = 0;
        for (let other of others) {
            if (other !== this) {
                let d = dist(this.pos.x, this.pos.y, other.pos.x, other.pos.y);
                if (d > 0 && d < separationDistance) {
                    let diff = p5.Vector.sub(this.pos, other.pos); diff.normalize(); diff.div(d*0.7);
                    steer.add(diff); count++;
                }
            }
        }
        if (count > 0) steer.div(count);
        if (steer.magSq() > 0) { steer.setMag(this.maxSpeed); steer.sub(this.vel); steer.limit(this.maxForce * 1.3); }
        return steer;
    }
    update() { /* ... same ... */
        this.vel.add(this.acc); this.vel.limit(this.maxSpeed);
        this.pos.add(this.vel); this.acc.mult(0); this.edges();
    }
    display() { /* ... same ... */
        push(); translate(this.pos.x, this.pos.y); rotate(this.vel.heading() + HALF_PI);
        fill(this.color); stroke(50, 200); strokeWeight(1); ellipse(0, 0, 16, 16);
        fill(this.activeAnimalIndicatorColor); noStroke();
        if (this.currentAnimalBehavior === 'Consume') { beginShape(); vertex(0, -6); vertex(-4, 4); vertex(4, 4); endShape(CLOSE); }
        else if (this.currentAnimalBehavior === 'Blast') { rectMode(CENTER); rect(0, 0, 9, 9); }
        else if (this.currentAnimalBehavior === 'Play') { ellipse(0, 0, 9, 9); }
        else if (this.currentAnimalBehavior === 'Sleep') { beginShape(); vertex(0, -6); vertex(4.5, 0); vertex(0, 6); vertex(-4.5, 0); endShape(CLOSE); }
        if (this.isProcessing) { noFill(); stroke(this.activeAnimalIndicatorColor || 255, 150); strokeWeight(1.5); ellipse(0,0,18,18); }
        pop();
    }
    edges() { /* ... same ... */
        if (this.pos.x > width + 10) this.pos.x = -10; else if (this.pos.x < -10) this.pos.x = width + 10;
        if (this.pos.y > height + 10) this.pos.y = -10; else if (this.pos.y < -10) this.pos.y = height + 10;
    }
}


// --- P5.js Sketch Functions ---
function setup() {
    createCanvas(800 * 2, 750 * 2); // Height includes slider space
    landscape = new Landscape(
        ceil(width / params.landscapeResolution),
        ceil((height - 150) / params.landscapeResolution), // Exclude slider area from landscape
        params.landscapeResolution,
        params.landscapeNoiseScale
    );
    createSliders();
    resetSimulation();
    // Update params from sliders once at start to reflect defaults if sliders are set
    updateParamsFromSliders();
    landscape.noiseScale = params.landscapeNoiseScale; // Ensure landscape uses slider value
    landscape.generate(); // Regenerate landscape with potentially new scale
}

function createSliders() {
    let yPos = height - 130; const xStart = 10; const sliderWidth = 120; const spacing = 23;
    const col2XStart = xStart + sliderWidth + 30;
    const col3XStart = col2XStart + sliderWidth + 30;
    const col4XStart = col3XStart + sliderWidth + 30;

    // Column 1
    sliders.numCogents = createSlider(1, 15, params.numCogentsPerType, 1);
    sliders.numCogents.position(xStart, yPos); sliders.numCogents.style('width', sliderWidth + 'px');
    sliderTexts.numCogents = createP(''); sliderTexts.numCogents.position(xStart, yPos - 20);
    yPos += spacing;
    sliders.perceptionRadius = createSlider(20, 200, params.perceptionRadius, 1);
    sliders.perceptionRadius.position(xStart, yPos); sliders.perceptionRadius.style('width', sliderWidth + 'px');
    sliderTexts.perceptionRadius = createP(''); sliderTexts.perceptionRadius.position(xStart, yPos - 20);
    yPos += spacing;
    sliders.interactionRadius = createSlider(10, 100, params.interactionRadius, 1);
    sliders.interactionRadius.position(xStart, yPos); sliders.interactionRadius.style('width', sliderWidth + 'px');
    sliderTexts.interactionRadius = createP(''); sliderTexts.interactionRadius.position(xStart, yPos - 20);
    yPos += spacing;
    sliders.separationForce = createSlider(0.1, 3.0, params.separationForceMultiplier, 0.1);
    sliders.separationForce.position(xStart, yPos); sliders.separationForce.style('width', sliderWidth + 'px');
    sliderTexts.separationForce = createP(''); sliderTexts.separationForce.position(xStart, yPos - 20);

    // Column 2
    yPos = height - 130;
    sliders.maxSpeedMult = createSlider(0.1, 2.0, params.maxSpeedMultiplier, 0.1); // Reduced range
    sliders.maxSpeedMult.position(col2XStart, yPos); sliders.maxSpeedMult.style('width', sliderWidth + 'px');
    sliderTexts.maxSpeedMult = createP(''); sliderTexts.maxSpeedMult.position(col2XStart, yPos - 20);
    yPos += spacing;
    sliders.maxForceMult = createSlider(0.1, 2.0, params.maxForceMultiplier, 0.1); // Reduced range
    sliders.maxForceMult.position(col2XStart, yPos); sliders.maxForceMult.style('width', sliderWidth + 'px');
    sliderTexts.maxForceMult = createP(''); sliderTexts.maxForceMult.position(col2XStart, yPos - 20);
    yPos += spacing;
    sliders.seekerProcTime = createSlider(10, 300, params.seekerProcessingTime || 90, 10);
    sliders.seekerProcTime.position(col2XStart, yPos); sliders.seekerProcTime.style('width', sliderWidth + 'px');
    sliderTexts.seekerProcTime = createP(''); sliderTexts.seekerProcTime.position(col2XStart, yPos - 20);
    yPos += spacing;
    sliders.reviserProcTime = createSlider(30, 600, params.reviserProcessingTime || 240, 10);
    sliders.reviserProcTime.position(col2XStart, yPos); sliders.reviserProcTime.style('width', sliderWidth + 'px');
    sliderTexts.reviserProcTime = createP(''); sliderTexts.reviserProcTime.position(col2XStart, yPos - 20);

    // Column 3
    yPos = height - 130;
    sliders.directorCohesion = createSlider(0.1, 2.0, params.directorCohesionStrength || 0.5, 0.1);
    sliders.directorCohesion.position(col3XStart, yPos); sliders.directorCohesion.style('width', sliderWidth + 'px');
    sliderTexts.directorCohesion = createP(''); sliderTexts.directorCohesion.position(col3XStart, yPos - 20);
    yPos += spacing;
    sliders.conferrerUrgency = createSlider(0.01, 0.5, params.conferrerExplorationUrgency || 0.15, 0.01);
    sliders.conferrerUrgency.position(col3XStart, yPos); sliders.conferrerUrgency.style('width', sliderWidth + 'px');
    sliderTexts.conferrerUrgency = createP(''); sliderTexts.conferrerUrgency.position(col3XStart, yPos - 20);
    yPos += spacing;
    sliders.landscapeNoise = createSlider(0.005, 0.1, params.landscapeNoiseScale, 0.001);
    sliders.landscapeNoise.position(col3XStart, yPos); sliders.landscapeNoise.style('width', sliderWidth + 'px');
    sliderTexts.landscapeNoise = createP(''); sliderTexts.landscapeNoise.position(col3XStart, yPos - 20);
    yPos += spacing;
    sliders.sleepThreshold = createSlider(0.1, 0.7, params.sleepEntropyThreshold, 0.01);
    sliders.sleepThreshold.position(col3XStart, yPos); sliders.sleepThreshold.style('width', sliderWidth + 'px');
    sliderTexts.sleepThreshold = createP(''); sliderTexts.sleepThreshold.position(col3XStart, yPos - 20);


    // Column 4
    yPos = height - 130;
    sliders.sleepSteepness = createSlider(0.1, 2.0, params.sleepSteepnessSensitivity, 0.1);
    sliders.sleepSteepness.position(col4XStart, yPos); sliders.sleepSteepness.style('width', sliderWidth + 'px');
    sliderTexts.sleepSteepness = createP(''); sliderTexts.sleepSteepness.position(col4XStart, yPos - 20);
    yPos += spacing;
    sliders.consumeGradientPref = createSlider(0.0, 1.0, params.consumeGradientPreference, 0.05);
    sliders.consumeGradientPref.position(col4XStart, yPos); sliders.consumeGradientPref.style('width', sliderWidth + 'px');
    sliderTexts.consumeGradientPref = createP(''); sliderTexts.consumeGradientPref.position(col4XStart, yPos - 20);
    yPos += spacing;
    sliders.simSpeed = createSlider(1, 10, simulationSpeed, 1);
    sliders.simSpeed.position(col4XStart, yPos); sliders.simSpeed.style('width', sliderWidth + 'px');
    sliderTexts.simSpeed = createP(''); sliderTexts.simSpeed.position(col4XStart, yPos - 20);


    for (let key in sliderTexts) { sliderTexts[key].style('color', 'white'); sliderTexts[key].style('font-size', '10px'); }
    let resetButton = createButton('Reset Sim & Landscape');
    resetButton.position(col4XStart, yPos + spacing + 5);
    resetButton.mousePressed(fullReset);
}

function updateParamsFromSliders() {
    // ... (update all params from sliders. ... .value()) ...
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
    params.landscapeNoiseScale = sliders.landscapeNoise.value();
    params.sleepEntropyThreshold = sliders.sleepThreshold.value();
    params.sleepSteepnessSensitivity = sliders.sleepSteepness.value();
    params.consumeGradientPreference = sliders.consumeGradientPref.value();
    simulationSpeed = sliders.simSpeed.value();

    // ... (update all sliderTexts. ... .html()) ...
    sliderTexts.numCogents.html('Agents/Pers.Type: ' + params.numCogentsPerType);
    sliderTexts.perceptionRadius.html('Perception Rad: ' + params.perceptionRadius);
    sliderTexts.interactionRadius.html('Interact Rad: ' + params.interactionRadius);
    sliderTexts.maxSpeedMult.html('Max Speed Mult: ' + params.maxSpeedMultiplier.toFixed(1));
    sliderTexts.maxForceMult.html('Max Force Mult: ' + params.maxForceMultiplier.toFixed(1));
    sliderTexts.seekerProcTime.html('Consume Proc: ' + params.seekerProcessingTime);
    sliderTexts.reviserProcTime.html('Sleep Proc: ' + params.reviserProcessingTime);
    sliderTexts.directorCohesion.html('Blast Cohesion: ' + params.directorCohesionStrength.toFixed(1));
    sliderTexts.conferrerUrgency.html('Play Urgency: ' + params.conferrerExplorationUrgency.toFixed(2));
    sliderTexts.separationForce.html('Separation F: ' + params.separationForceMultiplier.toFixed(1));
    sliderTexts.landscapeNoise.html('Landscape Noise: ' + params.landscapeNoiseScale.toFixed(3));
    sliderTexts.sleepThreshold.html('Sleep Thresh: ' + params.sleepEntropyThreshold.toFixed(2));
    sliderTexts.sleepSteepness.html('Sleep Grad Sens: ' + params.sleepSteepnessSensitivity.toFixed(1));
    sliderTexts.consumeGradientPref.html('Consume Grad Pref: ' + params.consumeGradientPreference.toFixed(2));
    sliderTexts.simSpeed.html('Sim Speed: ' + simulationSpeed + 'x');
}

function fullReset() {
    // Regenerate landscape with current noise scale
    landscape.noiseScale = params.landscapeNoiseScale; // Ensure it uses the latest slider value
    noiseSeed(millis()); // Change noise pattern on full reset
    landscape.generate();
    resetSimulation();
}

function resetSimulation() {
    cogents = [];
    let numPerPersonality = sliders.numCogents ? sliders.numCogents.value() : params.numCogentsPerType;
    // Ensure personalityTypeKeys is defined
    if (typeof personalityTypeKeys !== 'undefined' && personalityTypeKeys.length > 0) {
        for (let i = 0; i < numPerPersonality; i++) {
            for (const pTypeName of personalityTypeKeys) {
                cogents.push(new Cogent(random(width), random(height - 150), pTypeName)); // Spawn above sliders
            }
        }
        if (numPerPersonality === 0 && personalityTypeKeys.length > 0) {
             for (const pTypeName of personalityTypeKeys) {
                cogents.push(new Cogent(random(width), random(height-150), pTypeName));
            }
        }
    } else {
        console.error("personalityTypeKeys is not defined or empty!");
    }
}


function draw() {
    background(30);
    updateParamsFromSliders();

    landscape.display(); // Display landscape first

    for (let s = 0; s < simulationSpeed; s++) {
        for (let cogent of cogents) {
            cogent.behave(cogents, landscape); // Pass landscape to behave method
            cogent.update();
        }
    }

    for (let cogent of cogents) {
        cogent.display();
    }

    // Display legend (adjusted)
    fill(255); noStroke(); textSize(10);
    const legendYStart = 20; const legendSpacing = 12; // Reduced spacing
    text("Base Color = Personality Type (Savior Combo)", 10, legendYStart);
    text("  Orange: Consume/Play", 10, legendYStart + legendSpacing);
    text("  Red: Play/Blast", 10, legendYStart + legendSpacing * 2);
    text("  Green: Sleep/Consume", 10, legendYStart + legendSpacing * 3);
    text("  Blue: Blast/Sleep", 10, legendYStart + legendSpacing * 4);
    text("Inner Shape = Current Animal Behavior", 10, legendYStart + legendSpacing * 5);
    text("  Orange △: Consume", 10, legendYStart + legendSpacing * 6);
    text("  Blue □: Blast", 10, legendYStart + legendSpacing * 7);
    text("  Magenta ○: Play", 10, legendYStart + legendSpacing * 8);
    text("  Grey ◊: Sleep", 10, legendYStart + legendSpacing * 9);
}