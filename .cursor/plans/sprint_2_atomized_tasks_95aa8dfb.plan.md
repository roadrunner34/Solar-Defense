---
name: Sprint 2 Atomized Tasks
overview: Break down Sprint 2 (Deployable Platform System) into the smallest possible atomic tasks for agile development, ensuring each task is independently testable and delivers incremental value.
todos:
  - id: task-1.1
    content: Create Platform Configuration in config.js - Add platforms section with Laser Battery and Missile Launcher stats
    status: completed
  - id: task-1.2
    content: Create Base Platform Class Structure - Platform class with constructor, mesh, and scene integration
    status: completed
  - id: task-1.3
    content: Create Platform Visuals (Laser Battery) - Distinct visual with turret and barrel
    status: completed
  - id: task-1.4
    content: Create Platform Visuals (Missile Launcher) - Distinct visual different from Laser Battery
    status: completed
  - id: task-2.1
    content: Define Placement Grid System - Validation functions for valid placement positions
    status: completed
  - id: task-2.2
    content: Implement Overlap Detection - Check minimum distance between platforms
    status: completed
  - id: task-2.3
    content: Create Placement Preview/Ghost System - Semi-transparent preview with range indicator
    status: completed
  - id: task-2.4
    content: Integrate Mouse Input for Placement - Raycasting and click-to-place functionality
    status: completed
  - id: task-3.1
    content: Implement Enemy Detection - Find closest enemy in range for each platform
    status: pending
  - id: task-3.2
    content: Implement Platform Rotation/Tracking - Smooth turret rotation to face target
    status: pending
  - id: task-3.3
    content: Implement Platform Firing System (Laser Battery) - Fire projectiles at correct rate
    status: pending
  - id: task-3.4
    content: Create Platform Update Loop Integration - Integrate into main game loop
    status: pending
  - id: task-4.1
    content: Add Platform Costs to Economy Validation - canAffordPlatform() function
    status: pending
  - id: task-4.2
    content: Integrate Platform Purchase in Placement - Deduct credits on placement
    status: pending
  - id: task-4.3
    content: Implement Platform Selling System - Sell with 50% refund
    status: pending
  - id: task-5.1
    content: Create Platform Build Menu UI - HTML structure and styling
    status: pending
  - id: task-5.2
    content: Add Platform Selection Buttons - Click handlers and placement mode toggle
    status: pending
  - id: task-5.3
    content: Display Platform Cost Validation in UI - Disable buttons, show errors
    status: pending
  - id: task-5.4
    content: Add Platform Selection (Click to Select) - Raycast selection and stats panel
    status: pending
  - id: task-5.5
    content: Add Range Visualization on Selection - Show range indicator when selected
    status: pending
  - id: task-6.1
    content: Extend Projectile System for Multiple Types - Support laser and missile types
    status: pending
  - id: task-6.2
    content: Implement Missile-Specific Behavior - Different visuals, speed, and damage
    status: pending
  - id: task-6.3
    content: Integrate Missile Launcher Platform - Fire missile-type projectiles
    status: pending
  - id: task-7.1
    content: Add Platform Cleanup on Game Reset - clearAllPlatforms() function
    status: pending
  - id: task-7.2
    content: Add Platform Statistics Tracking - Track shots and kills per platform
    status: pending
  - id: task-7.3
    content: Performance Testing & Optimization - Ensure 60 FPS with 10+ platforms
    status: pending
---

# Sprint 2: Deployable Platform System - Atomized Task Breakdown

## Overview

Sprint 2 introduces deployable weapon platforms that players can place strategically. This breakdown splits the work into **atomic tasks** - each task is:

- **Independently testable**: Can verify it works in isolation
- **Value-delivering**: Provides something the player can see/use
- **Small scope**: Typically 2-8 hours of work
- **Clear acceptance criteria**: Definition of done is explicit

## Task Organization Strategy

Tasks are organized into **epics** (logical groupings) but broken down to the atomic level. Dependencies are clearly marked. Tasks can be worked on in parallel where possible.

