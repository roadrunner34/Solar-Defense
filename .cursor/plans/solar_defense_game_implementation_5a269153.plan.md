---
name: Solar Defense Game Implementation (Agile Sprint Plan)
overview: Build a browser-based tower defense game using Three.js in iterative sprints. Each sprint delivers a playable increment with built-in feedback loops for continuous improvement.
todos:
  - id: sprint-0-setup
    content: "Sprint 0: Project foundation and basic 3D scene"
    status: completed
  - id: sprint-1-mvp
    content: "Sprint 1: MVP - Core gameplay loop with starbase and enemies"
    status: completed
  - id: sprint-2-platforms
    content: "Sprint 2: Deployable platform system"
    status: pending
  - id: sprint-3-progression
    content: "Sprint 3: Upgrade system and economy"
    status: pending
  - id: sprint-4-levels
    content: "Sprint 4: Level/wave system and difficulty scaling"
    status: pending
  - id: sprint-5-polish
    content: "Sprint 5: Polish, effects, and advanced features"
    status: pending
---

# Solar Defense Game - Agile Sprint Plan

## Agile Methodology Overview

This plan follows an iterative sprint-based approach where each sprint delivers a **playable, testable increment**. After each sprint, we'll gather feedback, identify improvements, and incorporate rework into the next sprint. This ensures the game evolves based on real playtesting rather than assumptions.

### Sprint Structure

- **Duration**: 1-2 weeks per sprint
- **Sprint Goal**: Clear, measurable objective
- **User Stories**: Features from player perspective
- **Definition of Done**: Working, testable features
- **Sprint Review**: Playtesting and feedback collection
- **Sprint Retrospective**: Identify improvements for next sprint
- **Rework Buffer**: 20-30% of sprint time allocated for refinements

### Feedback Loops

- **Daily**: Quick playtests during development
- **Sprint End**: Formal playtesting session with feedback forms
- **Continuous**: Code reviews and pair programming opportunities

---

## Reality Check (Current Build vs Plan)

This plan is a living document. The current codebase already includes:

- [x] **Auto-targeting starbase** (classic tower-defense style: weapons aim/fire automatically)
- [x] **Wave progression** (5 waves, wave announcements + wave summary)
- [x] **Credits + score + accuracy tracking**
- [x] **Three enemy types** (basic/fast/armored) with health bars + damage feedback

Because of that, **Sprint 4 should be treated as “multi-level campaign + difficulty curve iteration”** (not “first time we add waves”).

---

## Sprint 0: Foundation & Scene Setup

**Duration**: 3-5 days

**Goal**: Establish project structure and render a basic 3D solar system scene

### User Stories

- As a developer, I need a working Three.js setup so I can build game features
- As a player, I want to see a beautiful solar system backdrop so the game feels immersive

### Tasks

1. **Project Setup** ([index.html](index.html), [js/main.js](js/main.js))

   - Create HTML entry point with Three.js CDN
   - Set up basic file structure
   - Initialize WebGL renderer and canvas

2. **Scene Foundation** ([js/scene.js](js/scene.js))

   - Create Three.js scene, camera, and renderer
   - Set up basic lighting (ambient + directional)
   - Implement render loop with requestAnimationFrame

3. **Solar System Backdrop** ([js/scene.js](js/scene.js))

   - Create sun (central light source)
   - Add home planet at center
   - Add 2-3 other planets in orbit
   - Add asteroid field (simple geometry)
   - Create orbital rings/indicators

4. **Camera System** ([js/camera.js](js/camera.js))

   - Set up orbital camera controls
   - Configure camera position and zoom
   - Add basic camera movement

5. **Basic UI Shell** ([js/ui.js](js/ui.js), [styles/game.css](styles/game.css))

   - Create minimal HUD container
   - Basic styling and layout
   - Placeholder for future UI elements

### Definition of Done

- [x] Game loads in browser without errors
- [x] 3D scene renders with sun, planets, and asteroids
- [x] Camera can be rotated/zoomed
- [ ] 60 FPS performance on target hardware (verify on target devices)
- [x] Code is organized in modules
- [x] README updated with setup instructions

### Sprint Review Focus

