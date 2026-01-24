/**
 * starbase.js - Player Starbase
 * 
 * The starbase is the player's main weapon platform, positioned at the center
 * orbiting the planet. It AUTOMATICALLY targets and fires at the closest enemy.
 * 
 * This is standard tower defense behavior - the player focuses on strategy
 * (placement, upgrades) while weapons handle the aiming and shooting.
 * 
 * The starbase consists of:
 * - A multi-layered base platform with glowing accents
 * - A detailed turret that rotates to aim with status lights
 * - An energy barrel with glowing coils
 * - Multiple decorative elements (antennas, energy conduits, lights)
 * - Animated visual effects (pulsing glows, rotating elements)
 */

import * as THREE from 'three';
import { scene } from './scene.js';
import { CONFIG } from './config.js';
import { getClosestEnemy } from './enemy.js';

// Import smooth animation utilities
// dampAngle provides frame-rate independent smooth rotation
import { dampAngle } from './mathUtils.js';

// Import particle effects for muzzle sparks
import { createMuzzleSparks } from './particles.js';

export let starbase = null;

// Starbase stats (can be upgraded later)
let stats = {
    damage: CONFIG.starbase.damage,
    fireRate: CONFIG.starbase.fireRate,
    rotationSpeed: CONFIG.starbase.rotationSpeed,
    projectileSpeed: CONFIG.starbase.projectileSpeed,
    range: CONFIG.starbase.range
};

// Firing state
let timeSinceLastShot = 0;

// Current target (for smooth tracking)
let currentTarget = null;

// Animation state for visual effects
let animationTime = 0;

// Store references to animated elements for the update loop
let animatedElements = {
    energyCoils: [],
    barrelGlowMaterial: null
};

/**
 * Creates the starbase with enhanced visuals
 * 
 * The starbase is built in layers:
 * 1. Multi-tiered base platform with glowing edges
 * 2. Detailed turret body with panel details and status lights
 * 3. Energy barrel with glowing coils and muzzle details
 * 4. Decorative elements (antennas, conduits, lights)
 * 
 * @returns {THREE.Group} The starbase group containing all parts
 */
