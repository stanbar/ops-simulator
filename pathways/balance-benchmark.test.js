const assert = require("node:assert/strict");
const {
  BALANCE_ENVELOPE,
  FIXED_COHORT,
  CONDITIONAL_CELL_DEFINITIONS,
  HORIZON_POLICY_NAMES,
  MATERIAL_DIVERGENCE,
  POLICY_NAMES,
  PROTOTYPE_BALANCE_ENVELOPE,
  PURE_POLICIES,
  evaluateBalance,
  formatReport,
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
  assert.equal(FIXED_COHORT.length, 45);
  assert.equal(new Set(FIXED_COHORT.map((run) => run.id)).size, FIXED_COHORT.length);
  assert.deepEqual(new Set(FIXED_COHORT.map((run) => run.destinationId)), new Set(CONDITIONAL_CELL_DEFINITIONS.map((cell) => cell.destinationId)));
  assert.deepEqual(new Set(FIXED_COHORT.map((run) => run.originId)), new Set(CONDITIONAL_CELL_DEFINITIONS.map((cell) => cell.originId)));
  assert.ok(FIXED_COHORT.every((run) => run.cellId && run.destinationId && run.originId && run.evidenceStateId));
});

test("benchmark reports every policy and required expedition metric", () => {
  const report = runBenchmark({ cohort: FIXED_COHORT.slice(0, 8) });
  assert.deepEqual(Object.keys(report.policies), POLICY_NAMES);
  for (const policy of POLICY_NAMES) {
    const result = report.policies[policy];
    assert.equal(result.runs, 8);
    assert.equal(typeof result.successRate, "number");
    for (const metric of ["arrived", "deliveredSupplies", "reliableEdges", "stranded", "playerStress", "playerStamina", "rounds", "repeatTraversals", "personalMasteryUses", "sharedInfrastructureUses", "playerSharedInfrastructureUses", "completedDemands", "payloadThroughput", "playerDecisionQuality", "destinationOutcomeScore"]) {
      assert.equal(typeof result.averages[metric], "number", `${policy} should report ${metric}`);
    }
    assert.deepEqual(Object.keys(result.horizons), ["early", "middle", "final"]);
    assert.equal(typeof result.horizons.early.averages.frontierEvidence, "number");
    assert.equal(typeof result.dominantFailureReason, "string");
  }
});

test("benchmark makes conditional cells primary across destination terrain origin horizon and policy", () => {
  const cohort = FIXED_COHORT.slice(0, 10);
  const report = runBenchmark({ cohort });
  assert.equal(report.aggregateIsSecondary, true);
  assert.ok(Object.keys(report.conditionalCells).length >= 2);
  for (const cell of Object.values(report.conditionalCells)) {
    assert.ok(cell.dimensions.destinationId);
    assert.ok(cell.dimensions.terrainId);
    assert.ok(cell.dimensions.originId);
    assert.ok(cell.dimensions.evidenceStateId);
    assert.ok(cell.dimensions.horizonRounds);
    assert.deepEqual(Object.keys(cell.policies), POLICY_NAMES);
    assert.deepEqual(Object.keys(cell.policies.Sleep.horizons), ["early", "middle", "final"]);
  }
});

test("route-lottery diagnostics separate favorable outcomes from policy robustness", () => {
  const lottery = FIXED_COHORT.filter((run) => run.originId === "lucky-route");
  const report = runBenchmark({ cohort: lottery });
  assert.ok(report.luckDiagnostics.length > 0);
  assert.ok(report.luckDiagnostics.some((entry) => entry.success && entry.favorableRoute && entry.luckyOutcomeLift > 0.05 && entry.policyRobustness < entry.outcomeScore));
  assert.ok(report.luckDiagnostics.some((entry) => entry.success && entry.favorableRoute && entry.decisionQuality < 0.2), "a favorable route can produce success from a weak ex-ante policy");
  assert.ok(report.luckDiagnostics.every((entry) => typeof entry.counterfactualSuccessRate === "number"));
  assert.ok(report.luckDiagnostics.every((entry) => typeof entry.counterfactualOutcomeScore === "number"));
  const adaptiveRobustness = report.luckDiagnostics.filter((entry) => entry.policy === "Adaptive").map((entry) => entry.policyRobustness);
  assert.ok(new Set(adaptiveRobustness).size > 1, "same-state route robustness should remain paired to each hidden mountain");
});

test("text report includes every policy and horizon inside each conditional cell", () => {
  const report = runBenchmark({ cohort: FIXED_COHORT.slice(0, 5) });
  const output = formatReport(report);
  POLICY_NAMES.forEach((policy) => assert.match(output, new RegExp(`  ${policy}:`)));
  for (const marker of ["E progress", "M progress", "F progress"]) assert.match(output, new RegExp(marker));
});

test("benchmark varies evidence state while destination terrain and origin stay fixed", () => {
  const paired = FIXED_COHORT.filter((run) => ["shared-production", "production-evidence-sparse"].includes(run.cellId));
  const report = runBenchmark({ cohort: paired });
  const verified = report.conditionalCells["shared-production"];
  const sparse = report.conditionalCells["production-evidence-sparse"];
  assert.deepEqual(
    [verified.dimensions.destinationId, verified.dimensions.terrainId, verified.dimensions.originId],
    [sparse.dimensions.destinationId, sparse.dimensions.terrainId, sparse.dimensions.originId]
  );
  assert.notEqual(verified.dimensions.evidenceStateId, sparse.dimensions.evidenceStateId);
  assert.notEqual(verified.policies.Consume.horizons.early.averages.frontierEvidence, sparse.policies.Consume.horizons.early.averages.frontierEvidence);
});

test("conditional cells reward the operation matching the active bottleneck", () => {
  const report = runBenchmark();
  const research = report.conditionalCells["sparse-research"].policies;
  assert.ok(research.Consume.horizons.early.averages.frontierEvidence > research.Sleep.horizons.early.averages.frontierEvidence);
  assert.ok(research.Consume.averages.playerDecisionQuality > research.Sleep.averages.playerDecisionQuality);
  assert.ok(research.Consume.averages.destinationOutcomeScore > research.Sleep.averages.destinationOutcomeScore);
  assert.ok(research.Consume.averages.destinationOutcomeScore > research.Blast.averages.destinationOutcomeScore);

  const practice = report.conditionalCells["private-practice"].policies;
  assert.ok(practice.Sleep.averages.personalMasteryUses > practice.Consume.averages.personalMasteryUses);
  assert.ok(practice.Sleep.averages.destinationOutcomeScore > practice.Consume.averages.destinationOutcomeScore);

  const production = report.conditionalCells["shared-production"].policies;
  assert.ok(production.Blast.averages.playerSharedInfrastructureUses > production.Sleep.averages.playerSharedInfrastructureUses);
  assert.ok(production.Blast.averages.playerDecisionQuality > production.Play.averages.playerDecisionQuality);

  const social = report.conditionalCells["sparse-social"].policies;
  assert.ok(social.Play.successRate >= social.Sleep.successRate);
  assert.ok(social.Play.averages.destinationOutcomeScore > social.Consume.averages.destinationOutcomeScore);
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
