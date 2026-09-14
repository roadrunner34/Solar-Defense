/**
 * audio.js - Procedural sound
 *
 * Every sound in Solar Defense is synthesized at runtime. There are no audio
 * files, for exactly the reason there are no texture files: this project
 * generates its assets at load time, and shipping a folder of samples to sit
 * next to procedurally generated planets would be the one inconsistent thing
 * in the build.
 *
 * The recipes are data, in CONFIG.audio.sounds. This module is the renderer
 * that turns a recipe into Web Audio nodes, so retuning a sound is a config
 * edit like every other balance value.
 *
 * ==================== TWO THINGS THAT SHAPE THIS MODULE ====================
 *
 * 1. It has to survive having no AudioContext at all.
 *
 *    Most of the test suite runs in Vitest's `node` environment, where there is
 *    no Web Audio API. textures.js already established the pattern - every
 *    texture factory returns a blank texture when there is no 2D canvas context,
 *    which is what lets the scene build headless. This module does the same:
 *    nothing touches AudioContext at module scope, and every play function
 *    returns false instead of throwing when there is no context.
 *
 * 2. It cannot start itself.
 *
 *    Browsers refuse to let a page make noise before the user has interacted
 *    with it. An AudioContext constructed on page load is born 'suspended' and
 *    silently plays nothing. So initAudio() is called from the Start button,
 *    not from init() - the first real gesture the game receives.
 */

import { CONFIG } from './config.js';
import { getSetting, onSettingChange } from './settings.js';

// ==================== MODULE STATE ====================

/** The AudioContext, or null until initAudio() succeeds. */
let ctx = null;

/** Gain nodes forming the mixer: sfx and music both feed master. */
let masterGain = null;
let sfxGain = null;
let musicGain = null;

/** A shared buffer of white noise, generated once. See createNoiseBuffer(). */
let noiseBuffer = null;

/** How many sounds are currently playing, for the voice cap. */
let activeVoices = 0;

/**
 * Context time each sound last triggered, keyed by name.
 *
 * Sounds have a minimum retrigger interval. Without one, a wave where eight
 * lasers fire in the same frame stacks eight identical bolts starting at the
 * same instant, which is not eight times louder - it is one bolt, clipped.
 */
const lastPlayed = new Map();

/** Unsubscribe handle for the settings listener, so init stays idempotent. */
let unsubscribeSettings = null;

/** Seconds of noise to generate. Long enough that looping is not audible. */
const NOISE_BUFFER_SECONDS = 2;

/**
 * exponentialRampToValueAtTime() cannot ramp to or from zero - the maths is
 * undefined and the Web Audio spec throws. Envelopes ramp to this instead,
 * which is about -80dB and inaudible.
 */
const SILENCE = 0.0001;

// ==================== INITIALIZATION ====================

/**
 * The AudioContext constructor available in this environment, if any.
 *
 * Looked up rather than referenced directly so that a node environment - where
 * neither name exists - yields null instead of a ReferenceError.
 *
 * @returns {Function|null}
 */
function getAudioContextConstructor() {
    if (typeof globalThis === 'undefined') return null;
    return globalThis.AudioContext || globalThis.webkitAudioContext || null;
}

/**
 * Build the audio graph. Safe to call repeatedly.
 *
 * Must be called from inside a user gesture handler - see the note at the top
 * of the file. The game calls it from the Start button.
 *
 * @returns {boolean} True if audio is available and ready
 */
export function initAudio() {
    if (ctx) {
        resumeAudio();
        return true;
    }

    const AudioContextConstructor = getAudioContextConstructor();
    if (!AudioContextConstructor) return false;

    try {
        ctx = new AudioContextConstructor();
    } catch {
        // Some browsers throw when too many contexts exist. Silence is a fine
        // failure mode for a game's sound effects.
        ctx = null;
        return false;
    }

    masterGain = ctx.createGain();
    masterGain.connect(ctx.destination);

    // Two buses so the settings screen can balance effects against music
    // independently, and so music can duck without touching effect levels.
    sfxGain = ctx.createGain();
    sfxGain.connect(masterGain);

    musicGain = ctx.createGain();
    musicGain.connect(masterGain);

    noiseBuffer = createNoiseBuffer();

    applyVolumeSettings();

    // Follow the settings store, so dragging a volume slider is audible while
    // it is being dragged rather than on the next sound
    if (!unsubscribeSettings) {
        unsubscribeSettings = onSettingChange(applyVolumeSettings);
    }

    resumeAudio();

    return true;
}

