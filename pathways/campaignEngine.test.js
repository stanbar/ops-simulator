const assert = require("assert");
const CampaignEngine = require("./campaignEngine");

console.log("Running Pathways Campaign Engine tests...");

// 1. Module Exports & Constants
{
  assert(CampaignEngine, "CampaignEngine module should be defined");
  assert(typeof CampaignEngine.createCampaign === "function", "createCampaign should be a function");
  assert(typeof CampaignEngine.stepTurn === "function", "stepTurn should be a function");
  assert(typeof CampaignEngine.getSnapshot === "function", "getSnapshot should be a function");
  assert(typeof CampaignEngine.validateInvariants === "function", "validateInvariants should be a function");

  // Verify 6 domain presets
  const expectedDomains = [
    "body-health",
    "livelihood-money",
    "practical-foundations",
    "family-belonging",
    "understanding-judgment",
    "meaning-contribution"
  ];
  assert.strictEqual(Object.keys(CampaignEngine.DOMAIN_PRESETS).length, 6, "Should have 6 domain presets");
  for (const domainId of expectedDomains) {
    assert(CampaignEngine.DOMAIN_PRESETS[domainId], `Preset ${domainId} should exist`);
    const preset = CampaignEngine.DOMAIN_PRESETS[domainId];
    assert(preset.id, `Preset ${domainId} should have an id`);
    assert(preset.name, `Preset ${domainId} should have a name`);
    assert(preset.description, `Preset ${domainId} should have a description`);
  }

  // Verify 5 resource types
  const expectedResources = ["attention", "vitality", "materials", "trust", "evidence"];
  assert.strictEqual(Object.keys(CampaignEngine.RESOURCE_TYPES).length, 5, "Should have 5 resource types");
  for (const resKey of expectedResources) {
    assert.strictEqual(CampaignEngine.RESOURCE_TYPES[resKey], resKey, `Resource type ${resKey} should exist`);
  }

  // Verify Origin and Mission presets (Issue #21)
  assert(CampaignEngine.ORIGIN_PRESETS, "ORIGIN_PRESETS should exist");
  assert(CampaignEngine.ORIGIN_PRESETS["balanced-starter"], "balanced-starter origin preset should exist");
  assert(CampaignEngine.ORIGIN_PRESETS["struggling-body"], "struggling-body origin preset should exist");
  assert(CampaignEngine.ORIGIN_PRESETS["asset-rich-isolated"], "asset-rich-isolated origin preset should exist");

  assert(CampaignEngine.MISSION_PRESETS, "MISSION_PRESETS should exist");
  assert(CampaignEngine.MISSION_PRESETS["entrepreneurship"], "entrepreneurship mission preset should exist");
  assert(CampaignEngine.MISSION_PRESETS["holistic-resilience"], "holistic-resilience mission preset should exist");
}

// 2. Campaign Initialization & Initial State
{
  const campaign = CampaignEngine.createCampaign({ seed: 42 });
  assert.strictEqual(campaign.turn, 1, "Initial turn should be 1");
  assert.strictEqual(campaign.seed, 42, "Seed should be stored");

  // Check resource initialization
  for (const resKey of ["attention", "vitality", "materials", "trust", "evidence"]) {
    assert(typeof campaign.resources[resKey] === "number", `Resource ${resKey} should be a number`);
    assert(campaign.resources[resKey] >= 0, `Resource ${resKey} should be non-negative`);
  }

  // Check 6 domain states in campaign
  for (const domainId of Object.keys(CampaignEngine.DOMAIN_PRESETS)) {
    const domainState = campaign.domains[domainId];
    assert(domainState, `Domain state for ${domainId} should exist`);
    assert(typeof domainState.level === "number" && domainState.level >= 0, `Level for ${domainId} should be non-negative`);
    assert(typeof domainState.tier === "number" && domainState.tier >= 1, `Tier for ${domainId} should be >= 1`);
    assert(typeof domainState.conditionBuffer === "number" && domainState.conditionBuffer >= 0, `Condition buffer for ${domainId} should be non-negative`);
    assert(typeof domainState.evidenceCoverage === "number" && domainState.evidenceCoverage >= 0 && domainState.evidenceCoverage <= 1, `Evidence coverage for ${domainId} should be between 0 and 1`);
    assert(typeof domainState.evidenceConfidence === "number" && domainState.evidenceConfidence >= 0 && domainState.evidenceConfidence <= 1, `Evidence confidence for ${domainId} should be between 0 and 1`);
    assert(typeof domainState.personalPathwayQuality === "number" && domainState.personalPathwayQuality >= 0 && domainState.personalPathwayQuality <= 1, `Personal pathway quality for ${domainId} should be between 0 and 1`);
    assert(typeof domainState.sharedPathwayQuality === "number" && domainState.sharedPathwayQuality >= 0 && domainState.sharedPathwayQuality <= 1, `Shared pathway quality for ${domainId} should be between 0 and 1`);
    assert(typeof domainState.volatility === "number", `Volatility for ${domainId} should be a number`);
    assert(domainState.obligations && typeof domainState.obligations === "object", `Obligations for ${domainId} should be an object`);
    assert(domainState.outputs && typeof domainState.outputs === "object", `Outputs for ${domainId} should be an object`);
    assert(Array.isArray(domainState.dependencyEdges), `Dependency edges for ${domainId} should be an array`);
  }

  // Invariants check on initial campaign
  assert.doesNotThrow(() => CampaignEngine.validateInvariants(campaign), "Initial campaign should pass invariant checks");
}

