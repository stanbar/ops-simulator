const assert = require("node:assert/strict");
const {
  ANIMAL_ORDER,
  DESTINATION_PROFILES,
  EVIDENCE_STATE_PROFILES,
  ORIGIN_PROFILES,
  PROFILE_PRESETS,
  SCENARIOS,
  Game,
  animalCosts,
  goalChoices,
  autoplay
} = require("./engine.js");

let passed = 0;

function test(name, fn) {
  try {
    fn();
    passed += 1;
    process.stdout.write(`PASS ${name}\n`);
  } catch (error) {
    process.stderr.write(`FAIL ${name}\n${error.stack}\n`);
    process.exitCode = 1;
  }
}

function playDeterministically(game) {
  while (!game.finished) {
    const enabled = game.getActionOptions().filter((option) => option.enabled);
    game.step(enabled[game.round % enabled.length].animal);
  }
  return game.snapshot();
}

test("same seed and actions produce the same complete history", () => {
  const options = {
    seed: "deterministic-42",
    scenarioId: "melting",
    playerProfile: { observer: "Oe", decider: "Di", polarity: "Observer" },
    playerGoalId: "discovery"
  };
  assert.deepEqual(playDeterministically(new Game(options)), playDeterministically(new Game(options)));
});

test("goal choices depend on the seed, not the selected profile", () => {
  assert.deepEqual(goalChoices("same-seed"), goalChoices("same-seed"));
  assert.notDeepEqual(goalChoices("same-seed"), goalChoices("different-seed"));
});

test("Observer polarity makes the Observer-side mixed animal more expensive", () => {
  const game = new Game({
    seed: "observer-costs",
    playerProfile: { observer: "Oi", decider: "Di", polarity: "Observer" }
  });
  const costs = animalCosts(game.agentById.player);
  assert.ok(costs.Sleep < costs.Blast, "two saviors should be cheapest");
  assert.ok(costs.Blast < costs.Consume, "balanced-axis demon should cost less than polarized-axis demon");
  assert.ok(costs.Consume < costs.Play, "two demons should be most expensive");
});

test("Decider polarity reverses the two mixed-animal costs", () => {
  const game = new Game({
    seed: "decider-costs",
    playerProfile: { observer: "Oi", decider: "Di", polarity: "Decider" }
  });
  const costs = animalCosts(game.agentById.player);
  assert.ok(costs.Sleep < costs.Consume);
  assert.ok(costs.Consume < costs.Blast, "Observer-side demon should be cheaper on the balanced axis");
  assert.ok(costs.Blast < costs.Play);
});

test("all animal moves remain available under exhaustion and high stress", () => {
  const game = new Game({ seed: "availability" });
  const player = game.agentById.player;
  player.stamina = 0;
  player.stress = 10;
  game.supplies = 0;
  const options = game.getActionOptions();
  assert.deepEqual(options.map((option) => option.animal), ANIMAL_ORDER);
  assert.ok(options.every((option) => option.enabled));
});

test("traffic shocks are keyed to the event rather than policy call order", () => {
  const left = new Game({ seed: "keyed-traffic" });
  const right = new Game({ seed: "keyed-traffic" });
  const leftA = left.trafficRng.next("1:player:survey:0:base:l1a");
  const leftB = left.trafficRng.next("1:a1:payload:0:base:l1b");
  const rightB = right.trafficRng.next("1:a1:payload:0:base:l1b");
  const rightA = right.trafficRng.next("1:player:survey:0:base:l1a");
  assert.equal(leftA, rightA);
  assert.equal(leftB, rightB);
});

test("missing materials lowers Blast utility without locking the action", () => {
  const game = new Game({ seed: "material-aware-blast", originId: "established-network" });
  const blast = game.getActionOptions().find((option) => option.animal === "Blast");
  const fundedScore = game.scoreOption(game.agentById.player, blast);
  game.materials = 0;
  const unfundedBlast = game.getActionOptions().find((option) => option.animal === "Blast");
  assert.equal(unfundedBlast.enabled, true);
  assert.ok(game.scoreOption(game.agentById.player, unfundedBlast) < fundedScore);
});

