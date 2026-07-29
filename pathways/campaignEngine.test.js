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

  // Verify 4 Animals
  assert(CampaignEngine.ANIMALS, "ANIMALS constant should exist");
  assert(CampaignEngine.ANIMALS.Consume, "Consume animal should exist");
  assert(CampaignEngine.ANIMALS.Sleep, "Sleep animal should exist");
  assert(CampaignEngine.ANIMALS.Play, "Play animal should exist");
  assert(CampaignEngine.ANIMALS.Blast, "Blast animal should exist");

  // Verify Origin and Mission presets
  assert(CampaignEngine.ORIGIN_PRESETS, "ORIGIN_PRESETS should exist");
  assert(CampaignEngine.MISSION_PRESETS, "MISSION_PRESETS should exist");
}

// 2. Agent Profile Coins & Subjective Cost Modulation (Issue #22)
{
  const profile = { observerCoin: "Oe", deciderCoin: "Di", primaryAxis: "observer" };
  const baseCost = { attention: 5, vitality: 5 };

  const consumeCost = CampaignEngine.calculateAnimalCost("Consume", profile, baseCost);
  const blastCost = CampaignEngine.calculateAnimalCost("Blast", profile, baseCost);

  // Consume is double-savior (Oe+Di), Blast is double-demon (Oi+De)
  assert.strictEqual(consumeCost.attention, 5, "Savior action should retain base cost");
  assert(blastCost.attention > 5, "Demon action should carry higher subjective cost multiplier");
}

// 3. Four-Animal Operations Resolution (Issue #22)
{
  const campaign = CampaignEngine.createCampaign({ seed: 100 });
  const domain = campaign.domains["understanding-judgment"];
  domain.evidenceCoverage = 0.2;
  domain.evidenceConfidence = 0.3;

  // Test Consume Operation
  const initialEvidence = campaign.resources.evidence;
  CampaignEngine.stepTurn(campaign, [
    { type: "animal_operation", animal: "Consume", targetDomain: "understanding-judgment" }
  ]);
  assert(domain.evidenceCoverage > 0.2, "Consume should increase evidence coverage");
  assert(campaign.resources.evidence > initialEvidence, "Consume should yield evidence resource");

  // Test Sleep Operation
  const initialPersonal = domain.personalPathwayQuality;
  domain.evidenceConfidence = 0.6; // High evidence confidence so not premature
  CampaignEngine.stepTurn(campaign, [
    { type: "animal_operation", animal: "Sleep", targetDomain: "understanding-judgment" }
  ]);
  assert(domain.personalPathwayQuality > initialPersonal, "Sleep should increase personal pathway quality");

  // Test Play Operation
  const initialTrust = campaign.resources.trust;
  CampaignEngine.stepTurn(campaign, [
    { type: "animal_operation", animal: "Play", targetDomain: "family-belonging" }
  ]);
  assert(campaign.resources.trust > initialTrust, "Play should increase trust resource");

  // Test Blast Operation
  const initialShared = campaign.domains["practical-foundations"].sharedPathwayQuality;
  campaign.domains["practical-foundations"].evidenceConfidence = 0.7;
  CampaignEngine.stepTurn(campaign, [
    { type: "animal_operation", animal: "Blast", targetDomain: "practical-foundations" }
  ]);
  assert(campaign.domains["practical-foundations"].sharedPathwayQuality > initialShared, "Blast should increase shared pathway quality");
}

// 4. Polarity Pressures & Pressure Relief (Issue #22)
{
  const campaign = CampaignEngine.createCampaign({ seed: 200 });
  
  // Set domain state to create high Oe pressure (low evidence coverage)
  campaign.domains["understanding-judgment"].evidenceCoverage = 0.1;
  const initialPressures = CampaignEngine.calculatePolarityPressures(campaign);
  assert(initialPressures.Oe > 30, "Low evidence coverage should generate high Oe pressure");

  // Execute Consume to alter underlying condition and relieve Oe pressure
  CampaignEngine.stepTurn(campaign, [
    { type: "animal_operation", animal: "Consume", targetDomain: "understanding-judgment" }
  ]);

  const updatedPressures = CampaignEngine.calculatePolarityPressures(campaign);
  assert(updatedPressures.Oe < initialPressures.Oe, "Altering evidence coverage should relieve Oe pressure");
}

// 5. Premature Consolidation & Over-Exploration (Issue #22)
{
  // Test Premature Sleep (low evidence confidence)
  const campaign = CampaignEngine.createCampaign({ seed: 300 });
  const domain = campaign.domains["understanding-judgment"];
  domain.evidenceConfidence = 0.2; // Low confidence
  const initialVol = domain.volatility;

  const result = CampaignEngine.stepTurn(campaign, [
    { type: "animal_operation", animal: "Sleep", targetDomain: "understanding-judgment" }
  ]);

  const prematureEvent = result.summary.events.find(e => e.type === "premature_consolidation");
  assert(prematureEvent, "Premature Sleep with low evidence confidence should trigger premature_consolidation event");
  assert(domain.volatility > initialVol, "Premature Sleep should incur epistemic debt (increase volatility)");

  // Test Over-Exploration (high evidence coverage)
  const expCampaign = CampaignEngine.createCampaign({ seed: 301 });
  const expDomain = expCampaign.domains["understanding-judgment"];
  expDomain.evidenceCoverage = 0.9; // High coverage

  const expResult = CampaignEngine.stepTurn(expCampaign, [
    { type: "animal_operation", animal: "Consume", targetDomain: "understanding-judgment" }
  ]);

  const overExpEvent = expResult.summary.events.find(e => e.type === "opportunity_cost_penalty");
  assert(overExpEvent, "Over-exploration with high evidence coverage should trigger opportunity_cost_penalty event");
}

// 6. Invariants & Determinism
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
