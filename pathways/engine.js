(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.PathwaysEngine = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const ANIMALS = Object.freeze({
    Sleep: {
      observer: "Oi",
      decider: "Di",
      verb: "Strengthen a route you understand",
      short: "Personal mastery",
      color: "#f2b84b"
    },
    Consume: {
      observer: "Oe",
      decider: "Di",
      verb: "Scout an uncertain route",
      short: "Private discovery",
      color: "#58c4dd"
    },
    Blast: {
      observer: "Oi",
      decider: "De",
      verb: "Publish and establish a known route",
      short: "Shared infrastructure",
      color: "#f0758b"
    },
    Play: {
      observer: "Oe",
      decider: "De",
      verb: "Explore and reconcile maps together",
      short: "Joint discovery",
      color: "#83d17a"
    }
  });

  const ANIMAL_ORDER = Object.freeze(["Sleep", "Consume", "Blast", "Play"]);

  const SCENARIOS = Object.freeze({
    uncharted: {
      id: "uncharted",
      name: "Uncharted Range",
      description: "The terrain is stable, but most viable routes are still unknown.",
      uncertainty: 0.86,
      volatility: 0.12,
      interdependence: 0.42,
      disagreement: 0.28,
      initialSupplies: 17,
      stormLabel: "whiteout"
    },
    melting: {
      id: "melting",
      name: "Melting Pass",
      description: "Useful trails change as warming ice and rockfall reshape the mountain.",
      uncertainty: 0.52,
      volatility: 0.82,
      interdependence: 0.55,
      disagreement: 0.35,
      initialSupplies: 18,
      stormLabel: "ice break"
    },
    convoy: {
      id: "convoy",
      name: "Supply Convoy",
      description: "The mountain is legible, but no one can carry the expedition alone.",
      uncertainty: 0.34,
      volatility: 0.2,
      interdependence: 0.9,
      disagreement: 0.45,
      initialSupplies: 21,
      stormLabel: "supply window closes"
    },
    wrong: {
      id: "wrong",
      name: "Confidently Wrong",
      description: "Most maps agree on a route that one expedition member doubts.",
      uncertainty: 0.58,
      volatility: 0.3,
      interdependence: 0.74,
      disagreement: 0.86,
      initialSupplies: 18,
      stormLabel: "rescue window closes",
      falseConsensus: true
    }
  });

  const GOALS = Object.freeze([
    { id: "speed", name: "Reach early", description: "Value upward progress and arriving before the final rounds.", progress: 1.4, safety: 0.65, discovery: 0.45, group: 0.55, economy: 0.45 },
    { id: "safety", name: "Avoid preventable risk", description: "Value reliable routes and preserved stamina.", progress: 0.65, safety: 1.45, discovery: 0.55, group: 0.7, economy: 0.65 },
    { id: "discovery", name: "Map the unknown", description: "Value high-confidence knowledge of alternative routes.", progress: 0.55, safety: 0.55, discovery: 1.55, group: 0.5, economy: 0.4 },
    { id: "solidarity", name: "Keep the expedition together", description: "Value shared progress and reduce stranding.", progress: 0.7, safety: 0.85, discovery: 0.5, group: 1.5, economy: 0.5 },
    { id: "economy", name: "Preserve scarce supplies", description: "Value low material use and efficient infrastructure.", progress: 0.7, safety: 0.8, discovery: 0.45, group: 0.55, economy: 1.55 }
  ]);

  const PROFILE_PRESETS = Object.freeze([
    { id: "oi-di-observer", observer: "Oi", decider: "Di", polarity: "Observer" },
    { id: "oi-di-decider", observer: "Oi", decider: "Di", polarity: "Decider" },
    { id: "oe-di-observer", observer: "Oe", decider: "Di", polarity: "Observer" },
    { id: "oe-di-decider", observer: "Oe", decider: "Di", polarity: "Decider" },
    { id: "oi-de-observer", observer: "Oi", decider: "De", polarity: "Observer" },
    { id: "oi-de-decider", observer: "Oi", decider: "De", polarity: "Decider" },
    { id: "oe-de-observer", observer: "Oe", decider: "De", polarity: "Observer" },
    { id: "oe-de-decider", observer: "Oe", decider: "De", polarity: "Decider" }
  ]);

  const DEFAULT_ROUNDS = 12;

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function round(value, places = 2) {
    const p = 10 ** places;
    return Math.round(value * p) / p;
  }

  function hashSeed(input) {
    const text = String(input);
    let hash = 2166136261;
    for (let i = 0; i < text.length; i += 1) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0 || 1;
  }

  class RNG {
    constructor(seed) {
      this.state = hashSeed(seed);
    }

    next() {
      this.state += 0x6d2b79f5;
      let t = this.state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }

    int(min, max) {
      return min + Math.floor(this.next() * (max - min + 1));
    }

    pick(items) {
      return items[this.int(0, items.length - 1)];
    }

    shuffle(items) {
      const result = items.slice();
      for (let i = result.length - 1; i > 0; i -= 1) {
        const j = this.int(0, i);
        [result[i], result[j]] = [result[j], result[i]];
      }
      return result;
    }
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function normalizeProfile(profile) {
    const observer = profile && profile.observer === "Oe" ? "Oe" : "Oi";
    const decider = profile && profile.decider === "De" ? "De" : "Di";
    const polarity = profile && profile.polarity === "Decider" ? "Decider" : "Observer";
    return { observer, decider, polarity, id: `${observer.toLowerCase()}-${decider.toLowerCase()}-${polarity.toLowerCase()}` };
  }

  function goalChoices(seed) {
    const rng = new RNG(`${seed}:goal-choices`);
    return rng.shuffle(GOALS).slice(0, 3).map(clone);
  }

  function scenarioConfig(id, custom) {
    if (id === "custom") {
      const input = custom || {};
      return {
        id: "custom",
        name: "Custom Expedition",
        description: "A custom balance of terrain uncertainty and social interdependence.",
        uncertainty: clamp(Number(input.uncertainty) || 0.5, 0, 1),
        volatility: clamp(Number(input.volatility) || 0.5, 0, 1),
        interdependence: clamp(Number(input.interdependence) || 0.5, 0, 1),
        disagreement: clamp(Number(input.disagreement) || 0.5, 0, 1),
        initialSupplies: 18,
        stormLabel: "weather window closes"
      };
    }
    return clone(SCENARIOS[id] || SCENARIOS.uncharted);
  }

  function createMountain(rng, scenario) {
    const nodes = [
      { id: "base", name: "Base Camp", x: 50, y: 92, level: 0 },
      { id: "l1a", name: "Pine Shelf", x: 22, y: 72, level: 1 },
      { id: "l1b", name: "River Split", x: 50, y: 70, level: 1 },
      { id: "l1c", name: "Scree Gate", x: 78, y: 73, level: 1 },
      { id: "l2a", name: "West Bowl", x: 15, y: 50, level: 2 },
      { id: "l2b", name: "Old Refuge", x: 39, y: 48, level: 2 },
      { id: "l2c", name: "Glass Ridge", x: 63, y: 49, level: 2 },
      { id: "l2d", name: "East Face", x: 86, y: 52, level: 2 },
      { id: "l3a", name: "Cloud Camp", x: 30, y: 28, level: 3 },
      { id: "l3b", name: "Knife Pass", x: 52, y: 25, level: 3 },
      { id: "l3c", name: "Sun Ledge", x: 73, y: 30, level: 3 },
      { id: "summit", name: "Summit", x: 51, y: 8, level: 4 }
    ];

    const pairs = [
      ["base", "l1a"], ["base", "l1b"], ["base", "l1c"],
      ["l1a", "l2a"], ["l1a", "l2b"], ["l1b", "l2b"], ["l1b", "l2c"],
      ["l1c", "l2c"], ["l1c", "l2d"], ["l2a", "l3a"], ["l2b", "l3a"],
      ["l2b", "l3b"], ["l2c", "l3b"], ["l2c", "l3c"], ["l2d", "l3c"],
      ["l3a", "summit"], ["l3b", "summit"], ["l3c", "summit"]
    ];

    const nodeById = Object.fromEntries(nodes.map((node) => [node.id, node]));
    const edges = pairs.map((pair, index) => {
      const from = nodeById[pair[0]];
      const to = nodeById[pair[1]];
      const exposed = rng.next();
      return {
        id: `e${index + 1}`,
        from: from.id,
        to: to.id,
        name: `${from.name} to ${to.name}`,
        trueCost: round(1.2 + rng.next() * 2.6),
        trueRisk: round(clamp(0.08 + exposed * 0.58 + scenario.volatility * 0.12, 0.05, 0.88)),
        volatility: round(clamp(rng.next() * 0.55 + scenario.volatility * 0.45, 0, 1)),
        blocked: false,
        infrastructure: 0,
        traversals: 0,
        levelGain: to.level - from.level
      };
    });

    let falseConsensusEdgeId = null;
    if (scenario.falseConsensus) {
      const candidates = edges.filter((edge) => edge.from === "l1b" || edge.from === "l2b");
      const trap = candidates[0] || edges[5];
      trap.trueRisk = 0.94;
      trap.blocked = true;
      falseConsensusEdgeId = trap.id;
    }

    return { nodes, edges, falseConsensusEdgeId };
  }

  function axisForPole(pole) {
    return pole[0] === "O" ? "Observer" : "Decider";
  }

  function saviorForAxis(profile, axis) {
    return axis === "Observer" ? profile.observer : profile.decider;
  }

  function poleCost(agent, pole) {
    const axis = axisForPole(pole);
    const savior = saviorForAxis(agent.profile, axis);
    if (pole === savior) return 1;
    const polarized = agent.profile.polarity === axis;
    const base = polarized ? 3.2 : 2.1;
    const adaptation = agent.adaptation[pole] || 0;
    const stressAmplifier = agent.stress * (polarized ? 0.055 : 0.025);
    return clamp(base + stressAmplifier - adaptation, 1.35, 5.2);
  }

  function animalCost(agent, animalName) {
    const animal = ANIMALS[animalName];
    return round(poleCost(agent, animal.observer) + poleCost(agent, animal.decider));
  }

  function animalCosts(agent) {
    return Object.fromEntries(ANIMAL_ORDER.map((name) => [name, animalCost(agent, name)]));
  }

  function createAgent(id, name, profile, goal, color) {
    return {
      id,
      name,
      color,
      profile: normalizeProfile(profile),
      goal: clone(goal),
      position: "base",
      stamina: 12,
      stress: 1,
      adaptation: { Oi: 0, Oe: 0, Di: 0, De: 0 },
      pressure: { Oi: 0, Oe: 0, Di: 0, De: 0 },
      mastery: {},
      beliefs: {},
      expressedGoal: false,
      lastAction: null,
      lastReason: "Awaiting the first observation.",
      moveCounts: { Sleep: 0, Consume: 0, Blast: 0, Play: 0 },
      stranded: false,
      arrivedRound: null,
      discoveries: 0,
      personalProgress: 0
    };
  }

  class Game {
    constructor(options = {}) {
      this.seed = String(options.seed || "pathways-001");
      this.scenario = scenarioConfig(options.scenarioId || "uncharted", options.customScenario);
      this.roundLimit = Number(options.roundLimit) || DEFAULT_ROUNDS;
      this.rng = new RNG(`${this.seed}:${this.scenario.id}`);
      this.mountain = createMountain(this.rng, this.scenario);
      this.nodeById = Object.fromEntries(this.mountain.nodes.map((node) => [node.id, node]));
      this.edgeById = Object.fromEntries(this.mountain.edges.map((edge) => [edge.id, edge]));
      this.round = 0;
      this.supplies = this.scenario.initialSupplies;
      this.deliveredSupplies = 0;
      this.weather = { label: "clear planning window", severity: 0.08, changedEdges: [] };
      this.commitments = {};
      this.timeline = [];
      this.finished = false;
      this.success = false;
      this.finishReason = null;

      const playerProfile = normalizeProfile(options.playerProfile || PROFILE_PRESETS[0]);
      const requestedGoal = GOALS.find((goal) => goal.id === options.playerGoalId);
      const playerGoal = requestedGoal || goalChoices(this.seed)[0];
      const profilePool = this.rng.shuffle(PROFILE_PRESETS.filter((profile) => profile.id !== playerProfile.id));
      const goalPool = this.rng.shuffle(GOALS.filter((goal) => goal.id !== playerGoal.id));
      const names = ["You", "Mara", "Ivo", "Noor", "Tomas"];
      const colors = ["#f7cb67", "#7fd7c4", "#f78c9b", "#9fa8ff", "#e5a9f2"];

      this.agents = [createAgent("player", names[0], playerProfile, playerGoal, colors[0])];
      for (let i = 1; i < 5; i += 1) {
        const profile = profilePool[(i - 1) % profilePool.length];
        const goal = goalPool[(i - 1) % goalPool.length];
        this.agents.push(createAgent(`a${i}`, names[i], profile, goal, colors[i]));
      }
      this.agentById = Object.fromEntries(this.agents.map((agent) => [agent.id, agent]));
      this.initializeBeliefs();
      this.updatePressures();
    }

    initializeBeliefs() {
      const baseEdges = this.outgoingEdges("base");
      this.agents.forEach((agent, index) => {
        const shuffled = new RNG(`${this.seed}:beliefs:${agent.id}`).shuffle(baseEdges);
        const knownCount = this.scenario.uncertainty > 0.7 ? 1 : 2;
        shuffled.slice(0, knownCount).forEach((edge) => this.observe(agent, edge, 0.64, false));

        if (this.scenario.falseConsensus && this.mountain.falseConsensusEdgeId) {
          const trap = this.edgeById[this.mountain.falseConsensusEdgeId];
          if (index < 4) {
            agent.beliefs[trap.id] = {
              known: true,
              estimatedCost: 1.15,
              estimatedRisk: 0.08,
              blocked: false,
              confidence: 0.9,
              lastObserved: 0,
              source: "old expedition map"
            };
          } else {
            this.observe(agent, trap, 0.93, true);
          }
        }
      });
    }

    outgoingEdges(nodeId) {
      return this.mountain.edges.filter((edge) => edge.from === nodeId);
    }

    agentsAt(nodeId) {
      return this.agents.filter((agent) => agent.position === nodeId && !agent.stranded);
    }

    observe(agent, edge, confidence = 0.78, precise = false) {
      const noiseScale = precise ? 0 : (1 - confidence) * 0.55;
      const noise = (this.rng.next() * 2 - 1) * noiseScale;
      agent.beliefs[edge.id] = {
        known: true,
        estimatedCost: round(clamp(edge.trueCost + noise * 2, 0.5, 6)),
        estimatedRisk: round(clamp(edge.trueRisk + noise, 0.01, 0.99)),
        blocked: precise ? edge.blocked : (edge.blocked && confidence > 0.82),
        confidence: round(confidence),
        lastObserved: this.round,
        source: precise ? "direct inspection" : "field observation"
      };
      agent.discoveries += 1;
    }

    shareBelief(sender, receiver, edge, confidenceFactor = 0.82) {
      const source = sender.beliefs[edge.id];
      if (!source) return;
      const existing = receiver.beliefs[edge.id];
      const incomingConfidence = source.confidence * confidenceFactor;
      if (!existing || incomingConfidence > existing.confidence || existing.lastObserved < source.lastObserved) {
        receiver.beliefs[edge.id] = {
          ...clone(source),
          confidence: round(incomingConfidence),
          source: `${sender.name}'s report`
        };
      }
    }

    getActionOptions(agentId = "player") {
      const agent = this.agentById[agentId];
      if (!agent || this.finished) return [];
      return ANIMAL_ORDER.map((animalName) => this.makeOption(agent, animalName));
    }

    makeOption(agent, animalName) {
      const animal = ANIMALS[animalName];
      const candidates = this.outgoingEdges(agent.position);
      const known = candidates.filter((edge) => agent.beliefs[edge.id]);
      const unknown = candidates.filter((edge) => !agent.beliefs[edge.id]);
      let pool = animal.observer === "Oe" ? (unknown.length ? unknown : candidates) : (known.length ? known : candidates);
      if (!pool.length && agent.position === "summit") {
        pool = this.mountain.edges.filter((edge) => edge.infrastructure < 0.8);
      }

      const target = pool.slice().sort((a, b) => this.edgePriority(agent, b, animalName) - this.edgePriority(agent, a, animalName))[0] || null;
      const partner = animal.decider === "De"
        ? this.agentsAt(agent.position).filter((candidate) => candidate.id !== agent.id).sort((a, b) => a.stress - b.stress)[0] || null
        : null;
      const cost = animalCost(agent, animalName);
      const pressureKey = animal.observer !== agent.profile.observer ? animal.observer : (animal.decider !== agent.profile.decider ? animal.decider : null);
      const enabled = Boolean(target);
      return {
        animal: animalName,
        observer: animal.observer,
        decider: animal.decider,
        label: animal.verb,
        short: animal.short,
        color: animal.color,
        targetEdgeId: target ? target.id : null,
        targetName: target ? target.name : "No remaining ascent",
        partnerId: partner ? partner.id : null,
        partnerName: partner ? partner.name : null,
        subjectiveCost: cost,
        staminaCost: round(0.9 + cost * 0.18 + (animalName === "Blast" ? 0.35 : 0)),
        supplyCost: animalName === "Blast" ? Math.min(2, this.supplies) : 0,
        pressureAddressed: pressureKey,
        enabled,
        rationale: this.optionRationale(agent, animalName, target, partner)
      };
    }

    edgePriority(agent, edge, animalName) {
      const belief = agent.beliefs[edge.id];
      const targetNode = this.nodeById[edge.to];
      const unknownBonus = belief ? 0 : 2.3;
      const progress = targetNode.level * 1.4;
      const safety = belief ? (1 - belief.estimatedRisk) * 2 : 0.7;
      const mastery = agent.mastery[edge.id] || 0;
      const support = this.commitments[edge.id] || 0;
      if (animalName === "Consume") return progress + unknownBonus * agent.goal.discovery + safety * 0.25;
      if (animalName === "Play") return progress + unknownBonus + support * 0.35 + this.scenario.interdependence;
      if (animalName === "Sleep") return progress + safety * agent.goal.safety + (1 - mastery) * 1.2;
      return progress + safety + support * agent.goal.group + (1 - edge.infrastructure) * 1.4;
    }

    optionRationale(agent, animalName, edge, partner) {
      if (!edge) return "No unresolved pathway remains from this position.";
      const belief = agent.beliefs[edge.id];
      if (animalName === "Consume") {
        return belief ? "Recheck the stalest available observation privately." : "Reduce a concrete gap in the private map.";
      }
      if (animalName === "Sleep") {
        return belief ? "Turn a known possibility into reliable personal mastery." : "Study the least-known route before trusting it.";
      }
      if (animalName === "Blast") {
        return `Convert current knowledge into a route the expedition can use${this.commitments[edge.id] ? " and reinforce existing commitment" : ""}.`;
      }
      return `Reconcile maps${partner ? ` with ${partner.name}` : " with the expedition"} while exploring the frontier.`;
    }

    privateBestEdge(agent) {
      const candidates = this.outgoingEdges(agent.position);
      return candidates.slice().sort((a, b) => this.edgePriority(agent, b, "Sleep") - this.edgePriority(agent, a, "Sleep"))[0] || null;
    }

    scoreOption(agent, option) {
      if (!option.enabled) return -Infinity;
      const edge = this.edgeById[option.targetEdgeId];
      const belief = agent.beliefs[edge.id];
      const node = this.nodeById[edge.to];
      const progress = node.level - this.nodeById[agent.position].level;
      const perceivedRisk = belief ? belief.estimatedRisk : 0.52;
      const infoGain = belief ? clamp((this.round - belief.lastObserved) / 4, 0, 1) : 1;
      const support = this.commitments[edge.id] || 0;
      const privateBest = this.privateBestEdge(agent);
      const privateAlignment = privateBest && privateBest.id === edge.id ? 1 : -0.35;
      let benefit = progress * 2.4 * agent.goal.progress;
      benefit += (1 - perceivedRisk) * 1.8 * agent.goal.safety;
      benefit += (option.observer === "Oe" ? infoGain * 2.4 : (1 - (agent.mastery[edge.id] || 0)) * 1.5) * agent.goal.discovery;
      benefit += (option.decider === "De" ? support * 0.9 + this.scenario.interdependence * 1.4 : privateAlignment * 1.1) * (option.decider === "De" ? agent.goal.group : 1);
      benefit += option.animal === "Blast" ? edge.infrastructure * 0.4 : 0;
      const objectiveCost = option.staminaCost + option.supplyCost * 0.18 * agent.goal.economy;
      const stressWeight = 0.46 + agent.stress * 0.045;
      return round(benefit - objectiveCost - option.subjectiveCost * stressWeight - perceivedRisk * 1.2);
    }

    chooseAutonomousAction(agent) {
      const options = this.getActionOptions(agent.id).map((option) => ({ ...option, score: this.scoreOption(agent, option) }));
      options.sort((a, b) => b.score - a.score || ANIMAL_ORDER.indexOf(a.animal) - ANIMAL_ORDER.indexOf(b.animal));
      return options[0];
    }

    step(playerAnimal) {
      if (this.finished) return this.snapshot();
      const playerOptions = this.getActionOptions("player");
      const playerAction = playerOptions.find((option) => option.animal === playerAnimal && option.enabled);
      if (!playerAction) throw new Error(`Unavailable player action: ${playerAnimal}`);

      this.round += 1;
      this.updateWeather();
      const actions = [playerAction];
      for (const agent of this.agents.slice(1)) actions.push(this.chooseAutonomousAction(agent));
      this.commitments = {};
      for (const action of actions) {
        if (action && action.decider === "De" && action.targetEdgeId) {
          this.commitments[action.targetEdgeId] = (this.commitments[action.targetEdgeId] || 0) + 1;
        }
      }

      const beforePressure = Object.fromEntries(this.agents.map((agent) => [agent.id, clone(agent.pressure)]));
      const events = [];
      actions.forEach((action, index) => {
        const agent = this.agents[index];
        events.push(this.resolveAction(agent, action));
      });
      this.updatePressures();
      this.updateAdaptation(actions, beforePressure);
      this.applyRoundRecovery();
      this.checkFinish();

      this.timeline.push({
        round: this.round,
        weather: clone(this.weather),
        actions: actions.map((action, index) => ({
          agentId: this.agents[index].id,
          agentName: this.agents[index].name,
          animal: action.animal,
          targetEdgeId: action.targetEdgeId,
          targetName: action.targetName,
          subjectiveCost: action.subjectiveCost,
          reason: this.agents[index].lastReason
        })),
        events
      });
      return this.snapshot();
    }

    resolveAction(agent, action) {
      if (!action || !action.enabled) {
        agent.stress = clamp(agent.stress + 0.6, 0, 10);
        agent.lastReason = "No viable action was available.";
        return `${agent.name} could not act.`;
      }
      const edge = this.edgeById[action.targetEdgeId];
      agent.moveCounts[action.animal] += 1;
      agent.stamina = round(clamp(agent.stamina - action.staminaCost, 0, 12));
      agent.stress = round(clamp(agent.stress + Math.max(0, action.subjectiveCost - 2.2) * 0.34, 0, 10));

      if (action.animal === "Consume") {
        this.observe(agent, edge, 0.86, true);
        agent.mastery[edge.id] = round(clamp((agent.mastery[edge.id] || 0) + 0.12, 0, 1));
      } else if (action.animal === "Sleep") {
        if (!agent.beliefs[edge.id]) this.observe(agent, edge, 0.68, false);
        agent.mastery[edge.id] = round(clamp((agent.mastery[edge.id] || 0) + 0.36, 0, 1));
        agent.beliefs[edge.id].confidence = round(clamp(agent.beliefs[edge.id].confidence + 0.1, 0, 1));
      } else if (action.animal === "Blast") {
        if (!agent.beliefs[edge.id]) this.observe(agent, edge, 0.62, false);
        this.supplies = Math.max(0, this.supplies - action.supplyCost);
        edge.infrastructure = round(clamp(edge.infrastructure + 0.12 + action.supplyCost * 0.11, 0, 1));
        agent.expressedGoal = true;
        this.agents.forEach((receiver) => this.shareBelief(agent, receiver, edge, 0.9));
      } else if (action.animal === "Play") {
        const partner = this.agentById[action.partnerId] || this.agentsAt(agent.position).find((candidate) => candidate.id !== agent.id);
        this.observe(agent, edge, 0.82, true);
        agent.expressedGoal = true;
        if (partner) {
          this.observe(partner, edge, 0.74, true);
          this.shareBelief(agent, partner, edge, 0.92);
          this.shareBelief(partner, agent, edge, 0.92);
        }
      }

      const moved = this.attemptTraversal(agent, edge, action);
      const privateBest = this.privateBestEdge(agent);
      const belief = agent.beliefs[edge.id];
      agent.lastReason = `${action.rationale} ${belief ? `Perceived risk ${Math.round(belief.estimatedRisk * 100)}%.` : "Risk remained unknown."}`;
      if (action.decider === "Di" && privateBest && privateBest.id === edge.id) agent.personalProgress += 0.5;
      if (action.decider === "De" && (this.commitments[edge.id] || 0) >= 2) agent.personalProgress += 0.5;
      return `${agent.name} used ${action.animal} on ${edge.name}${moved ? ` and reached ${this.nodeById[agent.position].name}` : ""}.`;
    }

    attemptTraversal(agent, edge, action) {
      if (agent.position !== edge.from || edge.blocked) {
        if (edge.blocked) agent.stress = round(clamp(agent.stress + 0.9, 0, 10));
        return false;
      }
      const mastery = agent.mastery[edge.id] || 0;
      const coordinated = this.commitments[edge.id] || 0;
      let successChance = 0.48 + mastery * 0.28 + edge.infrastructure * 0.24 - edge.trueRisk * 0.42;
      if (action.animal === "Consume") successChance += 0.08;
      if (action.animal === "Sleep") successChance += 0.1;
      if (action.decider === "De") successChance += coordinated * 0.035 * this.scenario.interdependence;
      successChance = clamp(successChance, 0.08, 0.96);
      const moved = this.rng.next() < successChance;
      if (moved) {
        agent.position = edge.to;
        edge.traversals += 1;
        if (edge.to === "summit" && agent.arrivedRound === null) {
          agent.arrivedRound = this.round;
          if (this.supplies > 0) {
            this.supplies -= 1;
            this.deliveredSupplies += 1;
          }
        }
      } else {
        agent.stress = round(clamp(agent.stress + 0.45 + edge.trueRisk * 0.4, 0, 10));
      }
      return moved;
    }

    updateWeather() {
      const severity = clamp(0.08 + this.scenario.volatility * (0.25 + this.rng.next() * 0.65) + this.round / this.roundLimit * 0.18, 0, 1);
      const labels = severity < 0.32 ? ["clear", "light wind", "high cloud"] : severity < 0.68 ? ["crosswind", "freezing rain", "moving fog"] : ["rockfall", "ice fracture", "whiteout"];
      const changedEdges = [];
      const changes = severity > 0.55 ? 2 : 1;
      for (let i = 0; i < changes; i += 1) {
        const edge = this.rng.pick(this.mountain.edges);
        if (this.rng.next() < edge.volatility * this.scenario.volatility) {
          const delta = (this.rng.next() * 2 - 0.7) * 0.24;
          edge.trueRisk = round(clamp(edge.trueRisk + delta, 0.04, 0.96));
          if (!this.scenario.falseConsensus || edge.id !== this.mountain.falseConsensusEdgeId) {
            edge.blocked = edge.trueRisk > 0.9 && this.rng.next() < 0.35;
          }
          changedEdges.push(edge.id);
        }
      }
      this.weather = { label: this.rng.pick(labels), severity: round(severity), changedEdges };
    }

    updatePressures() {
      for (const agent of this.agents) {
        const outgoing = this.outgoingEdges(agent.position);
        if (!outgoing.length) {
          agent.pressure = { Oi: 0, Oe: 0, Di: 0, De: 0 };
          continue;
        }
        const unknown = outgoing.filter((edge) => !agent.beliefs[edge.id]).length;
        const stale = outgoing.filter((edge) => agent.beliefs[edge.id] && this.round - agent.beliefs[edge.id].lastObserved >= 3).length;
        const fragile = outgoing.filter((edge) => {
          const known = agent.beliefs[edge.id];
          return known && (agent.mastery[edge.id] || 0) + edge.infrastructure < 0.5;
        }).length;
        const targets = Object.keys(this.commitments).filter((edgeId) => {
          const edge = this.edgeById[edgeId];
          return edge && edge.from === agent.position && this.commitments[edgeId] > 0;
        });
        const fragmentation = targets.length > 1 ? targets.length - 1 : 0;
        const privateBest = this.privateBestEdge(agent);
        const lastEdgeId = agent.lastAction && agent.lastAction.targetEdgeId;
        const privateConflict = agent.lastAction && agent.lastAction.decider === "De" && privateBest && lastEdgeId !== privateBest.id ? 1 : 0;
        const next = {
          Oe: clamp((unknown + stale * 0.7) / outgoing.length * 7, 0, 10),
          Oi: clamp(fragile / outgoing.length * 7, 0, 10),
          De: clamp(fragmentation * 2.4 + (!agent.expressedGoal ? this.scenario.interdependence * 2.2 : 0), 0, 10),
          Di: clamp(privateConflict * 4 + (agent.expressedGoal && this.scenario.disagreement > 0.7 ? 0.8 : 0), 0, 10)
        };
        for (const pole of ["Oi", "Oe", "Di", "De"]) {
          agent.pressure[pole] = round(agent.pressure[pole] * 0.42 + next[pole] * 0.58);
        }
        const demonObserver = agent.profile.observer === "Oi" ? "Oe" : "Oi";
        const demonDecider = agent.profile.decider === "Di" ? "De" : "Di";
        const polarDemon = agent.profile.polarity === "Observer" ? demonObserver : demonDecider;
        agent.stress = round(clamp(agent.stress + agent.pressure[polarDemon] * 0.055, 0, 10));
      }
    }

    updateAdaptation(actions, beforePressure) {
      actions.forEach((action, index) => {
        const agent = this.agents[index];
        if (!action) return;
        for (const pole of [action.observer, action.decider]) {
          const isDemon = saviorForAxis(agent.profile, axisForPole(pole)) !== pole;
          const pressureDropped = agent.pressure[pole] + 0.15 < beforePressure[agent.id][pole];
          if (isDemon && pressureDropped && agent.stress < 8.5) {
            agent.adaptation[pole] = round(clamp(agent.adaptation[pole] + 0.07, 0, 0.6));
          }
        }
        agent.lastAction = clone(action);
      });
    }

    applyRoundRecovery() {
      this.agents.forEach((agent) => {
        if (agent.position === "summit") {
          agent.stress = round(clamp(agent.stress - 0.45, 0, 10));
          return;
        }
        agent.stamina = round(clamp(agent.stamina + 0.22, 0, 12));
        if (agent.lastAction && animalCost(agent, agent.lastAction.animal) <= 2.5) {
          agent.stress = round(clamp(agent.stress - 0.28, 0, 10));
        }
        if (agent.stamina <= 0.4 && agent.stress > 8.7) agent.stranded = true;
      });
    }

    checkFinish() {
      const arrived = this.agents.filter((agent) => agent.position === "summit").length;
      if (arrived >= 3 && this.deliveredSupplies >= 3) {
        this.finished = true;
        this.success = true;
        this.finishReason = `${arrived} expedition members delivered ${this.deliveredSupplies} supply loads to the summit.`;
      } else if (this.round >= this.roundLimit) {
        this.finished = true;
        this.success = false;
        this.finishReason = `The ${this.scenario.stormLabel} with ${arrived} members and ${this.deliveredSupplies} supply loads at the summit.`;
      }
    }

    summary() {
      const player = this.agentById.player;
      const arrived = this.agents.filter((agent) => agent.position === "summit").length;
      const stranded = this.agents.filter((agent) => agent.stranded).length;
      const explored = this.mountain.edges.filter((edge) => this.agents.some((agent) => agent.beliefs[edge.id])).length;
      const shared = this.mountain.edges.filter((edge) => edge.infrastructure > 0).length;
      const reliable = this.mountain.edges.filter((edge) => edge.infrastructure >= 0.55).length;
      return {
        success: this.success,
        reason: this.finishReason,
        rounds: this.round,
        arrived,
        stranded,
        deliveredSupplies: this.deliveredSupplies,
        remainingSupplies: this.supplies,
        exploredEdges: explored,
        sharedEdges: shared,
        reliableEdges: reliable,
        playerMoves: clone(player.moveCounts),
        playerStress: round(player.stress),
        playerStamina: round(player.stamina),
        playerGoal: clone(player.goal),
        playerProfile: clone(player.profile),
        playerPressure: clone(player.pressure),
        playerAdaptation: clone(player.adaptation)
      };
    }

    snapshot() {
      return {
        seed: this.seed,
        scenario: clone(this.scenario),
        round: this.round,
        roundLimit: this.roundLimit,
        supplies: this.supplies,
        deliveredSupplies: this.deliveredSupplies,
        weather: clone(this.weather),
        commitments: clone(this.commitments),
        mountain: clone(this.mountain),
        agents: clone(this.agents),
        timeline: clone(this.timeline),
        finished: this.finished,
        success: this.success,
        finishReason: this.finishReason,
        summary: this.finished ? this.summary() : null
      };
    }
  }

  function autoplay(options = {}) {
    const game = new Game(options);
    while (!game.finished) {
      const player = game.agentById.player;
      const action = game.chooseAutonomousAction(player);
      game.step(action.animal);
    }
    return game.summary();
  }

  return {
    ANIMALS,
    ANIMAL_ORDER,
    SCENARIOS,
    GOALS,
    PROFILE_PRESETS,
    DEFAULT_ROUNDS,
    RNG,
    Game,
    animalCost,
    animalCosts,
    goalChoices,
    normalizeProfile,
    autoplay,
    hashSeed
  };
});
