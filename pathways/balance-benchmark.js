"use strict";

const Engine = require("./engine.js");

const POLICY_NAMES = Object.freeze(["Sleep", "Consume", "Blast", "Play", "Adaptive"]);
const PURE_POLICIES = Object.freeze(POLICY_NAMES.slice(0, 4));

const REPRESENTATIVE_PROFILE_IDS = Object.freeze([
  "oi-di-observer",
  "oe-di-decider",
  "oi-de-decider",
  "oe-de-observer"
]);

const COHORT_DEFINITION = Object.freeze({
  version: 1,
  seeds: Object.freeze(["ridge-a", "ridge-b"]),
  scenarios: Object.freeze(Object.keys(Engine.SCENARIOS)),
  profiles: REPRESENTATIVE_PROFILE_IDS,
  goals: Object.freeze(Engine.GOALS.map((goal) => goal.id))
});

const BALANCE_ENVELOPE = Object.freeze({
  pureSuccessRateMax: 0.4,
  adaptiveSuccessRateMin: 0.45,
  adaptiveSuccessRateMax: 0.65,
  adaptiveLeadMin: 0.15,
  pairedDivergenceRateMin: 0.6
});

const MATERIAL_DIVERGENCE = Object.freeze({
  arrivedDelta: 1,
  deliveredSuppliesDelta: 1,
  reliableEdgesDelta: 1,
  strandedDelta: 1,
  stressDelta: 2
});

function round(value, places = 4) {
  const scale = 10 ** places;
  return Math.round(value * scale) / scale;
}

function buildFixedCohort() {
  const profiles = Object.fromEntries(Engine.PROFILE_PRESETS.map((profile) => [profile.id, profile]));
  const cohort = [];
  for (const seed of COHORT_DEFINITION.seeds) {
    for (const scenarioId of COHORT_DEFINITION.scenarios) {
      for (const profileId of COHORT_DEFINITION.profiles) {
        for (const playerGoalId of COHORT_DEFINITION.goals) {
          cohort.push(Object.freeze({
            id: `${seed}:${scenarioId}:${profileId}:${playerGoalId}`,
            seed,
            scenarioId,
            playerProfile: Object.freeze({ ...profiles[profileId] }),
            playerGoalId
          }));
        }
      }
    }
  }
  return Object.freeze(cohort);
}

const FIXED_COHORT = buildFixedCohort();

function enabledOptions(game) {
  return game.getActionOptions("player").filter((option) => option.enabled);
}

function choosePureAnimal(game, animal) {
  const options = enabledOptions(game);
  return options.find((option) => option.animal === animal) || options[0];
}

// Adaptive is deliberately inspectable: it reacts to visible pressure and capacity,
// but has no access to hidden terrain truth.
function chooseAdaptiveAnimal(game) {
  const player = game.agentById.player;
  const options = enabledOptions(game);
  const byAnimal = Object.fromEntries(options.map((option) => [option.animal, option]));
  const cheapest = options.slice().sort((a, b) => a.subjectiveCost - b.subjectiveCost || POLICY_NAMES.indexOf(a.animal) - POLICY_NAMES.indexOf(b.animal))[0];

  if (player.stamina < 3 || player.stress >= 7.5) return cheapest;

  const strongestPressure = Object.entries(player.pressure)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
  if (!strongestPressure || strongestPressure[1] < 1.5) return cheapest;

  const responses = {
    Oe: game.scenario.interdependence >= 0.65 ? "Play" : "Consume",
    Oi: game.scenario.interdependence >= 0.65 ? "Blast" : "Sleep",
    De: game.scenario.uncertainty >= 0.65 ? "Play" : "Blast",
    Di: game.scenario.uncertainty >= 0.65 ? "Consume" : "Sleep"
  };
  return byAnimal[responses[strongestPressure[0]]] || cheapest;
}

const POLICIES = Object.freeze({
  Sleep: (game) => choosePureAnimal(game, "Sleep"),
  Consume: (game) => choosePureAnimal(game, "Consume"),
  Blast: (game) => choosePureAnimal(game, "Blast"),
  Play: (game) => choosePureAnimal(game, "Play"),
  Adaptive: chooseAdaptiveAnimal
});

function runPolicy(cohortCase, policyName) {
  const game = new Engine.Game(cohortCase);
  while (!game.finished) {
    const action = POLICIES[policyName](game);
    if (!action) throw new Error(`${policyName} found no enabled action for ${cohortCase.id}`);
    game.step(action.animal);
  }
  return game.summary();
}