// 3. Rolling Tiers & Tier Transitions (Issue #21)
{
  const campaign = CampaignEngine.createCampaign({ seed: 100 });
  const domain = campaign.domains["body-health"];
  assert.strictEqual(domain.tier, 1, "Initial tier at level 1.0 should be 1");

  // Upgrade level past tier 2 threshold (3.0)
  domain.level = 3.2;
  const result = CampaignEngine.stepTurn(campaign, []);
  assert.strictEqual(domain.tier, 2, "Tier should transition to 2 when level reaches 3.2");
  
  // Check tier transition event in summary
  const transitionEvent = result.summary.events.find(e => e.type === "tier_transition" && e.domain === "body-health");
  assert(transitionEvent, "Should emit tier_transition event upon tier increase");
  assert.strictEqual(transitionEvent.newTier, 2, "Transition event should report new tier 2");
}

// 4. Maintenance vs. Acquisition Accounting & Decay (Issue #21)
{
  // Test Maintain Action (replenishes condition buffer without increasing level)
  const campaign = CampaignEngine.createCampaign({ seed: 200 });
  const domain = campaign.domains["body-health"];
  domain.conditionBuffer = 50.0;
  const initialLevel = domain.level;

  CampaignEngine.stepTurn(campaign, [
    { type: "maintain", targetDomain: "body-health", cost: { attention: 2, vitality: 1 } }
  ]);

  assert(domain.conditionBuffer > 50.0, "Maintain action should increase condition buffer");
  assert.strictEqual(domain.level, initialLevel, "Maintain action should NOT increase domain level");

  // Test Acquire Action (increases level)
  CampaignEngine.stepTurn(campaign, [
    { type: "acquire", targetDomain: "body-health", cost: { attention: 3, vitality: 2 } }
  ]);
  assert(domain.level > initialLevel, "Acquire action should increase domain level");

  // Test Neglect Decay: condition buffer drains first before level degradation
  const neglectCampaign = CampaignEngine.createCampaign({
    seed: 201,
    initialResources: { attention: 0, vitality: 0, materials: 0, trust: 0, evidence: 0 }
  });
  
  const targetDomain = neglectCampaign.domains["body-health"];
  targetDomain.outputs = {};
  targetDomain.conditionBuffer = 20.0;
  const startLevel = targetDomain.level;

  // Turn 1: condition buffer drains partial amount (from 20.0 to ~12.6)
  CampaignEngine.stepTurn(neglectCampaign, []);
  assert(targetDomain.conditionBuffer > 0 && targetDomain.conditionBuffer < 20.0, "Condition buffer should drain partially under neglect");
  assert.strictEqual(targetDomain.level, startLevel, "Level should not degrade while condition buffer remains above 0");

  // Force condition buffer to 0 to test level degradation on subsequent turn
  targetDomain.conditionBuffer = 0;
  CampaignEngine.stepTurn(neglectCampaign, []);
  assert(targetDomain.level < startLevel, "Continued neglect with 0 condition buffer must degrade domain level");
}

// 5. Inter-Domain Dependencies & Partial Substitution (Issue #21)
{
  const campaign = CampaignEngine.createCampaign({ seed: 300 });
  
  // Deplete body-health condition buffer
  campaign.domains["body-health"].conditionBuffer = 0;
  campaign.domains["body-health"].level = 0.5;

  const result = CampaignEngine.stepTurn(campaign, []);
  
  // Livelihood-money depends on body-health. Check that dependency bottleneck event or output throttling occurs
  const bottleneckEvent = result.summary.events.find(e => e.type === "dependency_bottleneck" && e.domain === "livelihood-money");
  assert(bottleneckEvent, "Should record dependency bottleneck event when parent domain is impaired");
}

// 6. Campaign Origins & Mission Viability Floors (Issue #21)
{
  // Test creating campaign with origin preset
  const campaign = CampaignEngine.createCampaign({
    seed: 500,
    origin: "struggling-body"
  });

  assert.strictEqual(campaign.origin, "struggling-body", "Campaign origin should be recorded");
  assert(campaign.domains["body-health"].conditionBuffer < 50.0, "Struggling body origin should have low health condition buffer");

  // Evaluate mission viability
  const viability = CampaignEngine.evaluateViability(campaign, CampaignEngine.MISSION_PRESETS["entrepreneurship"]);
  assert(typeof viability === "object", "evaluateViability should return an evaluation object");
  assert(typeof viability.isViable === "boolean", "isViable should be a boolean");
  assert(Array.isArray(viability.violations), "violations should be an array");
}

// 7. Resource Invariants & Validation
{
  const campaign = CampaignEngine.createCampaign({ seed: 100 });
  
  // Negative resource should fail invariant check
  campaign.resources.attention = -5;
  assert.throws(() => CampaignEngine.validateInvariants(campaign), /negative resource/i, "Negative resource should throw invariant error");

  // Reset resource
  campaign.resources.attention = 10;
  assert.doesNotThrow(() => CampaignEngine.validateInvariants(campaign));

  // Invalid domain level should fail invariant check
  campaign.domains["body-health"].level = -1;
  assert.throws(() => CampaignEngine.validateInvariants(campaign), /negative domain level/i, "Negative level should throw invariant error");
}

// 8. Snapshot Immutability & Determinism
{
  const c1 = CampaignEngine.createCampaign({ seed: 4242 });
  const c2 = CampaignEngine.createCampaign({ seed: 4242 });

  CampaignEngine.stepTurn(c1, []);
  CampaignEngine.stepTurn(c2, []);

  assert.deepStrictEqual(
    CampaignEngine.getSnapshot(c1),
    CampaignEngine.getSnapshot(c2),
    "Identical seeds and actions must produce identical snapshots"
  );
}

console.log("All Pathways Campaign Engine tests passed successfully!");
