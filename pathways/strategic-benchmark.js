(function (root, factory) {
  const Engine = typeof require === "function" ? require("./campaignEngine") : root.PathwaysCampaignEngine;
  const api = factory(Engine);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.PathwaysStrategicBenchmark = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (Engine) {
  "use strict";

  if (!Engine) throw new Error("PathwaysCampaignEngine dependency is required for StrategicBenchmark");

  const DOMAIN_IDS = Object.freeze(Object.keys(Engine.DOMAIN_PRESETS));
  const DEFAULT_CELLS = Object.freeze([
    Object.freeze({ id: "entrepreneur-stable", origin: "balanced-starter", mission: "entrepreneurship", shockSchedule: "stable-horizon" }),
    Object.freeze({ id: "entrepreneur-isolated", origin: "asset-rich-isolated", mission: "entrepreneurship", shockSchedule: "volatile-shift" }),
    Object.freeze({ id: "scholar-volatile", origin: "scholar-monk", mission: "scholarship", shockSchedule: "volatile-shift" }),
    Object.freeze({ id: "family-recovery", origin: "struggling-body", mission: "family-stewardship", shockSchedule: "crisis-cascade" })
  ]);

  function affordable(snapshot, action) {
    return Engine.previewAction(snapshot, action).affordable;
  }

  function firstAffordable(snapshot, actions) {
    const action = actions.find((candidate) => candidate && affordable(snapshot, candidate));
    return action ? [action] : [];
  }

  function weakestConditionDomain(snapshot, domainIds) {
    return (domainIds || DOMAIN_IDS).slice().sort((left, right) => {
      const a = snapshot.domains[left];
      const b = snapshot.domains[right];
      return (a.conditionBuffer / a.maxCondition) - (b.conditionBuffer / b.maxCondition);
    })[0];
  }

  function missionAcquisition(snapshot) {
    const targets = Object.entries(snapshot.mission.targetLevels || {}).filter(([domainId, target]) => snapshot.domains[domainId].level < target);
    if (!targets.length) return null;
    targets.sort((left, right) => (snapshot.domains[left[0]].level / left[1]) - (snapshot.domains[right[0]].level / right[1]));
    return { type: "acquire", targetDomain: targets[0][0] };
  }

  function preparationFor(snapshot, acquisition) {
    if (!acquisition) return null;
    const domain = snapshot.domains[acquisition.targetDomain];
    const evidenceQuality = domain.evidenceCoverage * domain.evidenceConfidence * (1 - domain.evidenceStaleness);
    if (evidenceQuality < 0.5) {
      return { type: "animal_operation", animal: snapshot.collaborator ? "Play" : "Consume", targetDomain: acquisition.targetDomain };
    }
    if (domain.personalPathwayQuality < 0.58) {
      return { type: "animal_operation", animal: "Sleep", targetDomain: acquisition.targetDomain };
    }
    return null;
  }

  function floorCorrection(snapshot) {
    const threatened = Object.entries(snapshot.mission.viabilityFloors || {}).find(([domainId, floor]) => {
      const domain = snapshot.domains[domainId];
      return (floor.conditionBuffer !== undefined && domain.conditionBuffer < floor.conditionBuffer + 15)
        || (floor.minLevel !== undefined && domain.level < floor.minLevel);
    });
    if (!threatened) return null;
    const [domainId, floor] = threatened;
    if (floor.minLevel !== undefined && snapshot.domains[domainId].level < floor.minLevel) {
      return { type: "acquire", targetDomain: domainId };
    }
    return { type: "maintain", targetDomain: domainId };
  }

  function pressureOperation(snapshot) {
    const entries = Object.entries(snapshot.polarityPressures).sort((left, right) => right[1] - left[1]);
    const pole = entries[0][0];
    const driver = (snapshot.pressureDrivers[pole] || [])[0];
    const targetDomain = driver && driver.domain ? driver.domain : "understanding-judgment";
    if (pole === "Oe") return { type: "animal_operation", animal: snapshot.collaborator ? "Play" : "Consume", targetDomain };
    if (pole === "Oi") return { type: "animal_operation", animal: "Sleep", targetDomain };
    if (pole === "De") return { type: "animal_operation", animal: snapshot.collaborator ? "Play" : "Blast", targetDomain };
    return { type: "animal_operation", animal: "Sleep", targetDomain };
  }

  const POLICIES = Object.freeze([
    Object.freeze({ id: "mission-specialist", name: "Mission Specialist", decide(snapshot) {
      const floor = floorCorrection(snapshot);
      const acquire = missionAcquisition(snapshot);
      const preparation = preparationFor(snapshot, acquire);
      return firstAffordable(snapshot, [
        floor,
        floor && { type: "maintain", targetDomain: floor.targetDomain },
        preparation,
        acquire,
        pressureOperation(snapshot)
      ]);
    } }),
    Object.freeze({ id: "equal-allocation", name: "Equal Allocation", decide(snapshot, turn) {
      const targetDomain = DOMAIN_IDS[turn % DOMAIN_IDS.length];
      return firstAffordable(snapshot, [
        { type: "acquire", targetDomain },
        { type: "maintain", targetDomain }
      ]);
    } }),
    Object.freeze({ id: "single-domain", name: "Single Domain Maximization", decide(snapshot) {
      return firstAffordable(snapshot, [
        { type: "acquire", targetDomain: "livelihood-money" },
        { type: "maintain", targetDomain: "livelihood-money" }
      ]);
    } }),
    Object.freeze({ id: "crisis-only", name: "Crisis-only Reaction", decide(snapshot) {
      const targetDomain = weakestConditionDomain(snapshot);
      const domain = snapshot.domains[targetDomain];
      return domain.conditionBuffer / domain.maxCondition < 0.45
        ? firstAffordable(snapshot, [{ type: "maintain", targetDomain }])
        : [];
    } }),
    ...["Sleep", "Consume", "Blast", "Play"].map((animal) => Object.freeze({
      id: `pure-${animal.toLowerCase()}`,
      name: `Pure ${animal}`,
      decide(snapshot, turn) {
        const missionDomains = Object.keys(snapshot.mission.targetLevels || {});
        return firstAffordable(snapshot, [{ type: "animal_operation", animal, targetDomain: missionDomains[turn % missionDomains.length] }]);
      }
    })),
    Object.freeze({ id: "maintenance-first", name: "Maintenance First", decide(snapshot) {
      const targetDomain = weakestConditionDomain(snapshot);
      return firstAffordable(snapshot, [
        { type: "maintain", targetDomain },
        missionAcquisition(snapshot)
      ]);
    } }),
    Object.freeze({ id: "exploration-heavy", name: "Exploration Heavy", decide(snapshot, turn) {
      const missionDomains = Object.keys(snapshot.mission.targetLevels || {});
      const targetDomain = missionDomains[turn % missionDomains.length];
      const acquire = missionAcquisition(snapshot);
      return firstAffordable(snapshot, [
        turn % 3 === 2 && acquire,
        { type: "animal_operation", animal: snapshot.collaborator ? "Play" : "Consume", targetDomain },
        acquire
      ]);
    } }),
    Object.freeze({ id: "consolidation-heavy", name: "Consolidation Heavy", decide(snapshot, turn) {
      const missionDomains = Object.keys(snapshot.mission.targetLevels || {});
      const targetDomain = missionDomains[turn % missionDomains.length];
      const acquire = missionAcquisition(snapshot);
      return firstAffordable(snapshot, [
        turn % 3 === 2 && acquire,
        { type: "animal_operation", animal: turn % 2 ? "Blast" : "Sleep", targetDomain },
        acquire
      ]);
    } }),
    Object.freeze({ id: "adaptive", name: "State-responsive Adaptive", decide(snapshot) {
      const floor = floorCorrection(snapshot);
      const acquire = missionAcquisition(snapshot);
      const preparation = preparationFor(snapshot, acquire);
      const recruit = Engine.checkRecruitmentEligibility(snapshot).eligible ? { type: "recruit_collaborator" } : null;
      const weakest = weakestConditionDomain(snapshot);
      const weakDomain = snapshot.domains[weakest];
      return firstAffordable(snapshot, [
        floor,
        floor && { type: "maintain", targetDomain: floor.targetDomain },
        weakDomain.conditionBuffer / weakDomain.maxCondition < 0.4 && { type: "maintain", targetDomain: weakest },
        recruit,
        preparation,
        acquire,
        pressureOperation(snapshot)
      ]);
    } }),
    Object.freeze({ id: "delegation-heavy", name: "Delegation Heavy", decide(snapshot) {
      if (!snapshot.collaborator && Engine.checkRecruitmentEligibility(snapshot).eligible) {
        return firstAffordable(snapshot, [{ type: "recruit_collaborator" }]);
      }
      if (snapshot.collaborator && snapshot.collaborator.assignedRole !== "production") {
        return firstAffordable(snapshot, [{ type: "configure_collaborator", role: "production", infrastructurePriority: "livelihood-money" }]);
      }
      return firstAffordable(snapshot, [missionAcquisition(snapshot), pressureOperation(snapshot)]);
    } })
  ]);

  function emptyReport(policy) {
    return {
      id: policy.id,
      name: policy.name,
      totalRuns: 0,
      completedRuns: 0,
      successfulRuns: 0,
      viableRuns: 0,
      missionProgress: 0,
      policyQuality: 0,
      shockResilience: 0,
      maintenanceEfficiency: 0,
      crises: 0,
      shocks: 0,
      pathwayReturns: 0,
      domainLevelSpread: 0,
      missionProgressMin: Infinity,
      missionProgressMax: -Infinity
    };
  }

  function finalizeReport(report) {
    const divisor = Math.max(1, report.totalRuns);
    report.missionProgressRange = report.totalRuns
      ? Math.round((report.missionProgressMax - report.missionProgressMin) * 1000) / 1000
      : 0;
    if (!Number.isFinite(report.missionProgressMin)) report.missionProgressMin = 0;
    if (!Number.isFinite(report.missionProgressMax)) report.missionProgressMax = 0;
    for (const metric of ["missionProgress", "policyQuality", "shockResilience", "maintenanceEfficiency", "crises", "shocks", "pathwayReturns", "domainLevelSpread"]) {
      report[metric] = Math.round(report[metric] / divisor * 1000) / 1000;
    }
    report.completionRate = report.completedRuns / divisor;
    report.successRate = report.successfulRuns / divisor;
    report.viabilityRate = report.viableRuns / divisor;
    return report;
  }

  function runStrategicBenchmark(options = {}) {
    const seeds = options.seeds || [101, 202, 303];
    const cells = options.cells || DEFAULT_CELLS;
    const horizon = options.horizon || Engine.DEFAULT_HORIZON;
    const policies = options.policies || POLICIES;
    const aggregate = Object.fromEntries(policies.map((policy) => [policy.id, emptyReport(policy)]));
    const conditionalCells = {};

    for (const cell of cells) {
      const cellReports = Object.fromEntries(policies.map((policy) => [policy.id, emptyReport(policy)]));
      for (const seed of seeds) {
        const replay = Engine.runCounterfactualReplay({ ...cell, seed, horizon, turns: horizon }, policies.map((policy) => ({
          name: policy.id,
          decide: policy.decide
        })));
        const shockSignatures = replay.policies.map((result) => JSON.stringify(result.shockSignature));
        if (!shockSignatures.every((signature) => signature === shockSignatures[0])) {
          throw new Error(`Counterfactual shock schedules diverged in ${cell.id} seed ${seed}`);
        }
        for (const result of replay.policies) {
          for (const report of [cellReports[result.name], aggregate[result.name]]) {
            const diagnostics = result.diagnostics;
            report.totalRuns += 1;
            if (diagnostics.campaignCompleted) report.completedRuns += 1;
            if (diagnostics.success) report.successfulRuns += 1;
            if (diagnostics.viabilityCompliance.isViable) report.viableRuns += 1;
            report.missionProgress += diagnostics.missionProgress;
            report.missionProgressMin = Math.min(report.missionProgressMin, diagnostics.missionProgress);
            report.missionProgressMax = Math.max(report.missionProgressMax, diagnostics.missionProgress);
            report.policyQuality += diagnostics.policyQualityScore;
            report.shockResilience += diagnostics.shockResilienceScore;
            report.maintenanceEfficiency += diagnostics.maintenanceEfficiencyScore;
            report.crises += diagnostics.crisisCount;
            report.shocks += diagnostics.shockCount;
            report.pathwayReturns += diagnostics.pathwayReturns;
            const levels = Object.values(result.snapshot.domains).map((domain) => domain.level);
            report.domainLevelSpread += Math.max(...levels) - Math.min(...levels);
          }
        }
      }
      conditionalCells[cell.id] = {
        dimensions: cell,
        policies: Object.fromEntries(Object.entries(cellReports).map(([id, report]) => [id, finalizeReport(report)]))
      };
    }

    const policyReports = Object.fromEntries(Object.entries(aggregate).map(([id, report]) => [id, finalizeReport(report)]));
    const specializationWitnesses = Object.entries(conditionalCells)
      .filter(([, cell]) => {
        const specialist = cell.policies["mission-specialist"];
        const equal = cell.policies["equal-allocation"];
        return specialist.successRate > equal.successRate
          && specialist.domainLevelSpread > equal.domainLevelSpread;
      })
      .map(([cellId]) => cellId);
    const specialist = policyReports["mission-specialist"];
    const equal = policyReports["equal-allocation"];
    return {
      seedsTested: seeds.length,
      horizon,
      cellsTested: cells.length,
      controlledVariables: ["seed", "origin", "mission", "shock schedule", "horizon", "profile", "domain initialization", "collaborator initialization"],
      conditionalCells,
      policyReports,
      antiEqualizationDiagnostics: {
        specializationNotPenalizedSolelyForAsymmetry: specializationWitnesses.length > 0,
        specializationWitnesses,
        specialistMissionProgress: specialist.missionProgress,
        equalAllocationMissionProgress: equal.missionProgress
      }
    };
  }

  function generateReportText(result) {
    const lines = [
      "Pathways Strategic Campaign Benchmark",
      `Cells ${result.cellsTested} | Seeds ${result.seedsTested} | Horizon ${result.horizon}`,
      ""
    ];
    for (const [cellId, cell] of Object.entries(result.conditionalCells)) {
      lines.push(`${cellId} [${cell.dimensions.origin} | ${cell.dimensions.mission} | ${cell.dimensions.shockSchedule}]`);
      for (const report of Object.values(cell.policies)) {
        lines.push(`  ${report.name}: success ${Math.round(report.successRate * 100)}% | mission ${Math.round(report.missionProgress * 100)}% (range ${Math.round(report.missionProgressRange * 100)}%) | viable ${Math.round(report.viabilityRate * 100)}% | resilience ${report.shockResilience}`);
      }
    }
    lines.push("", `Specialization not penalized solely for asymmetry: ${result.antiEqualizationDiagnostics.specializationNotPenalizedSolelyForAsymmetry}`);
    return lines.join("\n");
  }

  if (typeof require !== "undefined" && typeof module !== "undefined" && require.main === module) {
    console.log(generateReportText(runStrategicBenchmark()));
  }

  return { DEFAULT_CELLS, POLICIES, runStrategicBenchmark, generateReportText };
});
