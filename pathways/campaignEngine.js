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

  function calculateAnimalCost(animalName, agentProfile, customBaseCost) {
    const animal = ANIMALS[animalName];
    if (!animal) {
      throw new Error(`Unknown animal operation: ${animalName}`);
    }

    const profile = agentProfile || { observerCoin: "Oe", deciderCoin: "Di", primaryAxis: "observer" };
    const isObserverSavior = animal.observer === profile.observerCoin;
    const isDeciderSavior = animal.decider === profile.deciderCoin;

    let multiplier = 1.0;
    if (isObserverSavior && isDeciderSavior) {
      multiplier = 1.0;
    } else if (isObserverSavior || isDeciderSavior) {
      multiplier = 1.4;
    } else {
      multiplier = 1.8;
    }

    const baseCost = customBaseCost || animal.baseCost;
    const calculatedCost = {};
    for (const [resKey, amount] of Object.entries(baseCost)) {
      calculatedCost[resKey] = Math.ceil(amount * multiplier);
    }
    return calculatedCost;
  }

  function checkRecruitmentEligibility(campaignState) {
    const reasons = [];

    if (campaignState.collaborator) {
      reasons.push("Collaborator already recruited");
      return { eligible: false, reasons: reasons };
    }

    const materials = campaignState.resources ? (campaignState.resources.materials || 0) : 0;
    const trust = campaignState.resources ? (campaignState.resources.trust || 0) : 0;

    if (materials < 40) {
      reasons.push(`Insufficient materials: ${materials}/40 required`);
    }
    if (trust < 30) {
      reasons.push(`Insufficient trust: ${trust}/30 required`);
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

  function calculatePolarityPressures(campaignState) {
    const domains = campaignState.domains || {};
    const domainList = Object.values(domains);

    if (domainList.length === 0) {
      return { Oe: 0, Oi: 0, Di: 0, De: 0 };
    }

    let totalOeUncertainty = 0;
    for (const d of domainList) {
      totalOeUncertainty += (1.0 - (d.evidenceCoverage || 0)) * 50 + (d.volatility || 0) * 50;
    }
    const OePressure = Math.min(100, Math.round(totalOeUncertainty / domainList.length));

    let totalOiFragility = 0;
    for (const d of domainList) {
      totalOiFragility += (1.0 - (d.personalPathwayQuality || 0)) * 100;
    }
    const OiPressure = Math.min(100, Math.round(totalOiFragility / domainList.length));

    const bodyDomain = domains["body-health"];
    const healthDeficit = bodyDomain ? (100.0 - bodyDomain.conditionBuffer) : 50;
    const DiPressure = Math.min(100, Math.round(healthDeficit * 0.7 + (1.0 - (bodyDomain ? bodyDomain.personalPathwayQuality : 0.5)) * 30));

    let totalDeFragility = 0;
    for (const d of domainList) {
      totalDeFragility += (1.0 - (d.sharedPathwayQuality || 0)) * 100;
    }
    const trustDeficit = Math.max(0, 50 - (campaignState.resources.trust || 0));
    const DePressure = Math.min(100, Math.round((totalDeFragility / domainList.length) * 0.7 + trustDeficit * 0.6));

    return {
      Oe: OePressure,
      Oi: OiPressure,
      Di: DiPressure,
      De: DePressure
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
      shockSchedule: shockKey,
      focalProfile: focalProfile,
      resources: initialResources,
      domains: domains,
      collaborator: null,
      automatedPolicies: {},
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

    const currentTurn = campaignState.turn;
    const events = [];
    const causalTrace = [];

    // Phase 1: updateWorld - Process passive outputs, shocks, collaborator overhead & inter-domain dependencies
    campaignState.phase = "updateWorld";

    // Process World Shocks using worldRng stream
    const schedule = SHOCK_SCHEDULES[campaignState.shockSchedule] || SHOCK_SCHEDULES["stable-horizon"];
    if (schedule.fixedShocks && schedule.fixedShocks[currentTurn]) {
      const fixed = schedule.fixedShocks[currentTurn];
      const targetDomain = campaignState.domains[fixed.domain];
      if (targetDomain) {
        if (fixed.type === "evidentiary_shock") {
          targetDomain.evidenceCoverage = Math.max(0, targetDomain.evidenceCoverage - 0.4);
          targetDomain.evidenceConfidence = Math.max(0, targetDomain.evidenceConfidence - 0.5);
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
          campaignState.resources.materials = Math.max(0, (campaignState.resources.materials || 0) - 10);
          events.push({
            type: "world_shock",
            shockType: fixed.type,
            targetDomain: fixed.domain,
            message: `Obligation shock consumed materials on ${fixed.domain}`
          });
          causalTrace.push(`World shock (${fixed.type}) created urgent material obligation.`);
        }
      }
    }

    // Process Collaborator Overhead & Resignation
    if (campaignState.collaborator) {
      const collab = campaignState.collaborator;
      const compRate = collab.compensationRate || 2;
      const trustCost = collab.trustOverhead || 1;

      // Compensation
      if ((campaignState.resources.materials || 0) >= compRate) {
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
      if ((campaignState.resources.trust || 0) >= trustCost) {
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
        const role = collab.assignedRole || "production";
        if (role === "production") {
          const matDomain = campaignState.domains["livelihood-money"];
          if (matDomain) {
            campaignState.resources.materials += 10;
            collab.lastAutonomousAction = "Boosted material production (+10 materials)";
            events.push({
              type: "collaborator_action",
              role: role,
              action: collab.lastAutonomousAction
            });
          }
        } else if (role === "maintenance") {
          const healthDomain = campaignState.domains["body-health"];
          if (healthDomain) {
            healthDomain.conditionBuffer = Math.min(100.0, healthDomain.conditionBuffer + 15.0);
            collab.lastAutonomousAction = "Maintained body-health condition buffer (+15 buffer)";
            events.push({
              type: "collaborator_action",
              role: role,
              action: collab.lastAutonomousAction
            });
          }
        } else if (role === "exploration") {
          const expDomain = campaignState.domains["understanding-judgment"];
          if (expDomain) {
            expDomain.evidenceCoverage = Math.min(1.0, expDomain.evidenceCoverage + 0.15);
            collab.lastAutonomousAction = "Explored understanding-judgment (+15% coverage)";
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
    for (const [id, domain] of Object.entries(campaignState.domains)) {
      let bottleneckMultiplier = 1.0;
      if (Array.isArray(domain.dependencyEdges)) {
        for (const edge of domain.dependencyEdges) {
          const parent = campaignState.domains[edge.target];
          if (parent) {
            const parentHealth = parent.conditionBuffer / 100.0;
            if (parentHealth < 0.5) {
              let factor = (1 - edge.weight) + edge.weight * (parentHealth / 0.5);
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
              causalTrace.push(`Dependency bottleneck: ${id} output throttled by parent ${edge.target}.`);
            }
          }
        }
      }

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

      // Obligations & Maintenance
      const pathwayEfficiency = 1.0 + 0.5 * (domain.personalPathwayQuality + domain.sharedPathwayQuality);
      for (const [resKey, baseCost] of Object.entries(domain.obligations || {})) {
        const scaledCost = (baseCost * domain.level * (1 + domain.volatility)) / pathwayEfficiency;
        if (campaignState.resources[resKey] && campaignState.resources[resKey] >= scaledCost) {
          campaignState.resources[resKey] -= scaledCost;
        } else {
          const deficit = scaledCost - (campaignState.resources[resKey] || 0);
          campaignState.resources[resKey] = 0;
          domain.conditionBuffer = Math.max(0, domain.conditionBuffer - deficit * 5);
          
          events.push({
            type: "maintenance_deficit",
            domain: id,
            unmetCost: deficit
          });
          causalTrace.push(`Maintenance deficit in ${id}: unmet ${resKey} cost ${deficit.toFixed(2)} drained condition buffer.`);

          if (domain.conditionBuffer === 0) {
            const levelLoss = Math.min(domain.level, 0.05);
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
      }
    }

    // Phase 2: observe
    campaignState.phase = "observe";

    // Phase 3 & 4: allocate & resolve actions
    campaignState.phase = "allocate";

    for (const action of actions) {
      if (!action || typeof action !== "object") continue;

      if (action.type === "recruit_collaborator") {
        const eligibility = checkRecruitmentEligibility(campaignState);
        if (!eligibility.eligible) {
          throw new Error(`Ineligible for recruitment: ${eligibility.reasons.join(", ")}`);
        }
        campaignState.resources.materials -= 25;
        campaignState.resources.trust -= 15;
        campaignState.collaborator = {
          id: "collab-1",
          name: "Alex",
          profile: { observerCoin: "Oi", deciderCoin: "De", primaryAxis: "decider" },
          assignedRole: "production",
          alignment: 0.85,
          compensationRate: 2,
          trustOverhead: 1,
          lastAutonomousAction: "Joined campaign"
        };
        events.push({
          type: "collaborator_recrypted",
          name: "Alex",
          message: "Recruited Alex as autonomous collaborator"
        });
        validateInvariants(campaignState);
        continue;
      }

      if (action.type === "assign_collaborator_role") {
        if (!campaignState.collaborator) {
          throw new Error("No active collaborator to assign role");
        }
        campaignState.collaborator.assignedRole = action.role || "production";
        events.push({
          type: "collaborator_role_assigned",
          role: campaignState.collaborator.assignedRole
        });
        validateInvariants(campaignState);
        continue;
      }

      let cost = action.cost || {};
      if (action.type === "animal_operation" && action.animal) {
        cost = calculateAnimalCost(action.animal, campaignState.focalProfile, action.cost);
      }

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

          targetDomain.evidenceCoverage = Math.min(1.0, targetDomain.evidenceCoverage + 0.2 * gainFactor);
          targetDomain.evidenceConfidence = Math.min(1.0, targetDomain.evidenceConfidence + 0.15 * gainFactor);
          campaignState.resources.evidence = (campaignState.resources.evidence || 0) + Math.round(15 * gainFactor);

          events.push({
            type: "animal_operation_executed",
            animal: animalName,
            targetDomain: targetId,
            newCoverage: targetDomain.evidenceCoverage,
            newConfidence: targetDomain.evidenceConfidence
          });
        } else if (animalName === "Sleep") {
          if (targetDomain.evidenceConfidence < 0.4) {
            targetDomain.volatility = Math.min(1.0, targetDomain.volatility + 0.1);
            events.push({
              type: "premature_consolidation",
              animal: animalName,
              domain: targetId,
              message: "Consolidating weak evidence creates epistemic debt and volatility"
            });
          }

          targetDomain.personalPathwayQuality = Math.min(1.0, targetDomain.personalPathwayQuality + 0.15);
          targetDomain.conditionBuffer = Math.min(100.0, targetDomain.conditionBuffer + 15.0);

          events.push({
            type: "animal_operation_executed",
            animal: animalName,
            targetDomain: targetId,
            newPathwayQuality: targetDomain.personalPathwayQuality
          });
        } else if (animalName === "Play") {
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

          targetDomain.evidenceConfidence = Math.min(1.0, targetDomain.evidenceConfidence + 0.1 * gainFactor);
          targetDomain.sharedPathwayQuality = Math.min(1.0, targetDomain.sharedPathwayQuality + 0.1 * gainFactor);
          campaignState.resources.trust = (campaignState.resources.trust || 0) + Math.round(15 * gainFactor);

          events.push({
            type: "animal_operation_executed",
            animal: animalName,
            targetDomain: targetId,
            newSharedQuality: targetDomain.sharedPathwayQuality
          });
        } else if (animalName === "Blast") {
          if (targetDomain.evidenceConfidence < 0.4) {
            targetDomain.volatility = Math.min(1.0, targetDomain.volatility + 0.1);
            events.push({
              type: "premature_consolidation",
              animal: animalName,
              domain: targetId,
              message: "Publishing/teaching weak evidence amplifies error and volatility"
            });
          }

          targetDomain.sharedPathwayQuality = Math.min(1.0, targetDomain.sharedPathwayQuality + 0.2);

          events.push({
            type: "animal_operation_executed",
            animal: animalName,
            targetDomain: targetId,
            newSharedQuality: targetDomain.sharedPathwayQuality
          });
        }
      } else if (action.type === "maintain" && targetDomain) {
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
      causalTrace: causalTrace,
      resourcesSnapshot: deepClone(campaignState.resources),
      polarityPressures: calculatePolarityPressures(campaignState)
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

  function evaluateCampaignDiagnostics(campaignState, mission) {
    const viability = evaluateViability(campaignState, mission);
    const domainList = Object.values(campaignState.domains || {});
    
    let totalLevel = 0;
    let totalBuffer = 0;
    for (const d of domainList) {
      totalLevel += d.level;
      totalBuffer += d.conditionBuffer;
    }
    const avgLevel = domainList.length > 0 ? totalLevel / domainList.length : 0;
    const avgBuffer = domainList.length > 0 ? totalBuffer / domainList.length : 0;

    const policyQualityScore = Math.min(100, Math.round(avgLevel * 10 + avgBuffer * 0.5));
    const shockResilienceScore = Math.min(100, Math.round(avgBuffer * 0.8 + (100 - calculatePolarityPressures(campaignState).Oe) * 0.2));
    const maintenanceEfficiencyScore = Math.min(100, Math.round((campaignState.resources.materials + campaignState.resources.vitality) * 0.8));

    return {
      policyQualityScore: policyQualityScore,
      shockResilienceScore: shockResilienceScore,
      maintenanceEfficiencyScore: maintenanceEfficiencyScore,
      viabilityCompliance: viability
    };
  }

  function runCounterfactualReplay(baseOptions = {}, policies = []) {
    const turns = baseOptions.turns || 5;
    const results = [];

    for (const policy of policies) {
      const campaignOptions = Object.assign({}, baseOptions, policy.campaignOverrides || {});
      const campaign = createCampaign(campaignOptions);
      const actionsPerTurn = policy.actionsPerTurn || [];

      for (let t = 0; t < turns; t++) {
        const turnActions = actionsPerTurn[t] || [];
        stepTurn(campaign, turnActions);
      }

      const snapshot = getSnapshot(campaign);
      const missionPreset = MISSION_PRESETS[baseOptions.mission || "entrepreneurship"];
      const diagnostics = evaluateCampaignDiagnostics(campaign, missionPreset);

      results.push({
        name: policy.name || "Unnamed Policy",
        snapshot: snapshot,
        history: snapshot.history || [],
        diagnostics: diagnostics
      });
    }

    return {
      baseOptions: baseOptions,
      policies: results
    };
  }

  function getSnapshot(campaignState) {
    const clone = deepClone(campaignState);
    delete clone.worldRng;
    delete clone.agentRng;
    delete clone.feedbackRng;
    clone.polarityPressures = calculatePolarityPressures(campaignState);
    return deepFreeze(clone);
  }

  return {
    RESOURCE_TYPES,
    ANIMALS,
    DOMAIN_PRESETS,
    ORIGIN_PRESETS,
    MISSION_PRESETS,
    SHOCK_SCHEDULES,
    getDomainTier,
    calculateAnimalCost,
    calculatePolarityPressures,
    checkRecruitmentEligibility,
    createCampaign,
    stepTurn,
    evaluateViability,
    evaluateCampaignDiagnostics,
    runCounterfactualReplay,
    getSnapshot,
    validateInvariants
  };
});