---

## Epic 1: Platform Base System & Configuration

### Task 1.1: Create Platform Configuration in `config.js`

**File**: `js/config.js`

**Dependencies**: None

**Estimated Time**: 1-2 hours

**Acceptance Criteria**:

- [x] Add `platforms` section to CONFIG object
- [x] Define Laser Battery stats: damage (20), range (80), fireRate (1.2), cost (50)
- [x] Define Missile Launcher stats: damage (40), range (100), fireRate (0.8), cost (100)
- [x] Add helper function `getPlatformConfig(type)` similar to `getEnemyConfig()`
- [x] Document platform stats in comments

**Why this first?** Configuration drives all other work. Having it defined early allows parallel development.

---

### Task 1.2: Create Base Platform Class Structure

**File**: `js/platform.js` (new file)

**Dependencies**: Task 1.1

**Estimated Time**: 2-3 hours

**Acceptance Criteria**:

- [x] Create `Platform` class with constructor accepting: type, position, config
- [x] Store platform properties: type, position, stats (damage, range, fireRate, cost)
- [x] Create basic Three.js mesh (simple box/cylinder) for visual representation
- [x] Add platform to scene at specified position
- [x] Export `createPlatform(type, position)` function
- [x] Export `platforms` array to track all platforms
- [x] Platform renders correctly in scene (visible, positioned correctly)

**Why this matters**: Foundation for all platform functionality. Can test by creating a platform and seeing it in the scene.

---

### Task 1.3: Create Platform Visuals (Laser Battery)

**File**: `js/platform.js`

**Dependencies**: Task 1.2

**Estimated Time**: 2-3 hours

**Acceptance Criteria**:

- [x] Laser Battery has distinct visual (different from starbase)
- [x] Create turret that can rotate (similar to starbase structure)
- [x] Create barrel/cannon that extends from turret
- [x] Use different colors/materials to distinguish from starbase
- [x] Visual matches platform type (Laser Battery looks like a laser weapon)
- [x] Platform is clearly visible and recognizable

**Why separate?** Visuals can be iterated independently. This allows testing placement before targeting works.

---

### Task 1.4: Create Platform Visuals (Missile Launcher)

**File**: `js/platform.js`

**Dependencies**: Task 1.2

**Estimated Time**: 2-3 hours

**Acceptance Criteria**:

- [x] Missile Launcher has distinct visual from Laser Battery
- [x] Create launcher structure (different shape than laser)
- [x] Visual clearly indicates it's a missile weapon (e.g., tubes, different barrel)
- [x] Uses different colors/materials
- [x] Platform is clearly distinguishable from Laser Battery

**Why separate?** Each platform type needs unique visuals. Can be done in parallel with Task 1.3.

---

## Epic 2: Placement System Foundation

### Task 2.1: Define Placement Grid System

**File**: `js/platform.js`

**Dependencies**: None (can start early)

**Estimated Time**: 2-3 hours

**Acceptance Criteria**:

- [x] Define grid spacing constant (e.g., 10 units between platforms)
- [x] Create `isValidPlacementPosition(position)` function
- [x] Validate position is not too close to planet center (minimum distance)
- [x] Validate position is not too far from planet (maximum distance)
- [x] Return boolean: true if valid, false if invalid
- [x] Add helper function to snap position to grid (optional, for grid-based placement)

**Why first?** Placement validation is needed before any placement UI or interaction.

---

### Task 2.2: Implement Overlap Detection

**File**: `js/platform.js`

**Dependencies**: Task 1.2, Task 2.1

**Estimated Time**: 2-3 hours

**Acceptance Criteria**:

- [x] Create `checkPlatformOverlap(position, excludePlatform)` function
- [x] Check distance to all existing platforms
- [x] Enforce minimum distance between platforms (from config)
- [x] Return true if position would overlap, false otherwise
- [x] `excludePlatform` parameter allows checking placement of existing platform (for selling/moving)
- [x] Test with multiple platforms placed

