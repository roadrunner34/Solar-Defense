/**
 * path.js - Enemy Path System
 * 
 * Defines the routes enemies travel along to reach the planet.
 * We use a series of waypoints (3D points) and interpolate between them
 * so enemies move smoothly along curved paths.
 * 
 * Key concepts:
 * - Waypoints: Specific points the path passes through
 * - Interpolation: Calculating positions between waypoints for smooth movement
 * - Multiple paths: Different routes for variety (in later sprints)
 */

import * as THREE from 'three';
import { CONFIG } from './config.js';
import { scene } from './scene.js';

// Store path data
const paths = {};
let pathVisuals = []; // Visual representation of paths (for debugging)

/**
 * Initialize the path system
 * Creates the default paths enemies will follow
 */
export function initPaths() {
    // Create the default path - a spiral approach to the planet
    createPath('default', generateDefaultPath());
    
    // Create additional paths for variety
    createPath('leftFlank', generateLeftFlankPath());
    createPath('rightFlank', generateRightFlankPath());
}

/**
 * Generates the default approach path
 * Enemies come from far away and spiral inward toward the planet
 * @returns {Array<THREE.Vector3>} Array of waypoints
 */
function generateDefaultPath() {
    const waypoints = [];
    const spawnDistance = CONFIG.path.spawnDistance;
    
    // Start far away (top-right)
    waypoints.push(new THREE.Vector3(spawnDistance, 10, spawnDistance * 0.7));
    
    // Curve around through space
    waypoints.push(new THREE.Vector3(spawnDistance * 0.5, 5, spawnDistance * 0.3));
    waypoints.push(new THREE.Vector3(20, 2, 25));
    waypoints.push(new THREE.Vector3(-10, 0, 20));
    waypoints.push(new THREE.Vector3(-15, -2, 5));
    waypoints.push(new THREE.Vector3(-5, 0, -10));
    waypoints.push(new THREE.Vector3(10, 0, -5));
    
    // Final approach to planet center
    waypoints.push(new THREE.Vector3(5, 0, 2));
    waypoints.push(new THREE.Vector3(0, 0, 0)); // Planet center
    
    return waypoints;
}

/**
 * Generates a left flank approach path
 * @returns {Array<THREE.Vector3>} Array of waypoints
 */
function generateLeftFlankPath() {
    const waypoints = [];
    const spawnDistance = CONFIG.path.spawnDistance;
    
    // Start from the left
    waypoints.push(new THREE.Vector3(-spawnDistance, 5, spawnDistance * 0.5));
    waypoints.push(new THREE.Vector3(-spawnDistance * 0.6, 3, 30));
    waypoints.push(new THREE.Vector3(-30, 0, 15));
    waypoints.push(new THREE.Vector3(-20, -2, 0));
    waypoints.push(new THREE.Vector3(-10, 0, -5));
    waypoints.push(new THREE.Vector3(0, 0, 0));
    
    return waypoints;
}

/**
 * Generates a right flank approach path
 * @returns {Array<THREE.Vector3>} Array of waypoints
 */
function generateRightFlankPath() {
    const waypoints = [];
    const spawnDistance = CONFIG.path.spawnDistance;
    
    // Start from the right
    waypoints.push(new THREE.Vector3(spawnDistance, 5, -spawnDistance * 0.5));
    waypoints.push(new THREE.Vector3(spawnDistance * 0.6, 3, -30));
    waypoints.push(new THREE.Vector3(30, 0, -15));
    waypoints.push(new THREE.Vector3(20, -2, 0));
    waypoints.push(new THREE.Vector3(10, 0, 5));
    waypoints.push(new THREE.Vector3(0, 0, 0));
    
    return waypoints;
}

/**
 * Creates a named path from waypoints
 * @param {string} name - Path identifier
 * @param {Array<THREE.Vector3>} waypoints - Points along the path
 */
function createPath(name, waypoints) {
    // Calculate total path length (used for progress calculation)
    let totalLength = 0;
    const segmentLengths = [];
    
    for (let i = 0; i < waypoints.length - 1; i++) {
        const length = waypoints[i].distanceTo(waypoints[i + 1]);
        segmentLengths.push(length);
        totalLength += length;
    }
    
    paths[name] = {
        waypoints,
        segmentLengths,
        totalLength
    };
}

/**
 * Get position along a path at a given progress (0 to 1)
 * Uses Catmull-Rom spline for smooth interpolation
 * 
 * @param {string} pathName - Which path to follow
 * @param {number} progress - Progress along path (0 = start, 1 = end)
 * @returns {THREE.Vector3} Position on the path
 */
