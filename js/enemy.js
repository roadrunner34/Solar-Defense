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
import { createEnemyMaterial } from './materials.js';
import { createTrailParticle } from './particles.js';
import { CONFIG, getEnemyConfig } from './config.js';
import { getPositionOnPath, getDirectionOnPath, hasReachedPlanet, getPathLength } from './path.js';

// Store all active enemies
export const enemies = [];

// Geometry and materials (shared for performance)
const enemyGeometries = {};
const enemyMaterials = {};

// How far above an enemy its health bar floats, in world units
const HEALTH_BAR_HEIGHT_OFFSET = 2;

// Seconds between thruster particles. See emitThrusterTrail().
const THRUSTER_TRAIL_INTERVAL = 0.05;

// Cached trail tints, keyed by enemy type
const trailColors = {};

/**
 * Initialize enemy system
 * Pre-creates geometries and materials for efficiency
 */
export function initEnemies() {
    // Create geometries for each enemy type
    // Different shapes help players identify enemy types quickly
    
    // Basic enemy - simple octahedron shape
    enemyGeometries.basic = new THREE.OctahedronGeometry(1, 0);
    enemyMaterials.basic = createEnemyMaterial(CONFIG.enemies.basic.color);

    // Fast enemy - smaller, pointier (tetrahedron)
    enemyGeometries.fast = new THREE.TetrahedronGeometry(1, 0);
    enemyMaterials.fast = createEnemyMaterial(CONFIG.enemies.fast.color);

    // Armored enemy - larger, chunky (dodecahedron)
    enemyGeometries.armored = new THREE.DodecahedronGeometry(1, 0);
    enemyMaterials.armored = createEnemyMaterial(CONFIG.enemies.armored.color);
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

    // Engine glow, mounted on the trailing face.
    //
    // updateEnemies() calls lookAt() toward the direction of travel, and
    // lookAt() points an object's +Z at its target - so local -Z is always the
    // back of the craft whichever way it is heading. A visible drive is what
    // turns three rotating platonic solids into three ships going somewhere.
    mesh.add(createEngineGlow(config.color));

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
        
        // Cached so movement can be expressed in world units per second
        // rather than in fractions of a path (see updateEnemies)
        pathLength: getPathLength(pathName),
        
        alive: true,
        
        // Handle for the pending hit-flash reset, so it can be cancelled
        flashTimeout: null,
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
 * Build the engine glow that rides on the back of an enemy.
 *
 * MeshBasicMaterial rather than an emissive Standard material: this is meant to
 * be self-luminous and completely unaffected by where the sun is. The HDR
 * colour - components above 1.0 - is what the bloom pass keys off, so the drive
 * blooms into a soft halo instead of being a flat coloured dot.
 *
 * @param {number} color - The enemy type's identifying colour
 * @returns {THREE.Mesh}
 */
function createEngineGlow(color) {
    const tint = new THREE.Color(color);

    const glow = new THREE.Mesh(
        new THREE.SphereGeometry(0.42, 10, 8),
        new THREE.MeshBasicMaterial({
            // Pushed well past 1.0 and biased warm, so every drive plume reads
            // as hot regardless of the hull colour it belongs to
            color: new THREE.Color(
                0.9 + tint.r * 2.2,
                0.55 + tint.g * 1.6,
                0.35 + tint.b * 1.6
            ),
            transparent: true,
            opacity: 0.92,
            fog: false
        })
    );

    glow.name = 'engineGlow';
    glow.position.z = -0.95;
    glow.scale.set(0.7, 0.7, 1.7); // Stretched along the thrust axis

    return glow;
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

        // How many got through this frame. The boolean above cannot tell one
        // leak from three, and with planet integrity replacing instant defeat
        // the difference is the whole game: three enemies arriving together
        // must cost three points of integrity, not one.
        reachedPlanetCount: 0,

        // Where each of them broke through, so the shield can flare in the
        // right place rather than generically
        breachPositions: [],

        destroyed: []
    };
    
    for (let i = enemies.length - 1; i >= 0; i--) {
        const enemy = enemies[i];
        
        if (!enemy.alive) continue;
        
        // Calculate how much to move based on speed and time.
        //
        // Progress is a 0-1 fraction of the path, so converting a world speed
        // into progress means dividing by that path's actual length. Dividing
        // by a hardcoded 100 instead made an enemy's real speed depend on which
        // path it happened to be assigned - the three paths differ in length,
        // so identical enemies visibly travelled at different speeds.
        const pathSpeed = (enemy.speed / enemy.pathLength) * deltaTime;
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

        // Lay down a thruster wake behind the drive
        emitThrusterTrail(enemy, deltaTime);

        // Update health bar position
        updateHealthBarPosition(enemy);
        
        // Check if enemy reached the planet
        if (hasReachedPlanet(newPosition) || enemy.pathProgress >= 1) {
            result.reachedPlanet = true;
            result.reachedPlanetCount++;
            result.breachPositions.push(newPosition.clone());
            removeEnemy(enemy, i);
        }
    }
    
    return result;
}

