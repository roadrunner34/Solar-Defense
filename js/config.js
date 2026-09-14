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
            armored: 25,           // Armored enemies worth the most
            boss: 250              // A boss is a wave's worth of income on its own
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
        },

        // ---------- SUPPORT PLATFORMS ----------
        // These do no damage at all. They are `behaviour: 'aura'` rather than
        // 'turret': no target, no barrel, no projectile - they apply a status
        // effect to everything inside their radius on a tick.
        //
        // A support platform is worth nothing on its own, which is the point.
        // Both of these multiply what the guns around them are already doing,
        // so their value is entirely a question of WHERE they go - which is the
        // decision this whole game is about.

        // Gravity Well - slows everything in range
        gravityWell: {
            behaviour: 'aura',
            statusType: 'slow',

            // Fraction of speed removed. Upgradeable, and capped in aggregate
            // by status.minSpeedMultiplier so a field of these cannot stop a
            // wave dead.
            magnitude: 0.4,

            // Seconds the slow lingers after an enemy leaves the radius. Longer
            // than the tick interval, or an enemy would flicker in and out of
            // being slowed between ticks.
            duration: 0.6,

            range: 55,
            cost: 75,

            // Support platforms have no damage or fire rate to show, so the
            // build menu and selection panel read this instead
            blurb: '-40% speed - 55 range',

            // What this platform can have upgraded. Defaults to the weapon
            // stats when absent - see getUpgradeStats() in upgrade.js.
            upgradeStats: ['magnitude', 'range', 'duration']
        },

        // Disruptor - strips armour from everything in range
        //
        // This exists to fix a dead end in the balance rather than to add a
        // number. Armour subtracts from every incoming hit, so a Laser
        // Battery's 20 damage lands as 10 on an Armored enemy - the cheap
        // platform is simply the wrong tool, and there is no counter-play, only
        // the instruction to build something else.
        //
        // A Disruptor makes the platform the player already owns viable against
        // the enemy it currently cannot hurt. That is a decision, not a stat.
        disruptor: {
            behaviour: 'aura',
            statusType: 'armorShred',

            // Flat armour points removed. Set above the Armored enemy's 10 so
            // the effect is decisive rather than a partial discount - halfway
            // measures here would just move the dead end rather than remove it.
            magnitude: 12,

            // Longer than the Gravity Well's, because this is meant to hold
            // through the approach: an enemy shredded as it passes the
            // Disruptor should still be soft when it reaches the guns further in
            duration: 3,

            // Shorter range than the Gravity Well. A slow wants to cover the
            // approach; this wants to mark a killing ground.
            range: 45,

            cost: 90,
            blurb: '-12 armour - 45 range',
            upgradeStats: ['magnitude', 'range', 'duration']
        }
    },

    // ==================== STATUS EFFECTS ====================
    status: {
        // No matter how many Gravity Wells overlap, an enemy never drops below
        // this fraction of its speed.
        //
        // Without a floor, enough overlapping fields stop a wave outright - and
        // an enemy at zero speed never reaches the planet and never leaves, so
        // the wave never ends and the run cannot progress. That is not
        // difficulty, it is a softlock dressed up as a strategy.
        minSpeedMultiplier: 0.25,

        // How often an aura platform re-applies its effect, in seconds. Far
        // slower than a frame because there is no benefit to re-stamping the
        // same effect sixty times a second, and a full board of aura platforms
        // scanning every enemy every frame is real work for no gain.
        auraTickSeconds: 0.25
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
        },

        // ---------- BOSS ----------
        // Endless mode had no shape: wave 23 played exactly like wave 22, only
        // with more of everything. A boss is punctuation - something that ends
        // a stretch of the run and is remembered separately from it.
        boss: {
            health: 2000,
            speed: 2.2,            // Slow, so the fight lasts and can be lost

            // Armour was 20 in the first playtest, and that was a mistake worth
            // recording. damageEnemy() floors a hit at 1, so a Laser Battery's
            // 20 damage landed as exactly 1 - seven of them took a full minute
            // to remove a third of the boss, and the player's only feedback was
            // that their guns had stopped working, with no legible reason.
            //
            // 14 keeps the lesson and drops the cliff. A laser lands 6 instead
            // of 1: visibly blunted, not silently useless. A Disruptor still
            // triples it, which is the counter-play this fight exists to teach.
            armor: 14,

            size: 3.4,
            color: 0xff2266,       // Crimson - unlike any of the three regulars

            // Marks it as a boss: gets the HUD health bar rather than the
            // floating one, a heavier death, and its own credit value.
            isBoss: true,
            displayName: 'Dreadnought',

            // Shrugs off most of what support platforms do to it.
            //
            // Without this a pair of Gravity Wells trivialises the whole fight -
            // the boss is slow already, and slowing it further just means it
            // spends longer being shot at with no way to threaten anything. A
            // boss that support platforms cannot neutralise is a boss the
            // player has to actually kill.
            statusResistance: 0.65
        }
    },

    // ==================== BOSSES ====================
    bosses: {
        // A boss caps the authored campaign and then returns on this cadence
        // through endless mode.
        everyWaves: 5,

        // Health added per appearance, as a fraction of the base. The nth boss
        // is meaningfully harder than the last, or the punctuation stops
        // meaning anything by wave 30.
        healthScalePerAppearance: 0.55
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

    // ==================== WAVE FLAVOUR ====================
    // One line per authored wave, shown under the wave number.
    //
    // This fills showWaveAnnouncement()'s `subtitle` parameter, which has
    // existed since Sprint 1 with a default of '' and no caller anywhere - the
    // same kind of dangling scaffold that showTooltip() and saveProgress() were
    // before earlier sprints wired them up.
    //
    // Deliberately terse. A tower defence announces a wave for about a second
    // and a half, which is time for a fragment, not a sentence - and the player
    // is watching the board, not reading.
    waveFlavour: {
        1: 'Scouts on the near approach',
        2: 'They have found the range',
        3: 'Fast movers leading',
        4: 'Mixed formation inbound',
        5: 'Something large behind them'
    },

    // Lines for generated waves past the campaign, cycled in order. Endless
    // mode needs to keep sounding like a war rather than a spreadsheet.
    endlessFlavour: [
        'No end to them',
        'Holding the line',
        'The approach is thick with contacts',
        'Still coming',
        'Nothing left to fall back to'
    ],

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
            fireRate: [1, 1.25, 1.55, 1.9],

            // Support-platform stats. Magnitude climbs slowly on purpose: the
            // aggregate slow is floored at status.minSpeedMultiplier anyway, so
            // a steep curve would buy tiers that do nothing once two fields
            // overlap. Duration climbs faster because extending how long an
            // effect lingers past the radius is what turns one well into real
            // area control.
            magnitude: [1, 1.18, 1.34, 1.5],
            duration:  [1, 1.3, 1.65, 2]
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
            fireRate: 'Fire rate',
            magnitude: 'Strength',
            duration: 'Duration'
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

        // ---------- MUSIC ----------
        // The score is a drone, not a tune. A tower defence is played in long
        // stretches of watching, and anything with a melody becomes maddening
        // by the fourth loop - so this is a stack of sustained voices that fade
        // in and out with how dangerous things are, and never resolves.
        //
        // Voices are pitched as an A minor drone: A1 root, E2 fifth, A2 octave,
        // C3 minor third, E3. They enter in that order, so the harmony thickens
        // and sours as the waves get worse without anything ever changing key.
        music: {
            // Seconds to crossfade a voice in or out. Long, because the player
            // should notice the music has got heavier without catching it
            // happening - a fast fade reads as a level-up jingle.
            fadeSeconds: 5,

            // The wave at which intensity reaches 1 and every voice is present.
            // Past this the music stops escalating; the enemy counts do not,
            // which is its own kind of dread.
            peakWave: 12,

            // A voice's `threshold` is the intensity by which it is fully
            // present; it fades in across this band immediately below that.
            // Without the band a voice would snap on the instant intensity
            // crossed a number, which is audible as a click.
            fadeBand: 0.18,

            // Levels are tiny compared to the sound effects because these run
            // continuously and sum with each other, whereas a laser is 120ms.
            voices: [
                // Root, doubled and detuned a fraction of a hertz. The two drift
                // in and out of phase with each other over several seconds,
                // which is what stops a held sine from sounding like a test tone.
                { wave: 'sine', freq: 55, gain: 0.13, threshold: 0,
                  filter: { type: 'lowpass', freq: 320, q: 0.8 } },
                { wave: 'sine', freq: 55.22, gain: 0.11, threshold: 0,
                  filter: { type: 'lowpass', freq: 320, q: 0.8 } },

                // Fifth - arrives almost immediately, fills out the root
                { wave: 'triangle', freq: 82.41, gain: 0.055, threshold: 0.12,
                  filter: { type: 'lowpass', freq: 600, q: 0.9 } },

                // Octave, pulsing. The LFO on its gain gives the drone a slow
                // heartbeat once things are getting busy.
                { wave: 'sine', freq: 110, gain: 0.05, threshold: 0.35,
                  pulse: { rate: 0.42, depth: 0.75 },
                  filter: { type: 'lowpass', freq: 900, q: 1 } },

                // Minor third - the voice that makes the whole stack read as
                // ominous rather than merely low
                { wave: 'triangle', freq: 130.81, gain: 0.035, threshold: 0.58,
                  filter: { type: 'lowpass', freq: 1400, q: 1 } },

                // High fifth, faintly. Tension at the top of the mix.
                { wave: 'sine', freq: 164.81, gain: 0.022, threshold: 0.8,
                  pulse: { rate: 0.9, depth: 0.5 },
                  filter: { type: 'lowpass', freq: 2200, q: 1 } }
            ]
        },

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

            // A boss has arrived. Low, slow and dissonant - a minor second
            // between the two sustained tones, which is the interval the ear
            // reads as threat rather than as music.
            bossArrival: {
                cooldown: 2,
                priority: true,
                layers: [
                    {
                        source: 'tone', wave: 'sawtooth',
                        freq: [55, 41], duration: 2.2,
                        gain: 0.3, attack: 0.08,
                        filter: { type: 'lowpass', freq: [700, 160], q: 2 }
                    },
                    {
                        source: 'tone', wave: 'sawtooth',
                        freq: [58.3, 43.5], duration: 2.2,
                        gain: 0.26, attack: 0.08,
                        filter: { type: 'lowpass', freq: [700, 160], q: 2 }
                    },
                    {
                        source: 'noise',
                        duration: 1.6, gain: 0.22, attack: 0.25,
                        filter: { type: 'bandpass', freq: [300, 1200], q: 0.8 }
                    }
                ]
            },

            // End of run. Both are priority, and both are deliberately built
            // from the same three notes - the campaign resolving upward into a
            // major triad, or collapsing downward. Using one shape for both is
            // what makes them read as two outcomes of the same story.
            victory: {
                cooldown: 1,
                priority: true,
                layers: [
                    {
                        source: 'tone', wave: 'triangle',
                        freq: [440, 440], duration: 0.5,
                        gain: 0.2, attack: 0.015
                    },
                    {
                        source: 'tone', wave: 'triangle',
                        freq: [554.37, 554.37], duration: 0.5,
                        gain: 0.18, attack: 0.015, delay: 0.16
                    },
                    {
                        source: 'tone', wave: 'triangle',
                        freq: [659.25, 659.25], duration: 1.1,
                        gain: 0.18, attack: 0.015, delay: 0.32
                    }
                ]
            },

            defeat: {
                cooldown: 1,
                priority: true,
                layers: [
                    {
                        source: 'tone', wave: 'triangle',
                        freq: [330, 330], duration: 0.6,
                        gain: 0.2, attack: 0.02
                    },
                    {
                        source: 'tone', wave: 'triangle',
                        freq: [261.63, 261.63], duration: 0.7,
                        gain: 0.19, attack: 0.02, delay: 0.2
                    },
                    {
                        source: 'tone', wave: 'sine',
                        freq: [110, 55], duration: 1.8,
                        gain: 0.26, attack: 0.03, delay: 0.4
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
            armored: 250,
            boss: 3000
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

/**
 * Whether a wave ends with a boss.
 *
 * Wave 5 caps the authored campaign, and then every fifth wave through endless
 * mode. Derived rather than listed, so endless keeps producing them forever.
 *
 * @param {number} waveNumber
 * @returns {boolean}
 */
export function isBossWave(waveNumber) {
    return waveNumber > 0 && waveNumber % CONFIG.bosses.everyWaves === 0;
}

/**
 * How much health a boss has, relative to its base, on a given wave.
 *
 * The first boss is the base value; each subsequent appearance adds a fixed
 * fraction. Linear rather than compounding, because a compounding curve makes
 * the tenth boss unkillable while the third is still trivial.
 *
 * @param {number} waveNumber
 * @returns {number} Multiplier for CONFIG.enemies.boss.health
 */
export function getBossHealthScale(waveNumber) {
    if (!isBossWave(waveNumber)) return 1;

    const appearance = waveNumber / CONFIG.bosses.everyWaves; // 1, 2, 3, ...

    return 1 + (appearance - 1) * CONFIG.bosses.healthScalePerAppearance;
}

/**
 * The flavour line shown under a wave's number.
 *
 * Authored for the campaign, cycled from a shorter list past it. Returns an
 * empty string rather than null when there is nothing to say, because
 * showWaveAnnouncement() treats any falsy subtitle as "no subtitle" and an
 * empty span would still take up layout.
 *
 * @param {number} waveNumber
 * @returns {string}
 */
export function getWaveFlavour(waveNumber) {
    if (CONFIG.waveFlavour[waveNumber]) return CONFIG.waveFlavour[waveNumber];

    const lines = CONFIG.endlessFlavour;
    if (!lines || lines.length === 0) return '';

    const past = waveNumber - AUTHORED_WAVE_COUNT - 1;
    if (past < 0) return '';

    return lines[past % lines.length];
}

/**
 * A one-line summary of what a wave contains: "8 basic - 5 fast - 2 armored".
 *
 * The game asks players to spend credits before a wave arrives, and until now
 * that spending was blind - you could not know whether the next wave was
 * fifteen basics or three armoured until it was already on the board. Naming
 * the composition turns a guess into a decision, and costs one function.
 *
 * @param {number} waveNumber
 * @returns {string} Empty if the wave has no enemies
 */
export function describeWaveComposition(waveNumber) {
    const wave = getWaveConfig(waveNumber);
    if (!wave || !wave.enemies) return '';

    const parts = wave.enemies
        .filter(group => group.count > 0)
        .map(group => `${group.count} ${group.type}`);

    if (isBossWave(waveNumber)) parts.push('1 boss');

    return parts.join(' · ');
}
