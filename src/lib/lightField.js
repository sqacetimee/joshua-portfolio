// WebGL light field emitted by the star cursor.
// The Projects and Photos tiles are rounded boxes in a 2D signed distance field. One march from the star
// towards each pixel measures how much a tile is in the way, and three layers of light read that with
// different softness:
//   the bright core is blocked almost sharply, so it compresses against a tile,
//   the middle glow has a wider penumbra, so it bends around corners,
//   the wide outer glow has the widest, so it wraps softly around the whole tile.
// Light gathers along the nearest edges, is channelled between close tiles, and never shows inside a tile.
// When the star slides behind a tile, that tile stops casting a shadow and its light escapes around the edges.
// Page titles bend the light around their actual letters (distance fields from lib/titleField.js). Words
// aren't solid, so they only partly block the light, and they never hide the star.

import { TITLE_PAD } from './titleField'

export const MAX_OBSTACLES = 8
export const MAX_TITLES = 4
export const TRAIL_POINTS = 10
export const EXTENT = 1.65 // how far the light reaches, in multiples of its radius

const VERT = `
attribute vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`

const FRAG = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
#define MAX_OBS ${MAX_OBSTACLES}
#define MAX_TITLES ${MAX_TITLES}
#define TRAIL ${TRAIL_POINTS}

uniform vec2 uRes;       // canvas size, canvas pixels
uniform float uScale;    // canvas pixels per CSS pixel
uniform vec2 uStar;      // star position, CSS pixels
uniform vec2 uVel;       // star velocity, CSS pixels per second
uniform float uRadius;   // size of the light
uniform float uPower;    // overall brightness (includes the click boost)
uniform float uHidden;   // how far the star is behind a tile, 0 to 1
uniform vec3 uPulse;     // click pulse: radius, strength, width
uniform vec4 uObs[MAX_OBS];      // tile centre x, centre y, half width, half height
uniform float uObsR[MAX_OBS];    // corner radius
uniform float uObsShade[MAX_OBS]; // 1 when the tile casts a shadow, 0 when the star is behind it
uniform int uObsCount;
uniform sampler2D uTitleSdf;         // letter distance fields for all titles
uniform vec4 uTitleBox[MAX_TITLES];  // area the title's field covers: left, top, width, height (CSS px)
uniform vec4 uTitleUv[MAX_TITLES];   // where that field sits in the atlas
uniform float uTitleShade[MAX_TITLES]; // 1 away from the title, 0 when the star is among its letters
uniform int uTitleCount;
uniform float uTitlePad;
uniform vec3 uTrail[TRAIL];   // x, y, strength; newest first

float sdBox(vec2 p, vec4 b, float r) {
  vec2 q = abs(p - b.xy) - b.zw + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}

// Distance to the nearest tile (used to keep light off tile surfaces)
float tileScene(vec2 p) {
  float d = 1e4;
  for (int i = 0; i < MAX_OBS; i++) {
    if (i >= uObsCount) break;
    d = min(d, sdBox(p, uObs[i], uObsR[i]));
  }
  return d;
}

// The same, but a tile the star is behind no longer blocks its light
float tileShadowScene(vec2 p) {
  float d = 1e4;
  for (int i = 0; i < MAX_OBS; i++) {
    if (i >= uObsCount) break;
    d = min(d, sdBox(p, uObs[i], uObsR[i]) + (1.0 - uObsShade[i]) * 600.0);
  }
  return d;
}

// Distance to the nearest letter of any title
float titleScene(vec2 p) {
  float d = 1e4;
  for (int j = 0; j < MAX_TITLES; j++) {
    if (j >= uTitleCount) break;
    vec4 b = uTitleBox[j];
    vec2 local = (p - b.xy) / b.zw;
    vec2 c = clamp(local, 0.0, 1.0);
    vec4 uv = uTitleUv[j];
    float s = (texture2D(uTitleSdf, mix(uv.xy, uv.zw, c)).r - 0.5) * 2.0 * uTitlePad;
    d = min(d, s + length((local - c) * b.zw));
  }
  return d;
}