**Why separate?** Overlap detection is a distinct algorithm that can be tested independently.

---

### Task 2.3: Create Placement Preview/Ghost System

**File**: `js/platform.js`

**Dependencies**: Task 1.2, Task 2.1, Task 2.2

**Estimated Time**: 3-4 hours

**Acceptance Criteria**:

- [x] Create `createPlacementPreview(type, position)` function
- [x] Preview shows semi-transparent version of platform
- [x] Preview updates position as mouse moves (will need input integration later)
- [x] Preview changes color based on validity (green = valid, red = invalid)
- [x] Preview shows range indicator (circle/sphere showing attack range)
- [x] `removePlacementPreview()` function to clean up
- [x] Preview renders correctly and updates smoothly

**Why this matters**: Visual feedback is critical for good UX. Players need to see where they're placing.

---

### Task 2.4: Integrate Mouse Input for Placement

**File**: `js/input.js` (or new `js/placement.js`)

**Dependencies**: Task 2.3

**Estimated Time**: 3-4 hours

**Acceptance Criteria**:

- [x] Add mouse click handler for placement mode
- [x] Convert mouse screen coordinates to 3D world position (raycasting)
- [x] Update placement preview position on mouse move
- [x] On click: validate position, create platform if valid
- [x] Handle placement mode toggle (enter/exit placement mode)
- [x] Test: Can click to place platform at valid locations
- [x] Test: Cannot place at invalid locations (overlaps, too close to planet)

**Why separate?** Input handling is a distinct system. Can test placement logic before UI integration.

---

## Epic 3: Platform Combat System

### Task 3.1: Implement Enemy Detection (Find Closest Enemy)

**File**: `js/platform.js`

**Dependencies**: Task 1.2, existing `enemy.js`

**Estimated Time**: 2-3 hours

**Acceptance Criteria**:

- [ ] Create `findClosestEnemyInRange(platform)` function
- [ ] Use existing `getClosestEnemy()` from `enemy.js` or similar logic
- [ ] Check enemy is within platform's range (from stats)
- [ ] Return enemy object or null if none in range
- [ ] Test: Returns null when no enemies exist
- [ ] Test: Returns closest enemy when multiple enemies in range
- [ ] Test: Returns null when all enemies out of range

**Why first?** Targeting is the foundation of combat. Can test independently before firing.

---

### Task 3.2: Implement Platform Rotation/Tracking

**File**: `js/platform.js`

**Dependencies**: Task 3.1, Task 1.3/1.4

**Estimated Time**: 2-3 hours

**Acceptance Criteria**:

- [ ] Create `updatePlatformRotation(platform, target, deltaTime)` function
- [ ] Rotate platform turret to face target (similar to starbase logic)
- [ ] Use smooth rotation (lerp) like starbase
- [ ] Calculate angle difference and rotate shortest direction
- [ ] Consider "aimed" when within 5 degrees of target
- [ ] Test: Platform rotates to face moving enemy
- [ ] Test: Rotation is smooth, not jittery

**Why separate?** Rotation is visual feedback. Can test targeting logic before firing works.

---

### Task 3.3: Implement Platform Firing System (Laser Battery)

**File**: `js/platform.js`

**Dependencies**: Task 3.2, existing `projectile.js`

**Estimated Time**: 3-4 hours

**Acceptance Criteria**:

- [ ] Create `firePlatformProjectile(platform, target)` function
- [ ] Check fire rate cooldown (time since last shot)
- [ ] Calculate projectile spawn position (barrel tip)
- [ ] Calculate direction to target
- [ ] Call `createProjectile()` from `projectile.js` with platform stats
- [ ] Set projectile source to platform ID/type
- [ ] Reset fire cooldown after firing
- [ ] Test: Platform fires at correct rate
- [ ] Test: Projectiles spawn from barrel tip
- [ ] Test: Projectiles travel toward target

**Why separate?** Firing logic is complex. Can test each platform type independently.

---

### Task 3.4: Create Platform Update Loop Integration

