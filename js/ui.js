// UI Management

class UI {
    constructor(game) {
        this.game = game;
        this.startScreen = document.getElementById('start-screen');
        this.levelCompleteScreen = document.getElementById('level-complete');
        this.gameOverScreen = document.getElementById('game-over');
        this.creditsElement = document.getElementById('credits-value');
        this.upgradeButtons = {};
        this.missileTargeting = document.getElementById('missile-targeting');
        this.targetSelection = document.getElementById('target-selection');
    }

    init() {
        // Initialize buttons
        this.initButtons();
        
        // Show start screen
        this.showStartScreen();
        
        // Initialize event listeners
        this.initEventListeners();
    }

    initButtons() {
        // Get all upgrade buttons
        this.upgradeButtons = {
            autoAim: document.getElementById('auto-aim'),
            cannonDamage: document.getElementById('cannon-damage'),
            cannonRange: document.getElementById('cannon-range'),
            missileLauncher: document.getElementById('missile-launcher'),
            missileDamage: document.getElementById('missile-damage'),
            missileRange: document.getElementById('missile-range'),
            missileTarget: document.getElementById('missile-target'),
            launchBay: document.getElementById('launch-bay')
        };
        
        // Add event listeners to buttons
        this.upgradeButtons.autoAim.addEventListener('click', () => this.purchaseUpgrade('autoAim'));
        this.upgradeButtons.cannonDamage.addEventListener('click', () => this.purchaseUpgrade('cannonDamage'));
        this.upgradeButtons.cannonRange.addEventListener('click', () => this.purchaseUpgrade('cannonRange'));
        this.upgradeButtons.missileLauncher.addEventListener('click', () => this.purchaseUpgrade('missileLauncher'));
        this.upgradeButtons.missileDamage.addEventListener('click', () => this.purchaseUpgrade('missileDamage'));
        this.upgradeButtons.missileRange.addEventListener('click', () => this.purchaseUpgrade('missileRange'));
        this.upgradeButtons.missileTarget.addEventListener('click', () => this.purchaseUpgrade('missileTarget'));
        this.upgradeButtons.launchBay.addEventListener('click', () => this.purchaseUpgrade('launchBay'));
        
        // Target selection change handler
        this.targetSelection.addEventListener('change', () => {
            CONFIG.upgrades.missileTarget.currentTarget = this.targetSelection.value;
        });
        
        // Start game button
        document.getElementById('start-game').addEventListener('click', () => {
            this.hideStartScreen();
            this.game.startGame();
        });
        
        // Next level button
        document.getElementById('next-level').addEventListener('click', () => {
            this.hideLevelCompleteScreen();
            this.game.startNextLevel();
        });
        
        // Restart game button
        document.getElementById('restart-game').addEventListener('click', () => {
            this.hideGameOverScreen();
            this.game.resetGame();
            this.game.startGame();
        });
    }

    initEventListeners() {
        // Keyboard controls
        document.addEventListener('keydown', (event) => {
            switch (event.key) {
                case 'ArrowLeft':
                case 'a':
                    this.game.rotateStarbaseLeft(true);
                    break;
                case 'ArrowRight':
                case 'd':
                    this.game.rotateStarbaseRight(true);
                    break;
            }
        });
        
        document.addEventListener('keyup', (event) => {
            switch (event.key) {
                case 'ArrowLeft':
                case 'a':
                    this.game.rotateStarbaseLeft(false);
                    break;
                case 'ArrowRight':
                case 'd':
                    this.game.rotateStarbaseRight(false);
                    break;
            }
        });
        
        // Mouse control for aiming
        if (this.game.canvas) {
            this.game.canvas.addEventListener('mousemove', (event) => {
                // Only handle mouse control if auto-aim is not enabled
                if (!CONFIG.upgrades.autoAim.acquired) {
                    const rect = this.game.canvas.getBoundingClientRect();
                    const mouseX = event.clientX - rect.left - rect.width / 2;
                    const mouseY = event.clientY - rect.top - rect.height / 2;
                    
                    // Calculate angle based on mouse position
                    const angle = Math.atan2(mouseY, mouseX);
                    this.game.setStarbaseTargetAngle(angle);
                }
            });
        }
    }