test("flipping a coin preserves terrain and independently assigned goals", () => {
  const base = {
    seed: "counterfactual",
    scenarioId: "convoy",
    playerGoalId: "economy"
  };
  const oi = new Game({ ...base, playerProfile: { observer: "Oi", decider: "Di", polarity: "Observer" } });
  const oe = new Game({ ...base, playerProfile: { observer: "Oe", decider: "Di", polarity: "Observer" } });
  assert.deepEqual(oi.mountain, oe.mountain);
  assert.deepEqual(oi.agentById.player.goal, oe.agentById.player.goal);
  assert.notDeepEqual(animalCosts(oi.agentById.player), animalCosts(oe.agentById.player));
});

test("terrain, belief, personal mastery, and shared infrastructure stay separate", () => {
  const game = new Game({ seed: "layers" });
  const player = game.agentById.player;
  const consume = game.getActionOptions().find((option) => option.animal === "Consume");
  const edge = game.edgeById[consume.targetEdgeId];
  const riskBefore = edge.trueRisk;
  game.step("Consume");
  assert.ok(player.beliefs[edge.id], "Consume should add a private belief");
  assert.equal(edge.trueRisk, riskBefore, "observing should not rewrite terrain");
  assert.equal(player.mastery[edge.id] || 0, 0, "private discovery should not create personal mastery");
  assert.equal(edge.infrastructure, 0, "private discovery should not create shared infrastructure");
});

test("false-consensus scenario contains sincere but conflicting maps", () => {
  const game = new Game({ seed: "false-consensus", scenarioId: "wrong" });
  const trap = game.edgeById[game.mountain.falseConsensusEdgeId];
  assert.equal(trap.blocked, true);
  const beliefs = game.agents.map((agent) => agent.beliefs[trap.id]).filter(Boolean);
  assert.equal(beliefs.length, 5);
  assert.equal(beliefs.filter((belief) => belief.blocked === false).length, 4);
  assert.equal(beliefs.filter((belief) => belief.blocked === true).length, 1);
});

test("each benchmark scenario completes without opaque or invalid state", () => {
  for (const scenarioId of Object.keys(SCENARIOS)) {
    const summary = autoplay({
      seed: `scenario-${scenarioId}`,
      scenarioId,
      playerProfile: PROFILE_PRESETS[scenarioId.length % PROFILE_PRESETS.length],
      playerGoalId: "safety"
    });
    assert.equal(typeof summary.success, "boolean");
    assert.ok(summary.rounds > 0 && summary.rounds <= 32);
    assert.ok(Number.isFinite(summary.playerStress));
    assert.ok(summary.arrived >= 0 && summary.arrived <= 5);
  }
});

test("scenario matrix produces multiple outcome signatures", () => {
  const signatures = new Set();
  for (const scenarioId of Object.keys(SCENARIOS)) {
    for (const profile of PROFILE_PRESETS) {
      const summary = autoplay({
        seed: `matrix-${scenarioId}`,
        scenarioId,
        playerProfile: profile,
        playerGoalId: "solidarity"
      });
      signatures.add(`${summary.success}:${summary.arrived}:${summary.deliveredSupplies}:${Math.round(summary.playerStress)}`);
    }
  }
  assert.ok(signatures.size >= 5, "different terrain and coin configurations should not collapse to one outcome");
});

test("default expedition exposes a bidirectional logistics graph and declared traffic demands", () => {
  const snapshot = new Game({ seed: "logistics-contract" }).snapshot();
  assert.ok(Math.max(...snapshot.mountain.nodes.map((node) => node.level)) >= 8);
  assert.ok(snapshot.mountain.edges.some((edge) => edge.bidirectional));
  assert.ok(snapshot.trafficDemands.length >= 3);
  for (const demand of snapshot.trafficDemands) {
    assert.equal(typeof demand.source, "string");
    assert.equal(typeof demand.destination, "string");
    assert.ok(demand.subject && demand.subject.kind && demand.subject.id);
    assert.ok(Number.isFinite(demand.priority));
    assert.ok(Number.isFinite(demand.deadline));
    assert.equal(typeof demand.completed, "boolean");
    assert.ok(Number.isFinite(demand.value));
  }
});

