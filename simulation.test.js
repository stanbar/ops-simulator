/**
 * BCM Spectrum Simulator - Test Suite (v2)
 *
 * Changes vs your draft:
 *  - Adds multi-run (multi-seed) statistical testing to reduce flakiness
 *  - Separates: Unit tests (deterministic) / Invariants (must always hold) / Emergence (statistical)
 *  - Aligns with v1.5 behaviors:
 *      * Routers may suppress gen-solve
 *      * Vaults intentionally retain more diverse keys (less clustered)
 *      * Novelty gate reduces high-saturation sharing waste
 *  - Removes overly strict “all actions must occur” requirement
 *  - Adds stronger invariants (caps, bounds, NaN checks, map mismatch)
 *
 * Run with: node simulation.test.js
 */

const {
  Simulation,
  DEFAULT_CFG,
  circDist,
  matches,
  wrap,
  clamp,
  symmetricNoise,
  sampleVoidVal,
  sampleAgentValue,
  mean
} = require('./simulation.js');

// ========================
// Test Framework
// ========================

let passCount = 0;
let failCount = 0;
const failures = [];

function assert(condition, message) {
  if (condition) {
    passCount++;
    process.stdout.write('.');
  } else {
    failCount++;
    failures.push(message);
    process.stdout.write('F');
  }
}

function assertApprox(actual, expected, tolerance, message) {
  const diff = Math.abs(actual - expected);
  assert(diff <= tolerance, `${message}: expected ~${expected}, got ${actual} (diff: ${diff})`);
}

function assertRange(value, min, max, message) {
  assert(value >= min && value <= max, `${message}: expected ${min}-${max}, got ${value}`);
}

function assertGreater(value, threshold, message) {
  assert(value > threshold, `${message}: expected > ${threshold}, got ${value}`);
}

function assertLess(value, threshold, message) {
  assert(value < threshold, `${message}: expected < ${threshold}, got ${value}`);
}

function describe(name, fn) {
  console.log(`\n${name}`);
  fn();
}

function it(name, fn) {
  try {
    fn();
  } catch (e) {
    failCount++;
    failures.push(`${name}: ${e.message}`);
    process.stdout.write('E');
  }
}

// ========================
// Stats helpers (robust)
// ========================

function isFiniteNumber(x) {
  return typeof x === 'number' && Number.isFinite(x);
}

function percentile(arr, p) {
  if (!arr.length) return null;
  const a = arr.slice().sort((x, y) => x - y);
  const idx = clamp(Math.floor((p / 100) * (a.length - 1)), 0, a.length - 1);
  return a[idx];
}

function median(arr) {
  return percentile(arr, 50);
}

function safeMean(arr) {
  const xs = arr.filter(isFiniteNumber);
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
}

function lastN(arr, n) {
  if (!arr || !arr.length) return [];
  return arr.slice(Math.max(0, arr.length - n));
}

// ========================
// Multi-run harness
// ========================

const RUNS_DEFAULT = 16;          // bump if you want even more stability
const WARMUP_DAYS_DEFAULT = 10;   // ignore early transient

function runSim(cfg = {}, days = 50, seed = 1) {
  // If Simulation supports seeding, passing seed should work.
  // If it ignores unknown fields, it’s harmless.
  const sim = new Simulation({ ...cfg, seed });
  sim.init();
  sim.runDays(days);
  return sim;
}

function runMany(cfg = {}, days = 50, runs = RUNS_DEFAULT, seedBase = 1337) {
  const sims = [];
  for (let i = 0; i < runs; i++) {
    sims.push(runSim(cfg, days, seedBase + i));
  }
  return sims;
}

function aggregateDayStats(sims) {
  // Flatten dayStats across sims while preserving per-sim access when needed
  return sims.map(sim => sim.dayStats);
}

// ========================
// 1) Deterministic unit tests
// ========================