function classifyFailure(summary) {
  if (summary.success) return "success";
  if (summary.stranded > 0) return "stranding";
  if (summary.arrived < 3 && summary.deliveredSupplies < 3) return "insufficient-members-and-payload";
  if (summary.arrived < 3) return "insufficient-members";
  if (summary.deliveredSupplies < 3) return "insufficient-payload";
  return "weather-window";
}

function aggregatePolicy(summaries) {
  const metricNames = ["arrived", "deliveredSupplies", "reliableEdges", "stranded", "playerStress", "playerStamina", "rounds"];
  const successes = summaries.filter((summary) => summary.success).length;
  const failures = {};
  for (const summary of summaries) {
    const reason = classifyFailure(summary);
    if (reason !== "success") failures[reason] = (failures[reason] || 0) + 1;
  }
  const dominantFailureReason = Object.entries(failures)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] || "none";
  return {
    runs: summaries.length,
    successes,
    successRate: round(successes / summaries.length),
    averages: Object.fromEntries(metricNames.map((metric) => [
      metric,
      round(summaries.reduce((total, summary) => total + summary[metric], 0) / summaries.length)
    ])),
    dominantFailureReason,
    failureReasons: Object.fromEntries(Object.entries(failures).sort((a, b) => a[0].localeCompare(b[0])))
  };
}

function materiallyDiverges(left, right) {
  return left.success !== right.success
    || Math.abs(left.arrived - right.arrived) >= MATERIAL_DIVERGENCE.arrivedDelta
    || Math.abs(left.deliveredSupplies - right.deliveredSupplies) >= MATERIAL_DIVERGENCE.deliveredSuppliesDelta
    || Math.abs(left.reliableEdges - right.reliableEdges) >= MATERIAL_DIVERGENCE.reliableEdgesDelta
    || Math.abs(left.stranded - right.stranded) >= MATERIAL_DIVERGENCE.strandedDelta
    || Math.abs(left.playerStress - right.playerStress) >= MATERIAL_DIVERGENCE.stressDelta;
}

function aggregateAgency(cohort, summariesByPolicy) {
  const pairResults = [];
  let casesWithDivergence = 0;
  for (let leftIndex = 0; leftIndex < POLICY_NAMES.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < POLICY_NAMES.length; rightIndex += 1) {
      const policyA = POLICY_NAMES[leftIndex];
      const policyB = POLICY_NAMES[rightIndex];
      let materialDivergences = 0;
      for (let index = 0; index < cohort.length; index += 1) {
        if (materiallyDiverges(summariesByPolicy[policyA][index], summariesByPolicy[policyB][index])) materialDivergences += 1;
      }
      pairResults.push({
        policyA,
        policyB,
        comparisons: cohort.length,
        materialDivergences,
        divergenceRate: round(materialDivergences / cohort.length)
      });
    }
  }

  for (let index = 0; index < cohort.length; index += 1) {
    const hasDivergence = pairResults.some((pair) => materiallyDiverges(
      summariesByPolicy[pair.policyA][index],
      summariesByPolicy[pair.policyB][index]
    ));
    if (hasDivergence) casesWithDivergence += 1;
  }

  const divergentPairs = pairResults.reduce((total, pair) => total + pair.materialDivergences, 0);
  const totalPairs = pairResults.reduce((total, pair) => total + pair.comparisons, 0);
  return {
    definition: MATERIAL_DIVERGENCE,
    controlledVariables: ["seed", "scenario", "profile", "goal", "terrain", "other-agent initialization"],
    caseCount: cohort.length,
    casesWithDivergence,
    caseDivergenceRate: round(casesWithDivergence / cohort.length),
    totalPairs,
    divergentPairs,
    divergenceRate: round(divergentPairs / totalPairs),
    byPair: pairResults
  };
}

