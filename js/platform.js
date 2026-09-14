/**
 * platform.js - Deployable Weapon Platforms
 * 
 * This module manages deployable weapon platforms that players can place
 * strategically around the planet. Platforms automatically target and fire
 * at enemies within range.
 * 
 * Platforms are similar to the starbase but can be placed anywhere on the
 * orbital plane. Each platform type has different stats (damage, range, fire rate).
 * 
 * For Task 1.2, we're creating the base structure:
 * - Platform class/object structure
 * - Basic visual representation
 * - Scene integration
 * 
 * Future tasks will add:
 * - Distinct visuals for each platform type (Task 1.3, 1.4)
 * - Placement system (Task 2.x)
 * - Combat system (Task 3.x)
 */

import * as THREE from 'three';
import { scene } from './scene.js';
import { getUpgradeInvestment } from './upgrade.js';
import { createHullMaterial } from './materials.js';
import { getPlatformConfig, CONFIG } from './config.js';
import { selectTarget, DEFAULT_TARGETING, isTargetingMode } from './targeting.js';
import { getEnemiesInRange, refreshStatusVisual } from './enemy.js';
import { applyStatus } from './status.js';
import { spendCredits, addCredits, canAfford } from './economy.js';
import { createMuzzleSparks } from './particles.js';
import { updateTurretAim } from './turret.js';
import { playSound } from './audio.js';

// Store all active platforms
export const platforms = [];

// Monotonic id source. Deriving ids from platforms.length instead meant that
// removing a platform made the next one reuse a live id.
let nextPlatformId = 0;

// How many platforms have been built this run, including ones since sold.
// platforms.length cannot answer this - it is the board right now, not the
// history - and "platforms built" is a thing the end-of-run summary reports.
let platformsBuiltThisRun = 0;

// ==================== PLACEMENT CONSTANTS ====================
// These define the rules for where platforms can be placed

/**
 * Minimum distance from planet center where platforms can be placed.
 * This should be larger than the planet radius to prevent platforms
 * from being inside the planet.
 * 
 * The planet radius is defined in CONFIG.path.planetRadius (default 5).
 * We add a buffer zone so platforms aren't touching the planet.
 */
const MIN_PLACEMENT_DISTANCE = 15; // Must be further than planet radius + buffer

/**
 * Maximum distance from planet center where platforms can be placed.
 * This keeps platforms in a reasonable "orbital defense zone".
 * 
 * The enemy spawn distance is CONFIG.path.spawnDistance (default 80).
 * We want platforms closer than where enemies spawn.
 */
const MAX_PLACEMENT_DISTANCE = 70; // Must be closer than enemy spawn

/**
 * Minimum distance between platforms.
 * This prevents platforms from being placed too close together,
 * which would look bad and could cause targeting issues.
 */
const MIN_PLATFORM_SPACING = 10;

/**
 * Grid spacing for optional snap-to-grid placement.
 * When enabled, platforms will snap to the nearest grid point.
 * This creates a cleaner, more organized look.
 */
const GRID_SPACING = 5;

// ==================== PLACEMENT VALIDATION FUNCTIONS ====================

/**
 * Checks if a position is valid for placing a platform.
 * 
 * This is the main validation function that checks all placement rules:
 * 1. Position must be within the valid distance range from planet center
 * 2. Position must not overlap with existing platforms
 * 
 * @param {THREE.Vector3|object} position - The position to validate
 * @returns {object} Result object with { valid: boolean, reason: string }
 * 
 * Why return an object instead of just boolean?
 * Because we want to tell the player WHY placement failed, not just that it failed.
 * This enables better UI feedback like "Too close to planet" vs "Overlapping platform".
 */
export function isValidPlacementPosition(position) {
    // Convert to Vector3 if needed
    const pos = position instanceof THREE.Vector3 
        ? position 
        : new THREE.Vector3(position.x || 0, position.y || 0, position.z || 0);
    
    // Calculate distance from planet center (which is at origin 0,0,0)
    // We only care about horizontal distance (X-Z plane), not height (Y)
    const horizontalDistance = Math.sqrt(pos.x * pos.x + pos.z * pos.z);
    
    // Check minimum distance (not too close to planet)
    if (horizontalDistance < MIN_PLACEMENT_DISTANCE) {
        return {
            valid: false,
            reason: 'Too close to planet'
        };
    }
    
    // Check maximum distance (not too far from planet)
    if (horizontalDistance > MAX_PLACEMENT_DISTANCE) {
        return {
            valid: false,
            reason: 'Too far from planet'
        };
    }
    
    // Check for overlap with existing platforms
    const overlapResult = checkPlatformOverlap(pos);
    if (overlapResult.overlapping) {
        return {
            valid: false,
            reason: 'Too close to another platform'
        };
    }
    
    // All checks passed!
    return {
        valid: true,
        reason: 'Valid placement'
    };
}

/**
 * Checks if a position would overlap with any existing platform.
 * 
 * "Overlap" means the position is within MIN_PLATFORM_SPACING distance
 * of any existing platform.
 * 
 * @param {THREE.Vector3|object} position - The position to check
 * @param {object|null} excludePlatform - Optional platform to exclude from check
 *                                        (useful when moving an existing platform)
 * @returns {object} Result with { overlapping: boolean, nearestPlatform: object|null, distance: number }
 */
