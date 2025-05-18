
// Function to determine savior functions (simplified for now)
function getSaviorFunctions(humanNeeds) {
    // This is a gross oversimplification. OPS has complex rules for this.
    // For a simulator, we might pre-define these for specific "types"
    // or create a more elaborate rule set.
    // Example:
    if (humanNeeds.selfTribe === 'Di' && humanNeeds.organizeGather === 'Oi') return [['Fi', 'Si'], ['Ti', 'Ni']][floor(random(2))]; // e.g., Fi/Si or Ti/Ni
    if (humanNeeds.selfTribe === 'Di' && humanNeeds.organizeGather === 'Oe') return [['Fi', 'Se'], ['Ti', 'Ne']][floor(random(2))]; // e.g., Fi/Se or Ti/Ne
    if (humanNeeds.selfTribe === 'De' && humanNeeds.organizeGather === 'Oi') return [['Fe', 'Si'], ['Te', 'Ni']][floor(random(2))]; // e.g., Fe/Si or Te/Ni
    if (humanNeeds.selfTribe === 'De' && humanNeeds.organizeGather === 'Oe') return [['Fe', 'Se'], ['Te', 'Ne']][floor(random(2))]; // e.g., Fe/Se or Te/Ne
    return [['Fi', 'Si']]; // Default
}

// Function to determine savior animals based on savior functions
function getSaviorAnimals(saviorFunctions, humanNeeds) {
    let animals = [];
    // 1st Savior Animal (from the two savior functions)
    let deciderSavior = saviorFunctions[0][0].endsWith('i') || saviorFunctions[0][0].endsWith('e') ? saviorFunctions[0] : saviorFunctions[1];
    let observerSavior = saviorFunctions[0][0].endsWith('S') || saviorFunctions[0][0].endsWith('N') ? saviorFunctions[0] : saviorFunctions[1];
    
    if (observerSavior[0].endsWith('i')) observerSavior = observerSavior.substring(0,1) + "i"; //Oi
    else observerSavior = observerSavior.substring(0,1) + "e"; //Oe

    if (deciderSavior[0].endsWith('i')) deciderSavior = deciderSavior.substring(0,1) + "i"; //Di
    else deciderSavior = deciderSavior.substring(0,1) + "e"; //De


    if (humanNeeds.selfTribe === 'Di' && humanNeeds.organizeGather === 'Oi') animals.push('Sleep');
    else if (humanNeeds.selfTribe === 'Di' && humanNeeds.organizeGather === 'Oe') animals.push('Consume');
    else if (humanNeeds.selfTribe === 'De' && humanNeeds.organizeGather === 'Oi') animals.push('Blast');
    else if (humanNeeds.selfTribe === 'De' && humanNeeds.organizeGather === 'Oe') animals.push('Play');

    // 2nd Savior Animal (Info/Energy Balance)
    // This logic is also complex in OPS. We'll simplify.
    // If first is Energy (Sleep/Play), second is Info (Consume/Blast)
    // If first is Info (Consume/Blast), second is Energy (Sleep/Play)
    // And it has to be the "other" humanNeed coin
    if (animals[0] === 'Sleep' || animals[0] === 'Play') { // Energy first
        if (humanNeeds.selfTribe === 'Di') animals.push('Blast'); // Oe+De or Oi+De -> Blast
        else animals.push('Consume'); // Oi+Di or Oe+Di -> Consume
    } else { // Info first
        if (humanNeeds.selfTribe === 'Di') animals.push('Play');    // Oe+De -> Play
        else animals.push('Sleep');   // Oi+Di -> Sleep
    }
    // This simplified logic might lead to some OPS-invalid animal pairings
    // or miss jumpers. For a true OPS sim, this needs meticulous mapping.
    // For now, let's ensure they are distinct
    if (animals[0] === animals[1]) {
        const allAnimals = ['Sleep', 'Consume', 'Blast', 'Play'];
        let availableAnimals = allAnimals.filter(a => a !== animals[0]);
        animals[1] = random(availableAnimals);
    }

    return animals;
}

