/**
 * enemy.js - Enemy System
 * 
 * Manages all enemies in the game:
 * - Creating enemy objects with health, speed, and type
 * - Moving enemies along paths
 * - Displaying health bars
 * - Handling enemy destruction
 * 
 * Each enemy is a 3D object (mesh) with additional properties
 * stored as a JavaScript object.
 */

import * as THREE from 'three';
import { scene } from './scene.js';
import { CONFIG, getEnemyConfig } from './config.js';
import { getPositionOnPath, getDirectionOnPath, hasReachedPlanet } from './path.js';

// Store all active enemies
export const enemies = [];

// Geometry and materials (shared for performance)
const enemyGeometries = {};
const enemyMaterials = {};

/**
 * Initialize enemy system
 * Pre-creates geometries and materials for efficiency
 */
export function initEnemies() {
    // Create geometries for each enemy type
    // Different shapes help players identify enemy types quickly
    
    // Basic enemy - simple octahedron shape
    enemyGeometries.basic = new THREE.OctahedronGeometry(1, 0);
    enemyMaterials.basic = new THREE.MeshPhongMaterial({
        color: CONFIG.enemies.basic.color,
        emissive: new THREE.Color(CONFIG.enemies.basic.color).multiplyScalar(0.3),
        flatShading: true
    });
    
    // Fast enemy - smaller, pointier (tetrahedron)
    enemyGeometries.fast = new THREE.TetrahedronGeometry(1, 0);
    enemyMaterials.fast = new THREE.MeshPhongMaterial({
        color: CONFIG.enemies.fast.color,
        emissive: new THREE.Color(CONFIG.enemies.fast.color).multiplyScalar(0.3),
        flatShading: true
    });
    
    // Armored enemy - larger, chunky (dodecahedron)
    enemyGeometries.armored = new THREE.DodecahedronGeometry(1, 0);
    enemyMaterials.armored = new THREE.MeshPhongMaterial({
        color: CONFIG.enemies.armored.color,
        emissive: new THREE.Color(CONFIG.enemies.armored.color).multiplyScalar(0.3),
        flatShading: true
    });
}

/**
 * Spawn a new enemy
 * @param {string} type - Enemy type (basic, fast, armored)
 * @param {string} pathName - Which path to follow
 * @returns {object} The created enemy object
 */
export function spawnEnemy(type = 'basic', pathName = 'default') {
    const config = getEnemyConfig(type);
    
    // Create the 3D mesh
    const geometry = enemyGeometries[type] || enemyGeometries.basic;
    const material = enemyMaterials[type] || enemyMaterials.basic;
    
    const mesh = new THREE.Mesh(geometry, material.clone()); // Clone material for individual color changes
    
    // Scale based on enemy type
    const scale = config.size;
    mesh.scale.set(scale, scale, scale);
    
    // Get starting position from path
    const startPosition = getPositionOnPath(pathName, 0);
    mesh.position.copy(startPosition);
    
    // Create the enemy data object
    const enemy = {
        mesh,
        type,
        health: config.health,
        maxHealth: config.health,
        speed: config.speed,
        armor: config.armor,
        pathName,
        pathProgress: 0, // 0 = start, 1 = end
        alive: true,
        creditValue: CONFIG.economy.creditsPerKill[type] || 10,
        pointValue: CONFIG.scoring.pointsPerKill[type] || 100,
        
        // Reference to health bar (created separately)
        healthBar: null
    };
    
    // Store enemy reference on mesh for easy access during collision
    mesh.userData.enemy = enemy;
    
    // Create health bar
    enemy.healthBar = createHealthBar(enemy);
    
    // Add to scene and tracking array
    scene.add(mesh);
    enemies.push(enemy);
    
    return enemy;
}

/**
 * Creates a health bar for an enemy
 * Health bars are HTML elements positioned in screen space
 * @param {object} enemy - The enemy to create health bar for
 * @returns {HTMLElement} The health bar container element
 */
function createHealthBar(enemy) {
    const container = document.createElement('div');
    container.className = 'health-bar-container';
    
    const bar = document.createElement('div');
    bar.className = 'health-bar high';
    bar.style.width = '100%';
    
    container.appendChild(bar);
    document.body.appendChild(container);
    
    return container;
}

/**
 * Update all enemies
 * Called every frame to move enemies and update their visuals
 * @param {number} deltaTime - Time since last frame in seconds
 * @returns {object} Info about enemies that reached the planet or were destroyed
 */
export function updateEnemies(deltaTime) {
    const result = {
        reachedPlanet: false,
        destroyed: []
    };
    
    for (let i = enemies.length - 1; i >= 0; i--) {
        const enemy = enemies[i];
        
        if (!enemy.alive) continue;
        
        // Calculate how much to move based on speed and time
        // We convert speed to path progress (path length normalized to 0-1)
        const pathSpeed = (enemy.speed / 100) * deltaTime;
        enemy.pathProgress += pathSpeed;
        
        // Get new position on path
        const newPosition = getPositionOnPath(enemy.pathName, enemy.pathProgress);
        enemy.mesh.position.copy(newPosition);
        
        // Rotate enemy to face direction of travel
        const direction = getDirectionOnPath(enemy.pathName, enemy.pathProgress);
        enemy.mesh.lookAt(
            enemy.mesh.position.x + direction.x,
            enemy.mesh.position.y + direction.y,
            enemy.mesh.position.z + direction.z
        );
        
        // Add some wobble rotation for visual interest
        enemy.mesh.rotation.z += deltaTime * 2;
        
        // Update health bar position
        updateHealthBarPosition(enemy);
        
        // Check if enemy reached the planet
        if (hasReachedPlanet(newPosition) || enemy.pathProgress >= 1) {
            result.reachedPlanet = true;
            removeEnemy(enemy, i);
        }
    }
    
    return result;
}

