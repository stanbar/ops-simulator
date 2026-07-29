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

// 3. Resource Invariants & Validation
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

// 4. Turn Lifecycle Execution
{
  const campaign = CampaignEngine.createCampaign({ seed: 12345 });
  const initialTurn = campaign.turn;

  // Execute stepTurn with empty actions
  const result = CampaignEngine.stepTurn(campaign, []);
  assert(result, "stepTurn should return turn result object");
  assert.strictEqual(result.turn, initialTurn, "Result should reflect processed turn number");
  assert.strictEqual(campaign.turn, initialTurn + 1, "Campaign turn should advance to turn 2");
  assert(result.summary && Array.isArray(result.summary.events), "Turn summary should contain an events array");

  // Invariants check after stepTurn
  assert.doesNotThrow(() => CampaignEngine.validateInvariants(campaign), "Campaign after turn step should pass invariant checks");
}

// 5. Action Allocation & Resource Validation
{
  const campaign = CampaignEngine.createCampaign({ seed: 999 });
  
  // Action exceeding attention allocation should fail
  const excessiveAction = {
    type: "invest_domain",
    targetDomain: "body-health",
    cost: { attention: 9999, materials: 0, vitality: 0, trust: 0, evidence: 0 }
  };

  assert.throws(
    () => CampaignEngine.stepTurn(campaign, [excessiveAction]),
    /insufficient resource/i,
    "Action requiring more resources than available should throw an error"
  );
}

// 6. Snapshot Immutability
{
  const campaign = CampaignEngine.createCampaign({ seed: 777 });
  const snapshot = CampaignEngine.getSnapshot(campaign);

  assert.strictEqual(snapshot.turn, campaign.turn, "Snapshot turn should match");

  // Attempting to mutate snapshot should not mutate campaign internal state
  try {
    snapshot.resources.attention = 999;
  } catch (e) {
    // Frozen object throws in strict mode
  }
  assert.notStrictEqual(campaign.resources.attention, 999, "Mutating snapshot must not change internal state");
}

// 7. Determinism
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
