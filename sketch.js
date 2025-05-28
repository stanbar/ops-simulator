// --- Global Variables & Settings ---
let agents = [];
let numAgents = 15;
let informationPips = [];

const NOVEL_PIP_COLOR_HSB = [50, 80, 90];
const KNOWN_PIP_COLOR_HSB = [220, 30, 85];

const IP_BASE_HUE = 0;
const EJ_BASE_HUE = 120;
const IJ_BASE_HUE = 240;
const EP_BASE_HUE = 45;

const DEMON_STATE_BRIGHTNESS_FACTOR = 0.5;
const DEMON_STATE_SATURATION_FACTOR = 0.7;

// --- Global Sliders ---
let S_numPips, S_perceptionRadius, S_imbalanceThresholdMultiplier, S_simulationSpeed;
let S_agentMaxSpeed, S_actionPotentialRecoveryRate, S_socialPressureSensitivity;

// --- Temperament Specific Sliders ---
// IP
let S_ipInternalOrderFocus, S_ipAbandonThreshold;
// EJ
let S_ejTribeOrderFocus, S_ejSocialPressureGoal;
// IJ
let S_ijLocalOrderFocus, S_ijChaosResistance;
// EP
let S_epNoveltyDrive, S_epDisruptionFactor;

let currentNumPips = 60;
let simHeight; // Simulation area height

let sliderSpacing;
let sectionSpacing;
let col1X;
let col2X;
let sliderWidth;
let currentY;

function setup() {
    simHeight = 600; // Actual simulation area
    createCanvas(800, simHeight + 200); // Increased height significantly for sliders
    colorMode(HSB, 360, 100, 100, 1);

    // --- Create Sliders ---
    currentY = simHeight + 10;
    sliderWidth = '120px';
    sliderSpacing = 25;
    sectionSpacing = 15;
    col1X = 120;
    col2X = 450; // For a second column of sliders

    // -- Global Sliders --
    fill(0,0,80); textSize(14); text("Global Settings:", 20, currentY); currentY += sliderSpacing;
    S_simulationSpeed = createSlider(0.1, 3, 1, 0.1);
    S_simulationSpeed.position(col1X, currentY); S_simulationSpeed.style('width', sliderWidth);
    S_numPips = createSlider(10, 150, 60, 5);
    S_numPips.position(col2X, currentY); S_numPips.style('width', sliderWidth);
    currentY += sliderSpacing;

    S_perceptionRadius = createSlider(20, 150, 75, 5); // Reduced max perception for performance
    S_perceptionRadius.position(col1X, currentY); S_perceptionRadius.style('width', sliderWidth);
    S_imbalanceThresholdMultiplier = createSlider(0.2, 2.5, 1.0, 0.1);
    S_imbalanceThresholdMultiplier.position(col2X, currentY); S_imbalanceThresholdMultiplier.style('width', sliderWidth);
    currentY += sliderSpacing;

    S_agentMaxSpeed = createSlider(0.5, 3.0, 1.2, 0.1);
    S_agentMaxSpeed.position(col1X, currentY); S_agentMaxSpeed.style('width', sliderWidth);
    S_actionPotentialRecoveryRate = createSlider(0.0005, 0.005, 0.0015, 0.0001);
    S_actionPotentialRecoveryRate.position(col2X, currentY); S_actionPotentialRecoveryRate.style('width', sliderWidth);
    currentY += sliderSpacing;

    S_socialPressureSensitivity = createSlider(0.1, 2.0, 1.0, 0.1);
    S_socialPressureSensitivity.position(col1X, currentY); S_socialPressureSensitivity.style('width', sliderWidth);
    currentY += sectionSpacing; // Space before next section

    // -- IP Sliders --
    fill(IP_BASE_HUE, 80,80); textSize(14); text("IP Settings (Di):", 20, currentY); currentY += sliderSpacing;
    S_ipInternalOrderFocus = createSlider(0.5, 2.5, 1.5, 0.1);
    S_ipInternalOrderFocus.position(col1X, currentY); S_ipInternalOrderFocus.style('width', sliderWidth);
    S_ipAbandonThreshold = createSlider(-0.8, -0.2, -0.5, 0.05); // Social pressure threshold for abandoning
    S_ipAbandonThreshold.position(col2X, currentY); S_ipAbandonThreshold.style('width', sliderWidth);
    currentY += sectionSpacing;

    // -- EJ Sliders --
    fill(EJ_BASE_HUE, 80,80); textSize(14); text("EJ Settings (De):", 20, currentY); currentY += sliderSpacing;
    S_ejTribeOrderFocus = createSlider(0.5, 2.5, 1.4, 0.1); // Multiplier for influenceExternalOrder drive
    S_ejTribeOrderFocus.position(col1X, currentY); S_ejTribeOrderFocus.style('width', sliderWidth);
    S_ejSocialPressureGoal = createSlider(0.1, 0.8, 0.3, 0.05); // Target positive social pressure
    S_ejSocialPressureGoal.position(col2X, currentY); S_ejSocialPressureGoal.style('width', sliderWidth);
    currentY += sectionSpacing;

    // -- IJ Sliders --
    fill(IJ_BASE_HUE, 80,80); textSize(14); text("IJ Settings (Oi):", 20, currentY); currentY += sliderSpacing;
    S_ijLocalOrderFocus = createSlider(0.5, 2.5, 1.5, 0.1); // Multiplier for its influenceExternalOrder drive
    S_ijLocalOrderFocus.position(col1X, currentY); S_ijLocalOrderFocus.style('width', sliderWidth);
    S_ijChaosResistance = createSlider(0.1, 1.0, 0.4, 0.05); // How much external chaos it tolerates before strong reaction
    S_ijChaosResistance.position(col2X, currentY); S_ijChaosResistance.style('width', sliderWidth);
    currentY += sectionSpacing;

    // -- EP Sliders --
    fill(EP_BASE_HUE, 90,80); textSize(14); text("EP Settings (Oe):", 20, currentY); currentY += sliderSpacing;
    S_epNoveltyDrive = createSlider(0.5, 2.5, 1.5, 0.1); // Multiplier for externalInfoSelf drive
    S_epNoveltyDrive.position(col1X, currentY); S_epNoveltyDrive.style('width', sliderWidth);
    S_epDisruptionFactor = createSlider(0.001, 0.008, 0.003, 0.0005); // How much its play/consume reduces others' perceived order
    S_epDisruptionFactor.position(col2X, currentY); S_epDisruptionFactor.style('width', sliderWidth);


    resetSimulation(); // Initialize simulation with default slider values
}

