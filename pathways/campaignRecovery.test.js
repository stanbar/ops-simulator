const assert = require("assert");
const Engine = require("./campaignEngine");

function runCampaign(options, policy, turns = 60) {
  const campaign = Engine.createCampaign(options);
  while (!campaign.completed && campaign.turn <= turns) {
    Engine.stepTurn(campaign, policy(campaign));
  }
  return campaign;
}

function operation(animal, targetDomain) {
  return { type: "animal_operation", animal, targetDomain };
}

console.log("Running Pathways Campaign recovery tests...");

{
  const campaign = runCampaign(
    { seed: 11, mission: "entrepreneurship", shockSchedule: "stable-horizon" },
    () => []
  );
  const diagnostics = Engine.evaluateCampaignDiagnostics(campaign);

  assert.strictEqual(campaign.completed, true, "campaign must terminate at its declared horizon");
  assert.strictEqual(campaign.turn, 61, "the default campaign must resolve exactly 60 turns");
  assert.strictEqual(diagnostics.missionAccomplished, false, "an idle level-one portfolio cannot accomplish entrepreneurship");
  assert.ok(diagnostics.missionProgress < 1, "mission progress must reflect unmet target levels");
}

{
  const campaign = Engine.createCampaign({ seed: 12 });
  const beforeAcquire = Engine.getSnapshot(campaign);
  Engine.stepTurn(campaign, [{ type: "acquire", targetDomain: "livelihood-money" }]);

  assert.ok(campaign.domains["livelihood-money"].level > beforeAcquire.domains["livelihood-money"].level);
  assert.ok(campaign.domains["livelihood-money"].level < beforeAcquire.domains["livelihood-money"].level + 0.36);
  assert.ok(campaign.resources.attention < beforeAcquire.resources.attention + 8, "acquisition must pay its authoritative attention cost after passive output");
  assert.ok(campaign.resources.materials < beforeAcquire.resources.materials + 15, "acquisition must pay its authoritative material cost after passive output");

  campaign.domains["body-health"].conditionBuffer = 50;
  const beforeMaintain = Engine.getSnapshot(campaign);
  Engine.stepTurn(campaign, [{ type: "maintain", targetDomain: "body-health" }]);
  assert.ok(campaign.domains["body-health"].conditionBuffer > beforeMaintain.domains["body-health"].conditionBuffer);
  assert.ok(campaign.resources.attention < beforeMaintain.resources.attention + 8, "maintenance must pay its authoritative attention cost");
}

{
  const campaign = Engine.createCampaign({ seed: 121 });
  campaign.resources.vitality = 0;
  const before = Engine.getSnapshot(campaign);
  assert.throws(
    () => Engine.stepTurn(campaign, [operation("Sleep", "body-health")]),
    /Insufficient resource vitality/
  );
  assert.deepStrictEqual(Engine.getSnapshot(campaign), before, "a rejected action must not partially advance the world");
  assert.throws(
    () => Engine.stepTurn(campaign, [
      { type: "maintain", targetDomain: "body-health" },
      { type: "maintain", targetDomain: "family-belonging" }
    ]),
    /one focal action/
  );
}

{
  const campaign = Engine.createCampaign({ seed: 122 });
  const before = Engine.getSnapshot(campaign);
  assert.throws(() => Engine.stepTurn(campaign, [{ type: "recruit_collaborator" }]), /Ineligible for recruitment/);
  assert.deepStrictEqual(Engine.getSnapshot(campaign), before, "rejected recruitment must be atomic");
}

{
  const campaign = Engine.createCampaign({ seed: 123 });
  const result = Engine.stepTurn(campaign, [{ type: "acquire", targetDomain: "body-health" }]);
  assert.ok(Object.isFrozen(result) && Object.isFrozen(result.summary.events));
  assert.throws(() => result.summary.events.push({ type: "tamper" }), TypeError);
  assert.ok(!Engine.getSnapshot(campaign).history[0].events.some((event) => event.type === "tamper"));

  Engine.stepTurn(campaign, []);
  assert.ok(
    campaign.history[1].events.some((event) => event.type === "delayed_feedback"),
    "domain feedback must arrive after its configured latency"
  );
}

{
  const campaign = Engine.createCampaign({ seed: 124, initialResources: { materials: 100, trust: 100 } });
  campaign.domains["livelihood-money"].level = 3.2;
  campaign.domains["livelihood-money"].tier = 2;
  Engine.stepTurn(campaign, [{ type: "recruit_collaborator" }]);
  campaign.collaborator.alignment = 0.1;
  const result = Engine.stepTurn(campaign, [{ type: "assign_collaborator_role", role: "maintenance" }]);
  assert.ok(result.summary.events.some((event) => event.type === "collaborator_resigned"));
  assert.ok(result.summary.events.some((event) => event.type === "collaborator_command_ineffective"));
}