class OpsAgent {
    constructor(x, y, opsTemperament, initialSaviorAnimals) {
        this.position = createVector(x, y);
        this.velocity = p5.Vector.random2D();
        this.size = 15;

        // Core OPS Type
        this.opsTemperament = opsTemperament; // 'IP', 'EP', 'EJ', 'IJ'
        this.saviorAnimals = initialSaviorAnimals; // ['Sleep', 'Blast']
        this.allAnimals = ['Sleep', 'Consume', 'Blast', 'Play'];
        this.demonAnimals = this.allAnimals.filter(a => !this.saviorAnimals.includes(a));
        this.currentAnimalState = random(this.saviorAnimals);

        // Primitive States
        this.subjectiveEntropy = random(50, 100); // Higher = more internal chaos/need to process
        this.objectiveEntropyKnowledge = random(50, 100); // Higher = environment/tribe less understood
        this.actionEnergy = 100;

        // State Timers & Mechanics
        this.timeInCurrentAnimalState = 0;
        this.maxTimeInSaviorState = round(random(200, 400)); // Frames
        this.demonStateTriggerPressure = 0;
        this.demonStatePressureThreshold = 500; // After this much imbalance, trigger demon
        this.isInDemonState = false;
        this.demonStateDuration = round(random(100, 200));

        // Visualization
        this.color = color(200);
        this.updateColor();

        // DMOs (can be added on top later, for now focus on OPS primitives)
        this.hasActiveDMO = false; // Start without for now to focus on OPS coins

        // For specific behaviors
        this.targetPip = null;
        this.targetAgent = null;
    }

    // --- Core Logic for Animal States affecting primitives ---
    performSleep() {
        this.velocity.mult(0.9); // Slow down
        this.subjectiveEntropy = max(0, this.subjectiveEntropy - 0.5); // Process internal
        this.actionEnergy = min(100, this.actionEnergy + 0.2); // Rest
        if (this.isInDemonState) {
            this.actionEnergy = max(0, this.actionEnergy - 0.3); // Demon sleep is tiring
            this.subjectiveEntropy = max(0, this.subjectiveEntropy - 0.1); // Less effective
        }
    }

    performConsume(informationPips) {
        // Find nearest Novel Information Pip
        if (!this.targetPip || this.targetPip.type === 'Known') {
            let closestNovelPip = null;
            let minDist = Infinity;
            for (let pip of informationPips) {
                if (pip.type === 'Novel') {
                    let d = p5.Vector.dist(this.position, pip.position);
                    if (d < minDist) {
                        minDist = d;
                        closestNovelPip = pip;
                    }
                }
            }
            this.targetPip = closestNovelPip;
        }

        if (this.targetPip) {
            let desired = p5.Vector.sub(this.targetPip.position, this.position);
            this.velocity.add(desired.normalize().mult(0.1));
            this.velocity.limit(1.5);
            if (p5.Vector.dist(this.position, this.targetPip.position) < this.size / 2 + this.targetPip.size / 2) {
                this.subjectiveEntropy += this.targetPip.value / 2; // New info adds to processing load
                this.objectiveEntropyKnowledge = max(0, this.objectiveEntropyKnowledge - this.targetPip.value); // Learned about this pip
                this.targetPip.consumed = true; // Mark for removal
                this.targetPip = null;
            }
        } else {
            this.wanderSlightly();
        }
        this.actionEnergy = max(0, this.actionEnergy - 0.1);
        if (this.isInDemonState) {
            this.subjectiveEntropy += 0.5; // Demon consume is just confusing
            this.actionEnergy = max(0, this.actionEnergy - 0.2);
        }
    }

