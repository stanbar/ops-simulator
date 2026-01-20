# BCM Simulator Spec v1.1 — Spectrum Ecology + Emergent Cooperation

## 0) Goal and scope

### Primary goal

Create a simulation where **collective problem-solving behavior emerges** from:

* a **spectrum of void types** (common ↔ rare),
* a **spectrum of keys** (common ↔ rare),
* agents **tuned** to parts of the spectrum,
* limited memory + key decay (pruning),
* sharing rules (audience / saturation),
* energy costs and tradeoffs.

### What we will NOT model yet (by design)

* Full typology semantics (e.g., “Te vs Fe psychology” as such).
* Detailed internal emotions.
* Real-world resource needs (food/water) beyond a simple energy model.
* 2D pattern matching (reserved for v2); v1.1 uses the spectrum value as the “shape”.

---

# 1) Core abstraction: the circular spectrum

## 1.1 Spectrum domain

* Spectrum is a circle: values are integers in `[0, 359]`.
* **Distance is circular**: 359 and 1 are distance 2.

**Definition**

* `circ_dist(a, b) = min(|a-b| mod 360, 360 - (|a-b| mod 360))`

This must replace every `abs(a-b)` in matching logic.

## 1.2 Match tolerance

* A key matches a void if `circ_dist(key.val, void.val) <= MATCH_EPS`.
* Default `MATCH_EPS = 2` (Bin’s current behavior).

## 1.3 Spectrum peaks (entropy distribution)

Voids should not be uniform across the circle. We want:

* **common types** (high probability peaks),
* **rare types** (low probability tails),
* plus small noise.

This creates “entropy” in the sense of **common sameness vs rare edge cases**.

### Requirement

Your void generator must be **non-uniform** and stable over time (unless you intentionally “shift eras”).

---

# 2) Entities and data model

## 2.1 Void (Lock)

A void is a problem instance with a type, time pressure, and “HP”.

**Fields**

* `id`
* `pos: (x, y)`
* `val: int` (0–359 spectral value)
* `hp: int` (work required; Bin calls this `energy`)
* `lifespan: int` (days to explosion)
* `age: int`
* `state: active | solved | exploded`
* `severity: float` (optional; influences urgency/harm)
* `reward: float` (optional; energy/reproduction credit on solve)

**Rules**

* Each day: `lifespan -= 1`
* If `lifespan <= 0` and not solved → `exploded`

## 2.2 Key (Meme)

A key is a reusable solution “token” with a type and a lifecycle.

**Fields**

* `id` (optional)
* `val: int` (0–359)
* `creator_id` (agent id)
* `ttl: int` (days before decay/removal if unused)
* `uses: int`
* `rarity_hint: float` (optional; can be estimated from observations)

**Rules**

* Each day: `ttl -= 1`
* If `ttl == 0`: key is pruned (removed)
* On successful use: `ttl = TTL_MAX`, `uses += 1`
* Optional: successful use may replicate a copy (see Section 5.3)

## 2.3 Agent

An agent is a mobile solver with tuning, memory limits, and a decision policy.

**Core fields**

* `id`
* `pos: (x, y)`, `vel: (vx, vy)`
* `energy: float`, `energy_max: float`
* `age_days`
* `alive: bool`
* `boredom: float`, `sleeping: bool`

**Cognition & memory**

* `agent_value: int` (base tuning, 0–359)
* `keys: list[Key]`
* `void_memory: list[VoidMemoryEntry]`
* `total_memory: int` (capacity)
* `mem_split: float` (0–1): fraction for keys vs void_memory

  * `max_keys = floor(total_memory * mem_split)`
  * `max_void_mem = total_memory - max_keys`

**Behavior genes**

* `costs = [cost_scan, cost_gen, cost_share, cost_solve, (optional cost_harvest)]`
* `weights = {...}` utility weights (urgency, effort aversion, saturation, “have key”, etc.)
* Optional: `risk_tolerance`, `share_bandwidth`

## 2.4 VoidMemoryEntry

Represents “awareness” of a void.

**Fields**

* `void_id`
* `pos: (x, y)` (last seen)
* `val: int`
* `last_seen_day`
* `urgency: float` (recomputed from void.lifespan)
* `confidence: float` (how reliable is my knowledge of it)
* `known_solution_val: int | None` (optional learned key val that worked)

## 2.5 Message (Play/Blast channel)

Communication is packetized.

**Minimal payload**

* `void_id`
* `void_pos`
* `void_val`
* `void_hp_remaining` (optional)
* `void_lifespan_remaining` (optional)
* `key_val` (optional: share candidate key)
* `delta_hp` or `hp_after` (optional: results of applying key)
* `sender_id`

---

# 3) Time and simulation loop

## 3.1 Two-scale loop (recommended)

