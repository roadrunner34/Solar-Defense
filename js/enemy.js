// Enemy types and their properties
const ENEMY_TYPES = {
    FIGHTER: {
        health: 100,
        armor: 1,
        credits: 5,
        speed: 2,
        size: 15,
        color: 0xff0000
        //shape: Small triangle
    },
    BOMBER: {
        health: 100,
        armor: 5,
        credits: 10,
        speed: 1.5,
        size: 20,
        color: 0xff6600
        //Shape: small triangle 20% taller than the fighter, but more wide, like a scalene triangle
    },
    DESTROYER: {
        health: 200,
        armor: 10,
        credits: 20,
        speed: 1,
        size: 25,
        color: 0xff0066
        //Shape: small trianle, same size as a fighter, witha  square attached to the back of it.  The square is 
    },
    BATTLESHIP: {
        health: 300,
        armor: 20,
        credits: 30,
        speed: 0.8,
        size: 30,
        color: 0x660066
    },
    DREADNOUGHT: {
        health: 400,
        armor: 30,
        credits: 40,
        speed: 0.6,
        size: 35,
        color: 0x000066
    }
};

class Enemy {
    constructor(game, type, path) {
        this.game = game;
        this.type = type;
        this.properties = ENEMY_TYPES[type];
        this.path = path;
        this.currentPathIndex = 0;
        this.health = this.properties.health;
        this.armor = this.properties.armor;
        
        // Create enemy mesh based on type
        this.createShipMesh();
        
        // Set initial position with z=0 to be visible
        this.mesh.position.set(this.path[0].x, this.path[0].y, 0);
        this.game.scene.add(this.mesh);
        
        // Add to game objects
        this.game.gameObjects.push(this);
        this.game.enemies.push(this);
    }

    createShipMesh() {
        this.mesh = new THREE.Group();
        
        switch(this.type) {
            case 'FIGHTER':
                this.createFighter();
                break;
            case 'BOMBER':
                this.createBomber();
                break;
            case 'DESTROYER':
                this.createDestroyer();
                break;
            case 'BATTLESHIP':
                this.createBattleship();
                break;
            case 'DREADNOUGHT':
                this.createDreadnought();
                break;
        }
    }

    createFighter() {
        // Create a sleek, triangular fighter
        const bodyGeometry = new THREE.BufferGeometry();
        const vertices = new Float32Array([
            0, this.properties.size, 0,  // Nose
            -this.properties.size/2, -this.properties.size/2, 0,  // Left wing
            this.properties.size/2, -this.properties.size/2, 0   // Right wing
        ]);
        bodyGeometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
        
        const bodyMaterial = new THREE.MeshBasicMaterial({
            color: this.properties.color,
            transparent: true,
            opacity: 0.8
        });
        
        const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        this.mesh.add(body);

        // Add engine glow
        const engineGlow = new THREE.CircleGeometry(this.properties.size/4, 16);
        const glowMaterial = new THREE.MeshBasicMaterial({
            color: 0xffaa00,
            transparent: true,
            opacity: 0.6
        });
        const glow = new THREE.Mesh(engineGlow, glowMaterial);
        glow.position.y = -this.properties.size/2;
        this.mesh.add(glow);
    }

    createBomber() {
        // Create a wider, more substantial bomber
        const bodyGeometry = new THREE.BufferGeometry();
        const vertices = new Float32Array([
            0, this.properties.size/2, 0,  // Nose
            -this.properties.size, -this.properties.size/2, 0,  // Left wing
            this.properties.size, -this.properties.size/2, 0,   // Right wing
            -this.properties.size/2, this.properties.size/2, 0, // Left back
            this.properties.size/2, this.properties.size/2, 0   // Right back
        ]);
        bodyGeometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
        
        const bodyMaterial = new THREE.MeshBasicMaterial({
            color: this.properties.color,
            transparent: true,
            opacity: 0.8
        });
        
        const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        this.mesh.add(body);

        // Add bomb bay doors
        const bayGeometry = new THREE.BoxGeometry(this.properties.size/2, this.properties.size/3, 1);
        const bayMaterial = new THREE.MeshBasicMaterial({
            color: 0x333333,
            transparent: true,
            opacity: 0.9
        });
        const bay = new THREE.Mesh(bayGeometry, bayMaterial);
        bay.position.y = 0;
        this.mesh.add(bay);
    }

