"use strict";

const Engine = require("./engine.js");

const PROTOTYPE_POLICY_NAMES = Object.freeze(["Sleep", "Consume", "Blast", "Play", "Adaptive"]);
const HORIZON_POLICY_NAMES = Object.freeze(["Oe Opening", "Oi Opening", "Continued Oe", "Continued Oi", "Oe to Oi"]);
const POLICY_NAMES = Object.freeze([...PROTOTYPE_POLICY_NAMES, ...HORIZON_POLICY_NAMES]);
const PURE_POLICIES = Object.freeze(PROTOTYPE_POLICY_NAMES.slice(0, 4));

const REPRESENTATIVE_PROFILE_IDS = Object.freeze([
  "oi-di-observer",
  "oe-di-decider",
  "oi-de-decider",
  "oe-de-observer"
]);

const CONDITIONAL_CELL_DEFINITIONS = Object.freeze([
  Object.freeze({ id: "sparse-research", destinationId: "research-frontier", scenarioId: "uncharted", originId: "fresh-start", evidenceStateId: "sparse" }),
  Object.freeze({ id: "sparse-social", destinationId: "entrepreneurship-launch", scenarioId: "wrong", originId: "fresh-start", evidenceStateId: "sparse" }),
  Object.freeze({ id: "private-practice", destinationId: "health-practice", scenarioId: "convoy", originId: "established-network", evidenceStateId: "verified" }),
  Object.freeze({ id: "shared-production", destinationId: "production-system", scenarioId: "convoy", originId: "established-network", evidenceStateId: "verified" }),
  Object.freeze({ id: "production-evidence-sparse", destinationId: "production-system", scenarioId: "convoy", originId: "established-network", evidenceStateId: "sparse" }),
  Object.freeze({ id: "route-lottery", destinationId: "health-practice", scenarioId: "uncharted", originId: "lucky-route", evidenceStateId: "inherited", roundLimit: 18 }),
  Object.freeze({ id: "volatile-judgment", destinationId: "judgment-calibration", scenarioId: "melting", originId: "informed-base", evidenceStateId: "inherited" }),
  Object.freeze({ id: "distributed-taste", destinationId: "taste-development", scenarioId: "uncharted", originId: "distributed-team", evidenceStateId: "inherited" }),
  Object.freeze({ id: "slow-wisdom", destinationId: "wisdom-stewardship", scenarioId: "melting", originId: "informed-base", evidenceStateId: "inherited" })
]);

const CELL_SEEDS = Object.freeze(["ridge-a", "ridge-b", "ridge-c", "ridge-d", "ridge-e"]);

const COHORT_DEFINITION = Object.freeze({
  version: 3,
  seeds: CELL_SEEDS,
  scenarios: Object.freeze([...new Set(CONDITIONAL_CELL_DEFINITIONS.map((cell) => cell.scenarioId))]),
  destinations: Object.freeze([...new Set(CONDITIONAL_CELL_DEFINITIONS.map((cell) => cell.destinationId))]),
  origins: Object.freeze([...new Set(CONDITIONAL_CELL_DEFINITIONS.map((cell) => cell.originId))]),
  evidenceStates: Object.freeze([...new Set(CONDITIONAL_CELL_DEFINITIONS.map((cell) => cell.evidenceStateId))]),
  conditionalCells: CONDITIONAL_CELL_DEFINITIONS,
  profiles: REPRESENTATIVE_PROFILE_IDS,
  goals: Object.freeze(Engine.GOALS.map((goal) => goal.id)),
  design: "Nine declared destination x terrain x origin x evidence-state cells, each evaluated over five hidden seeded mountains."
});

const PROTOTYPE_BALANCE_ENVELOPE = Object.freeze({
  pureSuccessRateMax: 0.4,
  adaptiveSuccessRateMin: 0.45,
  adaptiveSuccessRateMax: 0.65,
  adaptiveLeadMin: 0.15,
  pairedDivergenceRateMin: 0.6,
  status: "Historical issue #10 diagnostic; superseded for calibration."
});
const BALANCE_ENVELOPE = PROTOTYPE_BALANCE_ENVELOPE;