test("destination demands are explicit and independent from terrain and agent configuration", () => {
  const privatePractice = new Game({
    seed: "destination-independence",
    scenarioId: "melting",
    destinationId: "health-practice",
    originId: "fresh-start",
    playerProfile: PROFILE_PRESETS[3],
    playerGoalId: "safety"
  });
  const evidenceExpansion = new Game({
    seed: "destination-independence",
    scenarioId: "melting",
    destinationId: "research-frontier",
    originId: "fresh-start",
    playerProfile: PROFILE_PRESETS[3],
    playerGoalId: "safety"
  });
  const dimensions = [
    "privateDiscovery",
    "privateRepeatability",
    "sharedExploration",
    "sharedStandardization",
    "repeatedTraffic",
    "feedbackLatency",
    "costOfError"
  ];
  assert.ok(Object.keys(DESTINATION_PROFILES).length >= 4);
  for (const destination of Object.values(DESTINATION_PROFILES)) {
    assert.ok(dimensions.every((dimension) => Number.isFinite(destination.demands[dimension])));
    assert.equal(destination.animal, undefined, "domain presets must not encode an animal assignment");
    assert.equal(destination.preferredAnimal, undefined, "domain presets must not encode a preferred animal");
  }
  assert.deepEqual(privatePractice.mountain, evidenceExpansion.mountain);
  assert.deepEqual(privatePractice.scenario, evidenceExpansion.scenario);
  assert.deepEqual(privatePractice.origin, evidenceExpansion.origin);
  assert.deepEqual(privatePractice.agentById.player.profile, evidenceExpansion.agentById.player.profile);
  assert.deepEqual(privatePractice.agentById.player.goal, evidenceExpansion.agentById.player.goal);
  assert.notDeepEqual(privatePractice.destination, evidenceExpansion.destination);
  assert.notDeepEqual(privatePractice.trafficDemands, evidenceExpansion.trafficDemands);
});

test("live bottlenecks use visible beliefs rather than hidden terrain truth", () => {
  const original = new Game({ seed: "visible-bottleneck", destinationId: "judgment-calibration", scenarioId: "uncharted" });
  const alteredTruth = new Game({ seed: "visible-bottleneck", destinationId: "judgment-calibration", scenarioId: "uncharted" });
  alteredTruth.mountain.edges.forEach((edge) => {
    edge.trueRisk = edge.trueRisk > 0.5 ? 0.05 : 0.95;
    edge.blocked = !edge.blocked;
  });
  assert.deepEqual(alteredTruth.currentBottlenecks(), original.currentBottlenecks());
});

test("terrain and origin expose independent causal controls", () => {
  const sparse = new Game({
    seed: "factor-independence",
    scenarioId: "custom",
    customScenario: { uncertainty: 0.8, volatility: 0.15, branching: 0.25, observability: 0.35, interdependence: 0.4, routeRecurrence: 0.3 },
    destinationId: "production-system",
    originId: "fresh-start"
  });
  const established = new Game({
    seed: "factor-independence",
    scenarioId: "custom",
    customScenario: { uncertainty: 0.8, volatility: 0.15, branching: 0.25, observability: 0.35, interdependence: 0.4, routeRecurrence: 0.3 },
    destinationId: "production-system",
    originId: "established-network"
  });
  const branched = new Game({
    seed: "factor-independence",
    scenarioId: "custom",
    customScenario: { uncertainty: 0.8, volatility: 0.15, branching: 0.95, observability: 0.9, interdependence: 0.4, routeRecurrence: 0.8 },
    destinationId: "production-system",
    originId: "fresh-start"
  });
  const terrainDimensions = ["uncertainty", "volatility", "branching", "observability", "interdependence", "routeRecurrence"];
  const originDimensions = ["priorEvidence", "initialMastery", "sharedInfrastructure", "agentDistribution", "resources", "startingProximity"];
  assert.ok(terrainDimensions.every((dimension) => Number.isFinite(sparse.scenario[dimension])));
  assert.ok(Object.keys(ORIGIN_PROFILES).length >= 4);
  assert.ok(Object.values(ORIGIN_PROFILES).every((origin) => originDimensions.every((dimension) => Number.isFinite(origin.state[dimension]))));
  assert.deepEqual(ORIGIN_PROFILES["lucky-route"].state, ORIGIN_PROFILES["sampled-route"].state, "luck counterfactuals must preserve origin resources and capability");

  const terrainTruth = (game) => game.mountain.edges.map((edge) => ({ id: edge.id, from: edge.from, to: edge.to, trueCost: edge.trueCost, trueRisk: edge.trueRisk, volatility: edge.volatility, blocked: edge.blocked }));
  assert.deepEqual(terrainTruth(sparse), terrainTruth(established), "origin must not regenerate hidden terrain");
  assert.deepEqual(sparse.destination, established.destination);
  assert.notDeepEqual(sparse.origin, established.origin);
  assert.ok(Object.keys(established.agentById.player.beliefs).length > Object.keys(sparse.agentById.player.beliefs).length);
  assert.ok(Object.values(established.agentById.player.mastery).reduce((sum, value) => sum + value, 0) > 0);
  assert.ok(established.mountain.edges.some((edge) => edge.infrastructure > 0));
  assert.ok(established.materials > sparse.materials);
  assert.notDeepEqual(established.agents.map((agent) => agent.position), sparse.agents.map((agent) => agent.position));

  assert.deepEqual(sparse.destination, branched.destination, "terrain must not rewrite destination demand");
  assert.deepEqual(sparse.origin, branched.origin, "terrain must not rewrite origin");
  assert.notEqual(sparse.mountain.edges.length, branched.mountain.edges.length, "branching must alter available topology");
});