export function checkPlatformOverlap(position, excludePlatform = null) {
    // Convert to Vector3 if needed
    const pos = position instanceof THREE.Vector3 
        ? position 
        : new THREE.Vector3(position.x || 0, position.y || 0, position.z || 0);
    
    let nearestPlatform = null;
    let nearestDistance = Infinity;
    
    // Check distance to each existing platform
    for (const platform of platforms) {
        // Skip the excluded platform (if any)
        if (excludePlatform && platform === excludePlatform) {
            continue;
        }
        
        // Skip platforms that aren't alive
        if (!platform.alive) {
            continue;
        }
        
        // Calculate distance between positions
        // We use the platform's stored position, not the mesh position
        // (they should be the same, but stored position is more reliable)
        const distance = pos.distanceTo(platform.position);
        
        // Track the nearest platform
        if (distance < nearestDistance) {
            nearestDistance = distance;
            nearestPlatform = platform;
        }
    }
    
    // Check if the nearest platform is too close
    const overlapping = nearestDistance < MIN_PLATFORM_SPACING;
    
    return {
        overlapping,
        nearestPlatform,
        distance: nearestDistance
    };
}

/**
 * Snaps a position to the nearest grid point.
 * 
 * This is optional but creates a cleaner look when placing platforms.
 * The grid is based on GRID_SPACING units.
 * 
 * @param {THREE.Vector3|object} position - The position to snap
 * @returns {THREE.Vector3} The snapped position
 * 
 * How snapping works:
 * If GRID_SPACING is 5, then positions snap to multiples of 5:
 * - 7 snaps to 5
 * - 8 snaps to 10
 * - 12 snaps to 10
 * - 13 snaps to 15
 */
export function snapToGrid(position) {
    // Convert to Vector3 if needed
    const pos = position instanceof THREE.Vector3 
        ? position.clone() 
        : new THREE.Vector3(position.x || 0, position.y || 0, position.z || 0);
    
    // Snap X and Z to grid (Y stays the same - platforms are on the orbital plane)
    pos.x = Math.round(pos.x / GRID_SPACING) * GRID_SPACING;
    pos.z = Math.round(pos.z / GRID_SPACING) * GRID_SPACING;
    
    return pos;
}

/**
 * Gets the placement constraints for UI display.
 * 
 * This allows the UI to show the valid placement zone to the player.
 * 
 * @returns {object} The placement constraints
 */
export function getPlacementConstraints() {
    return {
        minDistance: MIN_PLACEMENT_DISTANCE,
        maxDistance: MAX_PLACEMENT_DISTANCE,
        minSpacing: MIN_PLATFORM_SPACING,
        gridSpacing: GRID_SPACING
    };
}

/**
 * Fraction of a platform's original cost returned when it is sold.
 */
const SELL_REFUND_RATE = 0.5;

// ==================== PLACEMENT PREVIEW SYSTEM ====================

/**
 * The current placement preview object.
 * This is the semi-transparent "ghost" platform that shows where
 * the player is about to place a platform.
 */
let placementPreview = null;

/**
 * The range indicator circle that shows the platform's attack range.
 */
let rangeIndicator = null;

/**
 * Current placement mode state.
 * When in placement mode, mouse movement updates the preview position.
 */
export const placementState = {
    active: false,           // Is placement mode active?
    selectedType: null,      // Which platform type is selected ('laserBattery' or 'missileLauncher')
    previewPosition: new THREE.Vector3(), // Current preview position
    isValidPosition: false,  // Is the current position valid for placement?
    lastError: null          // Why the last placement attempt failed, for the UI
};

/**
 * Creates a placement preview for the specified platform type.
 * 
 * The preview is a semi-transparent version of the platform that follows
 * the mouse cursor. It changes color based on whether the position is valid:
 * - Green = valid placement
 * - Red = invalid placement
 * 
 * @param {string} type - Platform type ('laserBattery' or 'missileLauncher')
 */
export function createPlacementPreview(type) {
    // Remove any existing preview first
    removePlacementPreview();
    
    // Get the platform config for range info
    const config = getPlatformConfig(type);
    
    // Create the preview mesh (same as regular platform but transparent)
    const previewMesh = createPreviewMesh(type);
    
    // Create the range indicator
    rangeIndicator = createRangeIndicator(config.range);
    
    // Add to scene
    scene.add(previewMesh);
    scene.add(rangeIndicator);
    
    // Store references
    placementPreview = previewMesh;
    
    // Update placement state
    placementState.active = true;
    placementState.selectedType = type;
    
}

/**
 * Creates a semi-transparent preview mesh for a platform.
 * 
 * This is similar to createPlatformMesh but uses transparent materials
 * that can change color based on validity.
 * 
 * @param {string} type - Platform type
 * @returns {THREE.Group} The preview mesh group
 */
function createPreviewMesh(type) {
    // Build the real platform, then make it ghostly. Going through the same
    // builder means the preview can never drift out of sync with what actually
    // gets placed - which is exactly what happened when the two were written
    // as separate blocks of geometry.
    const previewGroup = createPlatformMesh(type);
    
    previewGroup.traverse((child) => {
        if (child.isMesh && child.material) {
            // Clone so tinting the preview never touches a placed platform
            child.material = child.material.clone();
            child.material.transparent = true;
            child.material.opacity = 0.5;
        }
    });
    
    // Mark this as a preview (not a real platform)
    previewGroup.userData.isPreview = true;
    
    return previewGroup;
}

/**
 * Creates a range indicator circle.
 * 
 * This is a wireframe circle that shows the platform's attack range.
 * It helps players understand how far the platform can shoot.
 * 
 * @param {number} range - The platform's range
 * @returns {THREE.Line} The range indicator
 */
export function createRangeIndicator(range) {
    // Create a circle using points
    const segments = 64; // Number of line segments (more = smoother circle)
    const points = [];
    
    for (let i = 0; i <= segments; i++) {
        const angle = (i / segments) * Math.PI * 2;
        points.push(new THREE.Vector3(
            Math.cos(angle) * range,
            0,
            Math.sin(angle) * range
        ));
    }
    
    // Create geometry from points
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    
    // Create material (green, semi-transparent)
    const material = new THREE.LineBasicMaterial({
        color: 0x00ff00,
        transparent: true,
        opacity: 0.5
    });
    
    // Create the line
    const circle = new THREE.Line(geometry, material);
    circle.name = 'rangeIndicator';
    
    return circle;
}