    performBlast() {
        this.velocity.mult(0.95);
        // Emit "order" - affects nearby agents' objectiveEntropyKnowledge
        for (let other of agents) {
            if (other !== this && p5.Vector.dist(this.position, other.position) < 50) {
                if (this.isInDemonState) {
                    other.objectiveEntropyKnowledge = min(100, other.objectiveEntropyKnowledge + 0.3); // Confusing blast
                } else {
                    other.objectiveEntropyKnowledge = max(0, other.objectiveEntropyKnowledge - 0.2); // Clarifying blast
                }
            }
        }
        this.actionEnergy = max(0, this.actionEnergy - 0.15);
        if (this.isInDemonState) this.actionEnergy = max(0, this.actionEnergy - 0.1);
    }

    performPlay(allAgents) {
        // Move erratically, maybe towards other agents
        if (!this.targetAgent || random(1) < 0.05) {
            this.targetAgent = random(allAgents.filter(a => a !== this));
        }
        if (this.targetAgent) {
            let desired = p5.Vector.sub(this.targetAgent.position, this.position);
            this.velocity.add(desired.normalize().mult(0.2));
        } else {
            this.velocity.add(p5.Vector.random2D().mult(0.5));
        }
        this.velocity.limit(2);

        // Disrupts local objectiveEntropyKnowledge for others
        for (let other of allAgents) {
            if (other !== this && p5.Vector.dist(this.position, other.position) < 40) {
                 other.objectiveEntropyKnowledge = min(100, other.objectiveEntropyKnowledge + (this.isInDemonState ? 0.5 : 0.25) );
            }
        }
        this.actionEnergy = max(0, this.actionEnergy - 0.2);
    }


    // --- Helper for slight random movement ---
    wanderSlightly() {
        this.velocity.add(p5.Vector.random2D().mult(0.2));
        this.velocity.limit(0.8);
    }


    // --- Update agent state based on OPS Temperament ---
    applyTemperamentLogic(allAgents, informationPips) {
        // IP: Prefers Sleep/Consume. If tribe cohesion low, may "abandon" (move to edge).
        if (this.opsTemperament === 'IP') {
            if (this.currentAnimalState === 'Blast' || this.currentAnimalState === 'Play') {
                this.demonStateTriggerPressure += 0.2; // Slightly more pressure if in De animal
            }
            // Simplified "abandon" logic: if low energy and many agents nearby, move away
            if (this.actionEnergy < 30) {
                let nearbyAgents = allAgents.filter(a => a !== this && p5.Vector.dist(this.position, a.position) < 100).length;
                if (nearbyAgents > agents.length / 3) {
                    let escapeVector = createVector(this.position.x - width/2, this.position.y - height/2).mult(-1);
                    this.velocity.add(escapeVector.normalize().mult(0.3));
                }
            }
        }
        // EJ: Prefers Blast/Play. If sees IP dominating resources or an IP "abandoning", might "counter."
        else if (this.opsTemperament === 'EJ') {
            if (this.currentAnimalState === 'Sleep' || this.currentAnimalState === 'Consume') {
                this.demonStateTriggerPressure += 0.2;
            }
            for(let other of allAgents) {
                if (other.opsTemperament === 'IP' && p5.Vector.dist(this.position, other.position) < 150) {
                    // If IP is Consuming heavily (many pips nearby it) or seems to be "hoarding"
                    // This is abstract. Maybe if IP is near many pips and EJ has high objectiveEntropy.
                    if (other.currentAnimalState === 'Consume' && this.objectiveEntropyKnowledge > 70) {
                        this.targetAgent = other; // Move towards to potentially Blast/Play and "correct"
                    }
                }
            }
        }
        // IJ: Prefers Sleep/Blast. Dislikes EP chaos.
        else if (this.opsTemperament === 'IJ') {
            if (this.currentAnimalState === 'Consume' || this.currentAnimalState === 'Play') {
                this.demonStateTriggerPressure += 0.2;
            }
            for(let other of allAgents) {
                if (other.opsTemperament === 'EP' && other.currentAnimalState === 'Play' && p5.Vector.dist(this.position, other.position) < 80) {
                   if(this.currentAnimalState !== 'Blast' && random(1) < 0.1) this.currentAnimalState = 'Blast'; // Try to restore order
                   else { // Flee the chaos
                        let fleeVector = p5.Vector.sub(this.position, other.position);
                        this.velocity.add(fleeVector.normalize().mult(0.4));
                   }
                }
            }
        }
        // EP: Prefers Consume/Play. Dislikes IJ rigid order.
        else if (this.opsTemperament === 'EP') {
             if (this.currentAnimalState === 'Sleep' || this.currentAnimalState === 'Blast') {
                this.demonStateTriggerPressure += 0.2;
            }
            for(let other of allAgents) {
                if (other.opsTemperament === 'IJ' && other.currentAnimalState === 'Blast' && p5.Vector.dist(this.position, other.position) < 100) {
                   if(this.currentAnimalState !== 'Play' && random(1) < 0.1) this.currentAnimalState = 'Play'; // Disrupt order
                }
            }
        }
    }


