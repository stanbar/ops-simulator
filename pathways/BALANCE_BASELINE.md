# Pathways Prototype Balance Baseline

Captured for GitHub issue #10 before gameplay tuning.

## Cohort

The committed cohort in `balance-benchmark.js` contains 160 cases and runs each case under five player policies, for 800 expeditions total:

- two fixed seeds;
- all four benchmark scenarios;
- four representative profiles covering every Oi/Oe and Di/De combination and both polarity settings;
- all five controlled player goals.

Every policy comparison for a cohort case holds seed, scenario, profile, goal, generated terrain, and other-agent initialization constant.

## Policies

- `Sleep`, `Consume`, `Blast`, and `Play` select that animal every round.
- `Adaptive` responds to visible player pressure, stamina, stress, scenario uncertainty, and interdependence. It cannot inspect hidden terrain truth.

## Material divergence

Two paired runs materially diverge when at least one of these observable conditions differs:

- success versus failure;
- at least one member arriving;
- at least one supply load delivered;
- at least one reliable shared route;
- at least one stranded member;
- at least 2.0 player-stress points.

## Measured prototype

Run on the fixed cohort with `node pathways/balance-benchmark.js`:

| Policy | Success | Members | Payload | Reliable routes | Stranded | Stress | Stamina | Rounds | Dominant failure |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---|
| Sleep | 68.8% | 3.37 | 2.66 | 1.76 | 0.29 | 5.68 | 1.06 | 9.07 | insufficient payload |
| Consume | 73.1% | 3.39 | 2.62 | 1.71 | 0.41 | 7.06 | 0.79 | 9.61 | insufficient payload |
| Blast | 3.8% | 3.99 | 0.61 | 4.18 | 0.92 | 7.22 | 0.09 | 11.79 | stranding |
| Play | 54.4% | 3.38 | 2.37 | 2.16 | 0.72 | 7.54 | 0.77 | 10.36 | stranding |
| Adaptive | 50.0% | 3.49 | 2.02 | 2.39 | 0.38 | 5.92 | 0.75 | 10.01 | insufficient payload |

Paired material divergence is 97.3% (1,556 of 1,600 policy pairs).

## Balance verdict

This baseline intentionally fails the target envelope:

- Sleep, Consume, and Play exceed the 40% pure-policy success ceiling.
- Adaptive is inside the 45-65% target band.
- Adaptive trails Consume by 23.1 percentage points instead of leading the strongest pure policy by at least 15 points.
- Paired divergence exceeds the 60% minimum, so choices produce observable differences even though the success outcomes remain poorly balanced.

The baseline is evidence for subsequent balancing tickets, not a target to preserve after those mechanics change.
