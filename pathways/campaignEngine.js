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
      outputs: Object.freeze({ vitality: 10 }),
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
      outputs: Object.freeze({ materials: 15 }),
      dependencyEdges: Object.freeze([
        Object.freeze({ target: "body-health", weight: 0.4 })
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

  // Mulberry32 PRNG for seeded determinism
  function createPRNG(seed) {
    let s = seed >>> 0;
    return function next() {
      s = (s + 0x6d2b79f5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
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

    // Resources check
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

    // Domains check
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
      if (typeof domain.evidenceCoverage !== "number" || domain.evidenceCoverage < 0 || domain.evidenceCoverage > 1) {
        throw new Error(`Invalid evidence coverage for ${domainId}: ${domain.evidenceCoverage}`);
      }
      if (typeof domain.evidenceConfidence !== "number" || domain.evidenceConfidence < 0 || domain.evidenceConfidence > 1) {
        throw new Error(`Invalid evidence confidence for ${domainId}: ${domain.evidenceConfidence}`);
      }
      if (typeof domain.personalPathwayQuality !== "number" || domain.personalPathwayQuality < 0 || domain.personalPathwayQuality > 1) {
        throw new Error(`Invalid personal pathway quality for ${domainId}: ${domain.personalPathwayQuality}`);
      }
      if (typeof domain.sharedPathwayQuality !== "number" || domain.sharedPathwayQuality < 0 || domain.sharedPathwayQuality > 1) {
        throw new Error(`Invalid shared pathway quality for ${domainId}: ${domain.sharedPathwayQuality}`);
      }
    }

    return true;
  }

  function createCampaign(options = {}) {
    const seed = typeof options.seed === "number" ? options.seed : 42;
    const initialResources = Object.assign(
      {
        attention: 20,
        vitality: 20,
        materials: 50,
        trust: 20,
        evidence: 20
      },
      options.initialResources || {}
    );

    const domains = {};
    for (const [id, preset] of Object.entries(DOMAIN_PRESETS)) {
      domains[id] = deepClone(preset);
      if (options.domains && options.domains[id]) {
        Object.assign(domains[id], options.domains[id]);
      }
    }

    const campaignState = {
      seed: seed,
      turn: 1,
      phase: "updateWorld",
      resources: initialResources,
      domains: domains,
      history: []
    };

    validateInvariants(campaignState);
    return campaignState;
  }

  function stepTurn(campaignState, actions = []) {
    validateInvariants(campaignState);

    const currentTurn = campaignState.turn;
    const events = [];

    // Phase 1: updateWorld - Process passive outputs & domain maintenance
    campaignState.phase = "updateWorld";
    for (const [id, domain] of Object.entries(campaignState.domains)) {
      // Process outputs
      for (const [resKey, amount] of Object.entries(domain.outputs || {})) {
        if (amount > 0 && RESOURCE_TYPES[resKey]) {
          campaignState.resources[resKey] = (campaignState.resources[resKey] || 0) + amount * domain.level;
          events.push({
            type: "passive_output",
            domain: id,
            resource: resKey,
            amount: amount * domain.level
          });
        }
      }

      // Process baseline obligations (consume condition buffer or resources)
      for (const [resKey, cost] of Object.entries(domain.obligations || {})) {
        const totalCost = cost * domain.level;
        if (campaignState.resources[resKey] && campaignState.resources[resKey] >= totalCost) {
          campaignState.resources[resKey] -= totalCost;
        } else {
          // Drain condition buffer if resources are lacking
          domain.conditionBuffer = Math.max(0, domain.conditionBuffer - totalCost * 5);
          events.push({
            type: "maintenance_deficit",
            domain: id,
            unmetCost: totalCost
          });
        }
      }
    }

    // Phase 2: observe
    campaignState.phase = "observe";

    // Phase 3 & 4: allocate & resolve actions
    campaignState.phase = "allocate";

    for (const action of actions) {
      if (!action || typeof action !== "object") continue;

      const cost = action.cost || {};
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
      // Execute action
      if (action.type === "invest_domain" && action.targetDomain && campaignState.domains[action.targetDomain]) {
        const domain = campaignState.domains[action.targetDomain];
        domain.level += 0.1;
        domain.conditionBuffer = Math.min(100, domain.conditionBuffer + 5);
        events.push({
          type: "action_executed",
          actionType: action.type,
          targetDomain: action.targetDomain,
          newLevel: domain.level
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
    const turnSummary = {
      turn: currentTurn,
      events: events,
      resourcesSnapshot: deepClone(campaignState.resources)
    };

    campaignState.history.push(turnSummary);
    campaignState.turn += 1;
    campaignState.phase = "updateWorld";

    validateInvariants(campaignState);

    return {
      turn: currentTurn,
      summary: turnSummary,
      snapshot: getSnapshot(campaignState)
    };
  }

  function getSnapshot(campaignState) {
    const clone = deepClone(campaignState);
    return deepFreeze(clone);
  }

  return {
    RESOURCE_TYPES,
    DOMAIN_PRESETS,
    createCampaign,
    stepTurn,
    getSnapshot,
    validateInvariants
  };
});
