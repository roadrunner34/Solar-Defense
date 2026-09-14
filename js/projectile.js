/**
 * projectile.js - Projectile System
 *
 * Handles everything a shot does between leaving a barrel and being cleaned up:
 * moving, trailing, colliding, and - for missiles - steering and detonating.
 *
 * TWO WEAPONS, NOT ONE
 * ====================
 * This module used to build the same cyan bolt whatever fired it. The Missile
 * Launcher was a missile launcher in name, cost and turret geometry only: the
 * thing it fired was a laser with different numbers attached.
 *
 * It now has two real behaviours, which is what gives the two platform types a
 * reason to coexist:
 *
 *   laser   - fired along a fixed heading, single target, all damage to the
 *             first thing it touches. Fast, cheap, precise.
 *   missile - steers toward its target while in flight, then detonates and
 *             splits damage across everything inside a blast radius, falling
 *             off with distance. Slow, expensive, punishes clustered waves.
 *
 * The splash reuses getEnemiesInRange() from enemy.js rather than rolling its
 * own proximity query.
 */

import * as THREE from 'three';

import { scene } from './scene.js';
import { camera } from './camera.js';
import { CONFIG } from './config.js';
import { enemies, damageEnemy, getEnemiesInRange } from './enemy.js';
import { createTrailParticle, createExplosion } from './particles.js';

// Short-lived visuals are stepped by the game loop, not their own rAF loop
import { addEffect } from './effects.js';

export const projectiles = [];

// Maximum distance before projectiles are removed
const MAX_DISTANCE = 150;

// ==================== SHARED GEOMETRY ====================
//
// Built once. A wave can put dozens of shots in the air at a time, and
// allocating geometry per shot would mean a GPU upload per trigger pull.

const laserGeometry = new THREE.CylinderGeometry(
    CONFIG.projectiles.laser.radius,
    CONFIG.projectiles.laser.radius,
    CONFIG.projectiles.laser.length,
    8
);

// The missile: a body with a nose cone, merged into the same local orientation
// the laser uses (+Y forward) so both types share the aiming code below.
const missileBodyGeometry = new THREE.CapsuleGeometry(
    CONFIG.projectiles.missile.radius,
    CONFIG.projectiles.missile.length,
    4,
    8
);
const missileNoseGeometry = new THREE.ConeGeometry(
    CONFIG.projectiles.missile.radius * 1.05,
    CONFIG.projectiles.missile.length * 0.5,
    8
);
const missileFinGeometry = new THREE.BoxGeometry(
    CONFIG.projectiles.missile.radius * 0.16,
    CONFIG.projectiles.missile.length * 0.42,
    CONFIG.projectiles.missile.radius * 1.5
);
const exhaustGeometry = new THREE.SphereGeometry(CONFIG.projectiles.missile.radius * 1.5, 8, 6);

// HDR colours - values above 1.0 - so the bloom pass picks these up and makes
// them glow. A shot capped at 1.0 would be no brighter than a white UI panel.
const laserMaterial = new THREE.MeshBasicMaterial({
    color: new THREE.Color(0, 2.4, 3.1),
    transparent: true,
    opacity: 0.95,
    fog: false
});

const missileHullMaterial = new THREE.MeshStandardMaterial({
    color: 0xb9bec7,
    metalness: 0.75,
    roughness: 0.45
});

const missileNoseMaterial = new THREE.MeshStandardMaterial({
    color: 0x8a2723,
    metalness: 0.4,
    roughness: 0.6
});

const exhaustMaterial = new THREE.MeshBasicMaterial({
    color: new THREE.Color(3.4, 1.5, 0.35),
    transparent: true,
    opacity: 0.9,
    fog: false
});

// Trail colours, kept here rather than in particles.js so the two projectile
// types can be told apart mid-flight by their wake alone
const LASER_TRAIL = new THREE.Color(0.1, 1.4, 1.9);
const MISSILE_TRAIL = new THREE.Color(0.55, 0.5, 0.5);

// ==================== CREATION ====================

/**
 * Create a new projectile.
 *
 * @param {object} data - Projectile data from the weapon that fired
 * @param {THREE.Vector3} data.position - Starting position
 * @param {THREE.Vector3} data.direction - Initial heading
 * @param {number} data.damage
 * @param {number} data.speed
 * @param {string} data.source - What fired it, e.g. 'starbase' or 'platform:3'
 * @param {string} [data.projectileType] - 'laser' or 'missile'
 * @param {object} [data.target] - Enemy to steer toward, for homing types
 * @returns {object} The created projectile
 */
