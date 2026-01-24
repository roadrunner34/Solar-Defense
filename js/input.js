/**
 * input.js - Input Handling System
 * 
 * Manages all player input: mouse movement, clicks, and keyboard.
 * Keeps track of the current input state so other modules can check
 * "is the player pressing W?" or "where is the mouse?"
 * 
 * Why a separate module? Centralizing input handling makes it easier to:
 * 1. Add new controls
 * 2. Support key remapping
 * 3. Handle multiple input sources consistently
 */

import * as THREE from 'three';
import { camera } from './camera.js';
import { 
    placementState, 
    updatePlacementPreview, 
    confirmPlacement, 
    cancelPlacement,
    createPlacementPreview,
    removePlacementPreview
} from './platform.js';

// Current input state - other modules read this
export const inputState = {
    // Mouse
    mouseX: 0,           // Screen X position
    mouseY: 0,           // Screen Y position
    mouseNormalized: new THREE.Vector2(), // Normalized (-1 to 1)
    mouseDown: false,    // Is left mouse button held?
    rightMouseDown: false,
    
    // Keyboard state - which keys are currently held
    keys: {
        w: false,
        a: false,
        s: false,
        d: false,
        up: false,
        down: false,
        left: false,
        right: false,
        space: false,
        escape: false
    },
    
    // Processed rotation values (what starbase should rotate to)
    targetRotationY: 0,  // Horizontal aim
    targetRotationX: 0,  // Vertical aim
    
    // Click tracking for one-shot detection
    // (We need to know when a click JUST happened, not just if button is held)
    leftClickJustPressed: false,
    rightClickJustPressed: false
};

// Raycaster for mouse picking (clicking on 3D objects)
const raycaster = new THREE.Raycaster();

/**
 * Initialize input listeners
 * Call this once when the game starts
 */
export function initInput() {
    // Mouse move - track position for aiming
    window.addEventListener('mousemove', onMouseMove);
    
    // Mouse buttons
    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    
    // Keyboard
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    
    // Prevent context menu on right-click (we might use right-click in game)
    window.addEventListener('contextmenu', (e) => e.preventDefault());
}

/**
 * Handle mouse movement
 * Converts screen position to normalized coordinates and calculates aim direction
 */
function onMouseMove(event) {
    // Store raw screen position
    inputState.mouseX = event.clientX;
    inputState.mouseY = event.clientY;
    
    // Convert to normalized device coordinates (-1 to 1)
    // This is the format Three.js raycasting uses
    inputState.mouseNormalized.x = (event.clientX / window.innerWidth) * 2 - 1;
    inputState.mouseNormalized.y = -(event.clientY / window.innerHeight) * 2 + 1;
    
    // Calculate rotation for starbase aiming
    // Map mouse X position to rotation (further right = rotate right)
    inputState.targetRotationY = -inputState.mouseNormalized.x * Math.PI;
    
    // If in placement mode, update the preview position
    if (placementState.active) {
        updatePlacementPreviewPosition();
    }
}

/**
 * Handle mouse button press
 */
function onMouseDown(event) {
    if (event.button === 0) {
        inputState.mouseDown = true;
        inputState.leftClickJustPressed = true;
        
        // If in placement mode, try to place the platform
        if (placementState.active) {
            handlePlacementClick();
        }
    } else if (event.button === 2) {
        inputState.rightMouseDown = true;
        inputState.rightClickJustPressed = true;
        
        // Right-click cancels placement mode
        if (placementState.active) {
            cancelPlacement();
        }
    }
}

/**
 * Handle mouse button release
 */
function onMouseUp(event) {
    if (event.button === 0) {
        inputState.mouseDown = false;
    } else if (event.button === 2) {
        inputState.rightMouseDown = false;
    }
}

/**
 * Handle key press
 * Updates the keys object to track what's held down
 */
function onKeyDown(event) {
    const key = event.key.toLowerCase();
    
    switch (key) {
        case 'w':
            inputState.keys.w = true;
            break;
        case 'a':
            inputState.keys.a = true;
            break;
        case 's':
            inputState.keys.s = true;
            break;
        case 'd':
            inputState.keys.d = true;
            break;
        case 'arrowup':
            inputState.keys.up = true;
            break;
        case 'arrowdown':
            inputState.keys.down = true;
            break;
        case 'arrowleft':
            inputState.keys.left = true;
            break;
        case 'arrowright':
            inputState.keys.right = true;
            break;
        case ' ':
            inputState.keys.space = true;
            break;
        case 'escape':
            inputState.keys.escape = true;
            // ESC cancels placement mode
            if (placementState.active) {
                cancelPlacement();
            }
            break;
    }
}

/**
 * Handle key release
 */
