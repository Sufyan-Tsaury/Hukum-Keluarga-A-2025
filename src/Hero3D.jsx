import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import * as THREE from "three";
import { JOURNEY, range } from "./journey";
import { scrollState as s } from "./scrollState";
import { CHAR_METRICS } from "./characterMetrics";

const lerp = THREE.MathUtils.lerp;

export const FIELD_Z = -14;
export const CHAR_Z = 0;
export const BUBBLE_Z = 1.05;

const FRAME = {
  desktop: {
    headroom: 0.07,
    crop: 0.78,
    bubble: 0.132,
    lift: 1.02,
    sideways: -0.04,
  },
  mobile: {
    headroom: 0.28,
    crop: 0.82,
    bubble: 0.102,
    lift: 1.06,
    sideways: -0.14,
  },
};

export function heroLayout(viewportWidth, viewportHeight, cameraZ, mobile) {
  const f = mobile ? FRAME.mobile : FRAME.desktop;
  const bodyH = CHAR_METRICS.body.y1 - CHAR_METRICS.body.y0;
  const planeH = (viewportHeight * (1 - f.headroom)) / (bodyH * f.crop);
  const planeW = planeH * CHAR_METRICS.aspect;

  const centerX = (0.5 - CHAR_METRICS.midX) * planeW;
  const centerY =
    viewportHeight * (0.5 - f.headroom) -
    planeH * (0.5 - CHAR_METRICS.body.y0);

  const palmX = centerX + (CHAR_METRICS.palm.u - 0.5) * planeW;
  const palmY = centerY + (0.5 - CHAR_METRICS.palm.v) * planeH;

  const toBubble = (cameraZ - BUBBLE_Z) / (cameraZ - CHAR_Z);
  const radius = viewportHeight * f.bubble;

  return {
    planeW,
    planeH,
    centerX,
    centerY,
    radius,
    palmX,
    palmY,
    bubbleX: Math.min(
      palmX * toBubble + radius * f.sideways,
      viewportWidth * toBubble * 0.5 - radius * 1.08,
    ),
    bubbleY: palmY * toBubble + radius * f.lift,
    viewportWidth,
    viewportHeight,
  };
}

export function useHeroLayout() {
  const { camera, size } = useThree();
  return useMemo(() => {
    const rest = 6;
    const vh = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) * rest;
    return heroLayout(
      vh * (size.width / size.height),
      vh,
      rest,
      size.width < 700,
    );
  }, [camera.fov, size.width, size.height]);
}

const NOISE3 = `
float hash3(vec3 p){ return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
float noise3(vec3 p){
  vec3 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(hash3(i), hash3(i + vec3(1,0,0)), f.x), mix(hash3(i + vec3(0,1,0)), hash3(i + vec3(1,1,0)), f.x), f.y),
    mix(mix(hash3(i + vec3(0,0,1)), hash3(i + vec3(1,0,1)), f.x), mix(hash3(i + vec3(0,1,1)), hash3(i + vec3(1,1,1)), f.x), f.y),
    f.z);
}`;

