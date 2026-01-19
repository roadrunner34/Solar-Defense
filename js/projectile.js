/**
 * projectile.js - Projectile System
 * 
 * Handles all projectiles in the game:
 * - Creating projectiles (lasers, missiles, etc.)
 * - Moving projectiles each frame
 * - Detecting collisions with enemies
 * - Cleaning up projectiles that miss
 * 
 * Projectiles are lightweight objects that travel in a straight line
 * until they hit something or go out of bounds.
 */

import * as THREE from 'three';
import { scene } from './scene.js';
import { CONFIG } from './config.js';
import { enemies, damageEnemy } from './enemy.js';

// Store all active projectiles
export const projectiles = [];

// Shared geometry for laser projectiles (performance optimization)
const laserGeometry = new THREE.CylinderGeometry(0.1, 0.1, CONFIG.visual.projectileLength, 8);

// Create a bright, glowing laser material for bloom effect
// Using HDR colors (values > 1) makes the bloom effect pick up the projectile
// and create that beautiful "energy beam" glow you see in sci-fi games!
const laserMaterial = new THREE.MeshBasicMaterial({
    color: new THREE.Color(0, 2, 2.5), // Bright cyan - HDR values for strong bloom glow!
    transparent: true,
    opacity: 0.95
});

// Maximum distance before projectiles are removed
const MAX_DISTANCE = 150;

/**
 * Create a new projectile
 * @param {object} data - Projectile data from weapon
 * @param {THREE.Vector3} data.position - Starting position
 * @param {THREE.Vector3} data.direction - Direction of travel
 * @param {number} data.damage - Damage on hit
 * @param {number} data.speed - Travel speed
 * @param {string} data.source - What fired it (starbase, platform, etc.)
 * @returns {object} The created projectile
 */
export function createProjectile(data) {
    // Create the visual mesh
    const mesh = new THREE.Mesh(laserGeometry, laserMaterial.clone());
    
    // Position at spawn point
    mesh.position.copy(data.position);
    
    // Rotate to point in direction of travel
    // Cylinders are vertical by default, so we need to rotate
    mesh.quaternion.setFromUnitVectors(
        new THREE.Vector3(0, 1, 0), // Default up direction
        data.direction.clone().normalize()
    );
    
    // Add a glow effect using a point light
    const glow = new THREE.PointLight(CONFIG.visual.projectileColor, 0.5, 5);
    mesh.add(glow);
    
    // Create projectile data object
    const projectile = {
        mesh,
        direction: data.direction.clone().normalize(),
        speed: data.speed,
        damage: data.damage,
        source: data.source,
        distanceTraveled: 0,
        alive: true
    };
    
    // Store reference for collision detection
    mesh.userData.projectile = projectile;
    
    // Add to scene and tracking array
    scene.add(mesh);
    projectiles.push(projectile);
    
    return projectile;
}

/**
 * Update all projectiles
 * Moves projectiles and checks for collisions
 * @param {number} deltaTime - Time since last frame in seconds
 * @returns {Array} Array of hit results (enemy, damage, position)
 */
export function updateProjectiles(deltaTime) {
    const hits = [];
    
    for (let i = projectiles.length - 1; i >= 0; i--) {
        const projectile = projectiles[i];
        
        if (!projectile.alive) continue;
        
        // Calculate movement
        const moveDistance = projectile.speed * deltaTime;
        const movement = projectile.direction.clone().multiplyScalar(moveDistance);
        
        // Store old position for collision ray
        const oldPosition = projectile.mesh.position.clone();
        
        // Move projectile
        projectile.mesh.position.add(movement);
        projectile.distanceTraveled += moveDistance;
        
        // Check for collisions using raycast between old and new position
        const hit = checkProjectileCollision(projectile, oldPosition, projectile.mesh.position);
        
        if (hit) {
            hits.push(hit);
            removeProjectile(projectile, i);
            continue;
        }
        
        // Remove if traveled too far
        if (projectile.distanceTraveled > MAX_DISTANCE) {
            removeProjectile(projectile, i);
        }
    }
    
    return hits;
}

/**
 * Check if a projectile hit any enemy
 * Uses simple distance checking for performance
 * @param {object} projectile - The projectile to check
 * @param {THREE.Vector3} oldPos - Position before movement
 * @param {THREE.Vector3} newPos - Position after movement
 * @returns {object|null} Hit info or null if no hit
 */