const MATERIAL_DIVERGENCE = Object.freeze({
  outcomeChanged: true,
  arrivedDelta: 1,
  deliveredSuppliesDelta: 1,
  reliableEdgesDelta: 1,
  strandedDelta: 1,
  completedDemandsDelta: 1,
  repeatTraversalsDelta: 2,
  stressDelta: 2
});

const SUMMARY_METRICS = Object.freeze([
  "arrived",
  "deliveredSupplies",
  "reliableEdges",
  "stranded",
  "playerStress",
  "playerStamina",
  "rounds",
  "repeatTraversals",
  "personalMasteryUses",
  "sharedInfrastructureUses",
  "playerSharedInfrastructureUses",
  "completedDemands",
  "payloadThroughput",
  "playerDecisionQuality",
  "destinationOutcomeScore",
  "pendingFeedback"
]);

const HORIZON_METRICS = Object.freeze([
  "frontierEvidence",
  "progress",
  "routeReliability",
  "repeatTraversals",
  "members",
  "payloadThroughput",
  "stress",
  "stamina",
  "stranding"
]);

function round(value, places = 4) {
  const scale = 10 ** places;
  return Math.round(value * scale) / scale;
}

function buildFixedCohort() {
  const profiles = Object.fromEntries(Engine.PROFILE_PRESETS.map((profile) => [profile.id, profile]));
  const cohort = [];
  CONDITIONAL_CELL_DEFINITIONS.forEach((cell, cellIndex) => {
    CELL_SEEDS.forEach((seed, seedIndex) => {
      const runIndex = cellIndex * CELL_SEEDS.length + seedIndex;
      const profileId = REPRESENTATIVE_PROFILE_IDS[runIndex % REPRESENTATIVE_PROFILE_IDS.length];
      const playerGoalId = COHORT_DEFINITION.goals[runIndex % COHORT_DEFINITION.goals.length];
      cohort.push(Object.freeze({
        id: `${cell.id}:${seed}:${profileId}:${playerGoalId}`,
        cellId: cell.id,
        seed: `${seed}:${cell.id}`,
        scenarioId: cell.scenarioId,
        destinationId: cell.destinationId,
        originId: cell.originId,
        evidenceStateId: cell.evidenceStateId,
        roundLimit: cell.roundLimit || Engine.DEFAULT_ROUNDS,
        playerProfile: Object.freeze({ ...profiles[profileId] }),
        playerGoalId
      }));
    });
  });
  return Object.freeze(cohort);
}

const FIXED_COHORT = buildFixedCohort();

function enabledOptions(game) {
  return game.getActionOptions("player").filter((option) => option.enabled);
}

function chooseAnimal(game, animal) {
  const options = enabledOptions(game);
  return options.find((option) => option.animal === animal) || options[0];
}

function chooseAdaptive(game) {
  return game.chooseAutonomousAction(game.agentById.player);
}

function chooseObserverPole(game, pole) {
  if (pole === "Oe") {
    const play = chooseAnimal(game, "Play");
    const socialNeed = game.scenario.interdependence + game.scenario.disagreement;
    return socialNeed >= 1.2 && play.partnerId ? play : chooseAnimal(game, "Consume");
  }
  const blast = chooseAnimal(game, "Blast");
  return blast.expectedFutureUses >= 3 && game.materials > 0 ? blast : chooseAnimal(game, "Sleep");
}

function inOpening(game) {
  return game.round < Math.ceil(game.roundLimit / 3);
}

