"use client";

import { paintMessageSnapshot } from "./message-dissolve-snapshot";

export const MESSAGE_DISSOLVE_MS = 680;
const MAX_SCENES = 12;
type Scene = { id: string; source: HTMLElement; start: number; rect: [number, number, number, number]; texture: WebGLTexture; buffer: WebGLBuffer; count: number; grain: number };
const clips = new Map<string, { source: HTMLElement; animation: Animation; holding: boolean }>();
const scenes = new Map<string, Scene>();
let engine: ReturnType<typeof createRenderer> | undefined;
let frame = 0;

const vertex = `
attribute vec2 point;
uniform vec4 rect;
uniform vec2 viewport;
uniform float elapsed;
uniform float grain;
uniform float ratio;
varying vec2 uv;
varying float alpha;
float random(vec2 p) { return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
void main() {
  uv=point;
  float seed=random(point);
  float delay=point.x*0.24+seed*0.025;
  float age=max(0.0,elapsed-delay);
  float life=clamp(age/0.42,0.0,1.0);
  vec2 wind=vec2(42.0+seed*48.0,-19.0-random(point.yx)*29.0);
  vec2 drift=wind*age+vec2(sin(age*7.0+seed*6.28)*age*9.0,age*age*18.0);
  vec2 pixel=rect.xy+point*rect.zw+drift;
  gl_Position=vec4(pixel.x/viewport.x*2.0-1.0,1.0-pixel.y/viewport.y*2.0,0.0,1.0);
  gl_PointSize=max(1.0,grain*ratio*(1.0-life*0.68));
  alpha=step(delay,elapsed)*(1.0-smoothstep(0.08,1.0,life));
}`;
const fragment = `
precision mediump float;
uniform sampler2D picture;
varying vec2 uv;
varying float alpha;
void main() {
  vec4 color=texture2D(picture,uv);
  float edge=1.0-smoothstep(0.35,0.7,length(gl_PointCoord-0.5));
  gl_FragColor=vec4(color.rgb,color.a*alpha*edge);
}`;

function createRenderer() {
  const canvas = document.createElement("canvas");
  canvas.dataset.messageDust = "true"; canvas.setAttribute("aria-hidden", "true");
  Object.assign(canvas.style, { position: "fixed", inset: "0", width: "100%", height: "100%", pointerEvents: "none", zIndex: "120" });
  const gl = canvas.getContext("webgl", { alpha: true, antialias: false, depth: false, stencil: false, preserveDrawingBuffer: false, powerPreference: "low-power" });
  if (!gl) return null;
  function compile(type: number, source: string) {
    const shader = gl!.createShader(type); if (!shader) return null;
    gl!.shaderSource(shader, source); gl!.compileShader(shader);
    if (!gl!.getShaderParameter(shader, gl!.COMPILE_STATUS)) { gl!.deleteShader(shader); return null; }
    return shader;
  }
  const vs = compile(gl.VERTEX_SHADER, vertex), fs = compile(gl.FRAGMENT_SHADER, fragment), program = gl.createProgram();
  if (!vs || !fs || !program) { if (vs) gl.deleteShader(vs); if (fs) gl.deleteShader(fs); if (program) gl.deleteProgram(program); return null; }
  gl.attachShader(program, vs); gl.attachShader(program, fs); gl.linkProgram(program); gl.deleteShader(vs); gl.deleteShader(fs);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) { gl.deleteProgram(program); return null; }
  gl.useProgram(program); gl.enable(gl.BLEND); gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  const point = gl.getAttribLocation(program, "point"); gl.enableVertexAttribArray(point);
  const uniforms = Object.fromEntries(["rect", "viewport", "elapsed", "grain", "ratio"].map(name => [name, gl.getUniformLocation(program, name)]));
  canvas.addEventListener("webglcontextlost", event => { event.preventDefault(); finishVisibleDissolves(); engine = undefined; });
  return { canvas, gl, point, uniforms };
}

