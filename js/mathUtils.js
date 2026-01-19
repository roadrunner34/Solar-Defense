/**
 * mathUtils.js - Animation and Interpolation Utilities
 * 
 * This module provides smooth animation functions inspired by the 'maath' library.
 * These are essential for creating buttery-smooth motion that feels professional.
 * 
 * KEY CONCEPT: Frame-Rate Independent Animation
 * =============================================
 * 
 * Regular lerp (linear interpolation) has a problem:
 *   position = lerp(position, target, 0.1)
 * 
 * This moves 10% of the remaining distance each frame. But on a faster computer
 * (more frames per second), it moves more often, making the animation faster!
 * 
 * SOLUTION: "Damp" functions factor in delta time (time between frames) to ensure
 * consistent motion regardless of frame rate. The formula is based on exponential
 * decay, which naturally approaches the target smoothly.
 * 
 * Think of it like this:
 * - lerp: "Move 10% closer each frame" (frame-rate dependent)
 * - damp: "Move at this SPEED toward target" (frame-rate independent)
 */

import * as THREE from 'three';

/**
 * Frame-rate independent damping for a single number
 * 
 * Smoothly animates a value toward a target. Higher lambda = faster movement.
 * This is the core building block - other damp functions use this internally.
 * 
 * MATH EXPLANATION:
 * The formula `current + (target - current) * (1 - exp(-lambda * delta))` comes
 * from solving the differential equation for exponential decay. It guarantees
 * smooth, frame-rate independent movement.
 * 
 * @param {number} current - Current value
 * @param {number} target - Target value to move toward
 * @param {number} lambda - Speed factor (higher = faster, 1-20 is typical range)
 * @param {number} delta - Time since last frame in seconds
 * @returns {number} The new interpolated value
 * 
 * @example
 * // In your update loop:
 * myValue = damp(myValue, targetValue, 5, deltaTime);
 */
export function damp(current, target, lambda, delta) {
    // Exponential decay formula for smooth, frame-rate independent motion
    // When delta is large (low FPS), we move more; when small (high FPS), we move less
    return current + (target - current) * (1 - Math.exp(-lambda * delta));
}

/**
 * Frame-rate independent damping for a THREE.Vector3
 * 
 * Smoothly animates a 3D vector toward a target position.
 * Perfect for: camera movement, object tracking, smooth repositioning
 * 
 * @param {THREE.Vector3} current - Current vector (will be modified!)
 * @param {THREE.Vector3} target - Target vector to move toward
 * @param {number} lambda - Speed factor (5-15 typical)
 * @param {number} delta - Time since last frame
 * @returns {THREE.Vector3} The modified current vector
 * 
 * @example
 * // Smooth camera follow:
 * dampVector3(camera.position, player.position.clone().add(offset), 8, delta);
 */
export function dampVector3(current, target, lambda, delta) {
    const factor = 1 - Math.exp(-lambda * delta);
    current.x += (target.x - current.x) * factor;
    current.y += (target.y - current.y) * factor;
    current.z += (target.z - current.z) * factor;
    return current;
}

/**
 * Frame-rate independent damping for Euler angles (rotation)
 * 
 * Smoothly animates rotation toward a target.
 * Note: For complex rotations, consider using dampQuaternion instead.
 * 
 * @param {THREE.Euler} current - Current rotation (will be modified!)
 * @param {THREE.Euler} target - Target rotation
 * @param {number} lambda - Speed factor
 * @param {number} delta - Time since last frame
 * @returns {THREE.Euler} The modified current rotation
 */
export function dampEuler(current, target, lambda, delta) {
    const factor = 1 - Math.exp(-lambda * delta);
    current.x += (target.x - current.x) * factor;
    current.y += (target.y - current.y) * factor;
    current.z += (target.z - current.z) * factor;
    return current;
}

/**
 * Frame-rate independent damping for a single angle with wrapping
 * 
 * Handles the tricky case where angles wrap around (e.g., -180° and 180° are the same).
 * Always takes the shortest path around the circle.
 * 
 * @param {number} current - Current angle in radians
 * @param {number} target - Target angle in radians
 * @param {number} lambda - Speed factor
 * @param {number} delta - Time since last frame
 * @returns {number} The new interpolated angle
 * 
 * @example
 * // Smooth turret rotation:
 * turret.rotation.y = dampAngle(turret.rotation.y, targetAngle, 10, delta);
 */