export function getPositionOnPath(pathName, progress) {
    const path = paths[pathName] || paths['default'];
    const waypoints = path.waypoints;
    
    // Clamp progress to 0-1 range
    progress = Math.max(0, Math.min(1, progress));
    
    // Find which segment we're on
    const targetDistance = progress * path.totalLength;
    let accumulatedDistance = 0;
    let segmentIndex = 0;
    
    for (let i = 0; i < path.segmentLengths.length; i++) {
        if (accumulatedDistance + path.segmentLengths[i] >= targetDistance) {
            segmentIndex = i;
            break;
        }
        accumulatedDistance += path.segmentLengths[i];
        segmentIndex = i;
    }
    
    // Calculate progress within this segment
    const segmentProgress = (targetDistance - accumulatedDistance) / path.segmentLengths[segmentIndex];
    
    // Get the four points needed for Catmull-Rom interpolation
    // This creates smoother curves than simple linear interpolation
    const p0 = waypoints[Math.max(0, segmentIndex - 1)];
    const p1 = waypoints[segmentIndex];
    const p2 = waypoints[Math.min(waypoints.length - 1, segmentIndex + 1)];
    const p3 = waypoints[Math.min(waypoints.length - 1, segmentIndex + 2)];
    
    // Catmull-Rom interpolation
    return catmullRomInterpolation(p0, p1, p2, p3, segmentProgress);
}

/**
 * Catmull-Rom spline interpolation
 * Creates smooth curves through control points
 * 
 * @param {THREE.Vector3} p0 - Previous control point
 * @param {THREE.Vector3} p1 - Current segment start
 * @param {THREE.Vector3} p2 - Current segment end
 * @param {THREE.Vector3} p3 - Next control point
 * @param {number} t - Progress within segment (0-1)
 * @returns {THREE.Vector3} Interpolated position
 */
function catmullRomInterpolation(p0, p1, p2, p3, t) {
    const t2 = t * t;
    const t3 = t2 * t;
    
    const result = new THREE.Vector3();
    
    // Catmull-Rom formula
    result.x = 0.5 * (
        (2 * p1.x) +
        (-p0.x + p2.x) * t +
        (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
        (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3
    );
    
    result.y = 0.5 * (
        (2 * p1.y) +
        (-p0.y + p2.y) * t +
        (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
        (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3
    );
    
    result.z = 0.5 * (
        (2 * p1.z) +
        (-p0.z + p2.z) * t +
        (2 * p0.z - 5 * p1.z + 4 * p2.z - p3.z) * t2 +
        (-p0.z + 3 * p1.z - 3 * p2.z + p3.z) * t3
    );
    
    return result;
}

/**
 * Get the direction of movement at a point on the path
 * Useful for rotating enemies to face forward
 * 
 * @param {string} pathName - Which path
 * @param {number} progress - Progress along path (0-1)
 * @returns {THREE.Vector3} Normalized direction vector
 */
export function getDirectionOnPath(pathName, progress) {
    // Get positions slightly before and after to calculate direction
    const delta = 0.01;
    const posBefore = getPositionOnPath(pathName, Math.max(0, progress - delta));
    const posAfter = getPositionOnPath(pathName, Math.min(1, progress + delta));
    
    const direction = new THREE.Vector3().subVectors(posAfter, posBefore).normalize();
    return direction;
}

/**
 * Get the spawn position for a path
 * @param {string} pathName - Which path
 * @returns {THREE.Vector3} Starting position
 */
export function getPathSpawnPosition(pathName) {
    const path = paths[pathName] || paths['default'];
    return path.waypoints[0].clone();
}

/**
 * Get a random path name
 * @returns {string} Path name
 */
export function getRandomPathName() {
    const pathNames = Object.keys(paths);
    return pathNames[Math.floor(Math.random() * pathNames.length)];
}

/**
 * Toggle path visualization (for debugging)
 * @param {boolean} visible - Whether to show paths
 */
export function setPathsVisible(visible) {
    if (visible && pathVisuals.length === 0) {
        // Create visual representation of all paths
        Object.keys(paths).forEach(pathName => {
            createPathVisual(pathName);
        });
    } else if (!visible) {
        // Remove path visuals
        pathVisuals.forEach(visual => scene.remove(visual));
        pathVisuals = [];
    }
}

/**
 * Creates a visual representation of a path using a line
 * @param {string} pathName - Which path to visualize
 */
function createPathVisual(pathName) {
    const path = paths[pathName];
    if (!path) return;
    
    // Create points along the path for smooth visualization
    const points = [];
    const segments = 50;
    
    for (let i = 0; i <= segments; i++) {
        const progress = i / segments;
        points.push(getPositionOnPath(pathName, progress));
    }
    
    // Create line geometry
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({
        color: 0xff0000,
        opacity: 0.5,
        transparent: true
    });
    
    const line = new THREE.Line(geometry, material);
    scene.add(line);
    pathVisuals.push(line);
}

/**
 * Check if a position has reached the planet
 * @param {THREE.Vector3} position - Position to check
 * @returns {boolean} True if position is at/inside planet
 */
export function hasReachedPlanet(position) {
    const distance = position.length(); // Distance from center (0,0,0)
    return distance <= CONFIG.path.planetRadius;
}
