// @vitest-environment jsdom
/**
 * projectile.test.js - Laser and missile behaviour
 *
 * Sprint 2 Epic 6, finally implemented. The Missile Launcher used to fire an
 * identical bolt to the Laser Battery - only its cost, stats and turret model
 * differed. These tests pin the two behaviours apart: lasers fly straight and
 * hit one target, missiles steer and spread their damage.
 *
 * jsdom rather than node: the projectile mesh chain reaches material code that
 * expects a document to exist, and createHitEffect appends to the scene.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';

import { createScene } from '../js/scene.js';
import { createProjectile, updateProjectiles, clearProjectiles, projectiles } from '../js/projectile.js';
import { initEnemies, spawnEnemy, clearEnemies } from '../js/enemy.js';
import { initParticles } from '../js/particles.js';
import { initPaths } from '../js/path.js';
import { CONFIG } from '../js/config.js';

createScene();
initPaths();   // spawnEnemy reads a path to place the enemy before we move it
initEnemies();
initParticles();

/**
 * Put an enemy at an exact position, off its path.
 * @returns {object} The enemy
 */
function enemyAt(x, y, z, type = 'basic') {
    const enemy = spawnEnemy(type, 'default');
    enemy.mesh.position.set(x, y, z);
    return enemy;
}

/**
 * Fire something from the origin along +X.
 * @param {object} overrides
 * @returns {object} The projectile
 */
function fire(overrides = {}) {
    return createProjectile({
        position: new THREE.Vector3(0, 0, 0),
        direction: new THREE.Vector3(1, 0, 0),
        damage: 40,
        speed: 50,
        source: 'test',
        ...overrides
    });
}

beforeEach(() => {
    clearEnemies();
    clearProjectiles();
});

describe('projectile types', () => {
    it('defaults to a laser when no type is given', () => {
        expect(fire().type).toBe('laser');
    });

    it('builds a missile when asked for one', () => {
        expect(fire({ projectileType: 'missile' }).type).toBe('missile');
    });

    it('gives a missile a visible exhaust the laser does not have', () => {
        expect(fire({ projectileType: 'missile' }).mesh.getObjectByName('exhaust')).toBeTruthy();
        expect(fire().mesh.getObjectByName('exhaust')).toBeFalsy();
    });

    it('falls back to a laser for an unrecognised type', () => {
        expect(fire({ projectileType: 'plasma' }).type).toBe('laser');
    });
});

describe('collision', () => {
    it('hits an enemy in its path', () => {
        enemyAt(10, 0, 0);
        fire();

        const hits = updateProjectiles(0.5); // Travels 25 units, past the enemy

        expect(hits.length).toBe(1);
        expect(hits[0].damage).toBe(40);
    });

    // The swept test matters: a fast bolt covers more ground in one frame than
    // an enemy is wide, and a point test at the end position would miss it
    it('catches an enemy it passed straight through in one frame', () => {
        enemyAt(10, 0, 0);
        fire({ speed: 500 });

        expect(updateProjectiles(0.1).length).toBe(1); // Ends up 50 units out
    });

    it('misses an enemy well off the line of fire', () => {
        enemyAt(10, 0, 40);
        fire();

        expect(updateProjectiles(0.5).length).toBe(0);
    });

    it('removes itself after travelling too far without hitting anything', () => {
        fire();

        for (let i = 0; i < 10; i++) updateProjectiles(0.5);

        expect(projectiles.length).toBe(0);
    });
});

