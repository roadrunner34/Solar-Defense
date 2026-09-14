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

// The render pipeline - composer chain, colour grade, quality tiers - lives
// in its own module. main.js only needs to start it, step it and resize it.
import { initQuality, initPostProcessing, renderFrame, resizePostProcessing, sampleFrame,
         flashDamageVignette, resetPostProcessing, setQualityTier,
         getQualityTier, getFrameStats, detectQualityTier } from './postprocessing.js';

// Import all our game systems
import { createScene, scene, updateScene, hitPlanetShield, resetPlanetShield } from './scene.js';
import { createCamera, camera, updateCamera, handleResize, shakeCamera } from './camera.js';
import { initInput, enterPlacementMode, exitPlacementMode, isInPlacementMode,
         clearInputFlags, inputState } from './input.js';
import { initSelection, handleSelectionClick, clearSelection, refreshPanel,
         resetSelection, getSelected } from './selection.js';
import { initPaths, getRandomPathName } from './path.js';
import { initEnemies, spawnEnemy, updateEnemies, clearEnemies, 
         projectHealthBars, getEnemyCount, enemies } from './enemy.js';
import { createStarbase, updateStarbase, resetStarbaseStats } from './starbase.js';
import { createProjectile, updateProjectiles, clearProjectiles, createHitEffect } from './projectile.js';
import { initParticles, updateParticles, createEnemyDeathEffect, createMuzzleSparks } from './particles.js';
import { updateEffects, clearEffects } from './effects.js';
import { updatePlatforms, clearAllPlatforms, placementState, platforms } from './platform.js';
import { initEconomy, recordKill, recordShot, recordHit, awardWaveBonus,
         resetWaveTracking, getWaveSummary, getCredits, getScore,
         saveProgress, loadBestRun, updateCombo } from './economy.js';
import { initUI, setupUICallbacks, updateHUD, showScreen, hideAllScreens,
         setHUDVisible, showDamageNumber, showFloatingText, showWaveAnnouncement,
         showWaveSummary, worldToScreen, initBuildMenu, initIntegrityPips,
         updateIntegrity, showBestRecord, showTooltip, setSettingsCallbacks,
         getSettingsReturnScreen, isSettingsOpen,
         showBossBar, updateBossBar, hideBossBar } from './ui.js';
import { initAudio, playSound, panFromScreenX, resetSoundCooldowns } from './audio.js';
import { startMusic, stopMusic, setMusicWave, setMusicIntensity } from './music.js';
import { CONFIG, getWaveConfig, isBossWave, getBossHealthScale,
         getWaveFlavour, describeWaveComposition } from './config.js';

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
let timer;
let currentWave = 1;

// Waves in the authored campaign. Beyond this the game does not end - it hands
// the player the choice of stopping on a win or continuing into generated
// waves. The old hard cap here made config.js's scaling generator unreachable.
const CAMPAIGN_WAVES = 5;
let endlessMode = false;

// Planet integrity. Replaces the old rule where one leaked enemy ended the run.
let planetIntegrity = CONFIG.planet.integrity;

// Enemies cleared this wave, for the HUD progress bar
let enemiesClearedThisWave = 0;

// The selection panel is rebuilt on a timer rather than every frame: its
// contents include kill counts and upgrade affordability, which do change
// during play, but rebuilding a dozen DOM nodes at 60Hz to show a number that
// moves once a second is pure waste.
let panelRefreshTimer = 0;
const PANEL_REFRESH_INTERVAL = 0.4;
let enemiesSpawnedThisWave = 0;
let enemiesToSpawnThisWave = 0;
let spawnTimer = 0;
let waveEnemyQueue = []; // Queue of enemies to spawn

// For wave transition timing
let waveTransitionTimer = 0;
const WAVE_TRANSITION_DELAY = 3; // Seconds between waves

// The boss currently on the board, if any. Drives the HUD bar and the music.
let activeBoss = null;

