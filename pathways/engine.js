(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.PathwaysEngine = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const ANIMALS = Object.freeze({
    Sleep: { observer: "Oi", decider: "Di", verb: "Consolidate a route you expect to reuse", short: "Personal mastery", color: "#f2b84b" },
    Consume: { observer: "Oe", decider: "Di", verb: "Scout or refresh private route evidence", short: "Private discovery", color: "#58c4dd" },
    Blast: { observer: "Oi", decider: "De", verb: "Establish a route for later shared traffic", short: "Shared infrastructure", color: "#f0758b" },
    Play: { observer: "Oe", decider: "De", verb: "Explore and reconcile a route together", short: "Joint discovery", color: "#83d17a" }
  });

  const ANIMAL_ORDER = Object.freeze(["Sleep", "Consume", "Blast", "Play"]);

  const SCENARIOS = Object.freeze({
    uncharted: { id: "uncharted", name: "Uncharted Range", description: "The terrain is stable, but most viable routes are still unknown.", uncertainty: 0.86, volatility: 0.12, interdependence: 0.42, disagreement: 0.28, initialMaterials: 18, stormLabel: "whiteout" },
    melting: { id: "melting", name: "Melting Pass", description: "Useful trails change as warming ice and rockfall reshape the mountain.", uncertainty: 0.52, volatility: 0.82, interdependence: 0.55, disagreement: 0.35, initialMaterials: 20, stormLabel: "ice break" },
    convoy: { id: "convoy", name: "Supply Convoy", description: "The mountain is legible, but repeated payload traffic needs shared capacity.", uncertainty: 0.34, volatility: 0.2, interdependence: 0.9, disagreement: 0.45, initialMaterials: 24, stormLabel: "supply window closes" },
    wrong: { id: "wrong", name: "Confidently Wrong", description: "Most maps agree on a route that one expedition member doubts.", uncertainty: 0.58, volatility: 0.3, interdependence: 0.74, disagreement: 0.86, initialMaterials: 20, stormLabel: "rescue window closes", falseConsensus: true }
  });

  const GOALS = Object.freeze([
    { id: "speed", name: "Complete urgent traffic", description: "Value progress before demand deadlines.", progress: 1.4, safety: 0.65, discovery: 0.45, group: 0.55, economy: 0.45 },
    { id: "safety", name: "Avoid preventable risk", description: "Value reliable routes and preserved stamina.", progress: 0.65, safety: 1.45, discovery: 0.55, group: 0.7, economy: 0.65 },
    { id: "discovery", name: "Map the unknown", description: "Value high-confidence knowledge of alternative routes.", progress: 0.55, safety: 0.55, discovery: 1.55, group: 0.5, economy: 0.4 },
    { id: "solidarity", name: "Keep traffic coordinated", description: "Value shared progress and reduce stranding.", progress: 0.7, safety: 0.85, discovery: 0.5, group: 1.5, economy: 0.5 },
    { id: "economy", name: "Preserve route materials", description: "Value low material use and efficient infrastructure.", progress: 0.7, safety: 0.8, discovery: 0.45, group: 0.55, economy: 1.55 }
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

  const DEFAULT_ROUNDS = 32;
  const HORIZON_LABELS = Object.freeze(["early", "middle", "final"]);

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function round(value, places = 2) {
    const scale = 10 ** places;
    return Math.round(value * scale) / scale;
  }

  function hashSeed(input) {
    const text = String(input);
    let hash = 2166136261;
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
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
      let value = this.state;
      value = Math.imul(value ^ (value >>> 15), value | 1);
      value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
      return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    }

    int(min, max) {
      return min + Math.floor(this.next() * (max - min + 1));
    }

    pick(items) {
      return items[this.int(0, items.length - 1)];
    }

    shuffle(items) {
      const result = items.slice();
      for (let index = result.length - 1; index > 0; index -= 1) {
        const other = this.int(0, index);
        [result[index], result[other]] = [result[other], result[index]];
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
    return new RNG(`${seed}:goal-choices`).shuffle(GOALS).slice(0, 3).map(clone);
  }

  function scenarioConfig(id, custom) {
    if (id === "custom") {
      const input = custom || {};
      const setting = (value) => Number.isFinite(Number(value)) ? Number(value) : 0.5;
      return {
        id: "custom",
        name: "Custom Expedition",
        description: "A custom balance of terrain uncertainty and social interdependence.",
        uncertainty: clamp(setting(input.uncertainty), 0, 1),
        volatility: clamp(setting(input.volatility), 0, 1),
        interdependence: clamp(setting(input.interdependence), 0, 1),
        disagreement: clamp(setting(input.disagreement), 0, 1),
        initialMaterials: 20,
        stormLabel: "weather window closes"
      };
    }
    return clone(SCENARIOS[id] || SCENARIOS.uncharted);
  }

  function createMountain(rng, scenario) {
    const nodes = [{ id: "base", name: "Base Camp", x: 50, y: 94, level: 0 }];
    const laneNames = ["West", "Central", "East"];
    for (let level = 1; level <= 7; level += 1) {
      for (let lane = 0; lane < 3; lane += 1) {
        nodes.push({
          id: `l${level}${String.fromCharCode(97 + lane)}`,
          name: `${laneNames[lane]} Camp ${level}`,
          x: [20, 50, 80][lane] + (level % 2 === 0 ? [3, -2, -3][lane] : 0),
          y: 94 - level * 10.7,
          level
        });
      }
    }
    nodes.push({ id: "summit", name: "Summit Depot", x: 50, y: 8, level: 8 });

    const pairs = [["base", "l1a"], ["base", "l1b"], ["base", "l1c"]];
    for (let level = 1; level < 7; level += 1) {
      const current = [`l${level}a`, `l${level}b`, `l${level}c`];
      const next = [`l${level + 1}a`, `l${level + 1}b`, `l${level + 1}c`];
      pairs.push(
        [current[0], next[0]], [current[0], next[1]],
        [current[1], next[0]], [current[1], next[1]], [current[1], next[2]],
        [current[2], next[1]], [current[2], next[2]],
        [current[0], current[1]], [current[1], current[2]]
      );
    }
    pairs.push(["l7a", "summit"], ["l7b", "summit"], ["l7c", "summit"], ["l7a", "l7b"], ["l7b", "l7c"]);

    const nodeById = Object.fromEntries(nodes.map((node) => [node.id, node]));
    const edges = pairs.map(([from, to], index) => {
      const exposed = rng.next();
      const levelDistance = Math.abs(nodeById[from].level - nodeById[to].level);
      return {
        id: `e${index + 1}`,
        from,
        to,
        name: `${nodeById[from].name} - ${nodeById[to].name}`,
        bidirectional: true,
        trueCost: round(0.9 + levelDistance * 0.65 + rng.next() * 1.5),
        trueRisk: round(clamp(0.06 + exposed * 0.48 + scenario.volatility * 0.14, 0.04, 0.9)),
        volatility: round(clamp(rng.next() * 0.55 + scenario.volatility * 0.45, 0, 1)),
        blocked: false,
        infrastructure: 0,
        infrastructureBuiltRound: null,
        infrastructureBuilderId: null,
        infrastructureContributions: {},
        infrastructureAvailableRoundByBuilder: {},
        pendingInfrastructure: {},
        traversals: 0,
        repeatTraversals: 0,
        personalMasteryUses: 0,
        sharedInfrastructureUses: 0,
        agentTraversals: {}
      };
    });

    let falseConsensusEdgeId = null;
    if (scenario.falseConsensus) {
      const trap = edges.find((edge) => edge.from === "l2b" && edge.to === "l3b") || edges[12];
      trap.trueRisk = 0.96;
      trap.blocked = true;
      falseConsensusEdgeId = trap.id;
    }
    return { nodes, edges, falseConsensusEdgeId };
  }

  function createTrafficDemands(roundLimit) {
    return [
      {
        id: "survey-loop",
        type: "survey-return",
        name: "Survey Central Camp 4 and report back",
        source: "base",
        destination: "l4b",
        stops: ["l4b", "base"],
        stopIndex: 0,
        subject: { kind: "agent", id: "player", label: "You" },
        assignedAgentId: "player",
        priority: 5,
        deadline: Math.min(22, roundLimit),
        value: 4,
        releaseRound: 0,
        currentNode: "base",
        completed: false,
        completedRound: null,
        status: "active",
        legsCompleted: 0
      },
      {
        id: "payload-alpha",
        type: "payload-delivery",
        name: "Deliver payload Alpha to the summit depot",
        source: "base",
        destination: "summit",
        stops: ["summit"],
        stopIndex: 0,
        subject: { kind: "payload", id: "load-alpha", label: "Payload Alpha" },
        assignedAgentId: "a1",
        priority: 5,
        deadline: Math.min(25, roundLimit),
        value: 4,
        releaseRound: 0,
        currentNode: "base",
        completed: false,
        completedRound: null,
        status: "active",
        legsCompleted: 0
      },
      {
        id: "payload-beta",
        type: "payload-delivery",
        name: "Deliver payload Beta through the established network",
        source: "base",
        destination: "summit",
        stops: ["summit"],
        stopIndex: 0,
        subject: { kind: "payload", id: "load-beta", label: "Payload Beta" },
        assignedAgentId: "a2",
        priority: 4,
        deadline: Math.min(29, roundLimit),
        value: 4,
        releaseRound: 5,
        currentNode: "base",
        completed: false,
        completedRound: null,
        status: "queued",
        legsCompleted: 0
      },
      {
        id: "relay-loop",
        type: "relay-return",
        name: "Inspect East Camp 5 and return equipment",
        source: "base",
        destination: "l5c",
        stops: ["l5c", "base"],
        stopIndex: 0,
        subject: { kind: "agent", id: "a3", label: "Noor" },
        assignedAgentId: "a3",
        priority: 3,
        deadline: Math.min(30, roundLimit),
        value: 3,
        releaseRound: 2,
        currentNode: "base",
        completed: false,
        completedRound: null,
        status: "queued",
        legsCompleted: 0
      },
      {
        id: "rescue-loop",
        type: "escort-return",
        name: "Reach West Camp 3 and escort a climber home",
        source: "base",
        destination: "l3a",
        stops: ["l3a", "base"],
        stopIndex: 0,
        subject: { kind: "agent", id: "a4", label: "Tomas" },
        assignedAgentId: "a4",
        priority: 4,
        deadline: Math.min(24, roundLimit),
        value: 3,
        releaseRound: 1,
        currentNode: "base",
        completed: false,
        completedRound: null,
        status: "queued",
        legsCompleted: 0
      }
    ];
  }

  function axisForPole(pole) {
    return pole[0] === "O" ? "Observer" : "Decider";
  }

  function saviorForAxis(profile, axis) {
    return axis === "Observer" ? profile.observer : profile.decider;
  }

  function poleCost(agent, pole) {
    const axis = axisForPole(pole);
    if (pole === saviorForAxis(agent.profile, axis)) return 1;
    const polarized = agent.profile.polarity === axis;
    const adaptation = agent.adaptation[pole] || 0;
    const stressAmplifier = agent.stress * (polarized ? 0.055 : 0.025);
    return clamp((polarized ? 3.2 : 2.1) + stressAmplifier - adaptation, 1.35, 5.2);
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
      stamina: 14,
      stress: 1,
      adaptation: { Oi: 0, Oe: 0, Di: 0, De: 0 },
      pressure: { Oi: 0, Oe: 0, Di: 0, De: 0 },
      mastery: {},
      masteryInvestedRound: {},
      pendingMastery: {},
      beliefs: {},
      expressedGoal: false,
      lastAction: null,
      lastReason: "Awaiting the first logistics demand.",
      movementIntent: null,
      moveCounts: { Sleep: 0, Consume: 0, Blast: 0, Play: 0 },
      stranded: false,
      discoveries: 0,
      personalProgress: 0,
      personalMasteryUses: 0,
      sharedInfrastructureUses: 0,
      completedDemandIds: []
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
      this.materials = this.scenario.initialMaterials;
      this.supplies = this.materials;
      this.deliveredPayload = 0;
      this.deliveredSupplies = 0;
      this.objectiveValue = 0;
      this.weather = { label: "clear logistics window", severity: 0.08, changedEdges: [] };
      this.commitments = {};
      this.timeline = [];
      this.checkpoints = {};
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
      for (let index = 1; index < 5; index += 1) {
        this.agents.push(createAgent(`a${index}`, names[index], profilePool[(index - 1) % profilePool.length], goalPool[(index - 1) % goalPool.length], colors[index]));
      }
      this.agentById = Object.fromEntries(this.agents.map((agent) => [agent.id, agent]));
      this.trafficDemands = clone(options.trafficDemands || createTrafficDemands(this.roundLimit));
      this.initializeBeliefs();
      this.activateDemands();
      this.updateMovementIntents();
      this.updatePressures();
    }

    connectedEdges(nodeId) {
      return this.mountain.edges.filter((edge) => edge.from === nodeId || (edge.bidirectional && edge.to === nodeId));
    }

    outgoingEdges(nodeId) {
      return this.connectedEdges(nodeId);
    }

    otherNode(edge, nodeId) {
      if (edge.from === nodeId) return edge.to;
      if (edge.bidirectional && edge.to === nodeId) return edge.from;
      return null;
    }

    agentsAt(nodeId) {
      return this.agents.filter((agent) => agent.position === nodeId && !agent.stranded);
    }

    initializeBeliefs() {
      const baseEdges = this.connectedEdges("base");
      this.agents.forEach((agent, index) => {
        const shuffled = new RNG(`${this.seed}:beliefs:${agent.id}`).shuffle(baseEdges);
        const knownCount = this.scenario.uncertainty > 0.7 ? 1 : 2;
        shuffled.slice(0, knownCount).forEach((edge) => this.observe(agent, edge, 0.68, false));
        if (this.scenario.falseConsensus && this.mountain.falseConsensusEdgeId) {
          const trap = this.edgeById[this.mountain.falseConsensusEdgeId];
          if (index < 4) {
            agent.beliefs[trap.id] = { known: true, estimatedCost: 1.1, estimatedRisk: 0.08, blocked: false, confidence: 0.9, lastObserved: 0, source: "old expedition map" };
          } else {
            this.observe(agent, trap, 0.94, true);
          }
        }
      });
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
        receiver.beliefs[edge.id] = { ...clone(source), confidence: round(incomingConfidence), source: `${sender.name}'s report` };
      }
    }

    activateDemands() {
      for (const demand of this.trafficDemands) {
        if (!demand.completed && this.round >= demand.releaseRound) demand.status = "active";
      }
    }

    demandForAgent(agentId) {
      return this.trafficDemands
        .filter((demand) => demand.assignedAgentId === agentId && demand.status === "active" && !demand.completed)
        .sort((left, right) => right.priority - left.priority || left.deadline - right.deadline)[0] || null;
    }

    edgeWeight(agent, edge) {
      const belief = agent.beliefs[edge.id];
      if (belief && belief.blocked) return Infinity;
      const risk = belief ? belief.estimatedRisk : 0.58 + this.scenario.uncertainty * 0.12;
      const cost = belief ? belief.estimatedCost : 2.8;
      const mastery = agent.mastery[edge.id] || 0;
      return cost + risk * 3.2 - mastery * 0.9 - edge.infrastructure * 1.1;
    }

    findPath(agent, source, destination) {
      if (source === destination) return { nodes: [source], edges: [] };
      const distances = Object.fromEntries(this.mountain.nodes.map((node) => [node.id, Infinity]));
      const previous = {};
      const unvisited = new Set(this.mountain.nodes.map((node) => node.id));
      distances[source] = 0;
      while (unvisited.size) {
        let current = null;
        for (const nodeId of unvisited) {
          if (current === null || distances[nodeId] < distances[current]) current = nodeId;
        }
        if (current === null || distances[current] === Infinity) break;
        unvisited.delete(current);
        if (current === destination) break;
        for (const edge of this.connectedEdges(current)) {
          const neighbor = this.otherNode(edge, current);
          if (!neighbor || !unvisited.has(neighbor)) continue;
          const weight = this.edgeWeight(agent, edge);
          const candidate = distances[current] + weight;
          if (candidate < distances[neighbor]) {
            distances[neighbor] = candidate;
            previous[neighbor] = { nodeId: current, edgeId: edge.id };
          }
        }
      }
      if (!previous[destination]) return { nodes: [source], edges: [] };
      const nodes = [destination];
      const edges = [];
      let cursor = destination;
      while (cursor !== source) {
        const step = previous[cursor];
        if (!step) return { nodes: [source], edges: [] };
        edges.unshift(step.edgeId);
        nodes.unshift(step.nodeId);
        cursor = step.nodeId;
      }
      return { nodes, edges };
    }

    movementIntentFor(agent) {
      const demand = this.demandForAgent(agent.id);
      if (!demand || agent.stranded) return null;
      const path = this.findPath(agent, agent.position, demand.destination);
      if (!path.edges.length) return null;
      const edge = this.edgeById[path.edges[0]];
      return {
        agentId: agent.id,
        demandId: demand.id,
        from: agent.position,
        to: this.otherNode(edge, agent.position),
        edgeId: edge.id,
        carrying: demand.subject.kind === "payload" ? demand.subject.id : null,
        destination: demand.destination,
        remainingEdges: path.edges.length,
        pathEdgeIds: path.edges,
        pathNodeIds: path.nodes
      };
    }

    updateMovementIntents() {
      for (const agent of this.agents) agent.movementIntent = this.movementIntentFor(agent);
    }

    maturePathwayInvestments() {
      for (const agent of this.agents) {
        for (const [edgeId, amount] of Object.entries(agent.pendingMastery)) {
          const active = agent.mastery[edgeId] || 0;
          agent.mastery[edgeId] = round(clamp(active + amount, 0, 1));
          if (active <= 0) agent.masteryInvestedRound[edgeId] = this.round;
        }
        agent.pendingMastery = {};
      }
      for (const edge of this.mountain.edges) {
        let remainingCapacity = clamp(1 - edge.infrastructure, 0, 1);
        for (const [builderId, amount] of Object.entries(edge.pendingInfrastructure)) {
          const accepted = Math.min(amount, remainingCapacity);
          if (accepted <= 0) continue;
          const active = edge.infrastructureContributions[builderId] || 0;
          edge.infrastructureContributions[builderId] = round(active + accepted, 4);
          if (active <= 0) edge.infrastructureAvailableRoundByBuilder[builderId] = this.round;
          if (edge.infrastructureBuiltRound === null) {
            edge.infrastructureBuiltRound = this.round;
            edge.infrastructureBuilderId = builderId;
          }
          remainingCapacity -= accepted;
        }
        edge.infrastructure = round(Object.values(edge.infrastructureContributions).reduce((total, value) => total + value, 0));
        edge.pendingInfrastructure = {};
      }
    }

    getActionOptions(agentId = "player") {
      const agent = this.agentById[agentId];
      if (!agent || this.finished) return [];
      return ANIMAL_ORDER.map((animalName) => this.makeOption(agent, animalName));
    }

    makeOption(agent, animalName) {
      const animal = ANIMALS[animalName];
      const connected = this.connectedEdges(agent.position);
      const intentEdge = agent.movementIntent ? this.edgeById[agent.movementIntent.edgeId] : null;
      const known = connected.filter((edge) => agent.beliefs[edge.id]);
      const unknown = connected.filter((edge) => !agent.beliefs[edge.id]);
      let pool = animal.observer === "Oe" ? (unknown.length ? unknown : connected) : (known.length ? known : connected);
      if (intentEdge && pool.some((edge) => edge.id === intentEdge.id)) pool = [intentEdge, ...pool.filter((edge) => edge.id !== intentEdge.id)];
      const target = pool[0] || null;
      const partner = animal.decider === "De"
        ? this.agentsAt(agent.position).filter((candidate) => candidate.id !== agent.id).sort((left, right) => left.stress - right.stress)[0] || null
        : null;
      const cost = animalCost(agent, animalName);
      const pressureKey = animal.observer !== agent.profile.observer ? animal.observer : (animal.decider !== agent.profile.decider ? animal.decider : null);
      const demand = this.demandForAgent(agent.id);
      return {
        animal: animalName,
        observer: animal.observer,
        decider: animal.decider,
        label: animal.verb,
        short: animal.short,
        color: animal.color,
        targetEdgeId: target ? target.id : null,
        targetName: target ? target.name : "No relevant route",
        demandId: demand ? demand.id : null,
        demandName: demand ? demand.name : "No active traffic demand",
        expectedFutureUses: target ? this.expectedFutureUses(target.id, agent.id) : 0,
        partnerId: partner ? partner.id : null,
        partnerName: partner ? partner.name : null,
        subjectiveCost: cost,
        staminaCost: round(0.55 + cost * 0.14 + (animalName === "Blast" ? 0.25 : 0)),
        materialCost: animalName === "Blast" && target && agent.beliefs[target.id] ? 1 : 0,
        supplyCost: 0,
        pressureAddressed: pressureKey,
        enabled: Boolean(target),
        rationale: this.optionRationale(agent, animalName, target, partner, demand)
      };
    }

    expectedFutureUses(edgeId, excludingAgentId) {
      let uses = 0;
      for (const agent of this.agents) {
        const intent = agent.movementIntent;
        if (intent && intent.pathEdgeIds.includes(edgeId)) uses += agent.id === excludingAgentId ? 1 : 2;
      }
      return uses;
    }

    optionRationale(agent, animalName, edge, partner, demand) {
      if (!edge) return "No route is currently relevant.";
      const belief = agent.beliefs[edge.id];
      const futureUses = this.expectedFutureUses(edge.id, agent.id);
      const traffic = demand ? `Demand: ${demand.name}.` : "No active demand.";
      if (animalName === "Consume") return `${traffic} ${belief ? "Refresh private evidence before movement." : "Inspect an unknown possibility before movement."}`;
      if (animalName === "Sleep") return belief
        ? `${traffic} Consolidate personal capability; ${futureUses} expected future route-use units.`
        : `${traffic} You lack evidence to consolidate, so this investment may not pay.`;
      if (animalName === "Blast") return belief
        ? `${traffic} Establish a shared pathway for ${futureUses} expected future route-use units.`
        : `${traffic} Publishing without credible evidence risks weak infrastructure.`;
      return `${traffic} Reconcile evidence${partner ? ` with ${partner.name}` : " if a partner becomes available"} before movement.`;
    }

    scoreOption(agent, option) {
      if (!option.enabled) return -Infinity;
      const edge = this.edgeById[option.targetEdgeId];
      const belief = agent.beliefs[edge.id];
      const unknown = belief ? 0 : 1;
      const stale = belief ? clamp((this.round - belief.lastObserved) / 5, 0, 1) : 0;
      const futureUses = option.expectedFutureUses;
      const masteryGap = 1 - (agent.mastery[edge.id] || 0);
      const sharedGap = 1 - edge.infrastructure;
      let benefit = 0;
      if (option.animal === "Consume") benefit = (unknown + stale) * 3.2 * agent.goal.discovery;
      if (option.animal === "Sleep") benefit = (belief ? masteryGap * (1 + futureUses) : -1.8) * agent.goal.safety;
      if (option.animal === "Blast") benefit = (belief ? sharedGap * (1 + futureUses * this.scenario.interdependence) : -2) * agent.goal.group;
      if (option.animal === "Play") benefit = (unknown + stale + (option.partnerId ? 1 : 0.1)) * (1 + this.scenario.disagreement) * agent.goal.group;
      return round(benefit - option.staminaCost - option.materialCost * 0.35 * agent.goal.economy - option.subjectiveCost * (0.25 + agent.stress * 0.025));
    }

    chooseAutonomousAction(agent) {
      const options = this.getActionOptions(agent.id).map((option) => ({ ...option, score: this.scoreOption(agent, option) }));
      options.sort((left, right) => right.score - left.score || ANIMAL_ORDER.indexOf(left.animal) - ANIMAL_ORDER.indexOf(right.animal));
      return options[0];
    }

    step(playerAnimal) {
      if (this.finished) return this.snapshot();
      if (!ANIMALS[playerAnimal]) throw new Error(`Unavailable player action: ${playerAnimal}`);

      this.round += 1;
      this.maturePathwayInvestments();
      this.activateDemands();
      this.updateWeather();
      this.updateMovementIntents();
      const playerAction = this.getActionOptions("player").find((option) => option.animal === playerAnimal && option.enabled);
      if (!playerAction) throw new Error(`Unavailable player action: ${playerAnimal}`);
      const actions = [playerAction, ...this.agents.slice(1).map((agent) => this.chooseAutonomousAction(agent))];
      this.commitments = {};
      for (const action of actions) {
        if (action && action.decider === "De" && action.targetEdgeId) this.commitments[action.targetEdgeId] = (this.commitments[action.targetEdgeId] || 0) + 1;
      }

      const pressureBefore = Object.fromEntries(this.agents.map((agent) => [agent.id, clone(agent.pressure)]));
      const operationEvents = actions.map((action, index) => this.resolveOperation(this.agents[index], action));
      this.updateMovementIntents();
      const trafficEvents = this.agents.map((agent) => this.resolveTraffic(agent)).filter(Boolean);
      this.updateDemandProgress();
      this.updateMovementIntents();
      this.updatePressures();
      this.updateAdaptation(actions, pressureBefore);
      this.applyRoundRecovery();
      this.captureScheduledCheckpoints();
      this.checkFinish();

      this.timeline.push({
        round: this.round,
        weather: clone(this.weather),
        operations: actions.map((action, index) => ({
          agentId: this.agents[index].id,
          agentName: this.agents[index].name,
          animal: action.animal,
          targetEdgeId: action.targetEdgeId,
          targetName: action.targetName,
          demandId: action.demandId,
          subjectiveCost: action.subjectiveCost,
          reason: this.agents[index].lastReason
        })),
        actions: actions.map((action, index) => ({ agentId: this.agents[index].id, agentName: this.agents[index].name, animal: action.animal, targetEdgeId: action.targetEdgeId, targetName: action.targetName })),
        traffic: trafficEvents,
        events: [...operationEvents, ...trafficEvents.map((event) => event.description)]
      });
      if (this.finished) this.captureCheckpoint("final");
      return this.snapshot();
    }

    resolveOperation(agent, action) {
      if (!action || !action.enabled) {
        agent.stress = round(clamp(agent.stress + 0.5, 0, 10));
        return `${agent.name} had no relevant pathway operation.`;
      }
      const edge = this.edgeById[action.targetEdgeId];
      agent.moveCounts[action.animal] += 1;
      agent.stamina = round(clamp(agent.stamina - action.staminaCost, 0, 14));
      agent.stress = round(clamp(agent.stress + Math.max(0, action.subjectiveCost - 2.2) * 0.25, 0, 10));
      let effect = "prepared no durable pathway state";

      if (action.animal === "Consume") {
        this.observe(agent, edge, 0.88, true);
        effect = "updated private route evidence";
      } else if (action.animal === "Sleep") {
        if (agent.beliefs[edge.id]) {
          const activeAndPending = (agent.mastery[edge.id] || 0) + (agent.pendingMastery[edge.id] || 0);
          agent.pendingMastery[edge.id] = round(clamp(activeAndPending + 0.3, 0, 1) - clamp(activeAndPending, 0, 1));
          agent.beliefs[edge.id].confidence = round(clamp(agent.beliefs[edge.id].confidence + 0.08, 0, 1));
          effect = "queued personal route mastery for later traffic";
        } else {
          effect = "could not consolidate an unknown route";
        }
      } else if (action.animal === "Blast") {
        if (agent.beliefs[edge.id] && this.materials > 0) {
          const credibility = agent.beliefs[edge.id].confidence * 0.7 + (agent.mastery[edge.id] || 0) * 0.3;
          const amount = round(0.16 + credibility * 0.18);
          this.materials -= action.materialCost;
          this.supplies = this.materials;
          edge.pendingInfrastructure[agent.id] = round((edge.pendingInfrastructure[agent.id] || 0) + amount);
          agent.expressedGoal = true;
          this.agents.forEach((receiver) => this.shareBelief(agent, receiver, edge, 0.9));
          effect = "queued credible shared pathway capacity for later traffic";
        } else {
          effect = "lacked evidence or materials for shared infrastructure";
        }
      } else if (action.animal === "Play") {
        const partner = this.agentById[action.partnerId] || this.agentsAt(agent.position).find((candidate) => candidate.id !== agent.id);
        agent.expressedGoal = true;
        if (partner) {
          this.observe(agent, edge, 0.83, true);
          this.observe(partner, edge, 0.78, true);
          this.shareBelief(agent, partner, edge, 0.94);
          this.shareBelief(partner, agent, edge, 0.94);
          effect = `reconciled route evidence with ${partner.name}`;
        } else {
          effect = "could not create joint evidence without a reciprocal partner";
        }
      }

      agent.lastAction = clone(action);
      agent.lastReason = `${action.rationale} Operation ${effect}; traffic resolves separately.`;
      return `${agent.name} used ${action.animal} on ${edge.name} and ${effect}.`;
    }

    resolveTraffic(agent) {
      const intent = agent.movementIntent;
      if (!intent || agent.stranded) return null;
      const edge = this.edgeById[intent.edgeId];
      const demand = this.trafficDemands.find((candidate) => candidate.id === intent.demandId);
      if (!edge || !demand || demand.completed || agent.position !== intent.from) return null;
      const mastery = agent.mastery[edge.id] || 0;
      const infrastructure = edge.infrastructure;
      const belief = agent.beliefs[edge.id];
      let chance = 0.66 + mastery * 0.22 + infrastructure * 0.2 - edge.trueRisk * 0.38 - this.weather.severity * 0.08;
      if (!belief) chance -= 0.1;
      if (agent.stamina < 2) chance -= 0.12;
      chance = clamp(chance, 0.04, 0.97);
      if (edge.blocked) chance = 0;
      const success = this.rng.next() < chance;
      const staminaCost = round(clamp(0.45 + edge.trueCost * 0.12 - mastery * 0.18 - infrastructure * 0.12, 0.16, 1.2));
      agent.stamina = round(clamp(agent.stamina - staminaCost, 0, 14));
      const masteryUsed = success && mastery > 0 && agent.masteryInvestedRound[edge.id] <= this.round;
      const infrastructureBuilderIds = success && infrastructure > 0
        ? Object.keys(edge.infrastructureContributions).filter((builderId) => (
          edge.infrastructureContributions[builderId] > 0
          && edge.infrastructureAvailableRoundByBuilder[builderId] <= this.round
          && (builderId !== agent.id || demand.subject.kind === "payload")
        ))
        : [];
      const sharedUsed = infrastructureBuilderIds.length > 0;

      if (success) {
        const previousUses = edge.agentTraversals[agent.id] || 0;
        agent.position = intent.to;
        demand.currentNode = intent.to;
        edge.traversals += 1;
        edge.agentTraversals[agent.id] = previousUses + 1;
        if (previousUses > 0) {
          edge.repeatTraversals += 1;
        }
        if (masteryUsed) {
          agent.personalMasteryUses += 1;
          edge.personalMasteryUses += 1;
        }
        if (sharedUsed) {
          edge.sharedInfrastructureUses += 1;
          infrastructureBuilderIds.forEach((builderId) => {
            const builder = this.agentById[builderId];
            if (builder) builder.sharedInfrastructureUses += 1;
          });
        }
      } else {
        agent.stress = round(clamp(agent.stress + 0.4 + edge.trueRisk * 0.45, 0, 10));
        if (!belief) this.observe(agent, edge, 0.62, false);
      }
      return {
        agentId: agent.id,
        agentName: agent.name,
        demandId: demand.id,
        intent: clone(intent),
        from: intent.from,
        to: intent.to,
        edgeId: edge.id,
        carrying: intent.carrying,
        success,
        masteryUsed,
        sharedInfrastructureUsed: sharedUsed,
        infrastructureBuilderIds,
        staminaCost,
        description: success
          ? `${agent.name} moved ${intent.from} -> ${intent.to} for ${demand.name}${intent.carrying ? ` carrying ${intent.carrying}` : ""}.`
          : `${agent.name} could not move ${intent.from} -> ${intent.to} for ${demand.name}.`
      };
    }

    updateDemandProgress() {
      for (const demand of this.trafficDemands) {
        if (demand.completed || demand.status !== "active") continue;
        const agent = this.agentById[demand.assignedAgentId];
        if (!agent || agent.position !== demand.destination) continue;
        demand.legsCompleted += 1;
        if (demand.stopIndex < demand.stops.length - 1) {
          demand.source = demand.destination;
          demand.stopIndex += 1;
          demand.destination = demand.stops[demand.stopIndex];
          demand.currentNode = agent.position;
        } else {
          demand.completed = true;
          demand.completedRound = this.round;
          demand.status = "completed";
          this.objectiveValue += demand.value;
          agent.completedDemandIds.push(demand.id);
          if (demand.subject.kind === "payload") {
            this.deliveredPayload += 1;
            this.deliveredSupplies = this.deliveredPayload;
          }
        }
      }
    }

    updateWeather() {
      const severity = clamp(0.06 + this.scenario.volatility * (0.2 + this.rng.next() * 0.55) + this.round / this.roundLimit * 0.14, 0, 1);
      const labels = severity < 0.32 ? ["clear", "light wind", "high cloud"] : severity < 0.68 ? ["crosswind", "freezing rain", "moving fog"] : ["rockfall", "ice fracture", "whiteout"];
      const changedEdges = [];
      const changes = severity > 0.58 ? 2 : 1;
      for (let index = 0; index < changes; index += 1) {
        const edge = this.rng.pick(this.mountain.edges);
        if (this.rng.next() < edge.volatility * this.scenario.volatility) {
          edge.trueRisk = round(clamp(edge.trueRisk + (this.rng.next() * 2 - 0.75) * 0.2, 0.04, 0.96));
          if (!this.scenario.falseConsensus || edge.id !== this.mountain.falseConsensusEdgeId) edge.blocked = edge.trueRisk > 0.92 && this.rng.next() < 0.25;
          if (edge.infrastructure > 0 && severity > 0.65) {
            const before = edge.infrastructure;
            const after = round(clamp(before - severity * 0.08, 0, 1));
            const factor = before > 0 ? after / before : 0;
            for (const builderId of Object.keys(edge.infrastructureContributions)) {
              edge.infrastructureContributions[builderId] = round(edge.infrastructureContributions[builderId] * factor, 4);
            }
            edge.infrastructure = round(Object.values(edge.infrastructureContributions).reduce((total, value) => total + value, 0));
          }
          changedEdges.push(edge.id);
        }
      }
      this.weather = { label: this.rng.pick(labels), severity: round(severity), changedEdges };
    }

    updatePressures() {
      for (const agent of this.agents) {
        const connected = this.connectedEdges(agent.position);
        if (!connected.length) continue;
        const unknown = connected.filter((edge) => !agent.beliefs[edge.id]).length;
        const stale = connected.filter((edge) => agent.beliefs[edge.id] && this.round - agent.beliefs[edge.id].lastObserved >= 5).length;
        const fragile = connected.filter((edge) => agent.beliefs[edge.id] && (agent.mastery[edge.id] || 0) + edge.infrastructure < 0.45).length;
        const demand = this.demandForAgent(agent.id);
        const sharedNeed = demand && demand.subject.kind === "payload" ? 1 : 0;
        const next = {
          Oe: clamp((unknown + stale * 0.7) / connected.length * 7, 0, 10),
          Oi: clamp(fragile / connected.length * 7, 0, 10),
          De: clamp(sharedNeed * this.scenario.interdependence * 3 + (!agent.expressedGoal ? 1 : 0), 0, 10),
          Di: clamp(agent.lastAction && agent.lastAction.decider === "De" && this.scenario.disagreement > 0.7 ? 3.5 : 0, 0, 10)
        };
        for (const pole of ["Oi", "Oe", "Di", "De"]) agent.pressure[pole] = round(agent.pressure[pole] * 0.42 + next[pole] * 0.58);
        const demonObserver = agent.profile.observer === "Oi" ? "Oe" : "Oi";
        const demonDecider = agent.profile.decider === "Di" ? "De" : "Di";
        const polarDemon = agent.profile.polarity === "Observer" ? demonObserver : demonDecider;
        agent.stress = round(clamp(agent.stress + agent.pressure[polarDemon] * 0.04, 0, 10));
      }
    }

    updateAdaptation(actions, beforePressure) {
      actions.forEach((action, index) => {
        const agent = this.agents[index];
        if (!action) return;
        for (const pole of [action.observer, action.decider]) {
          const isDemon = saviorForAxis(agent.profile, axisForPole(pole)) !== pole;
          const pressureDropped = agent.pressure[pole] + 0.15 < beforePressure[agent.id][pole];
          if (isDemon && pressureDropped && agent.stress < 8.5) agent.adaptation[pole] = round(clamp(agent.adaptation[pole] + 0.07, 0, 0.6));
        }
      });
    }

    applyRoundRecovery() {
      for (const agent of this.agents) {
        agent.stamina = round(clamp(agent.stamina + 0.38, 0, 14));
        if (agent.lastAction && animalCost(agent, agent.lastAction.animal) <= 2.5) agent.stress = round(clamp(agent.stress - 0.22, 0, 10));
        if (agent.stamina <= 0.25 && agent.stress > 9.1) agent.stranded = true;
      }
    }

    checkpointMetrics() {
      const player = this.agentById.player;
      const completedAgents = new Set(this.trafficDemands.filter((demand) => demand.completed).map((demand) => demand.assignedAgentId));
      const reliabilityValues = this.mountain.edges.map((edge) => (player.mastery[edge.id] || 0) + edge.infrastructure);
      return {
        round: this.round,
        frontierEvidence: Object.keys(player.beliefs).length,
        progress: round(this.objectiveValue + this.agents.reduce((total, agent) => total + this.nodeById[agent.position].level / 8, 0)),
        routeReliability: round(reliabilityValues.reduce((total, value) => total + value, 0) / reliabilityValues.length),
        repeatTraversals: this.mountain.edges.reduce((total, edge) => total + edge.repeatTraversals, 0),
        members: completedAgents.size,
        payloadThroughput: this.deliveredPayload,
        stress: round(player.stress),
        stamina: round(player.stamina),
        stranding: this.agents.filter((agent) => agent.stranded).length
      };
    }

    captureCheckpoint(label) {
      if (!this.checkpoints[label]) this.checkpoints[label] = this.checkpointMetrics();
    }

    captureScheduledCheckpoints() {
      if (this.round >= Math.ceil(this.roundLimit / 3)) this.captureCheckpoint("early");
      if (this.round >= Math.ceil(this.roundLimit * 2 / 3)) this.captureCheckpoint("middle");
    }

    checkFinish() {
      const completed = this.trafficDemands.filter((demand) => demand.completed).length;
      const middleReached = this.round >= Math.ceil(this.roundLimit * 2 / 3);
      if (middleReached && completed >= 3 && this.deliveredPayload >= 2) {
        this.finished = true;
        this.success = true;
        this.finishReason = `${completed} logistics demands completed with ${this.deliveredPayload} payloads delivered.`;
      } else if (this.round >= this.roundLimit) {
        this.finished = true;
        this.success = false;
        this.finishReason = `The ${this.scenario.stormLabel} with ${completed} demands and ${this.deliveredPayload} payloads completed.`;
      }
    }

    summary() {
      const player = this.agentById.player;
      const completed = this.trafficDemands.filter((demand) => demand.completed).length;
      const arrived = this.agents.filter((agent) => agent.position === "summit").length;
      const explored = this.mountain.edges.filter((edge) => this.agents.some((agent) => agent.beliefs[edge.id])).length;
      const shared = this.mountain.edges.filter((edge) => edge.infrastructure > 0).length;
      const reliable = this.mountain.edges.filter((edge) => edge.infrastructure >= 0.55).length;
      const repeatTraversals = this.mountain.edges.reduce((total, edge) => total + edge.repeatTraversals, 0);
      const sharedInfrastructureUses = this.mountain.edges.reduce((total, edge) => total + edge.sharedInfrastructureUses, 0);
      const checkpoints = clone(this.checkpoints);
      for (const label of HORIZON_LABELS) if (!checkpoints[label]) checkpoints[label] = this.checkpointMetrics();
      return {
        success: this.success,
        reason: this.finishReason,
        rounds: this.round,
        arrived,
        stranded: this.agents.filter((agent) => agent.stranded).length,
        deliveredSupplies: this.deliveredPayload,
        deliveredPayload: this.deliveredPayload,
        payloadThroughput: this.deliveredPayload,
        remainingSupplies: this.materials,
        remainingMaterials: this.materials,
        exploredEdges: explored,
        sharedEdges: shared,
        reliableEdges: reliable,
        repeatTraversals,
        personalMasteryUses: player.personalMasteryUses,
        sharedInfrastructureUses,
        playerSharedInfrastructureUses: player.sharedInfrastructureUses,
        completedDemands: completed,
        totalDemands: this.trafficDemands.length,
        objectiveValue: this.objectiveValue,
        checkpoints,
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
        materials: this.materials,
        supplies: this.materials,
        deliveredPayload: this.deliveredPayload,
        deliveredSupplies: this.deliveredPayload,
        objectiveValue: this.objectiveValue,
        weather: clone(this.weather),
        commitments: clone(this.commitments),
        mountain: clone(this.mountain),
        trafficDemands: clone(this.trafficDemands),
        agents: clone(this.agents),
        checkpoints: clone(this.checkpoints),
        timeline: clone(this.timeline),
        finished: this.finished,
        success: this.success,
        finishReason: this.finishReason,
        summary: this.finished ? this.summary() : null
      };
    }
  }

  function selectPolicyAnimal(game, policy) {
    if (typeof policy === "function") return policy(game);
    if (ANIMAL_ORDER.includes(policy)) return policy;
    const player = game.agentById.player;
    const action = game.chooseAutonomousAction(player);
    return action ? action.animal : ANIMAL_ORDER[0];
  }

  function autoplay(options = {}) {
    const game = options.game || new Game(options);
    const policy = options.playerPolicy || "Adaptive";
    while (!game.finished) game.step(selectPolicyAnimal(game, policy));
    return game.summary();
  }

  return {
    ANIMALS,
    ANIMAL_ORDER,
    SCENARIOS,
    GOALS,
    PROFILE_PRESETS,
    DEFAULT_ROUNDS,
    HORIZON_LABELS,
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