/* 1. Heritage Courtroom & Classical Law Library Chamber */
const FIELD_FRAGMENT = `
varying vec2 vUv;
uniform sampler2D uField, uDepth, uNormal, uNoise;
uniform vec2 uPointer;
uniform float uTime, uOpacity, uLight, uAmp, uPlaneAspect, uImageAspect;
uniform vec3 uFogWarm, uFogCool;

vec2 cover(vec2 uv){
  vec2 scale = uPlaneAspect > uImageAspect
    ? vec2(1.0, uImageAspect / uPlaneAspect)
    : vec2(uPlaneAspect / uImageAspect, 1.0);
  return (uv - 0.5) * scale + 0.5;
}

void main(){
  vec2 base = cover(vUv);
  float depth = texture2D(uDepth, base).r - 0.55;

  float drift1 = texture2D(uNoise, base * 0.85 + uTime * 0.01).r - 0.5;
  float drift2 = texture2D(uNoise, base * 0.2 - uTime * 0.016).r - 0.5;
  float toCentre = pow(distance(vUv, vec2(0.5)), 3.0);
  float toPointer = 1.0 - smoothstep(0.0, 0.38, distance(uPointer * 0.5 + 0.5, vUv));

  vec2 uv = base
    + uPointer * depth * uAmp
    + vec2(drift1 * toCentre * 0.08, drift1 * toCentre * 0.05)
    + vec2(drift2 * 0.016 * toPointer);

  vec3 colour = texture2D(uField, uv).rgb;
  vec3 normal = vec3(1.0, -1.0, 1.0) * (texture2D(uNormal, uv).rgb * 2.0 - 1.0);

  vec3 light = normalize(vec3(uPointer * 1.15, 0.42));
  float shade = dot(normalize(normal), light) - light.z;
  colour *= 0.72 + shade * 0.24 * uLight;
  colour += vec3(0.32, 0.24, 0.11) * max(shade, 0.0) * toPointer * 0.16 * uLight;

  float smoke = texture2D(uNoise, uv * 0.065 + vec2(uTime * 0.0014, -uTime * 0.0022)).r;
  float smoke2 = texture2D(uNoise, uv * 0.032 - vec2(uTime * 0.001, uTime * 0.0016)).r;
  float floorFog = pow(1.0 - vUv.y, 3.0) * (0.35 + smoke * 0.65);
  float ceilingFog = pow(vUv.y, 4.0) * smoke2;
  colour += uFogWarm * floorFog * 0.12 + uFogCool * ceilingFog * 0.05;
  float veil = smoothstep(0.30, 0.72, smoke * smoke2) * 0.06;
  colour += mix(uFogCool, uFogWarm, vUv.x) * veil;
  float pools = exp(-dot((vUv - vec2(0.64, 0.46)) * vec2(2.0, 1.5), (vUv - vec2(0.64, 0.46)) * vec2(2.0, 1.5)) * 3.0);
  colour += uFogWarm * pools * 0.065;
  colour *= 1.0 - smoothstep(0.22, 0.88, distance(vUv, vec2(0.54, 0.48))) * 0.58;

  gl_FragColor = vec4(colour, uOpacity);
  #include <colorspace_fragment>
  gl_FragColor.rgb *= uOpacity;
}`;

export function HeroField({ mobile }) {
  const mesh = useRef();
  const { camera, size } = useThree();
  const suffix = mobile ? "-mobile" : "";
  const [field, depth, normal, noise] = useTexture([
    "/textures/scene" + suffix + ".jpg",
    "/textures/scene-depth" + suffix + ".jpg",
    "/textures/scene-normal" + suffix + ".jpg",
    "/textures/noise.jpg",
  ]);
  useMemo(() => {
    field.colorSpace = THREE.SRGBColorSpace;
    [depth, normal, noise].forEach((t) => (t.colorSpace = THREE.NoColorSpace));
    [field, depth, normal, noise].forEach((t) => {
      t.minFilter = THREE.LinearFilter;
      t.magFilter = THREE.LinearFilter;
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
    });
  }, [field, depth, normal, noise]);

  const uniforms = useMemo(
    () => ({
      uField: { value: field },
      uDepth: { value: depth },
      uNormal: { value: normal },
      uNoise: { value: noise },
      uPointer: { value: new THREE.Vector2() },
      uTime: { value: 0 },
      uOpacity: { value: 1 },
      uLight: { value: 1 },
      uAmp: { value: mobile ? 0.012 : 0.024 },
      uPlaneAspect: { value: 1.78 },
      uImageAspect: { value: 16 / 9 },
      uFogWarm: { value: new THREE.Color("#B8892D") },
      uFogCool: { value: new THREE.Color("#4A1E28") },
    }),
    [],
  );

  useFrame(({ clock }) => {
    const u = mesh.current.material.uniforms;
    const distance = camera.position.z - FIELD_Z;
    const height =
      2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) * distance * 1.12;
    const width = height * (size.width / size.height);
    mesh.current.scale.set(width, height, 1);
    u.uPlaneAspect.value = width / height;
    u.uTime.value = s.reduced ? 12 : clock.elapsedTime;
    u.uPointer.value.copy(s.pointer);
    const out = range(s.progress, 0.52, 0.79);
    u.uOpacity.value = (1 - out) * (1 - s.outro);
    u.uLight.value = 1 - out;
    mesh.current.visible = u.uOpacity.value > 0.002;
    mesh.current.position.set(
      -s.pointer.x * 0.52,
      -s.pointer.y * 0.32,
      FIELD_Z,
    );
  });

  return (
    <mesh ref={mesh} renderOrder={-90} frustumCulled={false}>
      <planeGeometry args={[1, 1, 1, 1]} />
      <shaderMaterial
        uniforms={uniforms}
        transparent
        premultipliedAlpha
        depthWrite={false}
        vertexShader="varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }"
        fragmentShader={FIELD_FRAGMENT}
      />
    </mesh>
  );
}