// Hit-stop: the brief slow-motion stall on a kill. See applyHitStop().
const HIT_STOP_SCALE = 0.18;
let hitStopRemaining = 0;
let activeTimescale = 1;

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
    renderer.toneMapping = THREE.ACESFilmicToneMapping; // Cinematic tone mapping
    renderer.toneMappingExposure = 1.0;
    
    // Add canvas to the page
    const container = document.getElementById('game-container');
    container.appendChild(renderer.domElement);
    
    // Pick a quality tier before anything is built. Scene density is baked
    // into geometry, so this has to happen ahead of createScene().
    initQuality();

    // Initialize Three.js scene and camera. The renderer goes to createScene
    // because the environment map has to be rendered to a cubemap.
    createScene(renderer);
    createCamera(renderer);
    
    // ==================== POST-PROCESSING SETUP ====================
    // Picks a quality tier for this device, then builds the composer chain.
    // It also sets the renderer's pixel ratio, so that has to happen here
    // rather than alongside the other renderer options above.
    initPostProcessing(renderer, scene, camera);
    
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
        onResume: resumeGame,
        onContinueEndless: continueEndless
    });

    // A quality change from the settings screen has to reach the renderer;
    // ui.js knows nothing about the composer.
    setSettingsCallbacks({
        onSettingApplied: (key, value) => {
            if (key === 'quality') applyQualitySetting(value);
        }
    });

    // Clicking a placed platform or the starbase opens the stats/upgrade panel
    initSelection();

    // Show the saved best run, if there is one
    showSavedRecord();
    
    // Build the platform build menu from the configured platform types
    initBuildMenu(enterPlacementMode);
    
    // Handle window resize
    window.addEventListener('resize', onWindowResize);
    
    // Handle pause with Escape key
    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            // Escape unwinds one layer at a time: settings first, then
            // placement, then the selection panel, and only pauses when there
            // is nothing else to dismiss. Jumping straight to pause would make
            // it impossible to close a panel without stopping the game.
            if (isSettingsOpen()) {
                showScreen(getSettingsReturnScreen());
                return;
            }

            if (isInPlacementMode()) {
                exitPlacementMode();
                return;
            }

            if (getSelected()) {
                clearSelection();
                return;
            }
            
            if (currentState === GameState.PLAYING) {
                pauseGame();
            } else if (currentState === GameState.PAUSED) {
                resumeGame();
            }
        }
        
        // ==================== DEBUG HOTKEYS ====================
        // F toggles the frame readout, G cycles quality manually. These make
        // Sprint 0's never-verified '60 FPS on target hardware' criterion
        // something you can actually check rather than assert.
        if (e.key === 'f' || e.key === 'F') {
            debugVisible = !debugVisible;
            if (!debugVisible && debugElement) debugElement.style.display = 'none';
        }

        if (e.key === 'g' || e.key === 'G') {
            const order = ['high', 'medium', 'low'];
            const next = order[(order.indexOf(getQualityTier()) + 1) % order.length];
            setQualityTier(next);
        }

        // ==================== BUILD HOTKEYS ====================
        // Number keys mirror the build menu, in config order: the nth platform
        // type is on the nth number key. ui.js labels the buttons the same way,
        // so adding a platform type to the config wires up its hotkey too.
        if (currentState === GameState.PLAYING) {
            const platformTypes = Object.keys(CONFIG.platforms);
            const index = Number(e.key) - 1;
            
            if (Number.isInteger(index) && index >= 0 && index < platformTypes.length) {
                enterPlacementMode(platformTypes[index]);
            }
        }
    });

    
    
    // Create the timer for delta time calculation.
    //
    // THREE.Timer replaces the deprecated THREE.Clock (deprecated in r183) and
    // suits this game better in two ways: setTimescale(0) is an explicit pause
    // that Clock never really offered - Clock.stop() was a no-op here, because
    // autoStart restarted it on the next getDelta() - and connect(document)
    // zeroes the delta while the tab is hidden, so returning to a backgrounded
    // game no longer fast-forwards it.
    timer = new THREE.Timer();
    timer.connect(document);
    
    // Show start screen
    showScreen('start');
    
    // Start the game loop
    animate();
    
    console.log('Solar Defense - Ready!');
}

// ==================== GAME STATE MANAGEMENT ====================

/**
 * Start a new game
 */
