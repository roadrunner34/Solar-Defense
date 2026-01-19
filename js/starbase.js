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
 * - A base platform (the main body)
 * - A turret that rotates to aim
 * - A barrel that fires projectiles
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

/**
 * Creates the starbase
 * @returns {THREE.Group} The starbase group containing all parts
 */
export function createStarbase() {
    // Use a Group to combine multiple meshes
    starbase = new THREE.Group();
    
    // === BASE PLATFORM ===
    // A hexagonal platform that floats around the planet
    const baseGeometry = new THREE.CylinderGeometry(3, 3.5, 1, 6);
    const baseMaterial = new THREE.MeshPhongMaterial({
        color: 0x4488aa,
        emissive: 0x112233,
        flatShading: true
    });
    const base = new THREE.Mesh(baseGeometry, baseMaterial);
    starbase.add(base);
    
    // === TURRET BODY ===
    // Sits on top of the base, rotates to track enemies automatically
    const turretGeometry = new THREE.BoxGeometry(2, 1.5, 2);
    const turretMaterial = new THREE.MeshPhongMaterial({
        color: 0x336688,
        emissive: 0x112244
    });
    const turret = new THREE.Mesh(turretGeometry, turretMaterial);
    turret.position.y = 1; // On top of base
    turret.name = 'turret'; // Named so we can find it later
    starbase.add(turret);
    
    // === BARREL ===
    // The cannon that fires projectiles
    const barrelGeometry = new THREE.CylinderGeometry(0.3, 0.4, 4, 8);
    const barrelMaterial = new THREE.MeshPhongMaterial({
        color: 0x445566,
        emissive: 0x222233
    });
    const barrel = new THREE.Mesh(barrelGeometry, barrelMaterial);
    barrel.rotation.x = Math.PI / 2; // Point forward (Z direction)
    barrel.position.z = 2; // Extend from turret
    barrel.position.y = 0.2;
    barrel.name = 'barrel';
    turret.add(barrel);
    
    // === DECORATIVE ELEMENTS ===
    // Add some detail to make it look more interesting
    
    // Antenna
    const antennaGeometry = new THREE.CylinderGeometry(0.05, 0.05, 1.5, 8);
    const antennaMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    const antenna = new THREE.Mesh(antennaGeometry, antennaMaterial);
    antenna.position.set(0.8, 1.5, -0.5);
    turret.add(antenna);
    
    // Glowing tip
    const tipGeometry = new THREE.SphereGeometry(0.1, 8, 8);
    const tipMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    const tip = new THREE.Mesh(tipGeometry, tipMaterial);
    tip.position.y = 0.75;
    antenna.add(tip);
    
    // === POSITIONING ===
    // Place starbase at orbit around planet
    starbase.position.set(0, 8, 0); // Above the planet
    
    // Store stats on the object for easy access
    starbase.userData.stats = stats;
    
    scene.add(starbase);
    
    return starbase;
}

/**
 * Update starbase each frame
 * Automatically finds closest enemy, rotates to face it, and fires
 * @param {number} deltaTime - Time since last frame in seconds
 * @returns {object|null} Projectile data if fired, null otherwise
 */
export function updateStarbase(deltaTime) {
    if (!starbase) return null;
    
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
    const barrel = turret.getObjectByName('barrel');
    
    // Get world position of barrel tip
    const barrelTip = new THREE.Vector3(0, 0, 2); // Local position of barrel end
    barrel.localToWorld(barrelTip);
    
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
