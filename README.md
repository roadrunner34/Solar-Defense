# Solar Defense

A browser-based tower defense game set in space. Defend your planet from waves of enemies using your starbase and a network of deployable weapon platforms.

Built with Three.js, no framework.

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

Click **Start Game**. Your starbase automatically targets and fires at the closest enemy in range — you don't aim it. Your job is to spend credits on weapon platforms and place them well.

Survive all 5 waves to win. A single enemy reaching the planet ends the run.

### Controls

| Input | Action |
|---|---|
| **Click a build menu button** | Enter placement mode for that platform |
| **`1`, `2`** | Shortcuts for the build menu, in listed order |
| **Move mouse** | Position the placement ghost |
| **Left click** | Place the platform (if the spot is valid and you can afford it) |
| **Right click** or **`Escape`** | Cancel placement |
| **`Escape`** | Pause (when not placing) |
| **Drag** | Orbit the camera |
| **Scroll** | Zoom in/out |

While placing, the ghost turns **green** where a platform can go and **red** where it can't, with a circle showing the weapon's range. If placement fails, the reason appears at your cursor.

### Weapon Platforms

Platforms are bought with credits and defend the spot you put them. They acquire and fire at targets on their own.

| Platform | Cost | Damage | Range | Fire Rate | Turn Speed |
|---|---|---|---|---|---|
| Laser Battery | 50 | 20 | 80 | 1.2/sec | Fast |
| Missile Launcher | 100 | 40 | 100 | 0.8/sec | Slow |

The two are deliberately opposed. The Laser Battery is cheap and quick to track, so it handles fast enemies. The Missile Launcher hits roughly twice as hard at longer range, but turns slowly enough that fast enemies can outrun its aim — which is what makes mixing the two worthwhile.

Placement rules: at least 15 units from the planet, no more than 70 units out, and at least 10 units from another platform.

### Enemy Types

| Enemy | Shape | Colour | Health | Speed | Armour | Worth |
|---|---|---|---|---|---|---|
| Basic | Octahedron | Red | 100 | 5/sec | 0 | 10 credits |
| Fast | Tetrahedron | Yellow | 60 | 10/sec | 0 | 15 credits |
| Armored | Dodecahedron | Purple | 200 | 3/sec | 10 | 25 credits |

Armour subtracts from each incoming hit, so many weak shots fare badly against Armored enemies — a Laser Battery's 20 damage lands as 10, while a Missile Launcher's 40 lands as 30.

Enemies approach along one of three curved paths, chosen at random. All three take the same world speed, so an enemy's path doesn't change how fast it travels.

## Project Structure

```
Solar-Defense/
├── index.html            # Entry point and HUD markup
├── vite.config.js        # Dev server, build, and test config
├── styles/
│   └── game.css          # HUD, screens, and build menu styling
├── js/
│   ├── main.js           # Initialization, game loop, wave progression, post-processing
│   ├── config.js         # All game balance values
│   ├── scene.js          # Sun, planet, asteroids, starfield, lighting
│   ├── camera.js         # Orbit controls and camera shake
│   ├── input.js          # Mouse and keyboard, placement input
│   ├── path.js           # Enemy approach paths (Catmull-Rom splines)
│   ├── enemy.js          # Enemy spawning, movement, damage, health bars
│   ├── starbase.js       # The player's central auto-targeting weapon
│   ├── platform.js       # Deployable platforms: placement, combat, economy
│   ├── turret.js         # Aiming logic shared by the starbase and platforms
│   ├── projectile.js     # Projectile movement and collision
│   ├── particles.js      # Pooled GPU particle systems
│   ├── effects.js        # Short-lived visuals, stepped by the game loop
│   ├── economy.js        # Credits, score, accuracy
│   ├── mathUtils.js      # Damping, easing, interpolation
│   └── ui.js             # HUD, screens, build menu, floating text
└── tests/                # Vitest suite (see tests/README.md)
```

## Development

### Testing

```bash
npm test
```

153 tests across 10 files. Most run in Vitest's `node` environment; files needing a DOM opt in with a `// @vitest-environment jsdom` docblock. See [tests/README.md](tests/README.md).

### Sprint Progress

- [x] **Sprint 0**: Project foundation and basic 3D scene
- [x] **Sprint 1**: MVP — core gameplay loop with starbase and enemies
- [x] **Sprint 2**: Deployable platform system — placement, combat, economy, build menu
- [ ] **Sprint 3**: Upgrade system and economy depth
- [ ] **Sprint 4**: Level/wave system and difficulty scaling
- [ ] **Sprint 5**: Polish, effects, and advanced features

Sprint 2's remaining work is tracked in `.cursor/plans/sprint_2_atomized_tasks_95aa8dfb.plan.md`: clicking an existing platform to select and sell it (`sellPlatform()` exists and is tested, but nothing in the UI calls it yet), missile-type projectiles with their own visuals, per-platform statistics, and a formal performance pass with 10+ platforms.

### Technologies

- **Three.js** (0.186) — 3D rendering
- **GSAP** — UI animation
- **Vite** — dev server and bundler
- **Vitest** — test runner
- **ES Modules**, **CSS3**

## Visual Effects

### Post-Processing

Rendering runs through an `EffectComposer` chain: scene render → bloom → a custom vignette and colour-grading shader → output pass. Bright objects use HDR colour values above 1.0 so the bloom pass picks them up, which is what makes lasers, explosions and the sun glow. Tone mapping is ACES Filmic.

### Particles

Explosions and muzzle sparks come from pooled `THREE.Points` systems with a custom shader, giving per-particle size, alpha and colour. Enemy deaths are colour-coded by type, and simultaneous explosions keep their own colours.

### Other

- Lens flare on the sun
- Camera shake on explosions and on losing the planet, applied without disturbing your camera orbit
- GSAP screen transitions, damage numbers and wave summaries with counting stats
- Frame-rate independent turret tracking and effect animation

## Browser Support

Needs WebGL 2.0 and ES module support. Tested on Chrome, Firefox and Edge.

## License

MIT — feel free to use and modify.