/**
 * Updates the placement preview position and validity.
 * 
 * This should be called every frame (or on mouse move) when in placement mode.
 * It moves the preview to the specified position and updates its color
 * based on whether the position is valid.
 * 
 * @param {THREE.Vector3|object} position - The new position for the preview
 */
export function updatePlacementPreview(position) {
    if (!placementPreview || !placementState.active) {
        return;
    }
    
    // Convert to Vector3 if needed
    const pos = position instanceof THREE.Vector3 
        ? position 
        : new THREE.Vector3(position.x || 0, position.y || 0, position.z || 0);
    
    // Update stored position
    placementState.previewPosition.copy(pos);
    
    // Move the preview mesh
    placementPreview.position.copy(pos);
    
    // Move the range indicator to match
    if (rangeIndicator) {
        rangeIndicator.position.copy(pos);
    }
    
    // Check if position is valid
    const validationResult = isValidPlacementPosition(pos);
    placementState.isValidPosition = validationResult.valid;
    
    // Update colors based on validity
    updatePreviewColor(validationResult.valid);
}

/**
 * Updates the preview color based on placement validity.
 * 
 * Green = valid placement
 * Red = invalid placement
 * 
 * @param {boolean} isValid - Whether the current position is valid
 */
function updatePreviewColor(isValid) {
    if (!placementPreview) return;
    
    const color = isValid ? 0x00ff00 : 0xff0000;
    const emissive = isValid ? 0x003300 : 0x330000;
    
    // Update all materials in the preview
    placementPreview.traverse((child) => {
        if (child.isMesh && child.material) {
            child.material.color.setHex(color);
            // Only lit materials have an emissive channel - the glowing barrel
            // tips and tube interiors are MeshBasicMaterial and have none
            if (child.material.emissive) {
                child.material.emissive.setHex(emissive);
            }
        }
    });
    
    // Update range indicator color
    if (rangeIndicator && rangeIndicator.material) {
        rangeIndicator.material.color.setHex(color);
    }
}

/**
 * Removes the placement preview from the scene.
 * 
 * Call this when:
 * - Player cancels placement (ESC key)
 * - Player successfully places a platform
 * - Switching to a different platform type
 */
export function removePlacementPreview() {
    // Remove preview mesh
    if (placementPreview) {
        scene.remove(placementPreview);
        
        // Dispose of geometries and materials
        placementPreview.traverse((child) => {
            if (child instanceof THREE.Mesh) {
                if (child.geometry) child.geometry.dispose();
                if (child.material) child.material.dispose();
            }
        });
        
        placementPreview = null;
    }
    
    // Remove range indicator
    if (rangeIndicator) {
        scene.remove(rangeIndicator);
        if (rangeIndicator.geometry) rangeIndicator.geometry.dispose();
        if (rangeIndicator.material) rangeIndicator.material.dispose();
        rangeIndicator = null;
    }
    
    // Reset placement state
    placementState.active = false;
    placementState.selectedType = null;
    placementState.isValidPosition = false;
}

/**
 * Attempts to place a platform at the current preview position.
 * 
 * This is called when the player clicks to confirm placement.
 * It validates the position and creates the platform if valid.
 * 
 * @returns {object|null} The created platform, or null if placement failed
 */
export function confirmPlacement() {
    if (!placementState.active || !placementState.selectedType) {
        return null;
    }
    
    // Validate position one more time
    const validationResult = isValidPlacementPosition(placementState.previewPosition);
    
    if (!validationResult.valid) {
        placementState.lastError = validationResult.reason;
        return null;
    }
    
    // Charge for the platform. spendCredits checks the balance and debits in
    // one step, so there is no window where the check passes but the debit
    // fails. Platforms used to be free - cost was read from the config into the
    // platform object and then never used.
    const config = getPlatformConfig(placementState.selectedType);
    
    if (!spendCredits(config.cost)) {
        placementState.lastError = `Need ${config.cost} credits`;
        return null;
    }
    
    placementState.lastError = null;
    
    // Create the actual platform
    const platform = createPlatform(
        placementState.selectedType,
        placementState.previewPosition.clone()
    );
    
    
    playSound('build');

    // Remove the preview (placement complete)
    removePlacementPreview();

    return platform;
}

/**
 * Cancels the current placement operation.
 * 
 * Call this when the player presses ESC or clicks a cancel button.
 */
export function cancelPlacement() {
    if (placementState.active) {
        removePlacementPreview();
    }
}

/**
 * Creates a new platform at the specified position
 * 
 * This is the main function for creating platforms. It:
 * 1. Gets the platform configuration from CONFIG
 * 2. Creates a 3D mesh for visual representation
 * 3. Creates a platform object with all necessary properties
 * 4. Adds it to the scene and tracking array
 * 
 * @param {string} type - Platform type ('laserBattery' or 'missileLauncher')
 * @param {THREE.Vector3|object} position - Position where platform should be placed
 *                                          Can be Vector3 or {x, y, z} object
 * @returns {object} The created platform object
 */
