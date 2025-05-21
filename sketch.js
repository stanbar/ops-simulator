// --- Global Variables & Settings ---
let agents = [];
let numAgents = 15; // More agents for richer interactions
let informationPips = [];
let numPips = 60;

const NOVEL_PIP_COLOR_HSB = [50, 80, 90];   // Bright Yellow
const KNOWN_PIP_COLOR_HSB = [220, 30, 85];  // Desaturated Light Blue/Grey

const IP_HUE_SHIFT = 0;     // Base Red-ish
const EJ_HUE_SHIFT = 120;   // Base Green-ish
const IJ_HUE_SHIFT = 240;   // Base Blue-ish
const EP_HUE_SHIFT = 60;    // Base Yellow-ish (distinct from Novel Pip)

const DEMON_STATE_BRIGHTNESS_FACTOR = 0.5;
const DEMON_STATE_SATURATION_FACTOR = 0.7;

// For smoother steering
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
    background(220, 15, 20); // Darker, more desaturated blue

    // Manage pips
    informationPips = informationPips.filter(pip => !pip.consumed);
    while (informationPips.length < numPips) {
        informationPips.push(new InformationPip(random(width), random(height)));
    }
    for (let pip of informationPips) {
        pip.display();
    }

    // Update and display agents
    for (let agent of agents) {
        agent.run(agents, informationPips); // Main agent logic loop
    }
     for (let agent of agents) { // Separate loop for display to draw all agents on top of all pips
        agent.display();
    }


    // Display general info
    push(); // Isolate text styling
    colorMode(RGB); // Switch to RGB for text for consistency
    fill(255);
    noStroke();
    textSize(12);
    textAlign(LEFT, TOP);
    let demonCount = agents.filter(a => a.isInDemonState).length;
    text(`Agents: ${numAgents} | Pips: ${informationPips.length} | In Demon State: ${demonCount}`, 10, 10);
    // Display average internal order
    let avgInternalOrder = agents.reduce((sum, agent) => sum + agent.internalOrder, 0) / agents.length;
    text(`Avg Internal Order: ${avgInternalOrder.toFixed(2)}`, 10, 30);
    let avgActionPotential = agents.reduce((sum, agent) => sum + agent.actionPotential, 0) / agents.length;
    text(`Avg Action Potential: ${avgActionPotential.toFixed(2)}`, 10, 50);
    pop();
}

// --- InformationPip Class ---
class InformationPip {
    constructor(x, y) {
        this.position = createVector(x, y);
        this.type = random(1) < 0.35 ? 'Novel' : 'Known'; // Slightly fewer novel
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
        this.velocity = p5.Vector.random2D().mult(0.1); // Start with a little motion
        this.acceleration = createVector(0, 0);
        this.maxSpeed = 1.2;
        this.maxForce = 0.08;
        this.size = 16;
        this.wanderTheta = random(TWO_PI);


        this.dominantHumanNeed = dominantHumanNeed;
        this.opsTemperament = this.getTemperamentFromNeed(dominantHumanNeed);
        this.demonNeed = this.getDemonNeed(this.dominantHumanNeed);

        this.internalOrder = random(0.4, 0.8);
        this.perceivedExternalOrder_local = random(0.4, 0.8);
        this.actionPotential = random(0.6, 1.0);
        this.socialPressure = 0;

        this.imbalanceCounters = { Di: 0, De: 0, Oi: 0, Oe: 0 };
        this.imbalanceThreshold = 150; // Increased threshold
        this.isInDemonState = false;
        this.demonStateTimer = 0;
        this.demonStateDuration = round(random(250, 400));

        this.baseHue = this.getBaseHue();
        this.currentSat = 70;
        this.currentBrt = 70;
        this.currentAlpha = 0.9;

        this.debugLastStrongestDrive = "None";
    }

    getTemperamentFromNeed(need) { /* ... same ... */ return need === 'Di' ? 'IP' : need === 'De' ? 'EJ' : need === 'Oi' ? 'IJ' : 'EP';}
    getDemonNeed(dominantNeed) { /* ... same ... */ return dominantNeed === 'Di' ? 'De' : dominantNeed === 'De' ? 'Di' : dominantNeed === 'Oi' ? 'Oe' : 'Oi';}
    getBaseHue() { /* ... same ... */ return this.dominantHumanNeed === 'Di' ? IP_HUE_SHIFT : this.dominantHumanNeed === 'De' ? EJ_HUE_SHIFT : this.dominantHumanNeed === 'Oi' ? IJ_HUE_SHIFT : EP_HUE_SHIFT; }
    