/* 2. Modern Dewi Themis 2.5D Plate */
const CHARACTER_FRAGMENT = `
varying vec2 vUv;
uniform sampler2D uMap, uDepth, uNormal;
uniform vec2 uPointer;
uniform float uOpacity, uAmp, uLight, uGlow;
uniform vec3 uRim, uBounce;

void main(){
  vec3 maps = texture2D(uDepth, vUv).rgb;
  float volume = maps.r;
  float inside = maps.g;

  vec2 uv = clamp(vUv + uPointer * (volume - 0.62) * uAmp * inside, 0.001, 0.999);
  vec4 texel = texture2D(uMap, uv);
  if (texel.a < 0.015) discard;

  vec3 normal = normalize(vec3(1.0, -1.0, 1.0) * (texture2D(uNormal, uv).rgb * 2.0 - 1.0));
  vec3 light = normalize(vec3(uPointer * 1.2, 0.52));
  float shade = dot(normal, light) - light.z;
  float edge = pow(1.0 - volume, 5.5);

  vec3 colour = texel.rgb;
  colour.g = min(colour.g, max(colour.r, colour.b));
  colour *= 0.84 + shade * 0.18 * uLight;
  colour *= smoothstep(0.02, 0.22, vUv.y);
  colour += uBounce * pow(1.0 - vUv.y, 4.0) * 0.04;
  colour += uRim * edge * max(shade, 0.0) * 0.22 * uLight;
  colour += uRim * edge * uGlow * 0.045;

  gl_FragColor = vec4(colour, texel.a * uOpacity);
  #include <colorspace_fragment>
}`;

export function HeroCharacter({ layout, mobile }) {
  const mesh = useRef();
  const material = useRef();
  const [map, depth, normal] = useTexture([
    "/character.png",
    "/textures/character-depth.jpg",
    "/textures/character-normal.jpg",
  ]);
  useMemo(() => {
    map.colorSpace = THREE.SRGBColorSpace;
    map.anisotropy = 8;
    [depth, normal].forEach((t) => {
      t.colorSpace = THREE.NoColorSpace;
      t.minFilter = THREE.LinearFilter;
      t.magFilter = THREE.LinearFilter;
    });
  }, [map, depth, normal]);

  const uniforms = useMemo(
    () => ({
      uMap: { value: map },
      uDepth: { value: depth },
      uNormal: { value: normal },
      uPointer: { value: new THREE.Vector2() },
      uOpacity: { value: 1 },
      uAmp: { value: mobile ? 0.0055 : 0.0095 },
      uLight: { value: 1 },
      uGlow: { value: 0 },
      uRim: { value: new THREE.Color("#FFE094") },
      uBounce: { value: new THREE.Color("#9E3542") },
    }),
    [],
  );

  useFrame(({ clock }) => {
    const u = mesh.current.material.uniforms;
    const time = s.reduced ? 0 : clock.elapsedTime;
    mesh.current.scale.set(layout.planeW, layout.planeH, 1);
    const zoomShiftY =
      range(s.progress, JOURNEY.zoomStart, JOURNEY.zoomEnd) *
      (mobile ? 0.12 : 0.22);
    mesh.current.position.set(
      layout.centerX + s.pointer.x * 0.07,
      layout.centerY +
        s.pointer.y * 0.04 +
        Math.sin(time * 0.55) * 0.02 -
        zoomShiftY,
      CHAR_Z,
    );
    mesh.current.rotation.y = s.pointer.x * 0.032;
    mesh.current.rotation.x = -s.pointer.y * 0.018;
    u.uPointer.value.copy(s.pointer);
    u.uGlow.value = 0.14 + s.bubbleHover * 0.32;
    s.palmX = layout.palmX;
    s.palmY = layout.palmY - zoomShiftY;
    const opacity = (0.76 + 0.24 * range(s.progress, 0, 0.18)) * (1 - s.outro);
    u.uOpacity.value = opacity;
    u.uLight.value = 1;
    mesh.current.visible = opacity > 0.01;
    material.current.transparent = true;
  });

  return (
    <mesh ref={mesh} renderOrder={0} frustumCulled={false}>
      <planeGeometry args={[1, 1, 1, 1]} />
      <shaderMaterial
        ref={material}
        uniforms={uniforms}
        transparent
        depthWrite
        depthTest
        vertexShader="varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }"
        fragmentShader={CHARACTER_FRAGMENT}
      />
    </mesh>
  );
}

