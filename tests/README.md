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
├── audio.test.js            # synth recipes, voice cap, cooldowns, panning
├── boss.test.js             # boss schedule, scaling, resistance, HUD bar
├── config.test.js           # CONFIG contents, helpers, endless wave ramp
├── economy.test.js          # credits, score, accuracy, best-run persistence
├── effects.test.js          # the step-driven effect scheduler
├── enemy.test.js            # spawning, movement, damage, health bars
├── mathUtils.test.js        # damping, easing, clamping
├── music.test.js            # the drone's intensity curve and voice thresholds
├── particles.test.js        # pool recycling
├── path.test.js             # enemy path geometry and travel speed
├── platform.test.js         # creation, placement rules, overlap
├── platform-combat.test.js  # targeting, firing, economy, selling
├── postprocessing.test.js   # quality tier selection and the watchdog
├── projectile.test.js       # laser vs missile, homing, splash damage
├── settings.test.js         # validation, persistence, change notifications
├── settings-screen.test.js  # the settings UI and where Back returns to
├── status.test.js           # slows, armour shred, and the Gravity Well
├── targeting.test.js        # the four targeting priorities
├── textures.test.js         # procedural noise and the headless fallback
├── ui.test.js               # HUD and build menu
├── upgrade.test.js          # tiers, costs, investment
└── helpers/
    └── fakeAudioContext.js  # shared Web Audio stand-in (not a spec)
```

## Environment

Tests default to Vitest's `node` environment — most of the game's logic is
pure and needs no DOM. Three.js scene construction works headless too: every
texture factory in `textures.js` returns a blank texture when there is no 2D
canvas context, as does the lensflare texture in `scene.js`. `textures.test.js`
guards that fallback specifically, since four other files rely on it to be able
to build a scene at all.

A file that genuinely needs a DOM (anything touching `document`, such as the
enemy health bars, or `localStorage`, such as the settings store) opts in with
a docblock on its first line:

```js
// @vitest-environment jsdom
```

There is no Web Audio API in either environment. `audio.js` is written to
degrade silently when there is no `AudioContext` — `audio.test.js` guards that
specifically, since every other spec imports a module chain that reaches it.
Tests that need a working audio graph install the stand-in from
`helpers/fakeAudioContext.js`, which records what it was asked to build and
produces no sound. Its mocks are written as `function () {}` rather than arrows
because an arrow cannot be called with `new`.

## Conventions

- One spec per source module, named `<module>.test.js`.
- Use `describe` / `it` / `expect`; no hand-rolled pass/fail counters.
- Modules holding state at module scope (`economy.js`, `platform.js`) must be
  reset in `beforeEach` so tests don't depend on execution order.
- When fixing a bug, add the failing case first and name the test after the
  behaviour, not the bug number.
