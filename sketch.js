// --- Global Variables & Settings ---
let agents = [];
let numAgents = 15;
let informationPips = [];
let numPips = 60;

const NOVEL_PIP_COLOR_HSB = [50, 80, 90];
const KNOWN_PIP_COLOR_HSB = [220, 30, 85];

// Base Hues for slight color variation within shapes if needed,
// or if we want to color based on demon state more strongly.
const IP_BASE_HUE = 0;     // Red-ish
const EJ_BASE_HUE = 120;   // Green-ish
const IJ_BASE_HUE = 240;   // Blue-ish
const EP_BASE_HUE = 45;    // Orange-Yellow (distinct from pure yellow Novel Pip)

const DEMON_STATE_BRIGHTNESS_FACTOR = 0.5;
const DEMON_STATE_SATURATION_FACTOR = 0.7;

let perceptionRadius = 75;

function setup() {
    createCanvas(800, 600);
    colorMode(HSB, 360, 100, 100, 1);

    const needs = ['Di', 'De', 'Oi', 'Oe'];
    for (let i = 0; i < numAgents; i++) {
        let dominantNeed = random(needs);
        agents.push(new OpsAgent(random(width), random(height), dominantNeed));
    }

    for (let i = 0; i < numPips; i++) {
        informationPips.push(new InformationPip(random(width), random(height)));
    }
}

function draw() {
    background(220, 15, 20); 

    informationPips = informationPips.filter(pip => !pip.consumed);
    while (informationPips.length < numPips) {
        informationPips.push(new InformationPip(random(width), random(height)));
    }
    for (let pip of informationPips) {
        pip.display();
    }

    for (let agent of agents) {
        agent.run(agents, informationPips);
    }
    for (let agent of agents) {
        agent.display();
    }

    push();
    colorMode(RGB);
    fill(255);
    noStroke();
    textSize(12);
    textAlign(LEFT, TOP);
    let demonCount = agents.filter(a => a.isInDemonState).length;
    text(`Agents: ${numAgents} | Pips: ${informationPips.length} | In Demon State: ${demonCount}`, 10, 10);
    let avgInternalOrder = agents.reduce((sum, agent) => sum + agent.internalOrder, 0) / agents.length;
    text(`Avg Internal Order: ${avgInternalOrder.toFixed(2)}`, 10, 30);
    let avgActionPotential = agents.reduce((sum, agent) => sum + agent.actionPotential, 0) / agents.length;
    text(`Avg Action Potential: ${avgActionPotential.toFixed(2)}`, 10, 50);
    pop();
}

// --- InformationPip Class --- (Same as before)
class InformationPip {
    constructor(x, y) {
        this.position = createVector(x, y);
        this.type = random(1) < 0.35 ? 'Novel' : 'Known';
        this.value = this.type === 'Novel' ? random(20, 35) : random(5, 12);
        this.size = this.type === 'Novel' ? 9 : 6;
        this.hsbColor = this.type === 'Novel' ? NOVEL_PIP_COLOR_HSB : KNOWN_PIP_COLOR_HSB;
        this.consumed = false;
    }

    display() {
        if (!this.consumed) {
            noStroke();
            fill(this.hsbColor[0], this.hsbColor[1], this.hsbColor[2], 0.85);
            ellipse(this.position.x, this.position.y, this.size * 2);
        }
    }
}

// --- OpsAgent Class ---
class OpsAgent {
    constructor(x, y, dominantHumanNeed) {
        this.position = createVector(x, y);
        this.velocity = p5.Vector.random2D().mult(0.1);
        this.acceleration = createVector(0, 0);
        this.maxSpeed = 1.2;
        this.maxForce = 0.08;
        this.agentDrawSize = 18; // Renamed from 'size' to be specific for drawing
        this.size = this.agentDrawSize; // For separation & other calcs if needed
        this.wanderTheta = random(TWO_PI);

        this.dominantHumanNeed = dominantHumanNeed;
        this.opsTemperament = this.getTemperamentFromNeed(dominantHumanNeed);
        this.demonNeed = this.getDemonNeed(this.dominantHumanNeed);

        this.internalOrder = random(0.4, 0.8);
        this.perceivedExternalOrder_local = random(0.4, 0.8);
        this.actionPotential = random(0.6, 1.0);
        this.socialPressure = 0;

        this.forces = { internalOrder: createVector(), externalInfoSelf: createVector(), influenceExternalOrder: createVector(), tribeInteraction: createVector()};
        this.driveActivationLevels = { internalOrder: 0, externalInfoSelf: 0, influenceExternalOrder: 0, tribeInteraction: 0 };

        this.imbalanceCounters = { Di: 0, De: 0, Oi: 0, Oe: 0 };
        this.imbalanceThreshold = 150;
        this.isInDemonState = false;
        this.demonStateTimer = 0;
        this.demonStateDuration = round(random(250, 400));

        this.baseHue = this.getBaseHue(); // Will use this for color variations
        this.currentSat = 70;
        this.currentBrt = 70;
        this.currentAlpha = 0.9;

        this.debugLastStrongestDrive = "None";
    }

