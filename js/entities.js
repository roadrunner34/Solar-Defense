// Game entities

// Base Entity class
class Entity {
    constructor(scene, position, size, color) {
        this.scene = scene;
        this.position = position || new THREE.Vector3(0, 0, 0);
        this.size = size || 1;
        this.color = color || 0xffffff;
        this.mesh = null;
        this.isAlive = true;
    }

    init() {
        // To be implemented by subclasses
    }

    update(deltaTime) {
        // To be implemented by subclasses
    }

    destroy() {
        if (this.mesh && this.scene) {
            this.scene.remove(this.mesh);
        }
        this.isAlive = false;
    }

    distanceTo(entity) {
        return this.position.distanceTo(entity.position);
    }
}

// Starbase - Player controlled entity
class Starbase extends Entity {
    constructor(scene, game) {
        super(scene, new THREE.Vector3(CONFIG.world.starbaseOrbitRadius, 0, 0), CONFIG.starbase.radius, 0x3399ff);
        this.game = game;
        this.health = CONFIG.starbase.health;
        this.cannonDamage = CONFIG.starbase.cannonDamage;
        this.cannonRange = CONFIG.starbase.cannonRange;
        this.rotationSpeed = CONFIG.starbase.rotationSpeed;
        this.cannonCooldown = 0;
        this.missileCooldown = 0;
        this.angle = 0; // Angle around planet
        this.targetAngle = 0; // Angle to rotate toward
        this.autoAim = false;
        this.launchBays = [];
    }

    init() {
        // Create starbase mesh
        const geometry = new THREE.CylinderGeometry(this.size, this.size, this.size * 2, 8);
        const material = new THREE.MeshPhongMaterial({ color: this.color });
        this.mesh = new THREE.Mesh(geometry, material);
        
        // Create cannon
        const cannonGeometry = new THREE.BoxGeometry(this.size * 3, this.size / 2, this.size / 2);
        const cannonMaterial = new THREE.MeshPhongMaterial({ color: 0xcccccc });
        this.cannon = new THREE.Mesh(cannonGeometry, cannonMaterial);
        this.cannon.position.set(this.size * 1.5, 0, 0);
        
        this.mesh.add(this.cannon);
        this.mesh.position.copy(this.position);
        this.mesh.rotation.z = Math.PI / 2;
        
        this.scene.add(this.mesh);
    }

