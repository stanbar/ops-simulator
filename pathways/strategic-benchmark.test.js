const assert = require("assert");
const Engine = require("./campaignEngine");
const Benchmark = require("./strategic-benchmark");

console.log("Running Pathways Strategic Benchmark tests...");

{
  const options = {
    seed: 42,
    origin: "balanced-starter",
    mission: "entrepreneurship",
    shockSchedule: "crisis-cascade",
    horizon: 12,
    turns: 12
  };
  const policies = [
    { name: "Acquire", decide(snapshot) {
      const action = { type: "acquire", targetDomain: "livelihood-money" };
      return Engine.previewAction(snapshot, action).affordable ? [action] : [];
    } },
    { name: "Maintain", decide(snapshot) {
      const action = { type: "maintain", targetDomain: "body-health" };
      return Engine.previewAction(snapshot, action).affordable ? [action] : [];
    } }
  ];
  const replay = Engine.runCounterfactualReplay(options, policies);
  assert.strictEqual(replay.policies.length, 2);
  assert.deepStrictEqual(replay.policies[0].shockSignature, replay.policies[1].shockSignature);
  assert.notDeepStrictEqual(replay.policies[0].snapshot.domains, replay.policies[1].snapshot.domains);
  assert.strictEqual(replay.policies[0].diagnostics.campaignCompleted, true);
}

{
  const result = Benchmark.runStrategicBenchmark({
    seeds: [101, 202],
    cells: Benchmark.DEFAULT_CELLS.slice(0, 2),
    horizon: 60
  });

  assert.strictEqual(result.cellsTested, 2);
  assert.strictEqual(Object.keys(result.policyReports).length, 13);
  assert.ok(result.controlledVariables.includes("shock schedule"));
  assert.ok(result.policyReports["mission-specialist"].missionProgress > result.policyReports["pure-consume"].missionProgress);
  assert.ok(result.policyReports["equal-allocation"].missionProgress < 1, "equal allocation must not pass merely for symmetry");
  assert.strictEqual(result.policyReports["mission-specialist"].completionRate, 1);
  assert.strictEqual(typeof result.antiEqualizationDiagnostics.specializationNotPenalizedSolelyForAsymmetry, "boolean");
  assert.ok(result.antiEqualizationDiagnostics.specializationWitnesses.length > 0);

  for (const cell of Object.values(result.conditionalCells)) {
    for (const report of Object.values(cell.policies)) {
      assert.ok(Number.isFinite(report.missionProgress));
      assert.ok(Number.isFinite(report.shockResilience));
      assert.ok(Number.isFinite(report.pathwayReturns));
      assert.ok(Number.isFinite(report.domainLevelSpread));
      assert.ok(Number.isFinite(report.missionProgressRange));
    }
  }

  const repeated = Benchmark.runStrategicBenchmark({
    seeds: [101, 202],
    cells: Benchmark.DEFAULT_CELLS.slice(0, 2),
    horizon: 60
  });
  assert.deepStrictEqual(result, repeated, "the committed strategic cohort must be deterministic");
  assert.ok(Benchmark.generateReportText(result).includes("mission"));
}

{
  const familyCell = Benchmark.DEFAULT_CELLS.find((cell) => cell.id === "family-recovery");
  const result = Benchmark.runStrategicBenchmark({ seeds: [101], cells: [familyCell], horizon: 60 });
  assert.strictEqual(
    result.conditionalCells[familyCell.id].policies["mission-specialist"].successRate,
    1,
    "a terrain-appropriate viable policy must be capable of completing a hard campaign"
  );
}

console.log("All Pathways Strategic Benchmark tests passed.");