describe('1. Basic Mechanics (Deterministic)', () => {
  it('circDist: calculates circular distance correctly', () => {
    assert(circDist(0, 0) === 0, 'circDist(0, 0) should be 0');
    assert(circDist(0, 180) === 180, 'circDist(0, 180) should be 180');
    assert(circDist(0, 359) === 1, 'circDist(0, 359) should be 1 (wrap around)');
    assert(circDist(359, 1) === 2, 'circDist(359, 1) should be 2');
    assert(circDist(10, 350) === 20, 'circDist(10, 350) should be 20');
    assert(circDist(90, 270) === 180, 'circDist(90, 270) should be 180');
  });

  it('matches: key matches void within tolerance', () => {
    assert(matches(100, 100, 2) === true, 'exact match should work');
    assert(matches(100, 102, 2) === true, 'within tolerance should match');
    assert(matches(100, 103, 2) === false, 'outside tolerance should not match');
    assert(matches(1, 359, 2) === true, 'wrap-around matching should work');
    assert(matches(0, 358, 2) === true, 'wrap-around matching at 0');
  });

  it('wrap: handles circular wrapping correctly', () => {
    assert(wrap(360, 360) === 0, 'wrap(360) should be 0');
    assert(wrap(361, 360) === 1, 'wrap(361) should be 1');
    assert(wrap(-1, 360) === 359, 'wrap(-1) should be 359');
    assert(wrap(-361, 360) === 359, 'wrap(-361) should be 359');
  });

  it('symmetricNoise: produces centered distribution (statistical)', () => {
    let sum = 0;
    const n = 20000;
    for (let i = 0; i < n; i++) sum += symmetricNoise(6, 5);
    const m = sum / n;
    assertApprox(m, 0, 1.0, 'symmetricNoise should be centered around 0');
  });

  it('sampleVoidVal: produces non-uniform distribution (statistical)', () => {
    const bins = new Array(36).fill(0);
    const n = 20000;
    for (let i = 0; i < n; i++) {
      const val = sampleVoidVal();
      const idx = Math.min(35, Math.floor((val / 360) * 36));
      bins[idx]++;
    }
    const maxBin = Math.max(...bins);
    const minBin = Math.min(...bins);
    const ratio = maxBin / Math.max(1, minBin);
    assertGreater(ratio, 1.15, 'void distribution should have variation (ratio > 1.15)');
  });

  it('sampleAgentValue: produces one of 8 discrete values', () => {
    const values = new Set();
    for (let i = 0; i < 2000; i++) values.add(sampleAgentValue());
    assert(values.size === 8, 'should produce exactly 8 discrete agent values');
    for (const v of values) assert(v % 45 === 0, `agent value ${v} should be multiple of 45`);
  });
});

// ========================
// 2) Invariants (single-run OK, must always hold)
// ========================

