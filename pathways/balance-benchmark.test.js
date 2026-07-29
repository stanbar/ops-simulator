const assert = require("node:assert/strict");
const {
  BALANCE_ENVELOPE,
  FIXED_COHORT,
  HORIZON_POLICY_NAMES,
  MATERIAL_DIVERGENCE,
  POLICY_NAMES,
  PROTOTYPE_BALANCE_ENVELOPE,
  PURE_POLICIES,
  evaluateBalance,
  materiallyDiverges,
  runBenchmark
} = require("./balance-benchmark.js");

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

test("fixed cohort covers every scenario, controlled goal, and representative profile", () => {
  assert.deepEqual(new Set(FIXED_COHORT.map((run) => run.scenarioId)), new Set(["uncharted", "melting", "convoy", "wrong"]));
  assert.deepEqual(new Set(FIXED_COHORT.map((run) => run.playerGoalId)), new Set(["speed", "safety", "discovery", "solidarity", "economy"]));
  assert.deepEqual(new Set(FIXED_COHORT.map((run) => run.playerProfile.id)), new Set([
    "oi-di-observer",
    "oe-di-decider",
    "oi-de-decider",
    "oe-de-observer"
  ]));
  assert.equal(FIXED_COHORT.length, 40);
  assert.equal(new Set(FIXED_COHORT.map((run) => run.id)).size, FIXED_COHORT.length);
});

test("benchmark reports every policy and required expedition metric", () => {
  const report = runBenchmark({ cohort: FIXED_COHORT.slice(0, 8) });
  assert.deepEqual(Object.keys(report.policies), POLICY_NAMES);
  for (const policy of POLICY_NAMES) {
    const result = report.policies[policy];
    assert.equal(result.runs, 8);
    assert.equal(typeof result.successRate, "number");
    for (const metric of ["arrived", "deliveredSupplies", "reliableEdges", "stranded", "playerStress", "playerStamina", "rounds", "repeatTraversals", "personalMasteryUses", "sharedInfrastructureUses", "playerSharedInfrastructureUses", "completedDemands", "payloadThroughput"]) {
      assert.equal(typeof result.averages[metric], "number", `${policy} should report ${metric}`);
    }
    assert.deepEqual(Object.keys(result.horizons), ["early", "middle", "final"]);
    assert.equal(typeof result.horizons.early.averages.frontierEvidence, "number");
    assert.equal(typeof result.dominantFailureReason, "string");
  }
});

test("material divergence uses the ticket's observable outcome boundary", () => {
  const baseline = {
    success: false,
    arrived: 2,
    deliveredSupplies: 2,
    reliableEdges: 0,
    stranded: 0,
    playerStress: 4
  };
  assert.equal(materiallyDiverges(baseline, { ...baseline, success: true }), true);
  assert.equal(materiallyDiverges(baseline, { ...baseline, arrived: 3 }), true);
  assert.equal(materiallyDiverges(baseline, { ...baseline, deliveredSupplies: 3 }), true);
  assert.equal(materiallyDiverges(baseline, { ...baseline, reliableEdges: 1 }), true);
  assert.equal(materiallyDiverges(baseline, { ...baseline, stranded: 1 }), true);
  assert.equal(materiallyDiverges(baseline, { ...baseline, playerStress: baseline.playerStress + MATERIAL_DIVERGENCE.stressDelta }), true);
  assert.equal(materiallyDiverges(baseline, { ...baseline, playerStress: baseline.playerStress + MATERIAL_DIVERGENCE.stressDelta - 0.01 }), false);
});

test("paired agency comparisons vary policy over identical expedition cases", () => {
  const cohort = FIXED_COHORT.slice(0, 3);
  const report = runBenchmark({ cohort });
  const pairCount = POLICY_NAMES.length * (POLICY_NAMES.length - 1) / 2;
  assert.equal(report.agency.totalPairs, cohort.length * pairCount);
  assert.equal(report.agency.byPair.length, pairCount);
  assert.equal(report.agency.caseCount, cohort.length);
  assert.equal(report.agency.definition.stressDelta, MATERIAL_DIVERGENCE.stressDelta);
});

test("repeating a cohort produces an identical report", () => {
  const cohort = FIXED_COHORT.slice(0, 12);
  assert.deepEqual(runBenchmark({ cohort }), runBenchmark({ cohort }));
});

test("horizon policies are included without turning the prototype envelope into a gate", () => {
  const report = runBenchmark({ cohort: FIXED_COHORT.slice(0, 4) });
  assert.ok(HORIZON_POLICY_NAMES.every((policy) => POLICY_NAMES.includes(policy)));
  assert.deepEqual(report.historicalPrototypeBalance.envelope, PROTOTYPE_BALANCE_ENVELOPE);
  assert.equal(report.historicalPrototypeBalance.gatesCurrentRun, false);
  assert.equal(report.historicalPrototypeBalance.status, "superseded");
  assert.equal(report.balance.gatesCurrentRun, false);
  assert.equal(report.balance.status, "superseded");
  assert.deepEqual(report.balance.envelope, PROTOTYPE_BALANCE_ENVELOPE);
  assert.ok(report.agency.controlledVariables.includes("traffic demands"));
});

test("historical benchmark exports remain available to existing callers", () => {
  assert.equal(BALANCE_ENVELOPE, PROTOTYPE_BALANCE_ENVELOPE);
  assert.deepEqual(PURE_POLICIES, ["Sleep", "Consume", "Blast", "Play"]);
  assert.equal(typeof evaluateBalance, "function");
});

process.on("exit", () => {
  if (!process.exitCode) process.stdout.write(`\n${passed} balance benchmark tests passed.\n`);
});