- Visual appeal of solar system
- Camera controls feel natural
- Performance is acceptable
- Code structure is maintainable

### Potential Rework Areas

- Adjust planet sizes/positions for better gameplay visibility
- Refine camera controls based on feel
- Optimize scene complexity if performance issues

---

## Sprint 1: MVP - Core Gameplay Loop

**Duration**: 1-2 weeks

**Goal**: Deliver a playable game where players can defend against enemies using the starbase

### Core Game Rules

- **Win Condition**: Survive waves by killing all enemies in each wave
- **Lose Condition**: Enemy reaches the planet (starbase destroyed)
- **Economy**: Guaranteed starting credits + credits earned per enemy kill
- **Weapons**: Starbase (and later platforms) auto-target and auto-fire (tower defense core)
- **Enemy Behavior (future feature)**: Enemies may attack fighters (if fighter stations exist) but do NOT attack stations or weapon platforms

### User Stories

- As a player, I want to control a starbase to shoot enemies so I can defend my planet
- As a player, I want enemies to move along a path so the game has clear objectives
- As a player, I want to see my shots hit enemies so I get feedback on my actions
- As a player, I want enemies to be destroyed when I hit them so I feel progress
- As a player, I want to see my score and progress so I know how well I'm doing
- As a player, I want clear visual feedback when I hit enemies so the game feels responsive

### Tasks

1. **Path System** ([js/path.js](js/path.js))

   - Define waypoint arrays for enemy paths
   - Create path that curves around planets/sun
   - Visual path indicator (optional toggle)
   - Path interpolation for smooth movement

2. **Enemy System** ([js/enemy.js](js/enemy.js))

   - Enemy class with health, speed, position, armor, credit value
   - Spawn enemies at path start
   - Move enemies along path using interpolation
   - Simple visual representation (geometry)
   - Remove enemies at path end or when destroyed
   - Enemy AI: Target fighters (if fighter stations exist), ignore stations/platforms
   - Health bar display above enemies
   - Color coding for enemy types (if multiple types in MVP)

3. **Main Starbase** ([js/starbase.js](js/starbase.js))

   - Create starbase at scene center
   - Auto-target closest enemy in range
   - Auto-fire system (based on fire rate)
   - Visual cannon/weapon representation

4. **Input Handling** ([js/input.js](js/input.js))

   - Camera input (orbit + zoom)
   - Input state management

5. **Combat System** ([js/projectile.js](js/projectile.js))

   - Projectile class (laser beam)
   - Spawn projectiles from starbase
   - Collision detection (projectile vs enemy)
   - Damage calculation (damage vs health/armor)
   - Remove projectiles on hit or out of bounds
   - Visual hit feedback (sparks, screen shake on impact)
   - Damage number display (floating text on hit)

6. **Game Loop** ([js/main.js](js/main.js))

   - Initialize all systems
   - Update loop: enemies, projectiles, collisions
   - Render loop: scene + UI
   - Game state management (menu, playing, paused, victory, defeat)
   - Win condition check: All enemies killed = wave complete
   - Lose condition check: Enemy reaches planet = game over

7. **Basic UI** ([js/ui.js](js/ui.js))

   - Enemy count display (remaining in current wave)
   - Score display (points for kills, accuracy bonus)
   - Credit display (starting credits + earned credits)
   - Health bar for enemies (when in range)
   - Victory screen (when all enemies killed)
   - Defeat screen (when enemy reaches planet)
   - Restart functionality
   - Basic tutorial tooltips (first-time player hints)

8. **Economy System** ([js/economy.js](js/economy.js))

   - Credit system with guaranteed starting credits per level
   - Credit rewards per enemy kill (varies by enemy type)
   - Credit accumulation and display
   - Economy balance formulas (documented in config)
   - Credit carryover between levels (if applicable)

### Definition of Done

- [x] Starbase auto-targets enemies and fires automatically
- [x] Enemies spawn and follow path
- [x] Projectiles hit and destroy enemies
- [x] Win condition: Clear all waves = victory
- [x] Lose condition: Enemy reaches planet = defeat
- [x] Credits system works (starting credits + kill rewards + wave bonuses)
- [x] Score system tracks kills and accuracy
- [x] Visual feedback on hits (damage numbers, hit effects, muzzle flash)
- [x] Enemy health bars visible
- [x] Victory/defeat/pause screens display correctly
- [x] Game is playable end-to-end (start → waves → win/lose)
- [x] No major bugs or crashes (basic stability)

