/**
 * BCM Spectrum Simulator - Core Module
 * Extracted for testability. This module contains the pure simulation logic
 * without p5.js rendering dependencies.
 */

// ========================
// Configuration
// ========================

const DEFAULT_CFG = {
  arenaSize: 1000,
  initialAgents: 50,
  targetVoids: 25,
  maxPop: 200,

  visionRadius: 120,
  interactRadius: 40,
  blastRadius: 120,

  matchEps: 2,
  orthoBonus: true,

  voidHp: 40,
  voidLifespanMin: 5,
  voidLifespanMax: 15,
  voidRespawnProb: 0.50,

  urgencyK: 250,
  urgencyBias: 0.50,
  urgencyClampMax: 800,

  dailyEnergy: 80,
  energyMax: 160,
  carryoverEnergy: true,
  startEnergy: 100,
  rewardPerHit: 0.5,
  rewardOnSolve: 10,

  maxAgeDays: 100,
  minParentAgeDays: 25,

  keyTTLMax: 12,
  pReplicateInternal: 0.05,
  pReplicateShare: 0.20,

  boredomLimit: 300,

  baseDeath: 0.01,
  kDeath: 0.20,

  ticksPerFrame: 6,
  maxTicksPerDay: 5000,

  maxMem: 60,

  telemetryBins: 36,
  telemetryMaxEvents: 2500,

  enableModes: true,
  pVaultAtBirth: 0.28,
  pModeFlipOnBirth: 0.06,

  vaultMemSplit: 0.78,
  routerMemSplit: 0.35,

  vaultKeyTTLBoost: 1.35,
  routerShareBoost: 1.15,
  vaultGenBoost: 1.10,

  shareNoveltyGate: true,
  shareSatExponent: 2.2,
  shareGateMin: 0.22,
  shareForceUrgency: 120,

  routerAvoidGenSolve: true,
  routerGenSolveUrgencyMin: 70,
  routerGenSolvePenalty: 40,

  solveDamageBase: 1,
  solveDamagePer3Neighbors: 1,
  solveDamageMax: 4,

  vaultDiversityRetentionBoost: 8.0
};

// ========================
// Utility Functions
// ========================

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function wrap(v, max) { v = v % max; if (v < 0) v += max; return v; }
function dist2(ax, ay, bx, by) { const dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; }

function circDist(a, b, mod = 360) {
  let d = Math.abs(a - b) % mod;
  return Math.min(d, mod - d);
}

function matches(a, b, eps) { return circDist(a, b) <= eps; }

function circSignedDiff(a, b, mod = 360) {
  let d = ((a - b) % mod + mod) % mod;
  if (d > mod / 2) d -= mod;
  return d;
}

function rollDice(n, d) {
  let s = 0;
  for (let i = 0; i < n; i++) s += 1 + Math.floor(Math.random() * d);
  return s;
}

function symmetricNoise(n = 6, d = 5) {
  return rollDice(n, d) - rollDice(n, d);
}

function randInt(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }

function sampleVoidVal() {
  const diceDivide = (maxVal, divisions) => {
    if (divisions <= 0) return 0;
    const step = maxVal / divisions;
    const k = Math.floor(Math.random() * divisions);
    return Math.floor(k * step);
  };
  const noise = (rollDice(4, 5) - rollDice(1, 5));
  const val = (
    diceDivide(360, 2) +
    diceDivide(180, 2) +
    diceDivide(90, 2) +
    diceDivide(45, 3) +
    diceDivide(15, 3) +
    noise
  );
  return wrap(val, 360);
}

function sampleAgentValue() {
  const step = 360 / 8;
  const k = Math.floor(Math.random() * 8);
  return Math.floor(k * step);
}

