/**
 * main.js - Main Game Entry Point
 * 
 * This is where everything comes together! This file:
 * 1. Initializes all game systems
 * 2. Runs the game loop (update → render → repeat)
 * 3. Manages game state (menu, playing, paused, etc.)
 * 4. Handles wave progression
 * 
 * Think of this as the "conductor" of the orchestra - it coordinates
 * all the different systems (enemies, projectiles, UI, etc.) to work
 * together harmoniously.
 */

import * as THREE from 'three';

// ==================== POST-PROCESSING IMPORTS ====================
// These add visual effects like bloom (glow), color correction, etc.
// The EffectComposer chains multiple effects together efficiently
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

// Import all our game systems
import { createScene, scene, updateScene } from './scene.js';
import { createCamera, camera, updateCamera, handleResize, shakeCamera } from './camera.js';
import { initInput, enterPlacementMode, exitPlacementMode, isInPlacementMode, clearInputFlags } from './input.js';
import { initPaths, getRandomPathName } from './path.js';
import { initEnemies, spawnEnemy, updateEnemies, clearEnemies, 
         projectHealthBars, getEnemyCount, enemies } from './enemy.js';
import { createStarbase, updateStarbase, resetStarbaseStats } from './starbase.js';
import { createProjectile, updateProjectiles, clearProjectiles, createHitEffect } from './projectile.js';
import { initParticles, updateParticles, createEnemyDeathEffect, createMuzzleSparks } from './particles.js';
import { initEconomy, recordKill, recordShot, recordHit, awardWaveBonus,
         resetWaveTracking, getWaveSummary, getCredits, getScore } from './economy.js';
import { initUI, setupUICallbacks, updateHUD, showScreen, hideAllScreens,
         setHUDVisible, showDamageNumber, showFloatingText, showWaveAnnouncement,
         showWaveSummary, worldToScreen } from './ui.js';
import { CONFIG, getWaveConfig } from './config.js';

// ==================== GAME STATE ====================
// The game can be in one of these states at any time

const GameState = {
    MENU: 'menu',
    PLAYING: 'playing',
    PAUSED: 'paused',
    WAVE_COMPLETE: 'wave_complete',
    VICTORY: 'victory',
    DEFEAT: 'defeat'
};

let currentState = GameState.MENU;

// ==================== GAME VARIABLES ====================

let renderer;
let clock;
let composer; // Post-processing effect composer
let currentWave = 1;
let totalWaves = 5; // Number of waves to win
let enemiesSpawnedThisWave = 0;
let enemiesToSpawnThisWave = 0;
let spawnTimer = 0;
let currentSpawnDelay = 2;
let currentEnemyTypeIndex = 0;
let waveEnemyQueue = []; // Queue of enemies to spawn

// For wave transition timing
let waveTransitionTimer = 0;
const WAVE_TRANSITION_DELAY = 3; // Seconds between waves

// ==================== INITIALIZATION ====================

/**
 * Initialize the game
 * Sets up all systems and prepares for play
 */
function init() {
    console.log('Solar Defense - Initializing...');
    
    // Create the WebGL renderer
    // toneMapping helps with HDR-like effects (bright colors look better with bloom)
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // Limit for performance
    renderer.toneMapping = THREE.ACESFilmicToneMapping; // Cinematic tone mapping
    renderer.toneMappingExposure = 1.0;
    
    // Add canvas to the page
    const container = document.getElementById('game-container');
    container.appendChild(renderer.domElement);
    
    // Initialize Three.js scene and camera
    createScene();
    createCamera(renderer);
    
    // ==================== POST-PROCESSING SETUP ====================
    // The EffectComposer chains rendering passes together
    // Each pass adds a visual effect to the final image
    setupPostProcessing();
    
    // Initialize game systems
    initInput();
    initPaths();
    initEnemies();
    initUI();
    initEconomy();

    // Initialize particle effects system
    // This creates pooled particle systems for explosions, sparks, trails
    initParticles();
    
    // Create the player's starbase
    createStarbase();
    
    // Set up UI callbacks
    setupUICallbacks({
        onStart: startGame,
        onRestart: restartGame,
        onResume: resumeGame
    });
    
    // Handle window resize
    window.addEventListener('resize', onWindowResize);
    
    // Handle pause with Escape key
    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            // If in placement mode, just exit placement (don't pause)
            if (isInPlacementMode()) {
                exitPlacementMode();
                return;
            }
            
            if (currentState === GameState.PLAYING) {
                pauseGame();
            } else if (currentState === GameState.PAUSED) {
                resumeGame();
            }
        }
        
        // ==================== TEMPORARY DEBUG KEYS ====================
        // These allow testing placement without the full UI
        // Press 1 for Laser Battery, 2 for Missile Launcher
        // TODO: Remove these when UI is implemented (Task 5.x)
        if (currentState === GameState.PLAYING) {
            if (e.key === '1') {
                enterPlacementMode('laserBattery');
                console.log('DEBUG: Press 1 - Laser Battery placement mode');
            } else if (e.key === '2') {
                enterPlacementMode('missileLauncher');
                console.log('DEBUG: Press 2 - Missile Launcher placement mode');
            }
        }
    });

    
    
    // Create clock for delta time calculation
    clock = new THREE.Clock();
    
    // Show start screen
    showScreen('start');
    
    // Start the game loop
    animate();
    
    console.log('Solar Defense - Ready!');
}