export function createStarbase() {
    // Use a Group to combine multiple meshes
    starbase = new THREE.Group();
    
    // Reset animated elements
    animatedElements = {
        energyCoils: [],
        barrelGlowMaterial: null
    };
    
    // ========================================
    // === ENHANCED BASE PLATFORM (LAYERED) ===
    // ========================================
    // Build a multi-tiered base for a more substantial look
    
    // Bottom layer - wider foundation with subtle glow
    const baseBottomGeometry = new THREE.CylinderGeometry(4, 4.5, 0.4, 8);
    const baseBottomMaterial = new THREE.MeshPhongMaterial({
        color: 0x4a4a4a,
        emissive: new THREE.Color(0.03, 0.03, 0.03),
        flatShading: true
    });
    const baseBottom = new THREE.Mesh(baseBottomGeometry, baseBottomMaterial);
    baseBottom.position.y = -0.3;
    starbase.add(baseBottom);
    
    // Bottom glow ring - removed for less glowing
    
    // Middle layer - main hexagonal platform
    const baseMiddleGeometry = new THREE.CylinderGeometry(3.2, 3.8, 0.6, 6);
    const baseMiddleMaterial = new THREE.MeshPhongMaterial({
        color: 0x5a5a5a,
        emissive: new THREE.Color(0.05, 0.05, 0.05),
        flatShading: true,
        shininess: 30
    });
    const baseMiddle = new THREE.Mesh(baseMiddleGeometry, baseMiddleMaterial);
    baseMiddle.position.y = 0.2;
    starbase.add(baseMiddle);
    
    // Middle glow ring - removed for less glowing
    
    // Top layer - smaller platform for turret mount
    const baseTopGeometry = new THREE.CylinderGeometry(2.5, 3, 0.5, 6);
    const baseTopMaterial = new THREE.MeshPhongMaterial({
        color: 0x6a6a6a,
        emissive: new THREE.Color(0.06, 0.06, 0.06),
        flatShading: true,
        shininess: 40
    });
    const baseTop = new THREE.Mesh(baseTopGeometry, baseTopMaterial);
    baseTop.position.y = 0.75;
    starbase.add(baseTop);
    
    // === CORNER STRUCTURAL SUPPORTS ===
    // Add vertical supports at hexagon corners for detail
    for (let i = 0; i < 6; i++) {
        const angle = (i / 6) * Math.PI * 2;
        const radius = 3.3;
        
        // Vertical support pillar
        const supportGeometry = new THREE.CylinderGeometry(0.15, 0.2, 1.2, 6);
        const supportMaterial = new THREE.MeshPhongMaterial({
            color: 0x6a6a6a,
            emissive: new THREE.Color(0.03, 0.03, 0.03)
        });
        const support = new THREE.Mesh(supportGeometry, supportMaterial);
        support.position.set(
            Math.cos(angle) * radius,
            0.3,
            Math.sin(angle) * radius
        );
        starbase.add(support);
        
        // No lights on supports - removed for less glowing
    }
    
    // === ROTATING ENERGY RING ===
    // Removed for less glowing
    
    // ===================================
    // === ENHANCED TURRET BODY ===
    // ===================================
    // Create a group for the turret so we can add details
    const turret = new THREE.Group();
    turret.position.y = 1.2;
    turret.name = 'turret';
    starbase.add(turret);
    
    // Main turret body - octagonal for more interesting shape
    const turretGeometry = new THREE.CylinderGeometry(1.3, 1.5, 1.2, 8);
    const turretMaterial = new THREE.MeshPhongMaterial({
        color: 0x5a5a5a,
        emissive: new THREE.Color(0.05, 0.05, 0.05),
        shininess: 50
    });
    const turretBody = new THREE.Mesh(turretGeometry, turretMaterial);
    turret.add(turretBody);
    
    // Turret top cap - slightly smaller
    const turretCapGeometry = new THREE.CylinderGeometry(1.1, 1.3, 0.3, 8);
    const turretCapMaterial = new THREE.MeshPhongMaterial({
        color: 0x6a6a6a,
        emissive: new THREE.Color(0.06, 0.06, 0.06),
        shininess: 60
    });
    const turretCap = new THREE.Mesh(turretCapGeometry, turretCapMaterial);
    turretCap.position.y = 0.75;
    turret.add(turretCap);
    
    // === TURRET PANEL DETAILS ===
    // Add recessed panel details around the turret
    for (let i = 0; i < 4; i++) {
        const angle = (i / 4) * Math.PI * 2 + Math.PI / 4;
        
        // Panel recess (darker inset)
        const panelGeometry = new THREE.BoxGeometry(0.6, 0.5, 0.1);
        const panelMaterial = new THREE.MeshPhongMaterial({
            color: 0x3a3a3a,
            emissive: new THREE.Color(0.01, 0.01, 0.01)
        });
        const panel = new THREE.Mesh(panelGeometry, panelMaterial);
        panel.position.set(
            Math.cos(angle) * 1.35,
            0,
            Math.sin(angle) * 1.35
        );
        panel.rotation.y = -angle;
        turret.add(panel);
        
        // No glowing indicators on panels - removed for less glowing
    }
    
    // === TURRET SIDE LIGHTS ===
    // Removed for less glowing
    
    // ===================================
    // === ENHANCED BARREL WITH ENERGY COILS ===
    // ===================================
    // Create a group for the barrel assembly
    const barrelGroup = new THREE.Group();
    barrelGroup.position.z = 1.2;
    barrelGroup.position.y = 0.3;
    barrelGroup.name = 'barrel';
    turret.add(barrelGroup);
    
    // Main barrel - longer and more detailed
    const barrelGeometry = new THREE.CylinderGeometry(0.25, 0.35, 3.5, 12);
    const barrelMaterial = new THREE.MeshPhongMaterial({
        color: 0x4a4a4a,
        emissive: new THREE.Color(0.03, 0.03, 0.03),
        shininess: 70
    });
    const barrel = new THREE.Mesh(barrelGeometry, barrelMaterial);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.z = 1.5;
    barrelGroup.add(barrel);
    
    // Barrel base mount (where it connects to turret)
    const barrelMountGeometry = new THREE.CylinderGeometry(0.5, 0.4, 0.6, 8);
    const barrelMountMaterial = new THREE.MeshPhongMaterial({
        color: 0x5a5a5a,
        emissive: new THREE.Color(0.04, 0.04, 0.04)
    });
    const barrelMount = new THREE.Mesh(barrelMountGeometry, barrelMountMaterial);
    barrelMount.rotation.x = Math.PI / 2;
    barrelMount.position.z = 0;
    barrelGroup.add(barrelMount);
    
    // === ENERGY COILS AROUND BARREL ===
    // Reduced to just one subtle coil near the muzzle
    const coilGeometry = new THREE.TorusGeometry(0.4, 0.04, 8, 16);
    const coilMaterial = new THREE.MeshBasicMaterial({
        color: new THREE.Color(0.6, 0.55, 0.5), // Very subtle warm gray
        transparent: true,
        opacity: 0.2
    });
    const coil = new THREE.Mesh(coilGeometry, coilMaterial);
    coil.position.z = 2.4;
    barrelGroup.add(coil);
    animatedElements.energyCoils.push({ mesh: coil, material: coilMaterial, phase: 0 });
    
    // === MUZZLE DETAILS ===
    // Subtle energy focus ring at barrel tip (only visible when charging)
    const muzzleRingGeometry = new THREE.TorusGeometry(0.35, 0.06, 8, 16);
    const muzzleRingMaterial = new THREE.MeshBasicMaterial({
        color: new THREE.Color(0.8, 0.7, 0.6), // Subtle warm white
        transparent: true,
        opacity: 0.2 // Very subtle, only visible when charging
    });
    const muzzleRing = new THREE.Mesh(muzzleRingGeometry, muzzleRingMaterial);
    muzzleRing.position.z = 3.3;
    barrelGroup.add(muzzleRing);
    animatedElements.barrelGlowMaterial = muzzleRingMaterial;
    
    // Removed inner muzzle glow for less glowing
    
    // ===================================
    // === DECORATIVE ELEMENTS ===
    // ===================================
    
    // === MULTIPLE ANTENNAS ===
    // Main communication antenna (taller)
    const mainAntennaGeometry = new THREE.CylinderGeometry(0.04, 0.06, 2, 8);
    const antennaMaterial = new THREE.MeshPhongMaterial({
        color: 0x6a6a6a,
        emissive: new THREE.Color(0.03, 0.03, 0.03)
    });
    const mainAntenna = new THREE.Mesh(mainAntennaGeometry, antennaMaterial);
    mainAntenna.position.set(0.9, 1.5, -0.6);
    turret.add(mainAntenna);
    
    // Main antenna tip - very subtle, non-glowing
    const mainTipGeometry = new THREE.SphereGeometry(0.12, 8, 8);
    const mainTipMaterial = new THREE.MeshPhongMaterial({
        color: 0x8a6a5a, // Muted brown/orange, no glow
        emissive: new THREE.Color(0.01, 0.01, 0.01)
    });
    const mainTip = new THREE.Mesh(mainTipGeometry, mainTipMaterial);
    mainTip.position.y = 1.1;
    mainAntenna.add(mainTip);
    
    // Secondary antenna (shorter, different position)
    const secondAntennaGeometry = new THREE.CylinderGeometry(0.03, 0.05, 1.2, 8);
    const secondAntenna = new THREE.Mesh(secondAntennaGeometry, antennaMaterial);
    secondAntenna.position.set(-0.7, 1.2, -0.5);
    turret.add(secondAntenna);
    
    // Secondary antenna tip - very subtle, non-glowing
    const secondTipGeometry = new THREE.SphereGeometry(0.08, 8, 8);
    const secondTipMaterial = new THREE.MeshPhongMaterial({
        color: 0x6a7a6a, // Muted gray-green, no glow
        emissive: new THREE.Color(0.01, 0.01, 0.01)
    });
    const secondTip = new THREE.Mesh(secondTipGeometry, secondTipMaterial);
    secondTip.position.y = 0.7;
    secondAntenna.add(secondTip);
    
    // === ENERGY CONDUITS ===
    // Non-glowing structural pipes
    const conduitGeometry = new THREE.CylinderGeometry(0.06, 0.06, 1.5, 8);
    const conduitMaterial = new THREE.MeshPhongMaterial({
        color: 0x5a5a5a, // Neutral gray, no glow
        emissive: new THREE.Color(0.01, 0.01, 0.01)
    });
    
    // Left conduit
    const leftConduit = new THREE.Mesh(conduitGeometry, conduitMaterial);
    leftConduit.position.set(-1.0, 0.3, 0.8);
    leftConduit.rotation.x = Math.PI / 4;
    turret.add(leftConduit);
    
    // Right conduit
    const rightConduit = new THREE.Mesh(conduitGeometry, conduitMaterial);
    rightConduit.position.set(1.0, 0.3, 0.8);
    rightConduit.rotation.x = Math.PI / 4;
    turret.add(rightConduit);
    
    // ===================================
    // === POSITIONING ===
    // ===================================
    // Place starbase at orbit around planet
    starbase.position.set(0, 8, 0); // Above the planet
    
    // Store stats on the object for easy access
    starbase.userData.stats = stats;
    
    scene.add(starbase);
    
    return starbase;
}