function mean(arr) {
  if (!arr.length) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

// ========================
// Classes
// ========================

class VoidObj {
  constructor(cfg, idCounter) {
    this.id = idCounter;
    this.x = Math.random() * cfg.arenaSize;
    this.y = Math.random() * cfg.arenaSize;
    this.val = sampleVoidVal();
    this.hpMax = cfg.voidHp;
    this.hp = cfg.voidHp;
    this.lifespanMax = randInt(cfg.voidLifespanMin, cfg.voidLifespanMax);
    this.lifespan = this.lifespanMax;
    this.ageDays = 0;
    this.state = "active";
    this.rewardHit = cfg.rewardPerHit;
    this.rewardSolve = cfg.rewardOnSolve;
    this._cfg = cfg;
  }

  urgency() {
    const u = this._cfg.urgencyK / (this.lifespan + this._cfg.urgencyBias);
    return clamp(u, 0, this._cfg.urgencyClampMax);
  }
}

class KeyObj {
  constructor(val, creatorId, cfg) {
    this.val = wrap(Math.round(val), 360);
    this.creatorId = creatorId;
    this.ttlMax = cfg.keyTTLMax;
    this.ttl = this.ttlMax;
    this.uses = 0;
  }
}

class Agent {
  constructor(cfg, world, idCounter, x = null, y = null, parent = null) {
    this.id = idCounter;
    this._cfg = cfg;
    this._world = world;

    this.x = (x === null) ? Math.random() * cfg.arenaSize : x;
    this.y = (y === null) ? Math.random() * cfg.arenaSize : y;
    this.vx = (Math.random() * 2 - 1);
    this.vy = (Math.random() * 2 - 1);

    this.alive = true;
    this.sleeping = false;
    this.ageDays = 0;

    this.energyMax = cfg.energyMax;
    this.energy = cfg.startEnergy;
    this.boredom = 0;

    this.totalMem = cfg.maxMem;
    this.keys = [];
    this.voidMem = [];
    this.consecutiveFailedScouts = 0;

    if (cfg.enableModes) {
      if (parent) {
        const flip = Math.random() < cfg.pModeFlipOnBirth;
        this.mode = flip ? (parent.mode === "vault" ? "router" : "vault") : parent.mode;
      } else {
        this.mode = (Math.random() < cfg.pVaultAtBirth) ? "vault" : "router";
      }
    } else {
      this.mode = "router";
    }

    if (parent) {
      this.agentValue = wrap(parent.agentValue + randInt(-5, 5), 360);
      this.costs = parent.costs.map(c => Math.max(0.1, c + (Math.random() * 0.2 - 0.1)));
      this.memSplit = clamp(parent.memSplit + (Math.random() * 0.10 - 0.05), 0.1, 0.9);
      this.weights = {};
      for (const k of Object.keys(parent.weights)) {
        this.weights[k] = parent.weights[k] + (Math.random() * 0.4 - 0.2);
      }
    } else {
      this.agentValue = sampleAgentValue();
      this.costs = [Math.random(), Math.random(), Math.random(), Math.random()];
      this.memSplit = 0.5;
      this.weights = {
        wUrgency: 1.0,
        wCost: -2.0,
        wSatShare: -50.0,
        wSatSolve: 20.0,
        wHaveKey: 150.0,
        wScanFail: -5.0
      };
    }

    if (cfg.enableModes) {
      this.memSplit = (this.mode === "vault") ? cfg.vaultMemSplit : cfg.routerMemSplit;
    }

    let s = this.costs.reduce((a, b) => a + b, 0);
    this.costs = this.costs.map(x => x * (8.0 / s));
    this.costScan = this.costs[0];
    this.costGen = this.costs[1];
    this.costShare = this.costs[2];
    this.costSolve = this.costs[3];

    this.recomputeCaps();

    for (let i = 0; i < 5; i++) this.stockpileGenerate(true);

    if (cfg.enableModes && this.mode === "vault") {
      for (const k of this.keys) {
        k.ttlMax = Math.round(cfg.keyTTLMax * cfg.vaultKeyTTLBoost);
        k.ttl = k.ttlMax;
      }
    }
  }

  recomputeCaps() {
    this.maxKeys = Math.floor(this.totalMem * this.memSplit);
    this.maxVoidMem = this.totalMem - this.maxKeys;
    if (this.maxKeys < 1) this.maxKeys = 1;
    if (this.maxVoidMem < 1) this.maxVoidMem = 1;
  }

  memorizeVoid(v, day) {
    const urg = v.urgency();

    for (const m of this.voidMem) {
      if (m.voidId === v.id) {
        m.x = v.x; m.y = v.y;
        m.val = v.val;
        m.urgency = urg;
        m.lastSeenDay = day;
        return true;
      }
    }

    const entry = { voidId: v.id, x: v.x, y: v.y, val: v.val, urgency: urg, lastSeenDay: day };

    if (this.voidMem.length < this.maxVoidMem) {
      this.voidMem.push(entry);
      return true;
    }

    this.voidMem.sort((a, b) => a.urgency - b.urgency);
    if (urg > this.voidMem[0].urgency) {
      this.voidMem.shift();
      this.voidMem.push(entry);
      return true;
    }
    return false;
  }

  addKey(key, stats = null) {
    const cfg = this._cfg;
    const world = this._world;

    if (cfg.enableModes && this.mode === "vault") {
      key.ttlMax = Math.round(cfg.keyTTLMax * cfg.vaultKeyTTLBoost);
      key.ttl = key.ttlMax;
    } else {
      key.ttlMax = cfg.keyTTLMax;
      key.ttl = Math.min(key.ttl, key.ttlMax);
    }

    if (this.keys.length < this.maxKeys) {
      this.keys.push(key);
      if (stats) stats.keys.added++;
      return;
    }

    let bestIdx = -1;
    let lowestRetention = Infinity;

    for (let i = 0; i < this.keys.length; i++) {
      const k = this.keys[i];
      let retention = 0;
      let matchesKnown = false;

      for (const vm of this.voidMem) {
        const v = world.voidMap.get(vm.voidId);
        if (!v || v.state !== "active") continue;
        const urg = v.urgency();

        if (matches(k.val, v.val, cfg.matchEps)) {
          retention += urg + 1000;
          matchesKnown = true;
        } else if (cfg.orthoBonus && k.creatorId === this.id) {
          const v1 = wrap(k.val + 90, 360);
          const v2 = wrap(k.val - 90, 360);
          if (matches(v1, v.val, cfg.matchEps) || matches(v2, v.val, cfg.matchEps)) {
            retention += (urg / 2) + 500;
            matchesKnown = true;
          }
        }
      }

      if (!matchesKnown) retention = Math.random() * 10;

      if (cfg.enableModes && this.mode === "vault") {
        const absDiff = Math.abs(circSignedDiff(k.val, this.agentValue));
        const diversity = (absDiff / 180) * cfg.vaultDiversityRetentionBoost;
        retention += diversity;
      }

      if (retention < lowestRetention) {
        lowestRetention = retention;
        bestIdx = i;
      }
    }

    this.keys.splice(bestIdx, 1);
    this.keys.push(key);

    if (stats) {
      stats.keys.added++;
      stats.keys.evicted++;
    }
  }

  refreshKey(index) {
    if (index < 0 || index >= this.keys.length) return;
    const k = this.keys.splice(index, 1)[0];
    this.keys.push(k);
  }

  decayKeys(stats = null) {
    for (const k of this.keys) k.ttl -= 1;
    const before = this.keys.length;
    this.keys = this.keys.filter(k => k.ttl > 0);
    const pruned = before - this.keys.length;
    if (stats) stats.keys.pruned += pruned;
    return pruned;
  }

  stockpileGenerate(free = false, stats = null) {
    const cfg = this._cfg;
    let val;

    if (cfg.enableModes && this.mode === "vault") {
      // Vaults actively seek DIVERSITY - generate keys across the spectrum
      // 40% chance: generate in a random spectrum region (exploring)
      // 30% chance: generate opposite to current keys (filling gaps)
      // 30% chance: generate near agentValue (baseline)
      const r = Math.random();
      if (r < 0.40) {
        // Random exploration across spectrum
        val = Math.floor(Math.random() * 360);
      } else if (r < 0.70 && this.keys.length > 0) {
        // Generate in underrepresented region (gap-filling)
        // Find the largest gap in current key coverage
        const vals = this.keys.map(k => k.val).sort((a, b) => a - b);
        let maxGap = 0;
        let gapStart = 0;
        for (let i = 0; i < vals.length; i++) {
          const next = (i + 1) % vals.length;
          const gap = next === 0 ? (360 - vals[i] + vals[0]) : (vals[next] - vals[i]);
          if (gap > maxGap) {
            maxGap = gap;
            gapStart = vals[i];
          }
        }
        // Generate in the middle of the largest gap
        val = wrap(gapStart + Math.floor(maxGap / 2) + symmetricNoise(3, 5), 360);
      } else {
        // Baseline: near agentValue with moderate noise
        val = wrap(this.agentValue + symmetricNoise(8, 6), 360);
      }
    } else {
      // Routers stay CLUSTERED around their agentValue (specialization)
      // Tighter noise distribution
      val = wrap(this.agentValue + symmetricNoise(4, 4), 360);
    }

    this.addKey(new KeyObj(val, this.id, cfg), stats);

    if (!free) {
      this.energy -= this.costGen;
      this.boredom = 0;
    }
  }

  attemptTargetedGenerate(targetVal, urgency) {
    const attempt = this.annealAttempt(targetVal, urgency);
    const ok = matches(attempt, targetVal, this._cfg.matchEps);
    return { ok, val: ok ? targetVal : attempt };
  }

  annealAttempt(targetVal, urgency) {
    const cfg = this._cfg;
    const fail = this.consecutiveFailedScouts;

    let p = clamp(
      0.35 * (urgency / 60) + 0.08 * (fail / 10),
      0, 1
    );

    if (cfg.enableModes && this.mode === "vault") p = clamp(p * cfg.vaultGenBoost, 0, 1);

    let base = this.agentValue;
    if (this.keys.length > 0 && p > 0.45 && Math.random() < p) {
      base = this.keys[Math.floor(Math.random() * this.keys.length)].val;
    }

    const k = Math.floor(clamp(p * 3.5, 0, 3));
    const noise = symmetricNoise(6 + 4 * k, 5);

    let attempt = wrap(base + noise, 360);
    if (cfg.orthoBonus && p > 0.65 && Math.random() < (p - 0.55)) {
      attempt = wrap(attempt + (Math.random() < 0.5 ? 90 : -90), 360);
    }
    return attempt;
  }

  move(stats = null) {
    const cfg = this._cfg;
    const world = this._world;

    if (this.sleeping || !this.alive) return;

    this.boredom += 1;
    if (this.boredom > cfg.boredomLimit) {
      this.sleeping = true;
      if (stats) {
        stats.actions.sleep++;
        stats.actionsByMode[this.mode].sleep++;
      }
      return;
    }

    this.voidMem = this.voidMem.filter(m => {
      const v = world.voidMap.get(m.voidId);
      return v && v.state === "active";
    });

    let target = null;
    let bestPriority = -Infinity;

    for (const m of this.voidMem) {
      const v = world.voidMap.get(m.voidId);
      if (!v || v.state !== "active") continue;

      m.urgency = v.urgency();

      let hasKeyBonus = 1.0;
      for (const k of this.keys) {
        if (matches(k.val, v.val, cfg.matchEps)) { hasKeyBonus = 2.0; break; }
      }

      const d = Math.sqrt(dist2(this.x, this.y, v.x, v.y));
      const priority = (m.urgency * hasKeyBonus) + (500 / (d + 5));
      if (priority > bestPriority) {
        bestPriority = priority;
        target = v;
      }
    }

    let ax = 0, ay = 0;
    if (target) {
      const ang = Math.atan2(target.y - this.y, target.x - this.x);
      ax = Math.cos(ang) * 0.9;
      ay = Math.sin(ang) * 0.9;
    } else {
      ax = (Math.random() * 0.6 - 0.3);
      ay = (Math.random() * 0.6 - 0.3);
    }

    this.vx = (this.vx + ax) * 0.90;
    this.vy = (this.vy + ay) * 0.90;

    this.x = wrap(this.x + this.vx, cfg.arenaSize);
    this.y = wrap(this.y + this.vy, cfg.arenaSize);
  }

  interact(stats = null) {
    const cfg = this._cfg;
    const world = this._world;

    if (this.sleeping || !this.alive) return;

    const neighbors = [];
    for (const other of world.agents) {
      if (other.id === this.id || !other.alive || other.sleeping) continue;
      if (dist2(this.x, this.y, other.x, other.y) <= cfg.interactRadius * cfg.interactRadius) neighbors.push(other);
    }

    for (const m of this.voidMem) {
      const v = world.voidMap.get(m.voidId);
      if (v && v.state === "active") m.urgency = v.urgency();
    }

    const candidates = [];

    for (const m of this.voidMem) {
      const v = world.voidMap.get(m.voidId);
      if (!v || v.state !== "active") continue;

      let knownCount = 0;
      for (const n of neighbors) {
        if (n.voidMem.some(vm => vm.voidId === v.id)) knownCount++;
      }
      const saturation = neighbors.length ? (knownCount / neighbors.length) : 0;

      let keyIdx = -1;
      let isOrtho = false;
      for (let i = 0; i < this.keys.length; i++) {
        const k = this.keys[i];
        if (matches(k.val, v.val, cfg.matchEps)) { keyIdx = i; break; }
        if (cfg.orthoBonus && k.creatorId === this.id) {
          const v1 = wrap(k.val + 90, 360);
          const v2 = wrap(k.val - 90, 360);
          if (matches(v1, v.val, cfg.matchEps) || matches(v2, v.val, cfg.matchEps)) {
            keyIdx = i; isOrtho = true; break;
          }
        }
      }
      const hasKey = keyIdx !== -1;

      if (neighbors.length) {
        const shareBoost = (cfg.enableModes && this.mode === "router") ? cfg.routerShareBoost : 1.0;

        let shareUtil =
          (m.urgency * this.weights.wUrgency) +
          (saturation * this.weights.wSatShare) +
          (hasKey ? (this.weights.wHaveKey / 2) : 0) +
          (this.costShare * this.weights.wCost);

        shareUtil *= shareBoost;

        let allowShare = true;

        if (cfg.shareNoveltyGate) {
          const novelty = 1.0 - saturation;
          const gate = Math.pow(novelty, cfg.shareSatExponent);

          const force = (m.urgency >= cfg.shareForceUrgency) || hasKey;

          if (!force && gate < cfg.shareGateMin) {
            allowShare = false;
            if (stats) stats.behavior.shareSuppressedByGate++;
          } else {
            shareUtil *= clamp(0.35 + 0.65 * gate, 0.1, 1.0);
          }
        }

        if (allowShare) {
          candidates.push({
            type: "share",
            utility: shareUtil,
            cost: this.costShare,
            target: neighbors,
            payload: { voidObj: v, keyObj: hasKey ? this.keys[keyIdx] : null, saturation }
          });
        }
      }

      const d = Math.sqrt(dist2(this.x, this.y, v.x, v.y));
      if (d < cfg.interactRadius) {
        if (hasKey) {
          const extra = isOrtho ? 50 : 0;
          const cost = this.costSolve + extra;

          let workUtil =
            (m.urgency * this.weights.wUrgency) +
            (saturation * this.weights.wSatSolve) +
            this.weights.wHaveKey +
            (cost * this.weights.wCost);

          candidates.push({
            type: "solve",
            utility: workUtil,
            cost: cost,
            target: v,
            payload: { keyIdx, saturation, neighborCount: neighbors.length }
          });
        } else {
          if (cfg.enableModes && this.mode === "router" && cfg.routerAvoidGenSolve) {
            if (m.urgency < cfg.routerGenSolveUrgencyMin) {
              if (stats) stats.behavior.routerGenSolveSkipped++;
            } else {
              const cost = this.costGen + this.costSolve;
              let util =
                (m.urgency * this.weights.wUrgency) +
                (saturation * this.weights.wSatSolve) +
                (cost * this.weights.wCost);

              util -= cfg.routerGenSolvePenalty;

              candidates.push({
                type: "gen_solve",
                utility: util,
                cost: cost,
                target: v,
                payload: { saturation }
              });
            }
          } else {
            const cost = this.costGen + this.costSolve;
            let util =
              (m.urgency * this.weights.wUrgency) +
              (saturation * this.weights.wSatSolve) +
              (cost * this.weights.wCost);

            candidates.push({
              type: "gen_solve",
              utility: util,
              cost: cost,
              target: v,
              payload: { saturation }
            });
          }
        }
      }
    }

    const visible = world.voids.filter(v => v.state === "active" && dist2(this.x, this.y, v.x, v.y) <= cfg.visionRadius * cfg.visionRadius);
    const unknown = visible.find(v => !this.voidMem.some(m => m.voidId === v.id));
    if (unknown) {
      const scanBase = 20 + (this.consecutiveFailedScouts * this.weights.wScanFail);
      const scanUtil = scanBase + (this.costScan * this.weights.wCost);
      candidates.push({ type: "scan", utility: scanUtil, cost: this.costScan, target: unknown, payload: {} });
    }

    if (this.keys.length < this.maxKeys) {
      const stockUtil = 5 + (this.costGen * this.weights.wCost);
      candidates.push({ type: "stockpile", utility: stockUtil, cost: this.costGen, target: null, payload: {} });
    }

    candidates.sort((a, b) => b.utility - a.utility);
    const best = candidates[0];

    if (!best || best.utility <= 0) {
      if (this.energy < 10 && !this.sleeping) {
        this.sleeping = true;
        if (stats) {
          stats.actions.sleep++;
          stats.actionsByMode[this.mode].sleep++;
        }
      }
      return;
    }
    if (this.energy < best.cost) {
      if (this.energy < 10 && !this.sleeping) {
        this.sleeping = true;
        if (stats) {
          stats.actions.sleep++;
          stats.actionsByMode[this.mode].sleep++;
        }
      }
      return;
    }

    if (stats && stats.actions[best.type] !== undefined) {
      stats.actions[best.type]++;
      stats.actionsByMode[this.mode][best.type]++;
    }

    this.energy -= best.cost;
    this.boredom = 0;

    switch (best.type) {
      case "share":
        this.doShare(best.target, best.payload.voidObj, best.payload.keyObj, stats);
        break;
      case "solve":
        this.doSolve(best.target, best.payload.keyIdx, best.payload.neighborCount, stats);
        break;
      case "gen_solve":
        this.doGenSolve(best.target, stats);
        break;
      case "scan":
        this.doScan(best.target);
        break;
      case "stockpile":
        this.stockpileGenerate(false, stats);
        break;
    }
  }

  doScan(v) {
    this.memorizeVoid(v, this._world.day);
    this.consecutiveFailedScouts = 0;
  }

  doShare(neighbors, v, keyObj, stats = null) {
    const cfg = this._cfg;

    if (stats) {
      stats.share.total++;
      stats.share.neighborsSum += neighbors.length;
      if (keyObj) stats.share.withKey++;
    }

    for (const n of neighbors) {
      n.memorizeVoid(v, this._world.day);
      if (keyObj && Math.random() < cfg.pReplicateShare) {
        const k2 = new KeyObj(keyObj.val, keyObj.creatorId, cfg);
        n.addKey(k2, stats);
        if (stats) stats.keys.replicatedShare++;
      }
    }
  }

  doSolve(v, keyIdx, neighborCount, stats = null) {
    const cfg = this._cfg;

    if (v.state !== "active") return;

    const awakeNeighbors = Math.max(0, neighborCount);
    const dmg = clamp(
      cfg.solveDamageBase + Math.floor(awakeNeighbors / 3) * cfg.solveDamagePer3Neighbors,
      1,
      cfg.solveDamageMax
    );

    v.hp -= dmg;
    if (stats) stats.voids.hits += dmg;

    this.energy = clamp(this.energy + v.rewardHit * dmg, 0, this.energyMax);

    const key = this.keys[keyIdx];
    if (key) {
      key.ttl = key.ttlMax;
      key.uses += 1;
      this.refreshKey(keyIdx);
      if (stats) stats.keys.used++;

      if (Math.random() < cfg.pReplicateInternal) {
        this.addKey(new KeyObj(key.val, key.creatorId, cfg), stats);
        if (stats) stats.keys.replicatedInternal++;
      }
    }

    if (v.hp <= 0) {
      v.state = "solved";
      this.energy = clamp(this.energy + v.rewardSolve, 0, this.energyMax);
      if (stats) stats.voids.solved++;
    }
  }

  doGenSolve(v, stats = null) {
    const cfg = this._cfg;

    if (v.state !== "active") return;

    if (stats) stats.genSolve.attempts++;

    const urg = v.urgency();
    const attempt = this.attemptTargetedGenerate(v.val, urg);
    if (attempt.ok) {
      if (stats) stats.genSolve.successes++;

      v.hp -= 1;
      if (stats) stats.voids.hits++;

      this.addKey(new KeyObj(attempt.val, this.id, cfg), stats);
      this.energy = clamp(this.energy + v.rewardHit, 0, this.energyMax);

      if (v.hp <= 0) {
        v.state = "solved";
        this.energy = clamp(this.energy + v.rewardSolve, 0, this.energyMax);
        if (stats) stats.voids.solved++;
      }
    } else {
      this.consecutiveFailedScouts = Math.min(30, this.consecutiveFailedScouts + 2);
    }
  }

  startNewDay(stats = null) {
    const cfg = this._cfg;

    this.sleeping = false;
    this.boredom = 0;
    this.ageDays += 1;
    this.consecutiveFailedScouts = Math.max(0, this.consecutiveFailedScouts - 1);

    if (cfg.carryoverEnergy) {
      this.energy = clamp(this.energy + cfg.dailyEnergy, 0, this.energyMax);
    } else {
      this.energy = cfg.dailyEnergy;
    }

    if (this.ageDays >= cfg.maxAgeDays) {
      this.alive = false;
      if (stats) stats.deaths.age++;
    }
  }
}

// ========================
// Simulation World
// ========================

class Simulation {
  constructor(cfg = {}) {
    this.cfg = { ...DEFAULT_CFG, ...cfg };
    this.day = 0;
    this.tick = 0;
    this.agents = [];
    this.voids = [];
    this.voidMap = new Map();
    this.nextAgentId = 0;
    this.nextVoidId = 0;
    this.dayStats = [];
    this.currentDayStats = null;
    this.lastExplosions = [];
  }

  init() {
    this.day = 0;
    this.tick = 0;
    this.agents = [];
    this.voids = [];
    this.voidMap = new Map();
    this.nextAgentId = 0;
    this.nextVoidId = 0;
    this.dayStats = [];
    this.lastExplosions = [];

    for (let i = 0; i < this.cfg.initialAgents; i++) {
      this.agents.push(new Agent(this.cfg, this, this.nextAgentId++));
    }

    for (let i = 0; i < this.cfg.targetVoids; i++) {
      const v = new VoidObj(this.cfg, this.nextVoidId++);
      this.voids.push(v);
      this.voidMap.set(v.id, v);
    }

    this.startDayStats();
  }

  startDayStats() {
    this.currentDayStats = {
      day: this.day,
      ticks: 0,
      popStart: this.agents.length,
      popEnd: this.agents.length,
      voidsStart: this.voids.filter(v => v.state === "active").length,
      voidsEnd: 0,

      actions: { scan: 0, share: 0, solve: 0, gen_solve: 0, stockpile: 0, sleep: 0 },
      actionsByMode: {
        vault: { scan: 0, share: 0, solve: 0, gen_solve: 0, stockpile: 0, sleep: 0 },
        router: { scan: 0, share: 0, solve: 0, gen_solve: 0, stockpile: 0, sleep: 0 }
      },

      births: 0,
      deaths: { explosion: 0, age: 0 },
      voids: { spawned: 0, solved: 0, exploded: 0, hits: 0 },

      keys: { added: 0, evicted: 0, pruned: 0, used: 0, replicatedInternal: 0, replicatedShare: 0 },

      genSolve: { attempts: 0, successes: 0 },

      share: { total: 0, withKey: 0, neighborsSum: 0 },

      behavior: {
        shareSuppressedByGate: 0,
        routerGenSolveSkipped: 0
      },

      coverage: null,
      entropyProxy: null,
      meanEnergy: null,
      meanKeysPerAgent: null,

      modes: {
        vault: this.agents.filter(a => a.mode === "vault").length,
        router: this.agents.filter(a => a.mode === "router").length
      }
    };
  }

  stepTick() {
    this.tick++;
    if (this.currentDayStats) this.currentDayStats.ticks++;

    let activeCount = 0;
    for (const a of this.agents) {
      if (!a.alive || a.sleeping) continue;
      a.move(this.currentDayStats);
      a.interact(this.currentDayStats);
      activeCount++;
    }

    if (activeCount === 0 || this.tick >= this.cfg.maxTicksPerDay) {
      this.endDay();
    }
  }

  endDay() {
    const cfg = this.cfg;
    const stats = this.currentDayStats;

    const exploded = [];
    for (const v of this.voids) {
      if (v.state !== "active") continue;
      v.lifespan -= 1;
      v.ageDays += 1;
      if (v.lifespan <= 0) {
        v.state = "exploded";
        exploded.push(v);
        if (stats) stats.voids.exploded++;
      }
    }

    if (exploded.length) {
      for (const v of exploded) {
        for (const a of this.agents) {
          if (!a.alive) continue;
          const d = Math.sqrt(dist2(a.x, a.y, v.x, v.y));
          if (d > cfg.blastRadius) continue;
          const t = 1.0 - (d / cfg.blastRadius);
          const pDeath = clamp(cfg.baseDeath + cfg.kDeath * t, 0, 1);
          if (Math.random() < pDeath) {
            a.alive = false;
            if (stats) stats.deaths.explosion++;
          }
        }
      }
    }

    this.lastExplosions = exploded.map(v => ({ x: v.x, y: v.y, val: v.val }));

    for (const v of this.voids) {
      if (v.state !== "active") this.voidMap.delete(v.id);
    }
    this.voids = this.voids.filter(v => v.state === "active");

    for (const a of this.agents) {
      if (!a.alive) continue;
      a.decayKeys(stats);
    }

    this.agents = this.agents.filter(a => a.alive);

    for (const a of this.agents) {
      a.startNewDay(stats);
    }
    this.agents = this.agents.filter(a => a.alive);

    if (this.agents.length < cfg.maxPop) {
      const parents = this.agents.filter(a => a.ageDays >= cfg.minParentAgeDays);
      if (parents.length && Math.random() < 0.60) {
        const p = parents[Math.floor(Math.random() * parents.length)];
        const child = new Agent(cfg, this, this.nextAgentId++, p.x, p.y, p);
        this.agents.push(child);
        if (stats) stats.births++;
      } else if (this.agents.length < 5) {
        const child = new Agent(cfg, this, this.nextAgentId++);
        this.agents.push(child);
        if (stats) stats.births++;
      }
    }

    const needed = Math.max(0, cfg.targetVoids - this.voids.length);
    const maxAttempts = Math.max(needed * 6, 30);
    let attempts = 0;

    while (this.voids.length < cfg.targetVoids && attempts < maxAttempts) {
      attempts++;
      if (Math.random() < cfg.voidRespawnProb) {
        const v = new VoidObj(cfg, this.nextVoidId++);
        this.voids.push(v);
        this.voidMap.set(v.id, v);
        if (stats) stats.voids.spawned++;
      }
    }

    this.finalizeDayStats();

    this.day += 1;
    this.tick = 0;
    this.startDayStats();
  }

  finalizeDayStats() {
    const stats = this.currentDayStats;
    if (!stats) return;

    stats.popEnd = this.agents.length;
    stats.voidsEnd = this.voids.filter(v => v.state === "active").length;

    stats.coverage = this.computeCoverage();
    stats.entropyProxy = this.computeEntropyProxy();
    stats.meanEnergy = mean(this.agents.map(a => a.energy));
    stats.meanKeysPerAgent = mean(this.agents.map(a => a.keys.length));

    stats.modes = {
      vault: this.agents.filter(a => a.mode === "vault").length,
      router: this.agents.filter(a => a.mode === "router").length
    };

    this.dayStats.push(stats);
    this.currentDayStats = null;
  }

  computeCoverage() {
    const activeVoids = this.voids.filter(v => v.state === "active");
    if (activeVoids.length === 0) return 1.0;

    let covered = 0;
    for (const v of activeVoids) {
      let ok = false;
      for (const a of this.agents) {
        for (const k of a.keys) {
          if (matches(k.val, v.val, this.cfg.matchEps)) { ok = true; break; }
        }
        if (ok) break;
      }
      if (ok) covered++;
    }
    return covered / activeVoids.length;
  }

  computeEntropyProxy() {
    let ent = 0;
    for (const v of this.voids) {
      if (v.state !== "active") continue;
      ent += v.hp * v.urgency();
    }
    return ent;
  }

  runDay() {
    while (this.tick < this.cfg.maxTicksPerDay) {
      let activeCount = 0;
      for (const a of this.agents) {
        if (a.alive && !a.sleeping) activeCount++;
      }
      if (activeCount === 0) break;
      this.stepTick();
    }
    if (this.tick > 0) {
      this.endDay();
    }
  }

  runDays(numDays) {
    for (let i = 0; i < numDays; i++) {
      this.runDay();
    }
  }

  getKeyHistogram(bins = 36) {
    const hist = new Array(bins).fill(0);
    for (const a of this.agents) {
      for (const k of a.keys) {
        const idx = clamp(Math.floor((k.val / 360) * bins), 0, bins - 1);
        hist[idx]++;
      }
    }
    return hist;
  }

  getVoidHistogram(bins = 36) {
    const hist = new Array(bins).fill(0);
    for (const v of this.voids) {
      if (v.state !== "active") continue;
      const idx = clamp(Math.floor((v.val / 360) * bins), 0, bins - 1);
      hist[idx]++;
    }
    return hist;
  }

  getAgentTuningHistogram(bins = 36) {
    const hist = new Array(bins).fill(0);
    for (const a of this.agents) {
      const idx = clamp(Math.floor((a.agentValue / 360) * bins), 0, bins - 1);
      hist[idx]++;
    }
    return hist;
  }

  getAllKeys() {
    const keys = [];
    for (const a of this.agents) {
      for (const k of a.keys) {
        keys.push({ ...k, ownerId: a.id, ownerMode: a.mode });
      }
    }
    return keys;
  }

  getVaultKeys() {
    const keys = [];
    for (const a of this.agents) {
      if (a.mode !== "vault") continue;
      for (const k of a.keys) {
        keys.push({ ...k, ownerId: a.id });
      }
    }
    return keys;
  }

  getRouterKeys() {
    const keys = [];
    for (const a of this.agents) {
      if (a.mode !== "router") continue;
      for (const k of a.keys) {
        keys.push({ ...k, ownerId: a.id });
      }
    }
    return keys;
  }
}

// ========================
// Exports
// ========================

// Node.js exports
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    Simulation,
    Agent,
    VoidObj,
    KeyObj,
    DEFAULT_CFG,
    circDist,
    matches,
    wrap,
    clamp,
    symmetricNoise,
    sampleVoidVal,
    sampleAgentValue,
    mean
  };
}

// Browser exports
if (typeof window !== 'undefined') {
  window.BCMSimulator = {
    Simulation,
    Agent,
    VoidObj,
    KeyObj,
    DEFAULT_CFG,
    circDist,
    matches,
    wrap,
    clamp,
    symmetricNoise,
    sampleVoidVal,
    sampleAgentValue,
    mean
  };
}
