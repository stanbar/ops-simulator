const assert = require("assert");
const CampaignEngine = require("./campaignEngine");
const CampaignApp = require("./campaignApp");

console.log("Running Pathways Campaign App UI tests...");

// 1. Module Exports
{
  assert(CampaignApp, "CampaignApp module should be defined");
  assert(typeof CampaignApp.renderSnapshot === "function", "renderSnapshot function should exist");
  assert(typeof CampaignApp.calculateActionPreview === "function", "calculateActionPreview function should exist");
  assert(typeof CampaignApp.createApp === "function", "createApp function should exist");
}

// 2. Action Preview Calculation (Issue #24 & Issue #25)
{
  const campaign = CampaignEngine.createCampaign({ seed: 42 });

  // Test Consume Preview
  const consumePreview = CampaignApp.calculateActionPreview(campaign, {
    type: "animal_operation",
    animal: "Consume",
    targetDomain: "understanding-judgment"
  });

  assert(consumePreview, "Action preview should return a preview object");
  assert(consumePreview.cost, "Preview should contain cost object");
  assert(typeof consumePreview.cost.attention === "number", "Cost should have attention number");
  assert(Array.isArray(consumePreview.projectedEffects), "Preview should contain projectedEffects array");
  assert.deepStrictEqual(
    consumePreview.cost,
    CampaignEngine.getActionCost(campaign, { type: "animal_operation", animal: "Consume", targetDomain: "understanding-judgment" }),
    "UI preview must use the engine's authoritative action cost"
  );

  // Test Recruitment Preview (Issue #25)
  const recruitPreview = CampaignApp.calculateActionPreview(campaign, {
    type: "recruit_collaborator"
  });
  assert.strictEqual(recruitPreview.cost.materials, 25, "Recruitment preview should reflect material cost");

  const acquire = { type: "acquire", targetDomain: "livelihood-money" };
  assert.deepStrictEqual(
    CampaignApp.calculateActionPreview(campaign, acquire).cost,
    CampaignEngine.getActionCost(campaign, acquire),
    "acquisition preview and resolution must not drift"
  );
}

// 3. Snapshot Rendering & Collaborator View Model (Issue #25)
{
  const campaign = CampaignEngine.createCampaign({ seed: 100 });
  const snapshot = CampaignEngine.getSnapshot(campaign);

  const renderedData = CampaignApp.renderSnapshot(snapshot);
  assert(renderedData, "renderSnapshot should return structured render data");
  assert.strictEqual(renderedData.turn, 1, "Rendered data turn should match snapshot");
  assert(renderedData.collaborator, "Rendered data should contain collaborator view object");
  assert.strictEqual(renderedData.collaborator.isRecruited, false, "Initial collaborator should be unrecruited");

  // Recruit collaborator in campaign
  campaign.resources.trust = 50;
  campaign.resources.materials = 60;
  campaign.domains["livelihood-money"].level = 3.5;
  CampaignEngine.stepTurn(campaign, [{ type: "recruit_collaborator" }]);

  const recruitedSnap = CampaignEngine.getSnapshot(campaign);
  const recruitedData = CampaignApp.renderSnapshot(recruitedSnap);
  assert.strictEqual(recruitedData.collaborator.isRecruited, true, "Rendered data should reflect recruited collaborator");
  assert.strictEqual(recruitedData.collaborator.name, "Alex", "Collaborator name should be Alex");
}

// 4. App Controller Turn Stepping & Hidden State Protection
{
  const app = CampaignApp.createApp({ seed: 200, origin: "balanced-starter", mission: "entrepreneurship" });
  assert.strictEqual(app.getTurn(), 1, "App initial turn should be 1");

  const result = app.dispatchTurn([
    { type: "animal_operation", animal: "Consume", targetDomain: "body-health" }
  ]);

  assert.strictEqual(app.getTurn(), 2, "App turn should advance to 2 after dispatch");
  assert(result.summary && Array.isArray(result.summary.events), "Dispatch result should return summary events");

  const snapshot = app.getSnapshot();
  assert.strictEqual(snapshot.worldRng, undefined, "Snapshot should not expose internal worldRng");
  assert(snapshot.mission && snapshot.horizon === 60, "Browser snapshot must expose mission and campaign horizon");
}

console.log("All Pathways Campaign App UI tests passed successfully!");
