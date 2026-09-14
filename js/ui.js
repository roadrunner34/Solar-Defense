/**
 * ui.js - User Interface System
 * 
 * Manages all 2D UI elements displayed on top of the 3D game:
 * - HUD (Heads-Up Display): Score, credits, wave info
 * - Screens: Start menu, victory, defeat, pause
 * - Damage numbers: Floating text when enemies are hit
 * 
 * Why separate from 3D?
 * HTML/CSS is much better for text, buttons, and menus.
 * Three.js handles the 3D world, HTML handles the interface.
 * 
 * GSAP ANIMATIONS:
 * ================
 * GSAP (GreenSock Animation Platform) is a professional animation library
 * that makes UI animations smooth and easy to create. It's like CSS animations
 * but with much more control and better performance.
 * 
 * Key concepts:
 * - gsap.to(): Animate FROM current state TO specified values
 * - gsap.from(): Animate FROM specified values TO current state
 * - gsap.timeline(): Chain multiple animations in sequence
 * - Easing: How the animation accelerates/decelerates (e.g., "power2.out")
 */

import { getCredits, getScore, getAccuracy, getGameStats, canAfford } from './economy.js';
import { getEnemyCount } from './enemy.js';
import { CONFIG } from './config.js';
import { playSound } from './audio.js';
import { getSetting, setSetting, getAllSettings } from './settings.js';
import gsap from 'gsap';

// Cache DOM element references (faster than querying each frame)
const elements = {};

/**
 * Initialize UI system
 * Finds and caches all DOM elements we'll need
 */
export function initUI() {
    // HUD elements
    elements.hud = document.getElementById('hud');
    elements.waveNumber = document.getElementById('wave-number');
    elements.enemiesRemaining = document.getElementById('enemies-remaining');
    elements.score = document.getElementById('score');
    elements.credits = document.getElementById('credits');
    
    // Screen containers
    elements.startScreen = document.getElementById('start-screen');
    elements.victoryScreen = document.getElementById('victory-screen');
    elements.defeatScreen = document.getElementById('defeat-screen');
    elements.pauseScreen = document.getElementById('pause-screen');
    
    // Buttons
    elements.startButton = document.getElementById('start-button');
    elements.restartVictory = document.getElementById('restart-victory');
    elements.restartDefeat = document.getElementById('restart-defeat');
    elements.resumeButton = document.getElementById('resume-button');
    elements.restartPause = document.getElementById('restart-pause');
    
    // Final score displays
    elements.finalScoreVictory = document.getElementById('final-score-victory');
    elements.finalScoreDefeat = document.getElementById('final-score-defeat');
    
    // Build menu
    elements.buildMenu = document.getElementById('build-menu');

    // Wave meter and integrity readout. These are absent from the test fixture,
    // which renders only the handful of nodes the HUD strictly needs, so every
    // read of them below is null-guarded.
    elements.waveProgress = document.getElementById('wave-progress');
    elements.enemiesPlural = document.getElementById('enemies-plural');
    elements.integrityPips = document.getElementById('integrity-pips');

    // Selection panel
    elements.selectionPanel = document.getElementById('selection-panel');
    elements.selectionName = document.getElementById('selection-name');
    elements.selectionStats = document.getElementById('selection-stats');
    elements.selectionUpgrades = document.getElementById('selection-upgrades');
    elements.selectionTargeting = document.getElementById('selection-targeting');
    elements.selectionSell = document.getElementById('selection-sell');
    elements.selectionClose = document.getElementById('selection-close');

    // Start screen record line, and the victory screen's endless option
    elements.bestRecord = document.getElementById('best-record');
    elements.continueEndless = document.getElementById('continue-endless');

    // Settings screen
    elements.settingsScreen = document.getElementById('settings-screen');
    elements.settingsStart = document.getElementById('settings-start');
    elements.settingsPause = document.getElementById('settings-pause');
    elements.settingsBack = document.getElementById('settings-back');

    elements.settingInputs = {
        masterVolume: document.getElementById('setting-master-volume'),
        sfxVolume: document.getElementById('setting-sfx-volume'),
        musicVolume: document.getElementById('setting-music-volume'),
        quality: document.getElementById('setting-quality'),
        reducedMotion: document.getElementById('setting-reduced-motion')
    };

    wireButtonClickSound();
    wireSettingsControls();
}

/**
 * Give every button in the game a click sound, through one delegated listener.
 *
 * Delegated rather than attached per button because several of the game's
 * buttons do not exist yet when this runs - the build menu is generated from
 * the config, and the selection panel's upgrade buttons are rebuilt on every
 * render. A listener per button would have to be re-attached in both places and
 * would be forgotten by whatever adds buttons next.
 *
 * playSound() is a no-op until the audio graph exists, so the Start button that
 * bootstraps audio is silently exempt - which is correct. There is nothing to
 * play it through yet.
 */
function wireButtonClickSound() {
    if (typeof document === 'undefined' || document.body?.dataset.clickSound) return;

    // Marked on the body so a second initUI() - which the tests do, with a
    // fresh fixture each time - does not stack a second listener
    if (document.body) document.body.dataset.clickSound = 'true';

    document.addEventListener('click', (event) => {
        const button = event.target instanceof Element
            ? event.target.closest('button')
            : null;

        if (button && !button.disabled) playSound('uiClick');
    });
}