* **Ticks**: movement + interactions (many per day)
* **Day end**: sleep resets, void lifespans tick, pruning happens, reproduction, respawn

This matches Bin’s current architecture and keeps it simple.

## 3.2 Per tick (while awake)

Each awake agent executes:

1. **Move** (toward chosen target or wander)
2. **Perceive** (scan radius detects voids, neighbor agents)
3. **Decide** (utility maximization among actions)
4. **Act** (pay energy, update memory, message neighbors, reduce void hp, etc.)

## 3.3 End of day (when all asleep OR max ticks/day reached)

1. Decrement void lifespans; explode expired voids
2. Apply explosion consequences (local, not global; see 6.2)
3. Prune keys (ttl decay)
4. Agents recover energy (daily refill or partial; see 4.2)
5. Reproduction (selection rule)
6. Void respawn toward target count

---

# 4) Energy model (updated)

## 4.1 Why energy matters here

Energy is what forces:

* “I can’t do everything”
* “I must choose between scanning, solving, sharing, and generating keys”
* the introvert/extrovert tradeoff (refine vs explore)

## 4.2 Energy replenishment modes (choose one)

**Mode A (Bin-like, simple):** daily reset

* Start day: `energy = DAILY_ENERGY`
* Pros: stable, easy
* Cons: can’t model “stored energy for the big rare void”

**Mode B (recommended for BCM feel): carryover with cap**

* Start day: `energy = min(energy + DAILY_ENERGY, energy_max)`
* Pros: enables “preparedness” (Ti stores energy), big-void hero events
* Cons: a bit more tuning

## 4.3 Costs

Default action costs (per action):

* Scan: `cost_scan`
* Generate key: `cost_gen`
* Share: `cost_share`
* Solve attempt: `cost_solve`
* Optional harvest: `cost_harvest`

Costs are per-agent genes (mutate).

## 4.4 Rewards (what gives energy back)

Choose one or combine:

**(R1) Progress reward:** each successful hp reduction gives small energy

* `energy += reward_per_hit`

**(R2) Completion reward:** solving void gives large reward

* `energy += void.reward`
* optional reproduction credit

**(R3) Harvest action:** separate “energy fields” to harvest from

* Adds exploration economy independent of voids

For v1.1, the cleanest is: **R1 + R2**.

---

# 5) Key lifecycle: pruning + replication (critical upgrade)

## 5.1 Key decay (pruning)

Each day:

* For every key in inventory: `ttl -= 1`
* If `ttl <= 0`: remove key

This creates the “unused skills fade” / entropy-like dissipation Bin wants.

## 5.2 Key refresh on use

When a key successfully matches and reduces a void:

* `ttl = TTL_MAX`
* Move it to end of list (LRU refresh like Bin’s `refresh_key_usage`)
* `uses += 1`

## 5.3 Key replication (memetics)

To model “information copies itself”:

* On successful use OR on solve completion:

  * With probability `P_REPLICATE`, create a duplicate key (same val, new ttl) **either**

    * inside the agent (internal redundancy), or
    * as a “share token” that is sent to a neighbor (more social).

Recommended:

* internal replication small: `P_REPLICATE_INTERNAL ~ 0.05`
* social replication larger when sharing: `P_REPLICATE_SHARE ~ 0.20`

## 5.4 Memory pressure rule (keep Bin’s smart discard)

When adding a key to a full inventory:

* Prefer discarding keys that match **no known void in memory**
* Prefer keeping keys that match urgent remembered voids
* Use circular distance in matching

This is a good “awareness → retention” loop.

---

# 6) Void urgency, explosions, and consequences

## 6.1 Urgency function (keep, but define clearly)

Urgency should spike as lifespan approaches zero.

Example:

* `urgency = URG_SCALE / (lifespan + eps)`
  Bin uses ~`300 / (lifespan + 0.1)` which is fine.

## 6.2 Explosion should be local (updated)

Instead of “random death globally,” make explosion consequences depend on proximity.

When a void explodes:

* Agents within `BLAST_RADIUS` have higher death chance:

  * `p_death = base + k * (1 - dist/BLAST_RADIUS)`
* Agents outside radius: near zero chance
  Optional: explosion also wipes keys (entropy shock) or increases future void spawn rate locally.

This creates meaningful spatial emergence:

* “people rush to urgent voids, but risk dying if they fail.”

---

# 7) Action set and decision policy (utility matrix)

## 7.1 Available actions (v1.1)

1. **Scan**: perceive a new void; store it in memory
2. **Share**: broadcast a void (and optionally a key) to neighbors
3. **Solve**: if near void and have matching key, reduce hp
4. **Gen-solve**: if near void and no key, attempt targeted generation toward void.val
5. **Stockpile**: generate random key around agent_value
6. **Sleep**: if bored or low energy, stop acting until day end

## 7.2 Utility inputs

For each candidate void in memory:

