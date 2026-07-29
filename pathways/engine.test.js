const assert = require("node:assert/strict");
const {
  ANIMAL_ORDER,
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
  const sleep = autoplay({ seed: "aligned-payoff-2", playerPolicy: "Sleep" });
  const consume = autoplay({ seed: "aligned-payoff-2", playerPolicy: "Consume" });
  const blast = autoplay({ seed: "aligned-payoff-2", playerPolicy: "Blast" });
  const play = autoplay({ seed: "aligned-payoff-2", playerPolicy: "Play" });
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
  game.rng.next = () => 0;
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
  const sleepGame = new Game({ seed: "first-return-4" });
  sleepGame.step("Sleep");
  const sleepRoundTwo = sleepGame.step("Sleep");
  const masteryEvent = sleepRoundTwo.timeline.at(-1).traffic.find((event) => event.agentId === "player");
  assert.equal(masteryEvent.success, true);
  assert.equal(masteryEvent.masteryUsed, true);

  const blastGame = new Game({ seed: "first-blast-0" });
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
