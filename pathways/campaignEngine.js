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

  const TIER_THRESHOLDS = Object.freeze([
    { tier: 1, minLevel: 0.0 },
    { tier: 2, minLevel: 3.0 },
    { tier: 3, minLevel: 6.0 },
    { tier: 4, minLevel: 10.0 }
  ]);

  function getDomainTier(level) {
    let currentTier = 1;
    for (const t of TIER_THRESHOLDS) {
      if (level >= t.minLevel) {
        currentTier = t.tier;
      }
    }
    return currentTier;
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
    const originKey = options.origin && ORIGIN_PRESETS[options.origin] ? options.origin : "balanced-starter";
    const originPreset = ORIGIN_PRESETS[originKey];

    const initialResources = Object.assign(
      {},
      originPreset.initialResources,
      options.initialResources || {}
    );

    const domains = {};
    for (const [id, preset] of Object.entries(DOMAIN_PRESETS)) {
      domains[id] = deepClone(preset);
      domains[id].tier = getDomainTier(domains[id].level);

      if (originPreset.domainOverrides && originPreset.domainOverrides[id]) {
        Object.assign(domains[id], originPreset.domainOverrides[id]);
        domains[id].tier = getDomainTier(domains[id].level);
      }

      if (options.domains && options.domains[id]) {
        Object.assign(domains[id], options.domains[id]);
        domains[id].tier = getDomainTier(domains[id].level);
      }
    }

    const campaignState = {
      seed: seed,
      turn: 1,
      phase: "updateWorld",
      origin: originKey,
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

    // Phase 1: updateWorld - Process passive outputs & inter-domain dependencies
    campaignState.phase = "updateWorld";

    for (const [id, domain] of Object.entries(campaignState.domains)) {
      // Calculate dependency bottleneck multiplier
      let bottleneckMultiplier = 1.0;
      if (Array.isArray(domain.dependencyEdges)) {
        for (const edge of domain.dependencyEdges) {
          const parent = campaignState.domains[edge.target];
          if (parent) {
            const parentHealth = parent.conditionBuffer / 100.0;
            if (parentHealth < 0.5) {
              let factor = (1 - edge.weight) + edge.weight * (parentHealth / 0.5);
              // Check partial substitution
              if (edge.substituteTarget && campaignState.domains[edge.substituteTarget]) {
                const subParent = campaignState.domains[edge.substituteTarget];
                const subHealth = subParent.conditionBuffer / 100.0;
                if (subHealth > 0.5) {
                  const subBonus = (edge.maxSubstitution || 0.1) * (subHealth - 0.5);
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
            }
          }
        }
      }

      // Process domain outputs (scaled by level and dependency bottleneck)
      for (const [resKey, amount] of Object.entries(domain.outputs || {})) {
        if (amount > 0 && RESOURCE_TYPES[resKey]) {
          const actualOutput = amount * domain.level * bottleneckMultiplier;
          campaignState.resources[resKey] = (campaignState.resources[resKey] || 0) + actualOutput;
          events.push({
            type: "passive_output",
            domain: id,
            resource: resKey,
            amount: actualOutput
          });
        }
      }

      // Calculate dynamic maintenance obligation cost
      // Pathway quality lowers maintenance demand
      const pathwayEfficiency = 1.0 + 0.5 * (domain.personalPathwayQuality + domain.sharedPathwayQuality);
      for (const [resKey, baseCost] of Object.entries(domain.obligations || {})) {
        const scaledCost = (baseCost * domain.level * (1 + domain.volatility)) / pathwayEfficiency;
        if (campaignState.resources[resKey] && campaignState.resources[resKey] >= scaledCost) {
          campaignState.resources[resKey] -= scaledCost;
        } else {
          // Drain condition buffer if resources are lacking
          const deficit = scaledCost - (campaignState.resources[resKey] || 0);
          campaignState.resources[resKey] = 0;
          domain.conditionBuffer = Math.max(0, domain.conditionBuffer - deficit * 5);
          
          events.push({
            type: "maintenance_deficit",
            domain: id,
            unmetCost: deficit
          });

          // Neglect decay: If condition buffer is completely 0, degrade domain level
          if (domain.conditionBuffer === 0) {
            const levelLoss = Math.min(domain.level, 0.05);
            domain.level = Math.max(0, domain.level - levelLoss);
            events.push({
              type: "level_degradation",
              domain: id,
              levelLoss: levelLoss,
              newLevel: domain.level
            });
          }
        }
      }

      // Check tier transition
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
      const targetId = action.targetDomain;
      const targetDomain = targetId && campaignState.domains[targetId] ? campaignState.domains[targetId] : null;

      if (action.type === "maintain" && targetDomain) {
        targetDomain.conditionBuffer = Math.min(100.0, targetDomain.conditionBuffer + 25.0);
        events.push({
          type: "action_executed",
          actionType: "maintain",
          targetDomain: targetId,
          newConditionBuffer: targetDomain.conditionBuffer
        });
      } else if ((action.type === "acquire" || action.type === "invest_domain") && targetDomain) {
        targetDomain.level += 0.2;
        targetDomain.conditionBuffer = Math.min(100.0, targetDomain.conditionBuffer + 5.0);
        
        // Check tier transition
        const newTier = getDomainTier(targetDomain.level);
        if (newTier !== targetDomain.tier) {
          const oldTier = targetDomain.tier;
          targetDomain.tier = newTier;
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

  function evaluateViability(campaignState, mission) {
    if (!campaignState || !mission) {
      return { isViable: false, violations: ["Missing campaignState or mission parameter"] };
    }

    const violations = [];
    const floors = mission.viabilityFloors || {};

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

  function getSnapshot(campaignState) {
    const clone = deepClone(campaignState);
    return deepFreeze(clone);
  }

  return {
    RESOURCE_TYPES,
    DOMAIN_PRESETS,
    ORIGIN_PRESETS,
    MISSION_PRESETS,
    getDomainTier,
    createCampaign,
    stepTurn,
    evaluateViability,
    getSnapshot,
    validateInvariants
  };
});