describe('missile splash damage', () => {
    it('damages other enemies near the detonation', () => {
        const direct = enemyAt(10, 0, 0);
        const nearby = enemyAt(13, 0, 0);

        fire({ projectileType: 'missile', target: direct });
        const hits = updateProjectiles(0.5);

        expect(hits.length).toBeGreaterThan(1);
        expect(hits.some(hit => hit.enemy === nearby)).toBe(true);
    });

    it('leaves enemies outside the blast radius alone', () => {
        const direct = enemyAt(10, 0, 0);
        const distant = enemyAt(10, 0, CONFIG.projectiles.missile.splashRadius + 10);

        fire({ projectileType: 'missile', target: direct });
        const hits = updateProjectiles(0.5);

        expect(hits.some(hit => hit.enemy === distant)).toBe(false);
    });

    it('falls off with distance from the centre', () => {
        const direct = enemyAt(10, 0, 0);
        enemyAt(11, 0, 0);  // Close in
        enemyAt(10, 0, 6);  // Near the edge

        fire({ projectileType: 'missile', target: direct });
        const splash = updateProjectiles(0.5).filter(hit => hit.splash);

        expect(splash.length).toBe(2);

        const [near, far] = splash.sort((a, b) => b.damage - a.damage);
        expect(near.damage).toBeGreaterThan(far.damage);
    });

    it('never falls below the configured minimum fraction', () => {
        const direct = enemyAt(10, 0, 0);
        // Right at the edge of the blast
        enemyAt(10, 0, CONFIG.projectiles.missile.splashRadius - 0.2);

        fire({ projectileType: 'missile', damage: 40, target: direct });
        const splash = updateProjectiles(0.5).find(hit => hit.splash);

        const floor = 40 * CONFIG.projectiles.missile.splashMinimum;
        expect(splash.damage).toBeGreaterThanOrEqual(Math.floor(floor));
    });

    // One trigger pull is one shot. Counting each splash victim as its own hit
    // would let a Missile Launcher post accuracy above 100%.
    it('excludes splash victims from accuracy', () => {
        const direct = enemyAt(10, 0, 0);
        enemyAt(12, 0, 0);

        fire({ projectileType: 'missile', target: direct });
        const hits = updateProjectiles(0.5);

        const counted = hits.filter(hit => hit.countsForAccuracy !== false);
        expect(counted.length).toBe(1);
    });

    it('gives a laser no splash at all', () => {
        const direct = enemyAt(10, 0, 0);
        enemyAt(12, 0, 0);

        fire({ target: direct });

        expect(updateProjectiles(0.5).length).toBe(1);
    });
});

describe('missile homing', () => {
    it('bends toward a target that is off its initial heading', () => {
        const target = enemyAt(30, 0, 30);
        const missile = fire({ projectileType: 'missile', target, speed: 10 });

        const startingOffset = missile.direction.angleTo(
            new THREE.Vector3(30, 0, 30).normalize()
        );

        updateProjectiles(0.2);

        const correctedOffset = missile.direction.angleTo(
            new THREE.Vector3()
                .subVectors(target.mesh.position, missile.mesh.position)
                .normalize()
        );

        expect(correctedOffset).toBeLessThan(startingOffset);
    });

    it('turns no faster than its configured rate', () => {
        const target = enemyAt(0, 0, 30); // 90 degrees off the initial heading
        const missile = fire({ projectileType: 'missile', target, speed: 1 });

        const before = missile.direction.clone();
        updateProjectiles(0.1);

        const turned = before.angleTo(missile.direction);
        const allowed = CONFIG.projectiles.missile.turnRate * 0.1;

        expect(turned).toBeLessThanOrEqual(allowed + 1e-6);
    });

    // A missile whose target dies mid-flight must keep its last heading rather
    // than steering toward a stale position or producing a NaN direction
    it('flies on when its target is destroyed mid-flight', () => {
        const target = enemyAt(40, 0, 0);
        const missile = fire({ projectileType: 'missile', target, speed: 10 });

        target.alive = false;
        updateProjectiles(0.2);

        expect(Number.isFinite(missile.direction.x)).toBe(true);
        expect(missile.direction.length()).toBeCloseTo(1, 5);
    });

    it('copes with a target directly behind it', () => {
        // Exactly antiparallel: the cross product is zero-length and would
        // normalise to NaN if the axis were used unguarded
        const target = enemyAt(-30, 0, 0);
        const missile = fire({ projectileType: 'missile', target, speed: 1 });

        updateProjectiles(0.1);

        expect(Number.isFinite(missile.direction.x)).toBe(true);
        expect(Number.isNaN(missile.direction.y)).toBe(false);
    });

    it('does not steer a laser', () => {
        const target = enemyAt(0, 0, 40);
        const laser = fire({ target, speed: 1 });

        const before = laser.direction.clone();
        updateProjectiles(0.2);

        expect(laser.direction.angleTo(before)).toBe(0);
    });
});

describe('clearProjectiles()', () => {
    it('empties the board', () => {
        fire();
        fire({ projectileType: 'missile' });

        clearProjectiles();

        expect(projectiles.length).toBe(0);
    });
});