test("current evidence state varies independently from destination terrain and origin", () => {
  const common = { seed: "evidence-independence", scenarioId: "uncharted", destinationId: "research-frontier", originId: "fresh-start" };
  const sparse = new Game({ ...common, evidenceStateId: "sparse" });
  const verified = new Game({ ...common, evidenceStateId: "verified" });
  assert.deepEqual(sparse.destination, verified.destination);
  assert.deepEqual(sparse.scenario, verified.scenario);
  assert.deepEqual(sparse.origin, verified.origin);
  assert.notDeepEqual(sparse.evidenceState, verified.evidenceState);
  assert.ok(Object.keys(verified.agentById.player.beliefs).length > Object.keys(sparse.agentById.player.beliefs).length);
  assert.deepEqual(new Set(Object.keys(EVIDENCE_STATE_PROFILES)), new Set(["inherited", "sparse", "verified"]));
});

test("worked cells distinguish rational Oe-first and immediate-Oi openings", () => {
  const sparseEvidence = new Game({
    seed: "rational-oe-first",
    scenarioId: "uncharted",
    destinationId: "research-frontier",
    originId: "fresh-start"
  });
  const establishedPractice = new Game({
    seed: "rational-immediate-oi",
    scenarioId: "convoy",
    destinationId: "production-system",
    originId: "established-network"
  });
  const ranked = (game) => game.getActionOptions().slice().sort((left, right) => right.exAnteValue - left.exAnteValue);
  const sparseRanked = ranked(sparseEvidence);
  const establishedRanked = ranked(establishedPractice);
  assert.ok(["Consume", "Play"].includes(sparseRanked[0].animal), "missing evidence should make a relevant Oe operation rational first");
  assert.ok(sparseRanked[0].exAnteValue > Math.max(...sparseRanked.filter((option) => option.observer === "Oi").map((option) => option.exAnteValue)));
  assert.ok(["Sleep", "Blast"].includes(establishedRanked[0].animal), "known recurrent production should make a relevant Oi investment rational immediately");
  assert.ok(establishedRanked[0].exAnteValue > Math.max(...establishedRanked.filter((option) => option.observer === "Oe").map((option) => option.exAnteValue)));
  assert.ok(sparseEvidence.currentBottlenecks()[0].score > 0);
  assert.ok(establishedPractice.currentBottlenecks()[0].score > 0);

  const firstThenAdaptive = (firstAnimal) => {
    const game = new Game({
      seed: "oi-outcome-1",
      scenarioId: "convoy",
      destinationId: "production-system",
      originId: "established-network",
      evidenceStateId: "verified"
    });
    const summary = autoplay({
      game,
      playerPolicy: (activeGame) => activeGame.round === 0
        ? firstAnimal
        : activeGame.chooseAutonomousAction(activeGame.agentById.player).animal
    });
    return { summary, weather: game.timeline.map((entry) => entry.weather) };
  };
  const immediateBlast = firstThenAdaptive("Blast");
  const additionalScouting = firstThenAdaptive("Play");
  assert.deepEqual(immediateBlast.weather, additionalScouting.weather, "operation RNG must not change exogenous weather");
  assert.ok(immediateBlast.summary.destinationOutcomeScore > additionalScouting.summary.destinationOutcomeScore);
  assert.ok(immediateBlast.summary.playerSharedInfrastructureUses > additionalScouting.summary.playerSharedInfrastructureUses);
});

