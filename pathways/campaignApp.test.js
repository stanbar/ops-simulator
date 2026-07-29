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

// 2. Action Preview Calculation (Issue #24)
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
  assert(Array.isArray(consumePreview.warnings), "Preview should contain warnings array");

  // Test Premature Consolidation Warning in Preview
  campaign.domains["understanding-judgment"].evidenceConfidence = 0.2;
  const sleepPreview = CampaignApp.calculateActionPreview(campaign, {
    type: "animal_operation",
    animal: "Sleep",
    targetDomain: "understanding-judgment"
  });
  
  const prematureWarning = sleepPreview.warnings.find(w => w.includes("Premature consolidation"));
  assert(prematureWarning, "Sleep preview should produce premature consolidation warning when confidence is low");
}

// 3. Mock DOM Snapshot Rendering (Issue #24)
{
  const campaign = CampaignEngine.createCampaign({ seed: 100 });
  const snapshot = CampaignEngine.getSnapshot(campaign);

  // Mock minimal DOM element container
  const mockContainer = {
    innerHTML: "",
    querySelector: () => null,
    querySelectorAll: () => []
  };

  const renderedData = CampaignApp.renderSnapshot(snapshot);
  assert(renderedData, "renderSnapshot should return structured render data");
  assert.strictEqual(renderedData.turn, 1, "Rendered data turn should match snapshot");
  assert.strictEqual(Object.keys(renderedData.domains).length, 6, "Rendered data should contain 6 domains");
  assert(renderedData.polarityPressures, "Rendered data should include polarityPressures");
  assert(typeof renderedData.polarityPressures.Oe === "number", "Oe pressure should be a number");
}

// 4. App Controller Turn Stepping & Hidden State Protection (Issue #24)
{
  const app = CampaignApp.createApp({ seed: 200, origin: "balanced-starter", mission: "entrepreneurship" });
  assert.strictEqual(app.getTurn(), 1, "App initial turn should be 1");

  // Dispatch turn step action
  const result = app.dispatchTurn([
    { type: "animal_operation", animal: "Consume", targetDomain: "body-health" }
  ]);

  assert.strictEqual(app.getTurn(), 2, "App turn should advance to 2 after dispatch");
  assert(result.summary && Array.isArray(result.summary.events), "Dispatch result should return summary events");

  // Check hidden state protection: public snapshot does not expose internal PRNG handles
  const snapshot = app.getSnapshot();
  assert.strictEqual(snapshot.worldRng, undefined, "Snapshot should not expose internal worldRng");
  assert.strictEqual(snapshot.agentRng, undefined, "Snapshot should not expose internal agentRng");
}

console.log("All Pathways Campaign App UI tests passed successfully!");