/**
 * Drop a thruster particle behind an enemy.
 *
 * Emission is rate-limited in time rather than once per frame for two reasons:
 * the trail then looks identical at 60Hz and 144Hz, and the shared particle
 * pool holds 300 slots. A full late wave can have twenty enemies on screen, and
 * unthrottled per-frame emission would recycle the pool several times a second,
 * cutting every trail short - including the projectile trails sharing it.
 *
 * @param {object} enemy
 * @param {number} deltaTime
 */
function emitThrusterTrail(enemy, deltaTime) {
    enemy.trailTimer = (enemy.trailTimer || 0) + deltaTime;

    if (enemy.trailTimer < THRUSTER_TRAIL_INTERVAL) return;
    enemy.trailTimer = 0;

    const glow = enemy.mesh.getObjectByName('engineGlow');
    if (!glow) return;

    createTrailParticle(
        glow.getWorldPosition(new THREE.Vector3()),
        thrusterTrailColor(enemy.type),
        0.45 * enemy.mesh.scale.x,
        0.35
    );
}

/**
 * Trail tint for an enemy type, cached so the colour objects are not rebuilt
 * several times a second.
 *
 * @param {string} type
 * @returns {THREE.Color}
 */
function thrusterTrailColor(type) {
    if (!trailColors[type]) {
        const tint = new THREE.Color(getEnemyConfig(type).color);
        trailColors[type] = new THREE.Color(
            0.7 + tint.r * 1.1,
            0.4 + tint.g * 0.9,
            0.3 + tint.b * 0.9
        );
    }

    return trailColors[type];
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
    enemy.healthBarPosition.y += HEALTH_BAR_HEIGHT_OFFSET; // Offset above enemy
}

/**
 * Project enemy health bars to screen space
 * Called from main.js with camera access
 * @param {THREE.Camera} camera - The game camera
 */
export function projectHealthBars(camera) {
    enemies.forEach(enemy => {
        if (!enemy.healthBar || !enemy.alive) return;
        
        // Convert 3D position to screen coordinates.
        //
        // Clone before projecting: healthBarPosition is a live reference, and
        // project() rewrites the vector in place. The offset is applied once,
        // in updateHealthBarPosition - adding it again here made bars float at
        // twice the intended height.
        const vector = (enemy.healthBarPosition || enemy.mesh.position).clone();
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
    
    // Keep the handle so removeEnemy can cancel it. Enemies clone their
    // material and dispose it on death, so a flash reset left pending past that
    // point would write to a disposed material.
    clearTimeout(enemy.flashTimeout);
    enemy.flashTimeout = setTimeout(() => {
        enemy.flashTimeout = null;
        if (enemy.alive && enemy.mesh.material) {
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
    // Mark dead first: the pending hit-flash checks this before touching the
    // material, and getEnemyCount() filters on it
    enemy.alive = false;
    
    // Cancel any pending hit-flash reset before the material is disposed
    clearTimeout(enemy.flashTimeout);
    enemy.flashTimeout = null;
    
    // Remove health bar from DOM
    if (enemy.healthBar) {
        enemy.healthBar.remove();
    }
    
    // Remove mesh from scene
    scene.remove(enemy.mesh);

    // Dispose the per-instance material clone. The geometry is shared across
    // every enemy of this type and must NOT be disposed here.
    if (enemy.mesh.material) {
        enemy.mesh.material.dispose();
    }

    // The engine glow is built fresh per enemy - its own geometry and its own
    // material - so unlike the hull it owns both and has to release both.
    // Missing this leaks two GPU objects per kill, which over a long endless
    // run is hundreds.
    const glow = enemy.mesh.getObjectByName('engineGlow');
    if (glow) {
        glow.geometry.dispose();
        glow.material.dispose();
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