function startGame() {

    // Build the audio graph on the way in.
    //
    // This has to happen inside the handler for a real user gesture, and this
    // function is one - it is the Start button's callback. An AudioContext
    // constructed anywhere in init() would be born suspended and play nothing,
    // silently, with no error to explain why.
    initAudio();

    // Cooldowns are keyed on the audio context clock, which keeps running
    // across a restart. Without clearing them, the first shot of a new run can
    // be swallowed by the cooldown of the last shot of the previous one.
    resetSoundCooldowns();

    // startMusic() is idempotent, so a restart rebalances the existing drone
    // rather than stacking a second set of oscillators on the first
    startMusic();

    currentState = GameState.PLAYING;
    currentWave = 1;
    endlessMode = false;

    // Reset systems
    clearEnemies();
    clearProjectiles();
    clearAllPlatforms();
    clearEffects();
    resetPostProcessing();
    resetStarbaseStats();
    resetSelection();
    initEconomy();

    // Any boss from the previous run is gone with it
    activeBoss = null;
    hideBossBar();

    // Restore the planet
    planetIntegrity = CONFIG.planet.integrity;
    initIntegrityPips(planetIntegrity);
    updateIntegrity(planetIntegrity);
    resetPlanetShield();

    // A restart can arrive straight from the pause screen, so make sure time
    // is running again
    setTimescale(1);

    // Hide menu, show HUD
    hideAllScreens();
    setHUDVisible(true);

    // Start first wave
    startWave(currentWave);

    maybeShowFirstRunHints();
}

/**
 * Show the onboarding hints, once ever.
 *
 * showTooltip() has existed in ui.js since Sprint 1 with a full stylesheet
 * entry and no caller anywhere in the codebase - scaffolding for a tutorial
 * that was scheduled into Sprint 5 and never reached. It is finally used here.
 *
 * Gated on localStorage rather than a session flag, so it is genuinely a
 * first-run experience rather than something a returning player sits through
 * on every restart.
 */
function maybeShowFirstRunHints() {
    try {
        if (localStorage.getItem('solarDefense_seenHints')) return;
        localStorage.setItem('solarDefense_seenHints', 'true');
    } catch {
        // Private browsing, or storage disabled. Showing the hints once per
        // session is a better failure than never showing them at all.
    }

    showTooltip(
        'Your starbase fires itself',
        'You never aim. Spend credits on platforms and decide where they go - ' +
        'that is the whole game. Press 1 or 2, then click a spot.',
        24, window.innerHeight - 260, 9000
    );
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
    
    // Freeze time. Everything driven by deltaTime - enemies, projectiles,
    // particles and one-shot effects - stops with it, while the render loop
    // and camera controls keep running so the paused scene stays live.
    setTimescale(0);
}

/**
 * Resume from pause
 */
function resumeGame() {
    if (currentState !== GameState.PAUSED) return;

    // Drop any hit-stop that was in flight when the player paused, so the
    // game does not resume into a stall it has no way to count down
    hitStopRemaining = 0;
    
    currentState = GameState.PLAYING;
    hideAllScreens();
    setTimescale(1);
}

/**
 * Handle victory
 */
function handleVictory() {
    currentState = GameState.VICTORY;
    clearSelection();
    setHUDVisible(false);
    recordRun();

    // Drop the drone back to its root rather than stopping it. The campaign is
    // won but the player may still choose to hold the line, and cutting the
    // music dead would make that choice feel like starting a new session.
    setMusicIntensity(0);
    playSound('victory');

    showScreen('victory');
}

/**
 * Handle defeat
 */
function handleDefeat() {
    currentState = GameState.DEFEAT;
    clearSelection();
    setHUDVisible(false);
    recordRun();

    // The run is over, so the drone goes with it
    stopMusic(3);
    playSound('defeat');

    showScreen('defeat');
}

/**
 * Save this run if it beat the stored best, then refresh the start screen line.
 *
 * saveProgress() and loadProgress() have been sitting in economy.js since
 * Sprint 1 with no call sites anywhere. This is the first thing to use them.
 */
function recordRun() {
    saveProgress({ wave: currentWave, score: getScore() });
    showSavedRecord();
}

/**
 * Put the stored best run on the start screen, if there is one.
 */
function showSavedRecord() {
    const best = loadBestRun();

    showBestRecord(
        best ? `Best: wave ${best.wave} · ${best.score.toLocaleString()} points` : null
    );
}

// ==================== WAVE MANAGEMENT ====================

/**
 * Start a new wave
 * @param {number} waveNumber - Which wave to start
 */
