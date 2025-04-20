# Solar Defense
 A Solar system tower defense game
This is a browser game built with Three.js.
You control a starbase and need to defend the planet it orbits from alien invaders.

Each level will face more and more difficult enemies..

# Gameplay
Killing enemies will give you credits to spend on upgrades.  User controls a starbase with a laser cannon to shoot the incoming alien ships. The user at this point will have to manually roate the starbase to fire at the enemy.  The starbase will auto fire at a rate of 1 shot per second.  They user can use the mouse or keyboard to rotate the cannon. there will be a starbase at the center of the screen that is your base.  

## Enemies
Enemies will spawn from the edge of the screen and move towards the center of the screen.  They will have a set path and speed.  They will also have a set amount of health and armor and give a set amount of credits. 

The following is the list of enemies in increasing order of difficulty:

    Fighters: 100 health, 1 armor, 5 credits
    Bombers: 100 health, 5 armor, 10 credits
    Destroyers: 200 health, 10 armor, 20 credits
    Battleships: 300 health, 20 armor, 30 credits
    Dreadnoughts: 400 health, 30 armor, 40 credits
    Carriers: 400 health, 30 armor, 25 Credits, spawns 2 fighters a second until destroyed
    Super Dreadnoughts: 500 health, 40 armor, 50 credits
    Super Carriers: 500 health, 40 armor, 25 credits, spawns 4 fighters and 1 bomber a second until destroyed

## Levels
Level 1:
Enemies: Fighters x 10

Level 2: Fighters x 10, bombers x2

Level 3: Fighters x 20, bombers x5

Level 4: Fighters x 20, bombers x10

Level 5: Fighters x 20, bombers x10, destroyers x1


## Upgrades:
- Auto cannon aiming: Will automatically rotate the cannon to face the closest enemy.  Cost: 100 Credits
- Cannon damage boost: Increases the damamge of the cannon by 5% for each upgrade. Cost: 25 Credits.
- Cannon range boost: Increases the range of the cannon by 5 for each upgrade. Cost: 25 Credits.
- Missile Launcher: Will auto fire a missile at the closest enemy. cost: 100 Credits
- Missile damage boost: Increases the damamge of the missile by 5% for each upgrade. Cost: 25 Credits.
- Missile range boost: Increases the range of the missile by 5 for each upgrade. Cost: 25 Credits.
- Missile target change: Allows the user to change prioritization of the missile target. Cost: 100 Credits. Can be set to Closest (defauld), highest health, farthest, highest armor, or lowest armor.  it will continue to fire at the same target until destroyed.
- Launch Bays: Allows the user to build launch bays to launch their own fighters. Cost: 100 Credits.  Will launch 1 fighter every 5 seconds, and will not launch a second fighter until the first has been destroyed and the timer has reset.  For example, the fighter could be destroyed within 2 seconds of launching, but the timer still has 3 seconds left on the countdown.  


