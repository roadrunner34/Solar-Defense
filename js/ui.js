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

import { getCredits, getScore, getAccuracy, getGameStats } from './economy.js';
import { getEnemyCount } from './enemy.js';
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
}

/**
 * Update HUD with current game state
 * Call this every frame or when values change
 * @param {number} waveNumber - Current wave number
 */
export function updateHUD(waveNumber) {
    // Update wave number
    if (elements.waveNumber) {
        elements.waveNumber.textContent = waveNumber;
    }
    
    // Update enemy count
    if (elements.enemiesRemaining) {
        elements.enemiesRemaining.textContent = getEnemyCount();
    }
    
    // Update score
    if (elements.score) {
        elements.score.textContent = formatNumber(getScore());
    }
    
    // Update credits
    if (elements.credits) {
        elements.credits.textContent = formatNumber(getCredits());
    }
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
     elements.defeatScreen, elements.pauseScreen].forEach(screen => {
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
 * Show wave announcement with dramatic GSAP animation
 * 
 * Wave announcements should feel epic! This uses:
 * - Scale zoom from small to large
 * - Glow effect that pulses
 * - Smooth fade out
 * 
 * @param {number} waveNumber - Wave number to announce
 */
export function showWaveAnnouncement(waveNumber) {
    // Create container for the announcement
    const announcement = document.createElement('div');
    announcement.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        font-size: 64px;
        font-weight: bold;
        color: #00ffff;
        text-shadow: 0 0 20px rgba(0, 255, 255, 0.8);
        z-index: 200;
        pointer-events: none;
        white-space: nowrap;
    `;
    announcement.textContent = `Wave ${waveNumber}`;
    
    document.body.appendChild(announcement);
    
    // Create epic GSAP animation timeline
    const tl = gsap.timeline({
        onComplete: () => announcement.remove() // Clean up when done
    });
    
    // Start small and transparent
    tl.set(announcement, {
        scale: 0.5,
        opacity: 0,
        rotation: -5
    });
    
    // Zoom in with elastic bounce
    tl.to(announcement, {
        scale: 1.2, // Slightly overshoot
        opacity: 1,
        rotation: 0,
        duration: 0.5,
        ease: "back.out(2)"
    });
    
    // Settle to final size
    tl.to(announcement, {
        scale: 1,
        duration: 0.2,
        ease: "power2.out"
    });
    
    // Glow pulse effect
    tl.to(announcement, {
        textShadow: "0 0 40px rgba(0, 255, 255, 1), 0 0 80px rgba(0, 255, 255, 0.6)",
        duration: 0.3,
        yoyo: true,
        repeat: 1,
        ease: "power1.inOut"
    }, "-=0.1");
    
    // Hold for a moment
    tl.to({}, { duration: 1 });
    
    // Fade out while scaling up slightly (dramatic exit)
    tl.to(announcement, {
        scale: 1.5,
        opacity: 0,
        duration: 0.5,
        ease: "power2.in"
    });
}

/**
 * Show wave complete summary with animated stats
 * 
 * This uses GSAP to create a satisfying summary reveal:
 * - Box slides in from above
 * - Stats count up from zero (very satisfying!)
 * - Box slides out when done
 * 
 * @param {object} summary - Wave summary data
 */
export function showWaveSummary(summary) {
    const summaryDiv = document.createElement('div');
    summaryDiv.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: rgba(0, 20, 40, 0.95);
        padding: 30px 50px;
        border-radius: 10px;
        border: 2px solid #00aaff;
        z-index: 200;
        text-align: center;
        box-shadow: 0 0 30px rgba(0, 170, 255, 0.3);
    `;
    
    // Create spans for animated numbers
    summaryDiv.innerHTML = `
        <h2 style="color: #00ffff; margin-bottom: 20px;">Wave Complete!</h2>
        <p style="margin: 10px 0; color: #aaa;">Accuracy: <span class="stat-accuracy" style="color: #00ff00;">0%</span></p>
        <p style="margin: 10px 0; color: #aaa;">Credits Earned: <span class="stat-credits" style="color: #ffff00;">+0</span></p>
        <p style="margin: 10px 0; color: #aaa;">Score: <span class="stat-score" style="color: #00ffff;">+0</span></p>
    `;
    
    document.body.appendChild(summaryDiv);
    
    // Get the stat elements for animation
    const accuracyStat = summaryDiv.querySelector('.stat-accuracy');
    const creditsStat = summaryDiv.querySelector('.stat-credits');
    const scoreStat = summaryDiv.querySelector('.stat-score');
    
    // Create animation timeline
    const tl = gsap.timeline({
        onComplete: () => {
            // Fade out after showing
            gsap.to(summaryDiv, {
                opacity: 0,
                y: -50,
                duration: 0.5,
                ease: "power2.in",
                onComplete: () => summaryDiv.remove()
            });
        }
    });
    
    // Box slides in from above
    tl.fromTo(summaryDiv,
        { opacity: 0, y: -100, scale: 0.8 },
        { opacity: 1, y: 0, scale: 1, duration: 0.5, ease: "back.out(1.5)" }
    );
    
    // Animate the heading
    const heading = summaryDiv.querySelector('h2');
    tl.fromTo(heading,
        { opacity: 0, scale: 0.8 },
        { opacity: 1, scale: 1, duration: 0.3, ease: "back.out(2)" },
        "-=0.2"
    );
    
    // Count up the stats (very satisfying!)
    // Accuracy
    tl.to({ val: 0 }, {
        val: summary.accuracy,
        duration: 0.8,
        ease: "power2.out",
        onUpdate: function() {
            accuracyStat.textContent = Math.round(this.targets()[0].val) + '%';
        }
    }, "-=0.1");
    
    // Credits (count up)
    tl.to({ val: 0 }, {
        val: summary.credits,
        duration: 0.8,
        ease: "power2.out",
        onUpdate: function() {
            creditsStat.textContent = '+' + Math.round(this.targets()[0].val);
        }
    }, "<"); // "<" means start at same time as previous
    
    // Score (count up)
    tl.to({ val: 0 }, {
        val: summary.score,
        duration: 0.8,
        ease: "power2.out",
        onUpdate: function() {
            scoreStat.textContent = '+' + Math.round(this.targets()[0].val);
        }
    }, "<");
    
    // Pulse the box border when stats finish
    tl.to(summaryDiv, {
        boxShadow: "0 0 50px rgba(0, 255, 255, 0.6)",
        duration: 0.3,
        yoyo: true,
        repeat: 1
    });
    
    // Hold for viewing
    tl.to({}, { duration: 1.5 });
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
