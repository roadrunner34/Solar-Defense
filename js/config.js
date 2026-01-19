/**
 * config.js - Game Configuration
 * 
 * This file contains all the "magic numbers" for game balance.
 * By putting them here instead of scattered throughout the code,
 * we can easily tweak game balance without hunting through files.
 * 
 * Think of this as the game's "settings panel" for developers.
 */

export const CONFIG = {
    // ==================== ECONOMY ====================
    economy: {
        startingCredits: 100,      // Credits player starts with
        creditsPerKill: {
            basic: 10,             // Credits for killing basic enemy
            fast: 15,              // Fast enemies are worth more
            armored: 25            // Armored enemies worth the most
        }
    },

    // ==================== STARBASE ====================
    starbase: {
        damage: 25,                // Damage per shot
        fireRate: 1,               // Shots per second
        rotationSpeed: 2.0,        // How fast the starbase rotates (radians/sec)
        projectileSpeed: 50,       // How fast projectiles travel
        range: 100                 // Maximum firing range
    },

    // ==================== ENEMIES ====================
    enemies: {
        basic: {
            health: 100,
            speed: 5,              // Units per second
            armor: 0,              // Damage reduction
            size: 1,
            color: 0xff4444        // Red
        },
        fast: {
            health: 60,
            speed: 10,
            armor: 0,
            size: 0.7,
            color: 0xffff00        // Yellow
        },
        armored: {
            health: 200,
            speed: 3,
            armor: 10,             // Reduces incoming damage by 10
            size: 1.5,
            color: 0x8844ff        // Purple
        }
    },

    // ==================== WAVES ====================
    waves: {
        // Wave 1: Easy introduction
        1: {
            enemies: [
                { type: 'basic', count: 5, spawnDelay: 2 }
            ],
            bonusCredits: 50       // Bonus for completing wave
        },
        // Wave 2: More enemies
        2: {
            enemies: [
                { type: 'basic', count: 8, spawnDelay: 1.5 }
            ],
            bonusCredits: 75
        },
        // Wave 3: Introduce fast enemies
        3: {
            enemies: [
                { type: 'basic', count: 5, spawnDelay: 2 },
                { type: 'fast', count: 3, spawnDelay: 1 }
            ],
            bonusCredits: 100
        },
        // Wave 4: Mixed enemies
        4: {
            enemies: [
                { type: 'basic', count: 8, spawnDelay: 1.5 },
                { type: 'fast', count: 5, spawnDelay: 1 }
            ],
            bonusCredits: 125
        },
        // Wave 5: Introduce armored
        5: {
            enemies: [
                { type: 'basic', count: 5, spawnDelay: 1.5 },
                { type: 'fast', count: 3, spawnDelay: 1 },
                { type: 'armored', count: 2, spawnDelay: 3 }
            ],
            bonusCredits: 150
        }
    },

    // ==================== PATH ====================
    path: {
        // Path waypoints will be defined relative to scene
        // These are offsets from center, the actual path curves around
        spawnDistance: 80,         // How far from center enemies spawn
        planetRadius: 5            // The planet's size (lose if enemy reaches this)
    },

    // ==================== VISUAL ====================
    visual: {
        projectileLength: 2,       // Length of laser projectiles
        projectileColor: 0x00ffff, // Cyan laser color
        explosionDuration: 0.5,    // How long explosions last
        damageNumberDuration: 1    // How long damage numbers float
    },

    // ==================== SCORING ====================
    scoring: {
        pointsPerKill: {
            basic: 100,
            fast: 150,
            armored: 250
        },
        accuracyBonus: 0.5         // Multiplier for accuracy (0.5 = 50% bonus at 100% accuracy)
    }
};

/**
 * Helper function to get enemy config by type
 * @param {string} type - Enemy type (basic, fast, armored)
 * @returns {object} Enemy configuration
 */
export function getEnemyConfig(type) {
    return CONFIG.enemies[type] || CONFIG.enemies.basic;
}

/**
 * Helper function to get wave config
 * @param {number} waveNumber - Wave number
 * @returns {object} Wave configuration
 */
export function getWaveConfig(waveNumber) {
    // If wave doesn't exist, generate a harder version of wave 5
    if (!CONFIG.waves[waveNumber]) {
        const scale = Math.floor(waveNumber / 5) + 1;
        return {
            enemies: [
                { type: 'basic', count: 5 * scale, spawnDelay: 1.5 / scale },
                { type: 'fast', count: 3 * scale, spawnDelay: 1 / scale },
                { type: 'armored', count: 2 * scale, spawnDelay: 3 / scale }
            ],
            bonusCredits: 150 * scale
        };
    }
    return CONFIG.waves[waveNumber];
}