{
  const volatile = runCampaign(
    { seed: 13, shockSchedule: "volatile-shift" },
    () => [],
    60
  );
  const shocks = volatile.history.flatMap((turn) => turn.events).filter((event) => event.type === "world_shock");
  assert.ok(shocks.length > 0, "volatile seeded campaigns must actually produce shocks");
}

{
  const observerPolarized = { observerCoin: "Oi", deciderCoin: "Di", primaryAxis: "observer" };
  const deciderPolarized = { observerCoin: "Oi", deciderCoin: "Di", primaryAxis: "decider" };
  assert.notDeepStrictEqual(
    Engine.calculateAnimalCost("Consume", observerPolarized),
    Engine.calculateAnimalCost("Consume", deciderPolarized),
    "the polarized axis must change the cost of mixed animals"
  );
}

{
  const campaign = Engine.createCampaign({ seed: 14 });
  const control = Engine.createCampaign({ seed: 14 });
  Engine.stepTurn(campaign, [operation("Play", "family-belonging")]);
  Engine.stepTurn(control, []);
  assert.strictEqual(campaign.resources.trust, control.resources.trust - Engine.getActionCost(control, operation("Play", "family-belonging")).trust, "Play without a partner must not mint reciprocal trust");
  assert.strictEqual(campaign.domains["family-belonging"].sharedPathwayQuality, control.domains["family-belonging"].sharedPathwayQuality);
}

{
  const personal = Engine.createCampaign({ seed: 141 });
  const recovery = Engine.createCampaign({ seed: 141 });
  personal.domains["body-health"].conditionBuffer = 40;
  recovery.domains["body-health"].conditionBuffer = 40;
  Engine.stepTurn(personal, [{ ...operation("Sleep", "body-health"), pathwayTarget: "personal" }]);
  Engine.stepTurn(recovery, [{ ...operation("Sleep", "body-health"), pathwayTarget: "condition" }]);
  assert.ok(personal.domains["body-health"].personalPathwayQuality > recovery.domains["body-health"].personalPathwayQuality);
  assert.ok(recovery.domains["body-health"].conditionBuffer > personal.domains["body-health"].conditionBuffer);
  assert.strictEqual(
    Engine.previewAction(personal, { ...operation("Blast", "body-health"), pathwayTarget: "evidence" }).affordable,
    false,
    "unsupported animal/pathway combinations must be rejected before submission"
  );
}

{
  const campaign = Engine.createCampaign({ seed: 15, initialResources: { materials: 100, trust: 100 } });
  campaign.domains["livelihood-money"].level = 3.2;
  campaign.domains["livelihood-money"].tier = 2;
  Engine.stepTurn(campaign, [{ type: "recruit_collaborator" }]);

  assert.ok(campaign.collaborator.goals.length > 0);
  assert.ok(Object.keys(campaign.collaborator.evidence).length > 0);
  assert.ok(campaign.collaborator.needs);
  assert.ok(campaign.collaborator.capabilities);
  assert.ok(campaign.collaborator.lastDecision && campaign.collaborator.lastDecision.reason);
}

{
  const campaign = Engine.createCampaign({ seed: 16 });
  campaign.domains["body-health"].conditionBuffer = 40;
  Engine.stepTurn(campaign, [{ type: "set_maintenance_policy", targetDomain: "body-health", enabled: true }]);
  const policy = campaign.automatedPolicies["body-health"];
  assert.ok(policy && policy.enabled, "a maintenance policy must be installable through the public engine");

  const initialInspectionAge = policy.inspectionAge;
  Engine.stepTurn(campaign, []);
  assert.ok(campaign.automatedPolicies["body-health"].inspectionAge > initialInspectionAge);
}

{
  const direct = Engine.createCampaign({ seed: 17 });
  const researched = Engine.createCampaign({ seed: 17 });
  const target = "understanding-judgment";
  const directGain = Engine.calculateAcquisitionGain(direct.domains[target]);

  Engine.stepTurn(researched, [operation("Consume", target)]);
  const researchedGain = Engine.calculateAcquisitionGain(researched.domains[target]);

  assert.ok(
    researchedGain > directGain,
    "Consume must improve a later acquisition where fresh evidence matters"
  );
}

console.log("All Pathways Campaign recovery tests passed.");
