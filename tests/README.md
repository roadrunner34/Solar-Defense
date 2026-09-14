# Tests

Automated tests for Solar Defense, run with [Vitest](https://vitest.dev/).

## Running

```bash
npm test         # run once
npm run test:watch   # re-run on change
```

## Layout

```
tests/
├── config.test.js           # CONFIG contents, helpers, endless wave ramp
├── economy.test.js          # credits, score, accuracy, best-run persistence
├── effects.test.js          # the step-driven effect scheduler
├── enemy.test.js            # spawning, movement, damage, health bars
├── mathUtils.test.js        # damping, easing, clamping
├── particles.test.js        # pool recycling
├── path.test.js             # enemy path geometry and travel speed
├── platform.test.js         # creation, placement rules, overlap
├── platform-combat.test.js  # targeting, firing, economy, selling
├── projectile.test.js       # laser vs missile, homing, splash damage
├── textures.test.js         # procedural noise and the headless fallback
├── ui.test.js               # HUD and build menu
└── upgrade.test.js          # tiers, costs, investment
```

## Environment

Tests default to Vitest's `node` environment — most of the game's logic is
pure and needs no DOM. Three.js scene construction works headless too: every
texture factory in `textures.js` returns a blank texture when there is no 2D
canvas context, as does the lensflare texture in `scene.js`. `textures.test.js`
guards that fallback specifically, since four other files rely on it to be able
to build a scene at all.

A file that genuinely needs a DOM (anything touching `document`, such as the
enemy health bars) opts in with a docblock on its first line:

```js
// @vitest-environment jsdom
```

## Conventions

- One spec per source module, named `<module>.test.js`.
- Use `describe` / `it` / `expect`; no hand-rolled pass/fail counters.
- Modules holding state at module scope (`economy.js`, `platform.js`) must be
  reset in `beforeEach` so tests don't depend on execution order.
- When fixing a bug, add the failing case first and name the test after the
  behaviour, not the bug number.