test("demand parameters can change a domain preset's useful sequence and consequences", () => {
  const evidenceHeavy = new Game({
    seed: "domain-override",
    scenarioId: "uncharted",
    destinationId: "health-practice",
    destinationDemands: { privateDiscovery: 1, privateRepeatability: 0.1, sharedExploration: 0.2, sharedStandardization: 0.1 },
    originId: "informed-base"
  });
  const practiceHeavy = new Game({
    seed: "domain-override",
    scenarioId: "uncharted",
    destinationId: "health-practice",
    destinationDemands: { privateDiscovery: 0.05, privateRepeatability: 1, sharedExploration: 0.05, sharedStandardization: 0.05, repeatedTraffic: 1 },
    originId: "informed-base"
  });
  const best = (game) => game.getActionOptions().slice().sort((left, right) => right.exAnteValue - left.exAnteValue)[0];
  assert.equal(best(evidenceHeavy).animal, "Consume");
  assert.equal(best(practiceHeavy).animal, "Sleep");
  assert.deepEqual(evidenceHeavy.origin, practiceHeavy.origin, "demand overrides should be the only changed causal input");
  assert.equal(evidenceHeavy.destination.id, practiceHeavy.destination.id, "the same domain label should support different explicit demands");

  const stableTerrain = { uncertainty: 0.5, volatility: 0, branching: 0.5, observability: 0.5, interdependence: 0.5, routeRecurrence: 0.5 };
  const lowError = new Game({ seed: "error-cost", scenarioId: "custom", customScenario: stableTerrain, destinationDemands: { costOfError: 0 }, roundLimit: 1 });
  const highError = new Game({ seed: "error-cost", scenarioId: "custom", customScenario: stableTerrain, destinationDemands: { costOfError: 1 }, roundLimit: 1 });
  for (const game of [lowError, highError]) {
    const player = game.agentById.player;
    player.stress = 0;
    const demand = game.trafficDemands.find((candidate) => candidate.assignedAgentId === "player");
    const target = game.connectedEdges(player.position)[0];
    game.connectedEdges(player.position).forEach((edge) => {
      player.beliefs[edge.id] = { known: true, estimatedCost: 1, estimatedRisk: 0, blocked: edge.id !== target.id, confidence: 1, lastObserved: 0 };
    });
    target.blocked = true;
    demand.destination = game.otherNode(target, player.position);
    demand.stops = [demand.destination];
    game.updateMovementIntents();
    game.trafficRng.next = () => 0;
    game.step("Sleep");
  }
  assert.ok(highError.agentById.player.stress > lowError.agentById.player.stress);

  const slowFeedback = new Game({ destinationId: "wisdom-stewardship" });
  const fastFeedback = new Game({ destinationId: "production-system" });
  assert.ok(slowFeedback.trafficDemands[0].feedbackDelay > fastFeedback.trafficDemands[0].feedbackDelay);
});

test("animal operation and logistics traffic are separate timeline phases", () => {
  const game = new Game({ seed: "separate-phases" });
  const before = game.snapshot();
  const after = game.step("Consume");
  const entry = after.timeline.at(-1);
  assert.equal(entry.operations.length, 5);
  assert.ok(entry.traffic.length > 0);
  assert.equal(entry.operations[0].animal, "Consume");
  assert.equal(before.round + 1, after.round);
  assert.ok(entry.traffic.every((event) => event.intent && event.from && event.to));
  assert.ok(after.agents.every((agent) => !agent.movementIntent || agent.movementIntent.from === agent.position));
});