export function createProjectile(data) {
    const type = data.projectileType === 'missile' ? 'missile' : 'laser';
    const settings = CONFIG.projectiles[type];

    const mesh = type === 'missile' ? buildMissileMesh() : buildLaserMesh();

    mesh.position.copy(data.position);

    // Both meshes are modelled pointing along +Y, so one quaternion rule aims
    // either of them
    mesh.quaternion.setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        data.direction.clone().normalize()
    );

    // No point light attached, on purpose. Changing the scene's light count on
    // every shot forces Three.js to recompile the shader program for every lit
    // material in the scene - a visible hitch each time a shot spawns or dies.
    // The glow comes from HDR colour plus bloom instead, which costs nothing.

    const projectile = {
        mesh,
        type,
        settings,
        direction: data.direction.clone().normalize(),
        speed: data.speed,
        damage: data.damage,
        source: data.source,

        // Homing types keep a handle on what they were fired at. Held weakly in
        // spirit: the target may die mid-flight, so every read checks .alive.
        target: data.target || null,

        distanceTraveled: 0,
        trailTimer: 0,
        alive: true
    };

    mesh.userData.projectile = projectile;

    scene.add(mesh);
    projectiles.push(projectile);

    return projectile;
}

/**
 * @returns {THREE.Mesh} A laser bolt
 */
function buildLaserMesh() {
    return new THREE.Mesh(laserGeometry, laserMaterial.clone());
}

/**
 * @returns {THREE.Group} A missile, with hull, nose, fins and exhaust glow
 */
function buildMissileMesh() {
    const missile = new THREE.Group();
    const settings = CONFIG.projectiles.missile;

    const body = new THREE.Mesh(missileBodyGeometry, missileHullMaterial);
    missile.add(body);

    const nose = new THREE.Mesh(missileNoseGeometry, missileNoseMaterial);
    nose.position.y = settings.length * 0.72;
    missile.add(nose);

    for (let i = 0; i < 3; i++) {
        const fin = new THREE.Mesh(missileFinGeometry, missileHullMaterial);
        const angle = (i / 3) * Math.PI * 2;

        fin.position.set(
            Math.cos(angle) * settings.radius,
            -settings.length * 0.42,
            Math.sin(angle) * settings.radius
        );
        fin.rotation.y = -angle;
        missile.add(fin);
    }

    // The exhaust is a cloned material because it is animated per-missile:
    // updateProjectiles pulses it so the flame flickers
    const exhaust = new THREE.Mesh(exhaustGeometry, exhaustMaterial.clone());
    exhaust.name = 'exhaust';
    exhaust.position.y = -settings.length * 0.62;
    exhaust.scale.set(1, 1.8, 1);
    missile.add(exhaust);

    return missile;
}

// ==================== PER-FRAME ====================

/**
 * Move every projectile, trail it, and resolve collisions.
 *
 * @param {number} deltaTime - Seconds since the last frame
 * @returns {Array<object>} Hit results
 */
export function updateProjectiles(deltaTime) {
    const hits = [];

    for (let i = projectiles.length - 1; i >= 0; i--) {
        const projectile = projectiles[i];

        if (!projectile.alive) continue;

        if (projectile.settings.homing) {
            steerTowardTarget(projectile, deltaTime);
        }

        const moveDistance = projectile.speed * deltaTime;
        const movement = projectile.direction.clone().multiplyScalar(moveDistance);

        const oldPosition = projectile.mesh.position.clone();

        projectile.mesh.position.add(movement);
        projectile.distanceTraveled += moveDistance;

        emitTrail(projectile, deltaTime);
        animateExhaust(projectile);

        const hit = checkProjectileCollision(projectile, oldPosition, projectile.mesh.position);

        if (hit) {
            hits.push(hit);

            // A missile applies its remaining damage to everything else nearby.
            // The direct hit is already resolved above, so the splash pass
            // excludes it rather than double-counting.
            if (projectile.settings.splashRadius > 0) {
                hits.push(...applySplashDamage(projectile, hit));
                createExplosion(hit.position, new THREE.Color(2.6, 1.3, 0.3), 26, 11);
            }

            removeProjectile(projectile, i);
            continue;
        }

        if (projectile.distanceTraveled > MAX_DISTANCE) {
            removeProjectile(projectile, i);
        }
    }

    return hits;
}

/**
 * Bend a homing projectile's heading toward its target.
 *
 * Rotating by a capped angle each frame rather than snapping straight at the
 * target is what makes a missile read as a missile: it arcs, it can overshoot a
 * fast crossing target, and it visibly works to correct. A missile that simply
 * pointed at its target every frame would be indistinguishable from a slow
 * laser that happened to curve.
 *
 * @param {object} projectile
 * @param {number} deltaTime
 */