function onKeyUp(event) {
    const key = event.key.toLowerCase();
    
    switch (key) {
        case 'w':
            inputState.keys.w = false;
            break;
        case 'a':
            inputState.keys.a = false;
            break;
        case 's':
            inputState.keys.s = false;
            break;
        case 'd':
            inputState.keys.d = false;
            break;
        case 'arrowup':
            inputState.keys.up = false;
            break;
        case 'arrowdown':
            inputState.keys.down = false;
            break;
        case 'arrowleft':
            inputState.keys.left = false;
            break;
        case 'arrowright':
            inputState.keys.right = false;
            break;
        case ' ':
            inputState.keys.space = false;
            break;
        case 'escape':
            inputState.keys.escape = false;
            break;
    }
}

/**
 * Get the rotation direction from keyboard input
 * @returns {number} -1, 0, or 1 for left, none, or right
 */
export function getKeyboardRotation() {
    let rotation = 0;
    
    if (inputState.keys.a || inputState.keys.left) {
        rotation += 1; // Rotate left (counter-clockwise)
    }
    if (inputState.keys.d || inputState.keys.right) {
        rotation -= 1; // Rotate right (clockwise)
    }
    
    return rotation;
}

/**
 * Cast a ray from mouse position into the scene
 * Used for clicking on objects or determining where mouse points in 3D
 * @param {THREE.Camera} cam - The camera to cast from
 * @returns {THREE.Raycaster} The raycaster ready for intersection tests
 */
export function getMouseRay(cam) {
    raycaster.setFromCamera(inputState.mouseNormalized, cam);
    return raycaster;
}

/**
 * Get the 3D point where the mouse intersects a plane
 * Useful for aiming at a specific height level
 * @param {THREE.Camera} cam - The camera
 * @param {number} planeHeight - The Y-height of the plane to intersect
 * @returns {THREE.Vector3|null} The intersection point, or null if no intersection
 */
export function getMouseWorldPosition(cam, planeHeight = 0) {
    raycaster.setFromCamera(inputState.mouseNormalized, cam);
    
    // Create a horizontal plane at the specified height
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -planeHeight);
    const intersectPoint = new THREE.Vector3();
    
    // Find where the ray hits the plane
    const result = raycaster.ray.intersectPlane(plane, intersectPoint);
    
    return result;
}

/**
 * Check if a key was just pressed (for one-time actions)
 * Note: For this to work properly, you'd need to track previous state
 * For now, returns current state - can be enhanced later
 */
export function isKeyJustPressed(key) {
    return inputState.keys[key];
}

/**
 * Clean up input listeners
 * Call this when leaving the game
 */
export function cleanupInput() {
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mousedown', onMouseDown);
    window.removeEventListener('mouseup', onMouseUp);
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
}

// ==================== PLACEMENT INPUT HANDLING ====================

/**
 * Updates the placement preview position based on mouse position.
 * 
 * This uses raycasting to find where the mouse points on the game plane.
 * The game plane is at Y=0 (the orbital plane where platforms are placed).
 */
function updatePlacementPreviewPosition() {
    // Get the 3D position where mouse intersects the game plane
    const worldPosition = getMouseWorldPosition(camera, 0);
    
    if (worldPosition) {
        // Update the preview position
        updatePlacementPreview(worldPosition);
    }
}

/**
 * Handles a click during placement mode.
 * 
 * This attempts to place the platform at the current preview position.
 */
function handlePlacementClick() {
    // Try to confirm the placement
    const platform = confirmPlacement();
    
    if (platform) {
        console.log(`Platform placed successfully: ${platform.type}`);
        // Platform was placed - preview is automatically removed
    } else {
        console.log('Placement failed - invalid position');
        // Placement failed - preview stays so player can try again
    }
}

/**
 * Enters placement mode for a specific platform type.
 * 
 * This is called from the UI when the player selects a platform to build.
 * 
 * @param {string} platformType - The type of platform to place ('laserBattery' or 'missileLauncher')
 */
export function enterPlacementMode(platformType) {
    // Create the placement preview
    createPlacementPreview(platformType);
    
    // Update preview position immediately based on current mouse position
    updatePlacementPreviewPosition();
    
    console.log(`Entered placement mode for: ${platformType}`);
}

/**
 * Exits placement mode without placing a platform.
 * 
 * This is called when the player presses ESC or clicks cancel.
 */
export function exitPlacementMode() {
    cancelPlacement();
    console.log('Exited placement mode');
}

/**
 * Clears the "just pressed" flags.
 * 
 * This should be called at the end of each frame to reset the one-shot
 * click detection. Without this, a single click would be detected multiple times.
 */
export function clearInputFlags() {
    inputState.leftClickJustPressed = false;
    inputState.rightClickJustPressed = false;
}

/**
 * Checks if the player is currently in placement mode.
 * 
 * @returns {boolean} True if in placement mode
 */
export function isInPlacementMode() {
    return placementState.active;
}