    updateCredits(amount) {
        this.creditsElement.textContent = amount;
        this.updateUpgradeButtonStates();
    }

    updateUpgradeButtonStates() {
        const credits = this.game.credits;
        
        // Update each button based on upgrade state and available credits
        for (const [key, button] of Object.entries(this.upgradeButtons)) {
            const upgrade = CONFIG.upgrades[key];
            const cost = upgrade.cost;
            
            // Gray out button if not enough credits
            button.disabled = credits < cost;
            
            // Gray out button if already acquired for boolean upgrades
            if (typeof upgrade.acquired !== 'undefined' && upgrade.acquired) {
                button.disabled = true;
                button.textContent = button.textContent.replace(/\(\d+\)/, '(Acquired)');
            }
            
            // Update level for upgrades with levels
            if (typeof upgrade.level !== 'undefined') {
                button.textContent = button.textContent.replace(
                    /^(.*?)(\s+\(.*\))$/,
                    `$1 Lvl ${upgrade.level}$2`
                );
            }
            
            // Handle dependencies
            if (key === 'missileDamage' || key === 'missileRange' || key === 'missileTarget') {
                button.disabled = !CONFIG.upgrades.missileLauncher.acquired || credits < cost;
            }
        }
        
        // Show/hide missile targeting UI
        if (CONFIG.upgrades.missileTarget.acquired) {
            this.missileTargeting.classList.remove('hidden');
        } else {
            this.missileTargeting.classList.add('hidden');
        }
    }

    purchaseUpgrade(upgradeKey) {
        const upgrade = CONFIG.upgrades[upgradeKey];
        const cost = upgrade.cost;
        
        // Check if enough credits
        if (this.game.credits < cost) {
            return;
        }
        
        // Process upgrade based on type
        switch (upgradeKey) {
            case 'autoAim':
                if (!upgrade.acquired) {
                    upgrade.acquired = true;
                    this.game.starbase.autoAim = true;
                    this.game.spendCredits(cost);
                }
                break;
                
            case 'cannonDamage':
                upgrade.level++;
                this.game.starbase.cannonDamage *= (1 + upgrade.percentIncrease);
                this.game.spendCredits(cost);
                break;
                
            case 'cannonRange':
                upgrade.level++;
                this.game.starbase.cannonRange += upgrade.rangeIncrease;
                this.game.spendCredits(cost);
                break;
                
            case 'missileLauncher':
                if (!upgrade.acquired) {
                    upgrade.acquired = true;
                    this.game.spendCredits(cost);
                }
                break;
                
            case 'missileDamage':
                if (CONFIG.upgrades.missileLauncher.acquired) {
                    upgrade.level++;
                    this.game.spendCredits(cost);
                }
                break;
                
            case 'missileRange':
                if (CONFIG.upgrades.missileLauncher.acquired) {
                    upgrade.level++;
                    this.game.spendCredits(cost);
                }
                break;
                
            case 'missileTarget':
                if (CONFIG.upgrades.missileLauncher.acquired && !upgrade.acquired) {
                    upgrade.acquired = true;
                    this.game.spendCredits(cost);
                }
                break;
                
            case 'launchBay':
                upgrade.count++;
                this.game.starbase.addLaunchBay();
                this.game.spendCredits(cost);
                break;
        }
        
        // Update UI
        this.updateUpgradeButtonStates();
    }

    showStartScreen() {
        this.startScreen.classList.remove('hidden');
        this.levelCompleteScreen.classList.add('hidden');
        this.gameOverScreen.classList.add('hidden');
    }

    hideStartScreen() {
        this.startScreen.classList.add('hidden');
    }

    showLevelCompleteScreen() {
        this.levelCompleteScreen.classList.remove('hidden');
    }

    hideLevelCompleteScreen() {
        this.levelCompleteScreen.classList.add('hidden');
    }

    showGameOverScreen() {
        this.gameOverScreen.classList.remove('hidden');
    }

    hideGameOverScreen() {
        this.gameOverScreen.classList.add('hidden');
    }
} 