(function (root, factory) {
  const Engine = typeof require === "function" ? require("./campaignEngine") : root.PathwaysCampaignEngine;
  const api = factory(Engine);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.PathwaysCampaignApp = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (CampaignEngine) {
  "use strict";

  if (!CampaignEngine) {
    throw new Error("PathwaysCampaignEngine dependency is required for PathwaysCampaignApp");
  }

  function calculateActionPreview(campaignOrState, action) {
    if (!action || typeof action !== "object") {
      return { cost: {}, projectedEffects: [], warnings: [] };
    }

    const state = campaignOrState.domains ? campaignOrState : (campaignOrState.getSnapshot ? campaignOrState.getSnapshot() : {});
    return CampaignEngine.previewAction(state, action);
  }

  function renderSnapshot(snapshot) {
    if (!snapshot || typeof snapshot !== "object") {
      return null;
    }

    const domainViews = {};
    for (const [id, domain] of Object.entries(snapshot.domains || {})) {
      const tier = domain.tier || CampaignEngine.getDomainTier(domain.level);
      domainViews[id] = {
        id: id,
        name: domain.name,
        description: domain.description,
        level: domain.level,
        levelFormatted: domain.level.toFixed(2),
        tier: tier,
        tierLabel: `Tier ${tier}`,
        conditionBuffer: domain.conditionBuffer,
        maxCondition: domain.maxCondition,
        conditionHealthPercent: Math.min(100, Math.round((domain.conditionBuffer / domain.maxCondition) * 100)),
        evidenceCoveragePercent: Math.round((domain.evidenceCoverage || 0) * 100),
        evidenceConfidencePercent: Math.round((domain.evidenceConfidence || 0) * 100),
        personalPathwayPercent: Math.round((domain.personalPathwayQuality || 0) * 100),
        sharedPathwayPercent: Math.round((domain.sharedPathwayQuality || 0) * 100),
        volatilityPercent: Math.round((domain.volatility || 0) * 100),
        obligations: domain.obligations,
        outputs: domain.outputs
      };
    }

    let collaboratorView = null;
    if (snapshot.collaborator) {
      const c = snapshot.collaborator;
      collaboratorView = {
        isRecruited: true,
        name: c.name,
        profileLabel: `${c.profile.observerCoin || "Oi"}/${c.profile.deciderCoin || "De"}`,
        assignedRole: c.assignedRole,
        alignmentPercent: Math.round((c.alignment || 0) * 100),
        compensationRate: c.compensationRate,
        lastAutonomousAction: c.lastAutonomousAction || "Joined campaign",
        lastDecisionReason: c.lastDecision && c.lastDecision.reason,
        goals: c.goals,
        needs: c.needs,
        capabilities: c.capabilities,
        infrastructurePriority: c.infrastructurePriority,
        resourceAllowance: c.resourceAllowance,
        commitments: c.commitments
      };
    } else {
      const eligibility = CampaignEngine.checkRecruitmentEligibility(snapshot);
      collaboratorView = {
        isRecruited: false,
        eligible: eligibility.eligible,
        reasons: eligibility.reasons
      };
    }

    return {
      turn: snapshot.turn,
      phase: snapshot.phase,
      origin: snapshot.origin,
      shockSchedule: snapshot.shockSchedule,
      mission: snapshot.mission,
      horizon: snapshot.horizon,
      era: snapshot.era,
      completed: snapshot.completed,
      outcome: snapshot.outcome,
      diagnostics: snapshot.diagnostics,
      resources: snapshot.resources,
      polarityPressures: snapshot.polarityPressures || CampaignEngine.calculatePolarityPressures(snapshot),
      domains: domainViews,
      collaborator: collaboratorView
    };
  }

  function createApp(options = {}) {
    const campaign = CampaignEngine.createCampaign(options);
    const missionKey = options.mission && CampaignEngine.MISSION_PRESETS[options.mission] ? options.mission : "entrepreneurship";
    const missionPreset = CampaignEngine.MISSION_PRESETS[missionKey];

    function getTurn() {
      return campaign.turn;
    }

    function getSnapshot() {
      return CampaignEngine.getSnapshot(campaign);
    }

    function dispatchTurn(actions = []) {
      const result = CampaignEngine.stepTurn(campaign, actions);
      return result;
    }

    function calculatePreview(action) {
      return calculateActionPreview(campaign, action);
    }

    function getDiagnostics() {
      return CampaignEngine.evaluateCampaignDiagnostics(campaign, missionPreset);
    }

    return {
      getTurn: getTurn,
      getSnapshot: getSnapshot,
      dispatchTurn: dispatchTurn,
      calculatePreview: calculatePreview,
      getDiagnostics: getDiagnostics
    };
  }

  return {
    calculateActionPreview: calculateActionPreview,
    renderSnapshot: renderSnapshot,
    createApp: createApp
  };
});
