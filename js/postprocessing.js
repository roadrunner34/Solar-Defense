/**
 * postprocessing.js - The render pipeline
 *
 * Everything between "the scene exists" and "pixels reach the canvas" lives
 * here: the EffectComposer chain, the colour grade shader, the quality tiers,
 * and the frame-time watchdog.
 *
 * This used to sit inside main.js. It moved out for two reasons: main.js was
 * carrying ~180 lines of GLSL that had nothing to do with game logic, and the
 * pipeline needed enough new behaviour (MSAA, tiers, a watchdog) that leaving
 * it inline would have buried the game loop.
 *
 * THE CHAIN
 * =========
 *   RenderPass  -> draws the scene into an HDR buffer
 *   BloomPass   -> bleeds light out of anything brighter than the threshold
 *   OutputPass  -> ACES tone map + sRGB encode  (HDR ends here)
 *   GradePass   -> vignette, contrast, saturation, shadow tint
 *
 * Two things about that order are deliberate and easy to get wrong:
 *
 * 1. Bloom must come BEFORE tone mapping. Three.js skips a material's tone
 *    mapping whenever it renders into a render target rather than the canvas
 *    (see the `currentRenderTarget === null` check in WebGLRenderer's program
 *    parameters), so colours stay linear and unclamped all the way through the
 *    composer. That is what lets a laser be `new Color(0, 2, 2.5)` and actually
 *    glow: the bloom pass can see the 2.5.
 *
 * 2. The grade must come AFTER tone mapping. Contrast that pivots around 0.5
 *    and saturation measured against a luminance constant are display-referred
 *    operations - they assume 1.0 means "white". Run them on linear HDR values
 *    and a 2.5 gets pushed to 2.62 rather than being nudged toward white. The
 *    original chain graded before OutputPass, which is why the look needed such
 *    timid numbers to avoid falling apart.
 */

import * as THREE from 'three';

import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

import { CONFIG } from './config.js';
import { addEffect } from './effects.js';

// ==================== MODULE STATE ====================

let composer = null;
let bloomPass = null;
let gradePass = null;
let activeRenderer = null;
let activeTier = 'high';

// Frame-time watchdog. Samples are milliseconds.
const frameSamples = [];
const FRAME_WINDOW = 90;
let watchdogArmed = false;
let lastFrameStamp = 0;
let smoothedFps = 60;

// Damage flash state, kept at module scope so overlapping flashes do not
// capture each other's mid-flash values as their "resting" colour.
const damageFlash = {
    active: false,
    elapsed: 0,
    duration: 0,
    baseIntensity: 0,
    baseTint: new THREE.Vector3()
};

// ==================== GRADE SHADER ====================

/**
 * Vignette + colour grade, applied in display-referred space.
 *
 * Runs after OutputPass, so tDiffuse holds sRGB-encoded values in 0..1 and the
 * shader writes straight to the canvas without any further conversion. A raw
 * ShaderMaterial only receives three.js's colour-space encode chunk if its
 * fragment shader includes <colorspace_fragment>; this one deliberately does
 * not, because OutputPass already encoded.
 */