// ==================== SETTINGS SCREEN ====================

/**
 * Which screen the settings screen was opened from, so Back can return there.
 *
 * Settings is reachable from both the start screen and the pause screen, and
 * hard-coding the return would strand a paused player on the main menu with
 * their run still running behind it.
 */
let settingsReturnScreen = 'start';

/**
 * Volume settings, and the sliders that drive them.
 *
 * Sliders work in 0-100 because that is what reads well in a UI; the store
 * keeps 0-1 because that is what a GainNode wants.
 */
const VOLUME_SETTINGS = ['masterVolume', 'sfxVolume', 'musicVolume'];

/**
 * Wire the settings controls to the settings store.
 *
 * Every control writes through setSetting(), which validates, persists, and
 * notifies listeners - so the audio graph follows a slider while it is being
 * dragged rather than on the next sound.
 */
function wireSettingsControls() {
    const inputs = elements.settingInputs;
    if (!inputs) return;

    for (const key of VOLUME_SETTINGS) {
        const slider = inputs[key];
        if (!slider || slider.dataset.wired) continue;

        slider.dataset.wired = 'true';

        // 'input' rather than 'change', so dragging is audible as it happens
        slider.addEventListener('input', () => {
            setSetting(key, Number(slider.value) / 100);
            updateSettingsReadout(key);
        });
    }

    for (const key of ['quality', 'reducedMotion']) {
        const select = inputs[key];
        if (!select || select.dataset.wired) continue;

        select.dataset.wired = 'true';

        select.addEventListener('change', () => {
            setSetting(key, select.value);

            if (settingsCallbacks.onSettingApplied) {
                settingsCallbacks.onSettingApplied(key, select.value);
            }
        });
    }
}

/**
 * Callbacks for settings that need something outside ui.js to act on them -
 * a quality change has to reach the renderer.
 */
let settingsCallbacks = { onSettingApplied: null };

/**
 * @param {object} callbacks
 * @param {Function} [callbacks.onSettingApplied] - Called with (key, value)
 */
export function setSettingsCallbacks(callbacks = {}) {
    settingsCallbacks = { ...settingsCallbacks, ...callbacks };
}

/**
 * Push the stored settings into the controls.
 *
 * Called whenever the screen is shown rather than only at startup, so the
 * controls always reflect the store even if something else changed it.
 */
function syncSettingsControls() {
    const inputs = elements.settingInputs;
    if (!inputs) return;

    const settings = getAllSettings();

    for (const key of VOLUME_SETTINGS) {
        if (!inputs[key]) continue;

        inputs[key].value = String(Math.round(settings[key] * 100));
        updateSettingsReadout(key);
    }

    if (inputs.quality) inputs.quality.value = settings.quality;
    if (inputs.reducedMotion) inputs.reducedMotion.value = settings.reducedMotion;
}

/**
 * Update the percentage shown beside a volume slider.
 *
 * @param {string} key - A volume setting key
 */
function updateSettingsReadout(key) {
    const slider = elements.settingInputs?.[key];
    if (!slider) return;

    const readout = slider.parentElement?.querySelector('.setting-value');
    if (readout) readout.textContent = `${Math.round(Number(slider.value))}%`;
}

/**
 * Open the settings screen, remembering where to go back to.
 *
 * @param {string} returnScreen - Screen name to return to on Back
 */
export function showSettings(returnScreen = 'start') {
    settingsReturnScreen = returnScreen;
    syncSettingsControls();
    showScreen('settings');
}

/**
 * The screen the settings screen should return to.
 * @returns {string}
 */
export function getSettingsReturnScreen() {
    return settingsReturnScreen;
}

/**
 * Whether the settings screen is currently showing.
 *
 * Used by the Escape handler, which unwinds one layer at a time and must close
 * settings before it considers pausing or unpausing.
 *
 * @returns {boolean}
 */
export function isSettingsOpen() {
    return Boolean(
        elements.settingsScreen && elements.settingsScreen.classList.contains('active')
    );
}

/**
 * Whether the player has asked their system to reduce motion.
 *
 * Checked at call time rather than cached, because the preference can change
 * mid-session. Every GSAP sequence in this file consults it and falls back to a
 * plain fade - the information still arrives, it just does not fly in.
 *
 * @returns {boolean}
 */
