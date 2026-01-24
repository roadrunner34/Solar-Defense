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
import { getPlatformConfig, CONFIG } from './config.js';

// Store all active platforms
export const platforms = [];

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

// Shared geometries and materials (for performance - reuse instead of creating new ones)
// We'll create these when we need them, similar to how enemies work
const platformGeometries = {};
const platformMaterials = {};

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
    isValidPosition: false   // Is the current position valid for placement?
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
    
    console.log(`Placement preview created for ${type}`);
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
    const previewGroup = new THREE.Group();
    
    // Use the same geometry as the actual platform
    // but with transparent materials
    
    // === BASE PLATFORM ===
    const baseGeometry = new THREE.CylinderGeometry(2, 2.5, 0.5, 8);
    const baseMaterial = new THREE.MeshPhongMaterial({
        color: 0x00ff00,          // Start green (valid)
        emissive: 0x003300,
        transparent: true,
        opacity: 0.5,             // Semi-transparent
        flatShading: true
    });
    const base = new THREE.Mesh(baseGeometry, baseMaterial);
    base.name = 'previewBase';
    previewGroup.add(base);
    
    // === TURRET ===
    const turretGeometry = new THREE.BoxGeometry(1.5, 1, 1.5);
    const turretMaterial = new THREE.MeshPhongMaterial({
        color: 0x00ff00,
        emissive: 0x003300,
        transparent: true,
        opacity: 0.5
    });
    const turret = new THREE.Mesh(turretGeometry, turretMaterial);
    turret.position.y = 0.75;
    turret.name = 'previewTurret';
    previewGroup.add(turret);
    
    // === BARREL ===
    const barrelGeometry = new THREE.CylinderGeometry(0.2, 0.25, 2, 8);
    const barrelMaterial = new THREE.MeshPhongMaterial({
        color: 0x00ff00,
        emissive: 0x003300,
        transparent: true,
        opacity: 0.5
    });
    const barrel = new THREE.Mesh(barrelGeometry, barrelMaterial);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.z = 1;
    barrel.position.y = 0.5;
    barrel.name = 'previewBarrel';
    turret.add(barrel);
    
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
function createRangeIndicator(range) {
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
        if (child instanceof THREE.Mesh && child.material) {
            child.material.color.setHex(color);
            child.material.emissive.setHex(emissive);
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
        console.log('No active placement to confirm');
        return null;
    }
    
    // Validate position one more time
    const validationResult = isValidPlacementPosition(placementState.previewPosition);
    
    if (!validationResult.valid) {
        console.log(`Cannot place platform: ${validationResult.reason}`);
        return null;
    }
    
    // Create the actual platform
    const platform = createPlatform(
        placementState.selectedType,
        placementState.previewPosition.clone()
    );
    
    console.log(`Platform placed at (${platform.position.x.toFixed(1)}, ${platform.position.z.toFixed(1)})`);
    
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
        console.log('Placement cancelled');
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
    
    // Create the 3D mesh for visual representation
    // For Task 1.2, we use a simple box/cylinder as a placeholder
    // Task 1.3 and 1.4 will create distinct visuals for each type
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
        
        // Combat state (will be used in Task 3.x)
        timeSinceLastShot: 0,    // Track firing cooldown
        currentTarget: null,     // Currently targeted enemy
        
        // Platform ID for tracking
        id: platforms.length,     // Simple ID based on array index
        
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
    
    return platform;
}

/**
 * Creates a basic 3D mesh for a platform
 * 
 * For Task 1.2, we create a simple visual placeholder.
 * This will be replaced with distinct visuals in Tasks 1.3 and 1.4.
 * 
 * We use a simple box/cylinder combination to represent the platform.
 * 
 * @param {string} type - Platform type
 * @returns {THREE.Group} The platform mesh group
 */
function createPlatformMesh(type) {
    // Use a Group to combine multiple meshes (like starbase does)
    const platformGroup = new THREE.Group();
    
    // === BASE PLATFORM ===
    // A simple cylinder as the base
    const baseGeometry = new THREE.CylinderGeometry(2, 2.5, 0.5, 8);
    const baseMaterial = new THREE.MeshPhongMaterial({
        color: 0x666666,          // Gray base
        emissive: 0x111111,      // Slight glow
        flatShading: true
    });
    const base = new THREE.Mesh(baseGeometry, baseMaterial);
    platformGroup.add(base);
    
    // === TURRET ===
    // A simple box on top (will rotate to aim in Task 3.2)
    const turretGeometry = new THREE.BoxGeometry(1.5, 1, 1.5);
    const turretMaterial = new THREE.MeshPhongMaterial({
        color: 0x888888,          // Slightly lighter gray
        emissive: 0x222222
    });
    const turret = new THREE.Mesh(turretGeometry, turretMaterial);
    turret.position.y = 0.75;    // On top of base
    turret.name = 'turret';       // Named for easy access later
    platformGroup.add(turret);
    
    // === BARREL ===
    // A simple cylinder extending from turret
    const barrelGeometry = new THREE.CylinderGeometry(0.2, 0.25, 2, 8);
    const barrelMaterial = new THREE.MeshPhongMaterial({
        color: 0x555555,          // Darker gray
        emissive: 0x111111
    });
    const barrel = new THREE.Mesh(barrelGeometry, barrelMaterial);
    barrel.rotation.x = Math.PI / 2; // Point forward (Z direction)
    barrel.position.z = 1;        // Extend from turret
    barrel.position.y = 0.5;
    barrel.name = 'barrel';       // Named for easy access later
    turret.add(barrel);
    
    return platformGroup;
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
}