const needs = ['Di', 'De', 'Oi', 'Oe'];

function resetSimulation() {
    agents = [];
    informationPips = [];

    for (let i = 0; i < numAgents; i++) {
        let dominantNeed = random(needs);
        agents.push(new OpsAgent(random(width), random(simHeight), dominantNeed));
    }

    currentNumPips = S_numPips.value();
    for (let i = 0; i < currentNumPips; i++) {
        informationPips.push(new InformationPip(random(width), random(simHeight)));
    }
}

function draw() {
    // Simulation Speed control: number of updates per draw frame
    let speedValue = S_simulationSpeed.value();
    for (let i = 0; i < speedValue; i++) {
        // Manage Pips based on slider
        if (informationPips.length > S_numPips.value()) {
            informationPips.splice(S_numPips.value());
        } else if (informationPips.length < S_numPips.value()) {
            informationPips.push(new InformationPip(random(width), random(simHeight)));
        }
        currentNumPips = S_numPips.value();

        for (let agent of agents) {
            agent.run(agents, informationPips);
        }
    }

    // --- Drawing ---
    background(220, 15, 20); // Background for sim area
    for (let pip of informationPips) {
        pip.display();
    }
    for (let agent of agents) {
        agent.display();
    }

    // --- Draw Slider UI ---
    push();
    colorMode(RGB); // Use RGB for UI for consistency
    fill(200); // Light grey for UI background
    rect(0, simHeight, width, height - simHeight); // UI panel background

    fill(10); // Dark text for UI
    noStroke();
    textSize(11); // Smaller text for slider labels
    textAlign(LEFT, CENTER);

    let currentY = simHeight + 10;
    let sliderHeight = S_simulationSpeed.height; // Assuming all sliders have same height
    let labelXOffset = 10;
    let valueXOffset = 130; // Where the value text starts
    let col1LabelX = 20;
    let col2LabelX = 350;


    // Global Sliders Text
    fill(0); textSize(13); text("Global Settings:", labelXOffset, currentY); currentY += sliderSpacing;
    textAlign(RIGHT, CENTER);
    text("Sim Speed:", col1LabelX + 100, currentY + sliderHeight / 2);
    text("Num Pips:", col2LabelX + 100, currentY + sliderHeight / 2);
    textAlign(LEFT, CENTER);
    text(S_simulationSpeed.value().toFixed(1), S_simulationSpeed.x + S_simulationSpeed.width + labelXOffset, currentY + sliderHeight / 2);
    text(S_numPips.value(), S_numPips.x + S_numPips.width + labelXOffset, currentY + sliderHeight / 2);
    currentY += sliderSpacing;

    textAlign(RIGHT, CENTER);
    text("Perception:", col1LabelX + 100, currentY + sliderHeight / 2);
    text("Imbalance X:", col2LabelX + 100, currentY + sliderHeight / 2);
    textAlign(LEFT, CENTER);
    text(S_perceptionRadius.value(), S_perceptionRadius.x + S_perceptionRadius.width + labelXOffset, currentY + sliderHeight / 2);
    text(S_imbalanceThresholdMultiplier.value().toFixed(1), S_imbalanceThresholdMultiplier.x + S_imbalanceThresholdMultiplier.width + labelXOffset, currentY + sliderHeight / 2);
    currentY += sliderSpacing;

    textAlign(RIGHT, CENTER);
    text("Max Speed:", col1LabelX + 100, currentY + sliderHeight / 2);
    text("AP Regen:", col2LabelX + 100, currentY + sliderHeight / 2);
    textAlign(LEFT, CENTER);
    text(S_agentMaxSpeed.value().toFixed(1), S_agentMaxSpeed.x + S_agentMaxSpeed.width + labelXOffset, currentY + sliderHeight / 2);
    text(S_actionPotentialRecoveryRate.value().toFixed(4), S_actionPotentialRecoveryRate.x + S_actionPotentialRecoveryRate.width + labelXOffset, currentY + sliderHeight / 2);
    currentY += sliderSpacing;

    textAlign(RIGHT, CENTER);
    text("Social X:", col1LabelX + 100, currentY + sliderHeight / 2);
    currentY += sectionSpacing;


    // IP Sliders Text
    fill(IP_BASE_HUE,80,70); textSize(13); text("IP (Di) Settings:", labelXOffset, currentY); currentY += sliderSpacing;
    textAlign(RIGHT, CENTER);
    text("IO Focus:", col1LabelX+100, currentY + sliderHeight / 2);
    text("Abandon Th:", col2LabelX+100, currentY + sliderHeight / 2);
    textAlign(LEFT, CENTER);
    text(S_ipInternalOrderFocus.value().toFixed(1), S_ipInternalOrderFocus.x + S_ipInternalOrderFocus.width + labelXOffset, currentY + sliderHeight / 2);
    text(S_ipAbandonThreshold.value().toFixed(2), S_ipAbandonThreshold.x + S_ipAbandonThreshold.width + labelXOffset, currentY + sliderHeight / 2);
    currentY += sectionSpacing;

    // EJ Sliders Text
    fill(EJ_BASE_HUE,80,70); textSize(13); text("EJ (De) Settings:", labelXOffset, currentY); currentY += sliderSpacing;
    textAlign(RIGHT, CENTER);
    text("Tribe Ord F:", col1LabelX+100, currentY + sliderHeight / 2);
    text("Social Goal:", col2LabelX+100, currentY + sliderHeight / 2);
    textAlign(LEFT, CENTER);
    text(S_ejTribeOrderFocus.value().toFixed(1), S_ejTribeOrderFocus.x + S_ejTribeOrderFocus.width + labelXOffset, currentY + sliderHeight / 2);
    text(S_ejSocialPressureGoal.value().toFixed(2), S_ejSocialPressureGoal.x + S_ejSocialPressureGoal.width + labelXOffset, currentY + sliderHeight / 2);
    currentY += sectionSpacing;

    // IJ Sliders Text
    fill(IJ_BASE_HUE,80,70); textSize(13); text("IJ (Oi) Settings:", labelXOffset, currentY); currentY += sliderSpacing;
    textAlign(RIGHT, CENTER);
    text("Local Ord F:", col1LabelX+100, currentY + sliderHeight / 2);
    text("Chaos Resist:", col2LabelX+100, currentY + sliderHeight / 2);
    textAlign(LEFT, CENTER);
    text(S_ijLocalOrderFocus.value().toFixed(1), S_ijLocalOrderFocus.x + S_ijLocalOrderFocus.width + labelXOffset, currentY + sliderHeight / 2);
    text(S_ijChaosResistance.value().toFixed(2), S_ijChaosResistance.x + S_ijChaosResistance.width + labelXOffset, currentY + sliderHeight / 2);
    currentY += sectionSpacing;

    // EP Sliders Text
    fill(EP_BASE_HUE,90,70); textSize(13); text("EP (Oe) Settings:", labelXOffset, currentY); currentY += sliderSpacing;
    textAlign(RIGHT, CENTER);
    text("Novelty Drv:", col1LabelX+100, currentY + sliderHeight / 2);
    text("Disrupt X:", col2LabelX+100, currentY + sliderHeight / 2);
    textAlign(LEFT, CENTER);
    text(S_epNoveltyDrive.value().toFixed(1), S_epNoveltyDrive.x + S_epNoveltyDrive.width + labelXOffset, currentY + sliderHeight / 2);
    text(S_epDisruptionFactor.value().toFixed(4), S_epDisruptionFactor.x + S_epDisruptionFactor.width + labelXOffset, currentY + sliderHeight / 2);


    // General Info display at top of canvas
    fill(0,0,100); // White text for general info
    textSize(12);
    textAlign(LEFT, TOP);
    let demonCount = agents.filter(a => a.isInDemonState).length;
    text(`Agents: ${numAgents} | Pips: ${currentNumPips} | Demon: ${demonCount}`, 10, 10);
    let avgInternalOrder = agents.reduce((sum, agent) => sum + agent.internalOrder, 0) / (agents.length || 1);
    text(`Avg IO: ${avgInternalOrder.toFixed(2)}`, 10, 30);
    let avgActionPotential = agents.reduce((sum, agent) => sum + agent.actionPotential, 0) / (agents.length || 1);
    text(`Avg AP: ${avgActionPotential.toFixed(2)}`, 10, 50);
    pop(); // End UI styling isolation
}


