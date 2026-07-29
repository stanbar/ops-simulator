(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.PathwaysCampaignEngine = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const RESOURCE_TYPES = Object.freeze({
    attention: "attention",
    vitality: "vitality",
    materials: "materials",
    trust: "trust",
    evidence: "evidence"
  });

  const ANIMALS = Object.freeze({
    Consume: Object.freeze({
      name: "Consume",
      observer: "Oe",
      decider: "Di",
      description: "Private discovery and investigation of unknown or changed conditions.",
      baseCost: Object.freeze({ attention: 4, vitality: 3 })
    }),
    Sleep: Object.freeze({
      name: "Sleep",
      observer: "Oi",
      decider: "Di",
      description: "Integration, practice, personal pathway consolidation, and recovery.",
      baseCost: Object.freeze({ attention: 3, vitality: 4 })
    }),
    Play: Object.freeze({
      name: "Play",
      observer: "Oe",
      decider: "De",
      description: "Social discovery, joint exploration, and reciprocal negotiation.",
      baseCost: Object.freeze({ attention: 4, trust: 2 })
    }),
    Blast: Object.freeze({
      name: "Blast",
      observer: "Oi",
      decider: "De",
      description: "Publication, standardization, shared infrastructure, and teaching.",
      baseCost: Object.freeze({ attention: 5, materials: 3 })
    })
  });

  const ANIMAL_PATHWAY_TARGETS = Object.freeze({
    Consume: Object.freeze(["evidence"]),
    Sleep: Object.freeze(["personal", "condition"]),
    Play: Object.freeze(["evidence", "shared"]),
    Blast: Object.freeze(["shared"])
  });

  const DEFAULT_PATHWAY_TARGET = Object.freeze({
    Consume: "evidence",
    Sleep: "personal",
    Play: "evidence",
    Blast: "shared"
  });

  const ACTION_BASE_COSTS = Object.freeze({
    maintain: Object.freeze({ attention: 2, vitality: 1 }),
    acquire: Object.freeze({ attention: 4, materials: 3 }),
    invest_domain: Object.freeze({ attention: 4, materials: 3 }),
    set_maintenance_policy: Object.freeze({ attention: 3, materials: 2 }),
    recruit_collaborator: Object.freeze({ materials: 25, trust: 15 }),
    assign_collaborator_role: Object.freeze({ attention: 1 }),
    configure_collaborator: Object.freeze({ attention: 1 })
  });

  const RESOURCE_CAPS = Object.freeze({
    attention: 40,
    vitality: 120,
    materials: 400,
    trust: 120,
    evidence: 150
  });

  const DEFAULT_HORIZON = 60;

  const TIER_THRESHOLDS = Object.freeze([
    { tier: 1, minLevel: 0.0 },
    { tier: 2, minLevel: 3.0 },
    { tier: 3, minLevel: 6.0 },
    { tier: 4, minLevel: 10.0 }
  ]);

  const SHOCK_SCHEDULES = Object.freeze({
    "stable-horizon": Object.freeze({
      id: "stable-horizon",
      name: "Stable Horizon",
      description: "Low-frequency world shocks allowing steady routine development.",
      shockProbability: 0.05
    }),
    "volatile-shift": Object.freeze({
      id: "volatile-shift",
      name: "Volatile Shift",
      description: "Frequent environmental shifts requiring active Oe reopening.",
      shockProbability: 0.35
    }),
    "crisis-cascade": Object.freeze({
      id: "crisis-cascade",
      name: "Crisis Cascade",
      description: "Scheduled high-intensity world shocks exposing fragile dependencies.",
      fixedShocks: Object.freeze({
        2: { type: "evidentiary_shock", domain: "understanding-judgment" },
        4: { type: "condition_shock", domain: "body-health" },
        6: { type: "obligation_shock", domain: "livelihood-money" }
      })
    })
  });

  function getDomainTier(level) {
    let currentTier = 1;
    for (const t of TIER_THRESHOLDS) {
      if (level >= t.minLevel) {
        currentTier = t.tier;
      }
    }
    return currentTier;
  }

  function createPRNG(seed) {
    let s = seed >>> 0;
    return function next() {
      s = (s + 0x6d2b79f5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function calculateAnimalCost(animalName, agentProfile, customBaseCost, adaptation) {
    const animal = ANIMALS[animalName];
    if (!animal) {
      throw new Error(`Unknown animal operation: ${animalName}`);
    }

    const profile = agentProfile || { observerCoin: "Oe", deciderCoin: "Di", primaryAxis: "observer" };
    const observerDemon = animal.observer !== profile.observerCoin;
    const deciderDemon = animal.decider !== profile.deciderCoin;
    const observerWeight = observerDemon ? (profile.primaryAxis === "observer" ? 1.8 : 1.4) : 1;
    const deciderWeight = deciderDemon ? (profile.primaryAxis === "decider" ? 1.8 : 1.4) : 1;
    let multiplier = (observerWeight + deciderWeight) / 2;

    const learned = adaptation || {};
    const observerAdaptation = observerDemon ? (learned[animal.observer] || 0) : 0;
    const deciderAdaptation = deciderDemon ? (learned[animal.decider] || 0) : 0;
    multiplier = Math.max(1, multiplier - Math.min(0.25, observerAdaptation + deciderAdaptation));

    const baseCost = customBaseCost || animal.baseCost;
    const calculatedCost = {};
    for (const [resKey, amount] of Object.entries(baseCost)) {
      calculatedCost[resKey] = Math.ceil(amount * multiplier);
    }
    return calculatedCost;
  }

  function getActionCost(campaignState, action) {
    if (!action || typeof action !== "object") return {};
    if (action.type === "animal_operation") {
      return calculateAnimalCost(
        action.animal,
        campaignState.focalProfile,
        ANIMALS[action.animal] && ANIMALS[action.animal].baseCost,
        campaignState.adaptation
      );
    }

    const base = ACTION_BASE_COSTS[action.type] || {};
    const cost = Object.assign({}, base);
    const domain = action.targetDomain && campaignState.domains[action.targetDomain];

    if (domain && (action.type === "acquire" || action.type === "invest_domain")) {
      cost.attention = Math.ceil((base.attention || 0) + domain.level * 0.75);
      cost.materials = Math.ceil((base.materials || 0) + domain.level * 0.75 + (domain.complexity || 0));
    } else if (domain && action.type === "maintain") {
      const pathwayEfficiency = 1 + domain.personalPathwayQuality + domain.sharedPathwayQuality * 0.5;
      cost.attention = Math.max(1, Math.ceil((base.attention || 0) * domain.level / pathwayEfficiency));
      cost.vitality = Math.max(1, Math.ceil((base.vitality || 0) * Math.max(1, domain.level * 0.5)));
    }

    return cost;
  }

  function calculateAcquisitionGain(domain) {
    const evidenceQuality = domain.evidenceCoverage * domain.evidenceConfidence * (1 - domain.evidenceStaleness);
    const pathwayQuality = domain.personalPathwayQuality * 0.65 + domain.sharedPathwayQuality * 0.35;
    return 0.16 + 0.2 * (evidenceQuality * 0.55 + pathwayQuality * 0.45);
  }

  function checkRecruitmentEligibility(campaignState) {
    const reasons = [];

    if (campaignState.collaborator) {
      reasons.push("Collaborator already recruited");
      return { eligible: false, reasons: reasons };
    }

    const materials = campaignState.resources ? (campaignState.resources.materials || 0) : 0;
    const trust = campaignState.resources ? (campaignState.resources.trust || 0) : 0;
    const reputation = campaignState.reputation || 0;

    if (materials < 40) {
      reasons.push(`Insufficient materials: ${materials}/40 required`);
    }
    if (trust < 30) {
      reasons.push(`Insufficient trust: ${trust}/30 required`);
    }
    if (reputation < 10) {
      reasons.push(`Insufficient reputation: ${reputation}/10 required`);
    }

    let hasTier2 = false;
    for (const domain of Object.values(campaignState.domains || {})) {
      if (domain.level >= 3.0 || domain.tier >= 2) {
        hasTier2 = true;
        break;
      }
    }

    if (!hasTier2) {
      reasons.push("Requires at least one domain at Tier 2 (level ≥ 3.0)");
    }

    return {
      eligible: reasons.length === 0,
      reasons: reasons
    };
  }

  const DOMAIN_PRESETS = Object.freeze({
    "body-health": Object.freeze({
      id: "body-health",
      name: "Body & Health",
      description: "Physical vitality, endurance, recovery capacity, and biological maintenance.",
      level: 1.0,
      conditionBuffer: 100.0,
      evidenceCoverage: 0.8,
      evidenceConfidence: 0.85,
      personalPathwayQuality: 0.5,
      sharedPathwayQuality: 0.2,
      volatility: 0.1,
      obligations: Object.freeze({ vitality: 2 }),
      outputs: Object.freeze({ vitality: 12 }),
      dependencyEdges: Object.freeze([])
    }),
    "livelihood-money": Object.freeze({
      id: "livelihood-money",
      name: "Livelihood & Money",
      description: "Financial security, material assets, revenue systems, and resource flows.",
      level: 1.0,
      conditionBuffer: 100.0,
      evidenceCoverage: 0.7,
      evidenceConfidence: 0.75,
      personalPathwayQuality: 0.4,
      sharedPathwayQuality: 0.3,
      volatility: 0.2,
      obligations: Object.freeze({ materials: 3 }),
      outputs: Object.freeze({ materials: 20 }),
      dependencyEdges: Object.freeze([
        Object.freeze({ target: "body-health", weight: 0.4, substituteTarget: "practical-foundations", maxSubstitution: 0.2 })
      ])
    }),
    "practical-foundations": Object.freeze({
      id: "practical-foundations",
      name: "Practical Foundations",
      description: "Operational order, environment, infrastructure, and execution routines.",
      level: 1.0,
      conditionBuffer: 100.0,
      evidenceCoverage: 0.6,
      evidenceConfidence: 0.7,
      personalPathwayQuality: 0.6,
      sharedPathwayQuality: 0.4,
      volatility: 0.15,
      obligations: Object.freeze({ attention: 2 }),
      outputs: Object.freeze({ attention: 8 }),
      dependencyEdges: Object.freeze([
        Object.freeze({ target: "body-health", weight: 0.3 })
      ])
    }),
    "family-belonging": Object.freeze({
      id: "family-belonging",
      name: "Family & Belonging",
      description: "Relational trust, shared safety, community standing, and mutual care.",
      level: 1.0,
      conditionBuffer: 100.0,
      evidenceCoverage: 0.65,
      evidenceConfidence: 0.8,
      personalPathwayQuality: 0.4,
      sharedPathwayQuality: 0.6,
      volatility: 0.1,
      obligations: Object.freeze({ trust: 2 }),
      outputs: Object.freeze({ trust: 10 }),
      dependencyEdges: Object.freeze([
        Object.freeze({ target: "practical-foundations", weight: 0.3 })
      ])
    }),
    "understanding-judgment": Object.freeze({
      id: "understanding-judgment",
      name: "Understanding & Judgment",
      description: "Epistemic clarity, mental models, domain discrimination, and decision quality.",
      level: 1.0,
      conditionBuffer: 100.0,
      evidenceCoverage: 0.5,
      evidenceConfidence: 0.6,
      personalPathwayQuality: 0.7,
      sharedPathwayQuality: 0.3,
      volatility: 0.25,
      obligations: Object.freeze({ attention: 3 }),
      outputs: Object.freeze({ evidence: 12 }),
      dependencyEdges: Object.freeze([
        Object.freeze({ target: "body-health", weight: 0.2 }),
        Object.freeze({ target: "practical-foundations", weight: 0.2 })
      ])
    }),
    "meaning-contribution": Object.freeze({
      id: "meaning-contribution",
      name: "Meaning & Contribution",
      description: "Purpose alignment, impactful work, legacy, and long-horizon value.",
      level: 1.0,
      conditionBuffer: 100.0,
      evidenceCoverage: 0.4,
      evidenceConfidence: 0.5,
      personalPathwayQuality: 0.5,
      sharedPathwayQuality: 0.5,
      volatility: 0.2,
      obligations: Object.freeze({ attention: 2, trust: 1 }),
      outputs: Object.freeze({ trust: 5, evidence: 5 }),
      dependencyEdges: Object.freeze([
        Object.freeze({ target: "understanding-judgment", weight: 0.4 }),
        Object.freeze({ target: "family-belonging", weight: 0.3 })
      ])
    })
  });

  const DOMAIN_DYNAMICS = Object.freeze({
    "body-health": Object.freeze({ maxCondition: 110, decayRate: 0.12, complexity: 0.8, feedbackLatency: 1 }),
    "livelihood-money": Object.freeze({ maxCondition: 100, decayRate: 0.08, complexity: 1.2, feedbackLatency: 2 }),
    "practical-foundations": Object.freeze({ maxCondition: 120, decayRate: 0.05, complexity: 0.7, feedbackLatency: 1 }),
    "family-belonging": Object.freeze({ maxCondition: 90, decayRate: 0.14, complexity: 1.0, feedbackLatency: 2 }),
    "understanding-judgment": Object.freeze({ maxCondition: 105, decayRate: 0.04, complexity: 1.1, feedbackLatency: 3 }),
    "meaning-contribution": Object.freeze({ maxCondition: 85, decayRate: 0.1, complexity: 1.3, feedbackLatency: 4 })
  });

  const ORIGIN_PRESETS = Object.freeze({
    "balanced-starter": Object.freeze({
      id: "balanced-starter",
      name: "Balanced Starter",
      description: "A balanced baseline start with moderate initial resources and healthy buffers.",
      initialResources: Object.freeze({ attention: 20, vitality: 20, materials: 50, trust: 20, evidence: 20 }),
      domainOverrides: Object.freeze({})
    }),
    "struggling-body": Object.freeze({
      id: "struggling-body",
      name: "Struggling Body",
      description: "Low physical health condition and depleted vitality requiring early recovery.",
      initialResources: Object.freeze({ attention: 20, vitality: 5, materials: 30, trust: 15, evidence: 20 }),
      domainOverrides: Object.freeze({
        "body-health": { level: 0.8, conditionBuffer: 25.0 }
      })
    }),
    "asset-rich-isolated": Object.freeze({
      id: "asset-rich-isolated",
      name: "Asset Rich & Isolated",
      description: "Strong financial livelihood but low relational trust and family belonging.",
      initialResources: Object.freeze({ attention: 20, vitality: 20, materials: 150, trust: 5, evidence: 20 }),
      domainOverrides: Object.freeze({
        "livelihood-money": { level: 3.5, conditionBuffer: 100.0 },
        "family-belonging": { level: 0.5, conditionBuffer: 40.0 }
      })
    }),
    "scholar-monk": Object.freeze({
      id: "scholar-monk",
      name: "Scholar Monk",
      description: "High epistemic understanding and evidence, but minimal material wealth.",
      initialResources: Object.freeze({ attention: 25, vitality: 20, materials: 10, trust: 15, evidence: 60 }),
      domainOverrides: Object.freeze({
        "understanding-judgment": { level: 3.5, conditionBuffer: 100.0 },
        "livelihood-money": { level: 0.5, conditionBuffer: 50.0 }
      })
    })
  });

  const MISSION_PRESETS = Object.freeze({
    entrepreneurship: Object.freeze({
      id: "entrepreneurship",
      name: "Entrepreneurship Launch",
      description: "Build a thriving material livelihood and practical system while maintaining health viability.",
      targetLevels: Object.freeze({ "livelihood-money": 5.0, "practical-foundations": 4.0 }),
      viabilityFloors: Object.freeze({ "body-health": { conditionBuffer: 20.0, minLevel: 0.8 } })
    }),
    scholarship: Object.freeze({
      id: "scholarship",
      name: "Scholarship & Inquiry",
      description: "Achieve deep understanding and knowledge contribution with basic financial stability.",
      targetLevels: Object.freeze({ "understanding-judgment": 5.0, "meaning-contribution": 4.0 }),
      viabilityFloors: Object.freeze({ "livelihood-money": { minLevel: 1.0 } })
    }),
    "family-stewardship": Object.freeze({
      id: "family-stewardship",
      name: "Family Stewardship",
      description: "Nurture deep relational trust and physical health across generations.",
      targetLevels: Object.freeze({ "family-belonging": 5.0, "body-health": 4.0 }),
      viabilityFloors: Object.freeze({ "body-health": { conditionBuffer: 30.0 } })
    }),
    "holistic-resilience": Object.freeze({
      id: "holistic-resilience",
      name: "Holistic Resilience",
      description: "Maintain a balanced, resilient life across all six capability domains.",
      targetLevels: Object.freeze({
        "body-health": 3.0,
        "livelihood-money": 3.0,
        "practical-foundations": 3.0,
        "family-belonging": 3.0,
        "understanding-judgment": 3.0,
        "meaning-contribution": 3.0
      }),
      viabilityFloors: Object.freeze({
        "body-health": { conditionBuffer: 20.0 },
        "livelihood-money": { conditionBuffer: 20.0 }
      })
    })
  });

  function calculatePressureReport(campaignState) {
    const domains = Object.values(campaignState.domains || {});
    const drivers = { Oe: [], Oi: [], Di: [], De: [] };

    for (const domain of domains) {
      const uncertainty = Math.max(0, 1 - domain.evidenceCoverage);
      const staleness = Math.min(1, (domain.evidenceStaleness || 0) + domain.volatility * 0.5);
      if (uncertainty + staleness > 0.45) {
        drivers.Oe.push({ domain: domain.id, condition: "unknown-or-stale", severity: Math.min(1, (uncertainty + staleness) / 1.5) });
      }

      const obligationLoad = Object.values(domain.obligations || {}).reduce((sum, value) => sum + value, 0);
      const fragility = Math.max(0, 1 - domain.personalPathwayQuality) * Math.min(1, obligationLoad / 4);
      const conditionRisk = domain.conditionBuffer / domain.maxCondition < 0.45 ? 0.5 : 0;
      if (fragility + conditionRisk > 0.25) {
        drivers.Oi.push({ domain: domain.id, condition: "fragile-recurring-pathway", severity: Math.min(1, fragility + conditionRisk) });
      }
    }

    const vitalityRatio = (campaignState.resources.vitality || 0) / (RESOURCE_CAPS.vitality || 1);
    if (vitalityRatio < 0.25) drivers.Di.push({ condition: "personal-vitality-limit", severity: 1 - vitalityRatio });
    for (const constraint of campaignState.personalConstraints || []) {
      if (!constraint.resolved) drivers.Di.push({ condition: constraint.type, domain: constraint.domain, severity: constraint.severity || 0.5 });
    }

    for (const obligation of campaignState.unmetObligations || []) {
      if (obligation.coordinated) continue;
      drivers.De.push({ condition: "uncoordinated-obligation", domain: obligation.domain, severity: Math.min(1, obligation.deficit / 5) });
    }
    if (campaignState.collaborator) {
      for (const [domainId, collaboratorCoverage] of Object.entries(campaignState.collaborator.evidence || {})) {
        const focalCoverage = campaignState.domains[domainId].evidenceCoverage;
        if (Math.abs(focalCoverage - collaboratorCoverage) > 0.35) {
          drivers.Di.push({ domain: domainId, condition: "private-evidence-conflict", severity: Math.abs(focalCoverage - collaboratorCoverage) });
        }
      }
    }
    if (campaignState.collaborator && campaignState.collaborator.alignment < 0.6) {
      drivers.De.push({ condition: "collaborator-misalignment", severity: 1 - campaignState.collaborator.alignment });
    }
    if ((campaignState.resources.trust || 0) < 10) {
      drivers.De.push({ condition: "low-coordination-trust", severity: 1 - campaignState.resources.trust / 10 });
    }

    const pressure = {};
    for (const pole of ["Oe", "Oi", "Di", "De"]) {
      const total = drivers[pole].reduce((sum, driver) => sum + driver.severity, 0);
      pressure[pole] = Math.min(100, Math.round(total * 35));
    }
    return { pressure, drivers };
  }

  function calculatePolarityPressures(campaignState) {
    return calculatePressureReport(campaignState).pressure;
  }

  function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function deepFreeze(obj) {
    if (obj === null || typeof obj !== "object") return obj;
    Object.freeze(obj);
    Object.getOwnPropertyNames(obj).forEach((prop) => {
      if (
        obj[prop] !== null &&
        (typeof obj[prop] === "object" || typeof obj[prop] === "function") &&
        !Object.isFrozen(obj[prop])
      ) {
        deepFreeze(obj[prop]);
      }
    });
    return obj;
  }

  function validateInvariants(campaignState) {
    if (!campaignState || typeof campaignState !== "object") {
      throw new Error("Invalid campaign state object");
    }

    if (!campaignState.resources || typeof campaignState.resources !== "object") {
      throw new Error("Invalid resources object in campaign state");
    }

    for (const resKey of Object.keys(RESOURCE_TYPES)) {
      const val = campaignState.resources[resKey];
      if (typeof val !== "number" || isNaN(val)) {
        throw new Error(`Invalid non-numeric resource ${resKey}: ${val}`);
      }
      if (val < 0) {
        throw new Error(`Negative resource ${resKey}: ${val}`);
      }
    }

    if (!campaignState.domains || typeof campaignState.domains !== "object") {
      throw new Error("Invalid domains object in campaign state");
    }

    for (const domainId of Object.keys(DOMAIN_PRESETS)) {
      const domain = campaignState.domains[domainId];
      if (!domain) {
        throw new Error(`Missing domain state for ${domainId}`);
      }
      if (typeof domain.level !== "number" || domain.level < 0) {
        throw new Error(`Negative domain level for ${domainId}: ${domain.level}`);
      }
      if (typeof domain.conditionBuffer !== "number" || domain.conditionBuffer < 0) {
        throw new Error(`Negative condition buffer for ${domainId}: ${domain.conditionBuffer}`);
      }
    }

    return true;
  }

  function createCampaign(options = {}) {
    const seed = typeof options.seed === "number" ? options.seed : 42;
    const originKey = options.origin && ORIGIN_PRESETS[options.origin] ? options.origin : "balanced-starter";
    const originPreset = ORIGIN_PRESETS[originKey];
    const shockKey = options.shockSchedule && SHOCK_SCHEDULES[options.shockSchedule] ? options.shockSchedule : "stable-horizon";
    const missionKey = options.mission && MISSION_PRESETS[options.mission] ? options.mission : "entrepreneurship";
    const mission = deepClone(options.missionConfig || MISSION_PRESETS[missionKey]);
    const horizon = Number.isInteger(options.horizon) && options.horizon > 0 ? options.horizon : DEFAULT_HORIZON;

    const initialResources = Object.assign(
      {},
      originPreset.initialResources,
      options.initialResources || {}
    );

    const focalProfile = Object.assign(
      { observerCoin: "Oe", deciderCoin: "Di", primaryAxis: "observer" },
      options.focalProfile || {}
    );

    const domains = {};
    for (const [id, preset] of Object.entries(DOMAIN_PRESETS)) {
      domains[id] = deepClone(preset);
      Object.assign(domains[id], deepClone(DOMAIN_DYNAMICS[id]));
      domains[id].conditionBuffer = Math.min(domains[id].conditionBuffer, domains[id].maxCondition);
      domains[id].evidenceStaleness = 0;
      domains[id].epistemicDebt = 0;
      domains[id].maintenancePaid = 0;
      domains[id].maintenanceMissed = 0;
      domains[id].acquisitionInvested = 0;
      domains[id].pathwayReturns = { personal: 0, shared: 0 };
      domains[id].tier = getDomainTier(domains[id].level);

      if (originPreset.domainOverrides && originPreset.domainOverrides[id]) {
        Object.assign(domains[id], originPreset.domainOverrides[id]);
        domains[id].conditionBuffer = Math.min(domains[id].conditionBuffer, domains[id].maxCondition);
        domains[id].tier = getDomainTier(domains[id].level);
      }

      if (options.domains && options.domains[id]) {
        Object.assign(domains[id], options.domains[id]);
        domains[id].conditionBuffer = Math.min(domains[id].conditionBuffer, domains[id].maxCondition);
        domains[id].tier = getDomainTier(domains[id].level);
      }
    }

    const campaignState = {
      seed: seed,
      turn: 1,
      phase: "updateWorld",
      origin: originKey,
      missionId: missionKey,
      mission: mission,
      horizon: horizon,
      era: "early",
      completed: false,
      outcome: null,
      shockSchedule: shockKey,
      focalProfile: focalProfile,
      focalStress: 0,
      adaptation: { Oe: 0, Oi: 0, Di: 0, De: 0 },
      resources: initialResources,
      resourceCaps: deepClone(RESOURCE_CAPS),
      domains: domains,
      collaborator: null,
      automatedPolicies: {},
      unmetObligations: [],
      personalConstraints: [],
      temporaryObligations: [],
      pendingFeedback: [],
      reputation: options.reputation === undefined ? 10 : options.reputation,
      history: [],
      worldRng: createPRNG(seed + 101),
      agentRng: createPRNG(seed + 202),
      feedbackRng: createPRNG(seed + 303)
    };

    validateInvariants(campaignState);
    return campaignState;
  }

  function stepTurn(campaignState, actions = []) {
    validateInvariants(campaignState);
    if (campaignState.completed) {
      throw new Error(`Campaign already completed at turn ${campaignState.horizon}`);
    }
    if (!Array.isArray(actions)) throw new Error("Turn actions must be an array");
    if (actions.length > 1) throw new Error("The campaign vertical slice permits one focal action per turn");

    const domainActionTypes = new Set(["animal_operation", "maintain", "acquire", "invest_domain", "set_maintenance_policy"]);
    for (const action of actions) {
      if (!action || typeof action !== "object") throw new Error("Each turn action must be an object");
      if (!ACTION_BASE_COSTS[action.type] && action.type !== "animal_operation") {
        throw new Error(`Unknown campaign action: ${action.type}`);
      }
      if (domainActionTypes.has(action.type) && !campaignState.domains[action.targetDomain]) {
        throw new Error(`Unknown target domain: ${action.targetDomain}`);
      }
      if (action.type === "animal_operation" && action.pathwayTarget
          && !ANIMAL_PATHWAY_TARGETS[action.animal].includes(action.pathwayTarget)) {
        throw new Error(`${action.animal} cannot target pathway layer ${action.pathwayTarget}`);
      }
      if (action.type === "recruit_collaborator") {
        const eligibility = checkRecruitmentEligibility(campaignState);
        if (!eligibility.eligible) throw new Error(`Ineligible for recruitment: ${eligibility.reasons.join(", ")}`);
      }
      if (["assign_collaborator_role", "configure_collaborator"].includes(action.type) && !campaignState.collaborator) {
        throw new Error("No active collaborator to configure");
      }
    }

    const currentTurn = campaignState.turn;
    const events = [];
    const causalTrace = [];
    const reservedResources = {};
    for (const action of actions) {
      for (const [resource, amount] of Object.entries(getActionCost(campaignState, action))) {
        reservedResources[resource] = (reservedResources[resource] || 0) + amount;
      }
    }
    for (const [resource, amount] of Object.entries(reservedResources)) {
      const available = resource === "attention"
        ? Math.max(campaignState.resources.attention || 0, 12)
        : (campaignState.resources[resource] || 0);
      if (available < amount) {
        throw new Error(`Insufficient resource ${resource}: required ${amount}, available ${available}`);
      }
    }
    const unreserved = (resource) => Math.max(0, (campaignState.resources[resource] || 0) - (reservedResources[resource] || 0));
    campaignState.era = currentTurn <= Math.ceil(campaignState.horizon / 3)
      ? "early"
      : currentTurn <= Math.ceil(campaignState.horizon * 2 / 3) ? "middle" : "late";
    campaignState.unmetObligations = [];
    const attentionBeforeRecovery = campaignState.resources.attention;
    campaignState.resources.attention = Math.min(
      campaignState.resourceCaps.attention,
      Math.max(campaignState.resources.attention, 12)
    );
    if (campaignState.resources.attention > attentionBeforeRecovery) {
      events.push({
        type: "attention_recovery",
        resource: "attention",
        amount: campaignState.resources.attention - attentionBeforeRecovery,
        message: "Turn boundary restored focal attention capacity"
      });
    }

    // Phase 1: updateWorld - Process passive outputs, shocks, collaborator overhead & inter-domain dependencies
    campaignState.phase = "updateWorld";

    // Process World Shocks using worldRng stream
    const schedule = SHOCK_SCHEDULES[campaignState.shockSchedule] || SHOCK_SCHEDULES["stable-horizon"];
    let scheduledShock = schedule.fixedShocks && schedule.fixedShocks[currentTurn]
      ? schedule.fixedShocks[currentTurn]
      : null;
    if (!scheduledShock && typeof schedule.shockProbability === "number" && campaignState.worldRng() < schedule.shockProbability) {
      const domainIds = Object.keys(campaignState.domains);
      const shockTypes = ["evidentiary_shock", "condition_shock", "obligation_shock"];
      scheduledShock = {
        type: shockTypes[Math.floor(campaignState.worldRng() * shockTypes.length)],
        domain: domainIds[Math.floor(campaignState.worldRng() * domainIds.length)]
      };
    }
    if (scheduledShock) {
      const fixed = scheduledShock;
      const targetDomain = campaignState.domains[fixed.domain];
      if (targetDomain) {
        if (fixed.type === "evidentiary_shock") {
          targetDomain.evidenceCoverage = Math.max(0, targetDomain.evidenceCoverage - 0.4);
          targetDomain.evidenceConfidence = Math.max(0, targetDomain.evidenceConfidence - 0.5);
          targetDomain.evidenceStaleness = Math.min(1, targetDomain.evidenceStaleness + 0.5);
          if (campaignState.automatedPolicies[fixed.domain]) {
            campaignState.automatedPolicies[fixed.domain].staleness = Math.min(1, campaignState.automatedPolicies[fixed.domain].staleness + 0.5);
          }
          events.push({
            type: "world_shock",
            shockType: fixed.type,
            targetDomain: fixed.domain,
            message: `Evidentiary shock invalidated evidence on ${fixed.domain}`
          });
          causalTrace.push(`World shock (${fixed.type}) invalidated evidence on ${fixed.domain}.`);
        } else if (fixed.type === "condition_shock") {
          targetDomain.conditionBuffer = Math.max(0, targetDomain.conditionBuffer - 35.0);
          events.push({
            type: "world_shock",
            shockType: fixed.type,
            targetDomain: fixed.domain,
            message: `Condition shock damaged ${fixed.domain} buffer`
          });
          causalTrace.push(`World shock (${fixed.type}) damaged condition buffer on ${fixed.domain}.`);
        } else if (fixed.type === "obligation_shock") {
          campaignState.temporaryObligations.push({ domain: fixed.domain, resource: "materials", amount: 6, remainingTurns: 3 });
          events.push({
            type: "world_shock",
            shockType: fixed.type,
            targetDomain: fixed.domain,
            message: `Obligation shock created three turns of material demand on ${fixed.domain}`
          });
          causalTrace.push(`World shock (${fixed.type}) created urgent material obligation.`);
        }
      }
    }

    const dueFeedback = campaignState.pendingFeedback.filter((feedback) => feedback.dueTurn <= currentTurn);
    campaignState.pendingFeedback = campaignState.pendingFeedback.filter((feedback) => feedback.dueTurn > currentTurn);
    for (const feedback of dueFeedback) {
      const domain = campaignState.domains[feedback.domain];
      if (!domain) continue;
      const confirmed = feedback.signal < feedback.evidenceQuality;
      if (confirmed) {
        domain.evidenceConfidence = Math.min(1, domain.evidenceConfidence + 0.04);
      } else {
        domain.evidenceConfidence = Math.max(0, domain.evidenceConfidence - 0.03);
        domain.conditionBuffer = Math.max(0, domain.conditionBuffer - 1.5);
        domain.epistemicDebt = Math.min(1, domain.epistemicDebt + 0.03);
      }
      events.push({
        type: "delayed_feedback",
        domain: feedback.domain,
        sourceTurn: feedback.sourceTurn,
        confirmed,
        message: confirmed
          ? `Delayed feedback supported the turn ${feedback.sourceTurn} acquisition`
          : `Delayed feedback contradicted the turn ${feedback.sourceTurn} acquisition`
      });
      causalTrace.push(`Delayed feedback ${confirmed ? "supported" : "challenged"} the ${feedback.domain} acquisition from turn ${feedback.sourceTurn}.`);
    }

    for (const [domainId, policy] of Object.entries(campaignState.automatedPolicies)) {
      if (!policy.enabled) continue;
      const domain = campaignState.domains[domainId];
      if (!domain) continue;
      policy.inspectionAge += 1;
      policy.staleness = Math.min(1, policy.staleness + domain.volatility * 0.04);
      const materialCost = Math.max(1, Math.ceil(domain.level));
      const effectiveness = Math.max(0.15, 1 - policy.staleness);
      if (unreserved("materials") >= materialCost) {
        campaignState.resources.materials -= materialCost;
        const restored = 7 * effectiveness * (0.5 + domain.personalPathwayQuality * 0.5);
        domain.conditionBuffer = Math.min(domain.maxCondition, domain.conditionBuffer + restored);
        events.push({ type: "automated_maintenance", domain: domainId, materialCost, restored, staleness: policy.staleness });
      } else {
        events.push({ type: "automation_deficit", domain: domainId, materialCost, message: `Automation for ${domainId} lacked materials` });
        causalTrace.push(`Automation deficit in ${domainId} increased pathway staleness.`);
        policy.staleness = Math.min(1, policy.staleness + 0.15);
      }
    }

    // Process Collaborator Overhead & Resignation
    if (campaignState.collaborator) {
      const collab = campaignState.collaborator;
      const compRate = collab.compensationRate || 2;
      const trustCost = collab.trustOverhead || 1;

      // Compensation
      if (unreserved("materials") >= compRate) {
        campaignState.resources.materials -= compRate;
      } else {
        collab.alignment = Math.max(0, collab.alignment - 0.15);
        events.push({
          type: "collaborator_unpaid",
          message: "Unpaid compensation reduced collaborator alignment"
        });
        causalTrace.push("Unpaid collaborator compensation reduced alignment.");
      }

      // Trust overhead
      if (unreserved("trust") >= trustCost) {
        campaignState.resources.trust -= trustCost;
      } else {
        collab.alignment = Math.max(0, collab.alignment - 0.10);
      }

      // Check Resignation
      if (collab.alignment < 0.2) {
        events.push({
          type: "collaborator_resigned",
          name: collab.name,
          message: `${collab.name} resigned due to low alignment and unpaid overhead.`
        });
        causalTrace.push(`Collaborator ${collab.name} resigned due to low alignment.`);
        campaignState.collaborator = null;
      } else {
        // Autonomous Collaborator Decision
        const assignedRole = collab.assignedRole || "production";
        const scores = {
          production: (collab.capabilities.production || 0) + (assignedRole === "production" ? 0.35 : 0),
          maintenance: (collab.capabilities.maintenance || 0) + (assignedRole === "maintenance" ? 0.35 : 0),
          exploration: (collab.capabilities.exploration || 0) + (assignedRole === "exploration" ? 0.35 : 0)
        };
        const priorityDomain = campaignState.domains[collab.infrastructurePriority];
        if (priorityDomain) {
          if (priorityDomain.conditionBuffer / priorityDomain.maxCondition < 0.55) scores.maintenance += 0.25;
          if (priorityDomain.evidenceStaleness > 0.35 || priorityDomain.evidenceCoverage < 0.5) scores.exploration += 0.25;
        }
        scores.production += Math.min(0.2, ((collab.resourceAllowance && collab.resourceAllowance.materials) || 0) / 50);
        if (collab.needs.security > 0.6 && campaignState.resources.materials < 30) scores.production += 0.3;
        if (collab.needs.autonomy > 0.6 && assignedRole === collab.lastRole) scores.exploration += 0.15;
        const rankedRoles = Object.entries(scores).sort((a, b) => b[1] - a[1]);
        const role = rankedRoles[0][0];
        collab.lastRole = role;
        collab.lastDecision = {
          role,
          reason: `${role} had highest utility from capabilities, assigned priority, and current needs`,
          followedAssignment: role === assignedRole
        };
        if (role === "production") {
          const matDomain = campaignState.domains["livelihood-money"];
          if (matDomain) {
            const produced = Math.round(4 + 6 * collab.capabilities.production * collab.alignment);
            campaignState.resources.materials = Math.min(campaignState.resourceCaps.materials, campaignState.resources.materials + produced);
            collab.lastAutonomousAction = `Boosted material production (+${produced} materials)`;
            events.push({
              type: "collaborator_action",
              role: role,
              action: collab.lastAutonomousAction
            });
          }
        } else if (role === "maintenance") {
          const targetId = (collab.goals || []).slice().sort((a, b) => {
            const left = campaignState.domains[a];
            const right = campaignState.domains[b];
            return (left.conditionBuffer / left.maxCondition) - (right.conditionBuffer / right.maxCondition);
          })[0] || "body-health";
          const target = campaignState.domains[targetId];
          if (target) {
            const restored = Math.round(8 + 7 * collab.capabilities.maintenance * collab.alignment);
            target.conditionBuffer = Math.min(target.maxCondition, target.conditionBuffer + restored);
            collab.lastAutonomousAction = `Maintained ${targetId} condition buffer (+${restored} buffer)`;
            events.push({
              type: "collaborator_action",
              role: role,
              action: collab.lastAutonomousAction
            });
          }
        } else if (role === "exploration") {
          const targetId = (collab.goals || Object.keys(campaignState.domains)).slice().sort((a, b) => {
            return (collab.evidence[a] || 0) - (collab.evidence[b] || 0);
          })[0] || "understanding-judgment";
          const expDomain = campaignState.domains[targetId];
          if (expDomain) {
            const discovered = 0.05 + 0.1 * collab.capabilities.exploration * collab.alignment;
            collab.evidence[targetId] = Math.min(1, (collab.evidence[targetId] || 0) + discovered);
            expDomain.evidenceCoverage = Math.min(1.0, expDomain.evidenceCoverage + discovered * 0.5);
            collab.lastAutonomousAction = `Explored ${targetId} (+${Math.round(discovered * 100)}% private coverage)`;
            events.push({
              type: "collaborator_action",
              role: role,
              action: collab.lastAutonomousAction
            });
          }
        }
      }
    }

    // Process Domain Dependencies & Output
    const priorConditionRatios = Object.fromEntries(Object.entries(campaignState.domains).map(([id, domain]) => [
      id,
      domain.conditionBuffer / domain.maxCondition
    ]));
    for (const [id, domain] of Object.entries(campaignState.domains)) {
      domain.evidenceStaleness = Math.min(1, domain.evidenceStaleness + domain.volatility * 0.01);
      let bottleneckMultiplier = 1.0;
      if (Array.isArray(domain.dependencyEdges)) {
        for (const edge of domain.dependencyEdges) {
          const parent = campaignState.domains[edge.target];
          if (parent) {
            const parentHealth = priorConditionRatios[edge.target];
            const threshold = edge.threshold || 0.6;
            if (parentHealth < threshold) {
              let factor = (1 - edge.weight) + edge.weight * (parentHealth / threshold);
              if (edge.substituteTarget && campaignState.domains[edge.substituteTarget]) {
                const subParent = campaignState.domains[edge.substituteTarget];
                const subHealth = priorConditionRatios[edge.substituteTarget];
                if (subHealth > threshold) {
                  const subBonus = (edge.maxSubstitution || 0.1) * ((subHealth - threshold) / (1 - threshold));
                  factor = Math.min(1.0, factor + subBonus);
                }
              }
              bottleneckMultiplier *= factor;
              events.push({
                type: "dependency_bottleneck",
                domain: id,
                parentDomain: edge.target,
                factor: factor
              });
              causalTrace.push(`Dependency bottleneck: ${id} output throttled by parent ${edge.target}.`);
            }
          }
        }
      }

      for (const [resKey, amount] of Object.entries(domain.outputs || {})) {
        if (amount > 0 && RESOURCE_TYPES[resKey]) {
          const conditionMultiplier = Math.max(0.1, domain.conditionBuffer / domain.maxCondition);
          const tierCapacity = 1 + (domain.tier - 1) * 0.2;
          const actualOutput = amount * domain.level * 0.25 * bottleneckMultiplier * conditionMultiplier * tierCapacity;
          campaignState.resources[resKey] = Math.min(
            campaignState.resourceCaps[resKey],
            (campaignState.resources[resKey] || 0) + actualOutput
          );
          events.push({
            type: "passive_output",
            domain: id,
            resource: resKey,
            amount: actualOutput
          });
        }
      }

      // Obligations & Maintenance
      const pathwayEfficiency = 1.0 + 0.5 * (domain.personalPathwayQuality + domain.sharedPathwayQuality);
      const obligations = Object.assign({}, domain.obligations || {});
      for (const temporary of campaignState.temporaryObligations.filter((entry) => entry.domain === id)) {
        obligations[temporary.resource] = (obligations[temporary.resource] || 0) + temporary.amount;
      }
      for (const [resKey, baseCost] of Object.entries(obligations)) {
        const complexityLoad = 1 + domain.complexity * 0.1 + (domain.tier - 1) * 0.08;
        const maintenanceScale = Math.max(0.25, domain.level - 0.25);
        const baselineCost = baseCost * maintenanceScale * (1 + domain.volatility) * complexityLoad;
        const automationDiscount = resKey === "attention" && campaignState.automatedPolicies[id] && campaignState.automatedPolicies[id].enabled
          ? 0.45
          : 1;
        const scaledCost = baselineCost / pathwayEfficiency * automationDiscount;
        const pathwaySaving = Math.max(0, baselineCost - scaledCost);
        domain.pathwayReturns.personal += pathwaySaving * (domain.personalPathwayQuality / Math.max(0.01, domain.personalPathwayQuality + domain.sharedPathwayQuality));
        domain.pathwayReturns.shared += pathwaySaving * (domain.sharedPathwayQuality / Math.max(0.01, domain.personalPathwayQuality + domain.sharedPathwayQuality));
        if (unreserved(resKey) >= scaledCost) {
          campaignState.resources[resKey] -= scaledCost;
          domain.maintenancePaid += scaledCost;
        } else {
          const spendable = unreserved(resKey);
          const deficit = scaledCost - spendable;
          campaignState.resources[resKey] -= spendable;
          domain.maintenanceMissed += deficit;
          campaignState.unmetObligations.push({ domain: id, resource: resKey, deficit, coordinated: false });
          domain.conditionBuffer = Math.max(0, domain.conditionBuffer - deficit * (4 + domain.decayRate * 10));
          
          events.push({
            type: "maintenance_deficit",
            domain: id,
            unmetCost: deficit
          });
          causalTrace.push(`Maintenance deficit in ${id}: unmet ${resKey} cost ${deficit.toFixed(2)} drained condition buffer.`);

          if (domain.conditionBuffer === 0) {
            const levelLoss = Math.min(domain.level, domain.decayRate);
            domain.level = Math.max(0, domain.level - levelLoss);
            events.push({
              type: "level_degradation",
              domain: id,
              levelLoss: levelLoss,
              newLevel: domain.level
            });
            causalTrace.push(`Level degradation in ${id}: condition buffer at 0 caused durable level loss of ${levelLoss.toFixed(2)}.`);
          }
        }
      }

      // Check Tier Transition
      const newTier = getDomainTier(domain.level);
      if (newTier !== domain.tier) {
        const oldTier = domain.tier;
        domain.tier = newTier;
        events.push({
          type: "tier_transition",
          domain: id,
          oldTier: oldTier,
          newTier: newTier
        });
        if (newTier > oldTier) {
          campaignState.reputation += (newTier - oldTier) * 2;
          causalTrace.push(`${id} reached Tier ${newTier}, increasing capacity, obligations, and reputation.`);
        }
      }
    }

    campaignState.temporaryObligations = campaignState.temporaryObligations
      .map((entry) => Object.assign({}, entry, { remainingTurns: entry.remainingTurns - 1 }))
      .filter((entry) => entry.remainingTurns > 0);

    // Phase 2: observe
    campaignState.phase = "observe";

    // Phase 3 & 4: allocate & resolve actions
    campaignState.phase = "allocate";

    for (const action of actions) {
      if (!action || typeof action !== "object") continue;

      if (action.type === "recruit_collaborator") {
        const recruitmentCost = getActionCost(campaignState, action);
        for (const [resource, amount] of Object.entries(recruitmentCost)) campaignState.resources[resource] -= amount;
        const domainIds = Object.keys(campaignState.domains);
        const primaryGoal = domainIds[Math.floor(campaignState.agentRng() * domainIds.length)];
        const secondaryGoal = domainIds[Math.floor(campaignState.agentRng() * domainIds.length)];
        const privateEvidence = Object.fromEntries(domainIds.map((domainId) => [domainId, Math.round(campaignState.agentRng() * 60) / 100]));
        campaignState.collaborator = {
          id: "collab-1",
          name: "Alex",
          profile: { observerCoin: "Oi", deciderCoin: "De", primaryAxis: "decider" },
          assignedRole: "production",
          alignment: 0.85,
          compensationRate: 2,
          trustOverhead: 1,
          evidence: privateEvidence,
          goals: [...new Set([primaryGoal, secondaryGoal])],
          needs: { security: 0.55, autonomy: 0.65, belonging: 0.5 },
          capabilities: {
            production: 0.55 + campaignState.agentRng() * 0.3,
            maintenance: 0.55 + campaignState.agentRng() * 0.3,
            exploration: 0.55 + campaignState.agentRng() * 0.3
          },
          commitments: [],
          resourceAllowance: { materials: 5 },
          infrastructurePriority: "livelihood-money",
          lastDecision: { role: "production", reason: "Joined with production as the initial assigned priority", followedAssignment: true },
          lastAutonomousAction: "Joined campaign"
        };
        events.push({
          type: "collaborator_recruited",
          name: "Alex",
          message: "Recruited Alex as autonomous collaborator"
        });
        validateInvariants(campaignState);
        continue;
      }

      if (action.type === "assign_collaborator_role") {
        if (!campaignState.collaborator) {
          events.push({ type: "collaborator_command_ineffective", message: "The collaborator resigned before the role assignment could resolve" });
          continue;
        }
        const assignmentCost = getActionCost(campaignState, action);
        if (campaignState.resources.attention < assignmentCost.attention) throw new Error("Insufficient attention to assign collaborator role");
        campaignState.resources.attention -= assignmentCost.attention;
        campaignState.collaborator.assignedRole = action.role || "production";
        events.push({
          type: "collaborator_role_assigned",
          role: campaignState.collaborator.assignedRole
        });
        validateInvariants(campaignState);
        continue;
      }

      if (action.type === "configure_collaborator") {
        if (!campaignState.collaborator) {
          events.push({ type: "collaborator_command_ineffective", message: "The collaborator resigned before configuration could resolve" });
          continue;
        }
        const configCost = getActionCost(campaignState, action);
        if (campaignState.resources.attention < configCost.attention) throw new Error("Insufficient attention to configure collaborator");
        campaignState.resources.attention -= configCost.attention;
        if (action.role) campaignState.collaborator.assignedRole = action.role;
        if (action.resourceAllowance) campaignState.collaborator.resourceAllowance = Object.assign({}, campaignState.collaborator.resourceAllowance, action.resourceAllowance);
        if (Array.isArray(action.commitments)) campaignState.collaborator.commitments = action.commitments.slice();
        if (action.infrastructurePriority && campaignState.domains[action.infrastructurePriority]) {
          campaignState.collaborator.infrastructurePriority = action.infrastructurePriority;
        }
        events.push({ type: "collaborator_configured", role: campaignState.collaborator.assignedRole, infrastructurePriority: campaignState.collaborator.infrastructurePriority });
        continue;
      }

      const cost = getActionCost(campaignState, action);

      // Validate resources
      for (const [resKey, amount] of Object.entries(cost)) {
        if (amount > 0) {
          const avail = campaignState.resources[resKey] || 0;
          if (avail < amount) {
            throw new Error(`Insufficient resource ${resKey}: required ${amount}, available ${avail}`);
          }
        }
      }

      // Deduct resource costs
      for (const [resKey, amount] of Object.entries(cost)) {
        if (amount > 0) {
          campaignState.resources[resKey] -= amount;
        }
      }

      campaignState.phase = "resolve";

      const targetId = action.targetDomain;
      const targetDomain = targetId && campaignState.domains[targetId] ? campaignState.domains[targetId] : null;

      if (action.type === "animal_operation" && action.animal && targetDomain) {
        const animalName = action.animal;
        const pathwayTarget = action.pathwayTarget || DEFAULT_PATHWAY_TARGET[animalName];

        if (animalName === "Consume") {
          let gainFactor = 1.0;
          if (targetDomain.evidenceCoverage >= 0.8) {
            gainFactor = 0.25;
            events.push({
              type: "opportunity_cost_penalty",
              animal: animalName,
              domain: targetId,
              message: "Endless exploration yields diminishing evidence returns"
            });
          }

          const beforeCoverage = targetDomain.evidenceCoverage;
          targetDomain.evidenceCoverage = Math.min(1.0, targetDomain.evidenceCoverage + 0.2 * gainFactor);
          targetDomain.evidenceConfidence = Math.min(1.0, targetDomain.evidenceConfidence + 0.15 * gainFactor);
          targetDomain.evidenceStaleness = Math.max(0, targetDomain.evidenceStaleness - 0.35 * gainFactor);
          campaignState.resources.evidence = Math.min(campaignState.resourceCaps.evidence, (campaignState.resources.evidence || 0) + Math.round(10 * gainFactor));
          if (targetDomain.evidenceCoverage > beforeCoverage) campaignState.adaptation.Oe = Math.min(0.15, campaignState.adaptation.Oe + 0.01);

          events.push({
            type: "animal_operation_executed",
            animal: animalName,
            targetDomain: targetId,
            newCoverage: targetDomain.evidenceCoverage,
            newConfidence: targetDomain.evidenceConfidence
          });
        } else if (animalName === "Sleep") {
          const evidenceQuality = targetDomain.evidenceCoverage * targetDomain.evidenceConfidence * (1 - targetDomain.evidenceStaleness);
          let consolidationGain = (pathwayTarget === "condition" ? 0.05 : 0.15) * evidenceQuality;
          if (evidenceQuality < 0.4) {
            targetDomain.volatility = Math.min(1.0, targetDomain.volatility + 0.1);
            targetDomain.epistemicDebt = Math.min(1, targetDomain.epistemicDebt + 0.12);
            consolidationGain = Math.min(consolidationGain, 0.03);
            events.push({
              type: "premature_consolidation",
              animal: animalName,
              domain: targetId,
              message: "Consolidating weak evidence creates epistemic debt and volatility"
            });
          }

          const beforePathway = targetDomain.personalPathwayQuality;
          targetDomain.personalPathwayQuality = Math.min(1.0, targetDomain.personalPathwayQuality + consolidationGain);
          const recoveryGain = (pathwayTarget === "condition" ? 20 : 10) * evidenceQuality;
          targetDomain.conditionBuffer = Math.min(targetDomain.maxCondition, targetDomain.conditionBuffer + recoveryGain);
          if (pathwayTarget === "condition") {
            campaignState.resources.vitality = Math.min(campaignState.resourceCaps.vitality, campaignState.resources.vitality + 4 * evidenceQuality);
          }
          if (targetDomain.personalPathwayQuality > beforePathway) {
            campaignState.adaptation.Oi = Math.min(0.15, campaignState.adaptation.Oi + 0.01);
            campaignState.adaptation.Di = Math.min(0.15, campaignState.adaptation.Di + 0.005);
          }

          events.push({
            type: "animal_operation_executed",
            animal: animalName,
            targetDomain: targetId,
            pathwayTarget,
            newPathwayQuality: targetDomain.personalPathwayQuality
          });
        } else if (animalName === "Play") {
          if (!campaignState.collaborator) {
            events.push({
              type: "animal_operation_ineffective",
              animal: animalName,
              domain: targetId,
              message: "Play requires an available partner for reciprocal discovery or coordination"
            });
            campaignState.focalStress = Math.min(100, campaignState.focalStress + 2);
            continue;
          }
          let gainFactor = 1.0;
          if (targetDomain.evidenceCoverage >= 0.8) {
            gainFactor = 0.5;
            events.push({
              type: "opportunity_cost_penalty",
              animal: animalName,
              domain: targetId,
              message: "Prolonged play after high coverage carries opportunity cost"
            });
          }

          const collaboratorEvidence = campaignState.collaborator.evidence[targetId] || 0;
          const disagreement = Math.abs(collaboratorEvidence - targetDomain.evidenceCoverage);
          targetDomain.evidenceConfidence = Math.min(1.0, targetDomain.evidenceConfidence + (0.04 + disagreement * 0.08) * gainFactor);
          if (pathwayTarget === "evidence") {
            targetDomain.evidenceCoverage = Math.min(1.0, targetDomain.evidenceCoverage + 0.08 * gainFactor);
            targetDomain.evidenceStaleness = Math.max(0, targetDomain.evidenceStaleness - 0.15 * gainFactor);
          } else {
            targetDomain.sharedPathwayQuality = Math.min(1.0, targetDomain.sharedPathwayQuality + 0.08 * gainFactor);
            for (const obligation of campaignState.unmetObligations) {
              if (obligation.domain === targetId) obligation.coordinated = true;
            }
          }
          campaignState.collaborator.evidence[targetId] = Math.min(1, collaboratorEvidence + 0.05 * gainFactor);
          campaignState.resources.trust = Math.min(campaignState.resourceCaps.trust, (campaignState.resources.trust || 0) + Math.round(5 * gainFactor));
          campaignState.adaptation.Oe = Math.min(0.15, campaignState.adaptation.Oe + 0.005);
          campaignState.adaptation.De = Math.min(0.15, campaignState.adaptation.De + 0.01);

          events.push({
            type: "animal_operation_executed",
            animal: animalName,
            targetDomain: targetId,
            pathwayTarget,
            newSharedQuality: targetDomain.sharedPathwayQuality
          });
        } else if (animalName === "Blast") {
          const publicationQuality = targetDomain.evidenceCoverage * targetDomain.evidenceConfidence * targetDomain.personalPathwayQuality * (1 - targetDomain.evidenceStaleness);
          let sharedGain = 0.2 * publicationQuality;
          if (publicationQuality < 0.35) {
            targetDomain.volatility = Math.min(1.0, targetDomain.volatility + 0.1);
            targetDomain.epistemicDebt = Math.min(1, targetDomain.epistemicDebt + 0.18);
            sharedGain = Math.min(sharedGain, 0.03);
            events.push({
              type: "premature_consolidation",
              animal: animalName,
              domain: targetId,
              message: "Publishing/teaching weak evidence amplifies error and volatility"
            });
          }

          const beforeShared = targetDomain.sharedPathwayQuality;
          targetDomain.sharedPathwayQuality = Math.min(1.0, targetDomain.sharedPathwayQuality + sharedGain);
          if (targetDomain.sharedPathwayQuality > beforeShared) {
            campaignState.adaptation.Oi = Math.min(0.15, campaignState.adaptation.Oi + 0.005);
            campaignState.adaptation.De = Math.min(0.15, campaignState.adaptation.De + 0.01);
          }

          events.push({
            type: "animal_operation_executed",
            animal: animalName,
            targetDomain: targetId,
            newSharedQuality: targetDomain.sharedPathwayQuality
          });
        }
      } else if (action.type === "set_maintenance_policy" && targetDomain) {
        if (action.enabled === false) {
          delete campaignState.automatedPolicies[targetId];
          events.push({ type: "maintenance_policy_removed", domain: targetId });
        } else {
          campaignState.automatedPolicies[targetId] = {
            enabled: true,
            inspectionAge: 0,
            staleness: Math.max(0, 1 - (targetDomain.personalPathwayQuality + targetDomain.sharedPathwayQuality) / 2),
            installedTurn: currentTurn
          };
          events.push({ type: "maintenance_policy_installed", domain: targetId });
        }
      } else if (action.type === "maintain" && targetDomain) {
        targetDomain.conditionBuffer = Math.min(targetDomain.maxCondition, targetDomain.conditionBuffer + 25.0);
        targetDomain.maintenancePaid += Object.values(cost).reduce((sum, value) => sum + value, 0);
        events.push({
          type: "action_executed",
          actionType: "maintain",
          targetDomain: targetId,
          newConditionBuffer: targetDomain.conditionBuffer
        });
      } else if ((action.type === "acquire" || action.type === "invest_domain") && targetDomain) {
        const acquisitionGain = calculateAcquisitionGain(targetDomain);
        const evidenceQuality = targetDomain.evidenceCoverage * targetDomain.evidenceConfidence * (1 - targetDomain.evidenceStaleness);
        targetDomain.level += acquisitionGain;
        targetDomain.conditionBuffer = Math.min(targetDomain.maxCondition, targetDomain.conditionBuffer + 5.0 * acquisitionGain / 0.25);
        targetDomain.acquisitionInvested += Object.values(cost).reduce((sum, value) => sum + value, 0);
        campaignState.pendingFeedback.push({
          domain: targetId,
          sourceTurn: currentTurn,
          dueTurn: currentTurn + targetDomain.feedbackLatency,
          evidenceQuality,
          signal: campaignState.feedbackRng()
        });
        
        const newTier = getDomainTier(targetDomain.level);
        if (newTier !== targetDomain.tier) {
          const oldTier = targetDomain.tier;
          targetDomain.tier = newTier;
          if (newTier > oldTier) campaignState.reputation += (newTier - oldTier) * 2;
          events.push({
            type: "tier_transition",
            domain: targetId,
            oldTier: oldTier,
            newTier: newTier
          });
        }

        events.push({
          type: "action_executed",
          actionType: action.type,
          targetDomain: targetId,
          acquisitionGain: acquisitionGain,
          newLevel: targetDomain.level
        });
      } else {
        events.push({
          type: "action_executed",
          actionType: action.type || "custom"
        });
      }

      validateInvariants(campaignState);
    }

    // Phase 5: debrief
    campaignState.phase = "debrief";
    const pressureReport = calculatePressureReport(campaignState);
    const turnSummary = {
      turn: currentTurn,
      era: campaignState.era,
      events: events,
      causalTrace: causalTrace,
      resourcesSnapshot: deepClone(campaignState.resources),
      polarityPressures: pressureReport.pressure,
      pressureDrivers: pressureReport.drivers,
      unmetObligations: deepClone(campaignState.unmetObligations)
    };

    campaignState.history.push(turnSummary);
    if (currentTurn >= campaignState.horizon) {
      campaignState.completed = true;
      campaignState.outcome = evaluateCampaignDiagnostics(campaignState, campaignState.mission);
    }
    campaignState.turn += 1;
    campaignState.phase = "updateWorld";

    validateInvariants(campaignState);

    return deepFreeze({
      turn: currentTurn,
      summary: deepClone(turnSummary),
      snapshot: getSnapshot(campaignState)
    });
  }

  function evaluateViability(campaignState, mission) {
    const activeMission = mission || (campaignState && campaignState.mission);
    if (!campaignState || !activeMission) {
      return { isViable: false, violations: ["Missing campaignState or mission parameter"] };
    }

    const violations = [];
    const floors = activeMission.viabilityFloors || {};

    for (const [domainId, floor] of Object.entries(floors)) {
      const domain = campaignState.domains[domainId];
      if (!domain) {
        violations.push(`Domain ${domainId} not found in campaign`);
        continue;
      }
      if (typeof floor.minLevel === "number" && domain.level < floor.minLevel) {
        violations.push(`Domain ${domainId} level ${domain.level.toFixed(2)} is below minimum floor ${floor.minLevel}`);
      }
      if (typeof floor.conditionBuffer === "number" && domain.conditionBuffer < floor.conditionBuffer) {
        violations.push(`Domain ${domainId} condition buffer ${domain.conditionBuffer.toFixed(2)} is below minimum floor ${floor.conditionBuffer}`);
      }
    }

    return {
      isViable: violations.length === 0,
      violations: violations
    };
  }

  function evaluateCampaignDiagnostics(campaignState, mission) {
    const activeMission = mission || campaignState.mission;
    const viability = evaluateViability(campaignState, activeMission);
    const domainList = Object.values(campaignState.domains || {});
    const targetEntries = Object.entries(activeMission.targetLevels || {});
    const targetProgress = targetEntries.map(([domainId, target]) => {
      const domain = campaignState.domains[domainId];
      return domain ? Math.min(1, domain.level / target) : 0;
    });
    const missionProgress = targetProgress.length
      ? targetProgress.reduce((sum, value) => sum + value, 0) / targetProgress.length
      : 0;
    const missionAccomplished = targetProgress.length > 0 && targetProgress.every((value) => value >= 1) && viability.isViable;

    const relevantDomainIds = [...new Set([
      ...targetEntries.map(([domainId]) => domainId),
      ...Object.keys(activeMission.viabilityFloors || {})
    ])];
    const relevantCondition = relevantDomainIds.length
      ? relevantDomainIds.reduce((sum, domainId) => {
        const domain = campaignState.domains[domainId];
        return sum + (domain ? domain.conditionBuffer / domain.maxCondition : 0);
      }, 0) / relevantDomainIds.length
      : 0;

    const maintenancePaid = domainList.reduce((sum, domain) => sum + domain.maintenancePaid, 0);
    const maintenanceMissed = domainList.reduce((sum, domain) => sum + domain.maintenanceMissed, 0);
    const pathwayReturns = domainList.reduce((sum, domain) => sum + domain.pathwayReturns.personal + domain.pathwayReturns.shared, 0);
    const maintenanceEfficiencyScore = Math.round(100 * pathwayReturns / Math.max(1, maintenancePaid + maintenanceMissed + pathwayReturns));
    const crisisEvents = campaignState.history.flatMap((turn) => turn.events).filter((event) => [
      "maintenance_deficit", "level_degradation", "collaborator_resigned", "automation_deficit"
    ].includes(event.type));
    const shockEvents = campaignState.history.flatMap((turn) => turn.events).filter((event) => event.type === "world_shock");
    const shockResilienceScore = Math.max(0, Math.min(100, Math.round(
      relevantCondition * 70 + (viability.isViable ? 20 : 0) + Math.max(0, 10 - crisisEvents.length * 2)
    )));
    const policyQualityScore = Math.max(0, Math.min(100, Math.round(
      missionProgress * 65 + (viability.isViable ? 20 : 0) + relevantCondition * 15
    )));

    return {
      missionId: activeMission.id,
      missionProgress,
      missionAccomplished,
      campaignCompleted: campaignState.completed,
      policyQualityScore: policyQualityScore,
      shockResilienceScore: shockResilienceScore,
      maintenanceEfficiencyScore: maintenanceEfficiencyScore,
      viabilityCompliance: viability,
      maintenancePaid,
      maintenanceMissed,
      pathwayReturns,
      crisisCount: crisisEvents.length,
      shockCount: shockEvents.length,
      unresolvedFragility: calculatePressureReport(campaignState).drivers,
      success: campaignState.completed && missionAccomplished
    };
  }

  function runCounterfactualReplay(baseOptions = {}, policies = []) {
    const turns = baseOptions.turns || baseOptions.horizon || DEFAULT_HORIZON;
    const results = [];

    for (const policy of policies) {
      const campaign = createCampaign(baseOptions);
      const actionsPerTurn = policy.actionsPerTurn || [];

      for (let t = 0; t < turns && !campaign.completed; t++) {
        const turnActions = typeof policy.decide === "function"
          ? (policy.decide(getSnapshot(campaign), t) || [])
          : (actionsPerTurn[t] || []);
        stepTurn(campaign, turnActions);
      }

      const snapshot = getSnapshot(campaign);
      const diagnostics = evaluateCampaignDiagnostics(campaign);

      results.push({
        name: policy.name || "Unnamed Policy",
        snapshot: snapshot,
        history: snapshot.history || [],
        diagnostics: diagnostics,
        shockSignature: snapshot.history.flatMap((turn) => turn.events)
          .filter((event) => event.type === "world_shock")
          .map((event) => `${event.shockType}:${event.targetDomain}`)
      });
    }

    return {
      baseOptions: baseOptions,
      controlledVariables: ["seed", "origin", "mission", "shock schedule", "horizon", "profile", "domain initialization", "collaborator initialization"],
      policies: results
    };
  }

  function previewAction(campaignState, action) {
    const projectedEffects = [];
    const warnings = [];

    if (!action || typeof action !== "object") return { cost: {}, projectedEffects, warnings, affordable: false };
    if (!ACTION_BASE_COSTS[action.type] && action.type !== "animal_operation") {
      return { cost: {}, projectedEffects, warnings: [`Unknown campaign action: ${action.type}`], affordable: false };
    }
    if (action.type === "animal_operation" && !ANIMALS[action.animal]) {
      return { cost: {}, projectedEffects, warnings: [`Unknown animal operation: ${action.animal}`], affordable: false };
    }
    if (action.type === "animal_operation" && action.pathwayTarget
        && !ANIMAL_PATHWAY_TARGETS[action.animal].includes(action.pathwayTarget)) {
      return { cost: {}, projectedEffects, warnings: [`${action.animal} cannot target pathway layer ${action.pathwayTarget}`], affordable: false };
    }
    const domain = action.targetDomain ? campaignState.domains[action.targetDomain] : null;
    const requiresDomain = ["animal_operation", "maintain", "acquire", "invest_domain", "set_maintenance_policy"].includes(action.type);
    if (requiresDomain && !domain) {
      return { cost: {}, projectedEffects, warnings: [`Unknown target domain: ${action.targetDomain}`], affordable: false };
    }
    const cost = getActionCost(campaignState, action);
    if (action.type === "recruit_collaborator") {
      projectedEffects.push("Recruit one autonomous collaborator with private goals and evidence");
      projectedEffects.push("Adds capacity plus compensation, trust, and coordination overhead");
    } else if (action.type === "assign_collaborator_role" || action.type === "configure_collaborator") {
      projectedEffects.push("Changes collaborator priority; autonomous behavior may still diverge");
    } else if (action.type === "acquire" || action.type === "invest_domain") {
      const gain = domain ? calculateAcquisitionGain(domain) : 0;
      projectedEffects.push(`+${gain.toFixed(2)} development level from current evidence and pathways`);
      projectedEffects.push("+5 condition buffer");
      if (domain && getDomainTier(domain.level + gain) > domain.tier) projectedEffects.push("Reaches a new capacity tier");
      if (gain < 0.22) warnings.push("Weak or stale evidence/pathways make this acquisition inefficient");
    } else if (action.type === "maintain") {
      projectedEffects.push("+25 condition buffer, capped by domain capacity");
    } else if (action.type === "set_maintenance_policy") {
      projectedEffects.push("Automates recurring maintenance with no per-turn attention cost");
      warnings.push("Automation continues consuming materials and becomes stale without inspection");
    } else if (action.type === "animal_operation" && domain) {
      const quality = domain.evidenceCoverage * domain.evidenceConfidence * (1 - domain.evidenceStaleness);
      if (action.animal === "Consume") {
        projectedEffects.push("Refreshes private evidence and reduces staleness");
        if (domain.evidenceCoverage >= 0.8) warnings.push("High coverage creates diminishing exploration returns");
      } else if (action.animal === "Sleep") {
        projectedEffects.push(action.pathwayTarget === "condition"
          ? "Prioritizes recovery while lightly rehearsing evidenced personal pathways"
          : "Converts evidenced experience into personal pathway quality and recovery");
        if (quality < 0.4) warnings.push("Weak evidence limits consolidation and creates epistemic debt");
      } else if (action.animal === "Play") {
        projectedEffects.push(action.pathwayTarget === "shared"
          ? "Coordinates with a partner to improve a shared pathway"
          : "Reconciles private evidence with an available partner");
        if (!campaignState.collaborator) warnings.push("No partner is available; reciprocal benefits will not occur");
      } else if (action.animal === "Blast") {
        projectedEffects.push("Builds shared pathway quality from credible personal knowledge");
        if (quality * domain.personalPathwayQuality < 0.35) warnings.push("Weak publication quality amplifies error and limits shared gains");
      }
    }

    const affordable = Object.entries(cost).every(([resource, amount]) => {
      const available = resource === "attention"
        ? Math.max(campaignState.resources[resource] || 0, 12)
        : (campaignState.resources[resource] || 0);
      return available >= amount;
    });
    if (!affordable) warnings.push("Current resources cannot fund this action");
    return { cost, projectedEffects, warnings, affordable };
  }

  function getSnapshot(campaignState) {
    const clone = deepClone(campaignState);
    delete clone.worldRng;
    delete clone.agentRng;
    delete clone.feedbackRng;
    const pressureReport = calculatePressureReport(campaignState);
    clone.polarityPressures = pressureReport.pressure;
    clone.pressureDrivers = pressureReport.drivers;
    clone.diagnostics = evaluateCampaignDiagnostics(campaignState);
    return deepFreeze(clone);
  }

  return {
    RESOURCE_TYPES,
    ACTION_BASE_COSTS,
    RESOURCE_CAPS,
    DEFAULT_HORIZON,
    ANIMALS,
    ANIMAL_PATHWAY_TARGETS,
    DOMAIN_PRESETS,
    ORIGIN_PRESETS,
    MISSION_PRESETS,
    SHOCK_SCHEDULES,
    getDomainTier,
    calculateAnimalCost,
    getActionCost,
    calculateAcquisitionGain,
    calculatePolarityPressures,
    calculatePressureReport,
    checkRecruitmentEligibility,
    createCampaign,
    stepTurn,
    evaluateViability,
    evaluateCampaignDiagnostics,
    runCounterfactualReplay,
    previewAction,
    getSnapshot,
    validateInvariants
  };
});