/**
 * Updates the starbase visual effects
 * Called every frame to animate glowing elements, rotating parts, etc.
 * 
 * @param {number} deltaTime - Time since last frame in seconds
 */
function updateStarbaseVisuals(deltaTime) {
    if (!starbase) return;
    
    // Update animation time
    animationTime += deltaTime;
    
    // === PULSING ENERGY COILS ===
    // Only one subtle coil now, pulses very gently
    animatedElements.energyCoils.forEach(coil => {
        const pulse = 0.15 + 0.05 * Math.sin(animationTime * 2 + coil.phase);
        coil.material.opacity = pulse;
    });
    
    // === BARREL MUZZLE GLOW ===
    // Muzzle glows very subtly when close to firing
    if (animatedElements.barrelGlowMaterial) {
        const fireInterval = 1 / stats.fireRate;
        const chargeProgress = Math.min(timeSinceLastShot / fireInterval, 1);
        // Very subtle glow that only becomes slightly visible when charging
        const baseGlow = 0.1;
        const chargeGlow = 0.15 * chargeProgress;
        animatedElements.barrelGlowMaterial.opacity = baseGlow + chargeGlow;
        
        // Keep color subtle
        const r = 0.6 + 0.2 * chargeProgress;
        const g = 0.55 + 0.15 * chargeProgress;
        const b = 0.5 + 0.1 * chargeProgress;
        animatedElements.barrelGlowMaterial.color.setRGB(r, g, b);
    }
}