export function createPlatform(type, position) {
    // Get platform configuration
    const config = getPlatformConfig(type);
    
    // Convert position to Vector3 if it's not already
    const platformPosition = position instanceof THREE.Vector3 
        ? position.clone() 
        : new THREE.Vector3(position.x || 0, position.y || 0, position.z || 0);
    
    // Build the type's distinct visual - laser barrels or missile tubes
    const mesh = createPlatformMesh(type);
    
    // Set the platform's position
    mesh.position.copy(platformPosition);
    
    // Create the platform data object
    // This stores all the platform's properties and state
    const platform = {
        mesh,                    // The 3D visual representation
        type,                    // Platform type ('laserBattery' or 'missileLauncher')
        position: platformPosition.clone(), // Store position for easy access
        
        // Platform stats (from config)
        damage: config.damage,
        range: config.range,
        fireRate: config.fireRate,
        cost: config.cost,
        projectileSpeed: config.projectileSpeed,
        rotationSpeed: config.rotationSpeed,
        projectileType: config.projectileType || 'laser',

        // How this platform acts each frame: 'turret' acquires a target, aims
        // and fires; 'aura' applies a status effect to everything in range.
        // Defaults to 'turret' so every existing platform type is unaffected.
        behaviour: config.behaviour || 'turret',

        // Support-platform stats. Undefined on weapons, which is what the
        // selection panel and build menu branch on.
        statusType: config.statusType,
        magnitude: config.magnitude,
        duration: config.duration,

        // Which stats this platform can upgrade. Weapons leave this undefined
        // and fall back to the damage/range/fireRate default.
        upgradeStats: config.upgradeStats,

        // Combat state
        timeSinceLastShot: 0,    // Track firing cooldown
        currentTarget: null,     // Currently targeted enemy

        // Seconds since an aura platform last applied its effect
        timeSinceLastTick: 0,

        // Which enemy this platform prefers, of those in range. Defaults to the
        // pre-Sprint-5 behaviour so an untouched platform behaves as it always
        // did; the selection panel is where it gets changed.
        targeting: DEFAULT_TARGETING,

        // Lifetime statistics, shown in the selection panel. Kills are credited
        // by main.js matching a hit's `source` back to this platform's id.
        shotsFired: 0,
        kills: 0,
        damageDealt: 0,

        // Platform ID for tracking - unique for the lifetime of the page
        id: nextPlatformId++,
        
        // Reference for easy access during interactions
        // Similar to how enemies store reference on mesh
        alive: true              // Track if platform is still active
    };
    
    // Store platform reference on mesh for easy access
    // This allows us to find the platform object when clicking on the mesh
    mesh.userData.platform = platform;
    
    // Add platform to scene and tracking array
    scene.add(mesh);
    platforms.push(platform);
    platformsBuiltThisRun++;
    
    return platform;
}

/**
 * Mesh builders, keyed by platform type.
 *
 * This was a ternary on the type, which was one of only two places in the
 * codebase where adding a platform type meant editing code rather than the
 * config - the build menu, the hotkeys and the stats all derive themselves from
 * CONFIG.platforms. A lookup table restores that property: a new type needs a
 * config entry and a builder registered here, and nothing else.
 */
const PLATFORM_MESH_BUILDERS = {
    laserBattery: createLaserBatteryMesh,
    missileLauncher: createMissileLauncherMesh,
    gravityWell: createGravityWellMesh,
    disruptor: createDisruptorMesh
};

/**
 * Creates the 3D mesh for a platform type.
 *
 * @param {string} type - Platform type
 * @returns {THREE.Group} The platform mesh group
 */
function createPlatformMesh(type) {
    const build = PLATFORM_MESH_BUILDERS[type] || createLaserBatteryMesh;
    return build();
}

/**
 * Builds the Laser Battery mesh.
 *
 * Read as: light, fast, energy-based. Slim octagonal base, compact turret and
 * twin thin barrels with glowing cyan tips - echoing the cyan of the lasers it
 * fires, and clearly different from the Missile Launcher's bulk.
 *
 * @returns {THREE.Group} The platform mesh group
 */
function createLaserBatteryMesh() {
    const platformGroup = new THREE.Group();
    
    // === BASE ===
    const baseGeometry = new THREE.CylinderGeometry(1.8, 2.2, 0.5, 8);
    const baseMaterial = createHullMaterial({
        color: 0x3a4a5a,          // Cool blue-grey
        emissive: 0x0a1520,
        flatShading: true,
        shininess: 40
    });
    platformGroup.add(new THREE.Mesh(baseGeometry, baseMaterial));
    
    // Cyan accent ring around the base, tying it to its laser colour
    const ringGeometry = new THREE.TorusGeometry(1.9, 0.08, 8, 24);
    const ringMaterial = new THREE.MeshBasicMaterial({
        color: new THREE.Color(0, 0.8, 1.0),
        transparent: true,
        opacity: 0.6
    });
    const accentRing = new THREE.Mesh(ringGeometry, ringMaterial);
    accentRing.rotation.x = Math.PI / 2;
    accentRing.position.y = 0.28;
    platformGroup.add(accentRing);
    
    // === TURRET (rotates to aim) ===
    const turret = new THREE.Group();
    turret.position.y = 0.7;
    turret.name = 'turret';
    platformGroup.add(turret);
    
    const housingGeometry = new THREE.CylinderGeometry(0.7, 0.9, 0.8, 8);
    const housingMaterial = createHullMaterial({
        color: 0x5a6a7a,
        emissive: 0x121a22,
        shininess: 60
    });
    turret.add(new THREE.Mesh(housingGeometry, housingMaterial));
    
    // === TWIN BARRELS ===
    const barrels = new THREE.Group();
    barrels.name = 'barrel';
    turret.add(barrels);
    
    const barrelGeometry = new THREE.CylinderGeometry(0.12, 0.14, 2.2, 8);
    const barrelMaterial = createHullMaterial({
        color: 0x8a9aaa,
        emissive: 0x1a2228,
        shininess: 80
    });
    const emitterGeometry = new THREE.SphereGeometry(0.15, 8, 8);
    const emitterMaterial = new THREE.MeshBasicMaterial({
        color: new THREE.Color(0, 1.6, 2.0) // HDR cyan, picked up by bloom
    });
    
    for (const offsetX of [-0.28, 0.28]) {
        const barrel = new THREE.Mesh(barrelGeometry, barrelMaterial);
        barrel.rotation.x = Math.PI / 2;
        barrel.position.set(offsetX, 0.1, 1.1);
        barrels.add(barrel);
        
        const emitter = new THREE.Mesh(emitterGeometry, emitterMaterial);
        emitter.position.set(offsetX, 0.1, 2.2);
        barrels.add(emitter);
    }
    
    // Where projectiles spawn, between the two barrels
    addMuzzle(barrels, 0.1, 2.3);
    
    return platformGroup;
}