### Sprint Review Focus

- **Gameplay Feel**: Is shooting satisfying?
- **Difficulty**: Too easy/hard?
- **Controls**: Are they intuitive?
- **Visual Clarity**: Can player see what's happening?
- **Fun Factor**: Is the core loop engaging?

### Potential Rework Areas

- Adjust enemy speed/health for better balance
- Refine starbase rotation sensitivity
- Improve projectile visuals
- Tune auto-fire rate
- Adjust credit rewards for economy balance
- Refine visual feedback intensity
- Tune damage numbers display timing

---

## Sprint 2: Deployable Platform System

**Duration**: 1-2 weeks

**Goal**: Players can deploy and manage multiple weapon platforms

### User Stories

- As a player, I want to place weapon platforms so I can defend multiple angles
- As a player, I want platforms to auto-target enemies so I can focus on strategy
- As a player, I want to see where I can place platforms so placement is clear
- As a player, I want different platform types so I have strategic choices

### Tasks

1. **Platform Base System** ([js/tower.js](js/tower.js), [js/platform.js](js/platform.js))

   - Base tower/platform class
   - Platform types: Laser Battery (basic), Missile Launcher
   - Platform stats: damage, range, fire rate, cost

2. **Placement System** ([js/platform.js](js/platform.js))

   - Define valid placement locations (grid or free-form)
   - Placement validation (no overlapping, valid positions, minimum distance between platforms)
   - Visual placement indicator (ghost/preview)
   - Range visualization when placing (show attack range)
   - Click to place platform
   - Platform selling/removal system (refund partial cost)

3. **Platform Targeting** ([js/platform.js](js/platform.js))

   - Find nearest enemy in range
   - Rotate platform to face target
   - Fire projectiles at target
   - Handle target lost (enemy dies or leaves range)

4. **Platform UI** ([js/ui.js](js/ui.js))

   - Build menu (platform types and costs)
   - Platform selection (click to select)
   - Range indicator when platform selected
   - Cost display and validation

5. **Economy Foundation** ([js/economy.js](js/economy.js))

   - Credit system with guaranteed starting credits per level
   - Platform costs (documented in config)
   - Credit display in UI
   - Prevent placement if insufficient credits
   - Platform selling with refund system (e.g., 50% refund)
   - Economy balance validation

6. **Projectile Types** ([js/projectile.js](js/projectile.js))

   - Extend projectile system for different types
   - Laser (instant hit)
   - Missile (traveling projectile)

### Definition of Done

- [ ] Player can place platforms at valid locations
- [ ] Platforms auto-target and fire at enemies
- [ ] Different platform types have distinct behaviors
- [ ] Credit system prevents unlimited building
- [ ] Platform range visualization when placing
- [ ] Platform selling/removal works with refunds
- [ ] UI clearly shows placement options and costs
- [ ] Platforms work alongside starbase
- [ ] Minimum distance between platforms enforced

### Sprint Review Focus

- **Strategy**: Does placement matter?
- **Balance**: Are platform costs fair?
- **Clarity**: Is placement system intuitive?
- **Variety**: Do platform types feel different?
- **Performance**: Does game run smoothly with multiple platforms?

### Potential Rework Areas

- Adjust platform costs for balance
- Refine placement grid/valid locations
- Tune platform range and damage
- Improve platform visual distinction
- Add more platform types if requested

---

## Sprint 3: Upgrade System & Economy

**Duration**: 1-2 weeks

**Goal**: Players can earn credits and upgrade their defenses

### User Stories

- As a player, I want to earn credits from killing enemies so I can improve my defenses
- As a player, I want to upgrade my platforms so I can handle harder challenges
- As a player, I want to see upgrade options so I can make informed decisions
- As a player, I want upgrade costs to scale so the game has progression

### Tasks

