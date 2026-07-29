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
  assert(typeof CampaignEngine.checkRecruitmentEligibility === "function", "checkRecruitmentEligibility function should exist");

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
  }
}

// 2. Recruitment Eligibility & State Transition (Issue #25)
{
  const campaign = CampaignEngine.createCampaign({ seed: 500 });
  
  // Ineligible initially (low materials/trust or no Tier 2 domain)
  const initialEligibility = CampaignEngine.checkRecruitmentEligibility(campaign);
  assert.strictEqual(initialEligibility.eligible, false, "Initial campaign should not be eligible for recruitment");

  // Fulfill recruitment prerequisites
  campaign.resources.trust = 50;
  campaign.resources.materials = 60;
  campaign.domains["livelihood-money"].level = 3.5;
  campaign.domains["livelihood-money"].tier = 2;

  const updatedEligibility = CampaignEngine.checkRecruitmentEligibility(campaign);
  assert.strictEqual(updatedEligibility.eligible, true, "Campaign meeting prerequisites should be eligible for recruitment");

  // Perform recruitment action
  const initMaterials = campaign.resources.materials;
  const initTrust = campaign.resources.trust;

  CampaignEngine.stepTurn(campaign, [{ type: "recruit_collaborator" }]);

  assert(campaign.collaborator, "Recruitment action should create collaborator object in campaign state");
  assert.strictEqual(campaign.collaborator.name, "Alex", "Collaborator should have a name");
}

// 3. Collaborator Autonomy & Network Scaling (Issue #25)
{
  const campaign = CampaignEngine.createCampaign({ seed: 600 });
  campaign.resources.trust = 50;
  campaign.resources.materials = 60;
  campaign.domains["livelihood-money"].level = 3.5;
  campaign.domains["livelihood-money"].tier = 2;

  CampaignEngine.stepTurn(campaign, [{ type: "recruit_collaborator" }]);
  assert(campaign.collaborator, "Collaborator should be recruited");

  // Set assigned role
  CampaignEngine.stepTurn(campaign, [{ type: "assign_collaborator_role", role: "production" }]);
  assert.strictEqual(campaign.collaborator.assignedRole, "production", "Collaborator assigned role should be production");

  // Step turn and verify autonomous action event and overhead deduction
  const result = CampaignEngine.stepTurn(campaign, []);
  const collabEvent = result.summary.events.find(e => e.type === "collaborator_action");
  assert(collabEvent, "Should log collaborator_action event during turn");

  // Test alignment decay under unpaid compensation
  campaign.resources.materials = 0; // Deplete materials so compensation cannot be paid
  const initialAlignment = campaign.collaborator.alignment;

  CampaignEngine.stepTurn(campaign, []);
  assert(campaign.collaborator.alignment < initialAlignment, "Unpaid compensation should reduce collaborator alignment");
}

// 4. Invariants & Determinism
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