const POLICIES = Object.freeze({
  Sleep: (game) => chooseAnimal(game, "Sleep"),
  Consume: (game) => chooseAnimal(game, "Consume"),
  Blast: (game) => chooseAnimal(game, "Blast"),
  Play: (game) => chooseAnimal(game, "Play"),
  Adaptive: chooseAdaptive,
  "Oe Opening": (game) => inOpening(game) ? chooseObserverPole(game, "Oe") : chooseAdaptive(game),
  "Oi Opening": (game) => inOpening(game) ? chooseObserverPole(game, "Oi") : chooseAdaptive(game),
  "Continued Oe": (game) => chooseObserverPole(game, "Oe"),
  "Continued Oi": (game) => chooseObserverPole(game, "Oi"),
  "Oe to Oi": (game) => chooseObserverPole(game, inOpening(game) ? "Oe" : "Oi")
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
  const requirements = summary.successRequirements || { payloads: 2, completedDemands: 3 };
  if (summary.deliveredSupplies < requirements.payloads && summary.completedDemands < requirements.completedDemands) return "insufficient-traffic-and-payload";
  if (summary.deliveredSupplies < requirements.payloads) return "insufficient-payload-throughput";
  if (summary.completedDemands < requirements.completedDemands) return "incomplete-traffic-demands";
  return "weather-window";
}

function averages(records, metricNames) {
  return Object.fromEntries(metricNames.map((metric) => [
    metric,
    round(records.reduce((total, record) => total + record[metric], 0) / records.length)
  ]));
}

function aggregateHorizons(summaries) {
  return Object.fromEntries(Engine.HORIZON_LABELS.map((label) => {
    const checkpoints = summaries.map((summary) => summary.checkpoints[label]);
    return [label, { averages: averages(checkpoints, HORIZON_METRICS) }];
  }));
}

function aggregatePolicy(summaries) {
  const successes = summaries.filter((summary) => summary.success).length;
  const failureReasons = {};
  for (const summary of summaries) {
    const reason = classifyFailure(summary);
    if (reason !== "success") failureReasons[reason] = (failureReasons[reason] || 0) + 1;
  }
  const dominantFailureReason = Object.entries(failureReasons)
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))[0]?.[0] || "none";
  return {
    runs: summaries.length,
    successes,
    successRate: round(successes / summaries.length),
    averages: averages(summaries, SUMMARY_METRICS),
    horizons: aggregateHorizons(summaries),
    dominantFailureReason,
    failureReasons: Object.fromEntries(Object.entries(failureReasons).sort((left, right) => left[0].localeCompare(right[0])))
  };
}

function aggregateConditionalCells(cohort, summariesByPolicy) {
  const cells = {};
  for (const cohortCase of cohort) {
    if (!cells[cohortCase.cellId]) {
      cells[cohortCase.cellId] = {
        dimensions: {
          destinationId: cohortCase.destinationId,
          terrainId: cohortCase.scenarioId,
          originId: cohortCase.originId,
          evidenceStateId: cohortCase.evidenceStateId,
          horizonRounds: cohortCase.roundLimit
        },
        indexes: []
      };
    }
    cells[cohortCase.cellId].indexes.push(cohort.indexOf(cohortCase));
  }
  return Object.fromEntries(Object.entries(cells).map(([cellId, cell]) => {
    const policies = Object.fromEntries(POLICY_NAMES.map((policy) => [
      policy,
      aggregatePolicy(cell.indexes.map((index) => summariesByPolicy[policy][index]))
    ]));
    return [cellId, { dimensions: cell.dimensions, runsPerPolicy: cell.indexes.length, policies }];
  }));
}

function collectLuckDiagnostics(cohort, summariesByPolicy, conditionalCells) {
  const diagnostics = [];
  POLICY_NAMES.forEach((policy) => {
    const lotteryIndexes = cohort.map((cohortCase, index) => ({ cohortCase, index }))
      .filter(({ cohortCase }) => cohortCase.originId === "lucky-route");
    const counterfactualGroups = lotteryIndexes.map(({ cohortCase }) => [0, 1, 2].map((originRouteSample) => runPolicy({
      ...cohortCase,
      id: `${cohortCase.id}:sampled-route-${originRouteSample}`,
      originId: "sampled-route",
      originRouteSample
    }, policy)));
    const counterfactuals = counterfactualGroups.flat();
    lotteryIndexes.forEach(({ cohortCase, index }, counterfactualIndex) => {
      const summary = summariesByPolicy[policy][index];
      const routeSamples = counterfactualGroups[counterfactualIndex];
      const sampledOutcomeScore = round(routeSamples.reduce((total, sample) => total + sample.destinationOutcomeScore, 0) / routeSamples.length);
      const sampledDecisionQuality = round(routeSamples.reduce((total, sample) => total + sample.playerDecisionQuality, 0) / routeSamples.length);
      const sampledSuccessRate = round(routeSamples.filter((sample) => sample.success).length / routeSamples.length);
      diagnostics.push({
        cellId: cohortCase.cellId,
        seed: cohortCase.seed,
        policy,
        success: summary.success,
        favorableRoute: Boolean(summary.originLuck && summary.originLuck.favorable),
        routeId: summary.originLuck ? summary.originLuck.routeId : null,
        decisionQuality: summary.playerDecisionQuality,
        outcomeScore: summary.destinationOutcomeScore,
        policySuccessRate: conditionalCells[cohortCase.cellId].policies[policy].successRate,
        policyRobustness: sampledOutcomeScore,
        counterfactualDecisionRobustness: sampledDecisionQuality,
        counterfactualSuccessRate: sampledSuccessRate,
        sampledRouteSuccessRate: sampledSuccessRate,
        counterfactualDecisionQuality: sampledDecisionQuality,
        counterfactualOutcomeScore: sampledOutcomeScore,
        sampledFavorableRouteRate: round(routeSamples.filter((sample) => sample.originLuck && sample.originLuck.favorable).length / routeSamples.length),
        luckyOutcomeLift: round(summary.destinationOutcomeScore - sampledOutcomeScore)
      });
    });
  });
  return diagnostics;
}