function prefersReducedMotion() {
    // An explicit choice in the settings screen wins, in both directions: a
    // player who wants the animations despite a system-wide reduce preference
    // is as legitimate as one who wants them off without setting it globally.
    const preference = getSetting('reducedMotion');

    if (preference === 'on') return true;
    if (preference === 'off') return false;

    // 'auto' - follow the system
    return typeof window !== 'undefined' &&
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

// ==================== BUILD MENU ====================

/**
 * Turns a config key into a readable name: laserBattery -> Laser Battery.
 *
 * Derived rather than looked up in a table so a new platform type added to the
 * config needs no corresponding UI change.
 *
 * @param {string} type - Platform type key
 * @returns {string} Display name
 */
function formatPlatformName(type) {
    return type
        .replace(/([A-Z])/g, ' $1')
        .replace(/^./, character => character.toUpperCase());
}

/**
 * Returns the number key that selects a platform type.
 *
 * Hotkeys follow config order, so the nth platform type is on the nth number
 * key. main.js resolves key presses the same way.
 *
 * @param {string} type - Platform type key
 * @returns {string} The hotkey character
 */
export function getPlatformHotkey(type) {
    return String(Object.keys(CONFIG.platforms).indexOf(type) + 1);
}

/**
 * The one-line stat summary under a build menu button.
 *
 * Weapons describe themselves as damage and range, which is what a player
 * compares them on. A support platform has neither - printing "undefined dmg"
 * under the Gravity Well would be the obvious bug here - so it carries its own
 * `blurb` in the config instead.
 *
 * @param {object} config - An entry from CONFIG.platforms
 * @returns {string}
 */
function describePlatformStats(config) {
    if (config.blurb) return config.blurb;

    return `${config.damage} dmg &middot; ${config.range} range`;
}

/**
 * Build the platform build menu.
 *
 * Buttons are generated from CONFIG.platforms rather than written into the
 * HTML, so the menu always reflects the configured platform types and their
 * real stats.
 *
 * @param {Function} onSelect - Called with a platform type when one is chosen
 */
export function initBuildMenu(onSelect) {
    if (!elements.buildMenu) return;
    
    elements.buildMenu.innerHTML = '<h3>Build</h3>';
    
    for (const [type, config] of Object.entries(CONFIG.platforms)) {
        const button = document.createElement('button');
        button.className = 'build-option';
        button.dataset.type = type;
        
        button.innerHTML = `
            <span class="build-option-name">${formatPlatformName(type)}</span>
            <span class="build-option-key">${getPlatformHotkey(type)}</span>
            <span class="build-option-cost">${config.cost} cr</span>
            <span class="build-option-stats">${describePlatformStats(config)}</span>
        `;
        
        button.addEventListener('click', () => onSelect(type));
        elements.buildMenu.appendChild(button);
    }
    
    updateBuildMenu();
}

/**
 * Refresh the build menu against the current balance and selection.
 *
 * Called every frame from updateHUD, so buttons grey out the moment credits
 * drop below a platform's cost.
 *
 * @param {string|null} selectedType - Platform type currently being placed
 */
export function updateBuildMenu(selectedType = null) {
    if (!elements.buildMenu) return;
    
    for (const button of elements.buildMenu.querySelectorAll('.build-option')) {
        const config = CONFIG.platforms[button.dataset.type];
        if (!config) continue;
        
        const affordable = canAfford(config.cost);
        button.classList.toggle('unaffordable', !affordable);
        button.classList.toggle('selected', button.dataset.type === selectedType);
        button.disabled = !affordable;
    }
}

/**
 * Set up button event listeners
 * @param {object} callbacks - Object containing callback functions
 * @param {Function} callbacks.onStart - Called when Start button clicked
 * @param {Function} callbacks.onRestart - Called when Restart button clicked
 * @param {Function} callbacks.onResume - Called when Resume button clicked
 */
export function setupUICallbacks(callbacks) {
    if (elements.startButton) {
        elements.startButton.addEventListener('click', () => {
            callbacks.onStart && callbacks.onStart();
        });
    }
    
    if (elements.restartVictory) {
        elements.restartVictory.addEventListener('click', () => {
            callbacks.onRestart && callbacks.onRestart();
        });
    }
    
    if (elements.restartDefeat) {
        elements.restartDefeat.addEventListener('click', () => {
            callbacks.onRestart && callbacks.onRestart();
        });
    }
    
    if (elements.resumeButton) {
        elements.resumeButton.addEventListener('click', () => {
            callbacks.onResume && callbacks.onResume();
        });
    }
    
    if (elements.restartPause) {
        elements.restartPause.addEventListener('click', () => {
            callbacks.onRestart && callbacks.onRestart();
        });
    }

    // "Hold the Line" on the victory screen - carry on into generated waves
    // rather than ending the session on a win
    if (elements.continueEndless) {
        elements.continueEndless.addEventListener('click', () => {
            callbacks.onContinueEndless && callbacks.onContinueEndless();
        });
    }

    // Settings is reachable from two places, and Back returns to whichever one
    // opened it - a paused player must not be dumped onto the main menu with
    // their run still live behind it.
    if (elements.settingsStart) {
        elements.settingsStart.addEventListener('click', () => showSettings('start'));
    }

    if (elements.settingsPause) {
        elements.settingsPause.addEventListener('click', () => showSettings('pause'));
    }

    if (elements.settingsBack) {
        elements.settingsBack.addEventListener('click', () => {
            showScreen(getSettingsReturnScreen());
        });
    }
}

/**
 * Update HUD with current game state
 * Call this every frame or when values change
 * @param {number} waveNumber - Current wave number
 */
export function updateHUD(waveNumber, selectedPlatformType = null, waveProgress = null) {
    const remaining = getEnemyCount();

    // Update wave number
    if (elements.waveNumber) {
        elements.waveNumber.textContent = waveNumber;
    }

    // Update enemy count
    if (elements.enemiesRemaining) {
        elements.enemiesRemaining.textContent = remaining;
    }

    // "1 hostile inbound", not "1 hostiles inbound"
    if (elements.enemiesPlural) {
        elements.enemiesPlural.textContent = remaining === 1 ? '' : 's';
    }

    // Wave progress bar. Caller passes {cleared, total}; the width transition
    // is CSS's, so this only ever writes the target percentage.
    if (elements.waveProgress && waveProgress && waveProgress.total > 0) {
        const fraction = waveProgress.cleared / waveProgress.total;
        elements.waveProgress.style.width = `${Math.min(100, fraction * 100)}%`;
    }

    // Update score
    if (elements.score) {
        elements.score.textContent = formatNumber(getScore());
    }

    // Update credits
    if (elements.credits) {
        elements.credits.textContent = formatNumber(getCredits());
    }

    // Grey out platforms the player can no longer afford
    updateBuildMenu(selectedPlatformType);
}

// ==================== INTEGRITY ====================

/**
 * Build the integrity pip row.
 *
 * Generated from the count rather than written into index.html, so changing
 * CONFIG.planet.integrity changes the UI with it. Hard-coding three pips in the
 * markup is exactly the kind of drift that leaves a HUD lying about the game.
 *
 * @param {number} max - How many pips the planet starts with
 */
export function initIntegrityPips(max) {
    if (!elements.integrityPips) return;

    elements.integrityPips.innerHTML = '';

    for (let i = 0; i < max; i++) {
        const pip = document.createElement('div');
        pip.className = 'pip';
        elements.integrityPips.appendChild(pip);
    }

    elements.integrityPips.classList.remove('critical');
}

/**
 * Reflect the planet's remaining integrity.
 *
 * Spent pips are marked rather than removed, so the player can always see how
 * much they started with - a row that shrinks tells you how much is left but
 * not how much has gone.
 *
 * @param {number} current - Remaining integrity
 */
export function updateIntegrity(current) {
    if (!elements.integrityPips) return;

    const pips = [...elements.integrityPips.children];

    pips.forEach((pip, index) => {
        pip.classList.toggle('lost', index >= current);
    });

    // One hit from losing the planet. The class drives both a colour change and
    // a pulse, so the warning survives being colour-blind.
    elements.integrityPips.classList.toggle('critical', current === 1);
}

/**
 * Show the saved best run on the start screen, if there is one.
 * @param {string|null} text - Line to show, or null to hide the row
 */
export function showBestRecord(text) {
    if (!elements.bestRecord) return;

    elements.bestRecord.textContent = text || '';
    elements.bestRecord.hidden = !text;
}

/**
 * Show a specific screen with beautiful GSAP animations
 * 
 * GSAP makes screen transitions feel polished and professional:
 * - Elements slide/fade in with easing
 * - Staggered animations create visual interest
 * - Timeline ensures proper sequencing
 * 
 * @param {string} screenName - Which screen to show (start, victory, defeat, pause)
 */
export function showScreen(screenName) {
    // Hide all screens first (instant, no animation)
    hideAllScreens();
    
    // Show the requested screen with animations
    switch (screenName) {
        case 'start':
            if (elements.startScreen) {
                elements.startScreen.classList.add('active');
                animateScreenIn(elements.startScreen);
            }
            break;
        case 'victory':
            if (elements.victoryScreen) {
                elements.victoryScreen.classList.add('active');
                if (elements.finalScoreVictory) {
                    elements.finalScoreVictory.textContent = formatNumber(getScore());
                }
                // Victory gets extra celebration animation
                animateVictoryScreen(elements.victoryScreen);
            }
            break;
        case 'defeat':
            if (elements.defeatScreen) {
                elements.defeatScreen.classList.add('active');
                if (elements.finalScoreDefeat) {
                    elements.finalScoreDefeat.textContent = formatNumber(getScore());
                }
                // Defeat has a more somber animation
                animateDefeatScreen(elements.defeatScreen);
            }
            break;
        case 'pause':
            if (elements.pauseScreen) {
                elements.pauseScreen.classList.add('active');
                animateScreenIn(elements.pauseScreen);
            }
            break;
        case 'settings':
            if (elements.settingsScreen) {
                elements.settingsScreen.classList.add('active');
                animateScreenIn(elements.settingsScreen);
            }
            break;
    }
}

/**
 * Animate a screen sliding/fading in
 * 
 * This is the standard animation for most screens:
 * - Container fades in
 * - Child elements stagger in from below
 * 
 * @param {HTMLElement} screen - The screen element to animate
 */
function animateScreenIn(screen) {
    // Get all direct children (h1, p, button, etc.)
    const children = screen.children;
    
    // Create a timeline for sequenced animations
    const tl = gsap.timeline();
    
    // Container fades in first
    tl.fromTo(screen, 
        { opacity: 0 }, 
        { opacity: 1, duration: 0.3, ease: "power2.out" }
    );
    
    // Each child element slides up and fades in with stagger
    tl.fromTo(children,
        { opacity: 0, y: 30 },
        { 
            opacity: 1, 
            y: 0, 
            duration: 0.5,
            stagger: 0.1, // Each element starts 0.1s after the previous
            ease: "back.out(1.2)" // Slight overshoot for bouncy feel
        },
        "-=0.1" // Start slightly before previous animation finishes
    );
}

/**
 * Special victory screen animation
 * 
 * Victory should feel celebratory! We use:
 * - Larger scale pop
 * - Bouncy easing
 * - Possible color pulse
 * 
 * @param {HTMLElement} screen - The victory screen element
 */
function animateVictoryScreen(screen) {
    const children = screen.children;
    const heading = screen.querySelector('h1');
    
    const tl = gsap.timeline();
    
    // Screen fades in
    tl.fromTo(screen,
        { opacity: 0 },
        { opacity: 1, duration: 0.3, ease: "power2.out" }
    );
    
    // Title does a big celebratory entrance
    if (heading) {
        tl.fromTo(heading,
            { opacity: 0, scale: 0.3, rotation: -10 },
            { 
                opacity: 1, 
                scale: 1, 
                rotation: 0,
                duration: 0.7,
                ease: "elastic.out(1, 0.5)" // Bouncy elastic effect
            },
            "-=0.1"
        );
        
        // Subtle pulse effect on title
        tl.to(heading, {
            textShadow: "0 0 30px rgba(0, 255, 255, 1), 0 0 60px rgba(0, 255, 255, 0.5)",
            duration: 0.5,
            repeat: 2,
            yoyo: true,
            ease: "power1.inOut"
        }, "-=0.3");
    }
    
    // Other children slide in
    const otherChildren = Array.from(children).filter(el => el !== heading);
    tl.fromTo(otherChildren,
        { opacity: 0, y: 20 },
        {
            opacity: 1,
            y: 0,
            duration: 0.4,
            stagger: 0.1,
            ease: "power2.out"
        },
        "-=0.8"
    );
}

/**
 * Special defeat screen animation
 * 
 * Defeat should feel impactful but not overly flashy:
 * - Slower, more somber entrance
 * - Slight shake effect
 * 
 * @param {HTMLElement} screen - The defeat screen element
 */
function animateDefeatScreen(screen) {
    const children = screen.children;
    const heading = screen.querySelector('h1');
    
    const tl = gsap.timeline();
    
    // Screen fades in with slight red tint (via filter)
    tl.fromTo(screen,
        { opacity: 0 },
        { opacity: 1, duration: 0.4, ease: "power2.out" }
    );
    
    // Title shakes in
    if (heading) {
        tl.fromTo(heading,
            { opacity: 0, x: -20 },
            { 
                opacity: 1, 
                x: 0,
                duration: 0.5,
                ease: "power3.out"
            },
            "-=0.2"
        );
        
        // Subtle shake
        tl.to(heading, {
            x: 5,
            duration: 0.05,
            repeat: 5,
            yoyo: true,
            ease: "none"
        });
    }
    
    // Other elements fade in normally
    const otherChildren = Array.from(children).filter(el => el !== heading);
    tl.fromTo(otherChildren,
        { opacity: 0, y: 10 },
        {
            opacity: 1,
            y: 0,
            duration: 0.4,
            stagger: 0.1,
            ease: "power2.out"
        },
        "-=0.3"
    );
}

/**
 * Hide all game screens
 */
export function hideAllScreens() {
    [elements.startScreen, elements.victoryScreen,
     elements.defeatScreen, elements.pauseScreen,
     elements.settingsScreen].forEach(screen => {
        if (screen) screen.classList.remove('active');
    });
}

/**
 * Show or hide the HUD
 * @param {boolean} visible - Whether HUD should be visible
 */
export function setHUDVisible(visible) {
    if (elements.hud) {
        if (visible) {
            elements.hud.classList.add('active');
        } else {
            elements.hud.classList.remove('active');
        }
    }
}

/**
 * Create a floating damage number with GSAP animation
 * 
 * Damage numbers "pop" when they appear and float upward:
 * - Start big, shrink to normal (impact feel)
 * - Float upward and fade out
 * - Kill shots get extra emphasis
 * 
 * @param {number} damage - Damage amount to display
 * @param {number} screenX - Screen X position
 * @param {number} screenY - Screen Y position
 * @param {boolean} isKill - Whether this was a killing blow
 */
export function showDamageNumber(damage, screenX, screenY, isKill = false) {
    const element = document.createElement('div');
    element.className = 'damage-number';
    element.textContent = Math.round(damage);
    element.style.left = screenX + 'px';
    element.style.top = screenY + 'px';
    element.style.position = 'fixed';
    element.style.pointerEvents = 'none';
    element.style.zIndex = '300';
    element.style.fontWeight = 'bold';
    element.style.fontFamily = 'monospace';
    
    // Different style for kills
    if (isKill) {
        element.style.color = '#ff4444';
        element.style.fontSize = '32px';
        element.style.textShadow = '0 0 10px rgba(255, 68, 68, 0.8)';
    } else {
        element.style.color = '#ffffff';
        element.style.fontSize = '20px';
        element.style.textShadow = '0 0 5px rgba(255, 255, 255, 0.5)';
    }
    
    document.body.appendChild(element);
    
    // Create GSAP animation
    const tl = gsap.timeline({
        onComplete: () => element.remove()
    });
    
    // Pop in (start big, shrink to normal)
    tl.fromTo(element,
        { scale: isKill ? 2 : 1.5, opacity: 0 },
        { scale: 1, opacity: 1, duration: 0.15, ease: "back.out(2)" }
    );
    
    // Float upward and fade
    tl.to(element, {
        y: -50 - Math.random() * 20, // Slight randomness
        x: (Math.random() - 0.5) * 30, // Slight horizontal drift
        opacity: 0,
        duration: 0.6,
        ease: "power2.out"
    });
}

/**
 * Create a floating text message with GSAP animation
 * 
 * Used for credits earned, bonuses, etc.
 * Slides up and fades out smoothly.
 * 
 * @param {string} text - Text to display
 * @param {number} screenX - Screen X position
 * @param {number} screenY - Screen Y position
 * @param {string} color - CSS color string
 */
export function showFloatingText(text, screenX, screenY, color = '#00ff00') {
    const element = document.createElement('div');
    element.className = 'floating-text';
    element.textContent = text;
    element.style.position = 'fixed';
    element.style.left = screenX + 'px';
    element.style.top = screenY + 'px';
    element.style.color = color;
    element.style.fontSize = '18px';
    element.style.fontWeight = 'bold';
    element.style.fontFamily = 'monospace';
    element.style.pointerEvents = 'none';
    element.style.zIndex = '300';
    element.style.textShadow = `0 0 8px ${color}`;
    
    document.body.appendChild(element);
    
    // GSAP animation - pop in, float up, fade out
    const tl = gsap.timeline({
        onComplete: () => element.remove()
    });
    
    // Start small and transparent
    tl.fromTo(element,
        { scale: 0.5, opacity: 0 },
        { scale: 1.2, opacity: 1, duration: 0.2, ease: "back.out(3)" }
    );
    
    // Shrink to normal
    tl.to(element, {
        scale: 1,
        duration: 0.1
    });
    
    // Float up and fade
    tl.to(element, {
        y: -40,
        opacity: 0,
        duration: 0.7,
        ease: "power1.out"
    });
}

/**
 * Announce a wave.
 *
 * Appearance now comes from the .wave-banner rules in game.css rather than an
 * inline cssText string. That split matters: restyling this used to mean
 * editing a CSS string inside a JS template literal, invisible to anyone
 * looking at the stylesheet.
 *
 * GSAP still owns the motion, because the overshoot-and-settle here is a
 * sequence rather than a state change and CSS transitions cannot express it.
 *
 * @param {number} waveNumber - Wave number to announce
 * @param {string} [subtitle] - Optional line under the number
 */
export function showWaveAnnouncement(waveNumber, subtitle = '') {
    const banner = document.createElement('div');
    banner.className = 'wave-banner';

    const heading = document.createElement('span');
    heading.textContent = `Wave ${waveNumber}`;
    banner.appendChild(heading);

    if (subtitle) {
        const sub = document.createElement('span');
        sub.className = 'wave-banner-sub';
        sub.textContent = subtitle;
        banner.appendChild(sub);
    }

    document.body.appendChild(banner);

    // The element is centred with left/top 50%, so every transform below has to
    // carry the -50% offset or GSAP's own transform would undo the centring
    const centre = { xPercent: -50, yPercent: -50 };

    if (prefersReducedMotion()) {
        gsap.set(banner, { ...centre, opacity: 1 });
        gsap.to(banner, { opacity: 0, duration: 0.4, delay: 1.6,
                          onComplete: () => banner.remove() });
        return;
    }

    const tl = gsap.timeline({ onComplete: () => banner.remove() });

    tl.set(banner, { ...centre, scale: 0.55, opacity: 0, rotation: -4 });

    tl.to(banner, {
        scale: 1.12, opacity: 1, rotation: 0,
        duration: 0.45, ease: 'back.out(2)'
    });

    tl.to(banner, { scale: 1, duration: 0.2, ease: 'power2.out' });

    tl.to({}, { duration: 1 }); // Hold

    tl.to(banner, {
        scale: 1.35, opacity: 0,
        duration: 0.45, ease: 'power2.in'
    });
}

/**
 * Show the end-of-wave summary.
 *
 * The numbers count up rather than appearing. That is not decoration: a number
 * that animates from zero is read as something earned, while the same number
 * appearing instantly is read as a label. It is the cheapest reward mechanic
 * there is.
 *
 * @param {object} summary - From getWaveSummary(), merged with awardWaveBonus()
 */
export function showWaveSummary(summary) {
    const panel = document.createElement('div');
    panel.className = 'wave-summary';

    const rows = [
        { label: 'Accuracy', value: summary.accuracy, suffix: '%' },
        { label: 'Wave bonus', value: summary.waveBonus || 0, prefix: '+', highlight: true },
        { label: 'Accuracy bonus', value: summary.accuracyBonus || 0, prefix: '+', highlight: true },
        { label: 'Credits earned', value: summary.credits, prefix: '+', highlight: true },
        { label: 'Score', value: summary.score, prefix: '+' }
    ];

    const heading = document.createElement('h2');
    heading.textContent = 'Wave Complete';
    panel.appendChild(heading);

    // Built with createElement rather than innerHTML. The values are internal
    // numbers so there is nothing to escape here, but keeping the two habits
    // apart means the one place that does take outside text cannot drift.
    const valueElements = rows.map((row) => {
        const line = document.createElement('div');
        line.className = row.highlight ? 'wave-summary-row highlight' : 'wave-summary-row';

        const label = document.createElement('span');
        label.textContent = row.label;

        const value = document.createElement('span');
        value.textContent = `${row.prefix || ''}0${row.suffix || ''}`;

        line.append(label, value);
        panel.appendChild(line);

        return value;
    });

    document.body.appendChild(panel);

    const centre = { xPercent: -50, yPercent: -50 };

    if (prefersReducedMotion()) {
        gsap.set(panel, { ...centre, opacity: 1 });
        rows.forEach((row, index) => {
            valueElements[index].textContent =
                `${row.prefix || ''}${Math.round(row.value)}${row.suffix || ''}`;
        });
        gsap.to(panel, { opacity: 0, duration: 0.4, delay: 2.4,
                         onComplete: () => panel.remove() });
        return;
    }

    const tl = gsap.timeline({
        onComplete: () => {
            gsap.to(panel, {
                opacity: 0, y: -40, duration: 0.45, ease: 'power2.in',
                onComplete: () => panel.remove()
            });
        }
    });

    tl.fromTo(panel,
        { ...centre, opacity: 0, y: -80, scale: 0.85 },
        { ...centre, opacity: 1, y: 0, scale: 1, duration: 0.45, ease: 'back.out(1.5)' }
    );

    // Every counter starts together. Staggering them would make the panel take
    // three times as long to read for no extra information.
    rows.forEach((row, index) => {
        const element = valueElements[index];

        tl.to({ val: 0 }, {
            val: row.value,
            duration: 0.75,
            ease: 'power2.out',
            onUpdate() {
                const current = Math.round(this.targets()[0].val);
                element.textContent = `${row.prefix || ''}${current}${row.suffix || ''}`;
            }
        }, index === 0 ? '-=0.1' : '<');
    });

    tl.to({}, { duration: 1.3 }); // Hold so it can actually be read
}

/**
 * Show tutorial tooltip
 * @param {string} title - Tooltip title
 * @param {string} text - Tooltip content
 * @param {number} x - Screen X position
 * @param {number} y - Screen Y position
 * @param {number} duration - How long to show (ms)
 */
export function showTooltip(title, text, x, y, duration = 5000) {
    const tooltip = document.createElement('div');
    tooltip.className = 'tooltip';
    tooltip.style.left = x + 'px';
    tooltip.style.top = y + 'px';
    
    tooltip.innerHTML = `
        <h3>${title}</h3>
        <p>${text}</p>
    `;
    
    document.body.appendChild(tooltip);
    
    if (duration > 0) {
        setTimeout(() => {
            tooltip.style.transition = 'opacity 0.3s';
            tooltip.style.opacity = '0';
            setTimeout(() => tooltip.remove(), 300);
        }, duration);
    }
    
    return tooltip;
}

/**
 * Format a number with commas for display
 * @param {number} num - Number to format
 * @returns {string} Formatted string
 */
function formatNumber(num) {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/**
 * Convert 3D position to 2D screen coordinates
 * @param {THREE.Vector3} position - 3D world position
 * @param {THREE.Camera} camera - The game camera
 * @returns {object} Screen coordinates {x, y}
 */
export function worldToScreen(position, camera) {
    const vector = position.clone();
    vector.project(camera);
    
    return {
        x: (vector.x * 0.5 + 0.5) * window.innerWidth,
        y: (-(vector.y * 0.5) + 0.5) * window.innerHeight
    };
}

// ==================== SELECTION PANEL ====================

/*
 * The panel that appears when a platform or the starbase is clicked.
 *
 * This module deliberately knows nothing about upgrade rules, refund rates or
 * what a platform is. It renders a plain view object and reports clicks back
 * through callbacks. selection.js decides what a selected thing looks like and
 * upgrade.js decides what it costs - so a new upgradeable structure needs no
 * change here at all.
 */

let selectionCallbacks = {
    onUpgrade: null,
    onSell: null,
    onClose: null,
    onTargeting: null
};

/**
 * Wire the panel's buttons.
 *
 * Listeners are attached once, here, rather than being rebuilt with the panel
 * contents. Re-attaching on every render is the classic way to accumulate
 * duplicate handlers and fire one click five times.
 *
 * @param {object} callbacks
 * @param {Function} [callbacks.onUpgrade] - Receives the upgrade id
 * @param {Function} [callbacks.onSell]
 * @param {Function} [callbacks.onClose]
 * @param {Function} [callbacks.onTargeting] - Receives the targeting mode id
 */
export function setSelectionCallbacks(callbacks = {}) {
    selectionCallbacks = { ...selectionCallbacks, ...callbacks };

    if (elements.selectionClose && !elements.selectionClose.dataset.wired) {
        elements.selectionClose.dataset.wired = 'true';
        elements.selectionClose.addEventListener('click', () => {
            if (selectionCallbacks.onClose) selectionCallbacks.onClose();
        });
    }

    if (elements.selectionSell && !elements.selectionSell.dataset.wired) {
        elements.selectionSell.dataset.wired = 'true';
        elements.selectionSell.addEventListener('click', () => {
            if (selectionCallbacks.onSell) selectionCallbacks.onSell();
        });
    }
}

/**
 * Render the selection panel.
 *
 * @param {object} view - Everything the panel should show
 * @param {string} view.name - Display name of the selected thing
 * @param {Array<{label: string, value: string, upgraded?: boolean}>} view.stats
 * @param {Array<{id: string, label: string, cost: number,
 *                affordable: boolean, maxed: boolean}>} [view.upgrades]
 * @param {{current: string, modes: Array<{id: string, label: string}>}}
 *        [view.targeting] - Targeting priority, omitted for things that do not
 *        choose their own target
 * @param {number|null} [view.sellValue] - Refund, or null if it cannot be sold
 */
export function showSelectionPanel(view) {
    if (!elements.selectionPanel) return;

    elements.selectionPanel.hidden = false;

    if (elements.selectionName) {
        elements.selectionName.textContent = view.name;
    }

    renderSelectionStats(view.stats || []);
    renderSelectionTargeting(view.targeting || null);
    renderSelectionUpgrades(view.upgrades || []);

    if (elements.selectionSell) {
        const canSell = typeof view.sellValue === 'number';
        elements.selectionSell.hidden = !canSell;

        if (canSell) {
            elements.selectionSell.textContent = `Sell for ${view.sellValue} cr`;
        }
    }
}

/**
 * @param {Array<object>} stats
 */
function renderSelectionStats(stats) {
    if (!elements.selectionStats) return;

    elements.selectionStats.innerHTML = '';

    stats.forEach((stat) => {
        const label = document.createElement('dt');
        label.textContent = stat.label;

        const value = document.createElement('dd');
        value.textContent = stat.value;

        // Green means "this is above the base value" - the visible payoff for
        // having spent credits, without needing to also print the base
        if (stat.upgraded) value.classList.add('upgraded');

        elements.selectionStats.append(label, value);
    });
}

/**
 * Render the targeting priority control as a row of segmented buttons.
 *
 * A row rather than a <select> because the whole point is that switching is
 * cheap - this is a setting the player is meant to flip mid-wave when they see
 * a Missile Launcher wasting its reload on trash, and a dropdown makes that
 * three interactions instead of one.
 *
 * @param {{current: string, modes: Array<object>}|null} targeting
 */
function renderSelectionTargeting(targeting) {
    if (!elements.selectionTargeting) return;

    elements.selectionTargeting.innerHTML = '';

    // Absent for anything that does not choose its own target
    if (!targeting || !targeting.modes || targeting.modes.length === 0) {
        elements.selectionTargeting.hidden = true;
        return;
    }

    elements.selectionTargeting.hidden = false;

    const label = document.createElement('div');
    label.className = 'targeting-label';
    label.textContent = 'Target';
    elements.selectionTargeting.appendChild(label);

    const row = document.createElement('div');
    row.className = 'targeting-row';

    targeting.modes.forEach((mode) => {
        const button = document.createElement('button');
        button.className = 'targeting-button';
        button.dataset.targeting = mode.id;
        button.textContent = mode.label;
        button.setAttribute('aria-pressed', String(mode.id === targeting.current));

        if (mode.id === targeting.current) button.classList.add('selected');

        // Safe to attach per render: this row is rebuilt each time, so every
        // button is a fresh element that has never carried a listener
        button.addEventListener('click', () => {
            if (selectionCallbacks.onTargeting) selectionCallbacks.onTargeting(mode.id);
        });

        row.appendChild(button);
    });

    elements.selectionTargeting.appendChild(row);
}

/**
 * @param {Array<object>} upgrades
 */
function renderSelectionUpgrades(upgrades) {
    if (!elements.selectionUpgrades) return;

    elements.selectionUpgrades.innerHTML = '';

    upgrades.forEach((upgrade) => {
        const button = document.createElement('button');
        button.className = 'upgrade-button';
        button.dataset.upgrade = upgrade.id;

        const label = document.createElement('span');
        label.textContent = upgrade.label;

        const cost = document.createElement('span');

        if (upgrade.maxed) {
            cost.className = 'upgrade-maxed';
            cost.textContent = 'MAX';
            button.disabled = true;
        } else {
            cost.className = 'upgrade-cost';
            cost.textContent = `${upgrade.cost} cr`;
            button.disabled = !upgrade.affordable;
        }

        button.append(label, cost);

        // Safe to attach per render: these buttons are rebuilt each time, so
        // each one is a fresh element that has never carried a listener
        button.addEventListener('click', () => {
            if (selectionCallbacks.onUpgrade) selectionCallbacks.onUpgrade(upgrade.id);
        });

        elements.selectionUpgrades.appendChild(button);
    });
}

/**
 * Hide the selection panel.
 */
export function hideSelectionPanel() {
    if (elements.selectionPanel) elements.selectionPanel.hidden = true;
}

/**
 * @returns {boolean} Whether the panel is currently showing
 */
export function isSelectionPanelOpen() {
    return Boolean(elements.selectionPanel && !elements.selectionPanel.hidden);
}
