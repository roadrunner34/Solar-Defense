/**
 * music.js - The layered drone
 *
 * A tower defence is played in long stretches of watching, and anything with a
 * melody becomes maddening by its fourth loop. So the score here is not a tune:
 * it is a stack of sustained voices that fade in and out with how dangerous
 * things currently are, and never resolves.
 *
 * All of it is synthesized, like everything else in this project - a handful of
 * oscillators held open for the whole run, each with its own gain that the
 * intensity curve rides. Adding a voice is a config edit; see CONFIG.audio.music.
 *
 * WHY THIS IS ITS OWN MODULE
 * ==========================
 * audio.js renders one-shot sounds: something happens, a few nodes are built,
 * they play and are thrown away. Music is the opposite shape - a small number
 * of nodes that exist for the entire session and are never rebuilt, only
 * rebalanced. Keeping the two apart means neither has to carry the other's
 * lifetime rules. music.js borrows audio.js's context and music bus and owns
 * nothing else.
 */

import { CONFIG } from './config.js';
import { getAudioContext, getMusicBus } from './audio.js';

/**
 * The running voices. Each is { gain, oscillator, lfo, spec }.
 * Empty until startMusic() succeeds.
 */
let voices = [];

/** Current intensity, 0 to 1. Kept so a restart can re-apply it. */
let intensity = 0;

/**
 * Start the drone. Safe to call repeatedly - a restart should not stack a
 * second set of oscillators on top of the first.
 *
 * @returns {boolean} True if music is playing
 */
export function startMusic() {
    if (voices.length > 0) return true;

    const ctx = getAudioContext();
    const bus = getMusicBus();

    if (!ctx || !bus) return false;

    const now = ctx.currentTime;

    for (const spec of CONFIG.audio.music.voices) {
        voices.push(createVoice(ctx, bus, spec, now));
    }

    // Apply whatever intensity was last requested, instantly rather than over
    // the usual fade. Starting a wave-9 run should not take five seconds to
    // sound like wave 9.
    applyIntensity(0);

    return true;
}

/**
 * Build one sustained voice: oscillator, optional filter, gain, optional LFO.
 *
 * @param {AudioContext} ctx
 * @param {AudioNode} bus - The music bus to output into
 * @param {object} spec - A voice from CONFIG.audio.music.voices
 * @param {number} now - Context time
 * @returns {object} The voice record
 */
function createVoice(ctx, bus, spec, now) {
    const oscillator = ctx.createOscillator();
    oscillator.type = spec.wave || 'sine';
    oscillator.frequency.setValueAtTime(spec.freq, now);

    // The voice's own level, ridden by the intensity curve. Starts silent;
    // applyIntensity() decides what it should actually be.
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, now);

    let node = oscillator;

    if (spec.filter) {
        const filter = ctx.createBiquadFilter();
        filter.type = spec.filter.type || 'lowpass';
        filter.frequency.setValueAtTime(spec.filter.freq, now);
        filter.Q.value = spec.filter.q || 1;

        node.connect(filter);
        node = filter;
    }

    node.connect(gain);
    gain.connect(bus);

    let lfo = null;
    let lfoDepth = null;

    if (spec.pulse) {
        // A low-frequency oscillator wired into a gain's gain parameter is the
        // standard way to make something breathe. The LFO output is a signal in
        // the range -depth..+depth, and connecting it to an AudioParam *adds*
        // to that param's value rather than replacing it - which is why the
        // pulse depth has to stay below the voice's own level or the trough
        // would push the gain negative and invert the phase.
        lfo = ctx.createOscillator();
        lfo.type = 'sine';
        lfo.frequency.setValueAtTime(spec.pulse.rate, now);

        lfoDepth = ctx.createGain();
        lfoDepth.gain.setValueAtTime(0, now);

        lfo.connect(lfoDepth);
        lfoDepth.connect(gain.gain);

        lfo.start(now);
    }

    oscillator.start(now);

    return { oscillator, gain, lfo, lfoDepth, spec };
}

/**
 * Set how dangerous things sound, 0 to 1.
 *
 * Voices do not switch on at their threshold, they fade across a band above it
 * - otherwise a voice would snap into existence the instant intensity crossed a
 * number, which is audible as a click and reads as a bug.
 *
 * @param {number} value - 0 (calm) to 1 (everything present)
 * @param {number} [fadeSeconds] - Override the configured crossfade
 */