function steerTowardTarget(projectile, deltaTime) {
    const target = projectile.target;

    // Target destroyed mid-flight, by this missile's own launcher or anything
    // else. The missile keeps its last heading and flies on, which is both
    // correct and the reason MAX_DISTANCE cleanup exists.
    if (!target || !target.alive) return;

    const desired = new THREE.Vector3()
        .subVectors(target.mesh.position, projectile.mesh.position)
        .normalize();

    const maxTurn = projectile.settings.turnRate * deltaTime;
    const angle = projectile.direction.angleTo(desired);

    if (angle <= maxTurn) {
        projectile.direction.copy(desired);
    } else {
        // Rotate the current heading toward the desired one about their shared
        // perpendicular - the shortest path between two directions
        const axis = new THREE.Vector3()
            .crossVectors(projectile.direction, desired)
            .normalize();

        // Parallel vectors give a zero-length cross product, which normalises
        // to NaN and would corrupt the heading permanently
        if (axis.lengthSq() > 0.0001) {
            projectile.direction.applyAxisAngle(axis, maxTurn);
        }
    }

    projectile.mesh.quaternion.setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        projectile.direction
    );
}

/**
 * Drop trail particles behind a projectile.
 *
 * Rate-limited by time rather than emitted once per frame, so the trail has the
 * same density on a 144Hz display as on a 60Hz one - and so a fast bolt does
 * not out-run its own wake.
 *
 * @param {object} projectile
 * @param {number} deltaTime
 */
function emitTrail(projectile, deltaTime) {
    projectile.trailTimer += deltaTime;

    if (projectile.trailTimer < projectile.settings.trailInterval) return;

    projectile.trailTimer = 0;

    const isMissile = projectile.type === 'missile';

    createTrailParticle(
        projectile.mesh.position,
        isMissile ? MISSILE_TRAIL : LASER_TRAIL,
        isMissile ? 0.9 : 0.45,
        isMissile ? 0.55 : 0.22
    );
}

/**
 * Flicker a missile's exhaust.
 * @param {object} projectile
 */
function animateExhaust(projectile) {
    if (projectile.type !== 'missile') return;

    const exhaust = projectile.mesh.getObjectByName('exhaust');
    if (!exhaust) return;

    const flicker = 0.75 + Math.random() * 0.5;
    exhaust.scale.set(flicker, 1.8 * flicker, flicker);
}

// ==================== COLLISION ====================

/**
 * Check whether a projectile hit an enemy this frame.
 *
 * Tests the whole swept segment rather than just the end point, because a fast
 * bolt can cover more ground in one frame than an enemy is wide and would
 * otherwise pass straight through.
 *
 * @param {object} projectile
 * @param {THREE.Vector3} oldPos
 * @param {THREE.Vector3} newPos
 * @returns {object|null}
 */
function checkProjectileCollision(projectile, oldPos, newPos) {
    for (const enemy of enemies) {
        if (!enemy.alive) continue;

        const enemyPos = enemy.mesh.position;
        const enemyRadius = enemy.mesh.scale.x * 1.5;

        const closestPoint = closestPointOnSegment(oldPos, newPos, enemyPos);
        if (closestPoint.distanceTo(enemyPos) >= enemyRadius) continue;

        const destroyed = damageEnemy(enemy, projectile.damage);

        return {
            enemy,
            damage: projectile.damage,
            destroyed,
            position: closestPoint.clone(),
            source: projectile.source,
            creditValue: destroyed ? enemy.creditValue : 0,
            pointValue: destroyed ? enemy.pointValue : 0,

            // This is the shot's intended target, so it is the one that counts
            // toward accuracy. Splash hits below are flagged false.
            countsForAccuracy: true
        };
    }

    return null;
}

/**
 * Spread a missile's damage over everything near the detonation.
 *
 * Damage falls off with distance from the blast centre, down to
 * splashMinimum at the edge. The direct target is skipped - it has already
 * taken the full hit.
 *
 * @param {object} projectile
 * @param {object} directHit - The already-resolved primary hit
 * @returns {Array<object>} Additional hit results
 */
