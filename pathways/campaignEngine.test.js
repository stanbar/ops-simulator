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
  }

  // Verify Shock schedules (Issue #23)
  assert(CampaignEngine.SHOCK_SCHEDULES, "SHOCK_SCHEDULES constant should exist");
  assert(CampaignEngine.SHOCK_SCHEDULES["volatile-shift"], "volatile-shift shock schedule should exist");
  assert(CampaignEngine.SHOCK_SCHEDULES["crisis-cascade"], "crisis-cascade shock schedule should exist");
}

// 2. Seeded External World Shocks (Issue #23)
{
  const campaign = CampaignEngine.createCampaign({
    seed: 500,
    shockSchedule: "crisis-cascade"
  });

  const domain = campaign.domains["understanding-judgment"];
  domain.evidenceCoverage = 0.8;
  domain.evidenceConfidence = 0.8;

  // Run turns until crisis-cascade shock fires
  let shockEventFound = false;
  for (let i = 0; i < 5; i++) {
    const result = CampaignEngine.stepTurn(campaign, []);
    const shock = result.summary.events.find(e => e.type === "world_shock");
    if (shock) {
      shockEventFound = true;
      assert(shock.shockType, "World shock event should have a shockType");
      assert(shock.targetDomain, "World shock event should specify targetDomain");
      break;
    }
  }
  assert(shockEventFound, "Crisis cascade shock schedule should trigger a world shock");
}

// 3. Maintenance Policy Automation & Staleness (Issue #23)
{
  const campaign = CampaignEngine.createCampaign({ seed: 600 });
  
  // Set automated maintenance policy for body-health
  campaign.automatedPolicies = {
    "body-health": { autoMaintain: true, staleness: 0 }
  };
  campaign.domains["body-health"].conditionBuffer = 50.0;

  // Turn 1: Auto-maintenance runs, replenishes buffer, increments staleness
  CampaignEngine.stepTurn(campaign, []);
  assert(campaign.domains["body-health"].conditionBuffer > 50.0, "Automated policy should replenish condition buffer");
  assert.strictEqual(campaign.automatedPolicies["body-health"].staleness, 1, "Automated policy staleness should increment");

  // Execute manual Consume audit to reset staleness
  CampaignEngine.stepTurn(campaign, [
    { type: "animal_operation", animal: "Consume", targetDomain: "body-health" }
  ]);
  assert.strictEqual(campaign.automatedPolicies["body-health"].staleness, 0, "Manual audit/Consume should reset staleness to 0");
}

// 4. Independent PRNG Streams & Determinism (Issue #23)
{
  const c1 = CampaignEngine.createCampaign({ seed: 777, shockSchedule: "volatile-shift" });
  const c2 = CampaignEngine.createCampaign({ seed: 777, shockSchedule: "volatile-shift" });

  // c1 takes action A, c2 takes action B
  CampaignEngine.stepTurn(c1, [{ type: "invest_domain", targetDomain: "body-health", cost: { attention: 2 } }]);
  CampaignEngine.stepTurn(c2, [{ type: "maintain", targetDomain: "livelihood-money", cost: { attention: 2 } }]);

  // Turn 2: verify shock outcomes in c1 and c2 are driven by independent worldRng stream
  const res1 = CampaignEngine.stepTurn(c1, []);
  const res2 = CampaignEngine.stepTurn(c2, []);

  const shock1 = res1.summary.events.find(e => e.type === "world_shock");
  const shock2 = res2.summary.events.find(e => e.type === "world_shock");

  if (shock1 || shock2) {
    assert.deepStrictEqual(shock1, shock2, "Independent worldRng must isolate shock sequence from player action choice");
  }
}

// 5. Causal Debrief & Campaign Diagnostics (Issue #23)
{
  const campaign = CampaignEngine.createCampaign({ seed: 800 });
  
  // Deplete resources to cause maintenance deficit
  campaign.resources.vitality = 0;
  campaign.domains["body-health"].conditionBuffer = 0;
  campaign.domains["body-health"].outputs = {};

  const result = CampaignEngine.stepTurn(campaign, []);
  
  assert(result.summary.causalTrace && Array.isArray(result.summary.causalTrace), "Turn summary should include causalTrace array");
  assert(result.summary.causalTrace.length > 0, "Causal trace should record root causes for maintenance deficits");

  // Test Campaign Evaluation Diagnostics
  const diagnostics = CampaignEngine.evaluateCampaignDiagnostics(campaign, CampaignEngine.MISSION_PRESETS["entrepreneurship"]);
  assert(typeof diagnostics === "object", "evaluateCampaignDiagnostics should return a diagnostics object");
  assert(typeof diagnostics.policyQualityScore === "number" && diagnostics.policyQualityScore >= 0, "policyQualityScore should be non-negative");
  assert(typeof diagnostics.shockResilienceScore === "number" && diagnostics.shockResilienceScore >= 0, "shockResilienceScore should be non-negative");
  assert(typeof diagnostics.maintenanceEfficiencyScore === "number" && diagnostics.maintenanceEfficiencyScore >= 0, "maintenanceEfficiencyScore should be non-negative");
  assert(diagnostics.viabilityCompliance && typeof diagnostics.viabilityCompliance === "object", "viabilityCompliance should exist");
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