function startWave(waveNumber) {
    
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
    
    // A boss arrives last, after the wave it caps. Appended here rather than
    // written into CONFIG.waves so endless mode keeps producing them forever.
    if (isBossWave(waveNumber)) {
        waveEnemyQueue.push({
            type: 'boss',
            spawnDelay: 2.5,
            healthScale: getBossHealthScale(waveNumber)
        });
    }

    enemiesToSpawnThisWave = waveEnemyQueue.length;
    enemiesSpawnedThisWave = 0;
    enemiesClearedThisWave = 0;
    spawnTimer = 0;
    
    // Reset wave tracking
    resetWaveTracking();

    // Show wave announcement.
    //
    // showWaveAnnouncement()'s second parameter has existed since Sprint 1 with
    // a default of '' and no caller anywhere. This is the first thing to pass it.
    showWaveAnnouncement(waveNumber, getWaveFlavour(waveNumber));
    playSound('waveStart');

    // The drone thickens as the waves get worse
    setMusicWave(waveNumber);
}

/**
 * Complete current wave and move to next
 */
function completeWave() {
    
    currentState = GameState.WAVE_COMPLETE;
    
    // Award the wave bonus and fold its breakdown into the summary, so the
    // player can see where the credits came from rather than just a total
    const bonusResult = awardWaveBonus(currentWave);

    // Name what is coming next, so the credits just awarded can be spent on a
    // decision rather than a guess. Omitted when the campaign is over and the
    // player has not yet chosen to continue - there is no "next wave" to
    // prepare for until they do.
    const nextWave = currentWave + 1;
    const showNext = endlessMode || nextWave <= CAMPAIGN_WAVES;

    showWaveSummary({
        ...getWaveSummary(),
        ...bonusResult,
        nextWave: showNext ? nextWave : null,
        nextComposition: showNext ? describeWaveComposition(nextWave) : null
    });
    
    waveTransitionTimer = WAVE_TRANSITION_DELAY;
}

/**
 * Move to the next wave, or offer the win.
 *
 * Clearing the authored campaign is a victory, but it is no longer the end of
 * the game: the victory screen offers "Hold the Line", which drops into
 * endless mode. Waves past the campaign come from getWaveConfig()'s scaling
 * branch in config.js, which existed since Sprint 1 and was unreachable
 * because this function used to hard-stop at five.
 */
function nextWave() {
    currentWave++;

    if (currentWave > CAMPAIGN_WAVES && !endlessMode) {
        handleVictory();
        return;
    }

    currentState = GameState.PLAYING;
    startWave(currentWave);
}

/**
 * Continue past the campaign into generated waves.
 * Wired to the victory screen's "Hold the Line" button.
 */
function continueEndless() {
    endlessMode = true;
    currentState = GameState.PLAYING;

    startMusic();

    hideAllScreens();
    setHUDVisible(true);
    startWave(currentWave);
}

// ==================== GAME LOOP ====================

/**
 * Main game loop
 * This runs every frame (ideally 60 times per second)
 */
