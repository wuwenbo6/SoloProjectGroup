struct Uniforms {
  resolution: vec2<f32>,
  pointCount: u32,
  radius: f32,
  intensity: f32,
}

struct Point {
  position: vec2<f32>,
  value: f32,
}

@group(0) @binding(0) var<storage, read> points: array<Point>;
@group(0) @binding(1) var<storage, read_write> heatmap: texture_2d<f32>;
@group(0) @binding(2) var<uniform> uniforms: Uniforms;

fn gaussian(dist: f32, sigma: f32) -> f32 {
  return exp(-dist * dist / (2.0 * sigma * sigma));
}

@compute @workgroup_size(16, 16)
fn main(@builtin(global_invocation_id) id: vec3<u32>) {
  let coord = vec2<u32>(id.x, id.y);
  if (coord.x >= u32(uniforms.resolution.x) || coord.y >= u32(uniforms.resolution.y)) {
    return;
  }
  
  let uv = (vec2<f32>(coord) + 0.5) / uniforms.resolution;
  var total = 0.0;
  
  for (var i: u32 = 0u; i < uniforms.pointCount; i = i + 1u) {
    let point = points[i];
    let pointUV = (point.position + 1.0) * 0.5;
    let dist = distance(uv, pointUV) * 2.0;
    
    if (dist < uniforms.radius) {
      let contribution = gaussian(dist, uniforms.radius * 0.3) * point.value * uniforms.intensity;
      total = total + contribution;
    }
  }
  
  let color = vec4<f32>(total, total * 0.5, max(0.0, 1.0 - total * 2.0), 1.0);
  textureStore(heatmap, coord, color);
}
