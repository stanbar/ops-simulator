# OPS and BCM Simulators

Dependency-light browser simulations that turn selected OPS and Binary Cognition Mechanics ideas into explicit, inspectable rules.

These are exploratory models. Behavior inside a simulator does not validate OPS/BCM, establish biological types, or assess a real person's personality.

## Experiences

### Pathways

`/pathways/` is a turn-based five-agent mountain expedition. It models:

- `Oi/Oe` as route stabilization versus route exploration;
- `Di/De` as private versus externally coordinated decision authority;
- Observer/Decider as the axis carrying the larger savior/demon cost difference;
- Sleep, Consume, Blast, and Play as concrete combined pathway operations;
- private belief maps over hidden seeded terrain;
- personal mastery and shared infrastructure as separate pathway layers;
- stress, neglected reality, and bounded within-run adaptation.

The engine is in `pathways/engine.js`; the SVG application is in `pathways/app.js`.

### Spectrum

`/spectrum/` preserves the existing p5.js BCM ecology. Autonomous agents discover, store, exchange, and apply keys to time-sensitive voids across a circular cognitive spectrum. Its core engine remains at `simulation.js`.

## Run locally

Serve the repository over HTTP, then open the displayed local URL:

```bash
python3 -m http.server 8080
```

The Spectrum page loads p5.js from a CDN. Pathways has no runtime dependencies.

## Tests

```bash
node pathways/engine.test.js
node simulation.test.js
```

The Pathways suite covers deterministic replay, coin-derived cost ordering, action availability, counterfactual coin flips, separate pathway layers, false consensus, and benchmark scenario execution.

## Future fusion boundary

Keep the engines independent until a shared mechanic has a clear semantic mapping and test. Likely bridges include:

- a Pathways edge carrying Spectrum keys or solutions;
- voids becoming route-level demands or terrain events;
- shared infrastructure changing key transmission capacity;
- private maps and memory ecology sharing confidence and decay rules;
- population-level emergence generating new expedition scenarios.

Do not fuse rendering loops or terminology merely because both simulations use agents. The useful bridge is causal state, not shared labels.