function applySplashDamage(projectile, directHit) {
    const results = [];
    const radius = projectile.settings.splashRadius;
    const minimum = projectile.settings.splashMinimum;

    const caught = getEnemiesInRange(directHit.position, radius);

    for (const enemy of caught) {
        if (enemy === directHit.enemy || !enemy.alive) continue;

        const distance = enemy.mesh.position.distanceTo(directHit.position);
        const falloff = minimum + (1 - minimum) * (1 - distance / radius);
        const damage = Math.max(1, Math.round(projectile.damage * falloff));

        const destroyed = damageEnemy(enemy, damage);

        results.push({
            enemy,
            damage,
            destroyed,
            position: enemy.mesh.position.clone(),
            source: projectile.source,
            creditValue: destroyed ? enemy.creditValue : 0,
            pointValue: destroyed ? enemy.pointValue : 0,

            // One trigger pull is one shot. Counting each splash victim as a
            // separate hit would let a missile launcher post accuracy above
            // 100% simply by firing into a crowd.
            countsForAccuracy: false,
            splash: true
        });
    }

    return results;
}

/**
 * Closest point on a line segment to a target point.
 * @param {THREE.Vector3} segStart
 * @param {THREE.Vector3} segEnd
 * @param {THREE.Vector3} point
 * @returns {THREE.Vector3}
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

// ==================== CLEANUP ====================

/**
 * @param {object} projectile
 * @param {number} index
 */
function removeProjectile(projectile, index) {
    projectile.alive = false;

    scene.remove(projectile.mesh);

    // Lasers and missile exhausts clone their material per instance so they can
    // be animated independently; the shared hull and nose materials must not be
    // disposed here or the next missile would render untextured.
    projectile.mesh.traverse((child) => {
        if (!child.material) return;

        if (child.material === laserMaterial ||
            child.material === missileHullMaterial ||
            child.material === missileNoseMaterial ||
            child.material === exhaustMaterial) {
            return;
        }

        child.material.dispose();
    });

    projectiles.splice(index, 1);
}

/**
 * Clear all projectiles. Used when restarting.
 */
export function clearProjectiles() {
    for (let i = projectiles.length - 1; i >= 0; i--) {
        removeProjectile(projectiles[i], i);
    }
}

/**
 * @returns {number} Number of active projectiles
 */
export function getProjectileCount() {
    return projectiles.filter(p => p.alive).length;
}

// ==================== IMPACT VISUAL ====================

/**
 * Flash and shockwave at an impact point.
 *
 * The ring is turned to face the camera every frame rather than being left at
 * a fixed tilt. It used to be pinned at `rotation.x = -PI/4`, which happens to
 * look right from the default camera and collapses to a line from anywhere
 * else - and this game lets the player orbit freely.
 *
 * @param {THREE.Vector3} position
 * @param {number} [scaleFactor] - 1 for a normal hit, larger for a detonation
 */
export function createHitEffect(position, scaleFactor = 1) {
    const flashGeometry = new THREE.SphereGeometry(0.5 * scaleFactor, 16, 16);
    const flashMaterial = new THREE.MeshBasicMaterial({
        color: new THREE.Color(3.6, 2.4, 0.7),
        transparent: true,
        opacity: 1,
        fog: false
    });
    const flash = new THREE.Mesh(flashGeometry, flashMaterial);
    flash.position.copy(position);
    scene.add(flash);

    const ringGeometry = new THREE.RingGeometry(0.1 * scaleFactor, 0.4 * scaleFactor, 32);
    const ringMaterial = new THREE.MeshBasicMaterial({
        color: new THREE.Color(2.4, 1.7, 0.2),
        transparent: true,
        opacity: 1,
        side: THREE.DoubleSide,
        fog: false
    });
    const ring = new THREE.Mesh(ringGeometry, ringMaterial);
    ring.position.copy(position);
    scene.add(ring);

    // Stepped by the game loop rather than its own requestAnimationFrame, so
    // the effect freezes with the game on pause. Steps are scaled against a
    // 60fps baseline, which keeps the look identical at 60fps while stopping
    // the effect playing faster on a high-refresh display.
    let scale = 1;
    let opacity = 1;
    let flashOpacity = 1;

    addEffect((deltaTime) => {
        const step = Math.min(deltaTime, 0.5) * 60;

        scale += 0.4 * step;
        opacity -= 0.08 * step;
        flashOpacity -= 0.15 * step;

        if (camera) ring.lookAt(camera.position);

        ring.scale.set(scale, scale, scale);
        ringMaterial.opacity = Math.max(0, opacity);

        flash.scale.multiplyScalar(Math.pow(0.85, step));
        flashMaterial.opacity = Math.max(0, flashOpacity);

        if (opacity > 0 || flashOpacity > 0) return true;

        scene.remove(ring);
        scene.remove(flash);
        ringGeometry.dispose();
        ringMaterial.dispose();
        flashGeometry.dispose();
        flashMaterial.dispose();
        return false;
    });
}
