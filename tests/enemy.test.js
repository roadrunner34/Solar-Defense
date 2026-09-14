// @vitest-environment jsdom
/**
 * enemy.test.js - Enemy spawning, damage and health bars
 *
 * Needs a DOM because health bars are HTML elements positioned in screen space.
 *
 * The health-bar suite is a regression guard: projectHealthBars() used to take
 * enemy.healthBarPosition by reference and add the vertical offset a second
 * time, on a vector that project() then overwrote in place. Bars floated at
 * twice the intended height.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as THREE from 'three';
import { createScene } from '../js/scene.js';
import { initPaths, getPathLength } from '../js/path.js';
import {
    initEnemies, spawnEnemy, updateEnemies, clearEnemies, damageEnemy,
    getClosestEnemy, getEnemiesInRange, getEnemyCount, projectHealthBars, enemies
} from '../js/enemy.js';
import { CONFIG } from '../js/config.js';

createScene();
initPaths();
initEnemies();

const camera = new THREE.PerspectiveCamera(60, 16 / 9, 0.1, 500);
camera.position.set(0, 40, 50);
camera.lookAt(0, 0, 0);
camera.updateMatrixWorld();

beforeEach(() => {
    clearEnemies();
});

afterEach(() => {
    vi.useRealTimers();
});

describe('spawnEnemy()', () => {
    it('builds an enemy from its config', () => {
        const enemy = spawnEnemy('armored', 'default');
        const config = CONFIG.enemies.armored;

        expect(enemy.health).toBe(config.health);
        expect(enemy.maxHealth).toBe(config.health);
        expect(enemy.speed).toBe(config.speed);
        expect(enemy.armor).toBe(config.armor);
        expect(enemy.alive).toBe(true);
    });

    it('caches the length of the path it was assigned', () => {
        expect(spawnEnemy('basic', 'leftFlank').pathLength).toBe(getPathLength('leftFlank'));
        expect(spawnEnemy('basic', 'default').pathLength).toBe(getPathLength('default'));
    });

    it('gives each enemy its own health bar element', () => {
        spawnEnemy('basic', 'default');
        spawnEnemy('basic', 'default');
        expect(document.querySelectorAll('.health-bar-container').length).toBe(2);
    });

    it('starts at the beginning of its path', () => {
        const enemy = spawnEnemy('basic', 'default');
        expect(enemy.pathProgress).toBe(0);
        expect(enemy.mesh.position.length()).toBeGreaterThan(CONFIG.path.planetRadius);
    });
});

describe('updateEnemies()', () => {
    it('crosses its whole path at its configured world speed', () => {
        // Averaged over the full path, not sampled instantaneously: the paths
        // are Catmull-Rom splines parameterised by cumulative segment length,
        // not by arc length, so the speed at any single point wobbles by up to
        // ~20%. It is the average that the config value promises.
        const enemy = spawnEnemy('basic', 'default');
        const before = enemy.pathProgress;

        // One second of updates, stepped at 60fps
        for (let i = 0; i < 60; i++) updateEnemies(1 / 60);

        const worldUnitsCovered = (enemy.pathProgress - before) * enemy.pathLength;
        expect(worldUnitsCovered).toBeCloseTo(CONFIG.enemies.basic.speed, 5);
    });

    it('moves identical enemies at the same speed regardless of path', () => {
        const onDefault = spawnEnemy('basic', 'default');
        const onFlank = spawnEnemy('basic', 'leftFlank');
        const startDefault = onDefault.mesh.position.clone();
        const startFlank = onFlank.mesh.position.clone();

        for (let i = 0; i < 60; i++) updateEnemies(1 / 60);

        const movedDefault = startDefault.distanceTo(onDefault.mesh.position);
        const movedFlank = startFlank.distanceTo(onFlank.mesh.position);

        expect(movedDefault).toBeCloseTo(movedFlank, 0);
    });

    it('reports when an enemy reaches the planet and removes it', () => {
        const enemy = spawnEnemy('basic', 'default');
        enemy.pathProgress = 0.99;

        const result = updateEnemies(1);

        expect(result.reachedPlanet).toBe(true);
        expect(enemies).not.toContain(enemy);
    });
});

describe('damageEnemy()', () => {
    it('subtracts armour from incoming damage', () => {
        const enemy = spawnEnemy('armored', 'default');
        damageEnemy(enemy, 50);
        expect(enemy.health).toBe(CONFIG.enemies.armored.health - (50 - CONFIG.enemies.armored.armor));
    });

    it('always does at least 1 damage, however heavy the armour', () => {
        const enemy = spawnEnemy('armored', 'default');
        damageEnemy(enemy, 1);
        expect(enemy.health).toBe(CONFIG.enemies.armored.health - 1);
    });

    it('reports destruction and cleans the enemy up', () => {
        const enemy = spawnEnemy('basic', 'default');
        const destroyed = damageEnemy(enemy, 9999);

        expect(destroyed).toBe(true);
        expect(enemy.alive).toBe(false);
        expect(enemies).not.toContain(enemy);
        expect(document.querySelectorAll('.health-bar-container').length).toBe(0);
    });

    it('ignores damage to an already-dead enemy', () => {
        const enemy = spawnEnemy('basic', 'default');
        damageEnemy(enemy, 9999);
        expect(damageEnemy(enemy, 10)).toBe(false);
    });

    it('does not touch the material after death, when it has been disposed', () => {
        vi.useFakeTimers();
        const enemy = spawnEnemy('basic', 'default');

        damageEnemy(enemy, 10);      // schedules the hit-flash reset
        damageEnemy(enemy, 9999);    // kills it, disposing the cloned material

        expect(() => vi.runAllTimers()).not.toThrow();
        expect(enemy.flashTimeout).toBe(null);
    });
});

describe('health bars', () => {
    it('projects at a single offset above the enemy, not a doubled one', () => {
        const enemy = spawnEnemy('basic', 'default');
        updateEnemies(0.016);

        const meshY = enemy.mesh.position.y;
        projectHealthBars(camera);

        // updateHealthBarPosition applies the offset once; projectHealthBars
        // must not add it again, nor overwrite the stored vector by projecting
        // it in place
        expect(enemy.healthBarPosition.y).toBeCloseTo(meshY + 2, 5);
    });

    it('leaves the stored position unprojected so it survives the next frame', () => {
        const enemy = spawnEnemy('basic', 'default');
        updateEnemies(0.016);

        projectHealthBars(camera);
        const afterFirst = enemy.healthBarPosition.clone();
        projectHealthBars(camera);

        expect(enemy.healthBarPosition.equals(afterFirst)).toBe(true);
    });

    it('positions the bar on screen', () => {
        const enemy = spawnEnemy('basic', 'default');
        updateEnemies(0.016);
        projectHealthBars(camera);

        expect(enemy.healthBar.style.left).toMatch(/px$/);
        expect(enemy.healthBar.style.top).toMatch(/px$/);
    });

    it('narrows the bar as health drops', () => {
        const enemy = spawnEnemy('basic', 'default');
        damageEnemy(enemy, 50);

        const bar = enemy.healthBar.querySelector('.health-bar');
        expect(bar.style.width).toBe('50%');
    });
});

describe('targeting helpers', () => {
    it('finds the closest enemy within range', () => {
        const near = spawnEnemy('basic', 'default');
        const far = spawnEnemy('basic', 'default');
        near.mesh.position.set(10, 0, 0);
        far.mesh.position.set(60, 0, 0);

        expect(getClosestEnemy(new THREE.Vector3(0, 0, 0), 100)).toBe(near);
    });

    it('returns null when everything is out of range', () => {
        const enemy = spawnEnemy('basic', 'default');
        enemy.mesh.position.set(500, 0, 0);

        expect(getClosestEnemy(new THREE.Vector3(0, 0, 0), 50)).toBe(null);
    });

    it('returns null when there are no enemies at all', () => {
        expect(getClosestEnemy(new THREE.Vector3(0, 0, 0), 100)).toBe(null);
    });

    it('lists every enemy inside a radius', () => {
        spawnEnemy('basic', 'default').mesh.position.set(5, 0, 0);
        spawnEnemy('basic', 'default').mesh.position.set(15, 0, 0);
        spawnEnemy('basic', 'default').mesh.position.set(500, 0, 0);

        expect(getEnemiesInRange(new THREE.Vector3(0, 0, 0), 20).length).toBe(2);
    });
});

describe('clearEnemies()', () => {
    it('removes every enemy and its health bar', () => {
        spawnEnemy('basic', 'default');
        spawnEnemy('fast', 'leftFlank');

        clearEnemies();

        expect(getEnemyCount()).toBe(0);
        expect(enemies.length).toBe(0);
        expect(document.querySelectorAll('.health-bar-container').length).toBe(0);
    });
});