// Cheap test: can any tile or title affect light travelling from a to b? If everything is far from the
// path relative to its length (so all layers are fully lit) and beyond the channelling reach (80px),
// the march can be skipped without any visible seam.
bool nearPath(vec2 a, vec2 b, float len) {
  vec2 lo = min(a, b);
  vec2 hi = max(a, b);
  for (int i = 0; i < MAX_OBS; i++) {
    if (i >= uObsCount) break;
    vec4 o = uObs[i];
    vec2 gap = max(max(o.xy - o.zw - hi, lo - o.xy - o.zw), 0.0);
    if (length(gap) + (1.0 - uObsShade[i]) * 600.0 < max(0.5 * len, 80.0)) return true;
  }
  for (int j = 0; j < MAX_TITLES; j++) {
    if (j >= uTitleCount) break;
    vec4 t = uTitleBox[j];
    vec2 gap = max(max(t.xy + uTitlePad - hi, lo - (t.xy + t.zw - uTitlePad)), 0.0);
    if (length(gap) < 0.5 * len) return true;
  }
  return false;
}

void main() {
  vec2 p = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) / uScale;
  vec2 v = p - uStar;
  float d = length(v);
  float jitter = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));

  // Nothing shows on a tile's surface; the edge is antialiased over about a pixel
  float hp = uObsCount > 0 ? tileScene(p) : 1e4;
  float mask = smoothstep(0.0, max(1.0, 1.0 / uScale), hp);

  // Faint trail left by fast movement, drawn as soft connected segments
  float trail = 0.0;
  for (int i = 0; i < TRAIL - 1; i++) {
    vec3 a = uTrail[i];
    vec3 b = uTrail[i + 1];
    if (a.z <= 0.0 || b.z <= 0.0) continue;
    vec2 pa = p - a.xy;
    vec2 ba = b.xy - a.xy;
    float k = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-3), 0.0, 1.0);
    vec2 q = pa - ba * k;
    float width = mix(6.0, 2.5, float(i) / float(TRAIL));
    trail = max(trail, mix(a.z, b.z, k) * exp(-dot(q, q) / (width * width)));
  }

  float R = uRadius;
  if (d > R * ${EXTENT}) {
    float ta = clamp(trail * mask, 0.0, 1.0);
    gl_FragColor = vec4(vec3(0.84, 0.88, 1.0) * ta, ta);
    return;
  }

  // How much tiles (m) and letters (mt) block this pixel, as the smallest clearance angle along the path
  float m = 1.0;
  float mt = 1.0;
  float closest = 1e4;
  if ((uObsCount > 0 || uTitleCount > 0) && d > 2.0 && nearPath(uStar, p, d)) {
    vec2 dir = v / d;
    float t = 1.0 + 2.0 * jitter;
    for (int i = 0; i < 28; i++) {
      if (t >= d) break;
      vec2 q = uStar + dir * t;
      float hTile = tileShadowScene(q);
      float hTitle = 1e4;
      for (int j = 0; j < MAX_TITLES; j++) {
        if (j >= uTitleCount) break;
        vec4 b = uTitleBox[j];
        vec2 local = (q - b.xy) / b.zw;
        vec2 c = clamp(local, 0.0, 1.0);
        vec4 uv = uTitleUv[j];
        // Letters are thickened slightly so thin strokes still catch the light smoothly
        float hj = (texture2D(uTitleSdf, mix(uv.xy, uv.zw, c)).r - 0.5) * 2.0 * uTitlePad + length((local - c) * b.zw) - 1.5;
        hTitle = min(hTitle, hj);
        mt = min(mt, hj / t + (1.0 - uTitleShade[j]) * 2.0);
      }
      closest = min(closest, hTile);
      m = min(m, hTile / t);
      t += clamp(abs(min(hTile, hTitle)), 2.0, 48.0);
    }
    m = max(m, -1.0);
    mt = max(mt, -1.0);
  }
  // Each layer reads the blockage with its own softness. Words aren't solid, so letters only partly block
  float visCore = smoothstep(-0.02, 0.14, m) * mix(1.0, smoothstep(-0.05, 0.12, mt), 0.6);
  float visMid = smoothstep(-0.2, 0.28, m) * mix(1.0, smoothstep(-0.2, 0.25, mt), 0.55);
  float visWide = smoothstep(-0.65, 0.5, m) * mix(1.0, smoothstep(-0.6, 0.45, mt), 0.45);

  // Stretch the field along the direction of travel, most of all behind the star
  float speed = length(uVel);
  vec2 dirV = speed > 1.0 ? uVel / speed : vec2(1.0, 0.0);
  float along = dot(v, dirV);
  float across = dot(v, vec2(-dirV.y, dirV.x));
  float stretch = min(speed / 2600.0, 0.4);
  float dField = length(vec2(along / (1.0 + stretch * (along < 0.0 ? 1.0 : 0.25)), across * (1.0 - stretch * 0.1)));

  // Light is channelled along narrow open paths between tiles, and spreads a little further when the star
  // is hidden, as if escaping around the tile
  float channel = (1.0 - smoothstep(6.0, 80.0, closest)) * visMid;
  float dSpread = dField / (1.0 + 0.55 * channel + 0.2 * uHidden);

  // A slight natural irregularity in the glow's outline
  float ang = atan(v.y, v.x + 1e-4);
  float wobble = 0.5 * sin(3.0 * ang + 1.3) + 0.3 * sin(5.0 * ang - 0.7) + 0.2 * sin(8.0 * ang + 2.1);
  float dSoft = dSpread * (1.0 + 0.05 * wobble);

  // Three smooth profiles that blend into one continuous falloff, with no edges or rings
  float core = 1.0 / (1.0 + pow(dField / (R * 0.06), 2.0));
  float mid = exp(-pow(dSoft / (R * 0.25), 1.6));
  float wide = exp(-pow(dSoft / (R * 0.7), 1.2));
  float fade = 1.0 - smoothstep(R * 0.7, R * ${EXTENT}, d);
  float light = (0.9 * core * visCore + 0.45 * mid * visMid + 0.3 * wide * visWide) * fade;

  // Gathers along the nearest tile edges on the side the light reaches, and softly around the letters
  float edge = uObsCount > 0 ? exp(-max(hp, 0.0) / 14.0) : 0.0;
  if (uTitleCount > 0) edge += 0.95 * exp(-abs(titleScene(p)) / 11.0);
  light += edge * (0.5 * core * visCore + 0.8 * mid * visMid + 0.45 * wide * visWide) * fade;

  // Click pulse travelling outward through the field
  float ring = exp(-pow((d - uPulse.x) / max(uPulse.z, 1.0), 2.0)) * uPulse.y;
  light += ring * mix(0.35, 1.0, visMid) * (1.0 - smoothstep(R * 0.5, R * 1.2, d));

  vec3 warm = vec3(1.0, 0.95, 0.87);
  vec3 cool = vec3(0.84, 0.88, 1.0);
  vec3 colour = mix(cool, warm, exp(-d / 90.0));
  float a = clamp((light * uPower + trail) * mask + (jitter - 0.5) / 255.0, 0.0, 1.0);
  gl_FragColor = vec4(colour * a, a);
}
`

export function createLightField(canvas, initialScale) {
  let scale = initialScale
  let gl = null
  try {
    gl = canvas.getContext('webgl', {
      alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, powerPreference: 'low-power',
    })
  } catch {
    gl = null
  }
  if (!gl) return null

  const compile = (type, source) => {
    const shader = gl.createShader(type)
    gl.shaderSource(shader, source)
    gl.compileShader(shader)
    if (gl.getShaderParameter(shader, gl.COMPILE_STATUS)) return shader
    console.warn('Star light shader failed to compile:', gl.getShaderInfoLog(shader))
    return null
  }
  const vs = compile(gl.VERTEX_SHADER, VERT)
  const fs = compile(gl.FRAGMENT_SHADER, FRAG)
  if (!vs || !fs) return null
  const program = gl.createProgram()
  gl.attachShader(program, vs)
  gl.attachShader(program, fs)
  gl.linkProgram(program)
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.warn('Star light shader failed to link:', gl.getProgramInfoLog(program))
    return null
  }
  gl.useProgram(program)

  const buffer = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)
  const aPos = gl.getAttribLocation(program, 'aPos')
  gl.enableVertexAttribArray(aPos)
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0)

  const u = (name) => gl.getUniformLocation(program, name)
  const loc = {
    res: u('uRes'), scale: u('uScale'), star: u('uStar'), vel: u('uVel'), radius: u('uRadius'), power: u('uPower'),
    hidden: u('uHidden'), pulse: u('uPulse'), obs: u('uObs[0]'), obsR: u('uObsR[0]'), obsShade: u('uObsShade[0]'),
    count: u('uObsCount'), titleSdf: u('uTitleSdf'), titleBox: u('uTitleBox[0]'), titleUv: u('uTitleUv[0]'),
    titleShade: u('uTitleShade[0]'), titleCount: u('uTitleCount'), titlePad: u('uTitlePad'), trail: u('uTrail[0]'),
  }

  // Letter distance fields live in one single-channel texture; until titles are measured it reads as "far"
  const titleTexture = gl.createTexture()
  gl.activeTexture(gl.TEXTURE0)
  gl.bindTexture(gl.TEXTURE_2D, titleTexture)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1)
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, 1, 1, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, new Uint8Array([255]))
  gl.uniform1i(loc.titleSdf, 0)
  gl.uniform1f(loc.titlePad, TITLE_PAD)

  let w = 0
  let h = 0
  let lost = false
  const onLost = (e) => { e.preventDefault(); lost = true }
  canvas.addEventListener('webglcontextlost', onLost)

  const resize = () => {
    w = Math.max(1, Math.round(window.innerWidth * scale))
    h = Math.max(1, Math.round(window.innerHeight * scale))
    canvas.width = w
    canvas.height = h
    gl.viewport(0, 0, w, h)
  }
  resize()

  const clear = () => {
    if (lost) return
    gl.disable(gl.SCISSOR_TEST)
    gl.clearColor(0, 0, 0, 0)
    gl.clear(gl.COLOR_BUFFER_BIT)
  }

  const setTitleAtlas = (atlas) => {
    if (lost) return
    gl.bindTexture(gl.TEXTURE_2D, titleTexture)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, atlas.width, atlas.height, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, atlas.data)
  }

  const render = (f) => {
    if (lost) return
    clear()
    if (f.power <= 0.001) return
    const x0 = Math.floor((f.x - f.extent) * scale)
    const y0 = Math.floor(h - (f.y + f.extent) * scale)
    const size = Math.ceil(2 * f.extent * scale)
    gl.enable(gl.SCISSOR_TEST)
    gl.scissor(x0, y0, size, size)
    gl.uniform2f(loc.res, w, h)
    gl.uniform1f(loc.scale, scale)
    gl.uniform2f(loc.star, f.x, f.y)
    gl.uniform2f(loc.vel, f.vx, f.vy)
    gl.uniform1f(loc.radius, f.radius)
    gl.uniform1f(loc.power, f.power)
    gl.uniform1f(loc.hidden, f.hidden)
    gl.uniform3f(loc.pulse, f.pulse[0], f.pulse[1], f.pulse[2])
    gl.uniform4fv(loc.obs, f.obstacles)
    gl.uniform1fv(loc.obsR, f.radii)
    gl.uniform1fv(loc.obsShade, f.shades)
    gl.uniform1i(loc.count, f.count)
    gl.uniform4fv(loc.titleBox, f.titleBoxes)
    gl.uniform4fv(loc.titleUv, f.titleUvs)
    gl.uniform1fv(loc.titleShade, f.titleShades)
    gl.uniform1i(loc.titleCount, f.titleCount)
    gl.uniform3fv(loc.trail, f.trail)
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
  }

  const setScale = (next) => {
    scale = next
    resize()
  }

  // The canvas keeps its context, so a remount (or a reduced motion change) can build a new field on it
  const destroy = () => {
    clear()
    canvas.removeEventListener('webglcontextlost', onLost)
    gl.deleteTexture(titleTexture)
    gl.deleteProgram(program)
    gl.deleteShader(vs)
    gl.deleteShader(fs)
    gl.deleteBuffer(buffer)
  }

  return { resize, render, clear, destroy, setScale, setTitleAtlas }
}