function animate(timestamp) {
    // Request next frame (this creates the loop)
    requestAnimationFrame(animate);

    // Feed the render watchdog the RAW timestamp. The game delta below is
    // clamped and gets zeroed by pause, so it says nothing about how hard the
    // GPU is actually working - which is exactly what the watchdog needs.
    sampleFrame(timestamp);
    
    // Calculate delta time (time since last frame)
    timer.update(timestamp);
    const deltaTime = Math.min(timer.getDelta(), 0.1); // Cap at 100ms to prevent huge jumps

    // Run down any hit-stop. deltaTime arrives already multiplied by the
    // timescale, so dividing it back out recovers real elapsed seconds - which
    // is what the stall should be measured in, or a heavier stall would also
    // last proportionally longer.
    if (hitStopRemaining > 0 && activeTimescale > 0) {
        hitStopRemaining -= deltaTime / activeTimescale;
        if (hitStopRemaining <= 0) setTimescale(1);
    }

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
    
    // Update one-shot visuals (muzzle flashes, hit effects). While paused the
    // timescale is 0, so these freeze in place rather than playing on.
    updateEffects(deltaTime);
    
    // Render through the post-processing chain (bloom, tone map, grade)
    renderFrame();
    
    // Debug readout, toggled with F
    updateDebugReadout();

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
                const spawned = spawnEnemy(nextEnemy.type, pathName, {
                    healthScale: nextEnemy.healthScale
                });

                if (spawned && spawned.isBoss) handleBossArrival(spawned);

                enemiesSpawnedThisWave++;
            }
        }
    }
    
    // --- KILL CHAIN ---
    // Run down before anything can add to it this frame, so a chain that
    // expires does so on the frame it actually ran out
    updateCombo(deltaTime);

    // --- ENEMIES ---
    const enemyResult = updateEnemies(deltaTime);
    
    // --- BREACHES ---
    // Every enemy that got through costs one point of integrity. The count
    // matters, not just the boolean: three arriving in the same frame should
    // cost three.
    if (enemyResult.reachedPlanetCount > 0) {
        if (handleBreach(enemyResult)) return;
    }

    // --- SELECTION ---
    // Handled here rather than inside input.js so it can be gated on game
    // state: clicking during placement is placing, not selecting.
    if (inputState.leftClickCompleted && !isInPlacementMode()) {
        handleSelectionClick(camera, inputState.mouseNormalized);
    }

    // Keep the open panel's live numbers current, on a timer
    if (getSelected()) {
        panelRefreshTimer += deltaTime;

        if (panelRefreshTimer >= PANEL_REFRESH_INTERVAL) {
            panelRefreshTimer = 0;
            refreshPanel();
        }
    }
    
    // --- STARBASE ---
    const projectileData = updateStarbase(deltaTime);
    
    // Create projectile if starbase fired
    if (projectileData) {
        createProjectile(projectileData);
        recordShot(); // Track for accuracy
        playWeaponSound(projectileData);
    }

    // --- PLATFORMS ---
    // Deployed platforms acquire their own targets and fire independently,
    // returning projectile data in the same shape the starbase does
    updatePlatforms(deltaTime).forEach(platformProjectile => {
        createProjectile(platformProjectile);
        recordShot(); // Track for accuracy
        playWeaponSound(platformProjectile);
    });
    
    // --- PROJECTILES ---
    const hits = updateProjectiles(deltaTime);
    
    // Process hits.
    //
    // A missile detonation produces several entries here - one for the direct
    // hit and one per enemy caught in the blast - so nothing in this loop may
    // assume one hit means one trigger pull.
    hits.forEach(hit => {
        // Only the shot's intended target counts toward accuracy. Counting
        // splash victims would let a Missile Launcher post above 100% simply
        // by firing into a crowd.
        if (hit.countsForAccuracy !== false) recordHit();

        creditPlatform(hit);

        const screenPos = worldToScreen(hit.position, camera);
        showDamageNumber(hit.damage, screenPos.x, screenPos.y, hit.destroyed);

        // Splash damage gets a smaller impact flash than the direct hit, so a
        // detonation reads as one big event with ripples rather than five
        // equally-weighted explosions
        createHitEffect(hit.position, hit.splash ? 0.6 : 1);

        // The same reasoning applies to the sound. A splash victim is quieter
        // and slightly higher than the round that caused it, so a detonation
        // reads as one impact with debris rather than as five separate kills.
        const pan = panFromScreenX(screenPos.x);

        if (!hit.destroyed) {
            playSound('hit', { pan, volume: hit.splash ? 0.6 : 1 });
            return;
        }

        const award = recordKill(hit.enemy.type);

        // Pitch rises with the chain, so a streak is audible before it is read.
        // Capped well short of a squeak - this fires dozens of times a wave.
        const comboPitch = 1 + (award.multiplier - 1) * 0.12;

        playSound('explosion', {
            pan,
            volume: hit.splash ? 0.7 : 1,
            pitch: (hit.enemy.type === 'armored' ? 0.85 : 1) * comboPitch
        });

        enemiesClearedThisWave++;
        createEnemyDeathEffect(hit.position, hit.enemy.type);

        // Bigger enemies shake harder - the feedback should match the effort.
        // A boss has taken a minute of sustained fire to bring down, so its
        // death gets an order more than an Armored enemy's.
        let shakeAmount = 0.15;
        if (hit.enemy.type === 'armored') shakeAmount = 0.3;
        if (hit.enemy.isBoss) shakeAmount = 1.4;

        shakeCamera(shakeAmount, 10);

        applyHitStop(hit.enemy.type);

        // The amount actually awarded, not the enemy's base value. Showing the
        // base would quietly contradict the credit counter the moment a chain
        // was running, which is exactly when the player is watching it.
        showFloatingText(
            award.multiplier > 1
                ? `+${award.credits} x${Number(award.multiplier.toFixed(2))}`
                : `+${award.credits}`,
            screenPos.x + 20,
            screenPos.y - 10,
            award.multiplier > 1 ? '#ffb547' : '#ffff00'
        );
    });
    
    // --- BOSS BAR ---
    updateBossState();

    // --- HEALTH BARS ---
    // Update health bar screen positions
    projectHealthBars(camera);
    
    // --- UI ---
    updateHUD(currentWave, placementState.selectedType, {
        cleared: enemiesClearedThisWave,
        total: enemiesToSpawnThisWave
    });
    
    // --- WIN CONDITION ---
    // Check if wave is complete (all enemies spawned and destroyed)
    if (enemiesSpawnedThisWave >= enemiesToSpawnThisWave && getEnemyCount() === 0) {
        completeWave();
    }
}

