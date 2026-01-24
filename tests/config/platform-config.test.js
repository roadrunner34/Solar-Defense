/**
 * platform-config.test.js - Tests for Platform Configuration
 * 
 * This test file verifies that Task 1.1 is completed correctly:
 * - Platform configuration exists in CONFIG
 * - Laser Battery and Missile Launcher stats are correct
 * - getPlatformConfig() helper function works properly
 * 
 * Why separate test files?
 * - Keeps production code clean (config.js only has config, not tests)
 * - Makes it easier to find and run tests
 * - Allows organizing tests by feature/module
 * - Can add more test files as the project grows
 */

import { CONFIG, getPlatformConfig } from '../../js/config.js';

/**
 * Test suite for platform configuration
 * Run these tests to verify Task 1.1 is completed correctly
 * @returns {boolean} True if all tests pass, false otherwise
 */
export function runPlatformConfigTests() {
    const tests = [];
    let passed = 0;
    let failed = 0;

    // Test 1: Platforms section exists
    try {
        if (!CONFIG.platforms) {
            throw new Error('CONFIG.platforms does not exist');
        }
        tests.push({ name: 'Platforms section exists', passed: true });
        passed++;
    } catch (error) {
        tests.push({ name: 'Platforms section exists', passed: false, error: error.message });
        failed++;
    }

    // Test 2: Laser Battery config exists and has correct stats
    try {
        const laserBattery = CONFIG.platforms.laserBattery;
        if (!laserBattery) {
            throw new Error('laserBattery config does not exist');
        }
        if (laserBattery.damage !== 20) {
            throw new Error(`Expected damage 20, got ${laserBattery.damage}`);
        }
        if (laserBattery.range !== 80) {
            throw new Error(`Expected range 80, got ${laserBattery.range}`);
        }
        if (laserBattery.fireRate !== 1.2) {
            throw new Error(`Expected fireRate 1.2, got ${laserBattery.fireRate}`);
        }
        if (laserBattery.cost !== 50) {
            throw new Error(`Expected cost 50, got ${laserBattery.cost}`);
        }
        tests.push({ name: 'Laser Battery has correct stats', passed: true });
        passed++;
    } catch (error) {
        tests.push({ name: 'Laser Battery has correct stats', passed: false, error: error.message });
        failed++;
    }

    // Test 3: Missile Launcher config exists and has correct stats
    try {
        const missileLauncher = CONFIG.platforms.missileLauncher;
        if (!missileLauncher) {
            throw new Error('missileLauncher config does not exist');
        }
        if (missileLauncher.damage !== 40) {
            throw new Error(`Expected damage 40, got ${missileLauncher.damage}`);
        }
        if (missileLauncher.range !== 100) {
            throw new Error(`Expected range 100, got ${missileLauncher.range}`);
        }
        if (missileLauncher.fireRate !== 0.8) {
            throw new Error(`Expected fireRate 0.8, got ${missileLauncher.fireRate}`);
        }
        if (missileLauncher.cost !== 100) {
            throw new Error(`Expected cost 100, got ${missileLauncher.cost}`);
        }
        tests.push({ name: 'Missile Launcher has correct stats', passed: true });
        passed++;
    } catch (error) {
        tests.push({ name: 'Missile Launcher has correct stats', passed: false, error: error.message });
        failed++;
    }

    // Test 4: getPlatformConfig() returns correct config for laserBattery
    try {
        const config = getPlatformConfig('laserBattery');
        if (!config || config.damage !== 20) {
            throw new Error('getPlatformConfig("laserBattery") did not return correct config');
        }
        tests.push({ name: 'getPlatformConfig() returns laserBattery config', passed: true });
        passed++;
    } catch (error) {
        tests.push({ name: 'getPlatformConfig() returns laserBattery config', passed: false, error: error.message });
        failed++;
    }

    // Test 5: getPlatformConfig() returns correct config for missileLauncher
    try {
        const config = getPlatformConfig('missileLauncher');
        if (!config || config.damage !== 40) {
            throw new Error('getPlatformConfig("missileLauncher") did not return correct config');
        }
        tests.push({ name: 'getPlatformConfig() returns missileLauncher config', passed: true });
        passed++;
    } catch (error) {
        tests.push({ name: 'getPlatformConfig() returns missileLauncher config', passed: false, error: error.message });
        failed++;
    }

    // Test 6: getPlatformConfig() defaults to laserBattery for invalid type
    try {
        const config = getPlatformConfig('invalidType');
        if (!config || config.damage !== 20) {
            throw new Error('getPlatformConfig() should default to laserBattery for invalid types');
        }
        tests.push({ name: 'getPlatformConfig() defaults to laserBattery for invalid type', passed: true });
        passed++;
    } catch (error) {
        tests.push({ name: 'getPlatformConfig() defaults to laserBattery for invalid type', passed: false, error: error.message });
        failed++;
    }

    // Print test results
    console.log('\n=== Platform Configuration Tests (Task 1.1) ===');
    tests.forEach(test => {
        const status = test.passed ? '✓ PASS' : '✗ FAIL';
        console.log(`${status}: ${test.name}`);
        if (!test.passed && test.error) {
            console.log(`  Error: ${test.error}`);
        }
    });
    console.log(`\nResults: ${passed} passed, ${failed} failed, ${tests.length} total`);
    
    if (failed === 0) {
        console.log('✓ All tests passed! Task 1.1 is complete.\n');
        return true;
    } else {
        console.log('✗ Some tests failed. Please review the errors above.\n');
        return false;
    }
}

// Make it available globally for easy testing in browser console
if (typeof window !== 'undefined') {
    window.runPlatformConfigTests = runPlatformConfigTests;
}
