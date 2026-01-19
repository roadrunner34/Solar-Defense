# Solar Defense

A browser-based tower defense game set in space! Defend your planet from waves of enemies using your starbase's weapons.

## How to Play

### Running the Game

**Option 1: Using a Local Server (Recommended)**

Because the game uses ES6 modules, you need to run it from a local server. Here are some easy options:

```bash
# Using Python 3
python -m http.server 8000

# Using Node.js (if you have npx)
npx serve

# Using PHP
php -S localhost:8000
```

Then open `http://localhost:8000` in your browser.

**Option 2: Using VS Code Live Server**

If you have VS Code with the "Live Server" extension:
1. Right-click on `index.html`
2. Select "Open with Live Server"

### Controls

- **Escape**: Pause game
- **Mouse**: Rotate camera view (drag to orbit)
- **Scroll**: Zoom in/out

### Gameplay

1. Click "Start Game" to begin
2. Your starbase **automatically targets and fires** at the closest enemy
3. Watch as your defenses engage incoming enemies
4. Survive all 5 waves to win!

**Note:** This is a tower defense game - weapons aim and fire automatically! In later sprints, you'll be able to place additional weapon platforms strategically.

### Enemy Types

| Enemy | Color | Health | Speed | Worth |
|-------|-------|--------|-------|-------|
| Basic | Red | 100 | Normal | 10 credits |
| Fast | Yellow | 60 | Fast | 15 credits |
| Armored | Purple | 200 | Slow | 25 credits |

## Project Structure

```
Solar-Defense/
├── index.html          # Main HTML entry point
├── README.md           # This file
├── styles/
│   └── game.css        # Game styling
└── js/
    ├── main.js         # Game initialization, loop, and post-processing
    ├── config.js       # Game balance settings
    ├── scene.js        # Three.js scene setup with lensflare
    ├── camera.js       # Camera controls with shake effects
    ├── input.js        # Input handling
    ├── path.js         # Enemy path system
    ├── enemy.js        # Enemy management
    ├── starbase.js     # Player starbase with smooth targeting
    ├── projectile.js   # Projectile system with bloom effects
    ├── particles.js    # GPU particle system for explosions
    ├── mathUtils.js    # Animation utilities (damp, lerp, easing)
    ├── economy.js      # Credits and scoring
    └── ui.js           # User interface with GSAP animations
```

## Development

### Sprint Progress

- [x] **Sprint 0**: Project foundation and basic 3D scene
- [x] **Sprint 1**: MVP - Core gameplay loop with starbase and enemies
- [ ] **Sprint 2**: Deployable platform system
- [ ] **Sprint 3**: Upgrade system and economy
- [ ] **Sprint 4**: Level/wave system and difficulty scaling
- [ ] **Sprint 5**: Polish, effects, and advanced features

### Technologies Used

- **Three.js**: 3D graphics rendering
- **GSAP**: Professional animation library for UI transitions
- **HTML5 Canvas**: Rendering surface
- **ES6 Modules**: Modern JavaScript organization
- **CSS3**: UI styling and animations

## What's New in Sprint 1

- Complete 3D solar system scene with sun, planets, and asteroid field
- **Auto-targeting starbase** - automatically finds and shoots closest enemy
- Three enemy types with different behaviors (basic, fast, armored)
- Smooth enemy movement along curved paths
- Collision detection and damage system
- Health bars for enemies
- Credits and scoring system
- Win/lose conditions
- Wave progression (5 waves)
- Damage number popups
- Visual feedback (muzzle flash, hit effects)

## Visual Enhancements

The game features professional visual effects powered by modern Three.js libraries:

### Post-Processing Effects
- **Bloom/Glow**: Bright objects like the sun, projectiles, and explosions emit a beautiful glow
- **Vignette**: Subtle darkening at screen edges for a cinematic look
- **Color Grading**: Enhanced contrast and saturation with cool space tones

### Particle Effects
- **GPU Particle System**: Efficient shader-based particles for thousands of simultaneous particles
- **Enemy Explosions**: Color-coded particle bursts when enemies are destroyed
- **Muzzle Sparks**: Sparks spray when weapons fire
- **Trail Effects**: Particle trails for projectiles

### Animation & Feedback
- **Lensflare**: Cinematic lens flare on the sun
- **Camera Shake**: Impactful screen shake on explosions and damage
- **GSAP UI Animations**: Smooth, professional screen transitions and popups
- **Smooth Targeting**: Frame-rate independent turret rotation using damping
- **Animated Numbers**: Stats count up satisfyingly in wave summaries

### HDR-Style Rendering
- **Emissive Materials**: Objects use HDR color values (>1.0) for enhanced glow
- **ACES Filmic Tone Mapping**: Cinematic color processing

## Browser Support

Works best in modern browsers that support:
- WebGL 2.0
- ES6 Modules
- CSS Grid/Flexbox

Tested on: Chrome, Firefox, Edge

## License

MIT License - Feel free to use and modify!