**File**: `js/platform.js`, `js/main.js`

**Dependencies**: Task 3.3

**Estimated Time**: 2-3 hours

**Acceptance Criteria**:

- [ ] Create `updatePlatforms(deltaTime)` function
- [ ] Loop through all platforms
- [ ] For each platform: find target, rotate, fire
- [ ] Integrate into main game loop in `main.js`
- [ ] Test: All platforms update each frame
- [ ] Test: Platforms work alongside starbase (no conflicts)
- [ ] Test: Performance is acceptable with 5+ platforms

**Why this matters**: Integration ensures platforms work in the full game context.

---

## Epic 4: Economy Integration

### Task 4.1: Add Platform Costs to Economy Validation

**File**: `js/economy.js`

**Dependencies**: Task 1.1

**Estimated Time**: 1-2 hours

**Acceptance Criteria**:

- [ ] Create `canAffordPlatform(type)` function
- [ ] Get platform cost from config
- [ ] Check if player has enough credits
- [ ] Return boolean
- [ ] Test: Returns false when insufficient credits
- [ ] Test: Returns true when player has enough credits

**Why separate?** Economy validation is a simple, testable function.

---

### Task 4.2: Integrate Platform Purchase in Placement

**File**: `js/platform.js`, `js/economy.js`

**Dependencies**: Task 2.4, Task 4.1

**Estimated Time**: 2-3 hours

**Acceptance Criteria**:

- [ ] Check `canAffordPlatform()` before allowing placement
- [ ] Call `spendCredits()` when platform is placed
- [ ] Prevent placement if insufficient credits
- [ ] Show error message/feedback when placement blocked (UI task)
- [ ] Test: Cannot place platform without enough credits
- [ ] Test: Credits are deducted when platform is placed
- [ ] Test: Platform appears after purchase

**Why separate?** Purchase logic is distinct from placement logic. Can test economy independently.

---

### Task 4.3: Implement Platform Selling System

**File**: `js/platform.js`, `js/economy.js`

**Dependencies**: Task 4.2

**Estimated Time**: 3-4 hours

**Acceptance Criteria**:

- [ ] Create `sellPlatform(platform)` function
- [ ] Calculate refund (e.g., 50% of original cost)
- [ ] Add refunded credits to economy
- [ ] Remove platform from scene
- [ ] Remove platform from platforms array
- [ ] Test: Selling platform refunds correct amount
- [ ] Test: Platform is removed from game
- [ ] Test: Credits are added back to player

**Why separate?** Selling is a distinct feature with its own logic and UI needs.

---

## Epic 5: UI Integration

### Task 5.1: Create Platform Build Menu UI

**File**: `js/ui.js`

**Dependencies**: Task 1.1

**Estimated Time**: 3-4 hours

**Acceptance Criteria**:

- [ ] Create build menu HTML structure (or create dynamically)
- [ ] Display all available platform types
- [ ] Show platform name, cost, and basic stats (damage, range)
- [ ] Style menu to match game aesthetic
- [ ] Menu is visible and readable
- [ ] Test: Menu displays all platform types correctly

**Why first?** UI structure is needed before interaction.

---

### Task 5.2: Add Platform Selection Buttons

**File**: `js/ui.js`

**Dependencies**: Task 5.1, Task 2.4

**Estimated Time**: 2-3 hours

**Acceptance Criteria**:

- [ ] Add click handlers to platform type buttons
- [ ] Enter placement mode when button clicked
- [ ] Store selected platform type
- [ ] Show visual feedback (button highlight) when selected
- [ ] Test: Clicking button enters placement mode
- [ ] Test: Preview appears when in placement mode

**Why separate?** Button interaction is distinct from menu display.

---

### Task 5.3: Display Platform Cost Validation in UI

**File**: `js/ui.js`

**Dependencies**: Task 5.2, Task 4.1

**Estimated Time**: 2-3 hours

**Acceptance Criteria**:

- [ ] Disable/gray out platform buttons when player can't afford
- [ ] Show current credit balance in build menu
- [ ] Update credit display in real-time
- [ ] Show error message when trying to place without credits
- [ ] Test: Buttons disable when insufficient credits
- [ ] Test: Error message appears on invalid placement attempt

**Why separate?** UI feedback is distinct from logic. Can test affordability independently.

---

### Task 5.4: Add Platform Selection (Click to Select Existing Platform)

**File**: `js/ui.js`, `js/input.js`

**Dependencies**: Task 1.2

**Estimated Time**: 3-4 hours

**Acceptance Criteria**:

- [ ] Add click handler for selecting platforms (raycast to 3D objects)
- [ ] Highlight selected platform visually
- [ ] Show platform stats panel when selected
- [ ] Display: damage, range, fire rate, type
- [ ] Show sell button when platform selected
- [ ] Test: Clicking platform selects it
- [ ] Test: Stats panel displays correct information
- [ ] Test: Only one platform selected at a time

**Why separate?** Selection is a distinct interaction pattern from placement.

---

### Task 5.5: Add Range Visualization on Selection

**File**: `js/ui.js`, `js/platform.js`

**Dependencies**: Task 5.4

**Estimated Time**: 2-3 hours

**Acceptance Criteria**:

- [ ] Create range indicator (wireframe sphere or circle)
- [ ] Show range indicator when platform is selected
- [ ] Range indicator matches platform's range stat
- [ ] Range indicator is visible and clear
- [ ] Remove range indicator when platform deselected
- [ ] Test: Range indicator appears on selection
- [ ] Test: Range indicator size matches platform range

**Why separate?** Visual feedback is a distinct feature that enhances UX.

---

## Epic 6: Projectile Type Extensions

### Task 6.1: Extend Projectile System for Multiple Types

**File**: `js/projectile.js`

**Dependencies**: Existing projectile system

**Estimated Time**: 3-4 hours

**Acceptance Criteria**:

- [ ] Add `projectileType` parameter to `createProjectile()`
- [ ] Support 'laser' type (existing behavior - instant hit or fast travel)
- [ ] Support 'missile' type (traveling projectile with different visual)
- [ ] Create missile geometry/material (different from laser)
- [ ] Missiles travel slower than lasers (configurable)
- [ ] Test: Lasers work as before
- [ ] Test: Missiles have different visual and speed

**Why separate?** Projectile types are a distinct system. Can test independently of platforms.

---

### Task 6.2: Implement Missile-Specific Behavior

**File**: `js/projectile.js`

**Dependencies**: Task 6.1

**Estimated Time**: 2-3 hours

**Acceptance Criteria**:

- [ ] Missiles can have different damage than lasers
- [ ] Missiles can have explosion radius (for future area damage)
- [ ] Missile visuals are distinct (e.g., rocket shape, trail effect)
- [ ] Test: Missiles deal correct damage
- [ ] Test: Missiles look different from lasers

**Why separate?** Missile-specific features are distinct from base projectile system.

---

### Task 6.3: Integrate Missile Launcher Platform

**File**: `js/platform.js`

**Dependencies**: Task 3.3, Task 6.1

**Estimated Time**: 2-3 hours

**Acceptance Criteria**:

- [ ] Missile Launcher fires missile-type projectiles
- [ ] Missile Launcher uses correct projectile stats from config
- [ ] Test: Missile Launcher fires missiles (not lasers)
- [ ] Test: Missiles behave correctly (travel, hit enemies)

**Why separate?** Platform-specific projectile integration is a distinct task.

---

## Epic 7: Polish & Integration

### Task 7.1: Add Platform Cleanup on Game Reset

**File**: `js/platform.js`, `js/main.js`

**Dependencies**: All platform tasks

**Estimated Time**: 1-2 hours

**Acceptance Criteria**:

- [ ] Create `clearAllPlatforms()` function
- [ ] Remove all platforms from scene
- [ ] Clear platforms array
- [ ] Call on game restart/reset
- [ ] Test: Platforms are removed when game resets
- [ ] Test: No memory leaks (platforms properly disposed)