/* 3. Golden Iridescent Orb of Justice */
const BUBBLE_VERTEX = `
uniform float uTime, uWobble, uRipple, uRippleAge, uSwell;
uniform vec3 uRippleDir;
varying vec3 vNormalW, vWorld, vLocal;
${NOISE3}

float film(vec3 p){
  float n = noise3(p * 1.6 + vec3(0.0, uTime * 0.23, uTime * 0.12)) - 0.5;
  n += (noise3(p * 3.4 - vec3(uTime * 0.16, 0.0, uTime * 0.11)) - 0.5) * 0.45;
  float ripple = sin(dot(p, uRippleDir) * 8.5 - uRippleAge * 3.0) * uRipple;
  float wave = sin(p.y * 4.0 + p.x * 2.5 - uTime * 0.85) * 0.18;
  return (n + wave) * uWobble + ripple;
}
vec3 shift(vec3 p){ return p * (1.0 + uSwell + film(p)); }

void main(){
  vec3 displaced = shift(position);
  vec3 axis = abs(normal.y) > 0.9 ? vec3(1.0, 0.0, 0.0) : vec3(0.0, 1.0, 0.0);
  vec3 t1 = normalize(cross(normal, axis));
  vec3 t2 = normalize(cross(normal, t1));
  vec3 a = shift(normalize(position + t1 * 0.05));
  vec3 b = shift(normalize(position + t2 * 0.05));
  vec3 n = normalize(cross(a - displaced, b - displaced));
  if (dot(n, normal) < 0.0) n = -n;

  vec4 world = modelMatrix * vec4(displaced, 1.0);
  vWorld = world.xyz;
  vLocal = displaced;
  vNormalW = normalize(mat3(modelMatrix) * n);
  gl_Position = projectionMatrix * viewMatrix * world;
}`;