    update(informationPips, allAgents) {
        if (this.actionEnergy <= 0 && !this.isInDemonState) { // If out of energy, force Sleep to recover
            this.currentAnimalState = 'Sleep';
            this.timeInCurrentAnimalState = 0;
        } else if (this.actionEnergy <=0 && this.isInDemonState) {
            // If in demon state and out of energy, transition out of demon state
            this.isInDemonState = false;
            this.currentAnimalState = random(this.saviorAnimals); // Back to a savior
            this.timeInCurrentAnimalState = 0;
            this.demonStateTriggerPressure = 0; // Reset pressure
            this.actionEnergy = 20; // Give some starting energy
        }


        this.timeInCurrentAnimalState++;

        // Demon state / Tidal Wave logic
        if (!this.isInDemonState) {
            if (this.saviorAnimals.includes(this.currentAnimalState)) {
                this.demonStateTriggerPressure -= 0.1; // Pressure reduces in savior state
            } else { // If somehow in a non-savior, non-demon state (shouldn't happen often with current transitions)
                this.demonStateTriggerPressure += 0.1;
            }
            this.demonStateTriggerPressure = constrain(this.demonStateTriggerPressure, 0, this.demonStatePressureThreshold * 1.5);

            if (this.timeInCurrentAnimalState > this.maxTimeInSaviorState || this.demonStateTriggerPressure >= this.demonStatePressureThreshold) {
                if (this.demonAnimals.length > 0) {
                    this.isInDemonState = true;
                    this.currentAnimalState = random(this.demonAnimals);
                    console.log(`${this.opsTemperament} triggered into DEMON ${this.currentAnimalState}`);
                    this.timeInCurrentAnimalState = 0; // Reset timer for demon state
                    this.demonStateTriggerPressure = 0; // Reset pressure after trigger
                }
            }
        } else { // Is in Demon State
            if (this.timeInCurrentAnimalState > this.demonStateDuration) {
                this.isInDemonState = false;
                this.currentAnimalState = random(this.saviorAnimals); // Back to a savior
                this.timeInCurrentAnimalState = 0;
                this.demonStateTriggerPressure = 0;
                this.actionEnergy = 30; // Give some recovery energy
            }
        }

        // Perform actions based on current animal state
        if (this.currentAnimalState === 'Sleep') this.performSleep();
        else if (this.currentAnimalState === 'Consume') this.performConsume(informationPips);
        else if (this.currentAnimalState === 'Blast') this.performBlast();
        else if (this.currentAnimalState === 'Play') this.performPlay(allAgents);

        // Apply temperament-specific modifications to behavior
        this.applyTemperamentLogic(allAgents, informationPips);


        this.position.add(this.velocity);
        this.edges();
        this.updateColor();
    }