    getTemperamentFromNeed(need) { return need === 'Di' ? 'IP' : need === 'De' ? 'EJ' : need === 'Oi' ? 'IJ' : 'EP'; }
    getDemonNeed(dominantNeed) { return dominantNeed === 'Di' ? 'De' : dominantNeed === 'De' ? 'Di' : dominantNeed === 'Oi' ? 'Oe' : 'Oi'; }

    getBaseHue() {
        if (this.opsTemperament === 'IP') return IP_BASE_HUE;
        if (this.opsTemperament === 'EJ') return EJ_BASE_HUE;
        if (this.opsTemperament === 'IJ') return IJ_BASE_HUE;
        if (this.opsTemperament === 'EP') return EP_BASE_HUE;
        return 0;
    }

    applyForce(force) { this.acceleration.add(force); }

    run(allAgents, pips) {
        this.calculateDriveForces(allAgents, pips);
        this.applyTemperamentAndStateBiases();
        this.manageImbalanceAndDemonStates();
        this.updateMovement();
        this.updatePrimitives(allAgents, pips); // Passed pips for consume effect
        this.updateVisuals();
    }

    calculateDriveForces(allAgents, pips) {
        this.forces = { internalOrder: createVector(0,0), externalInfoSelf: createVector(0,0), influenceExternalOrder: createVector(0,0), tribeInteraction: createVector(0,0) };
        this.driveActivationLevels = { internalOrder: 0, externalInfoSelf: 0, influenceExternalOrder: 0, tribeInteraction: 0 };

        if (this.internalOrder < 0.45 || this.actionPotential < 0.25) {
            this.driveActivationLevels.internalOrder = map(this.internalOrder, 0.45, 0, 0.2, 1.0, true);
            this.forces.internalOrder = p5.Vector.mult(this.velocity, -0.15); // Stronger dampening
        }

        if (this.internalOrder > 0.75 || (this.opsTemperament === 'EP' && this.perceivedExternalOrder_local > 0.7)) {
            this.driveActivationLevels.externalInfoSelf = map(this.internalOrder, 0.75, 1.0, 0.3, 0.8, true) + (this.opsTemperament === 'EP' ? 0.2 : 0);
            let targetPip = this.findClosestPip(pips, 'Novel', perceptionRadius * 1.8);
            if (targetPip) {
                this.forces.externalInfoSelf = this.steer(targetPip.position);
            } else {
                this.forces.externalInfoSelf = this.getWanderForce().mult(0.6);
            }
        }

        if (this.internalOrder > 0.65 && (this.perceivedExternalOrder_local < 0.4 || (this.opsTemperament === 'EJ' && this.socialPressure < -0.15))) {
            this.driveActivationLevels.influenceExternalOrder = map(this.internalOrder, 0.65, 1.0, 0.3, 0.7, true);
            this.forces.influenceExternalOrder = p5.Vector.mult(this.velocity, -0.08);
        }

        if (this.actionPotential > 0.55 && (this.internalOrder > 0.6 || (this.opsTemperament === 'EJ' && this.socialPressure < 0.35))) {
            this.driveActivationLevels.tribeInteraction = map(this.actionPotential, 0.55, 1.0, 0.3, 0.75, true);
            let targetAgent = this.findClosestAgent(allAgents, perceptionRadius * 2.5);
            if (targetAgent) {
                this.forces.tribeInteraction = this.steer(targetAgent.position, true);
            } else {
                this.forces.tribeInteraction = this.getWanderForce().mult(0.8);
            }
        }
    }