function releaseScene(id: string) {
  const scene = scenes.get(id);
  if (scene && engine) { engine.gl.deleteTexture(scene.texture); engine.gl.deleteBuffer(scene.buffer); }
  scenes.delete(id);
}
function draw(now: number) {
  frame = 0;
  if (!engine) return;
  const { gl, canvas, point, uniforms } = engine;
  const ratio = Math.min(1.5, devicePixelRatio || 1);
  const width = Math.round(innerWidth * ratio), height = Math.round(innerHeight * ratio);
  if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; gl.viewport(0, 0, width, height); }
  gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
  gl.uniform2f(uniforms.viewport, innerWidth, innerHeight); gl.uniform1f(uniforms.ratio, ratio);
  for (const scene of scenes.values()) {
    if (!scene.source.isConnected || now - scene.start >= MESSAGE_DISSOLVE_MS) { releaseScene(scene.id); continue; }
    gl.bindBuffer(gl.ARRAY_BUFFER, scene.buffer); gl.vertexAttribPointer(point, 2, gl.FLOAT, false, 0, 0);
    gl.bindTexture(gl.TEXTURE_2D, scene.texture); gl.uniform4fv(uniforms.rect, scene.rect);
    gl.uniform1f(uniforms.elapsed, (now - scene.start) / 1000); gl.uniform1f(uniforms.grain, scene.grain);
    gl.drawArrays(gl.POINTS, 0, scene.count);
  }
  if (scenes.size) frame = requestAnimationFrame(draw);
  else { canvas.remove(); removeListeners(); }
}
function removeListeners() { document.removeEventListener("scroll", finishVisibleDissolves, true); window.removeEventListener("resize", finishVisibleDissolves); }
function finishVisibleDissolves() {
  for (const [id, clip] of clips) { clip.animation.finish(); releaseScene(id); }
  cancelAnimationFrame(frame); frame = 0; engine?.canvas.remove(); removeListeners();
}

export function cancelMessageDissolve(id: string) {
  const clip = clips.get(id); clip?.animation.cancel(); clips.delete(id); releaseScene(id);
  if (!scenes.size) { cancelAnimationFrame(frame); frame = 0; engine?.canvas.remove(); removeListeners(); }
}
export function cancelAllMessageDissolves() {
  for (const id of [...clips.keys()]) cancelMessageDissolve(id);
}
export function isMessageDissolving(id: string) {
  const clip = clips.get(id);
  return Boolean(clip?.holding && clip.source.isConnected);
}
export function finishMessageDissolve(id: string) {
  const clip = clips.get(id);
  if (clip) { clip.holding = false; clip.animation.finish(); }
  releaseScene(id);
}

/** A single GPU canvas and RAF serve all simultaneous deletes, without one DOM
 * layer per particle. Unsupported/reduced-motion devices get a short fade. */
export function startMessageDissolve(id: string) {
  cancelMessageDissolve(id);
  const row = document.querySelector<HTMLElement>(`[data-message-id="${CSS.escape(id)}"]`);
  const source = row?.querySelector<HTMLElement>("[data-message-helper-anchor]") ?? row;
  if (!source?.animate) return MESSAGE_DISSOLVE_MS;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const simple = () => {
    clips.set(id, { source, holding: true, animation: source.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 160, fill: "forwards", easing: "ease-out" }) });
    return MESSAGE_DISSOLVE_MS;
  };
  if (reduced || document.hidden || scenes.size >= MAX_SCENES) return simple();
  engine ??= createRenderer();
  if (!engine) return simple();
  let snapshot: ReturnType<typeof paintMessageSnapshot>;
  try { snapshot = paintMessageSnapshot(source); } catch { return simple(); }
  if (!snapshot) return simple();
  const { gl, canvas } = engine;
  const texture = gl.createTexture(), buffer = gl.createBuffer();
  if (!texture || !buffer) { if (texture) gl.deleteTexture(texture); if (buffer) gl.deleteBuffer(buffer); return simple(); }
  try {
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, snapshot.canvas);
  } catch { gl.deleteTexture(texture); gl.deleteBuffer(buffer); return simple(); }
  const { left, top, width, height } = snapshot.bounds;
  const budget = Math.max(1500, 12000 / (scenes.size + 1));
  const grain = Math.max(2.4, Math.sqrt(width * height / budget));
  const columns = Math.ceil(width / grain), rows = Math.ceil(height / grain);
  const points = new Float32Array(columns * rows * 2);
  for (let y = 0, n = 0; y < rows; y++) for (let x = 0; x < columns; x++) { points[n++] = (x + 0.5) / columns; points[n++] = (y + 0.5) / rows; }
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer); gl.bufferData(gl.ARRAY_BUFFER, points, gl.STATIC_DRAW);
  const animation = source.animate([{ clipPath: "inset(0 0 0 0)" }, { clipPath: "inset(0 0 0 100%)" }], { duration: 270, easing: "linear", fill: "forwards" });
  clips.set(id, { source, animation, holding: true });
  scenes.set(id, { id, source, start: performance.now(), rect: [left, top, width, height], texture, buffer, count: columns * rows, grain });
  if (!canvas.isConnected) { document.body.append(canvas); document.addEventListener("scroll", finishVisibleDissolves, { capture: true, passive: true }); window.addEventListener("resize", finishVisibleDissolves); }
  if (!frame) frame = requestAnimationFrame(draw);
  return MESSAGE_DISSOLVE_MS;
}