    createDestroyer() {
        // Create a hexagonal destroyer
        const bodyGeometry = new THREE.CircleGeometry(this.properties.size, 6);
        const bodyMaterial = new THREE.MeshBasicMaterial({
            color: this.properties.color,
            transparent: true,
            opacity: 0.8
        });
        
        const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        this.mesh.add(body);

        // Add weapon turrets
        for (let i = 0; i < 3; i++) {
            const angle = (i / 3) * Math.PI * 2;
            const turretGeometry = new THREE.CircleGeometry(this.properties.size/4, 16);
            const turretMaterial = new THREE.MeshBasicMaterial({
                color: 0x666666,
                transparent: true,
                opacity: 0.9
            });
            const turret = new THREE.Mesh(turretGeometry, turretMaterial);
            turret.position.x = Math.cos(angle) * this.properties.size * 0.7;
            turret.position.y = Math.sin(angle) * this.properties.size * 0.7;
            this.mesh.add(turret);
        }
    }

    createBattleship() {
        // Create a massive octagonal battleship
        const bodyGeometry = new THREE.CircleGeometry(this.properties.size, 8);
        const bodyMaterial = new THREE.MeshBasicMaterial({
            color: this.properties.color,
            transparent: true,
            opacity: 0.8
        });
        
        const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        this.mesh.add(body);

        // Add heavy weapon turrets
        for (let i = 0; i < 4; i++) {
            const angle = (i / 4) * Math.PI * 2;
            const turretGeometry = new THREE.CircleGeometry(this.properties.size/3, 16);
            const turretMaterial = new THREE.MeshBasicMaterial({
                color: 0x444444,
                transparent: true,
                opacity: 0.9
            });
            const turret = new THREE.Mesh(turretGeometry, turretMaterial);
            turret.position.x = Math.cos(angle) * this.properties.size * 0.8;
            turret.position.y = Math.sin(angle) * this.properties.size * 0.8;
            this.mesh.add(turret);
        }

        // Add central command tower
        const towerGeometry = new THREE.CircleGeometry(this.properties.size/4, 16);
        const towerMaterial = new THREE.MeshBasicMaterial({
            color: 0x888888,
            transparent: true,
            opacity: 0.9
        });
        const tower = new THREE.Mesh(towerGeometry, towerMaterial);
        this.mesh.add(tower);
    }

    createDreadnought() {
        // Create a massive decagonal dreadnought
        const bodyGeometry = new THREE.CircleGeometry(this.properties.size, 10);
        const bodyMaterial = new THREE.MeshBasicMaterial({
            color: this.properties.color,
            transparent: true,
            opacity: 0.8
        });
        
        const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        this.mesh.add(body);

        // Add massive weapon turrets
        for (let i = 0; i < 5; i++) {
            const angle = (i / 5) * Math.PI * 2;
            const turretGeometry = new THREE.CircleGeometry(this.properties.size/2.5, 16);
            const turretMaterial = new THREE.MeshBasicMaterial({
                color: 0x222222,
                transparent: true,
                opacity: 0.9
            });
            const turret = new THREE.Mesh(turretGeometry, turretMaterial);
            turret.position.x = Math.cos(angle) * this.properties.size * 0.9;
            turret.position.y = Math.sin(angle) * this.properties.size * 0.9;
            this.mesh.add(turret);
        }

        // Add central command structure
        const commandGeometry = new THREE.CircleGeometry(this.properties.size/3, 16);
        const commandMaterial = new THREE.MeshBasicMaterial({
            color: 0x666666,
            transparent: true,
            opacity: 0.9
        });
        const command = new THREE.Mesh(commandGeometry, commandMaterial);
        this.mesh.add(command);

        // Add shield effect
        const shieldGeometry = new THREE.CircleGeometry(this.properties.size * 1.1, 32);
        const shieldMaterial = new THREE.MeshBasicMaterial({
            color: 0x00ffff,
            transparent: true,
            opacity: 0.2
        });
        const shield = new THREE.Mesh(shieldGeometry, shieldMaterial);
        shield.position.z = -1;
        this.mesh.add(shield);
    }

