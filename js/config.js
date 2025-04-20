// Game configuration and constants
const CONFIG = {
    // Game settings
    startingCredits: 0,
    cannonFireRate: 1, // 1 shot per second
    
    // Starbase settings
    starbase: {
        health: 1000,
        radius: 5,
        cannonDamage: 50,
        cannonRange: 100,
        rotationSpeed: 0.05,
    },
    
    // Upgrades
    upgrades: {
        autoAim: {
            cost: 100,
            acquired: false
        },
        cannonDamage: {
            cost: 25,
            level: 1,
            percentIncrease: 0.05
        },
        cannonRange: {
            cost: 25,
            level: 1,
            rangeIncrease: 5
        },
        missileLauncher: {
            cost: 100,
            acquired: false,
            damage: 100,
            range: 150,
            fireRate: 2 // 1 missile every 2 seconds
        },
        missileDamage: {
            cost: 25,
            level: 0,
            percentIncrease: 0.05
        },
        missileRange: {
            cost: 25,
            level: 0,
            rangeIncrease: 5
        },
        missileTarget: {
            cost: 100,
            acquired: false,
            currentTarget: 'closest' // closest, highest-health, farthest, highest-armor, lowest-armor
        },
        launchBay: {
            cost: 100,
            count: 0,
            launchRate: 5, // seconds between fighter launches
            fighterHealth: 50,
            fighterDamage: 20,
            fighterSpeed: 1
        }
    },
    
    // Enemy types and stats
    enemies: {
        fighter: {
            health: 100,
            armor: 1,
            speed: 0.8,
            credits: 5,
            size: 3,
            color: 0x00ff00
        },
        bomber: {
            health: 100,
            armor: 5,
            speed: 0.6,
            credits: 10,
            size: 4,
            color: 0xff6600
        },
        destroyer: {
            health: 200,
            armor: 10,
            speed: 0.5,
            credits: 20,
            size: 5,
            color: 0xff0000
        },
        battleship: {
            health: 300,
            armor: 20,
            speed: 0.4,
            credits: 30,
            size: 6,
            color: 0x9900cc
        },
        dreadnought: {
            health: 400,
            armor: 30,
            speed: 0.3,
            credits: 40,
            size: 7,
            color: 0x0000ff
        },
        carrier: {
            health: 400,
            armor: 30,
            speed: 0.25,
            credits: 25,
            size: 8,
            spawnRate: 1, // Spawn 1 fighter every second
            spawnType: 'fighter',
            spawnCount: 2, // Spawn 2 fighters per event
            color: 0x660066
        },
        superDreadnought: {
            health: 500,
            armor: 40,
            speed: 0.2,
            credits: 50,
            size: 9,
            color: 0x990000
        },
        superCarrier: {
            health: 500,
            armor: 40,
            speed: 0.2,
            credits: 25,
            size: 10,
            spawnRate: 1, // Spawn fighters/bombers every second
            spawnTypes: ['fighter', 'fighter', 'fighter', 'fighter', 'bomber'], // 4 fighters + 1 bomber
            color: 0x330033
        }
    },
    
    // Level configurations
    levels: [
        {
            number: 1,
            enemies: [
                { type: 'fighter', count: 10 }
            ]
        },
        {
            number: 2,
            enemies: [
                { type: 'fighter', count: 10 },
                { type: 'bomber', count: 2 }
            ]
        },
        {
            number: 3,
            enemies: [
                { type: 'fighter', count: 20 },
                { type: 'bomber', count: 5 }
            ]
        },
        {
            number: 4,
            enemies: [
                { type: 'fighter', count: 20 },
                { type: 'bomber', count: 10 }
            ]
        },
        {
            number: 5,
            enemies: [
                { type: 'fighter', count: 20 },
                { type: 'bomber', count: 10 },
                { type: 'destroyer', count: 1 }
            ]
        }
    ],
    
    // World settings
    world: {
        size: 500, // World radius
        spawnRadius: 450, // Distance from center where enemies spawn
        planetRadius: 30, // Size of the planet
        starbaseOrbitRadius: 50 // Distance from center to starbase
    },
    
    // Game state
    gameState: {
        currentLevel: 1,
        isGameOver: false,
        isPaused: false,
        isLevelComplete: false
    }
}; 