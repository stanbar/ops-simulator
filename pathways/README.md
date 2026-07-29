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

## Destination, terrain, and origin

These are independent causal inputs. A destination declares demand for private discovery, private repeatability, shared exploration, shared standardization, repeated traffic, feedback latency, and cost of error. Terrain separately declares uncertainty, volatility, branching, observability, interdependence, and route recurrence. Origin separately declares prior evidence, initial mastery, shared infrastructure, agent distribution, resources, and starting proximity. Current evidence state can then adjust evidence coverage and confidence without changing those three inputs.

Domain presets are explicit parameter bundles, not animal assignments. Health can favor Sleep when private repeatability and recurrence dominate, but a health destination with sparse evidence can rationally favor Consume first. The useful sequence depends on destination demands, terrain, origin, current pathway state, and horizon.

## Pressure and growth

Neglected pressure must come from unresolved world conditions:

- neglected Oe leaves terrain unknown or beliefs stale;
- neglected Oi leaves discovered routes fragile;
- neglected De leaves commitments and constraints uncoordinated;
- neglected Di suppresses private evidence or goals that conflict with the group plan.

Selecting a demon move does not reduce pressure by itself. The move must address the relevant condition. Successful manageable contact can lower that pole's cost slightly for the current expedition; the baseline configuration does not change.

## Scenario objective and traffic

Five agents have independent goal cards and private maps. A destination and terrain create recurring traffic demands with a source, destination, subject, priority, deadline, feedback delay, value, and optional assigned agent. Demands include summit payload deliveries and return trips between base and intermediate camps. Success requirements vary with destination demands within a 32-round horizon.

Each round has two explicit phases. The selected animal performs a pathway operation first; then traffic advances along a bidirectional route. Consume collects private evidence, Play collects reciprocal evidence, Sleep consolidates personal mastery, and Blast builds shared infrastructure. Sleep and Blast only report a return when a later traversal uses the investment: Sleep benefits its owner, while Blast can benefit another agent or shared payload.

The map has eight ascent stages plus lateral links, so traffic can ascend, descend, and cross between routes. Coordination emerges from visible route commitments. There is no separate voting rule, no intentional deception in the MVP, and no lethal outcome.

## Benchmark scenarios

- Uncharted Range: high uncertainty and relatively stable terrain.
- Melting Pass: established routes can become stale quickly.
- Supply Convoy: high interdependence and carrying-capacity pressure.
- Confidently Wrong: four sincere maps agree on a blocked route while one map contradicts them.

## Balance benchmark

`balance-benchmark.js` runs a committed 45-case cohort against Sleep-only, Consume-only, Blast-only, Play-only, and a state-responsive Adaptive policy. It also compares five horizon policies: Oe Opening, Oi Opening, Continued Oe, Continued Oi, and Oe to Oi. Destination × terrain × origin × evidence-state cells are primary; aggregate rates across unlike cells are secondary. It reports completed demands, payload throughput, repeated traversals, personal and shared delayed returns, decision quality, destination outcome, stress, stamina, rounds, and early/middle/final checkpoints.

The Adaptive policy uses visible stress, goals, profile-derived costs, destination demands, scenario settings, beliefs, personal mastery, shared infrastructure, partner availability, materials, declared traffic, and visible movement intents. It does not inspect hidden terrain truth. Paired comparisons preserve seed, destination, terrain, origin, evidence state, horizon, profile, goal, traffic demands, and other-agent initialization while changing only the player policy. Lucky-route diagnostics compare favorable outcomes with matched non-lucky counterfactual worlds to distinguish ex-post success from ex-ante policy robustness.

```bash
node pathways/balance-benchmark.js
node pathways/balance-benchmark.js --json
node pathways/balance-benchmark.test.js
```

See `BALANCE_BASELINE.md` for the superseded issue #10 one-ascent measurements. Those numbers remain reproducibility history and do not gate the current repeated-traffic model.

## Technical boundary

`engine.js` is a pure seeded simulation module usable from the browser or CommonJS tests. `balance-benchmark.js` exercises that public engine without browser state. `app.js` owns DOM and SVG rendering. UI code must not alter simulation outcomes or reveal terrain ground truth before debrief.

Observation, weather, and traffic use separate deterministic random streams. Weather is fixed by round; traffic shocks are fixed by demand leg and attempt number. This prevents one policy from reassigning later weather or traffic luck merely by consuming more random draws.
