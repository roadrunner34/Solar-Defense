/**
 * turret.js - Shared turret aiming
 *
 * The starbase and every deployable platform aim the same way: work out the
 * bearing to the target on the horizontal plane, rotate toward it with
 * frame-rate independent damping, and report whether the barrel is lined up
 * closely enough to fire.
 *
 * That logic lives here rather than being copied into each weapon, because the
 * fiddly part - wrapping the angle difference so the turret always swings the
 * short way round - is easy to get subtly wrong in one copy and not the other.
 */

import { dampAngle } from './mathUtils.js';

/**
 * How close the turret must be pointing before it will fire, in radians.
 * About 5 degrees.
 */
export const AIM_TOLERANCE_RADIANS = 0.087;

/**
 * Scales a weapon's configured rotationSpeed into a damping lambda.
 *
 * rotationSpeed is written in the config as "radians per second", which is how
 * a linear turret would work. Damping is exponential rather than linear, so the
 * value is scaled into a lambda that feels equivalent.
 */
const ROTATION_SPEED_TO_LAMBDA = 3;

/**
 * Rotate a turret toward a target and report whether it is aimed.
 *
 * Only the horizontal bearing is used - turrets rotate about Y only, so a
 * target's height does not affect the angle.
 *
 * @param {THREE.Object3D} turret - The rotating part of the weapon
 * @param {THREE.Vector3} originPosition - Where the weapon sits in the world
 * @param {THREE.Vector3} targetPosition - Where the target is
 * @param {number} rotationSpeed - Turn rate from the weapon's config
 * @param {number} deltaTime - Time since last frame in seconds
 * @returns {boolean} True if the turret is pointing at the target
 */
export function updateTurretAim(turret, originPosition, targetPosition, rotationSpeed, deltaTime) {
    if (!turret) return false;

    // Bearing to the target on the XZ plane. atan2(x, z) rather than the usual
    // atan2(z, x) because Three.js objects face down +Z, not +X.
    const targetAngle = Math.atan2(
        targetPosition.x - originPosition.x,
        targetPosition.z - originPosition.z
    );

    const lambda = rotationSpeed * ROTATION_SPEED_TO_LAMBDA;
    turret.rotation.y = dampAngle(turret.rotation.y, targetAngle, lambda, deltaTime);

    return isAimedAt(turret.rotation.y, targetAngle);
}

/**
 * Whether a turret angle is within firing tolerance of a target angle.
 *
 * Wraps the difference into -PI..PI first, so a turret at 179 degrees and a
 * target at -179 degrees count as 2 degrees apart rather than 358.
 *
 * @param {number} currentAngle - Turret's current Y rotation in radians
 * @param {number} targetAngle - Desired Y rotation in radians
 * @returns {boolean} True if within AIM_TOLERANCE_RADIANS
 */
export function isAimedAt(currentAngle, targetAngle) {
    let angleDiff = targetAngle - currentAngle;

    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

    return Math.abs(angleDiff) < AIM_TOLERANCE_RADIANS;
}