    update(deltaTime) {
        // Update cooldowns
        if (this.cannonCooldown > 0) {
            this.cannonCooldown -= deltaTime;
        }
        
        if (this.missileCooldown > 0 && CONFIG.upgrades.missileLauncher.acquired) {
            this.missileCooldown -= deltaTime;
        }
        
        // Update position based on orbit
        this.angle += 0.01 * deltaTime;
        this.position.x = Math.cos(this.angle) * CONFIG.world.starbaseOrbitRadius;
        this.position.z = Math.sin(this.angle) * CONFIG.world.starbaseOrbitRadius;
        this.mesh.position.copy(this.position);
        
        // Handle auto-aiming if enabled
        if (this.autoAim) {
            const closestEnemy = this.game.findClosestEnemy(this);
            if (closestEnemy) {
                const direction = new THREE.Vector3().subVectors(closestEnemy.position, this.position);
                this.targetAngle = Math.atan2(direction.z, direction.x);
            }
        }
        
        // Rotate toward target angle
        const worldRotation = this.mesh.getWorldQuaternion(new THREE.Quaternion());
        const currentAngle = Math.atan2(
            2 * (worldRotation.w * worldRotation.y + worldRotation.x * worldRotation.z),
            1 - 2 * (worldRotation.y * worldRotation.y + worldRotation.z * worldRotation.z)
        );
        
        let angleDiff = this.targetAngle - currentAngle;
        
        // Normalize angle difference
        if (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        if (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
        
        // Apply rotation
        if (Math.abs(angleDiff) > 0.01) {
            const rotationAmount = Math.sign(angleDiff) * Math.min(Math.abs(angleDiff), this.rotationSpeed * deltaTime);
            this.mesh.rotateY(rotationAmount);
        }
        
        // Auto-fire cannon
        if (this.cannonCooldown <= 0) {
            this.fireCannon();
        }
        
        // Auto-fire missile if acquired
        if (CONFIG.upgrades.missileLauncher.acquired && this.missileCooldown <= 0) {
            this.fireMissile();
        }
        
        // Update launch bays
        for (let i = 0; i < this.launchBays.length; i++) {
            this.launchBays[i].update(deltaTime);
        }
    }

    fireCannon() {
        // Create a laser projectile in the direction the cannon is facing
        const direction = new THREE.Vector3(1, 0, 0).applyQuaternion(this.cannon.getWorldQuaternion(new THREE.Quaternion()));
        const spawnPos = new THREE.Vector3().copy(this.position).add(direction.multiplyScalar(this.size * 2));
        
        const laser = new Laser(this.scene, spawnPos, direction, this.cannonDamage, this.cannonRange);
        laser.init();
        this.game.projectiles.push(laser);
        
        // Reset cooldown
        this.cannonCooldown = CONFIG.cannonFireRate;
    }

    fireMissile() {
        let target = null;
        
        // Find target based on current targeting mode
        if (CONFIG.upgrades.missileTarget.acquired) {
            const targetMode = CONFIG.upgrades.missileTarget.currentTarget;
            target = this.game.findEnemyByTargetMode(targetMode);
        } else {
            target = this.game.findClosestEnemy(this);
        }
        
        if (target) {
            const spawnPos = new THREE.Vector3().copy(this.position);
            const missile = new Missile(
                this.scene, 
                spawnPos, 
                target, 
                CONFIG.upgrades.missileLauncher.damage * (1 + CONFIG.upgrades.missileDamage.level * CONFIG.upgrades.missileDamage.percentIncrease),
                CONFIG.upgrades.missileLauncher.range + (CONFIG.upgrades.missileRange.level * CONFIG.upgrades.missileRange.rangeIncrease)
            );
            missile.init();
            this.game.projectiles.push(missile);
            
            // Reset cooldown
            this.missileCooldown = CONFIG.upgrades.missileLauncher.fireRate;
        }
    }

    addLaunchBay() {
        const launchBay = new LaunchBay(this.scene, this, this.game);
        launchBay.init();
        this.launchBays.push(launchBay);
    }

    takeDamage(amount) {
        this.health -= amount;
        if (this.health <= 0) {
            this.health = 0;
            this.isAlive = false;
            return true; // Starbase destroyed
        }
        return false;
    }
}

// Launch Bay for the starbase
class LaunchBay {
    constructor(scene, starbase, game) {
        this.scene = scene;
        this.starbase = starbase;
        this.game = game;
        this.launchTimer = 0;
        this.mesh = null;
        this.hasFighter = false;
    }

    init() {
        // Create launch bay mesh as a small attachment to the starbase
        const geometry = new THREE.BoxGeometry(2, 2, 2);
        const material = new THREE.MeshPhongMaterial({ color: 0x999999 });
        this.mesh = new THREE.Mesh(geometry, material);
        
        // Position randomly around the starbase
        const angle = Math.random() * Math.PI * 2;
        const xOffset = Math.cos(angle) * this.starbase.size * 1.2;
        const zOffset = Math.sin(angle) * this.starbase.size * 1.2;
        this.mesh.position.set(xOffset, this.starbase.size, zOffset);
        
        this.starbase.mesh.add(this.mesh);
    }

    update(deltaTime) {
        if (!this.hasFighter) {
            this.launchTimer += deltaTime;
            
            if (this.launchTimer >= CONFIG.upgrades.launchBay.launchRate) {
                this.launchFighter();
                this.launchTimer = 0;
                this.hasFighter = true;
            }
        }
    }

    launchFighter() {
        // Get world position of launch bay
        const worldPos = new THREE.Vector3();
        this.mesh.getWorldPosition(worldPos);
        
        // Create a friendly fighter
        const fighter = new FriendlyFighter(
            this.scene,
            worldPos,
            this.game,
            this
        );
        fighter.init();
        this.game.friendlyFighters.push(fighter);
    }

    onFighterDestroyed() {
        this.hasFighter = false;
    }
}

// Friendly Fighter launched from Starbase
class FriendlyFighter extends Entity {
    constructor(scene, position, game, launchBay) {
        super(scene, position, 2, 0x66ccff);
        this.game = game;
        this.launchBay = launchBay;
        this.health = CONFIG.upgrades.launchBay.fighterHealth;
        this.damage = CONFIG.upgrades.launchBay.fighterDamage;
        this.speed = CONFIG.upgrades.launchBay.fighterSpeed;
        this.target = null;
        this.cooldown = 0;
    }

    init() {
        // Create fighter mesh
        const geometry = new THREE.ConeGeometry(this.size, this.size * 2, 4);
        const material = new THREE.MeshPhongMaterial({ color: this.color });
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.position.copy(this.position);
        this.scene.add(this.mesh);
    }

    update(deltaTime) {
        // Find a target if we don't have one or our current one is dead
        if (!this.target || !this.target.isAlive) {
            this.target = this.game.findClosestEnemy(this);
            if (!this.target) {
                // No enemies, just fly around
                this.position.x += (Math.random() - 0.5) * this.speed * deltaTime;
                this.position.z += (Math.random() - 0.5) * this.speed * deltaTime;
                this.mesh.position.copy(this.position);
                return;
            }
        }
        
        // Move toward target
        const direction = new THREE.Vector3().subVectors(this.target.position, this.position).normalize();
        this.position.add(direction.multiplyScalar(this.speed * deltaTime));
        
        // Rotate to face target
        this.mesh.lookAt(this.target.position);
        
        // Update mesh position
        this.mesh.position.copy(this.position);
        
        // Attack if close enough
        const distance = this.distanceTo(this.target);
        if (distance < 10) {
            if (this.cooldown <= 0) {
                this.target.takeDamage(this.damage);
                this.cooldown = 1; // Attack once per second
            }
        }
        
        // Update cooldown
        if (this.cooldown > 0) {
            this.cooldown -= deltaTime;
        }
    }

    takeDamage(amount) {
        this.health -= amount;
        if (this.health <= 0) {
            this.destroy();
            this.launchBay.onFighterDestroyed();
            return true;
        }
        return false;
    }
}

// Enemy base class
class Enemy extends Entity {
    constructor(scene, type, position, game) {
        const enemyConfig = CONFIG.enemies[type];
        super(scene, position, enemyConfig.size, enemyConfig.color);
        this.type = type;
        this.game = game;
        this.health = enemyConfig.health;
        this.armor = enemyConfig.armor;
        this.speed = enemyConfig.speed;
        this.credits = enemyConfig.credits;
        this.spawnTimer = 0;
        
        // Carrier properties
        if (type === 'carrier' || type === 'superCarrier') {
            this.spawnRate = enemyConfig.spawnRate;
            this.spawnType = enemyConfig.spawnType;
            this.spawnCount = enemyConfig.spawnCount || 1;
            this.spawnTypes = enemyConfig.spawnTypes || null;
        }
    }

    init() {
        // Create enemy mesh - different shapes for different types
        let geometry;
        
        switch (this.type) {
            case 'fighter':
                geometry = new THREE.TetrahedronGeometry(this.size);
                break;
            case 'bomber':
                geometry = new THREE.OctahedronGeometry(this.size);
                break;
            case 'destroyer':
                geometry = new THREE.DodecahedronGeometry(this.size);
                break;
            case 'battleship':
                geometry = new THREE.BoxGeometry(this.size * 2, this.size, this.size);
                break;
            case 'dreadnought':
            case 'superDreadnought':
                geometry = new THREE.BoxGeometry(this.size * 3, this.size, this.size * 1.5);
                break;
            case 'carrier':
            case 'superCarrier':
                geometry = new THREE.CylinderGeometry(this.size, this.size, this.size * 2, 8);
                break;
            default:
                geometry = new THREE.SphereGeometry(this.size);
        }
        
        const material = new THREE.MeshPhongMaterial({ color: this.color });
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.position.copy(this.position);
        
        // Add health bar
        this.healthBar = this.createHealthBar();
        this.mesh.add(this.healthBar);
        
        this.scene.add(this.mesh);
    }

    createHealthBar() {
        const healthBarContainer = new THREE.Group();
        
        // Background bar
        const bgGeometry = new THREE.BoxGeometry(this.size * 2, 0.5, 0.2);
        const bgMaterial = new THREE.MeshBasicMaterial({ color: 0x333333 });
        const bgBar = new THREE.Mesh(bgGeometry, bgMaterial);
        
        // Health bar
        const healthGeometry = new THREE.BoxGeometry(this.size * 2, 0.5, 0.3);
        const healthMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
        this.healthBarMesh = new THREE.Mesh(healthGeometry, healthMaterial);
        
        // Position the health bar above the enemy
        healthBarContainer.position.set(0, this.size + 2, 0);
        healthBarContainer.add(bgBar);
        healthBarContainer.add(this.healthBarMesh);
        
        return healthBarContainer;
    }

    updateHealthBar() {
        const healthPercent = this.health / CONFIG.enemies[this.type].health;
        this.healthBarMesh.scale.x = Math.max(0.01, healthPercent);
        this.healthBarMesh.position.x = (1 - healthPercent) * this.size * -1;
        
        // Change color based on health
        if (healthPercent > 0.6) {
            this.healthBarMesh.material.color.setHex(0x00ff00); // Green
        } else if (healthPercent > 0.3) {
            this.healthBarMesh.material.color.setHex(0xffff00); // Yellow
        } else {
            this.healthBarMesh.material.color.setHex(0xff0000); // Red
        }
    }

    update(deltaTime) {
        // Move toward center (planet)
        const direction = new THREE.Vector3(0, 0, 0).sub(this.position).normalize();
        this.position.add(direction.multiplyScalar(this.speed * deltaTime));
        
        // Rotate to face center
        this.mesh.lookAt(0, 0, 0);
        
        // Update mesh position
        this.mesh.position.copy(this.position);
        
        // Update health bar
        this.updateHealthBar();
        
        // Make health bar face camera
        this.healthBar.lookAt(this.game.camera.position);
        
        // Carrier spawn logic
        if ((this.type === 'carrier' || this.type === 'superCarrier') && this.spawnRate) {
            this.spawnTimer += deltaTime;
            
            if (this.spawnTimer >= this.spawnRate) {
                this.spawnFighters();
                this.spawnTimer = 0;
            }
        }
        
        // Check if reached planet
        const distToCenter = this.position.length();
        if (distToCenter <= CONFIG.world.planetRadius) {
            // Enemy reached planet, deal damage to planet/game
            this.game.onPlanetHit();
            this.destroy();
        }
    }

    spawnFighters() {
        if (this.type === 'carrier') {
            // Spawn regular carrier fighters
            for (let i = 0; i < this.spawnCount; i++) {
                this.spawnEnemy(this.spawnType);
            }
        } else if (this.type === 'superCarrier') {
            // Spawn from mix of types for super carrier
            for (let i = 0; i < this.spawnTypes.length; i++) {
                this.spawnEnemy(this.spawnTypes[i]);
            }
        }
    }

    spawnEnemy(type) {
        // Spawn position is slightly offset from carrier
        const offset = new THREE.Vector3(
            (Math.random() - 0.5) * this.size * 2,
            0,
            (Math.random() - 0.5) * this.size * 2
        );
        const spawnPos = new THREE.Vector3().copy(this.position).add(offset);
        
        // Create the enemy
        const enemy = new Enemy(this.scene, type, spawnPos, this.game);
        enemy.init();
        this.game.enemies.push(enemy);
    }

    takeDamage(amount) {
        // Apply armor reduction
        const actualDamage = Math.max(1, amount - this.armor);
        this.health -= actualDamage;
        
        if (this.health <= 0) {
            this.destroy();
            this.game.addCredits(this.credits);
            return true; // Enemy destroyed
        }
        return false;
    }
}

// Laser projectile
class Laser extends Entity {
    constructor(scene, position, direction, damage, range) {
        super(scene, position, 0.5, 0xff0000);
        this.direction = direction;
        this.damage = damage;
        this.range = range;
        this.speed = 5;
        this.distanceTraveled = 0;
    }

    init() {
        // Create laser mesh
        const geometry = new THREE.BoxGeometry(4, 0.5, 0.5);
        const material = new THREE.MeshBasicMaterial({ color: this.color });
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.position.copy(this.position);
        
        // Rotate to face direction
        this.mesh.lookAt(this.position.clone().add(this.direction));
        
        this.scene.add(this.mesh);
    }

    update(deltaTime) {
        // Move in direction
        const moveAmount = this.speed * deltaTime;
        this.position.add(this.direction.clone().multiplyScalar(moveAmount));
        this.distanceTraveled += moveAmount;
        
        // Update mesh position
        this.mesh.position.copy(this.position);
        
        // Check if exceeded range
        if (this.distanceTraveled >= this.range) {
            this.destroy();
        }
    }
}

// Missile projectile
class Missile extends Entity {
    constructor(scene, position, target, damage, range) {
        super(scene, position, 1, 0xff9900);
        this.target = target;
        this.damage = damage;
        this.range = range;
        this.speed = 3;
        this.distanceTraveled = 0;
        this.initialPosition = position.clone();
    }

    init() {
        // Create missile mesh
        const geometry = new THREE.ConeGeometry(this.size, this.size * 3, 8);
        const material = new THREE.MeshPhongMaterial({ color: this.color });
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.position.copy(this.position);
        
        // Add thruster effect
        const thrusterGeometry = new THREE.CylinderGeometry(0.3, 0.1, 2, 8);
        const thrusterMaterial = new THREE.MeshBasicMaterial({ color: 0x3399ff });
        this.thruster = new THREE.Mesh(thrusterGeometry, thrusterMaterial);
        this.thruster.position.set(0, -this.size * 2, 0);
        this.mesh.add(this.thruster);
        
        this.scene.add(this.mesh);
    }

    update(deltaTime) {
        // If target is destroyed, fly straight
        if (!this.target || !this.target.isAlive) {
            const direction = this.mesh.getWorldDirection(new THREE.Vector3());
            this.position.add(direction.multiplyScalar(-this.speed * deltaTime)); // Negative because cone points in -Y
            this.distanceTraveled += this.speed * deltaTime;
        } else {
            // Home in on target
            const direction = new THREE.Vector3().subVectors(this.target.position, this.position).normalize();
            this.position.add(direction.multiplyScalar(this.speed * deltaTime));
            
            // Rotate to face target
            this.mesh.lookAt(this.target.position);
            this.mesh.rotateX(Math.PI / 2); // Adjust for cone geometry
            
            // Calculate distance traveled (approximate)
            this.distanceTraveled = this.initialPosition.distanceTo(this.position);
            
            // Check if hit target
            if (this.position.distanceTo(this.target.position) < this.target.size + this.size) {
                this.target.takeDamage(this.damage);
                this.destroy();
                return;
            }
        }
        
        // Update mesh position
        this.mesh.position.copy(this.position);
        
        // Check if exceeded range
        if (this.distanceTraveled >= this.range) {
            this.destroy();
        }
    }
} 