# Solar Defense

A browser-based tower defense game set in space. Defend your planet from waves of enemies using your starbase and a network of deployable weapon platforms.

Built with Three.js, no framework, and no asset files — every texture in the game is generated on a `<canvas>` at load time.

## Getting Started

```bash
npm install
npm run dev
```

Then open the URL Vite prints (by default <http://localhost:5173>).

| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server with hot reload |
| `npm run build` | Bundle to `dist/` for deployment |
| `npm run preview` | Serve the production bundle locally |
| `npm test` | Run the test suite once |
| `npm run test:watch` | Re-run tests on change |

## How to Play

Click **Start Game**. Your starbase automatically targets and fires at the closest enemy in range — you don't aim it. Your job is to spend credits on weapon platforms, place them well, and decide what to upgrade.

Your planet has **three points of integrity**. Every enemy that reaches it costs one and flares the shield; at zero, the run ends. Clearing all five waves wins the campaign, and you can then choose to hold the line indefinitely against generated waves.

### Controls

| Input | Action |
|---|---|
| **Click a build menu button** | Enter placement mode for that platform |
| **`1`, `2`** | Shortcuts for the build menu, in listed order |
| **Move mouse** | Position the placement ghost |
| **Left click** | Place the platform, or select a placed one |
| **Right click** or **`Escape`** | Cancel placement |
| **`Escape`** | Close the selection panel, then pause |
| **Drag** | Orbit the camera |
| **Scroll** | Zoom in/out |
| **`F`** | Toggle the frame-time readout |
| **`G`** | Cycle graphics quality manually |

While placing, the ghost turns **green** where a platform can go and **red** where it can't, with a circle showing the weapon's range. If placement fails, the reason appears at your cursor.

### Selecting and upgrading

Click any placed platform — or the starbase itself — to open its panel. It shows live stats, lifetime kills, shots fired and damage dealt, plus its coverage as a ring on the orbital plane.

Each structure can take three tiers of **Damage**, **Range** and **Fire rate**. Costs scale from the structure's build cost and climb steeply, so a third tier on one platform costs roughly what a second tier on two would — which is the choice you're actually being asked to make. Upgraded platforms glow hotter, so you can see from across the map where your credits went.

Selling refunds **50% of the build cost plus 50% of everything spent upgrading it**, so repositioning an investment is a real option rather than a write-off.

### Weapon Platforms

| Platform | Cost | Damage | Range | Fire Rate | Turn Speed | Ordnance |
|---|---|---|---|---|---|---|
| Laser Battery | 50 | 20 | 80 | 1.2/sec | Fast | Laser |
| Missile Launcher | 100 | 40 | 100 | 0.8/sec | Slow | Missile |

The two are deliberately opposed, and now genuinely behave differently rather than firing the same bolt:

- **Lasers** fly straight along a fixed heading and put all their damage into the first thing they touch. Cheap, quick to track, and precise — the answer to a single fast runner.
- **Missiles** steer toward their target in flight and detonate, spreading damage across everything within 7 units with falloff. Slow to turn, so a fast enemy can outrun their aim, but devastating against a cluster.

Placement rules: at least 15 units from the planet, no more than 70 units out, and at least 10 units from another platform.

### Enemy Types

| Enemy | Shape | Colour | Health | Speed | Armour | Worth |
|---|---|---|---|---|---|---|
| Basic | Octahedron | Red | 100 | 5/sec | 0 | 10 credits |
| Fast | Tetrahedron | Yellow | 60 | 10/sec | 0 | 15 credits |
| Armored | Dodecahedron | Purple | 200 | 3/sec | 10 | 25 credits |

Armour subtracts from each incoming hit, so many weak shots fare badly against Armored enemies — a Laser Battery's 20 damage lands as 10, while a Missile Launcher's 40 lands as 30.

Enemies approach along one of three curved paths, chosen at random. All three take the same world speed, so an enemy's path doesn't change how fast it travels.

### Waves

Waves 1–5 are hand-authored in `config.js`. Past that the game generates waves on a continuous difficulty ramp — enemy counts climb steadily and spawn spacing tightens toward a floor, rather than the step function the original generator used. Your best run (deepest wave, then highest score) is saved locally and shown on the start screen.

## Project Structure

```
Solar-Defense/
├── index.html            # Entry point and HUD markup
├── vite.config.js        # Dev server, build, and test config
├── styles/
│   └── game.css          # Design tokens, HUD, screens, responsive layout
├── js/
│   ├── main.js           # Initialization, game loop, waves, integrity
│   ├── config.js         # All game balance values
│   ├── postprocessing.js # Composer chain, colour grade, quality tiers
│   ├── scene.js          # Sun, planet, shield, belt, backdrop, lighting
│   ├── textures.js       # Procedural canvas textures and noise
│   ├── environment.js    # Image-based lighting (PMREM)
│   ├── materials.js      # Shared hull and enemy material factories
│   ├── camera.js         # Orbit controls and camera shake
│   ├── input.js          # Mouse and keyboard, placement, click-vs-drag
│   ├── selection.js      # Clicking platforms and the starbase
│   ├── upgrade.js        # Upgrade tiers, costs and investment
│   ├── path.js           # Enemy approach paths (Catmull-Rom splines)
│   ├── enemy.js          # Enemy spawning, movement, damage, health bars
│   ├── starbase.js       # The player's central auto-targeting weapon
│   ├── platform.js       # Deployable platforms: placement, combat, economy
│   ├── turret.js         # Aiming logic shared by the starbase and platforms
│   ├── projectile.js     # Lasers, homing missiles, splash damage
│   ├── particles.js      # Pooled GPU particle systems
│   ├── effects.js        # Short-lived visuals, stepped by the game loop
│   ├── economy.js        # Credits, score, accuracy, best-run persistence
│   ├── mathUtils.js      # Damping, easing, interpolation
│   └── ui.js             # HUD, screens, build menu, selection panel
└── tests/                # Vitest suite (see tests/README.md)
```

## Development

### Testing

```bash
npm test
```

227 tests across 13 files. Most run in Vitest's `node` environment; files needing a DOM opt in with a `// @vitest-environment jsdom` docblock. See [tests/README.md](tests/README.md).

### Sprint Progress

- [x] **Sprint 0**: Project foundation and basic 3D scene
- [x] **Sprint 1**: MVP — core gameplay loop with starbase and enemies
- [x] **Sprint 2**: Deployable platform system — placement, combat, economy, build menu, selection, selling, missile ordnance
- [x] **Sprint 3**: Upgrade system and economy depth
- [x] **Sprint 4**: Wave scaling, endless mode, planet integrity, persistence
- [ ] **Sprint 5**: Audio, and further advanced features

Audio remains the one substantial gap — the game is silent. Everything else from the original Sprint 5 list (visual effects, animation, UI polish, performance work, tutorial hints) is done.

### Technologies

- **Three.js** (0.186) — 3D rendering
- **GSAP** — UI animation
- **Vite** — dev server and bundler
- **Vitest** — test runner
- **ES Modules**, **CSS3**

## Rendering

### The pipeline

`js/postprocessing.js` owns the whole chain:

```
RenderPass → UnrealBloomPass → OutputPass → GradePass
```

Two things about that order are load-bearing. **Bloom runs before tone mapping**, because Three.js skips a material's tone mapping whenever it renders into a render target — so colours stay linear and unclamped through the composer. That's what lets a laser be `Color(0, 2.4, 3.1)` and actually glow: the bloom pass can see the 2.4. **The colour grade runs after tone mapping**, because contrast that pivots around 0.5 and saturation measured against a luminance constant are display-referred operations that mean nothing on raw HDR values.

The composer is handed a render target built with `samples: 4`. Without that there is no antialiasing at all: `new WebGLRenderer({ antialias: true })` only configures the canvas's own framebuffer, and the moment you render through an `EffectComposer` the scene goes somewhere else.

### Materials and lighting

Everything is `MeshStandardMaterial` lit by an environment map generated at startup in `js/environment.js` — a throwaway scene of a hot sphere, a cool fill and a dark surround, captured to a cubemap by `PMREMGenerator`. PBR metal takes nearly all of its appearance from what it reflects, so without an environment the hulls render as flat dead grey; the environment map is what makes them read as metal.

There are only two lights: the star, and one hemisphere light acting as a rim. The environment supplies the ambient term with direction, so no `AmbientLight` is needed. Shadow maps are deliberately off — a space scene has no ground plane for a shadow to fall on.

### Procedural textures

`js/textures.js` generates every surface at load time: the planet's continents, elevation, roughness and night-side city lights from shared noise fields; cloud bands; asteroid grit; hull plating with panel seams and wear; star sprites; and the nebula backdrop. Noise is sampled in 3D against each pixel's direction on the sphere, which avoids both the seam where longitude wraps and the pinching at the poles.

Every factory returns a blank texture when there's no 2D canvas context, so the scene builds headless under Vitest.

### Effects

- Animated plasma shader on the star, with limb darkening, plus a corona and a lensflare
- A fresnel atmosphere on the planet, and a shield bubble that flares at the point of impact and visibly destabilises as integrity drops
- Pooled `THREE.Points` particle systems with a custom shader for explosions, sparks and trails
- Projectile trails, missile exhaust and enemy thruster wakes
- Camera shake and hit-stop on kills, applied through the timescale so everything slows together
- GSAP screen transitions, damage numbers and counting wave summaries
- An instanced asteroid belt — one draw call for the whole field

### Performance

Press **F** for a live readout of frame rate, frame time, quality tier, enemy count and draw calls. Quality tiers (`high`/`medium`/`low`) are chosen from the device at startup and stepped down automatically by a frame-time watchdog; **G** cycles them by hand.

A full board of 13 platforms on wave 5 holds 60 fps at ~132 draw calls on the high tier.

## Accessibility

- Layout is responsive down to phone width, with the HUD restacking at 700px
- `prefers-reduced-motion` is honoured by both the stylesheet and the GSAP sequences
- Critical planet integrity is signalled by a pulse as well as a colour change
- Visible focus rings on every interactive control

## Browser Support

Needs WebGL 2.0 and ES module support. Tested on Chrome, Firefox and Edge.

## License

MIT — feel free to use and modify.