1. **Credit Rewards** ([js/enemy.js](js/enemy.js), [js/economy.js](js/economy.js))

   - Enemies drop credits on death
   - Credit values per enemy type (documented in config)
   - Credit accumulation and display
   - Credit carryover between levels (if applicable)
   - Economy scaling formulas (rewards scale with difficulty)

2. **Upgrade System** ([js/upgrade.js](js/upgrade.js))

   - Upgrade tree structure
   - Stats to upgrade: damage, range, fire rate
   - Upgrade levels (Tier 1, 2, 3)
   - Cost scaling per upgrade level

3. **Upgrade UI** ([js/ui.js](js/ui.js))

   - Upgrade panel (opens when platform selected)
   - Display current stats and upgrade options
   - Show upgrade costs
   - Upgrade preview (show stat changes before purchasing)
   - Visual feedback on upgraded platforms
   - Upgrade confirmation with before/after stats

4. **Starbase Upgrades** ([js/starbase.js](js/starbase.js))

   - Extend starbase with upgrade system
   - Upgradeable: damage, fire rate, rotation speed
   - Upgrade UI integration

5. **Economy Balance** ([js/economy.js](js/economy.js))

   - Tune credit rewards vs costs
   - Ensure progression feels rewarding
   - Prevent economy breaking (too easy/hard)
   - Document economy formulas in config file
   - Credit carryover system between levels
   - Starting credit amounts per level documented

6. **Visual Feedback** ([js/platform.js](js/platform.js), [js/starbase.js](js/starbase.js))

   - Visual indicators for upgraded platforms
   - Stats display on selection
   - Upgrade confirmation feedback

### Definition of Done

- [ ] Enemies drop credits when destroyed
- [ ] Player can upgrade platform stats
- [ ] Upgrade costs scale appropriately
- [ ] UI clearly shows upgrade options and costs
- [ ] Economy feels balanced (not too easy/hard)
- [ ] Upgrades provide noticeable improvements

### Sprint Review Focus

- **Progression**: Does upgrading feel rewarding?
- **Balance**: Is economy well-tuned?
- **Clarity**: Are upgrade options clear?
- **Strategy**: Do upgrade choices matter?
- **Pacing**: Is credit earning rate appropriate?

### Potential Rework Areas

- Rebalance credit rewards and costs
- Adjust upgrade stat improvements
- Refine upgrade UI for clarity
- Add more upgrade options if needed
- Tune economy for better pacing

---

## Sprint 4: Level & Wave System

**Duration**: 1-2 weeks

**Goal**: Implement multiple levels with increasing difficulty

### User Stories

- As a player, I want multiple waves so the game has progression
- As a player, I want difficulty to increase so the game stays challenging
- As a player, I want to see wave progress so I know how I'm doing
- As a player, I want different enemy types so gameplay has variety

### Tasks

1. **Campaign / Level System (builds on existing waves)** ([js/level.js](js/level.js))

   - Expand from “one run = 5 waves” to **multiple levels**, each with its own wave set
   - Level configuration (paths used, wave configs, modifiers)
   - Clear “level complete” and “campaign complete” states

2. **Level System** ([js/level.js](js/level.js))

   - Multiple levels with different configurations
   - Level selection/unlocking
   - Level-specific paths and enemy patterns
   - Level completion conditions

3. **Difficulty Scaling** ([js/level.js](js/level.js), [js/enemy.js](js/enemy.js))

   - Increase enemy health per wave/level
   - Increase enemy speed
   - Increase enemy count
   - Vary spawn timing

4. **Enemy Variety** ([js/enemy.js](js/enemy.js))

   - Different enemy types (fast, armored, normal)
   - Different visual representations (color coding, size)
   - Different credit values (scaled by difficulty)
   - Different health/armor values
   - Enemy AI: Attack fighters (if fighter stations exist), ignore platforms/stations
   - Enemy formations/group behavior (optional)

5. **Level UI** ([js/ui.js](js/ui.js))

   - Wave progress indicator (enemies remaining, wave number)
   - Level name/number display
   - Next wave countdown (if applicable)
   - Wave preview (show upcoming wave composition)
   - Level complete screen with rewards (bonus credits, score)
   - Level select menu
   - Story progression display (narrative elements)