const BUBBLE_FRAGMENT = `
uniform samplerCube uEnv;
uniform float uTime, uThickness, uOpacity, uHover, uFaceGain;
varying vec3 vNormalW, vWorld, vLocal;
vec3 interference(float thickness, float cosine){
  return 0.5 + 0.5 * cos(6.2831853 * 2.0 * 1.33 * thickness * cosine / vec3(640.0, 545.0, 440.0));
}
void main(){
  vec3 N = normalize(vNormalW), V = normalize(cameraPosition - vWorld);
  if(dot(N, V) < 0.0) N = -N;
  float c = clamp(dot(N, V), 0.0, 1.0);
  float fresnel = pow(1.0 - c, 3.3), rim = pow(1.0 - c, 11.0);
  float thickness = uThickness * (0.86 + 0.12 * vLocal.y + 0.04 * sin(vLocal.y * 3.0 + uTime * 0.06));
  vec3 pearl = mix(vec3(0.98, 0.92, 0.76), interference(thickness, max(c, 0.18)), 0.28);
  vec3 R = reflect(-V, N);
  float key = exp(-pow((R.x + 0.48) / 0.12, 2.0) - pow((R.y - 0.28) / 0.65, 2.0)) * smoothstep(-0.1, 0.45, R.z);
  float fill = exp(-pow((R.x - 0.72) / 0.055, 2.0) - pow((R.y + 0.04) / 0.48, 2.0)) * smoothstep(-0.1, 0.4, R.z);
  vec3 radiance = textureCube(uEnv, R).rgb * 0.12 + vec3(1.0, 0.94, 0.78) * key * 0.95 + vec3(0.92, 0.76, 0.44) * fill * 0.48;
  float highlight = clamp(max(max(radiance.r, radiance.g), radiance.b), 0.0, 1.0);
  vec3 colour = radiance * pearl * 0.82 + pearl * rim * 0.85 + vec3(0.22, 0.16, 0.08) * 0.09;
  float curl = sin(vLocal.x * 7.0 + sin(vLocal.y * 5.0 + uTime * 0.16) * 1.7 + uTime * 0.12);
  float mist = pow(0.5 + 0.5 * curl, 5.0) * (1.0 - c * 0.55) * (0.5 + 0.5 * sin(vLocal.y * 4.0 - uTime * 0.13));
  colour += mix(vec3(0.32, 0.18, 0.10), vec3(0.45, 0.36, 0.16), vLocal.y * 0.5 + 0.5) * mist * 0.32;
  float alpha = (0.018 + mist * 0.055 + fresnel * 0.34 + rim * 0.28 + highlight * 0.28 + uHover * 0.016) * uOpacity * uFaceGain;
  gl_FragColor = vec4(colour, alpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export function Bubble({ layout, mobile, onEnter }) {
  const group = useRef(),
    front = useRef(),
    back = useRef(),
    hover = useRef(0);
  const { gl } = useThree();
  const target = useMemo(
    () => new THREE.WebGLCubeRenderTarget(128, { type: THREE.HalfFloatType }),
    [],
  );

  useEffect(() => {
    const room = new THREE.Scene();
    room.background = new THREE.Color("#0c0908");
    const panels = [];
    function light(w, h, pos, color, intensity) {
      const material = new THREE.MeshBasicMaterial({
        color: new THREE.Color(color).multiplyScalar(intensity),
        side: THREE.DoubleSide,
        toneMapped: false,
      });
      const panel = new THREE.Mesh(new THREE.PlaneGeometry(w, h), material);
      panel.position.set(...pos);
      panel.lookAt(0, 0, 0);
      room.add(panel);
      panels.push(panel);
    }
    light(1.1, 6, [-3, 2, 4], "#fff3dc", 3.2);
    light(0.35, 4, [4, 0.5, 2], "#f0cf7a", 1.7);
    light(5, 3, [0, -4, -3], "#7a2832", 0.68);
    light(2, 0.5, [1, 4, -1], "#fff8e8", 1.9);
    const cube = new THREE.CubeCamera(0.1, 30, target);
    cube.update(gl, room);
    panels.forEach((p) => {
      p.geometry.dispose();
      p.material.dispose();
    });
    return () => target.dispose();
  }, [gl, target]);

  const uniforms = useMemo(
    () => ({
      uEnv: { value: target.texture },
      uTime: { value: 0 },
      uThickness: { value: 350 },
      uOpacity: { value: 1 },
      uHover: { value: 0 },
      uFaceGain: { value: 1 },
      uWobble: { value: 0.007 },
      uRipple: { value: 0 },
      uRippleAge: { value: 0 },
      uSwell: { value: 0 },
      uRippleDir: { value: new THREE.Vector3(0, 0, 1) },
    }),
    [target],
  );

  useFrame(({ clock }, dt) => {
    const time = s.reduced ? 8 : clock.elapsedTime;
    if (s.rippleAt === Infinity) s.rippleAt = time;
    hover.current = lerp(
      hover.current,
      s.bubbleHover,
      1 - Math.exp(-2.8 * Math.min(dt, 0.1)),
    );
    const breathe = s.reduced ? 0 : Math.sin(time * 0.7) * 0.016;
    const radius = layout.radius * (1 + breathe + hover.current * 0.01);
    group.current.position.set(
      layout.bubbleX +
        s.pointer.x * 0.045 +
        (s.reduced ? 0 : Math.sin(time * 0.43) * layout.radius * 0.024),
      layout.bubbleY +
        (s.reduced ? 0 : Math.sin(time * 0.58) * layout.radius * 0.032) +
        s.pointer.y * 0.03,
      BUBBLE_Z,
    );
    group.current.scale.setScalar(radius);
    group.current.rotation.set(
      s.pointer.y * 0.025,
      s.reduced ? 0 : Math.sin(time * 0.22) * 0.16,
      0,
    );
    s.bubbleCenter.copy(group.current.position);
    s.bubbleRadius = radius;
    s.bubbleBase = layout.radius;
    const opacity =
      (1 - range(s.progress, JOURNEY.bubbleFade[0], JOURNEY.bubbleFade[1])) *
      (1 - s.outro);
    group.current.visible = opacity > 0.001;
    [front.current, back.current].forEach((mat, i) => {
      const u = mat.uniforms;
      u.uTime.value = time;
      u.uHover.value = hover.current;
      u.uOpacity.value = opacity;
      u.uFaceGain.value = i === 0 ? 1 : 0.17;
      u.uWobble.value = s.reduced
        ? 0
        : 0.13 + Math.min(s.pointerVelocity, 0.3) * 0.025;
      const age = Math.max(0, time - s.rippleAt);
      u.uRippleAge.value = age;
      u.uRipple.value = s.reduced ? 0 : Math.exp(-age * 1.2) * 0.012;
      u.uRippleDir.value.copy(s.rippleDir);
    });
  }, -1);

  const interactive = {
    onPointerOver: (e) => {
      if (s.progress > JOURNEY.zoomStart) return;
      e.stopPropagation();
      s.bubbleHover = 1;
      gl.domElement.style.cursor = "pointer";
    },
    onPointerOut: () => {
      s.bubbleHover = 0;
      if (!s.hoveredId) gl.domElement.style.cursor = "default";
    },
    onClick: (e) => {
      if (s.progress > JOURNEY.zoomStart) return;
      e.stopPropagation();
      s.rippleAt = Infinity;
      s.rippleDir.copy(e.point).sub(group.current.position).normalize();
      onEnter?.();
    },
  };

  return (
    <group ref={group}>
      <mesh renderOrder={19}>
        <sphereGeometry args={[1, mobile ? 48 : 64, mobile ? 32 : 48]} />
        <shaderMaterial
          ref={back}
          uniforms={uniforms}
          transparent
          depthWrite={false}
          side={THREE.BackSide}
          vertexShader={BUBBLE_VERTEX}
          fragmentShader={BUBBLE_FRAGMENT}
        />
      </mesh>
      <mesh renderOrder={20} {...interactive}>
        <sphereGeometry args={[1, mobile ? 48 : 64, mobile ? 32 : 48]} />
        <shaderMaterial
          ref={front}
          uniforms={uniforms}
          transparent
          depthWrite={false}
          side={THREE.FrontSide}
          vertexShader={BUBBLE_VERTEX}
          fragmentShader={BUBBLE_FRAGMENT}
        />
      </mesh>
    </group>
  );
}

export function usePointerTracking() {
  const raw = useRef(new THREE.Vector2());
  const previous = useRef(new THREE.Vector2());
  useEffect(() => {
    const move = (e) => {
      if (e.pointerType === "touch" || e.touches) return;
      if (e.clientX === undefined) return;
      raw.current.set(
        (e.clientX / innerWidth) * 2 - 1,
        -((e.clientY / innerHeight) * 2 - 1),
      );
    };
    const leave = () => raw.current.set(0, 0);
    addEventListener("pointermove", move, { passive: true });
    addEventListener("blur", leave);
    document.documentElement.addEventListener("pointerleave", leave);
    return () => {
      removeEventListener("pointermove", move);
      removeEventListener("blur", leave);
      document.documentElement.removeEventListener("pointerleave", leave);
    };
  }, []);
  useFrame((_, dt) => {
    if (s.reduced) {
      s.pointer.set(0, 0);
      s.pointerVelocity = 0;
      return;
    }
    const k = 1 - Math.exp(-3.2 * Math.min(dt, 0.1));
    if (matchMedia("(pointer: coarse)").matches)
      raw.current.set(0, (s.progress - 0.5) * 0.15);
    previous.current.copy(s.pointer);
    s.pointer.lerp(raw.current, k);
    s.pointerVelocity = lerp(
      s.pointerVelocity,
      Math.min(
        previous.current.distanceTo(s.pointer) / Math.max(dt, 0.001),
        6,
      ) * 0.1,
      k,
    );
  }, -3);
}
