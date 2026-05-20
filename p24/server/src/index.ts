import { World } from './ecs/World';
import { Entity } from './ecs/Entity';
import { Position } from './components/Position';
import { Velocity } from './components/Velocity';
import { Health } from './components/Health';
import { Cargo } from './components/Cargo';
import { Render } from './components/Render';
import { StationCapture } from './components/Station';
import { MovementSystem } from './systems/MovementSystem';
import { CollisionSystem } from './systems/CollisionSystem';
import { MiningSystem } from './systems/MiningSystem';
import { CombatSystem } from './systems/CombatSystem';
import { CaptureSystem } from './systems/CaptureSystem';
import { AISystem } from './systems/AISystem';
import { FactionManager } from './managers/FactionManager';
import { WebSocketServer } from './network/WebSocketServer';

async function main() {
  console.log('Starting Space Sandbox Server...');
  
  const world = new World();
  const factionManager = new FactionManager(world);
  
  world.addSystem(new MovementSystem(world));
  world.addSystem(new CollisionSystem(world));
  world.addSystem(new MiningSystem(world));
  world.addSystem(new CombatSystem(world));
  world.addSystem(new CaptureSystem(world, factionManager));
  
  const aiSystem = new AISystem(world);
  world.addSystem(aiSystem);

  for (let i = 0; i < 20; i++) {
    const asteroid = new Entity();
    asteroid.addComponent(new Position(
      Math.random() * 2000 - 1000,
      Math.random() * 2000 - 1000,
      0,
      Math.random() * Math.PI * 2
    ));
    asteroid.addComponent(new Velocity());
    asteroid.addComponent(new Render('asteroid', '#8B7355', Math.random() * 30 + 20));
    asteroid.addComponent(new Health(100, 100, 0));
    
    const cargo = new Cargo(100);
    cargo.addItem('iron', Math.floor(Math.random() * 50 + 10));
    cargo.addItem('gold', Math.floor(Math.random() * 20));
    asteroid.addComponent(cargo);
    
    world.addEntity(asteroid);
  }

  for (let i = 0; i < 3; i++) {
    const station = new Entity();
    station.addComponent(new Position(
      (i - 1) * 800,
      0,
      0,
      0
    ));
    station.addComponent(new Velocity());
    station.addComponent(new Render('station', '#4488ff', 60));
    station.addComponent(new Health(1000, 1000, 200));
    station.addComponent(new StationCapture());
    world.addEntity(station);
  }

  const pirateCount = 5;
  aiSystem.spawnMultiplePirates(pirateCount, 0, 0, 800);
  
  const server = new WebSocketServer(3001, world, factionManager);
  
  console.log('WebSocket Server running on ws://localhost:3001');
  console.log('Faction War System initialized');
  console.log(`AI System initialized with ${pirateCount} pirate ships`);
  
  process.on('SIGINT', () => {
    console.log('Shutting down...');
    server.stop();
    process.exit(0);
  });
}

main().catch(console.error);