function checkProjectileCollision(projectile, oldPos, newPos) {
    // Check each enemy
    for (const enemy of enemies) {
        if (!enemy.alive) continue;
        
        const enemyPos = enemy.mesh.position;
        const enemyRadius = enemy.mesh.scale.x * 1.5; // Approximate hit radius
        
        // Simple point-to-point distance check
        // For better accuracy, we could use line-sphere intersection
        const distToEnemy = newPos.distanceTo(enemyPos);
        
        if (distToEnemy < enemyRadius) {
            // Hit! Apply damage
            const destroyed = damageEnemy(enemy, projectile.damage);
            
            return {
                enemy,
                damage: projectile.damage,
                destroyed,
                position: newPos.clone(),
                creditValue: destroyed ? enemy.creditValue : 0,
                pointValue: destroyed ? enemy.pointValue : 0
            };
        }
        
        // Also check if projectile passed through enemy (for fast projectiles)
        // Using closest point on line segment to enemy center
        const closestPoint = closestPointOnSegment(oldPos, newPos, enemyPos);
        if (closestPoint.distanceTo(enemyPos) < enemyRadius) {
            const destroyed = damageEnemy(enemy, projectile.damage);
            
            return {
                enemy,
                damage: projectile.damage,
                destroyed,
                position: closestPoint.clone(),
                creditValue: destroyed ? enemy.creditValue : 0,
                pointValue: destroyed ? enemy.pointValue : 0
            };
        }
    }
    
    return null;
}

/**
 * Find the closest point on a line segment to a target point
 * Used for accurate collision detection with fast projectiles
 * @param {THREE.Vector3} segStart - Start of line segment
 * @param {THREE.Vector3} segEnd - End of line segment
 * @param {THREE.Vector3} point - Point to find closest position to
 * @returns {THREE.Vector3} Closest point on the segment
 */
function closestPointOnSegment(segStart, segEnd, point) {
    const segment = new THREE.Vector3().subVectors(segEnd, segStart);
    const toPoint = new THREE.Vector3().subVectors(point, segStart);
    
    const segmentLength = segment.length();
    if (segmentLength === 0) return segStart.clone();
    
    segment.normalize();
    
    let projection = toPoint.dot(segment);
    projection = Math.max(0, Math.min(segmentLength, projection));
    
    return segStart.clone().add(segment.multiplyScalar(projection));
}

/**
 * Remove a projectile from the game
 * @param {object} projectile - Projectile to remove
 * @param {number} index - Index in projectiles array
 */
function removeProjectile(projectile, index) {
    projectile.alive = false;
    
    // Remove from scene
    scene.remove(projectile.mesh);
    
    // Dispose of cloned material
    if (projectile.mesh.material) {
        projectile.mesh.material.dispose();
    }
    
    // Remove from array
    projectiles.splice(index, 1);
}

/**
 * Clear all projectiles
 * Used when restarting or changing levels
 */
export function clearProjectiles() {
    for (let i = projectiles.length - 1; i >= 0; i--) {
        removeProjectile(projectiles[i], i);
    }
}

/**
 * Get count of active projectiles
 * @returns {number} Number of active projectiles
 */
export function getProjectileCount() {
    return projectiles.filter(p => p.alive).length;
}

/**
 * Create a hit effect at a position
 * Visual feedback when projectile hits enemy
 * 
 * With bloom, we use bright HDR colors to create a glowing explosion effect.
 * The bloom post-processing will pick up these bright colors and make them
 * "bleed" light into the surrounding area - very satisfying!
 * 
 * @param {THREE.Vector3} position - Where the hit occurred
 */
export function createHitEffect(position) {
    // Create a bright glowing sphere at the hit point (flash effect)
    const flashGeometry = new THREE.SphereGeometry(0.5, 16, 16);
    const flashMaterial = new THREE.MeshBasicMaterial({
        color: new THREE.Color(3, 2, 0.5), // Bright yellow-white flash (HDR for bloom!)
        transparent: true,
        opacity: 1
    });
    const flash = new THREE.Mesh(flashGeometry, flashMaterial);
    flash.position.copy(position);
    scene.add(flash);
    
    // Create expanding ring effect
    const ringGeometry = new THREE.RingGeometry(0.1, 0.4, 24);
    const ringMaterial = new THREE.MeshBasicMaterial({
        color: new THREE.Color(2, 1.5, 0), // Bright gold/orange ring (HDR for bloom!)
        transparent: true,
        opacity: 1,
        side: THREE.DoubleSide
    });
    const ring = new THREE.Mesh(ringGeometry, ringMaterial);
    ring.position.copy(position);
    
    // Make ring face camera (billboarding would be better but this works)
    ring.rotation.x = -Math.PI / 4;
    
    scene.add(ring);
    
    // Animate expansion and fade
    let scale = 1;
    let opacity = 1;
    let flashOpacity = 1;
    
    const animate = () => {
        scale += 0.4;
        opacity -= 0.08;
        flashOpacity -= 0.15; // Flash fades faster
        
        // Update ring
        ring.scale.set(scale, scale, scale);
        ringMaterial.opacity = Math.max(0, opacity);
        
        // Update flash (shrinks as it fades)
        flash.scale.multiplyScalar(0.85);
        flashMaterial.opacity = Math.max(0, flashOpacity);
        
        if (opacity > 0 || flashOpacity > 0) {
            requestAnimationFrame(animate);
        } else {
            // Clean up
            scene.remove(ring);
            scene.remove(flash);
            ringGeometry.dispose();
            ringMaterial.dispose();
            flashGeometry.dispose();
            flashMaterial.dispose();
        }
    };
    
    requestAnimationFrame(animate);
}