    applyTemperamentAndStateBiases() { /* ... Same as before ... */
        if (this.opsTemperament === 'IP') {
            this.driveActivationLevels.internalOrder *= 1.5; this.driveActivationLevels.externalInfoSelf *= 1.3;
            this.driveActivationLevels.influenceExternalOrder *= 0.4; this.driveActivationLevels.tribeInteraction *= 0.4;
        } else if (this.opsTemperament === 'EJ') {
            this.driveActivationLevels.influenceExternalOrder *= 1.4; this.driveActivationLevels.tribeInteraction *= 1.5;
            this.driveActivationLevels.internalOrder *= (0.6 + this.socialPressure * 0.4);
            this.driveActivationLevels.externalInfoSelf *= 0.5;
        } else if (this.opsTemperament === 'IJ') {
            this.driveActivationLevels.internalOrder *= 1.6; this.driveActivationLevels.influenceExternalOrder *= 1.5;
            this.driveActivationLevels.externalInfoSelf *= 0.5; this.driveActivationLevels.tribeInteraction *= 0.3;
        } else if (this.opsTemperament === 'EP') {
            this.driveActivationLevels.externalInfoSelf *= 1.5; this.driveActivationLevels.tribeInteraction *= 1.4;
            this.driveActivationLevels.internalOrder *= 0.5; this.driveActivationLevels.influenceExternalOrder *= 0.4;
        }

        if (this.isInDemonState) {
            if (this.demonNeed === 'Di') this.driveActivationLevels.internalOrder *= 1.5;
            else if (this.demonNeed === 'Oe') this.driveActivationLevels.externalInfoSelf *= 1.5;
            else if (this.demonNeed === 'Oi') this.driveActivationLevels.influenceExternalOrder *= 1.5;
            else if (this.demonNeed === 'De') this.driveActivationLevels.tribeInteraction *= 1.5;
        }

        this.acceleration.mult(0);
        let totalActivation = 0;
        for (let drive in this.driveActivationLevels) totalActivation += this.driveActivationLevels[drive];

        if (totalActivation > 0) {
            this.debugLastStrongestDrive = "None";
            let maxAct = 0;
            for (let drive in this.forces) {
                let weight = this.driveActivationLevels[drive] / totalActivation;
                this.applyForce(p5.Vector.mult(this.forces[drive], weight));
                if(this.driveActivationLevels[drive] > maxAct){maxAct = this.driveActivationLevels[drive]; this.debugLastStrongestDrive = drive;}
            }
        } else {
            this.applyForce(this.getWanderForce().mult(0.2));
            this.debugLastStrongestDrive = "Wandering";
        }
         this.applyForce(this.separate(agents).mult(1.8)); // Stronger separation
    }

    manageImbalanceAndDemonStates() { /* ... Same as before ... */
        let dominantNeedFulfilled = false;
        if ((this.dominantHumanNeed === 'Di' || this.dominantHumanNeed === 'Oi') && this.driveActivationLevels.internalOrder > 0.1) dominantNeedFulfilled = true;
        else if ((this.dominantHumanNeed === 'Di' || this.dominantHumanNeed === 'Oe') && this.driveActivationLevels.externalInfoSelf > 0.1) dominantNeedFulfilled = true;
        else if ((this.dominantHumanNeed === 'De' || this.dominantHumanNeed === 'Oi') && this.driveActivationLevels.influenceExternalOrder > 0.1) dominantNeedFulfilled = true;
        else if ((this.dominantHumanNeed === 'De' || this.dominantHumanNeed === 'Oe') && this.driveActivationLevels.tribeInteraction > 0.1) dominantNeedFulfilled = true;


        if (!this.isInDemonState) {
            if (dominantNeedFulfilled) { // If primarily acting on savior needs
                this.imbalanceCounters[this.demonNeed] += 0.25; // Faster imbalance buildup
            }
            for (let need in this.imbalanceCounters) {
                 this.imbalanceCounters[need] = max(0, this.imbalanceCounters[need] - 0.005); // Slower decay
            }

            if (this.imbalanceCounters[this.demonNeed] > this.imbalanceThreshold) {
                this.isInDemonState = true;
                this.demonStateTimer = this.demonStateDuration;
                this.imbalanceCounters[this.demonNeed] = this.imbalanceThreshold * 0.2; // Don't fully reset, allow quicker re-trigger if not addressed
                // console.log(`${this.opsTemperament} (${this.dominantHumanNeed}) triggered DEMON ${this.demonNeed}`);
            }
        } else {
            this.demonStateTimer--;
            this.actionPotential = max(0, this.actionPotential - 0.0025);
            if (this.demonStateTimer <= 0 || this.actionPotential <= 0.1) {
                this.isInDemonState = false;
                this.actionPotential = max(this.actionPotential, 0.3);
                // console.log(`${this.opsTemperament} exited DEMON state`);
            }
        }
    }