/**
 * Builds the Missile Launcher mesh.
 *
 * Read as: heavy, slow, explosive. Wider hexagonal base, boxy launcher housing
 * and a visible 2x2 bank of tubes with hot orange interiors - unmistakably
 * different in silhouette and colour from the Laser Battery.
 *
 * @returns {THREE.Group} The platform mesh group
 */
function createMissileLauncherMesh() {
    const platformGroup = new THREE.Group();
    
    // === BASE ===
    const baseGeometry = new THREE.CylinderGeometry(2.2, 2.7, 0.6, 6);
    const baseMaterial = createHullMaterial({
        color: 0x5a4a3a,          // Warm rust-grey
        emissive: 0x1a1008,
        flatShading: true
    });
    platformGroup.add(new THREE.Mesh(baseGeometry, baseMaterial));
    
    // Stabiliser legs, selling the weight of the thing
    const legGeometry = new THREE.BoxGeometry(0.3, 0.4, 1.0);
    const legMaterial = createHullMaterial({
        color: 0x4a3a2a,
        emissive: 0x0a0804
    });
    for (let i = 0; i < 3; i++) {
        const angle = (i / 3) * Math.PI * 2;
        const leg = new THREE.Mesh(legGeometry, legMaterial);
        leg.position.set(Math.cos(angle) * 2.2, -0.1, Math.sin(angle) * 2.2);
        leg.rotation.y = -angle;
        platformGroup.add(leg);
    }
    
    // === TURRET (rotates to aim) ===
    const turret = new THREE.Group();
    turret.position.y = 0.8;
    turret.name = 'turret';
    platformGroup.add(turret);
    
    const housingGeometry = new THREE.BoxGeometry(1.8, 1.0, 1.4);
    const housingMaterial = createHullMaterial({
        color: 0x6a5a4a,
        emissive: 0x181008,
        flatShading: true
    });
    turret.add(new THREE.Mesh(housingGeometry, housingMaterial));
    
    // === MISSILE TUBE BANK (2x2) ===
    const tubes = new THREE.Group();
    tubes.name = 'barrel';
    turret.add(tubes);
    
    const tubeGeometry = new THREE.CylinderGeometry(0.26, 0.26, 1.6, 8);
    const tubeMaterial = createHullMaterial({
        color: 0x7a6a5a,
        emissive: 0x1a1208,
        flatShading: true
    });
    const tubeInteriorGeometry = new THREE.CircleGeometry(0.2, 8);
    const tubeInteriorMaterial = new THREE.MeshBasicMaterial({
        color: new THREE.Color(2.0, 0.7, 0.1), // HDR orange, picked up by bloom
        side: THREE.DoubleSide
    });
    
    for (const offsetX of [-0.32, 0.32]) {
        for (const offsetY of [-0.28, 0.28]) {
            const tube = new THREE.Mesh(tubeGeometry, tubeMaterial);
            tube.rotation.x = Math.PI / 2;
            tube.position.set(offsetX, offsetY, 0.9);
            tubes.add(tube);
            
            const interior = new THREE.Mesh(tubeInteriorGeometry, tubeInteriorMaterial);
            interior.position.set(offsetX, offsetY, 1.71);
            tubes.add(interior);
        }
    }
    
    // Where projectiles spawn, at the centre of the tube bank
    addMuzzle(tubes, 0, 1.8);
    
    return platformGroup;
}

/**
 * Builds the Gravity Well mesh.
 *
 * Read as: not a gun. This is the first platform in the game that does no
 * damage, and it has to say so from across the map - so it has no turret, no
 * barrel and no muzzle, which is the silhouette the eye uses to tell weapons
 * apart from everything else.
 *
 * Instead: a dark sphere that reads as an absence rather than a device, held
 * inside two rings that counter-rotate. The rings are named so updatePlatforms()
 * can spin them - a static support platform looks broken, because there is no
 * projectile to prove it is running.
 *
 * @returns {THREE.Group} The platform mesh group
 */