/**
 * Update starbase each frame
 * Automatically finds closest enemy, rotates to face it, and fires
 * Also updates visual effects (pulsing glows, rotating elements)
 * 
 * @param {number} deltaTime - Time since last frame in seconds
 * @returns {object|null} Projectile data if fired, null otherwise
 */
export function updateStarbase(deltaTime) {
    if (!starbase) return null;
    
    // Update visual effects (pulsing, rotating, etc.)
    updateStarbaseVisuals(deltaTime);
    
    // Get the turret (the part that rotates)
    const turret = starbase.getObjectByName('turret');
    if (!turret) return null;
    
    // === FIND TARGET ===
    // Get the closest enemy within range
    const starbasePosition = starbase.position;
    currentTarget = getClosestEnemy(starbasePosition, stats.range);
    
    // === AUTO-AIM ===
    // If we have a target, rotate to face it
    let isAimed = false;
    
    if (currentTarget && currentTarget.alive) {
        // Calculate direction to target
        const targetPosition = currentTarget.mesh.position;
        const directionToTarget = new THREE.Vector3()
            .subVectors(targetPosition, starbasePosition);
        
        // Calculate the angle we need to face (on the Y axis / horizontal plane)
        // atan2 gives us the angle from the Z-axis to our target
        const targetAngle = Math.atan2(directionToTarget.x, directionToTarget.z);
        
        // === SMOOTH ROTATION WITH DAMPING ===
        // Use dampAngle for buttery-smooth, frame-rate independent rotation!
        // 
        // The 'lambda' parameter (12 here) controls how fast the turret tracks:
        // - Lower values (5-8): Slow, dramatic tracking
        // - Medium values (10-15): Responsive but smooth
        // - Higher values (20+): Snappy, almost instant
        //
        // dampAngle automatically handles the angle wrapping problem (where
        // -180° and 180° are the same angle) and always takes the shortest path.
        const lambda = stats.rotationSpeed * 3; // Scale rotation speed to lambda
        turret.rotation.y = dampAngle(turret.rotation.y, targetAngle, lambda, deltaTime);
        
        // Calculate remaining angle difference for aim check
        let angleDiff = targetAngle - turret.rotation.y;
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
        
        // Consider "aimed" if we're within 5 degrees (0.087 radians)
        isAimed = Math.abs(angleDiff) < 0.087;
    }
    
    // === FIRING ===
    // Update fire cooldown
    timeSinceLastShot += deltaTime;
    
    const fireInterval = 1 / stats.fireRate; // Convert rate to interval
    
    // Only fire if:
    // 1. We have a target
    // 2. We're aimed at them
    // 3. Cooldown has elapsed
    if (currentTarget && isAimed && timeSinceLastShot >= fireInterval) {
        timeSinceLastShot = 0;
        return fireProjectile(turret, currentTarget);
    }
    
    return null;
}