* `urgency`
* `distance_to_void`
* `saturation` = fraction of neighbors that already know this void
* `has_key` (matching key exists)
* `energy_remaining`
* optional: `success_history` for that void/key

## 7.3 Utility outputs (intended behavior)

* **Share utility high** when:

  * urgency high AND saturation low (alarm phase)
* **Solve utility high** when:

  * urgency high AND saturation high (coordination / “everyone knows; now work”)
  * plus a huge bonus if agent has the key (“eureka / responsibility”)
* **Scan utility high** when:

  * agent is failing to find work, or boredom rising
* **Stockpile utility high** when:

  * idle and has spare memory, or no known voids

This matches Bin’s current weights system well; just fix circular distance + key lifecycle.

---

# 8) Spectrum mechanics: tuned agents + symmetric generation

## 8.1 Agent tuning

Each agent has `agent_value` (0–359). It is inherited + mutated.

## 8.2 Key generation must be symmetric around tuning (update)

Random key generation should not drift one direction.

Requirement:

* `key_val = (agent_value + symmetric_noise()) % 360`

Example symmetric noise:

* `roll_dice(N, D) - roll_dice(N, D)` (centered at 0)

## 8.3 Targeted generation (gen-solve)

When trying to solve a remembered void:

* attempt values near the void type with some probability of success
* success probability can depend on:

  * how close `agent_value` is to `void.val`
  * energy invested (“shake harder”)

This creates:

* specialists who can generate solutions near their band
* generalists who scan/share more than generate

---

# 9) Optional semantic layering (future-proof, not required now)

You can later map the circle into quadrants (if useful):

Example mapping:

* 0°: Thinking
* 90°: Sensing
* 180°: Feeling
* 270°: Intuition

Then:

* 180° opposite = “shadow”
* ±90° orthogonal = “axis flip”
  This plugs into your “demon work” storyline without changing the engine.

But v1.1 does not require assigning meanings to angles.

---

# 10) Metrics: how to know it’s working

## 10.1 World entropy (objective)

* `E_world = sum(void.hp_remaining * urgency(void))` over active voids
* Explosion count per day
* Solve rate per day

## 10.2 Spectrum coverage (collective cognition proxy)

* Histogram of void types vs histogram of keys in population
* Coverage score:

  * for each active void, does *any* agent hold a matching key?
  * percent of voids “covered” at time t

## 10.3 Diffusion and specialization

* Average keys per agent, average unique key types
* Gini/inequality of rare keys:

  * do rare keys concentrate in few agents (vault behavior)?
* Share network activity (messages/day)

## 10.4 “Hero journey” signal (your agenda)

Per-agent:

* **prediction error proxy**: repeated failures to solve urgent voids in memory
* **rigidity proxy**: low diversity of key vals + low scanning
* **growth proxy**: increase in key diversity after crisis episodes

A crisis episode is when:

* agent’s known urgent voids rise but solve success stays low.

---

# 11) Expected emergent behaviors (what you should observe)

If parameters are reasonable, you should see:

1. **Alarm → coordination → convergence**

* First: one or few agents scan a new urgent void and share widely
* Then: many agents move toward it
* Finally: those with matching keys do most damage; others gen-solve or keep searching

2. **Common key ecology**

* Common void types produce frequently-used keys
* Those keys replicate and spread (public library effect)

3. **Rare key vaults**

* Rare void types appear occasionally
* A few agents keep rare keys alive (because they match remembered urgent voids, or because they are “creators”)
* When a rare void hits, a “hero” moment occurs:

  * one agent’s rare key suddenly becomes massively valuable and spreads

4. **Pruning waves**

* If a void type disappears for long, keys for it decay out of the population
* Later, if that type returns, the society is briefly “unprepared” (entropy shock)

---

# 12) Parameters and recommended defaults (starting point)

**Core**

* `ARENA_SIZE = 1000`
* `MATCH_EPS = 2`
* `VISION_RADIUS = 120`
* `INTERACT_RADIUS = 40`

**Void**

* `VOID_HP = 40`
* `VOID_LIFESPAN_RANGE = (5, 15)`
* `TARGET_VOIDS = 25`
* `VOID_RESPAWN_PROB = 0.5` (when below target)

**Energy**

* `DAILY_ENERGY = 80`
* `ENERGY_MAX = 160` (if carryover mode)
* `REWARD_PER_HIT = 0.5` (tune)
* `REWARD_ON_SOLVE = 10` (tune)

**Keys**

* `TTL_MAX = 12` days
* `P_REPLICATE_INTERNAL = 0.05`
* `P_REPLICATE_SHARE = 0.20`

**Explosion**

* `BLAST_RADIUS = 120`
* `BASE_DEATH = 0.01`
* `K_DEATH = 0.20` (so near center can be dangerous)

**Boredom**

* `BOREDOM_LIMIT = 300` (keep)