// --- InformationPip Class --- (Same as previous final version)
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
        // this.maxSpeed will be set from slider in run()
        this.maxForce = 0.08;
        this.agentDrawSize = 18;
        this.size = this.agentDrawSize;
        this.wanderTheta = random(TWO_PI);

        this.dominantHumanNeed = dominantHumanNeed;
        this.opsTemperament = this.getTemperamentFromNeed(dominantHumanNeed);
        this.demonNeed = this.getDemonNeed(this.dominantHumanNeed);

        this.internalOrder = random(0.4, 0.8);
        this.perceivedExternalOrder_local = random(0.4, 0.8);
        this.actionPotential = random(0.6, 1.0);
        this.socialPressure = 0; // -1 (high negative from tribe) to 1 (high positive from tribe)

        this.forces = { internalOrder: createVector(), externalInfoSelf: createVector(), influenceExternalOrder: createVector(), tribeInteraction: createVector()};
        this.driveActivationLevels = { internalOrder: 0, externalInfoSelf: 0, influenceExternalOrder: 0, tribeInteraction: 0 };

        this.imbalanceCounters = { Di: 0, De: 0, Oi: 0, Oe: 0 };
        this.baseImbalanceThreshold = 150;
        this.imbalanceThreshold = this.baseImbalanceThreshold; // Will be updated by slider
        this.isInDemonState = false;
        this.demonStateTimer = 0;
        this.demonStateDuration = round(random(250, 400));

        this.baseHue = this.getBaseHue();
        this.currentSat = 70;
        this.currentBrt = 70;
        this.currentAlpha = 0.9;
        this.debugLastStrongestDrive = "None";
    }

    getTemperamentFromNeed(need) { return need === 'Di' ? 'IP' : need === 'De' ? 'EJ' : need === 'Oi' ? 'IJ' : 'EP'; }
    getDemonNeed(dominantNeed) { return dominantNeed === 'Di' ? 'De' : dominantNeed === 'De' ? 'Di' : dominantNeed === 'Oi' ? 'Oe' : 'Oi'; }
    getBaseHue() { return this.opsTemperament === 'IP' ? IP_BASE_HUE : this.opsTemperament === 'EJ' ? EJ_BASE_HUE : this.opsTemperament === 'IJ' ? IJ_BASE_HUE : EP_BASE_HUE; }

    applyForce(force) { this.acceleration.add(force); }

    run(allAgents, pips) {
        // Update parameters from global sliders
        this.maxSpeed = S_agentMaxSpeed.value();
        this.imbalanceThreshold = this.baseImbalanceThreshold * S_imbalanceThresholdMultiplier.value();
        // perceptionRadius will be used directly from S_perceptionRadius.value() in find methods

        this.calculateDriveForces(allAgents, pips);
        this.applyTemperamentAndStateBiases(allAgents); // Pass allAgents for temperament logic
        this.manageImbalanceAndDemonStates();
        this.updateMovement();
        this.updatePrimitives(allAgents, pips);
        this.updateVisuals();
    }

    calculateDriveForces(allAgents, pips) {
        this.forces = { internalOrder: createVector(0,0), externalInfoSelf: createVector(0,0), influenceExternalOrder: createVector(0,0), tribeInteraction: createVector(0,0) };
        this.driveActivationLevels = { internalOrder: 0, externalInfoSelf: 0, influenceExternalOrder: 0, tribeInteraction: 0 };

        let currentPerceptionRadius = S_perceptionRadius.value();

        if (this.internalOrder < 0.45 || this.actionPotential < 0.25) {
            this.driveActivationLevels.internalOrder = map(this.internalOrder, 0.45, 0, 0.2, 1.0, true);
            this.forces.internalOrder = p5.Vector.mult(this.velocity, -0.15);
        }

        if (this.internalOrder > 0.75 || (this.opsTemperament === 'EP' && this.perceivedExternalOrder_local > 0.7)) {
            this.driveActivationLevels.externalInfoSelf = map(this.internalOrder, 0.75, 1.0, 0.3, 0.8, true) + (this.opsTemperament === 'EP' ? S_epNoveltyDrive.value() * 0.1 : 0); // EP higher drive
            let targetPip = this.findClosestPip(pips, 'Novel', currentPerceptionRadius * 1.8);
            if (targetPip) {
                this.forces.externalInfoSelf = this.steer(targetPip.position);
            } else {
                this.forces.externalInfoSelf = this.getWanderForce().mult(0.6);
            }
        }

        if (this.internalOrder > 0.65 && (this.perceivedExternalOrder_local < (this.opsTemperament === 'IJ' ? S_ijChaosResistance.value() : 0.4) || (this.opsTemperament === 'EJ' && this.socialPressure < -0.15))) {
            this.driveActivationLevels.influenceExternalOrder = map(this.internalOrder, 0.65, 1.0, 0.3, 0.7, true);
            this.forces.influenceExternalOrder = p5.Vector.mult(this.velocity, -0.08);
        }

        if (this.actionPotential > 0.55 && (this.internalOrder > 0.6 || (this.opsTemperament === 'EJ' && this.socialPressure < S_ejSocialPressureGoal.value()))) {
            this.driveActivationLevels.tribeInteraction = map(this.actionPotential, 0.55, 1.0, 0.3, 0.75, true);
            let targetAgent = this.findClosestAgent(allAgents, currentPerceptionRadius * 2.5);
            if (targetAgent) {
                this.forces.tribeInteraction = this.steer(targetAgent.position, true);
            } else {
                this.forces.tribeInteraction = this.getWanderForce().mult(0.8);
            }
        }
    }

    applyTemperamentAndStateBiases(allAgents) {
        // Apply temperament biases from sliders
        if (this.opsTemperament === 'IP') {
            this.driveActivationLevels.internalOrder *= S_ipInternalOrderFocus.value();
            this.driveActivationLevels.externalInfoSelf *= 1.3; // Base multiplier
            this.driveActivationLevels.influenceExternalOrder *= 0.4; this.driveActivationLevels.tribeInteraction *= 0.4;
            if (this.socialPressure < S_ipAbandonThreshold.value() && this.internalOrder < 0.25 && this.actionPotential > 0.3) {
                let awayFromCenter = createVector(this.position.x - width/2, this.position.y - simHeight/2).normalize().mult(-1);
                this.acceleration.add(awayFromCenter.mult(this.maxForce * 2.2));
                this.debugLastStrongestDrive = "Abandon";
            }
        } else if (this.opsTemperament === 'EJ') {
            this.driveActivationLevels.influenceExternalOrder *= S_ejTribeOrderFocus.value();
            this.driveActivationLevels.tribeInteraction *= 1.5; // Base multiplier
            this.driveActivationLevels.internalOrder *= (0.6 + this.socialPressure * 0.4 * S_socialPressureSensitivity.value());
            this.driveActivationLevels.externalInfoSelf *= 0.5;
             for (let other of allAgents) { /* ... EJ counter IP logic ... */ }
        } else if (this.opsTemperament === 'IJ') {
            this.driveActivationLevels.internalOrder *= 1.6; // Base
            this.driveActivationLevels.influenceExternalOrder *= S_ijLocalOrderFocus.value();
            this.driveActivationLevels.externalInfoSelf *= 0.5; this.driveActivationLevels.tribeInteraction *= 0.3;
             for (let other of allAgents) { /* ... IJ resist EP logic ... */ }
        } else if (this.opsTemperament === 'EP') {
            this.driveActivationLevels.externalInfoSelf *= S_epNoveltyDrive.value();
            this.driveActivationLevels.tribeInteraction *= 1.4; // Base
            this.driveActivationLevels.internalOrder *= 0.5; this.driveActivationLevels.influenceExternalOrder *= 0.4;
            for (let other of allAgents) { /* ... EP disrupt IJ logic ... */ }
        }

        if (this.isInDemonState) { /* ... Demon state drive amplification ... */
            let demonBias = 1.8; // Stronger amplification for demon state
            if (this.demonNeed === 'Di') this.driveActivationLevels.internalOrder = max(this.driveActivationLevels.internalOrder, 0.4) * demonBias;
            else if (this.demonNeed === 'Oe') this.driveActivationLevels.externalInfoSelf = max(this.driveActivationLevels.externalInfoSelf, 0.4) * demonBias;
            else if (this.demonNeed === 'Oi') this.driveActivationLevels.influenceExternalOrder = max(this.driveActivationLevels.influenceExternalOrder, 0.4) * demonBias;
            else if (this.demonNeed === 'De') this.driveActivationLevels.tribeInteraction = max(this.driveActivationLevels.tribeInteraction, 0.4) * demonBias;
        }

        // Combine forces
        this.acceleration.mult(0);
        let totalActivation = 0;
        for (let drive in this.driveActivationLevels) totalActivation += this.driveActivationLevels[drive];

        let currentMaxActivation = 0;
        let dominantForceName = "Wander";

        if (totalActivation > 0.01) {
            for (let drive in this.forces) {
                if (this.driveActivationLevels[drive] > 0) {
                    let weight = this.driveActivationLevels[drive] / totalActivation;
                    this.applyForce(p5.Vector.mult(this.forces[drive], weight));
                    if (this.driveActivationLevels[drive] > currentMaxActivation) {
                        currentMaxActivation = this.driveActivationLevels[drive];
                        dominantForceName = drive;
                    }
                }
            }
        } else {
            this.applyForce(this.getWanderForce().mult(0.15));
        }
        this.debugLastStrongestDrive = dominantForceName;
        this.applyForce(this.separate(allAgents).mult(1.8));
    }


    manageImbalanceAndDemonStates() { /* ... Same as before ... */
        let dominantNeedFulfilledThisFrame = false;
        if (this.dominantHumanNeed === 'Di' && (this.driveActivationLevels.internalOrder > 0.3 || this.driveActivationLevels.externalInfoSelf > 0.3)) dominantNeedFulfilledThisFrame = true;
        if (this.dominantHumanNeed === 'De' && (this.driveActivationLevels.influenceExternalOrder > 0.3 || this.driveActivationLevels.tribeInteraction > 0.3)) dominantNeedFulfilledThisFrame = true;
        if (this.dominantHumanNeed === 'Oi' && (this.driveActivationLevels.internalOrder > 0.3 || this.driveActivationLevels.influenceExternalOrder > 0.3)) dominantNeedFulfilledThisFrame = true;
        if (this.dominantHumanNeed === 'Oe' && (this.driveActivationLevels.externalInfoSelf > 0.3 || this.driveActivationLevels.tribeInteraction > 0.3)) dominantNeedFulfilledThisFrame = true;

        if (!this.isInDemonState) {
            if (dominantNeedFulfilledThisFrame) {
                this.imbalanceCounters[this.demonNeed] += 0.30; // Consistent buildup
            }
            for (let need in this.imbalanceCounters) {
                 this.imbalanceCounters[need] = max(0, this.imbalanceCounters[need] - 0.006);
            }

            if (this.imbalanceCounters[this.demonNeed] > this.imbalanceThreshold) {
                this.isInDemonState = true;
                this.demonStateTimer = this.demonStateDuration;
                this.imbalanceCounters[this.demonNeed] *= 0.3;
            }
        } else {
            this.demonStateTimer--;
            this.actionPotential = max(0, this.actionPotential - 0.003);
            if (this.demonStateTimer <= 0 || this.actionPotential <= 0.08) {
                this.isInDemonState = false;
                this.actionPotential = max(this.actionPotential, 0.25);
            }
        }
    }
    updateMovement() { /* ... Same as before ... */
        this.velocity.add(this.acceleration);
        let speedLimit = this.maxSpeed * (this.isInDemonState ? 0.75 : 1.0);
        if(this.driveActivationLevels.tribeInteraction > 0.6 && !this.isInDemonState && this.opsTemperament === 'EP') speedLimit *=1.4;
        else if(this.driveActivationLevels.externalInfoSelf > 0.6 && !this.isInDemonState && this.opsTemperament === 'EP') speedLimit *=1.3;

        this.velocity.limit(speedLimit);
        this.position.add(this.velocity);
        this.acceleration.mult(0);
        this.edges();
    }

    updatePrimitives(allAgents, pips) {
        let consumedThisFrame = false;
        let localPerceptionRadius = S_perceptionRadius.value(); // Use global for interactions

        // Internal Order Drive (Sleep-like behavior)
        if (this.driveActivationLevels.internalOrder > 0.1) {
            let efficiency = (this.isInDemonState && this.demonNeed === 'Di') ? 0.05 : // Di demon hardly rests
                             (this.isInDemonState && this.demonNeed === 'Oi') ? 0.1 : 1;  // Oi demon poor ordering
            this.internalOrder = min(1, this.internalOrder + 0.003 * this.driveActivationLevels.internalOrder * efficiency); // Slightly faster IO gain
            this.actionPotential = min(1, this.actionPotential + S_actionPotentialRecoveryRate.value() * this.driveActivationLevels.internalOrder * efficiency);
            if (efficiency === 1) this.velocity.mult(0.96); // Slightly less dampening
        }

        // Consume Drive (External Info Self)
        if (this.driveActivationLevels.externalInfoSelf > 0.1) {
            let efficiency = (this.isInDemonState && this.demonNeed === 'Di') ? 0.05 : // Di demon poor consuming for self
                             (this.isInDemonState && this.demonNeed === 'Oe') ? 0.1 : 1;  // Oe demon frantic, poor absorption
            for (let i = pips.length - 1; i >= 0; i--) { /* ... same consume logic ... */ }
            if (!consumedThisFrame) this.actionPotential = max(0, this.actionPotential - 0.0007); // Slightly higher search cost
        }

        // Blast Drive (Influence External Order)
        if (this.driveActivationLevels.influenceExternalOrder > 0.1) {
            let orderEffect = 0.003 * this.driveActivationLevels.influenceExternalOrder; // Slightly stronger blast
            if (this.isInDemonState) orderEffect *= (this.demonNeed === 'Oi' ? 0.02 : // Oi demon feeble attempt to order
                                                     (this.demonNeed === 'De' ? -0.8 : -0.3)); // De demon highly confusing
            for (let other of allAgents) {
                if (other !== this && p5.Vector.dist(this.position, other.position) < localPerceptionRadius * 0.95) { /* ... */ }
            }
            this.actionPotential = max(0, this.actionPotential - 0.0013);
            if (this.opsTemperament === 'EJ' && !this.isInDemonState && orderEffect > 0) this.socialPressure = min(1, this.socialPressure + 0.0007 * this.driveActivationLevels.influenceExternalOrder * S_socialPressureSensitivity.value());
        }

        // Play Drive (Tribe Interaction)
        if (this.driveActivationLevels.tribeInteraction > 0.1) {
            let chaosEffect = S_epDisruptionFactor.value() * this.driveActivationLevels.tribeInteraction; // Use EP slider for base
             if (this.opsTemperament !== 'EP') chaosEffect *= 0.5; // Non-EPs less disruptive in normal play

            if (this.isInDemonState) chaosEffect *= (this.demonNeed === 'Oe' ? 0.05 : // Oe demon feeble play
                                                     (this.demonNeed === 'De' ? 2.5 : 1.5));  // De demon extra chaotic
            for (let other of allAgents) { /* ... */ }
            this.actionPotential = max(0, this.actionPotential - 0.002); // Play is more tiring
            if (this.opsTemperament === 'EJ' && !this.isInDemonState && chaosEffect < 0) this.socialPressure = min(1, this.socialPressure + 0.0012 * this.driveActivationLevels.tribeInteraction * S_socialPressureSensitivity.value());
        }

        this.actionPotential = max(0, this.actionPotential - 0.0003);
        this.socialPressure = constrain(this.socialPressure * 0.99, -1, 1); // Ensure social pressure stays in bounds
        this.internalOrder = constrain(this.internalOrder, 0, 1);
        this.perceivedExternalOrder_local = constrain(this.perceivedExternalOrder_local, 0, 1);
    }


    updateVisuals() { /* ... Same as before ... */
        let hue = this.baseHue;
        let sat = 70;
        let brt = 70;

        if (this.opsTemperament === 'IP' && !this.isInDemonState) { hue = (IP_BASE_HUE); sat = max(40, sat - 20); }
        else if (this.opsTemperament === 'EJ' && !this.isInDemonState) { hue = (EJ_BASE_HUE); brt = min(90, brt + 15); }
        else if (this.opsTemperament === 'IJ' && !this.isInDemonState) { hue = (IJ_BASE_HUE); brt = max(55, brt - 15); }
        else if (this.opsTemperament === 'EP' && !this.isInDemonState) { hue = (EP_BASE_HUE); sat = min(95, sat + 20); }

        brt = map(this.actionPotential, 0, 1, brt * 0.5, brt * 1.15, true);
        sat = map(this.internalOrder, 0, 1, sat * 0.6, sat * 1.1, true);

        if (this.isInDemonState) {
            brt *= DEMON_STATE_BRIGHTNESS_FACTOR;
            sat *= DEMON_STATE_SATURATION_FACTOR;
            sat = max(10, sat - 30);
        }

        this.currentHue = hue;
        this.currentSat = constrain(sat, 10, 100);
        this.currentBrt = constrain(brt, 15, 100);
        this.currentAlpha = this.isInDemonState ? 0.75 : 0.95;
    }
    steer(targetPos, maintainDistance = false, arrivalRadius = 50, separationRadius = 20) { /* ... Same ... */
        let desired = p5.Vector.sub(targetPos, this.position);
        let d = desired.mag();
        let speedValue = this.maxSpeed;

        if (maintainDistance && d < arrivalRadius) {
            let perpendicular = createVector(-desired.y, desired.x);
            perpendicular.normalize();
            perpendicular.mult(this.maxSpeed * 0.7);
            desired = perpendicular;
            if (d < separationRadius) {
                 let away = p5.Vector.sub(this.position, targetPos);
                 desired.add(away.normalize().mult(this.maxSpeed));
            }
        } else if (!maintainDistance && d < 5) {
             desired.setMag(0);
        } else {
            desired.setMag(speedValue);
        }

        let steerForce = p5.Vector.sub(desired, this.velocity);
        steerForce.limit(this.maxForce);
        return steerForce;
    }
    getWanderForce() { /* ... Same ... */
        this.wanderTheta += random(-0.3, 0.3);
        let wanderDir = p5.Vector.fromAngle(this.wanderTheta);
        return wanderDir.mult(this.maxForce * 0.4);
    }
    separate(agents) { /* ... Same ... */
        let desiredSeparation = this.agentDrawSize * 2.0;
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
            steer.limit(this.maxForce * 1.5);
        }
        return steer;
    }
    findClosestPip(pips, type = 'Novel', searchRadius = S_perceptionRadius.value()) { /* ... Same, uses slider ... */
        let closest = null;
        let record = searchRadius + 1;
        for (let pip of pips) {
            if (!pip.consumed && pip.type === type) {
                let d = p5.Vector.dist(this.position, pip.position);
                if (d < record && d < searchRadius) {
                    record = d;
                    closest = pip;
                }
            }
        }
        return closest; // Returns null if nothing found in radius
    }
    findClosestAgent(agents, searchRadius = S_perceptionRadius.value()) { /* ... Same, uses slider ... */
        let closest = null;
        let record = searchRadius + 1;
        for (let other of agents) {
            if (other !== this) {
                let d = p5.Vector.dist(this.position, other.position);
                if (d < record && d < searchRadius ) {
                    record = d;
                    closest = other;
                }
            }
        }
        return closest; // Returns null if nothing found in radius
    }
    edges() { /* ... Same, adjusted for simHeight ... */
        if (this.position.x > width + this.agentDrawSize) this.position.x = -this.agentDrawSize;
        if (this.position.x < -this.agentDrawSize) this.position.x = width + this.agentDrawSize;
        if (this.position.y > simHeight + this.agentDrawSize) this.position.y = -this.agentDrawSize;
        if (this.position.y < -this.agentDrawSize) this.position.y = simHeight + this.agentDrawSize;
    }
    display() { /* ... Same as before (with shapes) ... */
        push();
        translate(this.position.x, this.position.y);
        if (this.velocity.magSq() > 0.01) {
            rotate(this.velocity.heading() + PI / 2);
        }

        noStroke();
        fill(this.currentHue, this.currentSat, this.currentBrt, this.currentAlpha);

        let s = this.agentDrawSize;

        if (this.opsTemperament === 'IP') {
            triangle(0, -s * 0.9, -s * 0.8, s * 0.45, s * 0.8, s * 0.45);
        } else if (this.opsTemperament === 'EJ') {
            rectMode(CENTER);
            rect(0, 0, s * 1.4, s * 1.4);
        } else if (this.opsTemperament === 'IJ') {
            ellipse(0, 0, s * 1.6);
        } else if (this.opsTemperament === 'EP') {
            beginShape();
            for (let i = 0; i < 5; i++) {
                let angle = TWO_PI / 5 * i - PI / 2;
                let x = cos(angle) * s;
                let y = sin(angle) * s;
                vertex(x, y);
                angle += TWO_PI / 10;
                x = cos(angle) * (s * 0.45);
                y = sin(angle) * (s * 0.45);
                vertex(x, y);
            }
            endShape(CLOSE);
        }
        pop();

        push();
        colorMode(RGB);
        let textColor = color(230);
        if (this.currentBrt < 35 && this.currentSat < 40) textColor = color(250);
        else if (this.currentBrt > 80 && this.currentSat > 80) textColor = color(20);
        if (this.isInDemonState) textColor = color(255, 80, 80);

        fill(textColor);
        textSize(9);
        textAlign(CENTER, TOP);
        let needStr = `${this.dominantHumanNeed}`;
        if (this.isInDemonState) needStr = `D:${this.demonNeed}`;
        text(`${this.opsTemperament} ${needStr}\nAP:${this.actionPotential.toFixed(1)} IO:${this.internalOrder.toFixed(1)} SP:${this.socialPressure.toFixed(1)}`, this.position.x, this.position.y + this.agentDrawSize + 3);
        pop();
    }
}