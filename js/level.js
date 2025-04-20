// Level Management

class Level {
    constructor(game, levelNumber) {
        this.game = game;
        this.levelNumber = levelNumber || 1;
        this.levelConfig = CONFIG.levels[this.levelNumber - 1];
        this.enemyQueue = [];
        this.remainingEnemies = 0;
        this.isComplete = false;
        this.spawnInterval = null;
        this.spawnDelay = 2; // Seconds between enemy spawns
        this.elapsedTime = 0;
        this.nextSpawnTime = 0;
    }

    init() {
        // Clear any existing enemies and prepare for new level
        this.game.clearEnemies();
        this.prepareEnemyQueue();
        this.updateUI();
    }

    prepareEnemyQueue() {
        this.enemyQueue = [];
        let totalEnemies = 0;
        
        // Create queue based on level configuration
        this.levelConfig.enemies.forEach(enemyConfig => {
            for (let i = 0; i < enemyConfig.count; i++) {
                this.enemyQueue.push(enemyConfig.type);
                totalEnemies++;
            }
        });
        
        // Shuffle the queue for more varied spawning
        this.shuffleArray(this.enemyQueue);
        
        this.remainingEnemies = totalEnemies;
        this.isComplete = false;
    }

    shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
    }

    update(deltaTime) {
        if (this.isComplete) return;
        
        this.elapsedTime += deltaTime;
        
        // Spawn enemies at regular intervals
        if (this.elapsedTime >= this.nextSpawnTime && this.enemyQueue.length > 0) {
            this.spawnEnemy();
            this.nextSpawnTime = this.elapsedTime + this.spawnDelay;
        }
        
        // Check if level is complete (no more enemies to spawn and no active enemies)
        if (this.enemyQueue.length === 0 && this.game.enemies.length === 0) {
            this.isComplete = true;
            this.game.onLevelComplete();
        }
    }

    spawnEnemy() {
        if (this.enemyQueue.length === 0) return;
        
        // Get the next enemy type from queue
        const enemyType = this.enemyQueue.pop();
        
        // Calculate spawn position (random point on spawn circle)
        const angle = Math.random() * Math.PI * 2;
        const x = Math.cos(angle) * CONFIG.world.spawnRadius;
        const z = Math.sin(angle) * CONFIG.world.spawnRadius;
        const position = new THREE.Vector3(x, 0, z);
        
        // Create the enemy
        const enemy = new Enemy(this.game.scene, enemyType, position, this.game);
        enemy.init();
        this.game.enemies.push(enemy);
        
        // Update UI
        this.updateUI();
    }

    updateUI() {
        // Update remaining enemy count
        document.getElementById('enemies-value').textContent = this.remainingEnemies;
        
        // Update level display
        document.getElementById('level-value').textContent = this.levelNumber;
    }

    onEnemyDestroyed() {
        this.remainingEnemies--;
        this.updateUI();
    }

    nextLevel() {
        const nextLevelNumber = this.levelNumber + 1;
        
        // Check if there's a next level
        if (nextLevelNumber <= CONFIG.levels.length) {
            return new Level(this.game, nextLevelNumber);
        }
        
        // No more levels, game is won
        return null;
    }
} 