function evaluateBalance(policyReports, agency) {
  const violations = [];
  const strongestPure = PURE_POLICIES
    .map((policy) => ({ policy, rate: policyReports[policy].successRate }))
    .sort((a, b) => b.rate - a.rate || a.policy.localeCompare(b.policy))[0];
  for (const policy of PURE_POLICIES) {
    if (policyReports[policy].successRate > BALANCE_ENVELOPE.pureSuccessRateMax) {
      violations.push(`${policy} success rate ${policyReports[policy].successRate} exceeds ${BALANCE_ENVELOPE.pureSuccessRateMax}`);
    }
  }
  const adaptiveRate = policyReports.Adaptive.successRate;
  if (adaptiveRate < BALANCE_ENVELOPE.adaptiveSuccessRateMin || adaptiveRate > BALANCE_ENVELOPE.adaptiveSuccessRateMax) {
    violations.push(`Adaptive success rate ${adaptiveRate} is outside ${BALANCE_ENVELOPE.adaptiveSuccessRateMin}-${BALANCE_ENVELOPE.adaptiveSuccessRateMax}`);
  }
  const adaptiveLead = round(adaptiveRate - strongestPure.rate);
  if (adaptiveLead < BALANCE_ENVELOPE.adaptiveLeadMin) {
    violations.push(`Adaptive lead ${adaptiveLead} over ${strongestPure.policy} is below ${BALANCE_ENVELOPE.adaptiveLeadMin}`);
  }
  if (agency.divergenceRate < BALANCE_ENVELOPE.pairedDivergenceRateMin) {
    violations.push(`Paired divergence rate ${agency.divergenceRate} is below ${BALANCE_ENVELOPE.pairedDivergenceRateMin}`);
  }
  return {
    envelope: BALANCE_ENVELOPE,
    strongestPurePolicy: strongestPure.policy,
    strongestPureSuccessRate: strongestPure.rate,
    adaptiveLead,
    passes: violations.length === 0,
    violations
  };
}

function runBenchmark(options = {}) {
  const cohort = options.cohort || FIXED_COHORT;
  if (!cohort.length) throw new Error("Balance benchmark cohort must not be empty");
  const summariesByPolicy = Object.fromEntries(POLICY_NAMES.map((policy) => [policy, []]));
  for (const cohortCase of cohort) {
    for (const policy of POLICY_NAMES) summariesByPolicy[policy].push(runPolicy(cohortCase, policy));
  }
  const policies = Object.fromEntries(POLICY_NAMES.map((policy) => [policy, aggregatePolicy(summariesByPolicy[policy])]));
  const agency = aggregateAgency(cohort, summariesByPolicy);
  return {
    benchmarkVersion: 1,
    cohort: {
      definition: COHORT_DEFINITION,
      runsPerPolicy: cohort.length,
      totalExpeditions: cohort.length * POLICY_NAMES.length
    },
    policies,
    agency,
    balance: evaluateBalance(policies, agency)
  };
}

function formatReport(report) {
  const lines = [
    `Pathways balance benchmark v${report.benchmarkVersion}`,
    `Cohort: ${report.cohort.runsPerPolicy} runs per policy (${report.cohort.totalExpeditions} expeditions)`,
    "",
    "Policy    Success  Arrived  Payload  Reliable  Stranded  Stress  Stamina  Rounds  Dominant failure"
  ];
  for (const policy of POLICY_NAMES) {
    const result = report.policies[policy];
    const average = result.averages;
    lines.push([
      policy.padEnd(9),
      `${(result.successRate * 100).toFixed(1)}%`.padStart(7),
      average.arrived.toFixed(2).padStart(7),
      average.deliveredSupplies.toFixed(2).padStart(7),
      average.reliableEdges.toFixed(2).padStart(8),
      average.stranded.toFixed(2).padStart(8),
      average.playerStress.toFixed(2).padStart(6),
      average.playerStamina.toFixed(2).padStart(7),
      average.rounds.toFixed(2).padStart(6),
      result.dominantFailureReason
    ].join("  "));
  }
  lines.push("", `Paired material divergence: ${(report.agency.divergenceRate * 100).toFixed(1)}% (${report.agency.divergentPairs}/${report.agency.totalPairs})`);
  lines.push(`Balance envelope: ${report.balance.passes ? "PASS" : "FAIL"}`);
  report.balance.violations.forEach((violation) => lines.push(`- ${violation}`));
  return lines.join("\n");
}

if (require.main === module) {
  const report = runBenchmark();
  process.stdout.write(process.argv.includes("--json") ? `${JSON.stringify(report, null, 2)}\n` : `${formatReport(report)}\n`);
}

module.exports = {
  BALANCE_ENVELOPE,
  COHORT_DEFINITION,
  FIXED_COHORT,
  MATERIAL_DIVERGENCE,
  POLICIES,
  POLICY_NAMES,
  PURE_POLICIES,
  evaluateBalance,
  formatReport,
  materiallyDiverges,
  runBenchmark,
  runPolicy
};