/**
 * Resume a suspended context.
 *
 * A context created outside a gesture starts suspended, and browsers also
 * suspend one belonging to a backgrounded tab.
 */
export function resumeAudio() {
    if (!ctx || ctx.state !== 'suspended') return;

    // Returns a promise; nothing useful to do with either outcome, and an
    // unhandled rejection would surface in the console as a page error
    Promise.resolve(ctx.resume()).catch(() => {});
}

/**
 * Whether audio is initialized and able to play.
 * @returns {boolean}
 */
export function isAudioReady() {
    return ctx !== null;
}

/**
 * Push the stored volume settings into the mixer.
 *
 * Volume is applied as the square of the setting rather than the setting
 * directly. Loudness is perceived roughly logarithmically, so a linear slider
 * feels like it does almost nothing across its top half and then everything in
 * the last 10%. Squaring is the cheap correction that makes the middle of the
 * slider sound like the middle.
 */
function applyVolumeSettings() {
    if (!ctx) return;

    const perceptual = (value) => value * value;

    masterGain.gain.value = perceptual(getSetting('masterVolume'));
    sfxGain.gain.value = perceptual(getSetting('sfxVolume'));
    musicGain.gain.value = perceptual(getSetting('musicVolume'));
}

/**
 * Generate the shared white-noise buffer.
 *
 * One buffer, reused by every noise layer from a random offset, rather than a
 * fresh buffer per sound. Explosions are the most common noise source in the
 * game, and allocating a second of samples per kill would be real garbage
 * pressure during a wave.
 *
 * @returns {AudioBuffer}
 */
function createNoiseBuffer() {
    const length = Math.floor(ctx.sampleRate * NOISE_BUFFER_SECONDS);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < length; i++) {
        data[i] = Math.random() * 2 - 1;
    }

    return buffer;
}

// ==================== PLAYBACK ====================

/**
 * Play a named sound from CONFIG.audio.sounds.
 *
 * @param {string} name - Recipe name
 * @param {object} [options]
 * @param {number} [options.pan] - Stereo position, -1 (left) to 1 (right)
 * @param {number} [options.pitch] - Frequency multiplier, 1 is as configured
 * @param {number} [options.volume] - Level multiplier, 1 is as configured
 * @returns {boolean} True if the sound actually started
 */
export function playSound(name, options = {}) {
    if (!ctx) return false;

    const recipe = CONFIG.audio.sounds[name];
    if (!recipe || !recipe.layers) return false;

    const now = ctx.currentTime;

    // Retrigger cooldown
    const previous = lastPlayed.get(name);
    if (previous !== undefined && now - previous < (recipe.cooldown || 0)) {
        return false;
    }

    // Voice cap. Priority sounds ignore it: a breach alarm losing out to the
    // tail of six explosions is precisely the wrong trade, and there are only
    // ever a couple of priority sounds in flight.
    if (!recipe.priority && activeVoices >= CONFIG.audio.maxVoices) {
        return false;
    }

    lastPlayed.set(name, now);
    activeVoices++;

    const { pan = 0, pitch = 1, volume = 1 } = options;

    // Small random detune per trigger, so a run of kills does not sound like
    // the same sample stamped out repeatedly
    const variance = recipe.variance || 0;
    const effectivePitch = pitch * (1 + (Math.random() * 2 - 1) * variance);

    const destination = createVoiceOutput(pan);

    let latestEnd = now;

    for (const layer of recipe.layers) {
        const end = renderLayer(layer, now, destination, effectivePitch, volume);
        if (end > latestEnd) latestEnd = end;
    }

    // Release the voice slot once the longest layer has finished. Driven by a
    // timer rather than by onended, because a layer whose source never starts -
    // a malformed recipe - would otherwise leak the slot permanently.
    const lifetimeMs = (latestEnd - now) * 1000 + 50;

    setTimeout(() => {
        activeVoices = Math.max(0, activeVoices - 1);
        try {
            destination.disconnect();
        } catch {
            // Already disconnected; nothing to do
        }
    }, lifetimeMs);

    return true;
}

