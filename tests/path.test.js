/**
 * path.test.js - Enemy path geometry and travel speed
 *
 * The travel-speed suite is a regression guard. Enemy movement converts a
 * world speed into 0-1 path progress, and that conversion used to divide by a
 * hardcoded 100 rather than by the path's real length. Because the three paths
 * differ in length and spawns pick one at random, two identical enemies could
 * visibly travel at different speeds.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import {
    initPaths, getPositionOnPath, getDirectionOnPath, getPathLength,
    getPathSpawnPosition, getRandomPathName, hasReachedPlanet
} from '../js/path.js';
import { CONFIG } from '../js/config.js';

const PATH_NAMES = ['default', 'leftFlank', 'rightFlank'];

beforeAll(() => {
    initPaths();
});

/**
 * Walk a path from start to finish using the same progress-per-second
 * conversion updateEnemies() uses, and report how long it took.
 */
function traversalSeconds(pathName, speed, dt = 1 / 60) {
    const length = getPathLength(pathName);
    let progress = 0;
    let seconds = 0;

    while (progress < 1 && seconds < 1000) {
        progress += (speed / length) * dt;
        seconds += dt;
    }

    return seconds;
}

describe('getPathLength()', () => {
    it('reports a positive length for every path', () => {
        for (const name of PATH_NAMES) {
            expect(getPathLength(name)).toBeGreaterThan(0);
        }
    });

    it('falls back to the default path for an unknown name', () => {
        expect(getPathLength('nope')).toBe(getPathLength('default'));
    });

    it('the paths really do differ in length', () => {
        // If this ever stops being true the speed test below proves nothing
        const lengths = PATH_NAMES.map(getPathLength);
        expect(new Set(lengths.map(l => Math.round(l))).size).toBeGreaterThan(1);
    });
});

describe('travel speed', () => {
    it('means the same world speed on every path', () => {
        const speed = CONFIG.enemies.basic.speed;

        for (const name of PATH_NAMES) {
            const averageWorldSpeed = getPathLength(name) / traversalSeconds(name, speed);
            expect(averageWorldSpeed).toBeCloseTo(speed, 1);
        }
    });

    it('takes longer to cross a longer path at the same speed', () => {
        const speed = 5;
        const byLength = [...PATH_NAMES].sort((a, b) => getPathLength(a) - getPathLength(b));
        const shortest = traversalSeconds(byLength[0], speed);
        const longest = traversalSeconds(byLength[byLength.length - 1], speed);

        expect(longest).toBeGreaterThan(shortest);
    });

    it('scales inversely with speed', () => {
        expect(traversalSeconds('default', 10)).toBeCloseTo(traversalSeconds('default', 5) / 2, 1);
    });

    it('a fast enemy outruns a basic one on the same path', () => {
        const fast = traversalSeconds('default', CONFIG.enemies.fast.speed);
        const basic = traversalSeconds('default', CONFIG.enemies.basic.speed);
        expect(fast).toBeLessThan(basic);
    });
});

describe('getPositionOnPath()', () => {
    it('starts at the path spawn point', () => {
        for (const name of PATH_NAMES) {
            const start = getPositionOnPath(name, 0);
            expect(start.distanceTo(getPathSpawnPosition(name))).toBeCloseTo(0, 5);
        }
    });

    it('ends at the planet', () => {
        for (const name of PATH_NAMES) {
            expect(getPositionOnPath(name, 1).length()).toBeLessThan(CONFIG.path.planetRadius);
        }
    });

    it('clamps progress outside 0-1', () => {
        expect(getPositionOnPath('default', -5).equals(getPositionOnPath('default', 0))).toBe(true);
        expect(getPositionOnPath('default', 5).equals(getPositionOnPath('default', 1))).toBe(true);
    });

    it('moves closer to the planet overall as progress increases', () => {
        const quarter = getPositionOnPath('default', 0.25).length();
        const end = getPositionOnPath('default', 1).length();
        expect(end).toBeLessThan(quarter);
    });

    it('returns finite coordinates the whole way along', () => {
        for (const name of PATH_NAMES) {
            for (let p = 0; p <= 1; p += 0.05) {
                const pos = getPositionOnPath(name, p);
                expect(Number.isFinite(pos.x + pos.y + pos.z)).toBe(true);
            }
        }
    });
});

describe('getDirectionOnPath()', () => {
    it('returns a unit vector along the path', () => {
        for (const name of PATH_NAMES) {
            expect(getDirectionOnPath(name, 0.5).length()).toBeCloseTo(1, 5);
        }
    });
});

describe('hasReachedPlanet()', () => {
    it('is true at the planet surface and inside it', () => {
        const r = CONFIG.path.planetRadius;
        expect(hasReachedPlanet({ length: () => 0 })).toBe(true);
        expect(hasReachedPlanet(getPositionOnPath('default', 1))).toBe(true);
        expect(hasReachedPlanet({ length: () => r })).toBe(true);
    });

    it('is false out in space', () => {
        expect(hasReachedPlanet(getPositionOnPath('default', 0))).toBe(false);
    });
});

describe('getRandomPathName()', () => {
    it('only ever returns a real path', () => {
        for (let i = 0; i < 50; i++) {
            expect(PATH_NAMES).toContain(getRandomPathName());
        }
    });
});