// ==================== BREACHES ====================

/**
 * Handle enemies that reached the planet.
 *
 * The old rule was that one leak ended the run instantly. That is the harshest
 * failure state a tower defence can have, and in a game whose entire decision
 * space is *where to put things*, it made trying a placement out cost a whole
 * restart. Three points of integrity turn a mistake into feedback.
 *
 * The escalation is deliberate: each breach shakes harder and flashes redder
 * than the last, so losing the second point feels worse than the first without
 * the player having to read the pip row to know it.
 *
 * @param {object} enemyResult - From updateEnemies()
 * @returns {boolean} True if the run ended and update() should bail out
 */
function handleBreach(enemyResult) {
    planetIntegrity = Math.max(0, planetIntegrity - enemyResult.reachedPlanetCount);

    // A leaked enemy has still left the board, so it counts toward wave
    // progress. Without this the bar would stall short of full on any wave
    // the player did not clear perfectly.
    enemiesClearedThisWave += enemyResult.reachedPlanetCount;

    updateIntegrity(planetIntegrity);

    const remainingFraction = planetIntegrity / CONFIG.planet.integrity;
    const breachPoint = enemyResult.breachPositions[0];

    hitPlanetShield(breachPoint, remainingFraction);

    // Feedback scales as the situation gets worse
    const severity = 1 - remainingFraction;
    shakeCamera(0.8 + severity * 1.6, 4);
    flashDamageVignette(0.35 + severity * 0.35);

    if (breachPoint) {
        const screenPos = worldToScreen(breachPoint, camera);
        showFloatingText('BREACH', screenPos.x, screenPos.y, '#ff5d5d');
        playSound('breach', { pan: panFromScreenX(screenPos.x) });
    } else {
        playSound('breach');
    }

    if (planetIntegrity > 0) return false;

    handleDefeat();
    return true;
}

// ==================== COMBAT FEEDBACK ====================

/**
 * Attribute a hit back to the platform that fired it.
 *
 * Projectiles carry a `source` string of the form `platform:<id>` - the
 * instance id, not the type, so two Laser Batteries keep separate scorecards.
 * The starbase reports 'starbase' and is skipped here.
 *
 * @param {object} hit - A hit result from updateProjectiles()
 */
function creditPlatform(hit) {
    if (!hit.source || !hit.source.startsWith('platform:')) return;

    const id = Number(hit.source.slice('platform:'.length));
    const platform = platforms.find(p => p.id === id);
    if (!platform) return;

    platform.damageDealt += hit.damage;
    if (hit.destroyed) platform.kills++;
}

/**
 * A boss has just spawned.
 *
 * @param {object} boss - The spawned enemy
 */
function handleBossArrival(boss) {
    activeBoss = boss;

    showBossBar(boss.displayName);
    showWaveAnnouncement(currentWave, `${boss.displayName} inbound`);
    playSound('bossArrival');

    // The drone goes to full regardless of how deep the run is, then drops back
    // to the wave's own intensity when the fight ends
    setMusicIntensity(1, 1.5);
}

/**
 * Keep the boss bar in step with the boss, and tear it down when it dies.
 *
 * Driven from the frame loop rather than from the kill handler because a boss
 * can also leave by reaching the planet, and both exits have to clean up.
 */
function updateBossState() {
    if (!activeBoss) return;

    if (activeBoss.alive) {
        updateBossBar(activeBoss.health / activeBoss.maxHealth);
        return;
    }

    activeBoss = null;
    hideBossBar();

    // Hand the music back to the wave it belongs to
    setMusicWave(currentWave);
}