test("repeated traffic realizes delayed personal and shared pathway returns", () => {
  const sleep = autoplay({ seed: "delayed-personal", playerPolicy: "Sleep" });
  const blast = autoplay({ seed: "delayed-shared", playerPolicy: "Blast" });
  assert.ok(sleep.repeatTraversals > 0);
  assert.ok(sleep.personalMasteryUses > 0, "later player traffic should reuse Sleep mastery");
  assert.ok(blast.sharedInfrastructureUses > 0, "later followers or payload should reuse Blast infrastructure");
});

test("delayed pathway returns can repay their operation cost on a worked logistics seed", () => {
  const sleep = autoplay({ seed: "demand-payoff-34", playerPolicy: "Sleep" });
  const consume = autoplay({ seed: "demand-payoff-34", playerPolicy: "Consume" });
  const blast = autoplay({ seed: "demand-payoff-34", playerPolicy: "Blast" });
  const play = autoplay({ seed: "demand-payoff-34", playerPolicy: "Play" });
  assert.ok(sleep.completedDemands > consume.completedDemands, "personal consolidation should repay through the survey return loop");
  assert.ok(blast.rounds < play.rounds, "shared infrastructure should repay through later follower and payload traffic");
});

test("pathway investment has no realized return without later traffic", () => {
  const sleep = autoplay({ game: new Game({ seed: "unused-sleep", roundLimit: 1 }), playerPolicy: "Sleep" });
  const blast = autoplay({ game: new Game({ seed: "unused-blast", roundLimit: 1 }), playerPolicy: "Blast" });
  assert.equal(sleep.personalMasteryUses, 0);
  assert.equal(blast.playerSharedInfrastructureUses, 0);
});

test("blocked terrain cannot be crossed even at the minimum probability", () => {
  const game = new Game({
    seed: "blocked-is-blocked",
    roundLimit: 1,
    scenarioId: "custom",
    customScenario: { uncertainty: 0, volatility: 0, interdependence: 0, disagreement: 0 }
  });
  const player = game.agentById.player;
  const demand = game.trafficDemands.find((candidate) => candidate.assignedAgentId === player.id);
  const target = game.connectedEdges("base")[0];
  game.connectedEdges("base").forEach((edge) => {
    player.beliefs[edge.id] = { known: true, estimatedCost: 1, estimatedRisk: 0, blocked: edge.id !== target.id, confidence: 1, lastObserved: 0 };
  });
  target.blocked = true;
  demand.destination = game.otherNode(target, "base");
  demand.stops = [demand.destination];
  game.updateMovementIntents();
  game.trafficRng.next = () => 0;
  game.step("Sleep");
  assert.equal(player.position, "base");
});

test("Sleep and Blast capacity matures after same-round traffic", () => {
  const sleepGame = new Game({ seed: "pending-sleep" });
  const sleepEdgeId = sleepGame.getActionOptions().find((option) => option.animal === "Sleep").targetEdgeId;
  sleepGame.step("Sleep");
  assert.equal(sleepGame.agentById.player.mastery[sleepEdgeId] || 0, 0);
  assert.ok(sleepGame.agentById.player.pendingMastery[sleepEdgeId] > 0);
  sleepGame.step("Sleep");
  assert.ok(sleepGame.agentById.player.mastery[sleepEdgeId] > 0);

  const blastGame = new Game({ seed: "pending-blast" });
  const blastEdgeId = blastGame.getActionOptions().find((option) => option.animal === "Blast").targetEdgeId;
  blastGame.step("Blast");
  assert.equal(blastGame.edgeById[blastEdgeId].infrastructure, 0);
  assert.ok(blastGame.edgeById[blastEdgeId].pendingInfrastructure.player > 0);
  blastGame.step("Blast");
  assert.ok(blastGame.edgeById[blastEdgeId].infrastructure > 0);
});

