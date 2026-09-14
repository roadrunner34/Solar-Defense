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
├── config.test.js      # CONFIG contents and the get*Config() helpers
├── economy.test.js     # credits, score, accuracy, wave bonuses
├── mathUtils.test.js   # damping, easing, clamping
├── path.test.js        # enemy path geometry and travel speed
└── platform.test.js    # platform creation, placement rules, combat
```

## Environment

Tests default to Vitest's `node` environment — most of the game's logic is
pure and needs no DOM. Three.js scene construction works headless too, because
`createFlareTexture()` returns a blank texture when no 2D canvas context is
available.

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