    updateMovement() { /* ... Same as before (with speedLimit adjustment) ... */
        this.velocity.add(this.acceleration);
        let speedLimit = this.maxSpeed * (this.isInDemonState ? 0.75 : 1.0); // Demon state slightly less reduction
        if(this.driveActivationLevels.tribeInteraction > 0.6 && !this.isInDemonState && this.opsTemperament === 'EP') speedLimit *=1.4; // EP Play faster
        else if(this.driveActivationLevels.externalInfoSelf > 0.6 && !this.isInDemonState && this.opsTemperament === 'EP') speedLimit *=1.3; // EP Consume faster

        this.velocity.limit(speedLimit);
        this.position.add(this.velocity);
        this.acceleration.mult(0);
        this.edges();
    }

    updatePrimitives(allAgents, pips) { /* ... Mostly same, ensure effects of demon state are clear ... */
        let consumedThisFrame = false;

        // Internal Order Drive (Sleep-like behavior)
        if (this.driveActivationLevels.internalOrder > 0.1) {
            let efficiency = this.isInDemonState && this.dominantHumanNeed !== this.demonNeed ? 0.3 : 1; // Less efficient if demon of other axis
            this.internalOrder = min(1, this.internalOrder + 0.0025 * this.driveActivationLevels.internalOrder * efficiency);
            this.actionPotential = min(1, this.actionPotential + 0.0015 * this.driveActivationLevels.internalOrder * efficiency);
            this.velocity.mult(0.97);
        }

        // Consume Drive (External Info Self)
        if (this.driveActivationLevels.externalInfoSelf > 0.1) {
            let efficiency = this.isInDemonState && this.dominantHumanNeed !== this.demonNeed ? 0.2 : 1;
            for (let i = pips.length - 1; i >= 0; i--) {
                let pip = pips[i];
                if (!pip.consumed && p5.Vector.dist(this.position, pip.position) < this.agentDrawSize / 2 + pip.size / 2) {
                    this.internalOrder = max(0, this.internalOrder - pip.value * (pip.type === 'Novel' ? 0.002 : 0.0008) * efficiency);
                    this.perceivedExternalOrder_local = min(1, this.perceivedExternalOrder_local + pip.value * 0.0015 * efficiency);
                    this.actionPotential = min(1, this.actionPotential + (pip.type === 'Novel' ? 0.035 : 0.015) * efficiency);
                    pip.consumed = true;
                    consumedThisFrame = true;
                    break;
                }
            }
            if (!consumedThisFrame) this.actionPotential = max(0, this.actionPotential - 0.0006);
        }

        // Blast Drive (Influence External Order)
        if (this.driveActivationLevels.influenceExternalOrder > 0.1) {
            let orderEffect = 0.0025 * this.driveActivationLevels.influenceExternalOrder;
            if (this.isInDemonState) orderEffect *= (this.dominantHumanNeed === this.demonNeed ? 0.1 : -0.7); // Demon blast is weak or confusing

            for (let other of allAgents) {
                if (other !== this && p5.Vector.dist(this.position, other.position) < perceptionRadius * 0.9) {
                    other.perceivedExternalOrder_local = constrain(other.perceivedExternalOrder_local + orderEffect, 0, 1);
                }
            }
            this.actionPotential = max(0, this.actionPotential - 0.0012);
            if(this.opsTemperament === 'EJ' && !this.isInDemonState && orderEffect > 0) this.socialPressure = min(1, this.socialPressure + 0.0006 * this.driveActivationLevels.influenceExternalOrder);
        }

        // Play Drive (Tribe Interaction)
        if (this.driveActivationLevels.tribeInteraction > 0.1) {
            let chaosEffect = -0.002 * this.driveActivationLevels.tribeInteraction; // Play introduces novelty/chaos
            if (this.isInDemonState) chaosEffect *= (this.dominantHumanNeed === this.demonNeed ? 0.2 : 1.8); // Demon play is weak or extra chaotic

             for (let other of allAgents) {
                if (other !== this && p5.Vector.dist(this.position, other.position) < perceptionRadius * 0.85) {
                    other.perceivedExternalOrder_local = constrain(other.perceivedExternalOrder_local + chaosEffect, 0, 1);
                }
            }
            this.actionPotential = max(0, this.actionPotential - 0.0018);
             if(this.opsTemperament === 'EJ' && !this.isInDemonState && chaosEffect < 0) this.socialPressure = min(1, this.socialPressure + 0.001 * this.driveActivationLevels.tribeInteraction);
        }

        this.actionPotential = max(0, this.actionPotential - 0.00025); // Slightly higher baseline decay
        this.socialPressure *= 0.992; // Faster decay towards neutral
        this.internalOrder = constrain(this.internalOrder, 0, 1);
        this.perceivedExternalOrder_local = constrain(this.perceivedExternalOrder_local, 0, 1);
    }


