# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is the **BCM (Binary Cognition Mechanics) Spectrum Simulator** - an agent-based simulation built in p5.js that models collective problem-solving behavior. Autonomous agents compete to solve "voids" (problems) using "keys" (solutions) in a circular spectrum space [0-359 degrees].

The simulation explores how collective intelligence emerges from individual cognitive constraints and specialization, grounded in Jungian psychology concepts.

## Running the Project

**No build system** - this is a single-file browser application.

- Open `index.html` directly in a browser
- All code is inline JavaScript within `index.html`
- Uses p5.js v1.9.2 loaded from CDN

## Architecture

### Single File Structure (`index.html` ~1300 lines)

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

### Core Mechanics

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

- `index.html` - Complete simulation (all code inline)
- `SPECIFICATION.md` - Full technical spec v1.1 (entity definitions, rules, parameters)
- `NARRATIVE.md` - Design discussions explaining the "why" behind mechanics
- `ops-ebook.md` - OPS personality system background (512 types, functions, animals)

## Development Notes

- Changes take effect immediately on browser refresh
- Click agents/voids in the canvas for debug inspector
- Download telemetry JSON via UI button for analysis
- Agent diversity evolves via genetic mutation - expect non-uniform populations
- All configuration is in the `CFG` object at the top of the script