/**
 * Set up post-processing effects
 * 
 * Post-processing works like Instagram filters - the scene is rendered first,
 * then effects are applied on top. We use:
 * 
 * 1. RenderPass - Renders the base scene (required first step)
 * 2. UnrealBloomPass - Adds glow/bloom to bright objects (makes lasers and sun glow!)
 * 3. VignetteColorGradePass - Darkens edges + color grading for cinematic look
 * 4. OutputPass - Final color correction and output
 * 
 * The "bloom" effect makes anything bright appear to glow and bleed light
 * into surrounding areas. It's what makes sci-fi games look so polished!
 */
function setupPostProcessing() {
    // Create the composer - it manages the chain of effects
    composer = new EffectComposer(renderer);
    
    // Pass 1: Render the scene normally
    // This is always the first pass - it provides the base image
    const renderPass = new RenderPass(scene, camera);
    composer.addPass(renderPass);
    
    // Pass 2: Bloom effect (the magic!)
    // Parameters: resolution, strength, radius, threshold
    // - resolution: Size of the bloom texture (uses screen size)
    // - strength: How intense the glow is (higher = brighter glow)
    // - radius: How far the glow spreads (higher = wider glow)
    // - threshold: Brightness level where bloom starts (lower = more things glow)
    const bloomPass = new UnrealBloomPass(
        new THREE.Vector2(window.innerWidth, window.innerHeight),
        0.8,    // strength - moderate glow
        0.4,    // radius - medium spread
        0.2     // threshold - only bright things glow (sun, projectiles, etc.)
    );
    composer.addPass(bloomPass);
    
    // Store bloom pass so we can adjust settings later if needed
    composer.bloomPass = bloomPass;
    
    // Pass 3: Vignette + Color Grading effect
    // This creates a custom shader that:
    // - Darkens the edges of the screen (vignette) for a cinematic look
    // - Applies color grading to give a space/sci-fi feel (cooler blues, warmer highlights)
    const vignetteColorGradePass = new ShaderPass(VignetteColorGradeShader);
    vignetteColorGradePass.uniforms.vignetteIntensity.value = 0.4; // How dark the edges get
    vignetteColorGradePass.uniforms.vignetteRadius.value = 0.75; // How far from center vignette starts
    vignetteColorGradePass.uniforms.colorTint.value.set(0.1, 0.15, 0.2); // Subtle blue tint
    vignetteColorGradePass.uniforms.contrast.value = 1.1; // Slight contrast boost
    vignetteColorGradePass.uniforms.saturation.value = 1.15; // Slightly more vibrant
    composer.addPass(vignetteColorGradePass);
    
    // Store for potential adjustments
    composer.vignettePass = vignetteColorGradePass;
    
    // Pass 4: Output pass - ensures correct color space
    // Without this, colors might look washed out
    const outputPass = new OutputPass();
    composer.addPass(outputPass);
    
    console.log('Post-processing initialized with bloom, vignette, and color grading');
}