/**
 * Fire a projectile from the starbase toward a target
 * @param {THREE.Object3D} turret - The turret object
 * @param {object} target - The enemy we're shooting at
 * @returns {object} Projectile data (position, direction, damage, speed)
 */
function fireProjectile(turret, target) {
    const barrelGroup = turret.getObjectByName('barrel');
    
    // Get world position of barrel tip
    // The barrel group extends to z=3.35 (muzzle position)
    const barrelTip = new THREE.Vector3(0, 0, 3.5); // Local position of barrel end
    barrelGroup.localToWorld(barrelTip);
    
    // Calculate direction TO the target (not just where turret faces)
    // This ensures accuracy even with slight aim differences
    const direction = new THREE.Vector3()
        .subVectors(target.mesh.position, barrelTip)
        .normalize();
    
    // Add visual muzzle flash (glowing sphere effect)
    createMuzzleFlash(barrelTip);
    
    // Add particle sparks for extra visual flair!
    createMuzzleSparks(barrelTip, direction);
    
    // Return projectile data for the projectile system to create the actual projectile
    return {
        position: barrelTip,
        direction: direction,
        damage: stats.damage,
        speed: stats.projectileSpeed,
        source: 'starbase'
    };
}

/**
 * Create a brief muzzle flash effect
 * 
 * With bloom post-processing, we use bright HDR colors (values > 1) to make
 * the muzzle flash really POP! The bloom effect picks up these bright areas
 * and makes them "bleed" light - giving that satisfying sci-fi weapon feel.
 * 
 * @param {THREE.Vector3} position - Where to create the flash
 */