function materiallyDiverges(left, right) {
  return left.success !== right.success
    || Math.abs(left.arrived - right.arrived) >= MATERIAL_DIVERGENCE.arrivedDelta
    || Math.abs(left.deliveredSupplies - right.deliveredSupplies) >= MATERIAL_DIVERGENCE.deliveredSuppliesDelta
    || Math.abs(left.reliableEdges - right.reliableEdges) >= MATERIAL_DIVERGENCE.reliableEdgesDelta
    || Math.abs(left.stranded - right.stranded) >= MATERIAL_DIVERGENCE.strandedDelta
    || Math.abs(left.completedDemands - right.completedDemands) >= MATERIAL_DIVERGENCE.completedDemandsDelta
    || Math.abs(left.repeatTraversals - right.repeatTraversals) >= MATERIAL_DIVERGENCE.repeatTraversalsDelta
    || Math.abs(left.playerStress - right.playerStress) >= MATERIAL_DIVERGENCE.stressDelta;
}

function aggregateAgency(cohort, summariesByPolicy) {
  const byPair = [];
  let casesWithDivergence = 0;
  for (let leftIndex = 0; leftIndex < POLICY_NAMES.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < POLICY_NAMES.length; rightIndex += 1) {
      const policyA = POLICY_NAMES[leftIndex];
      const policyB = POLICY_NAMES[rightIndex];
      let materialDivergences = 0;
      for (let index = 0; index < cohort.length; index += 1) {
        if (materiallyDiverges(summariesByPolicy[policyA][index], summariesByPolicy[policyB][index])) materialDivergences += 1;
      }
      byPair.push({ policyA, policyB, comparisons: cohort.length, materialDivergences, divergenceRate: round(materialDivergences / cohort.length) });
    }
  }
  for (let index = 0; index < cohort.length; index += 1) {
    if (byPair.some((pair) => materiallyDiverges(summariesByPolicy[pair.policyA][index], summariesByPolicy[pair.policyB][index]))) casesWithDivergence += 1;
  }
  const divergentPairs = byPair.reduce((total, pair) => total + pair.materialDivergences, 0);
  const totalPairs = byPair.reduce((total, pair) => total + pair.comparisons, 0);
  return {
    definition: MATERIAL_DIVERGENCE,
    controlledVariables: ["seed", "destination", "terrain", "origin", "evidence state", "horizon", "profile", "goal", "traffic demands", "other-agent initialization"],
    caseCount: cohort.length,
    casesWithDivergence,
    caseDivergenceRate: round(casesWithDivergence / cohort.length),
    totalPairs,
    divergentPairs,
    divergenceRate: round(divergentPairs / totalPairs),
    byPair
  };
}