export function setMusicIntensity(value, fadeSeconds) {
    intensity = Math.min(1, Math.max(0, value));
    applyIntensity(fadeSeconds === undefined ? CONFIG.audio.music.fadeSeconds : fadeSeconds);
}

/**
 * Push the current intensity into every voice's gain.
 *
 * @param {number} fadeSeconds - 0 for an immediate change
 */
function applyIntensity(fadeSeconds) {
    const ctx = getAudioContext();
    if (!ctx || voices.length === 0) return;

    const now = ctx.currentTime;
    const { fadeBand } = CONFIG.audio.music;

    for (const voice of voices) {
        const { threshold, gain: peak, pulse } = voice.spec;

        // How far this voice has faded in.
        //
        // `threshold` is the intensity by which a voice is FULLY present, and
        // it fades in across the band immediately below that - not above it.
        // Written the other way round, a voice with threshold 0 would still be
        // silent at intensity 0, so wave 1 would have no music at all rather
        // than the bare root drone it is supposed to have.
        const presence = Math.min(1, Math.max(0,
            (intensity - (threshold - fadeBand)) / fadeBand
        ));

        const target = peak * presence;

        rampTo(voice.gain.gain, target, now, fadeSeconds);

        if (pulse && voice.lfoDepth) {
            // Pulse depth scales with the voice, and stays under its level so
            // the trough of the LFO cannot drive the gain below zero
            rampTo(voice.lfoDepth.gain, target * pulse.depth, now, fadeSeconds);
        }
    }
}

/**
 * Ramp an AudioParam toward a value.
 *
 * Linear rather than exponential, unlike the effect envelopes in audio.js.
 * Exponential ramps cannot pass through zero, and a voice fading fully out is
 * exactly the case here - so this is the one place in the project where a
 * linear ramp is the correct choice.
 *
 * @param {AudioParam} param
 * @param {number} target
 * @param {number} now - Context time
 * @param {number} seconds - 0 sets the value immediately
 */
function rampTo(param, target, now, seconds) {
    param.cancelScheduledValues(now);

    // Pin the current value first. Without this the ramp starts from whatever
    // was last *scheduled* rather than where the parameter actually is, so
    // changing intensity mid-fade jumps.
    param.setValueAtTime(param.value, now);

    if (seconds > 0) {
        param.linearRampToValueAtTime(target, now + seconds);
    } else {
        param.setValueAtTime(target, now);
    }
}

/**
 * Map a wave number onto an intensity.
 *
 * Kept here rather than in main.js so the curve lives next to the voices it
 * drives. Wave 1 is not silent - it sits at the root drone - because starting
 * a run in total silence reads as broken audio rather than as calm.
 *
 * @param {number} waveNumber
 * @returns {number} Intensity, 0 to 1
 */
export function intensityForWave(waveNumber) {
    const { peakWave } = CONFIG.audio.music;

    return Math.min(1, Math.max(0, (waveNumber - 1) / (peakWave - 1)));
}

/**
 * Set the intensity appropriate to a wave.
 *
 * @param {number} waveNumber
 */
export function setMusicWave(waveNumber) {
    setMusicIntensity(intensityForWave(waveNumber));
}

/**
 * Fade the music out and release its oscillators.
 *
 * @param {number} [fadeSeconds] - How long to fade before stopping
 */
export function stopMusic(fadeSeconds = 2) {
    const ctx = getAudioContext();
    if (!ctx || voices.length === 0) {
        voices = [];
        return;
    }

    const now = ctx.currentTime;

    for (const voice of voices) {
        rampTo(voice.gain.gain, 0, now, fadeSeconds);

        // Stop after the fade rather than immediately, or the drone cuts off
        // mid-fade with a click
        voice.oscillator.stop(now + fadeSeconds + 0.1);
        if (voice.lfo) voice.lfo.stop(now + fadeSeconds + 0.1);
    }

    voices = [];
    intensity = 0;
}

/**
 * Whether the drone is currently running.
 * @returns {boolean}
 */
export function isMusicPlaying() {
    return voices.length > 0;
}

/**
 * The current intensity. Used by tests.
 * @returns {number}
 */
export function getMusicIntensity() {
    return intensity;
}

/**
 * How many voices are running. Used by tests.
 * @returns {number}
 */
export function getMusicVoiceCount() {
    return voices.length;
}