    update() {
        if (this.currentPathIndex >= this.path.length - 1) {
            // Enemy reached the end of the path
            this.destroy();
            return;
        }

        // Move towards next path point
        const targetPoint = this.path[this.currentPathIndex + 1];
        const direction = new THREE.Vector3(
            targetPoint.x - this.mesh.position.x,
            targetPoint.y - this.mesh.position.y,
            0
        ).normalize();
        
        this.mesh.position.x += direction.x * this.properties.speed;
        this.mesh.position.y += direction.y * this.properties.speed;

        // Calculate rotation angle based on movement direction
        const angle = Math.atan2(direction.y, direction.x);
        this.mesh.rotation.z = angle - Math.PI / 2; // Subtract PI/2 to align with our ship designs

        // Check if reached current path point
        const distance = Math.sqrt(
            Math.pow(targetPoint.x - this.mesh.position.x, 2) +
            Math.pow(targetPoint.y - this.mesh.position.y, 2)
        );
        if (distance < 1) {
            this.currentPathIndex++;
        }
    }

    takeDamage(amount) {
        const damageAfterArmor = Math.max(0, amount - this.armor);
        this.health -= damageAfterArmor;
        
        if (this.health <= 0) {
            this.game.credits += this.properties.credits;
            this.destroy();
        }
    }

    destroy() {
        // Remove from scene and game objects
        this.game.scene.remove(this.mesh);
        const index = this.game.gameObjects.indexOf(this);
        if (index > -1) {
            this.game.gameObjects.splice(index, 1);
        }
        const enemyIndex = this.game.enemies.indexOf(this);
        if (enemyIndex > -1) {
            this.game.enemies.splice(enemyIndex, 1);
        }
    }
}

class EnemySpawner {
    constructor(game) {
        this.game = game;
        this.spawnPoints = this.generateSpawnPoints();
        this.paths = this.generatePaths();
        this.debugMode = false;
    }

    generateSpawnPoints() {
        const margin = 50; // Distance from screen edge
        return [
            // Left side
            new THREE.Vector2(-window.innerWidth/2 + margin, -window.innerHeight/2 + margin),
            new THREE.Vector2(-window.innerWidth/2 + margin, 0),
            new THREE.Vector2(-window.innerWidth/2 + margin, window.innerHeight/2 - margin),
            // Right side
            new THREE.Vector2(window.innerWidth/2 - margin, -window.innerHeight/2 + margin),
            new THREE.Vector2(window.innerWidth/2 - margin, 0),
            new THREE.Vector2(window.innerWidth/2 - margin, window.innerHeight/2 - margin),
            // Top side
            new THREE.Vector2(-window.innerWidth/2 + margin, window.innerHeight/2 - margin),
            new THREE.Vector2(0, window.innerHeight/2 - margin),
            new THREE.Vector2(window.innerWidth/2 - margin, window.innerHeight/2 - margin),
            // Bottom side
            new THREE.Vector2(-window.innerWidth/2 + margin, -window.innerHeight/2 + margin),
            new THREE.Vector2(0, -window.innerHeight/2 + margin),
            new THREE.Vector2(window.innerWidth/2 - margin, -window.innerHeight/2 + margin)
        ];
    }

    generatePaths() {
        const paths = [];
        const center = new THREE.Vector2(0, 0);
        
        // Generate paths from each spawn point to the center
        for (const spawnPoint of this.spawnPoints) {
            const path = [spawnPoint.clone()];
            
            // Add intermediate points for curved paths
            const numPoints = 3;
            for (let i = 1; i <= numPoints; i++) {
                const t = i / (numPoints + 1);
                const point = new THREE.Vector2()
                    .lerpVectors(spawnPoint, center, t);
                
                // Add some randomness to the path
                point.x += (Math.random() - 0.5) * 100;
                point.y += (Math.random() - 0.5) * 100;
                
                path.push(point);
            }
            
            path.push(center.clone());
            paths.push(path);
        }
        
        return paths;
    }

    spawnEnemy(type = 'FIGHTER') {
        // Randomly select a spawn point and path
        const pathIndex = Math.floor(Math.random() * this.paths.length);
        const path = this.paths[pathIndex];
        
        // Create new enemy
        const enemy = new Enemy(this.game, type, path);
        
        // Visualize path if debug mode is on
        if (this.debugMode) {
            this.visualizePath(path);
        }
        
        return enemy;
    }

    visualizePath(path) {
        const points = [];
        for (const point of path) {
            points.push(new THREE.Vector3(point.x, point.y, 0));
        }
        
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const material = new THREE.LineBasicMaterial({
            color: 0x00ff00,
            transparent: true,
            opacity: 0.3
        });
        
        const line = new THREE.Line(geometry, material);
        this.game.scene.add(line);
        
        // Remove the line after 5 seconds
        setTimeout(() => {
            this.game.scene.remove(line);
        }, 5000);
    }

    toggleDebugMode() {
        this.debugMode = !this.debugMode;
    }
} 