function createGravityWellMesh() {
    const platformGroup = new THREE.Group();

    // === BASE ===
    // Squat and wide, so it reads as an emplacement rather than a weapon
    const baseGeometry = new THREE.CylinderGeometry(2.0, 2.4, 0.4, 12);
    const baseMaterial = createHullMaterial({
        color: 0x3c3450,          // Cold violet-grey, unlike either weapon
        emissive: 0x120c20,
        flatShading: true
    });
    platformGroup.add(new THREE.Mesh(baseGeometry, baseMaterial));

    // === THE WELL ===
    // Deliberately almost black and barely lit. Every other emissive thing in
    // this game glows outward; this one should look like it is doing the
    // opposite, which is the whole idea of the platform.
    const coreGeometry = new THREE.SphereGeometry(0.85, 20, 16);
    const coreMaterial = new THREE.MeshBasicMaterial({
        color: new THREE.Color(0.03, 0.01, 0.09)
    });

    const core = new THREE.Mesh(coreGeometry, coreMaterial);
    core.position.y = 1.5;
    platformGroup.add(core);

    // A violet halo just outside the core, so the black sphere is legible
    // against the black of space
    const haloGeometry = new THREE.SphereGeometry(1.05, 20, 16);
    const haloMaterial = new THREE.MeshBasicMaterial({
        color: new THREE.Color(0.7, 0.25, 1.8), // HDR violet, caught by bloom
        transparent: true,
        opacity: 0.22,
        side: THREE.BackSide
    });

    const halo = new THREE.Mesh(haloGeometry, haloMaterial);
    halo.position.y = 1.5;
    platformGroup.add(halo);

    // === COUNTER-ROTATING RINGS ===
    const rings = new THREE.Group();
    rings.name = 'rings';
    rings.position.y = 1.5;
    platformGroup.add(rings);

    const ringMaterial = new THREE.MeshBasicMaterial({
        color: new THREE.Color(1.1, 0.45, 2.2), // HDR violet
        transparent: true,
        opacity: 0.75
    });

    // Two rings at different radii and tilts. Named individually so the update
    // loop can turn them opposite ways - matched rotation reads as one rigid
    // object, opposed rotation reads as a field being held open.
    const outer = new THREE.Mesh(
        new THREE.TorusGeometry(1.75, 0.07, 8, 40),
        ringMaterial
    );
    outer.name = 'ringOuter';
    outer.rotation.x = Math.PI / 2;
    rings.add(outer);

    const inner = new THREE.Mesh(
        new THREE.TorusGeometry(1.3, 0.05, 8, 32),
        ringMaterial
    );
    inner.name = 'ringInner';
    inner.rotation.x = Math.PI / 2.6;
    rings.add(inner);

    // === PYLONS ===
    // Three struts holding the core clear of the base
    const pylonGeometry = new THREE.BoxGeometry(0.16, 1.5, 0.16);
    const pylonMaterial = createHullMaterial({
        color: 0x4a4060,
        emissive: 0x0e0818
    });

    for (let i = 0; i < 3; i++) {
        const angle = (i / 3) * Math.PI * 2;
        const pylon = new THREE.Mesh(pylonGeometry, pylonMaterial);
        pylon.position.set(Math.cos(angle) * 1.1, 0.75, Math.sin(angle) * 1.1);
        pylon.rotation.y = -angle;
        platformGroup.add(pylon);
    }

    return platformGroup;
}

/**
 * Builds the Disruptor mesh.
 *
 * Read as: an instrument, not a weapon. Like the Gravity Well it has no turret
 * and no barrel, but it has to be distinguishable from the Well at a glance
 * too - so where that one is a dense sphere held inside rings, this is open and
 * skeletal: a thin mast carrying three prongs around a single emitter.
 *
 * Acid green, because cyan, orange and violet are already taken by the other
 * three platforms and colour is how the player reads a board at speed.
 *
 * @returns {THREE.Group} The platform mesh group
 */
function createDisruptorMesh() {
    const platformGroup = new THREE.Group();

    // === BASE ===
    const baseGeometry = new THREE.CylinderGeometry(1.7, 2.1, 0.45, 6);
    const baseMaterial = createHullMaterial({
        color: 0x35483a,          // Cold green-grey
        emissive: 0x0a1410,
        flatShading: true
    });
    platformGroup.add(new THREE.Mesh(baseGeometry, baseMaterial));

    // === MAST ===
    // Thin and tall. The open silhouette is the point: this should not read as
    // having anything inside it.
    const mastGeometry = new THREE.CylinderGeometry(0.16, 0.22, 3.2, 6);
    const mastMaterial = createHullMaterial({
        color: 0x5a6a5a,
        emissive: 0x121a14,
        shininess: 50
    });

    const mast = new THREE.Mesh(mastGeometry, mastMaterial);
    mast.position.y = 1.8;
    platformGroup.add(mast);

    // === EMITTER ===
    // Named so the update loop can pulse it on each tick
    const emitterGroup = new THREE.Group();
    emitterGroup.name = 'emitter';
    emitterGroup.position.y = 3.5;
    platformGroup.add(emitterGroup);

    const emitterMaterial = new THREE.MeshBasicMaterial({
        color: new THREE.Color(0.9, 2.2, 0.5), // HDR acid green, caught by bloom
        transparent: true,
        opacity: 0.9
    });

    const core = new THREE.Mesh(
        new THREE.IcosahedronGeometry(0.42, 0),
        emitterMaterial
    );
    core.name = 'emitterCore';
    emitterGroup.add(core);

    // Three prongs angled up and outward around the emitter, so the thing looks
    // like it is projecting a field rather than holding one in
    const prongGeometry = new THREE.CylinderGeometry(0.05, 0.09, 1.3, 5);
    const prongMaterial = createHullMaterial({
        color: 0x6a7a68,
        emissive: 0x141c16
    });

    for (let i = 0; i < 3; i++) {
        const angle = (i / 3) * Math.PI * 2;
        const prong = new THREE.Mesh(prongGeometry, prongMaterial);

        prong.position.set(Math.cos(angle) * 0.55, -0.15, Math.sin(angle) * 0.55);
        prong.rotation.z = Math.cos(angle) * 0.5;
        prong.rotation.x = -Math.sin(angle) * 0.5;

        emitterGroup.add(prong);
    }

    // A faint ring at the emitter, giving the pulse something to expand from
    const ringMaterial = new THREE.MeshBasicMaterial({
        color: new THREE.Color(0.7, 1.8, 0.4),
        transparent: true,
        opacity: 0.5
    });

    const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.75, 0.04, 6, 28),
        ringMaterial
    );
    ring.name = 'emitterRing';
    ring.rotation.x = Math.PI / 2;
    emitterGroup.add(ring);

    return platformGroup;
}

/**
 * Adds an empty marker at the point projectiles should spawn from.
 *
 * Using a marker object rather than per-type offset constants means the firing
 * code does not need to know which platform type it is dealing with - it just
 * asks the mesh where its muzzle is.
 *
 * @param {THREE.Object3D} parent - The barrel group to attach to
 * @param {number} y - Local height of the muzzle
 * @param {number} z - Local forward offset of the muzzle
 */