test("the first next-round traversal attributes matured Sleep and Blast returns", () => {
  const sleepGame = new Game({ seed: "quality-sleep-1" });
  sleepGame.step("Sleep");
  const sleepRoundTwo = sleepGame.step("Sleep");
  const masteryEvent = sleepRoundTwo.timeline.at(-1).traffic.find((event) => event.agentId === "player");
  assert.equal(masteryEvent.success, true);
  assert.equal(masteryEvent.masteryUsed, true);

  const blastGame = new Game({ seed: "quality-blast-0" });
  blastGame.step("Blast");
  const blastRoundTwo = blastGame.step("Blast");
  const sharedEvent = blastRoundTwo.timeline.at(-1).traffic.find((event) => event.agentId !== "player" && event.infrastructureBuilderIds.includes("player"));
  assert.ok(sharedEvent, "another agent should receive the player's matured Blast capacity on round two");
  assert.equal(sharedEvent.sharedInfrastructureUsed, true);
});

test("Play requires another agent to create joint evidence", () => {
  const game = new Game({ seed: "solitary-play" });
  game.agents.slice(1).forEach((agent, index) => { agent.position = `l1${String.fromCharCode(97 + index % 3)}`; });
  const playerDemand = game.trafficDemands.find((demand) => demand.assignedAgentId === "player");
  playerDemand.status = "queued";
  playerDemand.releaseRound = 99;
  game.updateMovementIntents();
  const play = game.getActionOptions().find((option) => option.animal === "Play");
  assert.equal(play.partnerId, null);
  assert.equal(game.agentById.player.beliefs[play.targetEdgeId], undefined);
  game.step("Play");
  assert.equal(game.agentById.player.beliefs[play.targetEdgeId], undefined);
});

test("Blast returns are attributed to the player's later shared pathway use", () => {
  const summary = autoplay({ seed: "delayed-shared", playerPolicy: "Blast" });
  assert.ok(summary.playerSharedInfrastructureUses > 0);
});

test("per-builder infrastructure ownership stays normalized to surviving capacity", () => {
  const game = new Game({ seed: "multi-2", scenarioId: "melting" });
  autoplay({ game, playerPolicy: "Blast" });
  for (const edge of game.mountain.edges) {
    const attributed = Object.values(edge.infrastructureContributions).reduce((total, value) => total + value, 0);
    assert.ok(Math.abs(attributed - edge.infrastructure) <= 0.02, `${edge.id} ownership ${attributed} should match capacity ${edge.infrastructure}`);
  }
});

test("summary is observational and cannot freeze future checkpoints", () => {
  const game = new Game({ seed: "summary-purity" });
  const earlySummary = game.summary();
  assert.deepEqual(Object.values(earlySummary.checkpoints).map((checkpoint) => checkpoint.round), [0, 0, 0]);
  const completed = autoplay({ game, playerPolicy: "Adaptive" });
  const control = autoplay({ seed: "summary-purity", playerPolicy: "Adaptive" });
  assert.deepEqual(completed.checkpoints, control.checkpoints);
  assert.ok(completed.checkpoints.early.round > 0);
});

test("custom scenarios preserve valid zero-valued controls", () => {
  const game = new Game({
    scenarioId: "custom",
    customScenario: { uncertainty: 0, volatility: 0, interdependence: 0, disagreement: 0 }
  });
  assert.deepEqual(
    [game.scenario.uncertainty, game.scenario.volatility, game.scenario.interdependence, game.scenario.disagreement],
    [0, 0, 0, 0]
  );
});

test("early middle and final horizon checkpoints are public and deterministic", () => {
  const options = { seed: "horizon-checkpoints", playerPolicy: "Adaptive" };
  const first = autoplay(options);
  const second = autoplay(options);
  assert.deepEqual(first.checkpoints, second.checkpoints);
  assert.deepEqual(Object.keys(first.checkpoints), ["early", "middle", "final"]);
  for (const checkpoint of Object.values(first.checkpoints)) {
    for (const metric of ["frontierEvidence", "progress", "routeReliability", "repeatTraversals", "members", "payloadThroughput", "stress", "stamina", "stranding"]) {
      assert.equal(typeof checkpoint[metric], "number", `checkpoint should report ${metric}`);
    }
  }
});

process.on("exit", () => {
  if (!process.exitCode) process.stdout.write(`\n${passed} Pathways engine tests passed.\n`);
});