    edges() { /* ... same as before ... */ }
    updateColor() { /* ... similar to setAppearanceByState, but can be simpler if only color changes ... */
        let baseHue;
        if (this.currentAnimalState === 'Sleep') baseHue = 240; // Blue
        else if (this.currentAnimalState === 'Consume') baseHue = 60; // Yellow
        else if (this.currentAnimalState === 'Blast') baseHue = 0; // Red
        else if (this.currentAnimalState === 'Play') baseHue = 120; // Green

        let saturation = this.isInDemonState ? 50 : 100;
        let brightness = map(this.actionEnergy, 0, 100, 40, 100);
        if(this.isInDemonState) brightness = max(20, brightness*0.7); // Darker if demon

        // Temperament overlay
        if(this.opsTemperament === 'IP') baseHue = (baseHue + 30) % 360;
        else if(this.opsTemperament === 'EJ') baseHue = (baseHue - 30 + 360) % 360;
        else if(this.opsTemperament === 'IJ') saturation = max(30, saturation - 20);
        else if(this.opsTemperament === 'EP') brightness = min(100, brightness + 10);


        colorMode(HSB);
        this.color = color(baseHue, saturation, brightness, 0.8);
        colorMode(RGB); // Reset to default
    }

    display() { /* ... same as before, but use this.color ... */
        stroke(0);
        fill(this.color);
        ellipse(this.position.x, this.position.y, this.size * 2);

        fill(this.isInDemonState ? color(255,0,0) : 0); // Red text if demon
        noStroke();
        textAlign(CENTER, CENTER);
        textSize(8);
        text(`${this.opsTemperament}\n${this.currentAnimalState[0]}${this.isInDemonState ? '(D)':''}\nE:${floor(this.actionEnergy)}\nSE:${floor(this.subjectiveEntropy)}`, this.position.x, this.position.y);
    }
}

// --- Information Pip Class ---
class InformationPip {
    constructor(x, y) {
        this.position = createVector(x, y);
        this.type = random(1) < 0.1 ? 'Known' : 'Novel'; // More known than novel
        this.value = this.type === 'Novel' ? random(20, 40) : random(5, 15); // Novelty/Surprisal value
        this.size = this.type === 'Novel' ? 10 : 7;
        this.color = this.type === 'Novel' ? color(250, 200, 50) : color(180, 180, 220);
        this.consumed = false;
    }

    display() {
        if (!this.consumed) {
            fill(this.color);
            noStroke();
            ellipse(this.position.x, this.position.y, this.size);
        }
    }
}

// --- Global Variables ---
let agents = [];
let numAgents = 10; // Increased for more interaction
let informationPips = [];
let numPips = 30;

function setup() {
    createCanvas(800, 600);
    const temperaments = ['IP', 'EP', 'EJ', 'IJ'];
    for (let i = 0; i < numAgents; i++) {
        let temperament = random(temperaments);
        // Simplified initial savior animals based on temperament (can be refined)
        let saviors;
        if (temperament === 'IP') saviors = ['Sleep', 'Consume'];
        else if (temperament === 'EP') saviors = ['Consume', 'Play'];
        else if (temperament === 'EJ') saviors = ['Blast', 'Play'];
        else if (temperament === 'IJ') saviors = ['Sleep', 'Blast'];
        else saviors = ['Sleep', 'Consume']; // Default

        agents.push(new OpsAgent(random(width), random(height), temperament, saviors));
    }
    for (let i = 0; i < numPips; i++) {
        informationPips.push(new InformationPip(random(width), random(height)));
    }
}

function draw() {
    background(30, 35, 40);

    // Manage pips
    informationPips = informationPips.filter(pip => !pip.consumed);
    while (informationPips.length < numPips) {
        informationPips.push(new InformationPip(random(width), random(height)));
    }
    for (let pip of informationPips) {
        pip.display();
    }

    for (let agent of agents) {
        agent.update(informationPips, agents); // Pass all agents for interaction
        agent.display();
    }
}

// MousePressed for debugging can remain

// Mouse interaction to inspect an agent
function mousePressed() {
    for (let agent of agents) {
        let d = dist(mouseX, mouseY, agent.position.x, agent.position.y);
        if (d < agent.size) {
            console.log("--- Agent Info ---");
            console.log("Human Needs:", agent.humanNeeds);
            console.log("Savior Functions:", agent.saviorFunctions);
            console.log("Savior Animals:", agent.saviorAnimals);
            console.log("Current State:", agent.currentAnimalState);
            console.log("------------------");
        }
    }
}