/**
 * Build the per-sound output chain: an optional stereo panner into the sfx bus.
 *
 * @param {number} pan - -1 to 1
 * @returns {AudioNode} The node layers should connect into
 */
function createVoiceOutput(pan) {
    // StereoPannerNode is not universal, and a missing panner should cost the
    // positioning, not the sound
    if (!pan || typeof ctx.createStereoPanner !== 'function') {
        const passthrough = ctx.createGain();
        passthrough.connect(sfxGain);
        return passthrough;
    }

    const panner = ctx.createStereoPanner();
    panner.pan.value = Math.min(1, Math.max(-1, pan));
    panner.connect(sfxGain);

    return panner;
}

/**
 * Render one layer of a recipe into the graph.
 *
 * @param {object} layer - A layer from CONFIG.audio.sounds[name].layers
 * @param {number} soundStart - Context time the whole sound began
 * @param {AudioNode} destination - Where this layer's output goes
 * @param {number} pitch - Frequency multiplier
 * @param {number} volume - Level multiplier
 * @returns {number} Context time this layer finishes
 */
function renderLayer(layer, soundStart, destination, pitch, volume) {
    const start = soundStart + (layer.delay || 0);
    const duration = layer.duration;
    const end = start + duration;

    const source = layer.source === 'noise'
        ? createNoiseSource()
        : createToneSource(layer, start, duration, pitch);

    if (!source) return end;

    // Envelope: fast attack to peak, then an exponential fall to silence.
    // Exponential rather than linear because a linear fade sounds like it stops
    // abruptly - amplitude decay in the physical world is exponential, and the
    // ear notices when it is not.
    const envelope = ctx.createGain();
    const peak = Math.max(SILENCE, layer.gain * volume);
    const attack = Math.min(layer.attack || 0.005, duration * 0.5);

    envelope.gain.setValueAtTime(SILENCE, start);
    envelope.gain.exponentialRampToValueAtTime(peak, start + attack);
    envelope.gain.exponentialRampToValueAtTime(SILENCE, end);

    let node = source;

    if (layer.filter) {
        const filter = createFilter(layer.filter, start, duration, pitch);
        node.connect(filter);
        node = filter;
    }

    node.connect(envelope);
    envelope.connect(destination);

    source.start(start);
    source.stop(end);

    return end;
}

/**
 * An oscillator with its frequency ramped across the layer's duration.
 *
 * @param {object} layer
 * @param {number} start - Context time
 * @param {number} duration - Seconds
 * @param {number} pitch - Frequency multiplier
 * @returns {OscillatorNode}
 */
function createToneSource(layer, start, duration, pitch) {
    const oscillator = ctx.createOscillator();
    oscillator.type = layer.wave || 'sine';

    const [from, to] = layer.freq;

    // Clamped above zero: an exponential ramp through or to zero is undefined
    // and throws. 20Hz is already below hearing.
    const startFreq = Math.max(20, from * pitch);
    const endFreq = Math.max(20, to * pitch);

    oscillator.frequency.setValueAtTime(startFreq, start);

    if (endFreq !== startFreq) {
        oscillator.frequency.exponentialRampToValueAtTime(endFreq, start + duration);
    }

    return oscillator;
}

/**
 * A buffer source reading the shared noise buffer from a random offset.
 *
 * @returns {AudioBufferSourceNode|null}
 */
