(function () {
  "use strict";

  const Engine = window.PathwaysEngine;
  if (!Engine) throw new Error("Pathways engine failed to load.");

  const tutorialSequence = ["Consume", "Sleep", "Blast", "Play"];
  const tutorialCopy = {
    Consume: "Gather direct evidence for your private map. Discovery changes belief before it changes the mountain.",
    Sleep: "Turn a known possibility into personal mastery. The route becomes easier for you, not automatically for everyone.",
    Blast: "Externalize a known route into markings, instructions, and carrying capacity the expedition can share.",
    Play: "Explore with another agent and reconcile two incomplete maps in real time."
  };

  const state = {
    config: {
      scenarioId: "uncharted",
      profile: { observer: "Oi", decider: "Di", polarity: "Observer" },
      goalId: null,
      seed: "pathways-001",
      customScenario: { uncertainty: 0.5, volatility: 0.5, interdependence: 0.5, disagreement: 0.5 }
    },
    game: null,
    snapshot: null,
    selectedMapAgentId: "player",
    tutorialActive: true,
    tutorialStep: 0,
    revealTruth: false,
    comparisonBaseline: null
  };

  const elements = {};

  function byId(id) {
    return document.getElementById(id);
  }

  function cacheElements() {
    [
      "startScreen", "gameScreen", "scenarioGrid", "customControls", "goalGrid", "seedInput",
      "tutorialInput", "startButton", "animalOrder", "uncertaintyInput", "volatilityInput",
      "interdependenceInput", "disagreementInput", "uncertaintyOutput", "volatilityOutput",
      "interdependenceOutput", "disagreementOutput", "roundStatus", "weatherStatus", "supplyStatus",
      "summitStatus", "deliveryStatus", "scenarioEyebrow", "mapAgentSelect", "edgeLayer", "nodeLayer",
      "agentLayer", "agentList", "actionGrid", "playerState", "timeline", "tutorialBar", "tutorialCount",
      "tutorialTitle", "tutorialCopy", "skipTutorialButton", "restartButton", "aboutButton", "aboutDialog",
      "debriefDialog", "debriefContent", "mapCallout", "mountainSvg"
    ].forEach((id) => { elements[id] = byId(id); });
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function selectedScenario() {
    if (state.config.scenarioId === "custom") {
      return {
        id: "custom",
        name: "Custom Expedition",
        description: "Your selected balance of environmental and social pressure."
      };
    }
    return Engine.SCENARIOS[state.config.scenarioId];
  }

  function renderScenarios() {
    const cards = Object.values(Engine.SCENARIOS).concat([{
      id: "custom",
      name: "Custom Expedition",
      description: "Tune environmental volatility and social interdependence directly."
    }]);
    elements.scenarioGrid.innerHTML = cards.map((scenario) => `
      <button class="scenario-card ${scenario.id === state.config.scenarioId ? "selected" : ""}" type="button" data-scenario="${scenario.id}">
        ${scenario.id === "wrong" ? "<small>Dissent test</small>" : ""}
        <strong>${escapeHtml(scenario.name)}</strong>
        <span>${escapeHtml(scenario.description)}</span>
      </button>
    `).join("");
    elements.customControls.hidden = state.config.scenarioId !== "custom";
  }

  function renderGoals() {
    const choices = Engine.goalChoices(state.config.seed);
    if (!choices.some((goal) => goal.id === state.config.goalId)) state.config.goalId = choices[0].id;
    elements.goalGrid.innerHTML = choices.map((goal) => `
      <button class="goal-card ${goal.id === state.config.goalId ? "selected" : ""}" type="button" data-goal="${goal.id}">
        <strong>${escapeHtml(goal.name)}</strong>
        <span>${escapeHtml(goal.description)}</span>
      </button>
    `).join("");
  }

  function renderCoinControls() {
    document.querySelectorAll(".segmented").forEach((group) => {
      const setting = group.dataset.setting;
      group.querySelectorAll("button").forEach((button) => {
        button.classList.toggle("selected", button.dataset.value === state.config.profile[setting]);
      });
    });
    const preview = new Engine.Game({
      seed: state.config.seed,
      scenarioId: state.config.scenarioId,
      customScenario: state.config.customScenario,
      playerProfile: state.config.profile,
      playerGoalId: state.config.goalId
    });
    const costs = Engine.animalCosts(preview.agentById.player);
    const ordered = Object.entries(costs).sort((a, b) => a[1] - b[1]);
    elements.animalOrder.innerHTML = ordered.map(([name, cost], index) => `
      <div class="order-chip" style="border-color:${Engine.ANIMALS[name].color}55">
        <strong style="color:${Engine.ANIMALS[name].color}">${index + 1}. ${name}</strong>
        <span>${cost.toFixed(1)} effort</span>
      </div>
    `).join("");
  }

  function updateCustomControls() {
    const pairs = [
      ["uncertainty", elements.uncertaintyInput, elements.uncertaintyOutput],
      ["volatility", elements.volatilityInput, elements.volatilityOutput],
      ["interdependence", elements.interdependenceInput, elements.interdependenceOutput],
      ["disagreement", elements.disagreementInput, elements.disagreementOutput]
    ];
    pairs.forEach(([key, input, output]) => {
      state.config.customScenario[key] = Number(input.value) / 100;
      output.value = `${input.value}%`;
    });
  }

  function bindSetupEvents() {
    elements.scenarioGrid.addEventListener("click", (event) => {
      const card = event.target.closest("[data-scenario]");
      if (!card) return;
      state.config.scenarioId = card.dataset.scenario;
      renderScenarios();
      renderCoinControls();
    });

    document.querySelectorAll(".segmented").forEach((group) => {
      group.addEventListener("click", (event) => {
        const button = event.target.closest("button[data-value]");
        if (!button) return;
        state.config.profile[group.dataset.setting] = button.dataset.value;
        renderCoinControls();
      });
    });

    elements.goalGrid.addEventListener("click", (event) => {
      const card = event.target.closest("[data-goal]");
      if (!card) return;
      state.config.goalId = card.dataset.goal;
      renderGoals();
      renderCoinControls();
    });

    elements.seedInput.addEventListener("change", () => {
      state.config.seed = elements.seedInput.value.trim() || "pathways-001";
      elements.seedInput.value = state.config.seed;
      renderGoals();
      renderCoinControls();
    });

    [elements.uncertaintyInput, elements.volatilityInput, elements.interdependenceInput, elements.disagreementInput]
      .forEach((input) => input.addEventListener("input", () => {
        updateCustomControls();
        renderCoinControls();
      }));

    elements.startButton.addEventListener("click", () => startGame());
    elements.restartButton.addEventListener("click", showSetup);
    elements.skipTutorialButton.addEventListener("click", () => {
      state.tutorialActive = false;
      renderTutorial();
      renderActions();
    });
  }

  function startGame(overrides = {}) {
    state.config = {
      ...state.config,
      ...overrides,
      profile: { ...state.config.profile, ...(overrides.profile || {}) }
    };
    state.config.seed = String(state.config.seed || "pathways-001");
    state.game = new Engine.Game({
      seed: state.config.seed,
      scenarioId: state.config.scenarioId,
      customScenario: state.config.customScenario,
      playerProfile: state.config.profile,
      playerGoalId: state.config.goalId
    });
    state.snapshot = state.game.snapshot();
    state.selectedMapAgentId = "player";
    state.tutorialActive = overrides.tutorialActive !== undefined ? overrides.tutorialActive : elements.tutorialInput.checked;
    state.tutorialStep = 0;
    state.revealTruth = false;
    elements.startScreen.hidden = true;
    elements.gameScreen.hidden = false;
    populateMapAgentSelect();
    updateUrl();
    renderGame();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function showSetup() {
    if (elements.debriefDialog.open) elements.debriefDialog.close();
    state.game = null;
    state.snapshot = null;
    elements.gameScreen.hidden = true;
    elements.startScreen.hidden = false;
    elements.seedInput.value = state.config.seed;
    renderScenarios();
    renderGoals();
    renderCoinControls();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function updateUrl() {
    const params = new URLSearchParams({
      seed: state.config.seed,
      scenario: state.config.scenarioId,
      observer: state.config.profile.observer,
      decider: state.config.profile.decider,
      polarity: state.config.profile.polarity,
      goal: state.config.goalId
    });
    history.replaceState(null, "", `${location.pathname}?${params.toString()}`);
  }

  function readUrl() {
    const params = new URLSearchParams(location.search);
    if (params.has("seed")) state.config.seed = params.get("seed") || state.config.seed;
    if (params.has("scenario") && (Engine.SCENARIOS[params.get("scenario")] || params.get("scenario") === "custom")) state.config.scenarioId = params.get("scenario");
    if (["Oi", "Oe"].includes(params.get("observer"))) state.config.profile.observer = params.get("observer");
    if (["Di", "De"].includes(params.get("decider"))) state.config.profile.decider = params.get("decider");
    if (["Observer", "Decider"].includes(params.get("polarity"))) state.config.profile.polarity = params.get("polarity");
    if (Engine.GOALS.some((goal) => goal.id === params.get("goal"))) state.config.goalId = params.get("goal");
  }

  function populateMapAgentSelect() {
    elements.mapAgentSelect.innerHTML = state.snapshot.agents.map((agent) => `<option value="${agent.id}">${escapeHtml(agent.name)} · ${agent.profile.observer}/${agent.profile.decider} ${agent.profile.polarity}</option>`).join("");
    elements.mapAgentSelect.value = state.selectedMapAgentId;
  }

  function renderGame() {
    renderStatus();
    renderTutorial();
    renderMap();
    renderAgents();
    renderActions();
    renderTimeline();
  }

  function renderStatus() {
    const snapshot = state.snapshot;
    const arrived = snapshot.agents.filter((agent) => agent.position === "summit").length;
    elements.roundStatus.textContent = `${snapshot.round} / ${snapshot.roundLimit}`;
    elements.weatherStatus.textContent = `${snapshot.weather.label} · ${Math.round(snapshot.weather.severity * 100)}%`;
    elements.supplyStatus.textContent = String(snapshot.supplies);
    elements.summitStatus.textContent = `${arrived} / 5`;
    elements.deliveryStatus.textContent = `${snapshot.deliveredSupplies} / 3`;
    elements.scenarioEyebrow.textContent = snapshot.scenario.name;
  }

  function renderTutorial() {
    const active = state.tutorialActive && state.tutorialStep < tutorialSequence.length && !state.snapshot.finished;
    elements.tutorialBar.hidden = !active;
    if (!active) return;
    const animal = tutorialSequence[state.tutorialStep];
    elements.tutorialCount.textContent = `${state.tutorialStep + 1} / ${tutorialSequence.length}`;
    elements.tutorialTitle.textContent = `${animal}: ${Engine.ANIMALS[animal].verb.toLowerCase()}`;
    elements.tutorialCopy.textContent = tutorialCopy[animal];
  }

  function svgElement(name, attributes = {}) {
    const node = document.createElementNS("http://www.w3.org/2000/svg", name);
    Object.entries(attributes).forEach(([key, value]) => node.setAttribute(key, String(value)));
    return node;
  }

  function mapPoint(node) {
    return { x: node.x * 10, y: node.y * 7.2 };
  }

  function renderMap() {
    const snapshot = state.snapshot;
    const selectedAgent = snapshot.agents.find((agent) => agent.id === state.selectedMapAgentId) || snapshot.agents[0];
    const nodeById = Object.fromEntries(snapshot.mountain.nodes.map((node) => [node.id, node]));
    elements.edgeLayer.replaceChildren();
    elements.nodeLayer.replaceChildren();
    elements.agentLayer.replaceChildren();

    snapshot.mountain.edges.forEach((edge) => {
      const from = mapPoint(nodeById[edge.from]);
      const to = mapPoint(nodeById[edge.to]);
      const belief = selectedAgent.beliefs[edge.id];
      const shared = edge.infrastructure > 0;
      let stroke = "#66746f";
      let width = 2;
      let opacity = 0.14;
      let dash = "7 9";

      if (state.revealTruth) {
        stroke = edge.blocked ? "#f07b86" : edge.trueRisk > 0.62 ? "#e7a05c" : "#79d6c2";
        width = 2.5 + edge.infrastructure * 6;
        opacity = 0.92;
        dash = edge.blocked ? "3 6" : "";
      } else if (shared) {
        stroke = "#79d6c2";
        width = 3 + edge.infrastructure * 7;
        opacity = 0.55 + edge.infrastructure * 0.4;
        dash = "";
      } else if (belief) {
        stroke = selectedAgent.color;
        width = 2 + (selectedAgent.mastery[edge.id] || 0) * 5;
        opacity = 0.38 + belief.confidence * 0.55;
        dash = belief.confidence < 0.65 ? "6 6" : "";
      }

      const line = svgElement("line", {
        x1: from.x, y1: from.y, x2: to.x, y2: to.y,
        stroke, "stroke-width": width, opacity, "stroke-dasharray": dash,
        "stroke-linecap": "round", class: "map-edge", "data-edge-id": edge.id
      });
      const hit = svgElement("line", { x1: from.x, y1: from.y, x2: to.x, y2: to.y, class: "edge-hit", "data-edge-id": edge.id });
      elements.edgeLayer.append(line, hit);

      if (state.revealTruth && edge.blocked) {
        const mark = svgElement("text", { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2, class: "blocked-mark" });
        mark.textContent = "×";
        elements.edgeLayer.append(mark);
      }
    });

    snapshot.mountain.nodes.forEach((node) => {
      const point = mapPoint(node);
      const group = svgElement("g", { class: "map-node", transform: `translate(${point.x} ${point.y})` });
      const circle = svgElement("circle", { r: node.id === "summit" ? 13 : 9 });
      const label = svgElement("text", { y: node.id === "summit" ? -22 : 25 });
      label.textContent = node.name;
      const level = svgElement("text", { y: node.id === "summit" ? -38 : 39, class: "node-level" });
      level.textContent = node.id === "summit" ? "DESTINATION" : `LEVEL ${node.level}`;
      group.append(circle, label, level);
      elements.nodeLayer.append(group);
    });

    const grouped = {};
    snapshot.agents.forEach((agent) => {
      grouped[agent.position] = grouped[agent.position] || [];
      grouped[agent.position].push(agent);
    });
    Object.entries(grouped).forEach(([nodeId, agents]) => {
      const point = mapPoint(nodeById[nodeId]);
      agents.forEach((agent, index) => {
        const angle = agents.length === 1 ? -Math.PI / 2 : (Math.PI * 2 * index) / agents.length;
        const radius = agents.length === 1 ? 0 : 20;
        const x = point.x + Math.cos(angle) * radius;
        const y = point.y + Math.sin(angle) * radius;
        const group = svgElement("g", { class: `agent-marker ${agent.id === "player" ? "player" : ""}`, transform: `translate(${x} ${y})` });
        const circle = svgElement("circle", { r: 12, fill: agent.color });
        const label = svgElement("text", { y: 1 });
        label.textContent = agent.name[0];
        group.append(circle, label);
        elements.agentLayer.append(group);
      });
    });
  }

  function showEdgeCallout(edgeId, clientX, clientY) {
    const snapshot = state.snapshot;
    const agent = snapshot.agents.find((candidate) => candidate.id === state.selectedMapAgentId) || snapshot.agents[0];
    const edge = snapshot.mountain.edges.find((candidate) => candidate.id === edgeId);
    const belief = agent.beliefs[edgeId];
    let body;
    if (state.revealTruth) {
      body = `True risk ${Math.round(edge.trueRisk * 100)}% · cost ${edge.trueCost.toFixed(1)} · ${edge.blocked ? "blocked" : "open"}`;
    } else if (belief) {
      body = `Believed risk ${Math.round(belief.estimatedRisk * 100)}% · confidence ${Math.round(belief.confidence * 100)}% · ${belief.source}`;
    } else {
      body = "No current belief. The connection is only a frontier possibility.";
    }
    const rect = elements.mountainSvg.getBoundingClientRect();
    elements.mapCallout.innerHTML = `<strong>${escapeHtml(edge.name)}</strong><span>${escapeHtml(body)}</span>`;
    elements.mapCallout.style.left = `${Math.min(clientX - rect.left + 12, rect.width - 260)}px`;
    elements.mapCallout.style.top = `${Math.max(clientY - rect.top - 35, 12)}px`;
    elements.mapCallout.hidden = false;
  }

  function renderAgents() {
    const snapshot = state.snapshot;
    elements.agentList.innerHTML = snapshot.agents.map((agent) => {
      const costs = Engine.animalCosts(agent);
      const pressureChips = ["Oi", "Oe", "Di", "De"].map((pole) => `<span class="pressure-chip ${agent.pressure[pole] >= 4 ? "hot" : ""}">${pole} ${agent.pressure[pole].toFixed(1)}</span>`).join("");
      return `
        <article class="agent-card ${agent.id === state.selectedMapAgentId ? "selected" : ""}" style="--agent-color:${agent.color}" data-agent-id="${agent.id}">
          <div class="agent-card-head">
            <div class="agent-name"><i class="agent-swatch"></i>${escapeHtml(agent.name)} · ${escapeHtml(positionName(agent.position))}</div>
            <span class="coin-stack">${agent.profile.observer}/${agent.profile.decider} · ${agent.profile.polarity[0]}</span>
          </div>
          <p class="agent-goal">Goal: ${escapeHtml(agent.goal.name)} · cheapest ${Object.entries(costs).sort((a, b) => a[1] - b[1])[0][0]}</p>
          <div class="meters">
            ${meter("Stamina", agent.stamina, 12, agent.color)}
            ${meter("Stress", agent.stress, 10, agent.stress > 7 ? "#f07b86" : agent.color)}
          </div>
          <div class="pressure-row">${pressureChips}</div>
          <p class="agent-reason">${escapeHtml(agent.lastReason)}</p>
        </article>
      `;
    }).join("");
  }

  function meter(label, value, max, color) {
    return `<div class="meter"><span>${label}</span><span class="meter-bar"><i style="width:${Math.round(value / max * 100)}%;background:${color}"></i></span><b>${value.toFixed(1)}</b></div>`;
  }

  function positionName(nodeId) {
    if (!state.snapshot) return nodeId;
    const node = state.snapshot.mountain.nodes.find((candidate) => candidate.id === nodeId);
    return node ? node.name : nodeId;
  }

  function renderActions() {
    if (!state.game || state.snapshot.finished) {
      elements.actionGrid.innerHTML = `<div class="model-notice"><strong>Expedition complete.</strong> Inspect the debrief or reveal the true terrain.</div>`;
      return;
    }
    const options = state.game.getActionOptions("player");
    const player = state.snapshot.agents.find((agent) => agent.id === "player");
    const requiredAnimal = state.tutorialActive && state.tutorialStep < tutorialSequence.length ? tutorialSequence[state.tutorialStep] : null;
    elements.playerState.innerHTML = [
      `${player.profile.observer}/${player.profile.decider}`,
      `${player.profile.polarity} polarity`,
      `${player.goal.name}`
    ].map((label) => `<span class="state-chip">${escapeHtml(label)}</span>`).join("");

    elements.actionGrid.innerHTML = options.map((option) => {
      const tutorialBlocked = requiredAnimal && option.animal !== requiredAnimal;
      const pressure = option.pressureAddressed ? `Targets ${option.pressureAddressed} pressure` : "Uses both saviors";
      return `
        <button class="action-card ${option.animal === requiredAnimal ? "guided" : ""}" style="--animal:${option.color}" type="button" data-animal="${option.animal}" ${!option.enabled || tutorialBlocked ? "disabled" : ""}>
          <div class="action-name"><strong>${option.animal}</strong><span>${option.observer} + ${option.decider}</span></div>
          <h3>${escapeHtml(option.label)}</h3>
          <div class="action-target">${escapeHtml(option.targetName)}${option.partnerName ? ` · with ${escapeHtml(option.partnerName)}` : ""}</div>
          <p class="action-rationale">${escapeHtml(option.rationale)}</p>
          <div class="action-costs">
            <span class="cost-chip">Subjective ${option.subjectiveCost.toFixed(1)}</span>
            <span class="cost-chip">Stamina ${option.staminaCost.toFixed(1)}</span>
            ${option.supplyCost ? `<span class="cost-chip">Supplies ${option.supplyCost}</span>` : ""}
            <span class="cost-chip">${pressure}</span>
          </div>
        </button>
      `;
    }).join("");
  }

  function playAnimal(animal) {
    if (!state.game || state.game.finished) return;
    const required = state.tutorialActive && state.tutorialStep < tutorialSequence.length ? tutorialSequence[state.tutorialStep] : null;
    if (required && animal !== required) return;
    state.snapshot = state.game.step(animal);
    if (required === animal) state.tutorialStep += 1;
    renderGame();
    if (state.snapshot.finished) showDebrief();
  }

  function renderTimeline() {
    const timeline = state.snapshot.timeline.slice().reverse();
    if (!timeline.length) {
      elements.timeline.innerHTML = `<article class="timeline-entry"><strong>Round zero</strong><p>Five private maps are ready. Ground truth remains hidden.</p></article>`;
      return;
    }
    elements.timeline.innerHTML = timeline.flatMap((entry) => entry.events.slice(0, 3).map((event, index) => `
      <article class="timeline-entry">
        <strong>R${entry.round} · ${index === 0 ? escapeHtml(entry.weather.label) : escapeHtml(entry.actions[index].animal)}</strong>
        <p>${escapeHtml(event)}</p>
      </article>
    `)).join("");
  }

  function showDebrief() {
    state.revealTruth = true;
    renderMap();
    const summary = state.snapshot.summary;
    const moveMax = Math.max(1, ...Object.values(summary.playerMoves));
    const comparison = state.comparisonBaseline ? comparisonHtml(summary, state.comparisonBaseline) : "";
    elements.debriefContent.innerHTML = `
      <header class="debrief-header ${summary.success ? "success" : "failure"}">
        <p class="eyebrow">Ground truth revealed</p>
        <h2>${summary.success ? "The pathway carried the expedition." : "The weather window closed."}</h2>
        <p>${escapeHtml(summary.reason)}</p>
      </header>
      <div class="debrief-body">
        <div class="metric-grid">
          ${metric("Members at summit", `${summary.arrived} / 5`)}
          ${metric("Supply loads", `${summary.deliveredSupplies} / 3`)}
          ${metric("Edges explored", summary.exploredEdges)}
          ${metric("Reliable shared paths", summary.reliableEdges)}
          ${metric("Remaining supplies", summary.remainingSupplies)}
          ${metric("Final stress", summary.playerStress.toFixed(1))}
          ${metric("Final stamina", summary.playerStamina.toFixed(1))}
          ${metric("Rounds used", `${summary.rounds} / 12`)}
        </div>
        ${comparison}
        <div class="debrief-columns">
          <section class="debrief-section">
            <h3>Your move pattern in this run</h3>
            <div class="move-bars">
              ${Object.entries(summary.playerMoves).map(([name, count]) => `<div class="move-bar"><span>${name}</span><i style="--bar-color:${Engine.ANIMALS[name].color};width:${Math.max(3, count / moveMax * 100)}%"></i><b>${count}</b></div>`).join("")}
            </div>
          </section>
          <section class="debrief-section">
            <h3>Unresolved pressure</h3>
            <div class="pressure-list">
              ${Object.entries(summary.playerPressure).map(([pole, value]) => `<div class="pressure-item"><span>${pole}</span><strong>${value.toFixed(1)}</strong></div>`).join("")}
            </div>
          </section>
        </div>
        <section class="debrief-section">
          <h3>Counterfactual replay</h3>
          <p class="agent-goal">Keep the seed, mountain, goal, and other agents fixed. Change one coin and inspect what follows.</p>
          <div class="counterfactual-actions">
            <button class="primary-button" type="button" data-debrief-action="replay">Replay same configuration</button>
            <button class="quiet-button" type="button" data-debrief-action="flip-observer">Flip ${summary.playerProfile.observer} to ${summary.playerProfile.observer === "Oi" ? "Oe" : "Oi"}</button>
            <button class="quiet-button" type="button" data-debrief-action="flip-decider">Flip ${summary.playerProfile.decider} to ${summary.playerProfile.decider === "Di" ? "De" : "Di"}</button>
            <button class="quiet-button" type="button" data-debrief-action="flip-polarity">Flip ${summary.playerProfile.polarity} polarity</button>
            <button class="quiet-button" type="button" data-debrief-action="inspect">Inspect true mountain</button>
            <button class="quiet-button" type="button" data-debrief-action="setup">New expedition setup</button>
          </div>
        </section>
        <div class="model-notice"><strong>Run-specific result.</strong> This debrief explains behavior inside this simulation. It does not infer your real personality or establish that OPS describes human cognition.</div>
      </div>
    `;
    if (!elements.debriefDialog.open) elements.debriefDialog.showModal();
  }

  function metric(label, value) {
    return `<div class="metric"><small>${escapeHtml(label)}</small><strong>${escapeHtml(value)}</strong></div>`;
  }

  function comparisonHtml(current, baseline) {
    const delta = (value, previous) => {
      const difference = value - previous;
      return `${difference > 0 ? "+" : ""}${difference.toFixed(1)}`;
    };
    return `<section class="debrief-section"><h3>Compared with the previous configuration</h3><div class="pressure-list">
      <div class="pressure-item"><span>Members at summit</span><strong>${delta(current.arrived, baseline.arrived)}</strong></div>
      <div class="pressure-item"><span>Loads delivered</span><strong>${delta(current.deliveredSupplies, baseline.deliveredSupplies)}</strong></div>
      <div class="pressure-item"><span>Stress</span><strong>${delta(current.playerStress, baseline.playerStress)}</strong></div>
      <div class="pressure-item"><span>Reliable paths</span><strong>${delta(current.reliableEdges, baseline.reliableEdges)}</strong></div>
    </div></section>`;
  }

  function handleDebriefAction(action) {
    const baseline = state.snapshot.summary;
    if (action === "inspect") {
      elements.debriefDialog.close();
      return;
    }
    if (action === "setup") {
      state.comparisonBaseline = null;
      showSetup();
      return;
    }
    const profile = { ...state.config.profile };
    if (action === "flip-observer") profile.observer = profile.observer === "Oi" ? "Oe" : "Oi";
    if (action === "flip-decider") profile.decider = profile.decider === "Di" ? "De" : "Di";
    if (action === "flip-polarity") profile.polarity = profile.polarity === "Observer" ? "Decider" : "Observer";
    if (action !== "replay") state.comparisonBaseline = baseline;
    else state.comparisonBaseline = null;
    elements.debriefDialog.close();
    startGame({ profile, tutorialActive: false });
  }

  function bindGameEvents() {
    elements.actionGrid.addEventListener("click", (event) => {
      const button = event.target.closest("[data-animal]");
      if (button && !button.disabled) playAnimal(button.dataset.animal);
    });
    elements.agentList.addEventListener("click", (event) => {
      const card = event.target.closest("[data-agent-id]");
      if (!card) return;
      state.selectedMapAgentId = card.dataset.agentId;
      elements.mapAgentSelect.value = state.selectedMapAgentId;
      renderMap();
      renderAgents();
    });
    elements.mapAgentSelect.addEventListener("change", () => {
      state.selectedMapAgentId = elements.mapAgentSelect.value;
      renderMap();
      renderAgents();
    });
    elements.edgeLayer.addEventListener("pointerdown", (event) => {
      const edge = event.target.closest("[data-edge-id]");
      if (edge) showEdgeCallout(edge.dataset.edgeId, event.clientX, event.clientY);
    });
    elements.mountainSvg.addEventListener("pointerleave", () => { elements.mapCallout.hidden = true; });
    elements.debriefDialog.addEventListener("click", (event) => {
      const button = event.target.closest("[data-debrief-action]");
      if (button) handleDebriefAction(button.dataset.debriefAction);
    });
  }

  function bindDialogs() {
    elements.aboutButton.addEventListener("click", () => elements.aboutDialog.showModal());
    document.querySelectorAll("[data-close-dialog]").forEach((button) => button.addEventListener("click", () => button.closest("dialog").close()));
  }

  function init() {
    cacheElements();
    readUrl();
    elements.seedInput.value = state.config.seed;
    renderScenarios();
    renderGoals();
    renderCoinControls();
    updateCustomControls();
    bindSetupEvents();
    bindGameEvents();
    bindDialogs();
  }

  init();
})();