function evaluateBalance(policyReports, agency) {
  const violations = [];
  const strongestPure = PURE_POLICIES
    .map((policy) => ({ policy, rate: policyReports[policy].successRate }))
    .sort((left, right) => right.rate - left.rate || left.policy.localeCompare(right.policy))[0];
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
  const conditionalCells = aggregateConditionalCells(cohort, summariesByPolicy);
  const agency = aggregateAgency(cohort, summariesByPolicy);
  const historicalEvaluation = evaluateBalance(policies, agency);
  return {
    benchmarkVersion: 3,
    cohort: { definition: COHORT_DEFINITION, runsPerPolicy: cohort.length, totalExpeditions: cohort.length * POLICY_NAMES.length },
    aggregateIsSecondary: true,
    conditionalCells,
    luckDiagnostics: collectLuckDiagnostics(cohort, summariesByPolicy, conditionalCells),
    policies,
    agency,
    balance: {
      ...historicalEvaluation,
      status: "superseded",
      gatesCurrentRun: false
    },
    historicalPrototypeBalance: {
      status: "superseded",
      gatesCurrentRun: false,
      envelope: PROTOTYPE_BALANCE_ENVELOPE,
      note: "Issue #10 remains a reproducible prototype baseline; issue #18 makes conditional cells primary and aggregate rates secondary."
    }
  };
}

function formatReport(report) {
  const lines = [
    `Pathways conditional benchmark v${report.benchmarkVersion}`,
    `Cohort: ${report.cohort.runsPerPolicy} runs per policy (${report.cohort.totalExpeditions} expeditions)`,
    "",
    "Conditional cells (primary):"
  ];
  for (const [cellId, cell] of Object.entries(report.conditionalCells)) {
    lines.push(`${cellId} [${cell.dimensions.destinationId} | ${cell.dimensions.terrainId} | ${cell.dimensions.originId} | ${cell.dimensions.evidenceStateId} | ${cell.dimensions.horizonRounds} rounds]`);
    POLICY_NAMES.forEach((policy) => {
      const result = cell.policies[policy];
      const horizons = Engine.HORIZON_LABELS.map((label) => `${label[0].toUpperCase()} progress ${result.horizons[label].averages.progress.toFixed(1)}`).join(" · ");
      lines.push(`  ${policy}: success ${(result.successRate * 100).toFixed(0)}% · outcome ${result.averages.destinationOutcomeScore.toFixed(3)} · ${horizons}`);
    });
  }
  lines.push(
    "",
    "Aggregate across unlike cells (secondary):",
    "Policy          Success  Demands  Payload  Repeat  Personal  Shared  Stress  Rounds  Dominant failure"
  );
  for (const policy of POLICY_NAMES) {
    const result = report.policies[policy];
    const value = result.averages;
    lines.push([
      policy.padEnd(15),
      `${(result.successRate * 100).toFixed(1)}%`.padStart(7),
      value.completedDemands.toFixed(2).padStart(7),
      value.payloadThroughput.toFixed(2).padStart(7),
      value.repeatTraversals.toFixed(2).padStart(6),
      value.personalMasteryUses.toFixed(2).padStart(8),
      value.playerSharedInfrastructureUses.toFixed(2).padStart(6),
      value.playerStress.toFixed(2).padStart(6),
      value.rounds.toFixed(2).padStart(6),
      result.dominantFailureReason
    ].join("  "));
  }
  lines.push("", `Paired material divergence: ${(report.agency.divergenceRate * 100).toFixed(1)}% (${report.agency.divergentPairs}/${report.agency.totalPairs})`);
  lines.push("Prototype aggregate envelope: historical only; aggregate equality is not a ticket #18 gate.");
  return lines.join("\n");
}

if (require.main === module) {
  const report = runBenchmark();
  process.stdout.write(process.argv.includes("--json") ? `${JSON.stringify(report, null, 2)}\n` : `${formatReport(report)}\n`);
}

module.exports = {
  BALANCE_ENVELOPE,
  COHORT_DEFINITION,
  CONDITIONAL_CELL_DEFINITIONS,
  FIXED_COHORT,
  HORIZON_POLICY_NAMES,
  MATERIAL_DIVERGENCE,
  POLICIES,
  POLICY_NAMES,
  PROTOTYPE_BALANCE_ENVELOPE,
  PROTOTYPE_POLICY_NAMES,
  PURE_POLICIES,
  evaluateBalance,
  formatReport,
  materiallyDiverges,
  runBenchmark,
  runPolicy
};