6. **Game State Management** ([js/main.js](js/main.js))

   - Level transitions with story elements
   - Victory/defeat conditions (kill all enemies = win)
   - Restart level functionality
   - Save progress (localStorage: level unlocked, credits, stats)
   - Level unlocking system
   - Statistics tracking (kills, accuracy, levels completed)

### Definition of Done

- [ ] Multiple waves spawn per level
- [ ] Win condition: Kill all enemies in wave = wave complete
- [ ] Difficulty increases across waves/levels
- [ ] Different enemy types are distinguishable (visual and behavioral)
- [ ] Level progression works (complete → next level unlocked)
- [ ] UI shows wave/level progress clearly
- [ ] Level rewards system (bonus credits on completion)
- [ ] Story elements integrated (intro text, level descriptions)
- [ ] Credit carryover between levels works
- [ ] Game feels progressively challenging
- [ ] Statistics tracked and saved

### Sprint Review Focus

- **Difficulty Curve**: Is progression smooth?
- **Variety**: Do different enemies feel different?
- **Pacing**: Are waves well-timed?
- **Clarity**: Is progress clear to player?
- **Replayability**: Do players want to replay levels?

### Potential Rework Areas

- Rebalance difficulty curve
- Adjust enemy type stats
- Refine wave timing and spacing
- Add more enemy variety
- Tune level progression

---

## Sprint 5: Polish, Effects & Advanced Features

**Duration**: 1-2 weeks

**Goal**: Add visual polish, effects, and advanced gameplay features

### User Stories

- As a player, I want visual effects so the game feels exciting
- As a player, I want smooth animations so the game feels polished
- As a player, I want advanced platform types so I have more strategy options
- As a player, I want a pause menu so I can take breaks

### Tasks

1. **Visual Effects** ([js/effects.js](js/effects.js) or integrated)

   - Explosion effects when enemies die
   - Particle systems for projectiles
   - Muzzle flash for weapons
   - Hit effects (sparks, damage numbers)

2. **Animations** ([js/enemy.js](js/enemy.js), [js/platform.js](js/platform.js))

   - Enemy death animations
   - Platform rotation animations
   - Smooth projectile trails
   - Health bar animations

3. **Advanced Platforms** ([js/platform.js](js/platform.js))

   - Plasma Cannon (area damage)
   - Gravity Well (slows enemies)
   - EMP Station (disables shields)
   - Special abilities system

4. **UI Polish** ([js/ui.js](js/ui.js), [styles/game.css](styles/game.css))

   - Improved HUD design
   - Better menu layouts
   - Comprehensive tutorial system (first-time player onboarding)
   - Tooltips and help text (contextual)
   - Settings menu (sound, graphics, controls, difficulty)
   - Pause menu with resume/restart/quit options
   - Statistics screen (total kills, accuracy, levels completed)
   - Achievement system (optional)
   - Key remapping support

5. **Performance Optimization** ([js/main.js](js/main.js), [js/utils.js](js/utils.js))

   - Object pooling for enemies/projectiles
   - Spatial partitioning for collision detection
   - Frame rate monitoring
   - Performance tuning

6. **Advanced Features** (optional, based on feedback)

   - Boss enemies (special wave end enemies)
   - Fighter station system (spawns fighters that enemies can attack)
   - Environmental hazards (solar flares, asteroids)
   - Multiple enemy paths
   - Special events (narrative moments)
   - Minimap/radar system
   - Combo system (bonus credits for rapid kills)

7. **Audio** (optional)

   - Sound effects (shooting, explosions, hits, UI clicks)
   - Background music (ambient space theme)
   - Audio settings (volume controls, mute options)
   - Dynamic music (intensity increases with wave difficulty)

8. **Story & Narrative** ([js/story.js](js/story.js))

   - Story framework and narrative structure
   - Level intro text/cutscenes
   - Level descriptions and context
   - Victory/defeat narrative elements
   - Story progression tracking

### Definition of Done

- [ ] Visual effects enhance gameplay feel
- [ ] Animations are smooth and polished
- [ ] Advanced platforms add strategic depth
- [ ] UI is polished and intuitive
- [ ] Tutorial system guides new players effectively
- [ ] Story elements enhance immersion
- [ ] Settings menu fully functional
- [ ] Statistics tracking works correctly
- [ ] Game performs well with many objects
- [ ] Overall game feels complete and polished

