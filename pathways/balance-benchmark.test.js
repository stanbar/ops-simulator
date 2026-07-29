const assert = require("node:assert/strict");
const {
  BALANCE_ENVELOPE,
  FIXED_COHORT,
  MATERIAL_DIVERGENCE,
  POLICY_NAMES,
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
  assert.equal(FIXED_COHORT.length, 160);
  assert.equal(new Set(FIXED_COHORT.map((run) => run.id)).size, FIXED_COHORT.length);
});

test("benchmark reports every policy and required expedition metric", () => {
  const report = runBenchmark({ cohort: FIXED_COHORT.slice(0, 8) });
  assert.deepEqual(Object.keys(report.policies), POLICY_NAMES);
  for (const policy of POLICY_NAMES) {
    const result = report.policies[policy];
    assert.equal(result.runs, 8);
    assert.equal(typeof result.successRate, "number");
    for (const metric of ["arrived", "deliveredSupplies", "reliableEdges", "stranded", "playerStress", "playerStamina", "rounds"]) {
      assert.equal(typeof result.averages[metric], "number", `${policy} should report ${metric}`);
    }
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
  assert.equal(report.agency.totalPairs, cohort.length * 10);
  assert.equal(report.agency.byPair.length, 10);
  assert.equal(report.agency.caseCount, cohort.length);
  assert.equal(report.agency.definition.stressDelta, MATERIAL_DIVERGENCE.stressDelta);
});

test("repeating a cohort produces an identical report", () => {
  const cohort = FIXED_COHORT.slice(0, 12);
  assert.deepEqual(runBenchmark({ cohort }), runBenchmark({ cohort }));
});

test("prototype remains recorded as failing the future balance envelope", () => {
  const report = runBenchmark();
  assert.deepEqual(report.balance.envelope, BALANCE_ENVELOPE);
  assert.equal(report.balance.passes, false);
  assert.ok(report.balance.violations.length > 0);
});

process.on("exit", () => {
  if (!process.exitCode) process.stdout.write(`\n${passed} balance benchmark tests passed.\n`);
});