function addMuzzle(parent, y, z) {
    const muzzle = new THREE.Object3D();
    muzzle.name = 'muzzle';
    muzzle.position.set(0, y, z);
    parent.add(muzzle);
}

/**
 * Removes a platform from the scene
 * 
 * This will be used when platforms are sold or destroyed.
 * 
 * @param {object} platform - The platform to remove
 */
export function removePlatform(platform) {
    if (!platform || !platform.mesh) return;
    
    // Remove from scene
    scene.remove(platform.mesh);
    
    // Dispose of geometry and materials to free memory
    platform.mesh.traverse((child) => {
        if (child instanceof THREE.Mesh) {
            if (child.geometry) child.geometry.dispose();
            if (child.material) child.material.dispose();
        }
    });
    
    // Remove from platforms array
    const index = platforms.indexOf(platform);
    if (index > -1) {
        platforms.splice(index, 1);
    }
    
    // Mark as not alive
    platform.alive = false;
}

// ==================== ECONOMY ====================

/**
 * Whether the player can currently afford a platform type.
 *
 * @param {string} type - Platform type
 * @returns {boolean} True if the player has enough credits
 */
export function canAffordPlatform(type) {
    return canAfford(getPlatformConfig(type).cost);
}

/**
 * Sells a platform, refunding part of its cost.
 *
 * @param {object} platform - The platform to sell
 * @returns {number} Credits refunded (0 if the platform could not be sold)
 */
export function sellPlatform(platform) {
    if (!platform || !platform.alive) return 0;

    // The refund covers upgrades as well as the build cost, at the same rate.
    //
    // Without this, a heavily upgraded platform refunds exactly what a fresh
    // one does - so relocating a platform you have invested 300 credits in
    // costs you all of it, and the only rational play becomes never upgrading
    // anything you might want to move. Repositioning should be a real option.
    const refund = Math.floor(
        (platform.cost + getUpgradeInvestment(platform)) * SELL_REFUND_RATE
    );

    addCredits(refund, `sell_${platform.type}`);
    removePlatform(platform);

    return refund;
}

/**
 * What selling a platform would return, without selling it.
 *
 * Used by the selection panel so the button can name its own price.
 *
 * @param {object} platform
 * @returns {number} Credits the sale would refund
 */
export function getSellValue(platform) {
    if (!platform || !platform.alive) return 0;

    return Math.floor(
        (platform.cost + getUpgradeInvestment(platform)) * SELL_REFUND_RATE
    );
}

// ==================== COMBAT ====================

/**
 * Finds the enemy a platform should shoot at.
 *
 * Renamed from findClosestEnemyInRange() when targeting priorities arrived -
 * the old name described the only rule there used to be, and a function called
 * "closest" that deliberately returns the furthest-along enemy is a trap for
 * whoever reads it next.
 *
 * @param {object} platform - The platform doing the looking
 * @returns {object|null} The enemy to shoot at, or null if none are in range
 */
export function findTarget(platform) {
    return selectTarget(
        platform.targeting || DEFAULT_TARGETING,
        platform.position,
        platform.range
    );
}

/**
 * Change a platform's targeting priority.
 *
 * @param {object} platform
 * @param {string} mode - One of TARGETING_MODES
 * @returns {boolean} True if the mode was valid and applied
 */
export function setPlatformTargeting(platform, mode) {
    if (!platform || !isTargetingMode(mode)) return false;

    platform.targeting = mode;

    // Drop the current target so the new priority takes effect on the next
    // frame rather than after the platform finishes tracking its old one
    platform.currentTarget = null;

    return true;
}

/**
 * Builds the projectile a platform fires at its target.
 *
 * Returns data rather than creating the projectile directly, matching how the
 * starbase works: main.js owns projectile creation, which keeps platform.js
 * from depending on projectile.js.
 *
 * @param {object} platform - The firing platform
 * @param {object} target - The enemy being shot at
 * @returns {object} Projectile data for createProjectile()
 */
export function firePlatformProjectile(platform, target) {
    // The mesh carries a 'muzzle' marker at the barrel tip, so this works for
    // any platform type without knowing its geometry
    const muzzle = platform.mesh.getObjectByName('muzzle');
    const barrelTip = muzzle
        ? muzzle.getWorldPosition(new THREE.Vector3())
        : platform.position.clone();
    
    const direction = new THREE.Vector3()
        .subVectors(target.mesh.position, barrelTip)
        .normalize();
    
    createMuzzleSparks(barrelTip, direction);
    
    return {
        position: barrelTip,
        direction,
        damage: platform.damage,
        speed: platform.projectileSpeed,

        // Which kind of ordnance this platform fires. Read from config rather
        // than branched on platform.type, so adding a third platform type is a
        // config edit rather than a change here.
        projectileType: platform.projectileType,

        // Homing rounds need to know what they were aimed at. Lasers ignore it.
        target,

        // Carries the instance id, not just the type, so a hit can be
        // attributed back to the individual platform that fired it
        source: `platform:${platform.id}`
    };
}

/**
 * Updates every platform: acquire a target, turn toward it, and fire.
 *
 * @param {number} deltaTime - Time since last frame in seconds
 * @returns {Array<object>} Projectile data for every platform that fired
 */
export function updatePlatforms(deltaTime) {
    const firedProjectiles = [];

    for (const platform of platforms) {
        if (!platform.alive) continue;

        // Not every platform is a gun. A support platform has no target, no
        // barrel and nothing to fire - it applies an effect to an area - so the
        // acquire/aim/fire sequence below is one behaviour among several rather
        // than what every platform does.
        if (platform.behaviour === 'aura') {
            updateAuraPlatform(platform, deltaTime);
            continue;
        }

        const projectile = updateTurretPlatform(platform, deltaTime);
        if (projectile) firedProjectiles.push(projectile);
    }

    return firedProjectiles;
}

