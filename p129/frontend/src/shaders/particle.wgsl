struct Particle {
  position: vec3<f32>,
  velocity: vec3<f32>,
  state: u32,
  energy: f32,
  age: f32,
  maxAge: f32,
  padding: vec2<f32>,
}

struct Uniforms {
  deltaTime: f32,
  boundarySize: f32,
  speed: f32,
  particleCount: u32,
  energyDecayRate: f32,
  sleepThreshold: f32,
  wakeThreshold: f32,
  time: f32,
  terrainInfluence: f32,
  energyFieldStrength: f32,
}

@group(0) @binding(0) var<storage, read_write> particles: array<Particle>;
@group(0) @binding(1) var<uniform> uniforms: Uniforms;

fn hash(p: vec3<f32>) -> f32 {
  var p3 = fract(p * 0.1031);
  p3 = p3 + dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

fn noise3D(p: vec3<f32>) -> f32 {
  let i = floor(p);
  let f = fract(p);
  let u = f * f * (3.0 - 2.0 * f);
  
  return mix(
    mix(
      mix(hash(i + vec3<f32>(0.0, 0.0, 0.0)), hash(i + vec3<f32>(1.0, 0.0, 0.0)), u.x),
      mix(hash(i + vec3<f32>(0.0, 1.0, 0.0)), hash(i + vec3<f32>(1.0, 1.0, 0.0)), u.x),
      u.y
    ),
    mix(
      mix(hash(i + vec3<f32>(0.0, 0.0, 1.0)), hash(i + vec3<f32>(1.0, 0.0, 1.0)), u.x),
      mix(hash(i + vec3<f32>(0.0, 1.0, 1.0)), hash(i + vec3<f32>(1.0, 1.0, 1.0)), u.x),
      u.y
    ),
    u.z
  );
}

fn fbmNoise(pos: vec3<f32>, octaves: u32) -> f32 {
  var value = 0.0;
  var amplitude = 0.5;
  var frequency = 1.0;
  var maxValue = 0.0;
  
  for (var i = 0u; i < octaves; i = i + 1u) {
    value = value + amplitude * noise3D(pos * frequency);
    maxValue = maxValue + amplitude;
    amplitude = amplitude * 0.5;
    frequency = frequency * 2.0;
  }
  
  return value / maxValue;
}

fn getTerrainHeight(pos: vec3<f32>) -> f32 {
  let scale = 0.08;
  let height = fbmNoise(pos * scale + vec3<f32>(uniforms.time * 0.01), 4u) * 2.0 - 1.0;
  return height;
}

fn getTerrainSlope(pos: vec3<f32>) -> vec3<f32> {
  let epsilon = 0.1;
  let h = getTerrainHeight(pos);
  let hx = getTerrainHeight(pos + vec3<f32>(epsilon, 0.0, 0.0));
  let hz = getTerrainHeight(pos + vec3<f32>(0.0, 0.0, epsilon));
  
  return normalize(vec3<f32>(hx - h, epsilon, hz - h));
}

fn getEnergyFieldValue(pos: vec3<f32>) -> f32 {
  let centerDist = length(pos) / (uniforms.boundarySize * 0.5);
  let centerEnergy = max(0.0, 1.0 - centerDist * 0.5);
  
  let fieldScale = 0.15;
  let noiseEnergy = fbmNoise(pos * fieldScale + vec3<f32>(uniforms.time * 0.005), 3u);
  
  let pulseEnergy = sin(uniforms.time * 0.5 + length(pos) * 0.2) * 0.3 + 0.7;
  
  return (centerEnergy * 0.4 + noiseEnergy * 0.4 + pulseEnergy * 0.2) * uniforms.energyFieldStrength;
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) id: vec3<u32>) {
  let index = id.x;
  if (index >= uniforms.particleCount) {
    return;
  }
  
  var p = particles[index];
  
  let energyField = getEnergyFieldValue(p.position);
  let terrainHeight = getTerrainHeight(p.position);
  let terrainSlope = getTerrainSlope(p.position);
  
  if (p.state == 3u) {
    let sleepRecoveryRate = 2.0 + energyField * 3.0;
    p.energy = p.energy + sleepRecoveryRate * uniforms.deltaTime;
    
    if (p.energy >= uniforms.wakeThreshold) {
      p.state = 0u;
      p.velocity = vec3<f32>(
        noise3D(p.position + vec3<f32>(f32(index), 0.0, 0.0)) * 2.0 - 1.0,
        noise3D(p.position + vec3<f32>(0.0, f32(index), 0.0)) * 2.0 - 1.0,
        noise3D(p.position + vec3<f32>(0.0, 0.0, f32(index))) * 2.0 - 1.0
      );
      p.velocity = normalize(p.velocity);
    }
    
    p.energy = min(100.0, p.energy);
    particles[index] = p;
    return;
  }
  
  let noiseDir = vec3<f32>(
    noise3D(p.position * 0.5 + vec3<f32>(100.0, 0.0, 0.0) + vec3<f32>(uniforms.time * 0.05)) * 2.0 - 1.0,
    noise3D(p.position * 0.5 + vec3<f32>(0.0, 100.0, 0.0) + vec3<f32>(uniforms.time * 0.05)) * 2.0 - 1.0,
    noise3D(p.position * 0.5 + vec3<f32>(0.0, 0.0, 100.0) + vec3<f32>(uniforms.time * 0.05)) * 2.0 - 1.0
  );
  
  p.velocity = p.velocity + noiseDir * 0.15 * uniforms.deltaTime;
  
  let terrainForce = vec3<f32>(terrainSlope.x, terrainHeight * 0.5, terrainSlope.z);
  p.velocity = p.velocity + terrainForce * uniforms.terrainInfluence * uniforms.deltaTime;
  
  let energyForce = normalize(vec3<f32>(
    getEnergyFieldValue(p.position + vec3<f32>(0.5, 0.0, 0.0)) - getEnergyFieldValue(p.position - vec3<f32>(0.5, 0.0, 0.0)),
    getEnergyFieldValue(p.position + vec3<f32>(0.0, 0.5, 0.0)) - getEnergyFieldValue(p.position - vec3<f32>(0.0, 0.5, 0.0)),
    getEnergyFieldValue(p.position + vec3<f32>(0.0, 0.0, 0.5)) - getEnergyFieldValue(p.position - vec3<f32>(0.0, 0.0, 0.5))
  ));
  p.velocity = p.velocity + energyForce * 0.2 * uniforms.deltaTime;
  
  p.velocity = normalize(p.velocity);
  
  let baseSpeed = uniforms.speed;
  let terrainSpeedMod = 1.0 - abs(terrainHeight) * 0.4;
  let energySpeedMod = 0.5 + (p.energy / 100.0) * 0.8;
  let stateSpeedMod = select(1.0, 1.3, p.state == 1u);
  let finalSpeed = baseSpeed * max(0.2, terrainSpeedMod) * energySpeedMod * stateSpeedMod;
  
  p.position = p.position + p.velocity * finalSpeed * uniforms.deltaTime;
  
  let yOffset = terrainHeight * 0.5;
  p.position.y = p.position.y + (yOffset - p.position.y) * 0.1 * uniforms.deltaTime;
  
  let halfBoundary = uniforms.boundarySize * 0.5;
  var outOfBounds = false;
  
  if (p.position.x > halfBoundary) {
    p.position.x = halfBoundary;
    p.velocity.x = -abs(p.velocity.x);
    outOfBounds = true;
  } else if (p.position.x < -halfBoundary) {
    p.position.x = -halfBoundary;
    p.velocity.x = abs(p.velocity.x);
    outOfBounds = true;
  }
  
  if (p.position.y > halfBoundary) {
    p.position.y = halfBoundary;
    p.velocity.y = -abs(p.velocity.y);
    outOfBounds = true;
  } else if (p.position.y < -halfBoundary) {
    p.position.y = -halfBoundary;
    p.velocity.y = abs(p.velocity.y);
    outOfBounds = true;
  }
  
  if (p.position.z > halfBoundary) {
    p.position.z = halfBoundary;
    p.velocity.z = -abs(p.velocity.z);
    outOfBounds = true;
  } else if (p.position.z < -halfBoundary) {
    p.position.z = -halfBoundary;
    p.velocity.z = abs(p.velocity.z);
    outOfBounds = true;
  }
  
  if (outOfBounds) {
    let centerDir = -normalize(p.position);
    p.velocity = p.velocity + centerDir * 0.5 * uniforms.deltaTime;
    p.velocity = normalize(p.velocity);
    
    let rand = noise3D(p.position + vec3<f32>(f32(index) * 0.01) + vec3<f32>(uniforms.time * 0.001));
    if (rand > 0.75 && p.state != 3u) {
      if (p.state == 0u) {
        p.state = 1u;
      } else if (p.state == 1u) {
        p.state = 0u;
      }
    }
  }
  
  let baseEnergyCost = uniforms.energyDecayRate;
  let terrainEnergyCost = abs(terrainHeight) * 2.0;
  let speedEnergyCost = (finalSpeed / baseSpeed) * 0.5;
  let totalEnergyCost = baseEnergyCost * (1.0 + terrainEnergyCost + speedEnergyCost);
  
  p.energy = p.energy - totalEnergyCost * uniforms.deltaTime + energyField * 0.3 * uniforms.deltaTime;
  p.energy = clamp(p.energy, 0.0, 100.0);
  p.age = p.age + uniforms.deltaTime;
  
  if (p.energy <= uniforms.sleepThreshold) {
    p.state = 3u;
  }
  
  if (p.energy > 70.0 && p.state == 0u && noise3D(p.position * 0.1) > 0.95) {
    p.state = 2u;
  }
  
  particles[index] = p;
}