  getShapeForTemperament() {
        if (this.opsTemperament === 'IP') return 'ellipse';
        if (this.opsTemperament === 'EJ') return 'rect'; // Square/Rectangle
        if (this.opsTemperament === 'IJ') return 'triangle';
        if (this.opsTemperament === 'EP') return 'star'; // Or another distinct polygon
        return 'ellipse';
    }
    applyForce(force) {
        this.acceleration.add(force);
    }

    // MAIN AGENT LOGIC LOOP
    run(allAgents, pips) {
        this.calculateDriveForces(allAgents, pips); // Calculate all potential drive forces
        this.applyTemperamentAndStateBiases();    // Bias these forces
        this.manageImbalanceAndDemonStates();     // Check/update demon state
        this.updateMovement();                    // Apply forces, move
        this.updatePrimitives();                  // Update internal states based on actions/time
        this.updateVisuals();
    }

    calculateDriveForces(allAgents, pips) {
        this.forces = {
            internalOrder: createVector(0,0),      // Sleep-like
            externalInfoSelf: createVector(0,0),   // Consume-like
            influenceExternalOrder: createVector(0,0),// Blast-like
            tribeInteraction: createVector(0,0)    // Play-like
        };
        this.driveActivationLevels = { // How much each drive *wants* to be active
            internalOrder: 0, externalInfoSelf: 0, influenceExternalOrder: 0, tribeInteraction: 0
        };


        // 1. Drive for Internal Order (Sleep-like)
        if (this.internalOrder < 0.45 || this.actionPotential < 0.25) {
            this.driveActivationLevels.internalOrder = map(this.internalOrder, 0.45, 0, 0.2, 1.0, true);
            // Force is to slow down / become still
            this.forces.internalOrder = p5.Vector.mult(this.velocity, -0.1); // Dampening force
        }

        // 2. Drive for External Info for Self (Consume-like)
        if (this.internalOrder > 0.75 || (this.opsTemperament === 'EP' && this.perceivedExternalOrder_local > 0.7)) {
            this.driveActivationLevels.externalInfoSelf = 0.7; // Strong base activation
            let targetPip = this.findClosestPip(pips, 'Novel', perceptionRadius * 1.5);
            if (targetPip) {
                this.forces.externalInfoSelf = this.steer(targetPip.position);
            } else { // If no novel pip, explore more broadly
                this.forces.externalInfoSelf = this.getWanderForce().mult(0.5);
            }
        }

        // 3. Drive to Influence External Order (Blast-like)
        if (this.internalOrder > 0.65 && (this.perceivedExternalOrder_local < 0.4 || (this.opsTemperament === 'EJ' && this.socialPressure < -0.1))) {
            this.driveActivationLevels.influenceExternalOrder = 0.6;
             // Force is to slow down and "emit"
            this.forces.influenceExternalOrder = p5.Vector.mult(this.velocity, -0.05);
            // Actual emission effect handled in updatePrimitives or separate interaction phase
        }

        // 4. Drive for Tribe Interaction (Play-like)
        if (this.actionPotential > 0.55 && (this.internalOrder > 0.6 || (this.opsTemperament === 'EJ' && this.socialPressure < 0.3))) {
            this.driveActivationLevels.tribeInteraction = 0.65;
            let targetAgent = this.findClosestAgent(allAgents, perceptionRadius * 2);
            if (targetAgent) {
                this.forces.tribeInteraction = this.steer(targetAgent.position, true); // Playful approach
            } else {
                this.forces.tribeInteraction = this.getWanderForce().mult(0.7);
            }
        }
    }