export const GradeShader = {
    name: 'GradeShader',

    uniforms: {
        tDiffuse: { value: null },
        vignetteIntensity: { value: 0.42 },
        vignetteRadius: { value: 0.7 },
        colorTint: { value: new THREE.Vector3(0.06, 0.10, 0.16) },
        contrast: { value: 1.06 },
        saturation: { value: 1.12 }
    },

    vertexShader: /* glsl */ `
        varying vec2 vUv;

        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,

    fragmentShader: /* glsl */ `
        uniform sampler2D tDiffuse;
        uniform float vignetteIntensity;
        uniform float vignetteRadius;
        uniform vec3  colorTint;
        uniform float contrast;
        uniform float saturation;

        varying vec2 vUv;

        void main() {
            vec4 color = texture2D(tDiffuse, vUv);

            // ---------- CONTRAST ----------
            // Pivot around mid-grey. Valid here because OutputPass has already
            // mapped the HDR range down, so 0.5 really is the middle.
            color.rgb = (color.rgb - 0.5) * contrast + 0.5;

            // ---------- SATURATION ----------
            // Blend between the greyscale version and the original. Rec.709
            // luma weights - green dominates because the eye does.
            float luma = dot(color.rgb, vec3(0.2126, 0.7152, 0.0722));
            color.rgb = mix(vec3(luma), color.rgb, saturation);

            // ---------- SHADOW TINT ----------
            // Cool the darks without touching the highlights, so the sun stays
            // warm while the void reads blue rather than muddy grey.
            color.rgb += colorTint * (1.0 - luma) * 0.35;

            // ---------- VIGNETTE ----------
            // The 1.414 factor normalises the corner distance to 1.0, so
            // vignetteRadius reads as "fraction of the way to the corner".
            vec2  offset = vUv - vec2(0.5);
            float dist   = length(offset) * 1.414;
            float falloff = smoothstep(vignetteRadius, vignetteRadius + 0.55, dist);
            color.rgb *= 1.0 - falloff * vignetteIntensity;

            gl_FragColor = vec4(clamp(color.rgb, 0.0, 1.0), color.a);
        }
    `
};

// ==================== QUALITY TIERS ====================

/**
 * Pick a starting quality tier from what we can cheaply learn about the device.
 *
 * This is a guess, not a measurement - sampleFrame() does the measuring. The
 * guess only has to be close enough that most machines never see a downgrade
 * mid-game.
 *
 * @returns {string} 'high', 'medium' or 'low'
 */
export function detectQualityTier() {
    if (typeof navigator === 'undefined' || typeof document === 'undefined') {
        return CONFIG.graphics.defaultTier;
    }

    // A software rasteriser will never hold 60fps with bloom. Worth one probe.
    try {
        const probe = document.createElement('canvas').getContext('webgl2');
        if (!probe) return 'low';

        const debugInfo = probe.getExtension('WEBGL_debug_renderer_info');
        if (debugInfo) {
            const gpu = String(probe.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)).toLowerCase();
            if (/swiftshader|llvmpipe|software|basic render/.test(gpu)) return 'low';
        }
    } catch {
        // Probing is best-effort; a blocked context just falls through.
    }

    const cores = navigator.hardwareConcurrency || 4;
    const mobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || '');

    if (mobile || cores <= 2) return 'low';
    if (cores <= 4) return 'medium';

    return CONFIG.graphics.defaultTier;
}

/**
 * Choose the quality tier for this session.
 *
 * Called before createScene(), not inside initPostProcessing(), because scene
 * density - asteroid count, star count, whether the nebula exists at all - is
 * baked into geometry at build time. By the time the composer is being wired
 * up it is already too late to make the scene cheaper.
 *
 * @returns {string} The chosen tier
 */
export function initQuality() {
    activeTier = detectQualityTier();
    return activeTier;
}

/**
 * Settings object for the active tier.
 * @returns {object} Entry from CONFIG.graphics.tiers
 */
export function getTierSettings() {
    return CONFIG.graphics.tiers[activeTier] || CONFIG.graphics.tiers.high;
}

/**
 * @returns {string} The active tier name
 */
export function getQualityTier() {
    return activeTier;
}

/**
 * Switch quality tier at runtime.
 *
 * Only the live knobs move - pixel ratio and bloom. The MSAA sample count is
 * fixed when the composer's render target is built, and scene density
 * (asteroids, stars) is baked into geometry at scene-build time. Changing
 * either of those means a reload, which is not worth it mid-run.
 *
 * @param {string} tier - 'high', 'medium' or 'low'
 */
export function setQualityTier(tier) {
    if (!CONFIG.graphics.tiers[tier]) return;

    activeTier = tier;
    const settings = getTierSettings();

    if (activeRenderer) {
        activeRenderer.setPixelRatio(Math.min(window.devicePixelRatio, settings.pixelRatio));
    }

    if (bloomPass) {
        bloomPass.strength = settings.bloomStrength;
        bloomPass.radius = settings.bloomRadius;
        bloomPass.threshold = settings.bloomThreshold;
    }

    // A tier change resizes the drawing buffer, so the composer has to follow.
    if (composer) {
        composer.setSize(window.innerWidth, window.innerHeight);
    }
}

// ==================== SETUP ====================

/**
 * Build the composer chain.
 *
 * @param {THREE.WebGLRenderer} renderer
 * @param {THREE.Scene} scene
 * @param {THREE.Camera} camera
 * @returns {EffectComposer} The configured composer
 */
export function initPostProcessing(renderer, scene, camera) {
    activeRenderer = renderer;

    // Accumulate render stats across the whole composer chain rather than just
    // the last pass.
    //
    // renderer.info resets itself at the start of every render() by default.
    // With post-processing that means five render() calls per frame and a
    // counter that only ever reports the final one - a single fullscreen quad.
    // The debug readout was cheerfully reporting "1 draws" for a scene with
    // hundreds. Resetting manually once per frame in renderFrame() gives the
    // real total.
    renderer.info.autoReset = false;

    // The tier was already chosen by initQuality() before the scene was built,
    // so the scene and the pipeline agree on how much machine they are on
    const settings = getTierSettings();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, settings.pixelRatio));

    // ---------- THE RENDER TARGET ----------
    // This is the fix for the game having had no antialiasing at all.
    //
    // `new WebGLRenderer({ antialias: true })` only configures the default
    // framebuffer - the canvas itself. The moment you render through an
    // EffectComposer the scene goes into a render target instead, and that
    // flag stops applying. EffectComposer's own default target is built as
    // `{ type: HalfFloatType }` with no `samples`, so it has no MSAA either,
    // and every edge in the game was aliased.
    //
    // Handing the composer a target we built ourselves, with samples set, is
    // the whole fix. HalfFloatType is still required so HDR values above 1.0
    // survive for the bloom pass to find.
    const size = new THREE.Vector2();
    renderer.getDrawingBufferSize(size);

    const renderTarget = new THREE.WebGLRenderTarget(size.x, size.y, {
        type: THREE.HalfFloatType,
        samples: settings.samples
    });

    composer = new EffectComposer(renderer, renderTarget);

    // Pass 1: the scene
    composer.addPass(new RenderPass(scene, camera));

    // Pass 2: bloom, while values are still linear and unclamped
    bloomPass = new UnrealBloomPass(
        new THREE.Vector2(window.innerWidth, window.innerHeight),
        settings.bloomStrength,
        settings.bloomRadius,
        settings.bloomThreshold
    );
    composer.addPass(bloomPass);

    // Pass 3: ACES tone map + sRGB encode. HDR ends here.
    composer.addPass(new OutputPass());

    // Pass 4: the look, in display-referred space
    gradePass = new ShaderPass(GradeShader);
    applyGradeConfig(gradePass);
    composer.addPass(gradePass);

    return composer;
}

/**
 * Push CONFIG.graphics.grade into the grade pass uniforms.
 * @param {ShaderPass} pass
 */
function applyGradeConfig(pass) {
    const grade = CONFIG.graphics.grade;
    pass.uniforms.vignetteIntensity.value = grade.vignetteIntensity;
    pass.uniforms.vignetteRadius.value = grade.vignetteRadius;
    pass.uniforms.colorTint.value.set(...grade.colorTint);
    pass.uniforms.contrast.value = grade.contrast;
    pass.uniforms.saturation.value = grade.saturation;
}

// ==================== PER-FRAME ====================

/**
 * Render one frame through the chain.
 */
export function renderFrame() {
    if (!composer) return;

    // Manual reset, because autoReset was turned off in initPostProcessing so
    // the counters survive across all the passes in the chain
    if (activeRenderer) activeRenderer.info.reset();

    composer.render();
}

/**
 * Feed the frame-time watchdog and the FPS readout.
 *
 * Takes the raw rAF timestamp rather than the game's delta, because the game's
 * delta is clamped and can be zeroed by pause - neither of which tells you
 * anything about how hard the GPU is working.
 *
 * @param {number} timestamp - rAF timestamp in ms
 */
export function sampleFrame(timestamp) {
    if (!timestamp) return;

    if (lastFrameStamp) {
        const ms = timestamp - lastFrameStamp;

        // Ignore absurd gaps: tab switches, breakpoints, alt-tab.
        if (ms > 0 && ms < 500) {
            frameSamples.push(ms);
            if (frameSamples.length > FRAME_WINDOW) frameSamples.shift();

            // Exponential smoothing so the readout does not strobe.
            smoothedFps += (1000 / ms - smoothedFps) * 0.05;
        }
    }

    lastFrameStamp = timestamp;

    // Only judge once there is a full window, and give the first window a pass:
    // startup frames include shader compilation and texture upload, which are
    // one-off costs that say nothing about steady-state performance.
    if (frameSamples.length < FRAME_WINDOW) return;

    if (!watchdogArmed) {
        watchdogArmed = true;
        frameSamples.length = 0;
        return;
    }

    if (medianOf(frameSamples) > CONFIG.graphics.frameBudgetMs) {
        if (activeTier === 'high') {
            setQualityTier('medium');
            frameSamples.length = 0;
        } else if (activeTier === 'medium') {
            setQualityTier('low');
            frameSamples.length = 0;
        }
    }
}

/**
 * Median rather than mean: one 200ms hitch from a garbage collection should
 * not be enough to downgrade a machine that is otherwise comfortable.
 * @param {number[]} values
 * @returns {number}
 */
function medianOf(values) {
    const sorted = [...values].sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)];
}

/**
 * @returns {{fps: number, tier: string, frameMs: number}} Live render stats
 */
export function getFrameStats() {
    return {
        fps: Math.round(smoothedFps),
        tier: activeTier,
        frameMs: frameSamples.length ? medianOf(frameSamples) : 0
    };
}

// ==================== RESIZE ====================

/**
 * @param {number} width
 * @param {number} height
 */
export function resizePostProcessing(width, height) {
    if (composer) composer.setSize(width, height);
    if (bloomPass) bloomPass.resolution.set(width, height);
}

// ==================== GRADE CONTROLS ====================

/**
 * @param {number} intensity - Vignette darkness, 0-1
 */
export function setVignetteIntensity(intensity) {
    if (gradePass) gradePass.uniforms.vignetteIntensity.value = intensity;
}

/**
 * Flash the vignette red - the planet just took a hit.
 *
 * Driven through effects.js rather than setTimeout, so it freezes with the
 * game when paused and cannot fire its reset into an already-restarted run.
 * The damageFlash.active guard means a second hit during a flash extends it
 * rather than capturing the mid-flash red as its resting colour.
 *
 * @param {number} duration - Seconds
 */
export function flashDamageVignette(duration = 0.5) {
    if (!gradePass) return;

    const uniforms = gradePass.uniforms;

    if (damageFlash.active) {
        damageFlash.elapsed = 0;
        damageFlash.duration = duration;
        return;
    }

    damageFlash.active = true;
    damageFlash.elapsed = 0;
    damageFlash.duration = duration;
    damageFlash.baseIntensity = uniforms.vignetteIntensity.value;
    damageFlash.baseTint.copy(uniforms.colorTint.value);

    addEffect((deltaTime) => {
        damageFlash.elapsed += deltaTime;

        const t = Math.min(damageFlash.elapsed / damageFlash.duration, 1);
        const strength = (1 - t) * (1 - t); // Ease out: hard hit, soft recovery

        uniforms.vignetteIntensity.value =
            damageFlash.baseIntensity + (0.75 - damageFlash.baseIntensity) * strength;

        uniforms.colorTint.value.set(
            damageFlash.baseTint.x + (0.55 - damageFlash.baseTint.x) * strength,
            damageFlash.baseTint.y * (1 - strength),
            damageFlash.baseTint.z * (1 - strength)
        );

        if (t < 1) return true;

        uniforms.vignetteIntensity.value = damageFlash.baseIntensity;
        uniforms.colorTint.value.copy(damageFlash.baseTint);
        damageFlash.active = false;
        return false;
    });
}

/**
 * Reset transient grade state. Called on restart so a run that ended mid-flash
 * does not leave the next run tinted red.
 */
export function resetPostProcessing() {
    if (gradePass) applyGradeConfig(gradePass);
    damageFlash.active = false;
    frameSamples.length = 0;
    lastFrameStamp = 0;
}

/**
 * @returns {EffectComposer|null}
 */
export function getComposer() {
    return composer;
}