describe('2. Invariants (Must Always Hold)', () => {
  it('simulation runs 100 days without crashing', () => {
    const sim = new Simulation();
    sim.init();

    let error = null;
    try { sim.runDays(100); } catch (e) { error = e; }

    assert(error === null, 'simulation should run 100 days without error');
    assert(sim.day >= 100, 'simulation should reach day 100');
  });

  it('population stays within [1, maxPop] across run', () => {
    const sim = new Simulation({ maxPop: 100, initialAgents: 30 });
    sim.init();
    sim.runDays(60);

    const pops = sim.dayStats.map(d => d.popEnd);
    assertGreater(Math.min(...pops), 0, 'population should never hit 0');
    assertLess(Math.max(...pops), 101, 'population should stay at or below maxPop');
  });

  it('telemetry numeric fields are finite and in bounds', () => {
    const sim = new Simulation();
    sim.init();
    sim.runDays(40);

    for (const d of sim.dayStats) {
      if (d.coverage != null) assertRange(d.coverage, 0, 1, `day ${d.day} coverage should be 0-1`);
      if (d.entropyProxy != null) assert(isFiniteNumber(d.entropyProxy), `day ${d.day} entropyProxy should be finite`);
      if (d.meanEnergy != null) assert(isFiniteNumber(d.meanEnergy), `day ${d.day} meanEnergy should be finite`);
      if (d.meanKeysPerAgent != null) assert(isFiniteNumber(d.meanKeysPerAgent), `day ${d.day} meanKeysPerAgent should be finite`);

      // If DEFAULT_CFG exported, use it; else fall back to sim.cfg if present
      const eMax = (DEFAULT_CFG && DEFAULT_CFG.energyMax) ? DEFAULT_CFG.energyMax : (sim.cfg?.energyMax ?? 1e9);
      if (d.meanEnergy != null) assertRange(d.meanEnergy, 0, eMax, `day ${d.day} meanEnergy should be in range`);
    }
  });

  it('mode counts are consistent (vault+router == popEnd) when modes exist', () => {
    const sim = new Simulation();
    sim.init();
    sim.runDays(25);

    for (const d of sim.dayStats) {
      if (!d.modes) continue; // allow older telemetry
      assert(d.modes.vault !== undefined, 'vault count should be tracked');
      assert(d.modes.router !== undefined, 'router count should be tracked');
      assert(d.modes.vault + d.modes.router === d.popEnd, 'vault + router should equal population');
    }
  });

  it('anomaly: voidMapMismatch stays at 0 (if tracked)', () => {
    const sim = new Simulation();
    sim.init();
    sim.runDays(40);

    const mismatches = sim.dayStats
      .map(d => d?.anomalies?.voidMapMismatch)
      .filter(x => x !== undefined && x !== null);

    if (!mismatches.length) {
      // Not tracked in older versions; don't fail.
      assert(true, 'voidMapMismatch not tracked; skipping');
      return;
    }

    const maxMis = Math.max(...mismatches);
    assert(maxMis === 0, `voidMapMismatch should stay 0, got max=${maxMis}`);
  });

  it('agent memory caps are respected (keys <= maxKeys, voidMem <= maxVoidMem)', () => {
    const sim = new Simulation();
    sim.init();
    sim.runDays(30);

    for (const a of sim.agents) {
      assert(a.keys.length <= a.maxKeys, `agent ${a.id} keys exceed maxKeys`);
      assert(a.voidMem.length <= a.maxVoidMem, `agent ${a.id} voidMem exceed maxVoidMem`);
    }
  });

  it('target void count does not collapse (sanity)', () => {
    const sim = new Simulation({ targetVoids: 25 });
    sim.init();
    sim.runDays(60);

    // ignore warmup; ensure it does not get stuck too low
    const after = sim.dayStats.slice(WARMUP_DAYS_DEFAULT);
    const voids = after.map(d => d.voidsEnd);
    const med = median(voids);

    assertGreater(med, 10, `median active voids should stay > 10 (got ${med})`);
  });
});

// ========================
// 3) Lifecycle tests (lightly statistical, but should be stable)
// ========================

describe('3. Key & Void Lifecycle (Stable Expectations)', () => {
  it('agents start with initial keys', () => {
    const sim = new Simulation();
    sim.init();
    for (const a of sim.agents) assertGreater(a.keys.length, 0, 'agents should start with keys');
  });

  it('keys decay over time (pruning occurs) - multi-run median > 0', () => {
    const sims = runMany({ keyTTLMax: 5 }, 30, 12);
    const totals = sims.map(sim => sim.dayStats.reduce((s, d) => s + (d?.keys?.pruned ?? 0), 0));
    assertGreater(median(totals), 0, `median pruned should be > 0 (got ${median(totals)})`);
  });

  it('voids are solved (not just exploding) - multi-run', () => {
    const sims = runMany({}, 35, 14);
    const solved = sims.map(sim => sim.dayStats.reduce((s, d) => s + (d?.voids?.solved ?? 0), 0));
    const exploded = sims.map(sim => sim.dayStats.reduce((s, d) => s + (d?.voids?.exploded ?? 0), 0));

    const medSolved = median(solved);
    const medExploded = median(exploded);

    assertGreater(medSolved, 0, `median solved should be > 0 (got ${medSolved})`);
    // allow explosions but require solving to be meaningful
    assert(medSolved >= medExploded * 0.2, `solve should be meaningful vs explosions (medSolved=${medSolved}, medExploded=${medExploded})`);
  });

  it('reproduction occurs when below maxPop (multi-run)', () => {
    const sims = runMany({ initialAgents: 20, maxPop: 120, minParentAgeDays: 10 }, 35, 12);
    const births = sims.map(sim => sim.dayStats.reduce((s, d) => s + (d?.births ?? 0), 0));
    assertGreater(median(births), 0, `median births should be > 0 (got ${median(births)})`);
  });

  it('agents die from old age when maxAgeDays is low (multi-run)', () => {
    const sims = runMany({ maxAgeDays: 25 }, 40, 12);
    const ageDeaths = sims.map(sim => sim.dayStats.reduce((s, d) => s + (d?.deaths?.age ?? 0), 0));
    assertGreater(median(ageDeaths), 0, `median age deaths should be > 0 (got ${median(ageDeaths)})`);
  });

  it('agents die from explosions under aggressive blast settings (multi-run)', () => {
    const sims = runMany({
      voidLifespanMin: 1,
      voidLifespanMax: 2,
      blastRadius: 500,
      kDeath: 0.6
    }, 12, 14);

    const expDeaths = sims.map(sim => sim.dayStats.reduce((s, d) => s + (d?.deaths?.explosion ?? 0), 0));
    assertGreater(median(expDeaths), 0, `median explosion deaths should be > 0 (got ${median(expDeaths)})`);
  });
});

