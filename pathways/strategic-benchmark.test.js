const assert = require("assert");
const CampaignEngine = require("./campaignEngine");
const StrategicBenchmark = require("./strategic-benchmark");

console.log("Running Pathways Strategic Benchmark tests...");

// 1. Module Exports
{
  assert(CampaignEngine, "CampaignEngine module should exist");
  assert(typeof CampaignEngine.runCounterfactualReplay === "function", "runCounterfactualReplay function should exist");
  assert(StrategicBenchmark, "StrategicBenchmark module should exist");
  assert(typeof StrategicBenchmark.runStrategicBenchmark === "function", "runStrategicBenchmark function should exist");
}

// 2. Counterfactual Replay Engine (Issue #26)
{
  const options = {
    seed: 42,
    origin: "balanced-starter",
    mission: "entrepreneurship",
    shockSchedule: "crisis-cascade",
    turns: 5
  };

  const policyA = {
    name: "Invest Livelihood",
    actionsPerTurn: Array(5).fill([{ type: "animal_operation", animal: "Consume", targetDomain: "livelihood-money" }])
  };

  const policyB = {
    name: "Maintain Health",
    actionsPerTurn: Array(5).fill([{ type: "maintain", targetDomain: "body-health" }])
  };

  const replay = CampaignEngine.runCounterfactualReplay(options, [policyA, policyB]);
  assert(replay, "runCounterfactualReplay should return replay result");
  assert.strictEqual(replay.policies.length, 2, "Replay should contain 2 policies");

  // Verify shock schedule isolation: world shocks in policyA and policyB must be identical
  const shocksA = replay.policies[0].history.flatMap(h => h.events).filter(e => e.type === "world_shock");
  const shocksB = replay.policies[1].history.flatMap(h => h.events).filter(e => e.type === "world_shock");
  assert.deepStrictEqual(shocksA, shocksB, "Independent PRNG streams must isolate shock schedule across counterfactual policies");
}

// 3. Strategic Benchmark Suite & Anti-Equalization Diagnostics (Issue #26)
{
  const benchmarkResult = StrategicBenchmark.runStrategicBenchmark({
    seeds: [10, 20, 30],
    turns: 5
  });

  assert(benchmarkResult, "runStrategicBenchmark should return benchmark result");
  assert(benchmarkResult.policyReports, "Benchmark result should contain policyReports");
  assert(benchmarkResult.antiEqualizationDiagnostics, "Benchmark result should contain anti-equalization diagnostics");
  assert.strictEqual(benchmarkResult.antiEqualizationDiagnostics.specializationSupported, true, "Specialized portfolios fulfilling viability floors must be supported without symmetry penalty");
}

console.log("All Pathways Strategic Benchmark tests passed successfully!");