export function dampAngle(current, target, lambda, delta) {
    // Calculate angle difference and normalize to -PI to PI
    let diff = target - current;
    
    // Wrap to shortest path
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    
    // Apply damping to the difference
    const factor = 1 - Math.exp(-lambda * delta);
    return current + diff * factor;
}

/**
 * Frame-rate independent damping for a THREE.Color
 * 
 * Smoothly transitions between colors. Great for:
 * - Damage flash effects
 * - Day/night transitions
 * - UI feedback
 * 
 * @param {THREE.Color} current - Current color (will be modified!)
 * @param {THREE.Color} target - Target color
 * @param {number} lambda - Speed factor
 * @param {number} delta - Time since last frame
 * @returns {THREE.Color} The modified current color
 */
export function dampColor(current, target, lambda, delta) {
    const factor = 1 - Math.exp(-lambda * delta);
    current.r += (target.r - current.r) * factor;
    current.g += (target.g - current.g) * factor;
    current.b += (target.b - current.b) * factor;
    return current;
}

/**
 * Quadratic ease-out function
 * 
 * Starts fast, slows down at the end. Great for:
 * - UI elements appearing
 * - Objects coming to rest
 * 
 * @param {number} t - Progress (0 to 1)
 * @returns {number} Eased value (0 to 1)
 */
export function easeOutQuad(t) {
    return 1 - (1 - t) * (1 - t);
}

/**
 * Cubic ease-in-out function
 * 
 * Slow start, fast middle, slow end. The most "natural" feeling easing.
 * Great for: camera transitions, menu animations
 * 
 * @param {number} t - Progress (0 to 1)
 * @returns {number} Eased value (0 to 1)
 */
export function easeInOutCubic(t) {
    return t < 0.5
        ? 4 * t * t * t
        : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/**
 * Elastic ease-out function
 * 
 * Overshoots then bounces back. Great for:
 * - Bouncy UI elements
 * - Spring-like motion
 * - Score popups
 * 
 * @param {number} t - Progress (0 to 1)
 * @returns {number} Eased value (may exceed 0-1 range briefly)
 */
export function easeOutElastic(t) {
    const c4 = (2 * Math.PI) / 3;
    return t === 0
        ? 0
        : t === 1
        ? 1
        : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
}

/**
 * Bounce ease-out function
 * 
 * Bounces at the end like a ball. Great for:
 * - Objects landing
 * - Fun, playful animations
 * 
 * @param {number} t - Progress (0 to 1)
 * @returns {number} Eased value (0 to 1)
 */
export function easeOutBounce(t) {
    const n1 = 7.5625;
    const d1 = 2.75;
    
    if (t < 1 / d1) {
        return n1 * t * t;
    } else if (t < 2 / d1) {
        return n1 * (t -= 1.5 / d1) * t + 0.75;
    } else if (t < 2.5 / d1) {
        return n1 * (t -= 2.25 / d1) * t + 0.9375;
    } else {
        return n1 * (t -= 2.625 / d1) * t + 0.984375;
    }
}

/**
 * Linear interpolation between two values
 * 
 * The simplest interpolation - just a straight line from a to b.
 * 
 * @param {number} a - Start value
 * @param {number} b - End value
 * @param {number} t - Progress (0 to 1)
 * @returns {number} Interpolated value
 */
export function lerp(a, b, t) {
    return a + (b - a) * t;
}

/**
 * Clamp a value between min and max
 * 
 * @param {number} value - Value to clamp
 * @param {number} min - Minimum allowed value
 * @param {number} max - Maximum allowed value
 * @returns {number} Clamped value
 */
export function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

/**
 * Map a value from one range to another
 * 
 * @param {number} value - Input value
 * @param {number} inMin - Input range minimum
 * @param {number} inMax - Input range maximum
 * @param {number} outMin - Output range minimum
 * @param {number} outMax - Output range maximum
 * @returns {number} Mapped value
 * 
 * @example
 * // Convert 0-100 health to 0-1 for shader
 * mapRange(health, 0, 100, 0, 1);
 */
export function mapRange(value, inMin, inMax, outMin, outMax) {
    return ((value - inMin) * (outMax - outMin)) / (inMax - inMin) + outMin;
}
