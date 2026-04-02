import { useEffect, useRef } from 'react';

const VERT_SRC = `
  attribute vec2 a_position;
  varying vec2 v_uv;
  void main() {
    v_uv = a_position * 0.5 + 0.5;
    gl_Position = vec4(a_position, 0.0, 1.0);
  }
`;

const FRAG_SRC = `
  precision highp float;
  uniform float u_time;
  uniform vec2  u_resolution;
  varying vec2  v_uv;

  vec3 mod289(vec3 x){ return x - floor(x * (1.0/289.0)) * 289.0; }
  vec2 mod289(vec2 x){ return x - floor(x * (1.0/289.0)) * 289.0; }
  vec3 permute(vec3 x){ return mod289(((x*34.0)+1.0)*x); }
  float snoise(vec2 v){
    const vec4 C = vec4(0.211324865405187, 0.366025403784439,
                       -0.577350269189626, 0.024390243902439);
    vec2 i = floor(v + dot(v, C.yy));
    vec2 x0 = v - i + dot(i, C.xx);
    vec2 i1 = (x0.x > x0.y) ? vec2(1.0,0.0) : vec2(0.0,1.0);
    vec4 x12 = x0.xyxy + C.xxzz;
    x12.xy -= i1;
    i = mod289(i);
    vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0))
                            + i.x + vec3(0.0, i1.x, 1.0));
    vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy),
                             dot(x12.zw,x12.zw)), 0.0);
    m = m*m; m = m*m;
    vec3 x = 2.0 * fract(p * C.www) - 1.0;
    vec3 h = abs(x) - 0.5;
    vec3 ox = floor(x + 0.5);
    vec3 a0 = x - ox;
    m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
    vec3 g;
    g.x = a0.x * x0.x + h.x * x0.y;
    g.yz = a0.yz * x12.xz + h.yz * x12.yw;
    return 130.0 * dot(m, g);
  }

  void main(){
    vec2 uv = v_uv;
    float t = u_time * 0.12;
    float aspect = u_resolution.x / u_resolution.y;
    vec2 p = vec2(uv.x * aspect, uv.y);

    float n1 = snoise(p * 0.8  + vec2(t * 0.6,  t * 0.4))  * 0.55;
    float n2 = snoise(p * 1.6  + vec2(-t * 0.35, t * 0.8)) * 0.30;
    float n3 = snoise(p * 3.2  + vec2(t * 0.9, -t * 0.5))  * 0.15;
    float n4 = snoise(p * 0.4  + vec2(t * 0.15, t * 0.25)) * 0.65;
    float n5 = snoise(p * 0.55 + vec2(-t * 0.3, -t * 0.2)) * 0.45;
    float noise = n1 + n2 + n3 + n4 + n5;

    vec2 warp = vec2(
      snoise(p * 0.7 + vec2(t * 0.5, 0.0)),
      snoise(p * 0.7 + vec2(0.0, t * 0.4))
    ) * 0.3;
    float warped = snoise((p + warp) * 1.0 + vec2(t * 0.2, t * 0.3)) * 0.5;
    noise = mix(noise, noise + warped, 0.5);

    vec3 c_base    = vec3(0.035, 0.035, 0.04);
    vec3 c_deep    = vec3(0.07, 0.07, 0.08);
    vec3 c_emerald = vec3(0.85, 0.85, 0.85);
    vec3 c_teal    = vec3(0.65, 0.65, 0.67);
    vec3 c_mint    = vec3(0.92, 0.92, 0.93);

    float band = noise * 0.45 + 0.5;
    vec3 col = c_base;
    col = mix(col, c_deep,    smoothstep(0.10, 0.35, band));
    col = mix(col, c_emerald, smoothstep(0.35, 0.55, band) * 0.35);
    col = mix(col, c_teal,    smoothstep(0.50, 0.68, band) * 0.22);
    col = mix(col, c_mint,    smoothstep(0.65, 0.85, band) * 0.10);

    float edgeL = smoothstep(0.3, 0.0, uv.x) * snoise(p * 0.9 + vec2(0.0, t * 0.3));
    float edgeR = smoothstep(0.7, 1.0, uv.x) * snoise(p * 0.9 + vec2(t * 0.4, 0.0));
    float edgeT = smoothstep(0.3, 0.0, uv.y) * snoise(p * 1.1 + vec2(t * 0.2, t * 0.5));
    float edgeB = smoothstep(0.7, 1.0, uv.y) * snoise(p * 1.1 + vec2(-t * 0.3, t * 0.2));
    col += c_emerald * max(edgeL, 0.0) * 0.12;
    col += c_teal    * max(edgeR, 0.0) * 0.10;
    col += c_emerald * max(edgeT, 0.0) * 0.08;
    col += c_deep    * max(edgeB, 0.0) * 0.15;

    float vig = 1.0 - length((uv - 0.5) * vec2(0.9, 1.0)) * 0.3;
    col *= vig;

    float pulse = sin(u_time * 0.25) * 0.5 + 0.5;
    float center = 1.0 - length((uv - vec2(0.5, 0.4)) * vec2(1.4, 1.8));
    center = pow(max(center, 0.0), 2.5);
    col += c_emerald * center * 0.04 * pulse;

    col = max(col, c_base * 0.7);

    gl_FragColor = vec4(col, 1.0);
  }
`;

function compileShader(gl: WebGLRenderingContext, type: number, src: string) {
  const s = gl.createShader(type)!;
  gl.shaderSource(s, src);
  gl.compileShader(s);
  return s;
}

export function WebGLMeshGradient({ className = '' }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (!gl) return;

    const glCtx = gl as WebGLRenderingContext;

    const prog = glCtx.createProgram()!;
    glCtx.attachShader(prog, compileShader(glCtx, glCtx.VERTEX_SHADER, VERT_SRC));
    glCtx.attachShader(prog, compileShader(glCtx, glCtx.FRAGMENT_SHADER, FRAG_SRC));
    glCtx.linkProgram(prog);
    glCtx.useProgram(prog);

    const buf = glCtx.createBuffer();
    glCtx.bindBuffer(glCtx.ARRAY_BUFFER, buf);
    glCtx.bufferData(glCtx.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), glCtx.STATIC_DRAW);
    const aPos = glCtx.getAttribLocation(prog, 'a_position');
    glCtx.enableVertexAttribArray(aPos);
    glCtx.vertexAttribPointer(aPos, 2, glCtx.FLOAT, false, 0, 0);

    const uTime = glCtx.getUniformLocation(prog, 'u_time');
    const uRes = glCtx.getUniformLocation(prog, 'u_resolution');

    function resize() {
      const dpr = Math.min(window.devicePixelRatio, 2);
      const w = canvas!.clientWidth * dpr;
      const h = canvas!.clientHeight * dpr;
      if (canvas!.width !== w || canvas!.height !== h) {
        canvas!.width = w;
        canvas!.height = h;
        glCtx.viewport(0, 0, w, h);
      }
    }
    window.addEventListener('resize', resize);
    resize();

    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const start = performance.now();
    let rafId: number;

    function frame(now: number) {
      const t = (now - start) / 1000;
      resize();
      glCtx.uniform1f(uTime, prefersReduced ? 0 : t);
      glCtx.uniform2f(uRes, canvas!.width, canvas!.height);
      glCtx.drawArrays(glCtx.TRIANGLE_STRIP, 0, 4);
      rafId = requestAnimationFrame(frame);
    }
    rafId = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className={`absolute inset-0 w-full h-full pointer-events-none ${className}`}
      style={{ zIndex: 1 }}
    />
  );
}