**Why separate?** Cleanup is important for game state management.

---

### Task 7.2: Add Platform Statistics Tracking

**File**: `js/platform.js`

**Dependencies**: Task 3.3

**Estimated Time**: 1-2 hours

**Acceptance Criteria**:

- [ ] Track shots fired per platform
- [ ] Track kills per platform
- [ ] Store stats in platform object
- [ ] Test: Stats are tracked correctly
- [ ] Test: Stats persist for platform lifetime

**Why separate?** Statistics are useful for balance testing and future features.

---

### Task 7.3: Performance Testing & Optimization

**File**: `js/platform.js`, `js/main.js`

**Dependencies**: All platform tasks

**Estimated Time**: 2-3 hours

**Acceptance Criteria**:

- [ ] Test with 10+ platforms active
- [ ] Maintain 60 FPS with multiple platforms
- [ ] Optimize enemy detection (avoid checking all enemies for all platforms each frame)
- [ ] Consider spatial partitioning if needed
- [ ] Test: Game runs smoothly with many platforms

**Why last?** Optimization should happen after features are complete.

---

## Task Dependencies Diagram

```
Epic 1 (Base System):
  1.1 (Config) → 1.2 (Base Class) → 1.3 (Laser Visuals)
                              → 1.4 (Missile Visuals)

Epic 2 (Placement):
  2.1 (Grid) → 2.2 (Overlap) → 2.3 (Preview) → 2.4 (Input)

Epic 3 (Combat):
  3.1 (Detection) → 3.2 (Rotation) → 3.3 (Firing) → 3.4 (Integration)

Epic 4 (Economy):
  4.1 (Validation) → 4.2 (Purchase) → 4.3 (Selling)

Epic 5 (UI):
  5.1 (Menu) → 5.2 (Buttons) → 5.3 (Cost Display)
  5.4 (Selection) → 5.5 (Range Viz)

Epic 6 (Projectiles):
  6.1 (Types) → 6.2 (Missile Behavior) → 6.3 (Integration)

Epic 7 (Polish):
  All epics → 7.1 (Cleanup) → 7.2 (Stats) → 7.3 (Performance)
```

## Parallel Work Opportunities

**Can work in parallel:**

- Tasks 1.3 and 1.4 (different platform visuals)
- Tasks 2.1 and 1.2 (grid system and base class are independent)
- Tasks 5.1-5.3 (UI tasks) can be done alongside platform logic
- Task 6.1 (projectile types) can be done early, independent of platforms

## Sprint 2 Definition of Done (Revisited)

- [ ] Player can place platforms at valid locations
- [ ] Platforms auto-target and fire at enemies
- [ ] Different platform types have distinct behaviors
- [ ] Credit system prevents unlimited building
- [ ] Platform range visualization when placing
- [ ] Platform selling/removal works with refunds
- [ ] UI clearly shows placement options and costs
- [ ] Platforms work alongside starbase
- [ ] Minimum distance between platforms enforced
- [ ] Game performs well with multiple platforms (10+)

## Estimated Total Effort

- **Total Tasks**: 27 atomic tasks
- **Estimated Total Time**: 60-80 hours
- **Sprint Duration**: 1-2 weeks (assuming 1 developer, 6-8 hours/day)
- **With 2 developers in parallel**: ~1 week

## Teaching Notes

**Why atomization helps:**

1. **Clear progress**: Each task completion is a visible milestone
2. **Easier testing**: Small tasks are easier to verify
3. **Better estimation**: Smaller tasks = more accurate time estimates
4. **Parallel work**: Team members can work on different tasks simultaneously
5. **Risk reduction**: Problems are caught early in small increments
6. **Flexibility**: Can reorder or skip tasks based on feedback

**Agile principles applied:**

- **Incremental value**: Each task delivers something testable
- **Definition of done**: Clear acceptance criteria for each task
- **Dependencies**: Clearly marked so work can be sequenced properly
- **Parallelization**: Identified where tasks can be done simultaneously