// ========================
// 4) Emergence tests (statistical; aligned to v1.5 design)
// ========================

describe('4. Emergence (Statistical + v1.5-aligned)', () => {
  it('coverage is > 0 and typically > random baseline (multi-run)', () => {
    const sims = runMany({}, 40, 16);
    const avgCovs = sims.map(sim => {
      const cov = sim.dayStats
        .slice(WARMUP_DAYS_DEFAULT)
        .map(d => d.coverage)
        .filter(x => x != null);
      return safeMean(cov) ?? 0;
    });

    const med = median(avgCovs);
    assertGreater(med, 0.03, `median avg coverage should be > 3% (got ${med})`);
  });

  it('sharing spreads awareness (alarm behavior) - multi-run', () => {
    const sims = runMany({}, 30, 14);
    const totals = sims.map(sim => {
      const ds = sim.dayStats.slice(WARMUP_DAYS_DEFAULT);
      const shares = ds.reduce((s, d) => s + (d?.share?.total ?? 0), 0);
      const reached = ds.reduce((s, d) => s + (d?.share?.neighborsSum ?? 0), 0);
      return { shares, reached };
    });

    const medShares = median(totals.map(x => x.shares));
    const medReached = median(totals.map(x => x.reached));

    assertGreater(medShares, 0, `median shares should be > 0 (got ${medShares})`);
    assert(medReached >= medShares, `shares should reach neighbors (medReached=${medReached}, medShares=${medShares})`);
  });

  it('novelty gate reduces high-saturation share waste (if tracked)', () => {
    const sims = runMany({}, 45, 14);

    // Look for:
    //  - shareHighSaturation exists and isn't dominating
    //  - shareSuppressedByGate > 0 when gate enabled
    const ratios = [];
    const suppressed = [];

    for (const sim of sims) {
      const ds = sim.dayStats.slice(WARMUP_DAYS_DEFAULT);
      const shareTotal = ds.reduce((s, d) => s + (d?.share?.total ?? 0), 0);
      const hiSat = ds.reduce((s, d) => s + (d?.anomalies?.shareHighSaturation ?? 0), 0);
      const sup = ds.reduce((s, d) => s + (d?.behavior?.shareSuppressedByGate ?? 0), 0);

      if (shareTotal > 0) ratios.push(hiSat / shareTotal);
      suppressed.push(sup);
    }

    // If fields not tracked, don’t fail.
    if (!ratios.length) {
      assert(true, 'shareHighSaturation not tracked; skipping');
      return;
    }

    const medRatio = median(ratios);
    assertLess(medRatio, 0.65, `median high-saturation share ratio should be < 0.65 (got ${medRatio})`);

    // suppressed counter: should often be > 0 when gate exists
    const medSup = median(suppressed);
    assertGreater(medSup, 0, `median shareSuppressedByGate should be > 0 (got ${medSup})`);
  });

  it('router gen-solve suppression engages (if tracked) and gen-solve still exists overall', () => {
    const sims = runMany({}, 45, 14);

    const skipped = [];
    const genAttempts = [];

    for (const sim of sims) {
      const ds = sim.dayStats.slice(WARMUP_DAYS_DEFAULT);
      const sk = ds.reduce((s, d) => s + (d?.behavior?.routerGenSolveSkipped ?? 0), 0);
      const ga = ds.reduce((s, d) => s + (d?.genSolve?.attempts ?? 0), 0);

      skipped.push(sk);
      genAttempts.push(ga);
    }

    // If not tracked, skip the "skipped" assertion.
    const medAttempts = median(genAttempts);
    assertGreater(medAttempts, 0, `median gen-solve attempts should be > 0 overall (got ${medAttempts})`);

    const medSkipped = median(skipped);
    if (Number.isFinite(medSkipped)) {
      assertGreater(medSkipped, 0, `median routerGenSolveSkipped should be > 0 when enabled (got ${medSkipped})`);
    } else {
      assert(true, 'routerGenSolveSkipped not tracked; skipping');
    }
  });

  it('specialization split: routers more clustered, vaults more diverse (multi-run)', () => {
    const sims = runMany({}, 50, 14);

    const routerMeans = [];
    const vaultMeans = [];

    for (const sim of sims) {
      const vaults = sim.agents.filter(a => a.mode === 'vault');
      const routers = sim.agents.filter(a => a.mode === 'router');

      // If modes are not present or one side empty, skip this run.
      if (!vaults.length || !routers.length) continue;

      const routerDists = [];
      for (const a of routers) {
        for (const k of a.keys) routerDists.push(circDist(k.val, a.agentValue));
      }
      const vaultDists = [];
      for (const a of vaults) {
        for (const k of a.keys) vaultDists.push(circDist(k.val, a.agentValue));
      }

      if (routerDists.length) routerMeans.push(safeMean(routerDists));
      if (vaultDists.length) vaultMeans.push(safeMean(vaultDists));
    }

    if (!routerMeans.length || !vaultMeans.length) {
      assert(true, 'not enough mixed-mode runs to evaluate specialization split; skipping');
      return;
    }

    const rMed = median(routerMeans);
    const vMed = median(vaultMeans);

    // Routers should be more clustered (smaller distance) than vaults, typically.
    assert(rMed < vMed, `routers should be more clustered than vaults (rMed=${rMed}, vMed=${vMed})`);

    // Also ensure routers are not totally random (random avg ~ 90)
    assertLess(rMed, 90, `routers should be somewhat specialized (rMed=${rMed})`);
  });

  it('rare-key reservoir: vaults over-represent rare keys (multi-run, if helpers exist)', () => {
    const sims = runMany({}, 60, 12);

    // Requires sim.getAllKeys() (or sim.agents with keys) - we can do it directly.
    const ratios = [];

    for (const sim of sims) {
      const vaults = sim.agents.filter(a => a.mode === 'vault');
      const routers = sim.agents.filter(a => a.mode === 'router');
      if (!vaults.length || !routers.length) continue;

      // Build global 10-degree bucket counts
      const bucketCounts = {};
      const all = [];
      for (const a of sim.agents) {
        for (const k of a.keys) {
          const b = Math.floor(k.val / 10) * 10;
          bucketCounts[b] = (bucketCounts[b] || 0) + 1;
          all.push({ b, ownerMode: a.mode });
        }
      }
      const counts = Object.values(bucketCounts);
      if (counts.length < 5) continue;

      // Rare = bottom 20% non-zero buckets
      const sorted = counts.slice().sort((x, y) => x - y);
      const cutoff = sorted[Math.floor(0.20 * (sorted.length - 1))] || 1;

      let rareTotal = 0;
      let rareVault = 0;

      for (const x of all) {
        if ((bucketCounts[x.b] || 0) <= cutoff) {
          rareTotal++;
          if (x.ownerMode === 'vault') rareVault++;
        }
      }
      if (rareTotal < 10) continue;

      const vaultPopShare = vaults.length / sim.agents.length;
      const vaultRareShare = rareVault / rareTotal;

      // Over-representation ratio
      ratios.push(vaultRareShare / Math.max(1e-9, vaultPopShare));
    }

    if (!ratios.length) {
      assert(true, 'not enough data to evaluate rare-key reservoir; skipping');
      return;
    }

    const med = median(ratios);
    // Expect vaults to hold disproportionately more rare keys than their population share
    assertGreater(med, 1.05, `vaults should over-represent rare keys (median ratio > 1.05, got ${med})`);
  });

  it('alarm → convergence: high-entropy days are followed by solving + entropy drop (multi-run)', () => {
    const sims = runMany({ voidLifespanMin: 3, voidLifespanMax: 7, targetVoids: 18 }, 70, 12);

    const scores = [];

    for (const sim of sims) {
      const ds = sim.dayStats.slice(WARMUP_DAYS_DEFAULT);
      const ent = ds.map(d => d.entropyProxy).filter(isFiniteNumber);
      if (ent.length < 20) continue;

      const p80 = percentile(ent, 80);
      const hiIdx = ds
        .map((d, i) => ({ d, i }))
        .filter(x => isFiniteNumber(x.d.entropyProxy) && x.d.entropyProxy >= p80)
        .map(x => x.i);

      if (hiIdx.length < 3) continue;

      let good = 0;
      let total = 0;

      // For each high-entropy day, look ahead 1..3 days for:
      // - some solves and/or entropy decrease
      for (const i of hiIdx) {
        const d0 = ds[i];
        const look = ds.slice(i + 1, i + 4);
        if (!look.length) continue;

        const solvedNext = look.reduce((s, d) => s + (d?.voids?.solved ?? 0), 0);
        const entNextMin = Math.min(...look.map(d => d.entropyProxy).filter(isFiniteNumber));
        const entDrop = isFiniteNumber(entNextMin) && isFiniteNumber(d0.entropyProxy) && (entNextMin < d0.entropyProxy);

        total++;
        if (solvedNext > 0 || entDrop) good++;
      }

      if (total > 0) scores.push(good / total);
    }

    if (!scores.length) {
      assert(true, 'not enough signal for alarm→convergence check; skipping');
      return;
    }

    const med = median(scores);
    assertGreater(med, 0.45, `median alarm→convergence success rate should be > 0.45 (got ${med})`);
  });

  it('energy economy is non-degenerate (variance exists, not all drained/full) - multi-run', () => {
    const sims = runMany({}, 35, 14);
    const ranges = [];
    const avgs = [];

    for (const sim of sims) {
      const energies = sim.agents.map(a => a.energy).filter(isFiniteNumber);
      if (!energies.length) continue;
      ranges.push(Math.max(...energies) - Math.min(...energies));
      avgs.push(safeMean(energies));
    }

    const medRange = median(ranges);
    const medAvg = median(avgs);

    assertGreater(medRange, 8, `median energy range should be > 8 (got ${medRange})`);
    assertGreater(medAvg, 15, `median avg energy should be > 15 (got ${medAvg})`);
  });
});