    updateVisuals() {
        let hue = this.baseHue;
        let sat = 70;
        let brt = 70;

        if (this.opsTemperament === 'IP') { hue = (IP_BASE_HUE); sat = max(40, sat - 20); }
        else if (this.opsTemperament === 'EJ') { hue = (EJ_BASE_HUE); brt = min(90, brt + 15); }
        else if (this.opsTemperament === 'IJ') { hue = (IJ_BASE_HUE); brt = max(55, brt - 15); }
        else if (this.opsTemperament === 'EP') { hue = (EP_BASE_HUE); sat = min(95, sat + 20); }

        brt = map(this.actionPotential, 0, 1, brt * 0.5, brt * 1.15, true);
        sat = map(this.internalOrder, 0, 1, sat * 0.6, sat * 1.1, true);

        if (this.isInDemonState) {
            brt *= DEMON_STATE_BRIGHTNESS_FACTOR;
            sat *= DEMON_STATE_SATURATION_FACTOR;
            // Invert hue or make it grey for demon state
            // hue = (hue + 180) % 360; // Invert
            sat = max(10, sat - 30); // Strongly desaturate
        }

        this.currentHue = hue; // Store hue for shape drawing
        this.currentSat = constrain(sat, 10, 100);
        this.currentBrt = constrain(brt, 15, 100);
        this.currentAlpha = this.isInDemonState ? 0.75 : 0.95;
    }

    // --- Utility & Steering Behaviors --- (Mostly same as before)
    steer(targetPos, maintainDistance = false, arrivalRadius = 50, separationRadius = 20) {
        let desired = p5.Vector.sub(targetPos, this.position);
        let d = desired.mag();
        let speed = this.maxSpeed;

        if (maintainDistance && d < arrivalRadius) { // If for play, try to orbit or keep some distance
            // Create a force perpendicular to the line to the target to encourage orbiting
            let perpendicular = createVector(-desired.y, desired.x);
            perpendicular.normalize();
            perpendicular.mult(this.maxSpeed * 0.7);
            desired = perpendicular; // New desired velocity is to orbit
            if (d < separationRadius) { // If too close, actively move away
                 let away = p5.Vector.sub(this.position, targetPos);
                 desired.add(away.normalize().mult(this.maxSpeed));
            }

        } else if (!maintainDistance && d < 5) { // Arrival for non-playful seek
             desired.setMag(0);
        } else {
            desired.setMag(speed);
        }

        let steerForce = p5.Vector.sub(desired, this.velocity);
        steerForce.limit(this.maxForce);
        return steerForce;
    }

    getWanderForce() {
        this.wanderTheta += random(-0.3, 0.3); // More directional wander
        let wanderDir = p5.Vector.fromAngle(this.wanderTheta);
        return wanderDir.mult(this.maxForce * 0.4); // Slightly stronger wander
    }