/**
 * Step a weapon platform: acquire a target, turn toward it, fire.
 *
 * @param {object} platform
 * @param {number} deltaTime
 * @returns {object|null} Projectile data if it fired
 */
function updateTurretPlatform(platform, deltaTime) {
    platform.timeSinceLastShot += deltaTime;

    const target = findTarget(platform);
    platform.currentTarget = target;

    if (!target) return null;

    const turret = platform.mesh.getObjectByName('turret');
    const isAimed = updateTurretAim(
        turret,
        platform.position,
        target.mesh.position,
        platform.rotationSpeed,
        deltaTime
    );

    if (isAimed && platform.timeSinceLastShot >= 1 / platform.fireRate) {
        platform.timeSinceLastShot = 0;
        platform.shotsFired++;
        return firePlatformProjectile(platform, target);
    }

    return null;
}

/**
 * Step a support platform: spin its rings, and periodically apply its effect to
 * everything inside its radius.
 *
 * The effect is applied on a tick rather than every frame. Re-stamping the same
 * status sixty times a second achieves nothing - applyStatus() refreshes rather
 * than stacks - and scanning every enemy from every aura platform every frame
 * is real work for no gain. The effect's duration is configured longer than the
 * tick interval so an enemy inside the field stays continuously affected rather
 * than flickering between ticks.
 *
 * @param {object} platform
 * @param {number} deltaTime
 */
function updateAuraPlatform(platform, deltaTime) {
    animateAuraVisual(platform, deltaTime);

    platform.timeSinceLastTick += deltaTime;
    if (platform.timeSinceLastTick < CONFIG.status.auraTickSeconds) return;

    platform.timeSinceLastTick = 0;
    platform.pulse = 1;

    const caught = getEnemiesInRange(platform.position, platform.range);

    // Reported in the selection panel, so a platform that does no damage still
    // has something to show for itself
    platform.affecting = caught.length;

    for (const enemy of caught) {
        const applied = applyStatus(enemy, platform.statusType, {
            duration: platform.duration,
            magnitude: platform.magnitude
        });

        if (applied) refreshStatusVisual(enemy);
    }
}

/**
 * Turn a support platform's rings.
 *
 * Opposed directions on purpose: matched rotation reads as one rigid object
 * turning, opposed rotation reads as a field being actively held open. A static
 * support platform looks broken, because unlike a weapon it has no projectile
 * to prove it is running.
 *
 * @param {object} platform
 * @param {number} deltaTime
 */
function animateAuraVisual(platform, deltaTime) {
    const rings = platform.mesh.getObjectByName('rings');

    if (rings) {
        const outer = rings.getObjectByName('ringOuter');
        const inner = rings.getObjectByName('ringInner');

        if (outer) outer.rotation.z += deltaTime * 0.9;
        if (inner) inner.rotation.z -= deltaTime * 1.6;
    }

    animateAuraPulse(platform, deltaTime);
}

/**
 * Run down the flash a support platform shows when it applies its effect.
 *
 * An aura ticks four times a second; without this the only difference between
 * a working Disruptor and a decorative one is a number in a panel the player
 * probably does not have open. The pulse is the platform saying "that was me".
 *
 * Decays rather than toggles, so the tick reads as a pulse travelling outward
 * instead of a light switching on and off.
 *
 * @param {object} platform
 * @param {number} deltaTime
 */
function animateAuraPulse(platform, deltaTime) {
    const emitter = platform.mesh.getObjectByName('emitter');
    if (!emitter) return;

    // Falls from 1 to 0 over about a third of a second - shorter than the tick
    // interval, so each pulse finishes before the next begins
    platform.pulse = Math.max(0, (platform.pulse || 0) - deltaTime * 3);

    const core = emitter.getObjectByName('emitterCore');
    const ring = emitter.getObjectByName('emitterRing');

    if (core) {
        const scale = 1 + platform.pulse * 0.45;
        core.scale.set(scale, scale, scale);
    }

    if (ring) {
        // The ring expands and fades as it goes, which is what sells it as
        // something leaving the platform rather than something on it
        const scale = 1 + platform.pulse * 1.1;
        ring.scale.set(scale, scale, scale);
        ring.material.opacity = 0.5 * (1 - platform.pulse * 0.7);
    }

    // Always turning, so the platform never looks switched off between pulses
    emitter.rotation.y += deltaTime * 0.6;
}

/**
 * Clears all platforms from the scene
 * 
 * Used when resetting the game or starting a new game.
 */
export function clearAllPlatforms() {
    // Create a copy of the array since we'll be modifying it
    const platformsToRemove = [...platforms];
    
    platformsToRemove.forEach(platform => {
        removePlatform(platform);
    });
    
    // Ensure array is empty
    platforms.length = 0;

    // A cleared board is a new run
    platformsBuiltThisRun = 0;
}

/**
 * How many platforms were built this run, including ones since sold.
 * @returns {number}
 */
export function getPlatformsBuilt() {
    return platformsBuiltThisRun;
}

/**
 * The platform that dealt the most damage this run.
 *
 * Only considers platforms still on the board - a sold one takes its record
 * with it. That is the honest answer to "which of your platforms earned its
 * place", which is the question the end-of-run summary is asking.
 *
 * Support platforms deal no damage and so can never win this, which is correct:
 * the stat is explicitly about damage dealt, and the panel labels it as such.
 *
 * @returns {object|null} The platform, or null if none dealt any damage
 */
export function getBestPlatform() {
    let best = null;

    for (const platform of platforms) {
        if (!platform.alive || !(platform.damageDealt > 0)) continue;
        if (!best || platform.damageDealt > best.damageDealt) best = platform;
    }

    return best;
}