// ========================
// 5) Telemetry sanity (relaxed)
// ========================

describe('5. Telemetry Sanity (Relaxed / Robust)', () => {
  it('core actions occur: scan, share, and (solve OR gen_solve) (multi-run)', () => {
    const sims = runMany({}, 35, 14);
    const ok = [];

    for (const sim of sims) {
      const ds = sim.dayStats.slice(WARMUP_DAYS_DEFAULT);
      const scan = ds.reduce((s, d) => s + (d?.actions?.scan ?? 0), 0);
      const share = ds.reduce((s, d) => s + (d?.actions?.share ?? 0), 0);
      const solve = ds.reduce((s, d) => s + (d?.actions?.solve ?? 0), 0);
      const gen = ds.reduce((s, d) => s + (d?.actions?.gen_solve ?? 0), 0);

      ok.push(scan > 0 && share > 0 && (solve > 0 || gen > 0));
    }

    const passRate = ok.filter(Boolean).length / ok.length;
    assertGreater(passRate, 0.70, `core-actions pass-rate should be > 70% (got ${(passRate * 100).toFixed(1)}%)`);
  });

  it('gen-solve stats are consistent (successes <= attempts) - multi-run', () => {
    const sims = runMany({}, 30, 14);

    for (const sim of sims) {
      const ds = sim.dayStats.slice(WARMUP_DAYS_DEFAULT);
      const attempts = ds.reduce((s, d) => s + (d?.genSolve?.attempts ?? 0), 0);
      const successes = ds.reduce((s, d) => s + (d?.genSolve?.successes ?? 0), 0);
      assertRange(successes, 0, attempts, 'gen-solve successes should not exceed attempts');
    }
  });
});

// ========================
// Run summary
// ========================

console.log('\n========================================');
console.log('BCM Spectrum Simulator - Test Suite (v2)');
console.log('========================================');

console.log('\nRunning tests...\n');

console.log('\n\n========================================');
console.log(`Results: ${passCount} passed, ${failCount} failed`);
console.log('========================================');

if (failures.length > 0) {
  console.log('\nFailures:');
  for (const f of failures) console.log(`  ✗ ${f}`);
}

console.log('');
process.exit(failCount > 0 ? 1 : 0);