    separate(agents) { /* ... Same ... */
        let desiredSeparation = this.agentDrawSize * 2.0; // Slightly less aggressive separation
        let steer = createVector(0, 0);
        let count = 0;
        for (let other of agents) {
            let d = p5.Vector.dist(this.position, other.position);
            if ((d > 0) && (d < desiredSeparation)) {
                let diff = p5.Vector.sub(this.position, other.position);
                diff.normalize();
                diff.div(d);
                steer.add(diff);
                count++;
            }
        }
        if (count > 0) {
            steer.div(count);
        }
        if (steer.mag() > 0) {
            steer.normalize();
            steer.mult(this.maxSpeed);
            steer.sub(this.velocity);
            steer.limit(this.maxForce * 1.5); // Keep separation force strong
        }
        return steer;
    }


    findClosestPip(pips, type = 'Novel', searchRadius = perceptionRadius * 1.5) { /* ... Same ... */
        let closest = null;
        let record = searchRadius + 1;
        for (let pip of pips) {
            if (!pip.consumed && pip.type === type) {
                let d = p5.Vector.dist(this.position, pip.position);
                if (d < record) {
                    record = d;
                    closest = pip;
                }
            }
        }
         if(record > searchRadius) return null; // if closest is outside radius, return null
        return closest;
    }

    findClosestAgent(agents, searchRadius = perceptionRadius * 2) { /* ... Same ... */
        let closest = null;
        let record = searchRadius + 1;
        for (let other of agents) {
            if (other !== this) {
                let d = p5.Vector.dist(this.position, other.position);
                if (d < record ) {
                    record = d;
                    closest = other;
                }
            }
        }
        if(record > searchRadius) return null;
        return closest;
    }


    edges() { /* ... Same ... */
        if (this.position.x > width + this.agentDrawSize) this.position.x = -this.agentDrawSize;
        if (this.position.x < -this.agentDrawSize) this.position.x = width + this.agentDrawSize;
        if (this.position.y > height + this.agentDrawSize) this.position.y = -this.agentDrawSize;
        if (this.position.y < -this.agentDrawSize) this.position.y = height + this.agentDrawSize;
    }

    display() {
        push();
        translate(this.position.x, this.position.y);
        rotate(this.velocity.heading() + PI / 2); // Orient shape with velocity

        noStroke();
        fill(this.currentHue, this.currentSat, this.currentBrt, this.currentAlpha);

        let s = this.agentDrawSize; // Use agentDrawSize for drawing

        if (this.opsTemperament === 'IP') { // Triangle
            triangle(0, -s, -s * 0.866, s * 0.5, s * 0.866, s * 0.5);
        } else if (this.opsTemperament === 'EJ') { // Square
            rectMode(CENTER);
            rect(0, 0, s * 1.5, s * 1.5);
        } else if (this.opsTemperament === 'IJ') { // Circle
            ellipse(0, 0, s * 1.75);
        } else if (this.opsTemperament === 'EP') { // Star
            beginShape();
            for (let i = 0; i < 5; i++) {
                let angle = TWO_PI / 5 * i - PI / 2;
                let x = cos(angle) * s;
                let y = sin(angle) * s;
                vertex(x, y);
                angle += TWO_PI / 10;
                x = cos(angle) * (s * 0.5);
                y = sin(angle) * (s * 0.5);
                vertex(x, y);
            }
            endShape(CLOSE);
        }
        pop();

        // Info text (not rotated)
        push();
        colorMode(RGB);
        let textColor = color(230);
        if (this.currentBrt < 35 && this.currentSat < 40) textColor = color(250); // Brighter text for very dark agents
        else if (this.currentBrt > 80 && this.currentSat > 80) textColor = color(20); // Darker text for very bright agents

        if (this.isInDemonState) textColor = color(255, 80, 80);


        fill(textColor);
        textSize(9);
        textAlign(CENTER, TOP);
        let needStr = `${this.dominantHumanNeed}`;
        if (this.isInDemonState) needStr = `D:${this.demonNeed}`;
        text(`${this.opsTemperament} ${needStr}\nAP:${this.actionPotential.toFixed(1)} IO:${this.internalOrder.toFixed(1)} SP:${this.socialPressure.toFixed(1)}`, this.position.x, this.position.y + this.agentDrawSize + 2);
        // text(`Drive: ${this.debugLastStrongestDrive}`, this.position.x, this.position.y + this.agentDrawSize + 22);

        pop();
    }
}