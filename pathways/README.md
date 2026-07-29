# Pathways Model Contract

Working title: **Pathways: An exploratory OPS strategy simulator**.

## Learning objective

No OPS strategy universally wins. Results depend on terrain, timing, goals, other agents, and whether a stabilized route can reopen under contradictory evidence.

The simulator explains a declared model. It does not type the player or claim that OPS is scientifically validated.

## Agent configuration

Every agent has three binary settings:

```text
Observer savior: Oi or Oe
Decider savior: Di or De
Polarized axis: Observer or Decider
```

The polarized axis has the larger savior/demon cost difference. The balanced axis has a smaller difference. Actions remain available regardless of configuration.

## Animal operations

| Animal | Coins | Concrete operation |
|---|---|---|
| Sleep | Oi + Di | Consolidate and improve a personally understood route |
| Consume | Oe + Di | Scout and update a private belief map |
| Blast | Oi + De | Publish a known route and build shared infrastructure |
| Play | Oe + De | Explore jointly and reconcile private maps |

An animal's subjective cost is derived from its component coins. Two saviors are cheapest, two demons are most expensive, and the two mixed animals differ according to which demon lies on the polarized axis.

## Four pathway layers

1. Terrain: hidden seeded ground truth.
2. Belief: each agent's incomplete and possibly stale map.
3. Personal mastery: how reliably that agent can use an edge.
4. Shared pathway: infrastructure and protocol available to the expedition.

## Pressure and growth

Neglected pressure must come from unresolved world conditions:

- neglected Oe leaves terrain unknown or beliefs stale;
- neglected Oi leaves discovered routes fragile;
- neglected De leaves commitments and constraints uncoordinated;
- neglected Di suppresses private evidence or goals that conflict with the group plan.

Selecting a demon move does not reduce pressure by itself. The move must address the relevant condition. Successful manageable contact can lower that pole's cost slightly for the current expedition; the baseline configuration does not change.

## Scenario objective

Five agents have independent goal cards and private maps. The expedition succeeds by delivering at least three members and three supply loads to the summit before the 12-round weather deadline.

Coordination emerges from visible route commitments. There is no separate voting rule, no intentional deception in the MVP, and no lethal outcome.

## Benchmark scenarios

- Uncharted Range: high uncertainty and relatively stable terrain.
- Melting Pass: established routes can become stale quickly.
- Supply Convoy: high interdependence and carrying-capacity pressure.
- Confidently Wrong: four sincere maps agree on a blocked route while one map contradicts them.

## Balance benchmark

`balance-benchmark.js` runs a committed 160-case cohort against Sleep-only, Consume-only, Blast-only, Play-only, and a state-responsive Adaptive policy. It reports success, arrivals, payload, reliable shared routes, stranding, player stress and stamina, rounds, and dominant failure reasons.

The Adaptive policy uses only visible pressure, stamina, stress, scenario uncertainty, and interdependence. It does not inspect hidden terrain truth. Paired comparisons preserve seed, scenario, profile, goal, terrain, and other-agent initialization while changing only the player policy.

```bash
node pathways/balance-benchmark.js
node pathways/balance-benchmark.js --json
node pathways/balance-benchmark.test.js
```

See `BALANCE_BASELINE.md` for the prototype measurements, the material-divergence definition, and the intentionally failing balance verdict captured before tuning.

## Technical boundary

`engine.js` is a pure seeded simulation module usable from the browser or CommonJS tests. `balance-benchmark.js` exercises that public engine without browser state. `app.js` owns DOM and SVG rendering. UI code must not alter simulation outcomes or reveal terrain ground truth before debrief.