    applyTemperamentAndStateBiases() {
        // Apply temperament biases to driveActivationLevels
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

        // If in Demon State, amplify the demon need's drive but make the force less effective or chaotic
        if (this.isInDemonState) {
            if (this.demonNeed === 'Di') this.driveActivationLevels.internalOrder *= 1.5;
            if (this.demonNeed === 'Oe') this.driveActivationLevels.externalInfoSelf *= 1.5;
            if (this.demonNeed === 'Oi') this.driveActivationLevels.influenceExternalOrder *= 1.5; // Demon Oi might try to over-control
            if (this.demonNeed === 'De') this.driveActivationLevels.tribeInteraction *= 1.5;
        }

        // Combine forces based on activation levels (simple weighted sum for now)
        this.acceleration.mult(0); // Reset from previous frame
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
             // If no strong drive, apply a generic wander/separation
            this.applyForce(this.getWanderForce().mult(0.2));
            this.debugLastStrongestDrive = "Wandering";
        }
         this.applyForce(this.separate(agents).mult(1.5)); // General separation
    }

    manageImbalanceAndDemonStates() {
        // Update imbalance counters
        let dominantNeedFulfilled = false;
        if ((this.dominantHumanNeed === 'Di' || this.dominantHumanNeed === 'Oi') && this.driveActivationLevels.internalOrder > 0.1) dominantNeedFulfilled = true;
        if ((this.dominantHumanNeed === 'Di' || this.dominantHumanNeed === 'Oe') && this.driveActivationLevels.externalInfoSelf > 0.1) dominantNeedFulfilled = true;
        if ((this.dominantHumanNeed === 'De' || this.dominantHumanNeed === 'Oi') && this.driveActivationLevels.influenceExternalOrder > 0.1) dominantNeedFulfilled = true;
        if ((this.dominantHumanNeed === 'De' || this.dominantHumanNeed === 'Oe') && this.driveActivationLevels.tribeInteraction > 0.1) dominantNeedFulfilled = true;

        if (!this.isInDemonState) {
            if (dominantNeedFulfilled) {
                this.imbalanceCounters[this.demonNeed] += 0.15; // More pressure if saviors active
            }
            for (let need in this.imbalanceCounters) { // All imbalances decay slowly
                 this.imbalanceCounters[need] = max(0, this.imbalanceCounters[need] - 0.01);
            }

            if (this.imbalanceCounters[this.demonNeed] > this.imbalanceThreshold) {
                this.isInDemonState = true;
                this.demonStateTimer = this.demonStateDuration;
                this.imbalanceCounters[this.demonNeed] = 0;
                console.log(`${this.opsTemperament} (${this.dominantHumanNeed}) triggered DEMON ${this.demonNeed}`);
            }
        } else { // In Demon State
            this.demonStateTimer--;
            this.actionPotential = max(0, this.actionPotential - 0.002); // Demon state is tiring
            if (this.demonStateTimer <= 0 || this.actionPotential <= 0.05) {
                this.isInDemonState = false;
                this.actionPotential = max(this.actionPotential, 0.2); // Some recovery
                console.log(`${this.opsTemperament} exited DEMON state`);
            }
        }
    }

    updateMovement() {
        this.velocity.add(this.acceleration);
        let speedLimit = this.maxSpeed * (this.isInDemonState ? 0.8 : 1.0);
        if(this.driveActivationLevels.tribeInteraction > 0.5 && !this.isInDemonState) speedLimit *=1.3; // Playful agents faster
        this.velocity.limit(speedLimit);
        this.position.add(this.velocity);
        this.acceleration.mult(0); // Reset acceleration
        this.edges();
    }

    updatePrimitives() { // Effects of actions on internal states
        let consumedThisFrame = false;

        // Internal Order Drive Effect
        if (this.driveActivationLevels.internalOrder > 0.1) {
            this.internalOrder = min(1, this.internalOrder + 0.002 * this.driveActivationLevels.internalOrder);
            this.actionPotential = min(1, this.actionPotential + 0.001 * this.driveActivationLevels.internalOrder);
            this.velocity.mult(0.98); // Naturally slows if focusing inward
        }

        // Consume Drive Effect (Interaction with Pips)
        if (this.driveActivationLevels.externalInfoSelf > 0.1) {
            for (let i = informationPips.length - 1; i >= 0; i--) {
                let pip = informationPips[i];
                if (!pip.consumed && p5.Vector.dist(this.position, pip.position) < this.size / 2 + pip.size / 2) {
                    this.internalOrder = max(0, this.internalOrder - pip.value * (pip.type === 'Novel' ? 0.0015 : 0.0005)); // Novelty temporarily reduces order
                    this.perceivedExternalOrder_local = min(1, this.perceivedExternalOrder_local + pip.value * 0.001); // Gained knowledge
                    this.actionPotential = min(1, this.actionPotential + (pip.type === 'Novel' ? 0.03 : 0.01)); // More energy from novel
                    pip.consumed = true;
                    consumedThisFrame = true;
                    break; // Consume one pip per frame for simplicity
                }
            }
            if (!consumedThisFrame) this.actionPotential = max(0, this.actionPotential - 0.0005); // Cost of searching
        }


        // Blast Drive Effect
        if (this.driveActivationLevels.influenceExternalOrder > 0.1) {
            let effectStrength = 0.002 * this.driveActivationLevels.influenceExternalOrder;
            if (this.isInDemonState) effectStrength *= -0.5; // Demon blast is confusing
            for (let other of agents) {
                if (other !== this && p5.Vector.dist(this.position, other.position) < perceptionRadius) {
                    other.perceivedExternalOrder_local = constrain(other.perceivedExternalOrder_local + effectStrength, 0, 1);
                }
            }
            this.actionPotential = max(0, this.actionPotential - 0.001);
            if(this.opsTemperament === 'EJ' && !this.isInDemonState) this.socialPressure = min(1, this.socialPressure + 0.0005 * this.driveActivationLevels.influenceExternalOrder);

        }

        // Play Drive Effect
        if (this.driveActivationLevels.tribeInteraction > 0.1) {
            let effectStrength = -0.0015 * this.driveActivationLevels.tribeInteraction; // Play introduces novelty/chaos
            if (this.isInDemonState) effectStrength *= 2; // Demon play is more chaotic
             for (let other of agents) {
                if (other !== this && p5.Vector.dist(this.position, other.position) < perceptionRadius * 0.8) {
                    other.perceivedExternalOrder_local = constrain(other.perceivedExternalOrder_local + effectStrength, 0, 1);
                }
            }
            this.actionPotential = max(0, this.actionPotential - 0.0015);
            if(this.opsTemperament === 'EJ' && !this.isInDemonState) this.socialPressure = min(1, this.socialPressure + 0.0008 * this.driveActivationLevels.tribeInteraction);
        }

        // Generic action potential decay & social pressure normalization
        this.actionPotential = max(0, this.actionPotential - 0.0002); // Baseline decay
        this.socialPressure *= 0.995; // Decay towards neutral
        this.internalOrder = constrain(this.internalOrder, 0, 1);
        this.perceivedExternalOrder_local = constrain(this.perceivedExternalOrder_local, 0, 1); // Assume it's always local for now
    }


    updateVisuals() {
        let hue = this.baseHue;
        let sat = 75;
        let brt = 75;

        // Temperament Visual Overlays (subtle shifts from base hue)
        if (this.opsTemperament === 'IP' && !this.isInDemonState) sat = max(50, sat - 15); // Slightly more desaturated/introspective
        if (this.opsTemperament === 'EJ' && !this.isInDemonState) brt = min(90, brt + 10); // Slightly brighter/more expressive
        if (this.opsTemperament === 'IJ' && !this.isInDemonState) { hue = (hue + 5 + 360)%360; brt = max(60, brt -10); } // Shift hue slightly, slightly darker
        if (this.opsTemperament === 'EP' && !this.isInDemonState) { hue = (hue - 5 + 360)%360; sat = min(90, sat +10); } // Shift hue, slightly more saturated


        brt = map(this.actionPotential, 0, 1, brt * 0.6, brt * 1.1, true);
        sat = map(this.internalOrder, 0, 1, sat * 0.7, sat * 1.1, true); // More internal order = more saturated/defined

        if (this.isInDemonState) {
            brt *= DEMON_STATE_BRIGHTNESS_FACTOR;
            sat *= DEMON_STATE_SATURATION_FACTOR;
            // Could also add a visual effect like slight shaking or a border
            hue = (hue + 180) % 360; // Opposite hue for demon state for strong visual cue
        }

        this.currentSat = constrain(sat, 20, 100);
        this.currentBrt = constrain(brt, 20, 100);
        this.currentAlpha = this.isInDemonState ? 0.7 : 0.9;
        this.baseHue = hue; // Update baseHue if temperament shifted it for demon state inversion next time
    }


    // --- Utility & Steering Behaviors ---
    steer(target, arrive = false, arrivalRadius = 10) {
        let desired = p5.Vector.sub(target, this.position);
        let d = desired.mag();
        if (d > 0) {
            desired.normalize();
            if (arrive && d < arrivalRadius) {
                desired.mult(map(d, 0, arrivalRadius, 0, this.maxSpeed));
            } else {
                desired.mult(this.maxSpeed);
            }
            let steerForce = p5.Vector.sub(desired, this.velocity);
            steerForce.limit(this.maxForce);
            return steerForce;
        }
        return createVector(0,0);
    }

     getWanderForce() {
        // Slightly change wander direction over time
        this.wanderTheta += random(-0.2, 0.2);
        // Create a vector pointing in the direction of wanderTheta
        let wanderDir = p5.Vector.fromAngle(this.wanderTheta);
        // Scale it by some amount
        return wanderDir.mult(this.maxForce * 0.3);
    }


    separate(agents) {
        let desiredSeparation = this.size * 2.5;
        let steer = createVector(0, 0);
        let count = 0;
        for (let other of agents) {
            let d = p5.Vector.dist(this.position, other.position);
            if ((d > 0) && (d < desiredSeparation)) {
                let diff = p5.Vector.sub(this.position, other.position);
                diff.normalize();
                diff.div(d); // Weight by distance
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
            steer.limit(this.maxForce * 1.2); // Separation can be a bit stronger
        }
        return steer;
    }

    findClosestPip(pips, type = 'Novel', searchRadius = perceptionRadius) {
        let closest = null;
        let record = searchRadius + 1; // Start with a distance greater than searchRadius
        for (let pip of pips) {
            if (!pip.consumed && pip.type === type) {
                let d = p5.Vector.dist(this.position, pip.position);
                if (d < record) {
                    record = d;
                    closest = pip;
                }
            }
        }
        return closest;
    }

    findClosestAgent(agents, searchRadius = perceptionRadius) {
        let closest = null;
        let record = searchRadius + 1;
        for (let other of agents) {
            if (other !== this) {
                let d = p5.Vector.dist(this.position, other.position);
                if (d < record) {
                    record = d;
                    closest = other;
                }
            }
        }
        return closest;
    }


    edges() {
        if (this.position.x > width + this.size) this.position.x = -this.size;
        if (this.position.x < -this.size) this.position.x = width + this.size;
        if (this.position.y > height + this.size) this.position.y = -this.size;
        if (this.position.y < -this.size) this.position.y = height + this.size;
    }

    display() {
        noStroke();
        fill(this.baseHue, this.currentSat, this.currentBrt, this.currentAlpha);
        ellipse(this.position.x, this.position.y, this.size * 2);

        // Info text
        push();
        colorMode(RGB);
        let textColor = this.isInDemonState ? color(255,100,100) : color(230);
        if (this.currentBrt < 40) textColor = color(255); // Ensure text is visible on dark agents
        fill(textColor);

        textSize(8);
        textAlign(CENTER, TOP); // Align text better under the agent
        let needStr = `${this.dominantHumanNeed}`;
        if (this.isInDemonState) needStr = `D:${this.demonNeed}`;

        // For debugging active drive
        // let activeDriveDisplay = this.debugLastStrongestDrive.substring(0,2).toUpperCase();
        // text(`${this.opsTemperament} ${activeDriveDisplay}\n${needStr}\nAP:${this.actionPotential.toFixed(1)} IO:${this.internalOrder.toFixed(1)}`, this.position.x, this.position.y + this.size + 2);

        text(`${this.opsTemperament}\n${needStr}\nAP:${this.actionPotential.toFixed(1)} IO:${this.internalOrder.toFixed(1)}`, this.position.x, this.position.y + this.size + 2);


        // Social pressure indicator (optional, can be cluttered)
        // let pressureY = this.position.y - this.size - 5;
        // stroke(0,0,100);
        // line(this.position.x - 10, pressureY, this.position.x + 10, pressureY);
        // fill(this.socialPressure > 0 ? 'green' : 'red');
        // ellipse(this.position.x + this.socialPressure * 10, pressureY, 5, 5);
        pop();
    }
}