/**
 * Update health bar position to follow enemy in screen space
 * @param {object} enemy - Enemy whose health bar to update
 */
function updateHealthBarPosition(enemy) {
    if (!enemy.healthBar) return;
    
    // We need to convert 3D position to 2D screen coordinates
    // This requires camera access - we'll handle this in main.js
    // For now, store 3D position and let main.js do the projection
    enemy.healthBarPosition = enemy.mesh.position.clone();
    enemy.healthBarPosition.y += 2; // Offset above enemy
}

/**
 * Project enemy health bars to screen space
 * Called from main.js with camera access
 * @param {THREE.Camera} camera - The game camera
 */
export function projectHealthBars(camera) {
    enemies.forEach(enemy => {
        if (!enemy.healthBar || !enemy.alive) return;
        
        // Convert 3D position to screen coordinates
        const vector = enemy.healthBarPosition || enemy.mesh.position.clone();
        vector.y += 2;
        vector.project(camera);
        
        // Convert from normalized (-1 to 1) to screen pixels
        const x = (vector.x * 0.5 + 0.5) * window.innerWidth;
        const y = (-(vector.y * 0.5) + 0.5) * window.innerHeight;
        
        // Check if enemy is in front of camera
        if (vector.z < 1) {
            enemy.healthBar.style.display = 'block';
            enemy.healthBar.style.left = (x - 25) + 'px'; // Center the 50px bar
            enemy.healthBar.style.top = (y - 15) + 'px';
        } else {
            enemy.healthBar.style.display = 'none';
        }
    });
}

/**
 * Damage an enemy
 * @param {object} enemy - Enemy to damage
 * @param {number} damage - Amount of damage
 * @returns {boolean} True if enemy was destroyed
 */
export function damageEnemy(enemy, damage) {
    if (!enemy.alive) return false;
    
    // Apply armor reduction
    const actualDamage = Math.max(1, damage - enemy.armor);
    enemy.health -= actualDamage;
    
    // Update health bar
    updateHealthBar(enemy);
    
    // Flash the enemy red on hit
    flashEnemy(enemy);
    
    // Check for death
    if (enemy.health <= 0) {
        enemy.alive = false;
        const index = enemies.indexOf(enemy);
        if (index !== -1) {
            removeEnemy(enemy, index);
        }
        return true;
    }
    
    return false;
}

/**
 * Update health bar visual based on current health
 * @param {object} enemy - Enemy to update
 */
function updateHealthBar(enemy) {
    if (!enemy.healthBar) return;
    
    const bar = enemy.healthBar.querySelector('.health-bar');
    const healthPercent = (enemy.health / enemy.maxHealth) * 100;
    
    bar.style.width = healthPercent + '%';
    
    // Update color based on health
    bar.classList.remove('high', 'medium');
    if (healthPercent > 60) {
        bar.classList.add('high');
    } else if (healthPercent > 30) {
        bar.classList.add('medium');
    }
}

/**
 * Flash enemy to show it was hit
 * @param {object} enemy - Enemy to flash
 */
function flashEnemy(enemy) {
    const originalColor = enemy.mesh.material.emissive.getHex();
    enemy.mesh.material.emissive.setHex(0xffffff);
    
    setTimeout(() => {
        if (enemy.mesh.material) {
            enemy.mesh.material.emissive.setHex(originalColor);
        }
    }, 100);
}

/**
 * Remove an enemy from the game
 * @param {object} enemy - Enemy to remove
 * @param {number} index - Index in enemies array
 */
function removeEnemy(enemy, index) {
    // Remove health bar from DOM
    if (enemy.healthBar) {
        enemy.healthBar.remove();
    }
    
    // Remove mesh from scene
    scene.remove(enemy.mesh);
    
    // Dispose of geometry and material (cleanup memory)
    // Note: We cloned the material, so we should dispose it
    if (enemy.mesh.material) {
        enemy.mesh.material.dispose();
    }
    
    // Remove from array
    enemies.splice(index, 1);
}

/**
 * Get the closest enemy to a position
 * @param {THREE.Vector3} position - Position to check from
 * @param {number} maxRange - Maximum range to consider (optional)
 * @returns {object|null} Closest enemy or null if none in range
 */
export function getClosestEnemy(position, maxRange = Infinity) {
    let closest = null;
    let closestDistance = maxRange;
    
    enemies.forEach(enemy => {
        if (!enemy.alive) return;
        
        const distance = position.distanceTo(enemy.mesh.position);
        if (distance < closestDistance) {
            closestDistance = distance;
            closest = enemy;
        }
    });
    
    return closest;
}

/**
 * Get all enemies within a range
 * @param {THREE.Vector3} position - Position to check from
 * @param {number} range - Range to check
 * @returns {Array} Array of enemies within range
 */
export function getEnemiesInRange(position, range) {
    return enemies.filter(enemy => {
        if (!enemy.alive) return false;
        return position.distanceTo(enemy.mesh.position) <= range;
    });
}

/**
 * Get count of active enemies
 * @returns {number} Number of alive enemies
 */
export function getEnemyCount() {
    return enemies.filter(e => e.alive).length;
}

/**
 * Clear all enemies
 * Used when restarting or changing levels
 */
export function clearEnemies() {
    for (let i = enemies.length - 1; i >= 0; i--) {
        removeEnemy(enemies[i], i);
    }
}