/**
 * Custom Vignette + Color Grading Shader
 * 
 * SHADERS EXPLAINED:
 * ==================
 * Shaders are small programs that run on the GPU. They're SUPER fast because
 * they run in parallel on thousands of GPU cores. There are two types:
 * 
 * Vertex Shader: Positions each vertex (corner) of geometry
 * Fragment Shader: Determines the color of each pixel
 * 
 * This shader is a "post-processing" shader - it takes the rendered image
 * and modifies each pixel to add effects.
 * 
 * UNIFORMS: Values passed from JavaScript to the shader
 * VARYINGS: Values passed from vertex shader to fragment shader
 */
const VignetteColorGradeShader = {
    uniforms: {
        // The input texture (the rendered scene)
        tDiffuse: { value: null },
        
        // Vignette settings
        vignetteIntensity: { value: 0.5 }, // How dark edges get (0-1)
        vignetteRadius: { value: 0.75 },   // Where vignette starts (0=center, 1=edge)
        
        // Color grading
        colorTint: { value: new THREE.Vector3(0, 0, 0) }, // RGB tint added to shadows
        contrast: { value: 1.0 },     // 1 = normal, >1 = more contrast
        saturation: { value: 1.0 }    // 1 = normal, >1 = more saturated
    },
    
    // Vertex shader - just passes through position and UV coordinates
    // UV coordinates tell us where we are on the texture (0,0 = bottom-left, 1,1 = top-right)
    vertexShader: /* glsl */`
        varying vec2 vUv;
        
        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
    
    // Fragment shader - this is where the magic happens!
    // Runs once for EVERY pixel on screen
    fragmentShader: /* glsl */`
        uniform sampler2D tDiffuse;
        uniform float vignetteIntensity;
        uniform float vignetteRadius;
        uniform vec3 colorTint;
        uniform float contrast;
        uniform float saturation;
        
        varying vec2 vUv;
        
        void main() {
            // Sample the original pixel color
            vec4 color = texture2D(tDiffuse, vUv);
            
            // ========== VIGNETTE ==========
            // Calculate distance from center of screen (0,0 to 1,1, so center is 0.5,0.5)
            vec2 center = vUv - vec2(0.5);
            float dist = length(center) * 1.414; // *1.414 normalizes diagonal to 1.0
            
            // Create smooth falloff from center to edges
            // smoothstep creates a nice S-curve transition
            float vignette = smoothstep(vignetteRadius, vignetteRadius + 0.5, dist);
            vignette = 1.0 - vignette * vignetteIntensity;
            
            // Apply vignette (darken edges)
            color.rgb *= vignette;
            
            // ========== COLOR GRADING ==========
            
            // Apply contrast
            // This pushes colors away from middle gray (0.5)
            color.rgb = (color.rgb - 0.5) * contrast + 0.5;
            
            // Apply saturation
            // We calculate luminance (grayscale) and blend toward it
            float luminance = dot(color.rgb, vec3(0.299, 0.587, 0.114));
            color.rgb = mix(vec3(luminance), color.rgb, saturation);
            
            // Apply color tint to shadows
            // The tint is stronger in darker areas
            float shadowAmount = 1.0 - luminance;
            color.rgb += colorTint * shadowAmount * 0.3;
            
            // Output final color
            gl_FragColor = color;
        }
    `
};

/**
 * Update vignette intensity (can be called during gameplay)
 * For example, increase vignette when player is low on health
 * 
 * @param {number} intensity - Vignette darkness (0-1)
 */
export function setVignetteIntensity(intensity) {
    if (composer && composer.vignettePass) {
        composer.vignettePass.uniforms.vignetteIntensity.value = intensity;
    }
}

/**
 * Apply a temporary red vignette effect (damage feedback)
 * 
 * @param {number} duration - How long the effect lasts (ms)
 */
export function flashDamageVignette(duration = 300) {
    if (composer && composer.vignettePass) {
        const pass = composer.vignettePass;
        const originalIntensity = pass.uniforms.vignetteIntensity.value;
        const originalTint = pass.uniforms.colorTint.value.clone();
        
        // Red damage flash
        pass.uniforms.vignetteIntensity.value = 0.7;
        pass.uniforms.colorTint.value.set(0.4, 0, 0); // Red tint
        
        // Reset after duration
        setTimeout(() => {
            pass.uniforms.vignetteIntensity.value = originalIntensity;
            pass.uniforms.colorTint.value.copy(originalTint);
        }, duration);
    }
}

// ==================== GAME STATE MANAGEMENT ====================

/**
 * Start a new game
 */
function startGame() {
    console.log('Starting game...');
    
    currentState = GameState.PLAYING;
    currentWave = 1;
    
    // Reset systems
    clearEnemies();
    clearProjectiles();
    resetStarbaseStats();
    initEconomy();
    
    // Hide menu, show HUD
    hideAllScreens();
    setHUDVisible(true);
    
    // Start first wave
    startWave(currentWave);
}

/**
 * Restart the game (after victory/defeat)
 */
function restartGame() {
    startGame();
}

/**
 * Pause the game
 */
function pauseGame() {
    if (currentState !== GameState.PLAYING) return;
    
    currentState = GameState.PAUSED;
    showScreen('pause');
    clock.stop();
}

/**
 * Resume from pause
 */
function resumeGame() {
    if (currentState !== GameState.PAUSED) return;
    
    currentState = GameState.PLAYING;
    hideAllScreens();
    clock.start();
}

/**
 * Handle victory
 */
function handleVictory() {
    console.log('Victory!');
    currentState = GameState.VICTORY;
    setHUDVisible(false);
    showScreen('victory');
}

/**
 * Handle defeat
 */
function handleDefeat() {
    console.log('Defeat!');
    currentState = GameState.DEFEAT;
    setHUDVisible(false);
    showScreen('defeat');
}

// ==================== WAVE MANAGEMENT ====================

/**
 * Start a new wave
 * @param {number} waveNumber - Which wave to start
 */
function startWave(waveNumber) {
    console.log(`Starting Wave ${waveNumber}`);
    
    const waveConfig = getWaveConfig(waveNumber);
    
    // Build spawn queue
    waveEnemyQueue = [];
    waveConfig.enemies.forEach(enemyGroup => {
        for (let i = 0; i < enemyGroup.count; i++) {
            waveEnemyQueue.push({
                type: enemyGroup.type,
                spawnDelay: enemyGroup.spawnDelay
            });
        }
    });
    
    // Shuffle queue slightly for variety (optional)
    // waveEnemyQueue = shuffleArray(waveEnemyQueue);
    
    enemiesToSpawnThisWave = waveEnemyQueue.length;
    enemiesSpawnedThisWave = 0;
    spawnTimer = 0;
    currentEnemyTypeIndex = 0;
    
    // Reset wave tracking
    resetWaveTracking();
    
    // Show wave announcement
    showWaveAnnouncement(waveNumber);
}

/**
 * Complete current wave and move to next
 */
function completeWave() {
    console.log(`Wave ${currentWave} complete!`);
    
    currentState = GameState.WAVE_COMPLETE;
    
    // Award wave bonus
    const bonusResult = awardWaveBonus(currentWave);
    
    // Show wave summary
    const summary = getWaveSummary();
    showWaveSummary(summary);
    
    waveTransitionTimer = WAVE_TRANSITION_DELAY;
}

/**
 * Move to next wave or victory
 */
function nextWave() {
    currentWave++;
    
    if (currentWave > totalWaves) {
        handleVictory();
    } else {
        currentState = GameState.PLAYING;
        startWave(currentWave);
    }
}

// ==================== GAME LOOP ====================

/**
 * Main game loop
 * This runs every frame (ideally 60 times per second)
 */
function animate() {
    // Request next frame (this creates the loop)
    requestAnimationFrame(animate);
    
    // Calculate delta time (time since last frame)
    const deltaTime = Math.min(clock.getDelta(), 0.1); // Cap at 100ms to prevent huge jumps
    
    // Only update game logic if playing
    if (currentState === GameState.PLAYING) {
        update(deltaTime);
    } else if (currentState === GameState.WAVE_COMPLETE) {
        // Handle wave transition timing
        waveTransitionTimer -= deltaTime;
        if (waveTransitionTimer <= 0) {
            nextWave();
        }
    }
    
    // Always update camera and render (even in menus for pretty background)
    // Pass deltaTime for camera shake decay
    updateCamera(deltaTime);
    updateScene(deltaTime);
    
    // Update particle effects (explosions, sparks, trails)
    updateParticles(deltaTime);
    
    // Render the scene through the post-processing composer
    // This applies bloom and other effects automatically
    composer.render();
    
    // Clear one-shot input flags at the end of each frame
    // This ensures click events are only processed once
    clearInputFlags();
}

/**
 * Update all game systems
 * Called every frame during gameplay
 * @param {number} deltaTime - Time since last frame in seconds
 */
function update(deltaTime) {
    // --- SPAWNING ---
    // Spawn enemies according to wave configuration
    if (enemiesSpawnedThisWave < enemiesToSpawnThisWave) {
        spawnTimer += deltaTime;
        
        if (waveEnemyQueue.length > 0) {
            const nextEnemy = waveEnemyQueue[0];
            
            if (spawnTimer >= nextEnemy.spawnDelay) {
                spawnTimer = 0;
                waveEnemyQueue.shift();
                
                // Spawn with random path for variety
                const pathName = getRandomPathName();
                spawnEnemy(nextEnemy.type, pathName);
                enemiesSpawnedThisWave++;
            }
        }
    }
    
    // --- ENEMIES ---
    const enemyResult = updateEnemies(deltaTime);
    
    // Check lose condition
    if (enemyResult.reachedPlanet) {
        // Big camera shake when enemy reaches planet!
        shakeCamera(2, 3); // Intense shake, slow decay
        
        // Flash red vignette for dramatic impact
        flashDamageVignette(500);
        
        handleDefeat();
        return;
    }
    
    // --- STARBASE ---
    const projectileData = updateStarbase(deltaTime);
    
    // Create projectile if starbase fired
    if (projectileData) {
        createProjectile(projectileData);
        recordShot(); // Track for accuracy
    }
    
    // --- PROJECTILES ---
    const hits = updateProjectiles(deltaTime);
    
    // Process hits
    hits.forEach(hit => {
        recordHit(); // Track for accuracy
        
        // Show damage number at hit position
        const screenPos = worldToScreen(hit.position, camera);
        showDamageNumber(hit.damage, screenPos.x, screenPos.y, hit.destroyed);
        
        // Create visual effect
        createHitEffect(hit.position);
        
        // Record kill if enemy was destroyed
        if (hit.destroyed) {
            recordKill(hit.enemy.type);
            
            // Create awesome particle explosion effect!
            // Color and particle count based on enemy type
            createEnemyDeathEffect(hit.position, hit.enemy.type);
            
            // Small camera shake for enemy destruction feedback
            // Armored enemies cause bigger shake (more satisfying!)
            const shakeAmount = hit.enemy.type === 'armored' ? 0.3 : 0.15;
            shakeCamera(shakeAmount, 10);
            
            // Show credit earned
            showFloatingText(
                `+${hit.creditValue}`,
                screenPos.x + 20,
                screenPos.y - 10,
                '#ffff00'
            );
        }
    });
    
    // --- HEALTH BARS ---
    // Update health bar screen positions
    projectHealthBars(camera);
    
    // --- UI ---
    updateHUD(currentWave);
    
    // --- WIN CONDITION ---
    // Check if wave is complete (all enemies spawned and destroyed)
    if (enemiesSpawnedThisWave >= enemiesToSpawnThisWave && getEnemyCount() === 0) {
        completeWave();
    }
}

// ==================== UTILITY FUNCTIONS ====================

/**
 * Handle window resize
 * Updates renderer, camera, and post-processing composer
 */
function onWindowResize() {
    handleResize(window.innerWidth, window.innerHeight);
    renderer.setSize(window.innerWidth, window.innerHeight);
    
    // Also resize the post-processing composer
    composer.setSize(window.innerWidth, window.innerHeight);
    
    // Update bloom pass resolution
    if (composer.bloomPass) {
        composer.bloomPass.resolution.set(window.innerWidth, window.innerHeight);
    }
}

/**
 * Shuffle an array (Fisher-Yates algorithm)
 * @param {Array} array - Array to shuffle
 * @returns {Array} Shuffled array
 */
function shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

// ==================== START THE GAME ====================

// Initialize when the page loads
window.addEventListener('DOMContentLoaded', init);
