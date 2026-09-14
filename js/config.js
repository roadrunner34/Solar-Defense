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

    // ==================== PLATFORMS ====================
    // The two types are deliberately opposed: the Laser Battery is cheap, fast
    // firing and quick to turn but weak per shot, while the Missile Launcher
    // hits hard at long range but is slow to fire and slow to track. Fast
    // enemies can outrun a Missile Launcher's aim, which is what makes mixing
    // the two worthwhile.
    platforms: {
        // Laser Battery - Fast-firing, medium-range weapon platform
        laserBattery: {
            damage: 20,            // Damage per shot (lower than starbase but faster firing)
            range: 80,              // Maximum firing range (units)
            fireRate: 1.2,          // Shots per second (faster than starbase)
            cost: 50,               // Credits required to build
            projectileType: 'laser',
            projectileSpeed: 60,    // Light, fast bolts - quicker than the starbase's 50
            rotationSpeed: 3.0      // Turns quickly, so it can track fast enemies
        },
        // Missile Launcher - High-damage, long-range weapon platform
        missileLauncher: {
            damage: 40,            // Damage per shot (higher than laser battery)
            range: 100,             // Maximum firing range (units, same as starbase)
            fireRate: 0.8,          // Shots per second (slower than laser battery)
            cost: 100,              // Credits required to build (more expensive)
            projectileType: 'missile',
            projectileSpeed: 35,    // Heavy ordnance - slower than the starbase's 50
            rotationSpeed: 1.5      // Turns slowly, so fast enemies can outrun its aim
        }
    },

    // ==================== PROJECTILES ====================
    // Two genuinely different weapons, not one bolt wearing two hats.
    //
    // The laser is a dumb bolt: it is fired along a fixed heading and whatever
    // it meets first takes all of the damage. The missile steers toward its
    // target and detonates, splitting its damage across everything nearby.
    // That is what makes the Missile Launcher worth its extra 50 credits
    // against a clustered wave, and what makes the Laser Battery the better
    // answer to a single fast runner.
    projectiles: {
        laser: {
            radius: 0.1,
            length: 2,
            homing: false,
            trailInterval: 0.02,   // Seconds between trail particles
            splashRadius: 0
        },
        missile: {
            radius: 0.22,
            length: 1.6,
            homing: true,
            turnRate: 2.6,         // Radians per second it can correct its heading
            trailInterval: 0.014,  // Denser than a laser - this one leaves smoke
            splashRadius: 7,       // World units
            // Damage at the very edge of the blast, as a fraction of full.
            // Above zero so a near miss still does something, well below 1 so
            // that aiming into the middle of a group is rewarded.
            splashMinimum: 0.3
        }
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

    // ==================== PLANET ====================
    planet: {
        // How many enemies can reach the planet before the run ends.
        //
        // This used to be effectively 1: a single leak ended the game instantly.
        // That is the harshest failure state a tower defence can have, and it
        // made experimenting with placement maximally expensive - the thing a
        // game about placement most needs players to do. Three hits turns a
        // mistake into information rather than a restart.
        integrity: 3,

        // The visible shield bubble, which cracks as integrity is spent
        shieldRadius: 7.6
    },

    // ==================== UPGRADES ====================
    // Three tiers per stat. Index 0 is the unupgraded value, so a tier-2
    // Laser Battery does damage * multipliers.damage[2].
    //
    // The curves are deliberately uneven. Damage climbs fastest because it is
    // the stat that keeps a platform relevant as enemy health scales; range
    // climbs slowest because range compounds with placement, and a cheap range
    // upgrade would let one well-placed platform cover the whole approach.
    upgrades: {
        maxTier: 3,

        multipliers: {
            damage:   [1, 1.4, 1.9, 2.5],
            range:    [1, 1.12, 1.26, 1.42],
            fireRate: [1, 1.25, 1.55, 1.9]
        },

        // Cost of reaching each tier, as a multiple of the structure's build
        // cost. Superlinear, so a third tier on one platform costs about as
        // much as a second tier on two - which is the choice the player is
        // actually being asked to make.
        costFactor: [0, 0.7, 1.3, 2.2],

        // Readable labels for the panel
        labels: {
            damage: 'Damage',
            range: 'Range',
            fireRate: 'Fire rate'
        },

        // The starbase has no build cost to scale from, so it gets a notional
        // one. Set above the Missile Launcher's 100 because upgrading the
        // starbase benefits the whole map rather than one position.
        starbaseBaseCost: 130
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

    // ==================== GRAPHICS ====================
    // Quality tiers. Everything here is chosen once at startup by
    // detectQualityTier() in postprocessing.js, which picks a tier from the
    // device and then lets the frame-time watchdog step it down if the
    // machine cannot keep up. 'samples' is the MSAA level on the composer's
    // render target - it is fixed at startup because changing it means
    // rebuilding the target, unlike the other knobs which are live.
    graphics: {
        defaultTier: 'high',
        tiers: {
            high: {
                pixelRatio: 2,        // Cap on window.devicePixelRatio
                samples: 4,           // MSAA samples on the composer target
                bloomStrength: 0.85,
                bloomRadius: 0.4,
                bloomThreshold: 0.2,
                asteroidCount: 240,   // Instanced, so this is cheap
                starCount: 2600,
                nebula: true
            },
            medium: {
                pixelRatio: 1.5,
                samples: 4,
                bloomStrength: 0.7,
                bloomRadius: 0.35,
                bloomThreshold: 0.25,
                asteroidCount: 140,
                starCount: 1600,
                nebula: true
            },
            low: {
                pixelRatio: 1,
                samples: 0,
                bloomStrength: 0.5,
                bloomRadius: 0.3,
                bloomThreshold: 0.35,
                asteroidCount: 60,
                starCount: 800,
                nebula: false
            }
        },
        // Colour grading, applied after tone mapping in display-referred space
        grade: {
            vignetteIntensity: 0.42,
            vignetteRadius: 0.7,
            colorTint: [0.06, 0.10, 0.16],  // Cool blue lift in the shadows
            contrast: 1.06,
            saturation: 1.12
        },
        // Frames slower than this many ms trip the auto-downgrade watchdog
        frameBudgetMs: 22
    },

    // ==================== AUDIO ====================
    // Every sound in the game is synthesized at runtime - there are no audio
    // files, for the same reason there are no texture files: the whole project
    // generates its assets at load time. js/audio.js renders these recipes
    // through the Web Audio graph.
    //
    // A sound is a stack of layers. Each layer is either a tone (an oscillator)
    // or noise (a white-noise buffer), optionally through a filter, with an
    // attack-decay envelope. 'freq' is a [start, end] pair ramped exponentially
    // over the layer's duration - that ramp is what turns a static beep into
    // something with a shape.
    audio: {
        // Concurrent voices allowed before new sounds are dropped. A missile
        // clearing six enemies fires six explosions in one frame; without a cap
        // they sum into clipping, and a late endless wave becomes a wall.
        maxVoices: 16,

        // Sounds are quieter than you would expect in isolation, because a
        // dozen of them overlap constantly. These are tuned for the busy case.
        sounds: {
            // A dumb energy bolt: bright, short, falling. The bandpass sweeping
            // down with the oscillator is what gives it the "pew" rather than a
            // flat buzz.
            laser: {
                cooldown: 0.03,
                variance: 0.08,
                layers: [
                    {
                        source: 'tone', wave: 'sawtooth',
                        freq: [1200, 300], duration: 0.12,
                        gain: 0.3, attack: 0.004,
                        filter: { type: 'bandpass', freq: [2400, 600], q: 4 }
                    }
                ]
            },

            // Heavy ordnance leaving a tube: a noise whoosh over a low thump.
            missileLaunch: {
                cooldown: 0.05,
                variance: 0.06,
                layers: [
                    {
                        source: 'noise',
                        duration: 0.38, gain: 0.26, attack: 0.01,
                        filter: { type: 'lowpass', freq: [1800, 220], q: 1 }
                    },
                    {
                        source: 'tone', wave: 'sine',
                        freq: [200, 55], duration: 0.3,
                        gain: 0.22, attack: 0.006
                    }
                ]
            },

            // The kill sound. Noise body for the debris, sine thump for the
            // weight - an explosion without the low end reads as a hiss.
            explosion: {
                cooldown: 0.04,
                variance: 0.12,
                layers: [
                    {
                        source: 'noise',
                        duration: 0.5, gain: 0.42, attack: 0.004,
                        filter: { type: 'lowpass', freq: [1400, 80], q: 1 }
                    },
                    {
                        source: 'tone', wave: 'sine',
                        freq: [130, 38], duration: 0.36,
                        gain: 0.3, attack: 0.004
                    }
                ]
            },

            // A hit that did not kill. Deliberately tiny: this fires far more
            // often than anything else in the game.
            hit: {
                cooldown: 0.02,
                variance: 0.15,
                layers: [
                    {
                        source: 'noise',
                        duration: 0.07, gain: 0.14, attack: 0.002,
                        filter: { type: 'bandpass', freq: [3200, 1400], q: 2 }
                    }
                ]
            },

            // An enemy reached the planet. Two sines a hair apart, so they beat
            // against each other - an unsteady, wrong sound, which is the point.
            // Priority, because this must never be what the voice cap eats.
            breach: {
                cooldown: 0.4,
                priority: true,
                layers: [
                    {
                        source: 'tone', wave: 'sine',
                        freq: [90, 64], duration: 1.2,
                        gain: 0.34, attack: 0.02
                    },
                    {
                        source: 'tone', wave: 'sine',
                        freq: [94, 67], duration: 1.2,
                        gain: 0.34, attack: 0.02
                    },
                    {
                        source: 'noise',
                        duration: 0.6, gain: 0.3, attack: 0.005,
                        filter: { type: 'lowpass', freq: [900, 60], q: 1 }
                    }
                ]
            },

            // UI. Rising for things you gain, falling for things you give up.
            build: {
                cooldown: 0.05,
                layers: [
                    {
                        source: 'tone', wave: 'triangle',
                        freq: [420, 840], duration: 0.16,
                        gain: 0.2, attack: 0.005
                    }
                ]
            },

            sell: {
                cooldown: 0.05,
                layers: [
                    {
                        source: 'tone', wave: 'triangle',
                        freq: [720, 340], duration: 0.16,
                        gain: 0.2, attack: 0.005
                    }
                ]
            },

            // Two notes, the second delayed - a small fanfare for spending money
            upgrade: {
                cooldown: 0.05,
                layers: [
                    {
                        source: 'tone', wave: 'triangle',
                        freq: [600, 600], duration: 0.1,
                        gain: 0.18, attack: 0.004
                    },
                    {
                        source: 'tone', wave: 'triangle',
                        freq: [900, 900], duration: 0.16,
                        gain: 0.18, attack: 0.004, delay: 0.08
                    }
                ]
            },

            uiClick: {
                cooldown: 0.02,
                layers: [
                    {
                        source: 'tone', wave: 'square',
                        freq: [900, 880], duration: 0.035,
                        gain: 0.08, attack: 0.002
                    }
                ]
            },

            // A wave is starting. Priority - it is an announcement, and being
            // dropped because the previous wave's last explosion is still
            // ringing would be exactly backwards.
            waveStart: {
                cooldown: 0.5,
                priority: true,
                layers: [
                    {
                        source: 'tone', wave: 'triangle',
                        freq: [440, 440], duration: 0.28,
                        gain: 0.22, attack: 0.01
                    },
                    {
                        source: 'tone', wave: 'triangle',
                        freq: [660, 660], duration: 0.4,
                        gain: 0.22, attack: 0.01, delay: 0.14
                    }
                ]
            }
        }
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
 * Helper function to get platform config by type
 * @param {string} type - Platform type (laserBattery, missileLauncher)
 * @returns {object} Platform configuration
 */
export function getPlatformConfig(type) {
    return CONFIG.platforms[type] || CONFIG.platforms.laserBattery;
}

/** How many waves are hand-authored in CONFIG.waves. */
const AUTHORED_WAVE_COUNT = Object.keys(CONFIG.waves).length;

/**
 * The tightest the spawn spacing is ever allowed to get, as a fraction of the
 * authored delay. See the note in getWaveConfig().
 */
const MIN_SPAWN_DELAY_FACTOR = 0.3;

/**
 * Get the configuration for a wave.
 *
 * Waves 1 to 5 are hand-authored. Anything beyond is generated on a continuous
 * difficulty ramp - see the extended note inside.
 *
 * @param {number} waveNumber - Wave number
 * @returns {object} Wave configuration
 */
export function getWaveConfig(waveNumber) {
    if (CONFIG.waves[waveNumber]) return CONFIG.waves[waveNumber];

    // ---------- GENERATED WAVES ----------
    //
    // Past the authored campaign the game keeps going, scaling wave 5's
    // composition. This branch existed from Sprint 1 and was unreachable,
    // because main.js hard-stopped the game at wave 5 - so its curve was never
    // played and never questioned.
    //
    // It used to scale on `Math.floor(waveNumber / 5) + 1`, which is a step
    // function: wave 6 arrived at double the enemy count of wave 5, waves 6
    // through 9 were then identical to each other, and wave 10 doubled again.
    // A difficulty curve made of cliffs and plateaus is the worst of both -
    // the cliffs feel unfair and the plateaus feel like nothing is happening.
    //
    // A continuous ramp instead. Every wave is a little harder than the last,
    // which is what lets a player feel themselves reaching their limit rather
    // than hitting a wall.
    const past = waveNumber - AUTHORED_WAVE_COUNT;

    // Enemy counts grow steadily. Rounding means a count occasionally holds for
    // a wave rather than rising, which is fine - it never falls.
    const countScale = 1 + past * 0.22;

    // Spawn spacing tightens more slowly than counts grow, and stops tightening
    // altogether at the floor. Without a floor the delay tends toward zero and
    // a late wave arrives as a single instantaneous block, which is not
    // difficulty - it is just an unwinnable frame.
    const pacing = Math.max(MIN_SPAWN_DELAY_FACTOR, 1 - past * 0.055);

    const scaled = (count, delay) => ({
        count: Math.round(count * countScale),
        spawnDelay: Math.max(0.25, delay * pacing)
    });

    return {
        enemies: [
            { type: 'basic', ...scaled(5, 1.5) },
            { type: 'fast', ...scaled(3, 1) },
            { type: 'armored', ...scaled(2, 3) }
        ],

        // Rewards climb with the difficulty, so a player pushing deep into
        // endless can still afford to keep building
        bonusCredits: Math.round(150 * (1 + past * 0.3))
    };
}
