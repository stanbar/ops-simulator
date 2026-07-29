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
  assert.ok((player.mastery[edge.id] || 0) > 0, "Consume should add a small amount of personal mastery");
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
    assert.ok(summary.rounds > 0 && summary.rounds <= 12);
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

process.on("exit", () => {
  if (!process.exitCode) process.stdout.write(`\n${passed} Pathways engine tests passed.\n`);
});