/**
 * Play the firing sound for a shot that was just taken.
 *
 * Keyed on the projectile type rather than on what fired it, because that is
 * the thing the sound is describing - the starbase and a Laser Battery both
 * fire lasers and should both sound like it. Adding a third ordnance type to
 * the config therefore only needs a matching recipe in CONFIG.audio.sounds.
 *
 * @param {object} projectileData - From updateStarbase() or updatePlatforms()
 */
function playWeaponSound(projectileData) {
    const sound = projectileData.projectileType === 'missile'
        ? 'missileLaunch'
        : 'laser';

    const screenPos = worldToScreen(projectileData.position, camera);

    playSound(sound, { pan: panFromScreenX(screenPos.x) });
}

/**
 * Hit-stop: freeze the world for a few dozen milliseconds on a kill.
 *
 * A fighting-game trick, and one of the cheapest ways to make an impact feel
 * like it landed. The brain reads the momentary stall as resistance - the
 * sense that the target had mass and the hit had to overcome it. Without it,
 * enemies simply stop existing between one frame and the next.
 *
 * It is implemented as a timescale change rather than a sleep, so everything
 * driven by deltaTime slows together - projectiles, particles, turret tracking.
 * Slowing to a crawl rather than a full stop keeps explosions readable; a true
 * freeze reads as a dropped frame.
 *
 * @param {string} enemyType - Bigger enemies earn a longer stall
 */
function applyHitStop(enemyType) {
    let duration = 0.045;
    if (enemyType === 'armored') duration = 0.085;
    if (enemyType === 'boss') duration = 0.22;

    // Overlapping kills extend the stall rather than restarting it, so a
    // missile clearing five enemies at once does not lock the game up
    hitStopRemaining = Math.max(hitStopRemaining, duration);
    setTimescale(HIT_STOP_SCALE);
}

/**
 * Set the simulation timescale, remembering it.
 *
 * THREE.Timer.getDelta() returns time already multiplied by the timescale, so
 * there is no way to recover real elapsed time from it alone. Keeping the
 * current scale here lets the hit-stop countdown divide it back out.
 *
 * @param {number} scale - 0 for paused, 1 for normal
 */
function setTimescale(scale) {
    activeTimescale = scale;
    timer.setTimescale(scale);
}

// ==================== DEBUG READOUT ====================

let debugVisible = false;
let debugElement = null;

/**
 * Draw the frame-time readout, toggled with F.
 *
 * Built lazily and written with textContent rather than being another element
 * in index.html, because it is a developer tool - it should cost nothing and
 * appear nowhere until someone asks for it.
 */
function updateDebugReadout() {
    if (!debugVisible) return;

    if (!debugElement) {
        debugElement = document.createElement('div');
        debugElement.id = 'debug-readout';
        document.body.appendChild(debugElement);
    }

    debugElement.style.display = 'block';

    const stats = getFrameStats();

    debugElement.textContent = [
        `${stats.fps} fps`,
        `${stats.frameMs.toFixed(1)} ms`,
        stats.tier,
        `${enemies.length} enemies`,
        `${renderer.info.render.calls} draws`
    ].join('  |  ');
}

// ==================== UTILITY FUNCTIONS ====================

/**
 * Apply a quality choice made in the settings screen.
 *
 * 'auto' hands the decision back to the device detection, and re-arms the
 * frame-time watchdog by way of postprocessing.js consulting the setting. Any
 * other value pins the tier - see qualityIsPinned() over there.
 *
 * Only the live knobs move: pixel ratio and bloom. MSAA sample count and scene
 * density are baked in at build time, so a tier change mid-run cannot undo
 * those without a reload.
 *
 * @param {string} value - 'auto', 'high', 'medium' or 'low'
 */
function applyQualitySetting(value) {
    setQualityTier(value === 'auto' ? detectQualityTier() : value);
}

/**
 * Handle window resize
 * Updates renderer, camera, and post-processing composer
 */
function onWindowResize() {
    handleResize(window.innerWidth, window.innerHeight);
    renderer.setSize(window.innerWidth, window.innerHeight);
    resizePostProcessing(window.innerWidth, window.innerHeight);
}


// ==================== START THE GAME ====================

// Initialize when the page loads
window.addEventListener('DOMContentLoaded', init);