### Sprint Review Focus

- **Polish**: Does game feel professional?
- **Performance**: Does it run smoothly?
- **Depth**: Are advanced features engaging?
- **Completeness**: Does game feel finished?
- **Overall Experience**: Is it fun and engaging?

### Potential Rework Areas

- Refine visual effects intensity
- Optimize performance bottlenecks
- Balance advanced platform abilities
- Improve UI based on usability testing
- Add requested features from feedback

---

## File Structure

```
Solar-Defense/
├── index.html              # Main HTML entry point
├── js/
│   ├── main.js            # Game initialization and main loop
│   ├── scene.js           # Three.js scene setup and management
│   ├── camera.js          # Camera controls and positioning
│   ├── path.js            # Path system for enemy movement
│   ├── enemy.js           # Enemy class and spawning logic
│   ├── tower.js           # Base tower/platform class
│   ├── starbase.js        # Main starbase (player-controlled)
│   ├── platform.js        # Deployable weapon platforms
│   ├── projectile.js      # Projectile system for combat
│   ├── upgrade.js         # Upgrade system and stat management
│   ├── level.js           # Level/wave management
│   ├── economy.js         # Credits and resource management
│   ├── ui.js              # UI rendering and interaction
│   ├── input.js           # Mouse/keyboard input handling
│   ├── effects.js         # Visual effects and particles (Sprint 5)
│   ├── story.js           # Story and narrative system
│   ├── gameState.js       # Game state management (menu, playing, etc.)
│   ├── config.js          # Game balance configuration (credits, stats, etc.)
│   └── utils.js           # Utility functions and helpers
├── assets/                # Game assets (models, textures, sounds)
│   ├── models/
│   ├── textures/
│   └── sounds/
├── styles/
│   └── game.css           # Game styling
└── README.md              # Updated documentation
```

## Agile Practices

### Sprint Planning

- Review previous sprint feedback
- Prioritize user stories based on value
- Estimate tasks (story points or hours)
- Set sprint goal and definition of done

### Daily Standups (if applicable)

- What did I complete yesterday?
- What will I work on today?
- Any blockers or concerns?

### Sprint Review

- Demo playable increment
- Collect feedback (playtesting forms)
- Identify what worked well
- Identify what needs improvement

### Sprint Retrospective

- What went well?
- What could be improved?
- Action items for next sprint
- Update plan based on learnings

### Continuous Improvement

- Refactor code as needed
- Update architecture based on learnings
- Adjust difficulty/balance continuously
- Incorporate player feedback quickly

## Success Metrics

- **Playability**: Game is fun and engaging
- **Performance**: Maintains 60 FPS with many objects
- **Balance**: Difficulty curve feels fair, economy is balanced
- **Polish**: Game feels complete and professional
- **Code Quality**: Maintainable, well-organized code
- **Player Feedback**: Positive reception in playtesting
- **Onboarding**: New players can understand and play without frustration
- **Progression**: Players feel rewarded and motivated to continue
- **Story**: Narrative elements enhance rather than distract from gameplay

## Game Design Principles

### Core Mechanics

- **Win Condition**: Kill all enemies in each wave to survive and progress
- **Economy**: Guaranteed starting credits + credits per kill ensures players always have options
- **Enemy Behavior**: Enemies attack fighters (if fighter stations exist) but ignore defensive structures, keeping focus on path defense
- **Progression**: Difficulty scales through enemy health, speed, count, and variety

### Player Experience

- **Feedback**: Clear visual and audio feedback for all actions
- **Clarity**: Health bars, damage numbers, and UI elements make game state obvious
- **Strategy**: Platform placement, upgrades, and resource management create meaningful choices
- **Story**: Narrative context enhances immersion without blocking gameplay

### Technical Considerations

- **Performance**: Object pooling, spatial partitioning, and optimization maintain 60 FPS
- **Accessibility**: Key remapping, difficulty options, and clear UI support diverse players
- **Maintainability**: Configuration files separate balance from code for easy tuning