function createMuzzleFlash(position) {
    // Bright core flash - this is the main burst of light
    const flashGeometry = new THREE.SphereGeometry(0.6, 12, 12);
    const flashMaterial = new THREE.MeshBasicMaterial({
        color: new THREE.Color(0, 3, 4), // Bright cyan - HDR values for maximum bloom!
        transparent: true,
        opacity: 1
    });
    const flash = new THREE.Mesh(flashGeometry, flashMaterial);
    flash.position.copy(position);
    scene.add(flash);
    
    // Outer glow ring for extra effect
    const ringGeometry = new THREE.RingGeometry(0.3, 0.8, 16);
    const ringMaterial = new THREE.MeshBasicMaterial({
        color: new THREE.Color(0, 2, 2.5), // Slightly dimmer cyan glow
        transparent: true,
        opacity: 0.8,
        side: THREE.DoubleSide
    });
    const ring = new THREE.Mesh(ringGeometry, ringMaterial);
    ring.position.copy(position);
    scene.add(ring);
    
    // Animate and remove the flash
    let opacity = 1;
    let ringOpacity = 0.8;
    
    const animate = () => {
        opacity -= 0.12;
        ringOpacity -= 0.1;
        
        // Flash expands and fades
        flash.scale.multiplyScalar(1.25);
        flashMaterial.opacity = Math.max(0, opacity);
        
        // Ring expands slower
        ring.scale.multiplyScalar(1.15);
        ringMaterial.opacity = Math.max(0, ringOpacity);
        
        if (opacity > 0 || ringOpacity > 0) {
            requestAnimationFrame(animate);
        } else {
            scene.remove(flash);
            scene.remove(ring);
            flashGeometry.dispose();
            flashMaterial.dispose();
            ringGeometry.dispose();
            ringMaterial.dispose();
        }
    };
    requestAnimationFrame(animate);
}

/**
 * Get the starbase's current target
 * @returns {object|null} Current target enemy or null
 */
export function getCurrentTarget() {
    return currentTarget;
}

/**
 * Get the starbase's current stats
 * @returns {object} Stats object
 */
export function getStarbaseStats() {
    return { ...stats };
}

/**
 * Upgrade a starbase stat
 * @param {string} stat - Which stat to upgrade (damage, fireRate, rotationSpeed)
 * @param {number} amount - Amount to add
 */
export function upgradeStarbase(stat, amount) {
    if (stats.hasOwnProperty(stat)) {
        stats[stat] += amount;
        if (starbase) {
            starbase.userData.stats = stats;
        }
    }
}

/**
 * Reset starbase stats to default
 */
export function resetStarbaseStats() {
    stats = {
        damage: CONFIG.starbase.damage,
        fireRate: CONFIG.starbase.fireRate,
        rotationSpeed: CONFIG.starbase.rotationSpeed,
        projectileSpeed: CONFIG.starbase.projectileSpeed,
        range: CONFIG.starbase.range
    };
    if (starbase) {
        starbase.userData.stats = stats;
    }
    currentTarget = null;
    animationTime = 0; // Reset animation time for visual effects
}

/**
 * Get the position of the starbase
 * @returns {THREE.Vector3} Position
 */
export function getStarbasePosition() {
    return starbase ? starbase.position.clone() : new THREE.Vector3();
}

/**
 * Get the firing direction of the starbase
 * @returns {THREE.Vector3} Normalized direction vector
 */
export function getStarbaseAimDirection() {
    if (!starbase) return new THREE.Vector3(0, 0, 1);
    
    const turret = starbase.getObjectByName('turret');
    if (!turret) return new THREE.Vector3(0, 0, 1);
    
    const direction = new THREE.Vector3(0, 0, 1);
    direction.applyQuaternion(turret.getWorldQuaternion(new THREE.Quaternion()));
    return direction.normalize();
}
