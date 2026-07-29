# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This repository contains two exploratory OPS/BCM simulations:

- **Pathways** (`pathways/`): a turn-based five-agent mountain logistics simulation with recurring traffic, a pure seeded engine, and an SVG browser UI.
- **Spectrum** (`spectrum/` + root `simulation.js`): the original p5.js agent ecology where agents solve voids with keys in a circular spectrum.

The simulation explores how collective intelligence emerges from individual cognitive constraints and specialization, grounded in Jungian psychology concepts.

## Running the Project

**No build system** - both experiences are static browser applications.

- Serve the repository over HTTP, for example with `python3 -m http.server 8080`.
- Open `/` for the simulator chooser, `/pathways/` for Pathways, or `/spectrum/` for Spectrum.
- Spectrum uses p5.js v1.9.2 loaded from a CDN.
- Pathways has no runtime dependencies.

## Architecture

### Spectrum

```
Config (CFG object)           - All tunable parameters
Telemetry System              - Event logging, daily stats, JSON export
Entity Classes:
  - VoidObj                   - Problem with HP, lifespan, spectrum value
  - KeyObj                    - Solution with TTL, uses counter
  - Agent                     - Solver with memory, energy, genetics
World Management:
  - world object              - agents[], voids[], simulation state
  - tick()                    - Per-frame: move, perceive, decide, act
  - dayEnd()                  - End-of-day: decay, reproduction, respawn
UI & Rendering                - p5.js canvas, control panel, inspector
```

### Pathways

```
pathways/engine.js            - Seeded simulation, coin costs, maps, actions, scenarios
pathways/app.js               - DOM/SVG application and debrief
pathways/styles.css           - Responsive visual system
pathways/engine.test.js       - Deterministic and behavioral tests
pathways/README.md            - Model contract and epistemic boundary
```

Pathways separates destination demands, terrain, origin state, private belief, personal mastery, and shared infrastructure. Each round separates an animal operation from traffic movement. Do not reveal true terrain in the UI before debrief. Animal costs are derived from `Oi/Oe`, `Di/De`, and Observer/Decider polarity; no action may be hard-locked because it is a demon. Domain presets are parameter bundles, never inherent animal assignments.

### Spectrum Core Mechanics

**Circular Spectrum Distance**: All matching uses `circDist(a, b)` - the minimum distance on a 360-degree circle. A key matches a void when `circDist(key.val, void.val) <= MATCH_EPS` (default 2).

**Two-Tier Memory Ecology (v1.5)**:
- **Vaults** (~28%): Deep key storage (78% memory for keys), longer TTL, specialized solvers
- **Routers** (~72%): Awareness-focused (35% memory for keys), more void-memory, enhanced sharing

**Decision Loop**: Each awake agent per tick:
1. Perceive (scan radius 120px)
2. Compute utility for actions: Share, Solve, Scan, Stockpile, Sleep
3. Execute highest-utility action (pay energy cost)

**Key Lifecycle**: Generate → Use (refresh TTL) → Decay (TTL-1 per day) → Prune when TTL=0

### Key Configuration Parameters (CFG object)

- `matchEps` - Key-void matching tolerance (default 2)
- `urgencyK`, `urgencyBias` - Urgency curve shape
- `vaultMemSplit`, `routerMemSplit` - Memory allocation ratios
- `pVaultAtBirth` - Vault vs router birth ratio
- `shareNoveltyGate` - Suppress high-saturation sharing

## Key Files

- `index.html` - Simulator chooser
- `pathways/` - Pathways engine, tests, SVG application, and model contract
- `spectrum/index.html` - Spectrum browser shell; loads the root `simulation.js`
- `simulation.js` - Spectrum simulation engine and p5.js rendering
- `SPECIFICATION.md` - Full technical spec v1.1 (entity definitions, rules, parameters)
- `NARRATIVE.md` - Design discussions explaining the "why" behind mechanics
- `ops-ebook.md` - OPS personality system background (512 types, functions, animals)

## Development Notes

- Changes take effect immediately on browser refresh.
- Run `node pathways/engine.test.js` after Pathways engine changes.
- Run `node pathways/balance-benchmark.test.js` after benchmark changes and `node pathways/balance-benchmark.js` to inspect logistics and horizon behavior. The issue #10 envelope in `pathways/BALANCE_BASELINE.md` is historical only.
- Run `node simulation.test.js` after Spectrum engine changes.
- Click agents/voids in the canvas for debug inspector
- Download telemetry JSON via UI button for analysis
- Agent diversity evolves via genetic mutation - expect non-uniform populations
- All configuration is in the `CFG` object at the top of the script
- Keep the two engines independent until a shared causal-state bridge has explicit tests. See `README.md` for likely future fusion points.
