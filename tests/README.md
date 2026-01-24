# Tests Directory

This directory contains all test files for the Solar Defense game.

## Folder Structure

```
tests/
├── config/              # Tests for configuration files
│   └── platform-config.test.js
└── README.md            # This file
```

## Running Tests

### Option 1: Using the Test HTML File
Open `test-platform-config.html` in your browser. Tests will run automatically.

### Option 2: Browser Console
1. Open the main game (`index.html`) in your browser
2. Open the browser console (F12)
3. Type: `runPlatformConfigTests()` and press Enter

## Adding New Tests

When adding new test files:
- Place them in the appropriate subdirectory (e.g., `config/`, `platforms/`, etc.)
- Follow the naming convention: `*.test.js`
- Export a test runner function (e.g., `runPlatformConfigTests()`)
- Make the function available globally for console access if needed

## Why Separate Test Files?

- **Separation of Concerns**: Production code stays clean and focused
- **Organization**: Easy to find and manage tests
- **Scalability**: As the project grows, tests are organized by feature
- **Maintainability**: Changes to tests don't affect production code
