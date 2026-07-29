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
    const targetDomain = action.targetDomain && state.domains ? state.domains[action.targetDomain] : null;
    const profile = state.focalProfile || { observerCoin: "Oe", deciderCoin: "Di", primaryAxis: "observer" };

    const projectedEffects = [];
    const warnings = [];
    let cost = action.cost || {};

    if (action.type === "animal_operation" && action.animal) {
      cost = CampaignEngine.calculateAnimalCost(action.animal, profile, action.cost);
      const animalName = action.animal;

      if (targetDomain) {
        if (animalName === "Consume") {
          if (targetDomain.evidenceCoverage >= 0.8) {
            warnings.push("Over-exploration penalty: evidence coverage is high (≥80%). Diminishing returns apply.");
            projectedEffects.push("+0.05 Evidence Coverage (diminished)");
            projectedEffects.push("+4 Evidence Resource");
          } else {
            projectedEffects.push("+0.20 Evidence Coverage");
            projectedEffects.push("+0.15 Evidence Confidence");
            projectedEffects.push("+15 Evidence Resource");
          }
        } else if (animalName === "Sleep") {
          if (targetDomain.evidenceConfidence < 0.4) {
            warnings.push("Premature consolidation warning: evidence confidence is low (<40%). Incurs epistemic debt and increases volatility.");
          }
          projectedEffects.push("+0.15 Personal Pathway Quality");
          projectedEffects.push("+15.0 Condition Buffer");
        } else if (animalName === "Play") {
          if (targetDomain.evidenceCoverage >= 0.8) {
            warnings.push("Over-exploration warning: high evidence coverage applies minor opportunity cost.");
          }
          projectedEffects.push("+0.10 Shared Pathway Quality");
          projectedEffects.push("+15 Trust Resource");
        } else if (animalName === "Blast") {
          if (targetDomain.evidenceConfidence < 0.4) {
            warnings.push("Premature consolidation warning: publishing weak evidence amplifies error and volatility.");
          }
          projectedEffects.push("+0.20 Shared Pathway Quality");
        }
      }
    } else if (action.type === "maintain" && targetDomain) {
      cost = { attention: 2, vitality: 1 };
      projectedEffects.push("+25.0 Condition Buffer");
    } else if (action.type === "acquire" && targetDomain) {
      cost = { attention: 4, materials: 3 };
      projectedEffects.push("+0.20 Domain Level");
      projectedEffects.push("+5.0 Condition Buffer");
    }

    return {
      cost: cost,
      projectedEffects: projectedEffects,
      warnings: warnings
    };
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
        conditionHealthPercent: Math.min(100, Math.round((domain.conditionBuffer / 100.0) * 100)),
        evidenceCoveragePercent: Math.round((domain.evidenceCoverage || 0) * 100),
        evidenceConfidencePercent: Math.round((domain.evidenceConfidence || 0) * 100),
        personalPathwayPercent: Math.round((domain.personalPathwayQuality || 0) * 100),
        sharedPathwayPercent: Math.round((domain.sharedPathwayQuality || 0) * 100),
        volatilityPercent: Math.round((domain.volatility || 0) * 100),
        obligations: domain.obligations,
        outputs: domain.outputs
      };
    }

    return {
      turn: snapshot.turn,
      phase: snapshot.phase,
      origin: snapshot.origin,
      shockSchedule: snapshot.shockSchedule,
      resources: snapshot.resources,
      polarityPressures: snapshot.polarityPressures || CampaignEngine.calculatePolarityPressures(snapshot),
      domains: domainViews
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

    function mountUI(containerElement) {
      if (!containerElement || typeof containerElement.querySelector !== "function") {
        return;
      }

      function updateDOM() {
        const snap = getSnapshot();
        const renderData = renderSnapshot(snap);
        if (!renderData) return;

        // Render resources
        const resBar = containerElement.querySelector("#resourceBar");
        if (resBar) {
          resBar.innerHTML = Object.entries(renderData.resources)
            .map(([k, v]) => `<div class="res-item"><span class="res-label">${k}</span><span class="res-value">${Math.round(v)}</span></div>`)
            .join("");
        }

        // Render pressures
        const pressBar = containerElement.querySelector("#pressureBar");
        if (pressBar) {
          pressBar.innerHTML = Object.entries(renderData.polarityPressures)
            .map(([k, v]) => `<div class="pressure-item"><span class="press-label">${k}</span><div class="press-meter"><div class="press-fill" style="width:${v}%"></div></div><span class="press-val">${v}%</span></div>`)
            .join("");
        }

        // Render turn counter
        const turnEl = containerElement.querySelector("#turnCounter");
        if (turnEl) turnEl.textContent = `Turn ${renderData.turn}`;
      }

      updateDOM();
      return { updateDOM: updateDOM };
    }

    return {
      getTurn: getTurn,
      getSnapshot: getSnapshot,
      dispatchTurn: dispatchTurn,
      calculatePreview: calculatePreview,
      getDiagnostics: getDiagnostics,
      mountUI: mountUI
    };
  }

  return {
    calculateActionPreview: calculateActionPreview,
    renderSnapshot: renderSnapshot,
    createApp: createApp
  };
});