function createNoiseSource() {
    if (!noiseBuffer) return null;

    const source = ctx.createBufferSource();
    source.buffer = noiseBuffer;

    // Looping so a layer longer than the buffer still has samples to read, and
    // so repeated explosions do not all start from sample zero and sound like
    // one recording played twice
    source.loop = true;
    source.loopStart = 0;
    source.loopEnd = NOISE_BUFFER_SECONDS;

    return source;
}

/**
 * A biquad filter with its cutoff swept across the layer's duration.
 *
 * The sweep carries most of a sound's character here: an explosion is noise
 * whose cutoff collapses from bright to dull, which is what a real one does as
 * the high frequencies dissipate first.
 *
 * @param {object} spec - layer.filter
 * @param {number} start - Context time
 * @param {number} duration - Seconds
 * @param {number} pitch - Frequency multiplier
 * @returns {BiquadFilterNode}
 */
function createFilter(spec, start, duration, pitch) {
    const filter = ctx.createBiquadFilter();
    filter.type = spec.type || 'lowpass';
    filter.Q.value = spec.q || 1;

    const [from, to] = spec.freq;

    // Nyquist is the hard ceiling for a filter cutoff; above it the response is
    // undefined and browsers clamp or throw
    const ceiling = ctx.sampleRate / 2;
    const startFreq = Math.min(ceiling, Math.max(20, from * pitch));
    const endFreq = Math.min(ceiling, Math.max(20, to * pitch));

    filter.frequency.setValueAtTime(startFreq, start);

    if (endFreq !== startFreq) {
        filter.frequency.exponentialRampToValueAtTime(endFreq, start + duration);
    }

    return filter;
}

// ==================== HELPERS ====================

/**
 * Convert a screen X coordinate into a stereo pan position.
 *
 * Kept here as pure maths rather than importing worldToScreen from ui.js,
 * because audio.js has no business depending on the HUD. Callers that already
 * have a screen position - main.js computes one per hit for damage numbers -
 * pass it through this.
 *
 * Scaled to 0.7 rather than the full -1..1 because hard-panned game audio is
 * disorienting on headphones, and an explosion at the left edge of the screen
 * is not actually beside the player's ear.
 *
 * @param {number} screenX - Pixels from the left edge
 * @param {number} [width] - Viewport width
 * @returns {number} Pan position, -0.7 to 0.7
 */
export function panFromScreenX(screenX, width) {
    const viewportWidth = width || (typeof window !== 'undefined' ? window.innerWidth : 0);
    if (!viewportWidth) return 0;

    const normalised = (screenX / viewportWidth) * 2 - 1;

    return Math.min(0.7, Math.max(-0.7, normalised * 0.7));
}

/**
 * The music bus, for the layered score that plugs in next.
 * @returns {GainNode|null}
 */
export function getMusicBus() {
    return musicGain;
}

/**
 * The AudioContext, for modules that need to schedule against its clock.
 * @returns {AudioContext|null}
 */
export function getAudioContext() {
    return ctx;
}

/**
 * How many sounds are currently playing. Used by tests to prove the voice cap.
 * @returns {number}
 */
export function getActiveVoiceCount() {
    return activeVoices;
}

/**
 * Forget every retrigger cooldown.
 *
 * Called on restart: cooldowns are keyed on context time, which keeps running
 * across a restart, so without this the first shot of a new run could be eaten
 * by the cooldown left over from the last shot of the previous one.
 */
export function resetSoundCooldowns() {
    lastPlayed.clear();
}

/**
 * Tear the audio graph down. Only used by tests.
 */
export function disposeAudio() {
    if (unsubscribeSettings) {
        unsubscribeSettings();
        unsubscribeSettings = null;
    }

    if (ctx && typeof ctx.close === 'function') {
        try {
            ctx.close();
        } catch {
            // Already closed
        }
    }

    ctx = null;
    masterGain = null;
    sfxGain = null;
    musicGain = null;
    noiseBuffer = null;
    activeVoices = 0;
    lastPlayed.clear();
}
