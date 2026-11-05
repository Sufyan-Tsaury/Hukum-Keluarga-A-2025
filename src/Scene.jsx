import React, { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  Environment,
  Lightformer,
  PerformanceMonitor,
  useGLTF,
  useProgress,
  useTexture,
} from "@react-three/drei";
import * as THREE from "three";
import { KTX2Loader } from "three-stdlib";
import { JOURNEY, range } from "./journey";
import { scrollState as s } from "./scrollState";
import {
  Bubble,
  HeroCharacter,
  HeroField,
  useHeroLayout,
  usePointerTracking,
} from "./Hero3D";

const lerp = THREE.MathUtils.lerp;
const BASE = import.meta.env.BASE_URL;

function configureLoader(loader, gl) {
  loader.setKTX2Loader(
    new KTX2Loader().setTranscoderPath(BASE + "basis/").detectSupport(gl),
  );
}

class ModelBoundary extends React.Component {
  constructor(p) {
    super(p);
    this.state = { bad: false };
  }
  static getDerivedStateFromError() {
    return { bad: true };
  }
  render() {
    return this.state.bad ? <FallbackModel /> : this.props.children;
  }
}

function FallbackModel() {
  const { scene } = useGLTF(BASE + "props/placeholder.glb");
  return <primitive object={scene.clone()} />;
}

function Model({ item }) {
  const { gl } = useThree();
  const { scene } = useGLTF(
    BASE + "props/" + item.file,
    BASE + "draco/",
    true,
    (loader) => configureLoader(loader, gl),
  );
  const clone = useMemo(() => {
    const obj = scene.clone(true);
    const box = new THREE.Box3().setFromObject(obj),
      size = box.getSize(new THREE.Vector3()),
      center = box.getCenter(new THREE.Vector3());
    obj.position.sub(center);
    const container = new THREE.Group();
    container.add(obj);
    container.scale.setScalar(1.6 / Math.max(size.x, size.y, size.z));
    obj.traverse((n) => {
      if (n.isMesh) {
        if (!n.geometry.attributes.normal) n.geometry.computeVertexNormals();
        n.layers.enable(1);
        n.material = n.material.clone();
        n.material.envMapIntensity = 1.35;
        n.userData.rim = { value: 0 };
        n.material.onBeforeCompile = (shader) => {
          shader.uniforms.uRim = n.userData.rim;
          shader.fragmentShader =
            "uniform float uRim;\n" + shader.fragmentShader;
          shader.fragmentShader = shader.fragmentShader.replace(
            "#include <emissivemap_fragment>",
            "#include <emissivemap_fragment>\n totalEmissiveRadiance += vec3(0.95,0.78,0.32) * pow(1.0-abs(dot(normal,normalize(vViewPosition))),2.8) * uRim;",
          );
        };
      }
    });
    return container;
  }, [scene]);
  return <primitive object={clone} />;
}

const SHOWCASE = {
  up: 1.12,
  side: -0.17,
  z: 0.5,
  scale: 0.6,
  upMobile: 1.14,
  sideMobile: -0.62,
  scaleMobile: 0.44,
};

function getShowcasePosition(mobile, out) {
  const r = s.bubbleRadius;
  return out.set(
    s.palmX + r * (mobile ? SHOWCASE.sideMobile : SHOWCASE.side),
    s.palmY + r * (mobile ? SHOWCASE.upMobile : SHOWCASE.up),
    SHOWCASE.z,
  );
}

function Prop({ item, index, count, progress, onCycleProp }) {
  const { gl } = useThree();
  const ref = useRef();
  const offset = useMemo(() => new THREE.Vector3(), []);
  const target = useMemo(() => new THREE.Vector3(), []);
  const showcase = useMemo(() => new THREE.Vector3(), []);
  const bound = 1.39;
  const presence = useRef(item.id === s.selectedId ? 1 : 0);
  const rimLevel = useRef(0);

  useFrame(({ clock }, dt) => {
    if (!ref.current) return;
    const p = progress.current;
    const time = s.reduced ? 0 : clock.elapsedTime;
    const mobile = innerWidth < 700;
    const angle = Math.PI / 2 + (index * Math.PI * 2) / count;
    const a = [
      Math.cos(angle) * 0.31,
      Math.sin(angle) * 0.31,
      index % 2 ? -0.06 : 0.04,
    ];
    const base = s.bubbleBase;
    const heroScale = base * (count > 4 ? 0.24 : 0.29);

    offset
      .set(
        a[0] + Math.sin(time * 0.57 + index) * 0.1,
        a[1] + Math.sin(time * 0.68 + index * 1.7) * 0.11,
        a[2] + Math.cos(time * 0.43 + index) * 0.09,
      )
      .multiplyScalar(base);
    const maxOffset = Math.max(0, s.bubbleRadius * 0.84 - bound * heroScale);
    if (offset.length() > maxOffset) offset.setLength(maxOffset);
    target.copy(s.bubbleCenter).add(offset);

    const selected = item.id === s.selectedId;
    presence.current = s.reduced
      ? Number(selected)
      : lerp(presence.current, Number(selected), 1 - Math.exp(-4.2 * dt));
    rimLevel.current = s.reduced
      ? selected
        ? s.propHover
        : 0
      : lerp(
          rimLevel.current,
          selected ? s.propHover : 0,
          1 - Math.exp(-6 * Math.min(dt, 0.1)),
        );

    if (p > JOURNEY.dollStart || selected) {
      const rise = range(p, JOURNEY.dollStart, JOURNEY.dollEnd);
      const r = s.bubbleRadius;
      getShowcasePosition(mobile, showcase);
      if (!s.reduced) {
        showcase.x +=
          Math.sin(time * 0.67 + index * 0.6) * r * (mobile ? 0.035 : 0.06);
        showcase.y += Math.sin(time * 0.93 + index * 0.7) * r * 0.08;
        showcase.z += Math.sin(time * 0.58 + index) * 0.04;
      }
      target.lerp(showcase, rise);
      const weight = presence.current;
      const hoverBoost = s.reduced ? 0 : rimLevel.current * 0.04 * weight * rise;
      const scale =
        lerp(
          heroScale,
          (mobile ? SHOWCASE.scaleMobile : SHOWCASE.scale) *
            (0.72 + weight * 0.28),
          rise,
        ) *
        (1 + hoverBoost);
      target.x += (1 - weight) * rise * 0.35;
      target.z -= (1 - weight) * rise * 0.3;
      ref.current.position.copy(target);
      ref.current.scale.setScalar(scale);
      ref.current.rotation.set(
        lerp(Math.sin(time * 0.48) * 0.22, Math.sin(time * 0.81) * 0.12, rise),
        lerp(
          Math.sin(time * 0.37) * 0.48,
          Math.sin(time * 0.55) * 0.36 + (1 - weight) * 1.5,
          rise,
        ),
        lerp(Math.sin(time * 0.43) * 0.18, Math.sin(time * 0.74) * 0.1, rise),
      );
      ref.current.visible =
        s.outro < 0.999 && (rise < 0.999 || weight > 0.005);
      ref.current.traverse((n) => {
        if (n.isMesh && n.material) {
          const mats = Array.isArray(n.material) ? n.material : [n.material];
          mats.forEach((m) => {
            m.transparent = true;
            const baseOpacity = m.userData.baseOpacity ?? (m.opacity < 1 ? m.opacity : 1);
            m.userData.baseOpacity = baseOpacity;
            m.opacity = baseOpacity * lerp(1, weight, rise);
            m.envMapIntensity = 1.35;
          });
          if (n.userData.rim)
            n.userData.rim.value = rimLevel.current * 0.65 * weight * rise;
        }
      });
      return;
    }

    const fade = range(p, JOURNEY.propsFade[0], JOURNEY.propsFade[1]);
    ref.current.position.copy(target);
    ref.current.scale.setScalar(heroScale);
    ref.current.rotation.set(
      Math.sin(time * 0.48 + index) * 0.22,
      Math.sin(time * 0.37 + index) * 0.48,
      Math.sin(time * 0.43 + index) * 0.18,
    );
    ref.current.visible = fade < 0.999 && s.outro < 0.999;
    ref.current.traverse((n) => {
      if (n.isMesh && n.material) {
        const mats = Array.isArray(n.material) ? n.material : [n.material];
        mats.forEach((m) => {
          m.transparent = true;
          const baseOpacity = m.userData.baseOpacity ?? (m.opacity < 1 ? m.opacity : 1);
          m.userData.baseOpacity = baseOpacity;
          m.opacity = baseOpacity * (1 - fade);
        });
        if (n.userData.rim) n.userData.rim.value = 0;
      }
    });
  });

  return (
    <group
      ref={ref}
      onPointerOver={(e) => {
        if (s.progress <= JOURNEY.bubbleFade[1] || item.id !== s.selectedId)
          return;
        e.stopPropagation();
        s.hoveredId = item.id;
        s.propHover = 1;
        gl.domElement.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        if (s.hoveredId === item.id) {
          s.hoveredId = null;
          s.propHover = 0;
          if (!s.bubbleHover) gl.domElement.style.cursor = "default";
        }
      }}
      onClick={(e) => {
        if (
          s.progress <= JOURNEY.bubbleFade[1] ||
          item.id !== s.selectedId ||
          e.delta > 12
        )
          return;
        e.stopPropagation();
        onCycleProp?.();
      }}
    >
      <ModelBoundary>
        <Suspense fallback={null}>
          <Model item={item} />
        </Suspense>
      </ModelBoundary>
    </group>
  );
}

function ShowcaseHitTarget({ mobile, onCycleProp }) {
  const { gl } = useThree();
  const ref = useRef();
  useFrame(() => {
    if (!ref.current) return;
    const active = s.progress > JOURNEY.bubbleFade[1] && s.outro < 0.999;
    ref.current.visible = active;
    if (!active && s.hoveredId === "showcase") {
      s.hoveredId = null;
      s.propHover = 0;
      if (!s.bubbleHover) gl.domElement.style.cursor = "default";
    }
    getShowcasePosition(mobile, ref.current.position);
  });
  return (
    <mesh
      ref={ref}
      onPointerOver={(e) => {
        if (s.progress <= JOURNEY.bubbleFade[1]) return;
        e.stopPropagation();
        s.hoveredId = "showcase";
        s.propHover = 1;
        gl.domElement.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        if (s.hoveredId === "showcase") {
          s.hoveredId = null;
          s.propHover = 0;
          if (!s.bubbleHover) gl.domElement.style.cursor = "default";
        }
      }}
      onClick={(e) => {
        if (s.progress <= JOURNEY.bubbleFade[1] || e.delta > 12) return;
        e.stopPropagation();
        onCycleProp?.();
      }}
    >
      <capsuleGeometry
        args={mobile ? [0.28, 0.26, 8, 16] : [0.38, 0.36, 8, 16]}
      />
      <meshBasicMaterial
        transparent
        opacity={0}
        depthWrite={false}
        colorWrite={false}
      />
    </mesh>
  );
}

function FloatingJusticeStars() {
  const ref = useRef();
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const reveal = range(s.progress, JOURNEY.panelStart, 0.85);
    const t = s.reduced ? 0 : clock.elapsedTime;
    ref.current.visible = reveal > 0.001;
    ref.current.children.forEach((star, i) => {
      const angle = (i * Math.PI * 2) / 5 + t * 0.14;
      const mobile = innerWidth < 700;
      const r = s.bubbleRadius;
      const cx = s.palmX + r * (mobile ? SHOWCASE.sideMobile : SHOWCASE.side);
      const cy = s.palmY + r * (mobile ? SHOWCASE.upMobile : SHOWCASE.up);
      star.position.set(
        cx + Math.cos(angle) * (mobile ? 0.36 : 0.68),
        cy + Math.sin(angle) * (mobile ? 0.3 : 0.46),
        0.18 + Math.sin(angle) * 0.22,
      );
      star.rotation.set(0, t * 0.6 + i, Math.sin(t * 0.4 + i) * 0.2);
      star.scale.setScalar((0.06 + (i % 2) * 0.018) * reveal);
    });
  });
  return (
    <group ref={ref}>
      {Array.from({ length: 5 }, (_, i) => (
        <group key={i}>
          <ModelBoundary>
            <Suspense fallback={null}>
              <Model item={{ id: "star", file: "emblem_star.glb" }} />
            </Suspense>
          </ModelBoundary>
        </group>
      ))}
    </group>
  );
}

function Atmosphere({ progress }) {
  const ref = useRef();
  const texture = useTexture(
    innerWidth < 700
      ? BASE + "textures/scene-mobile.jpg"
      : BASE + "textures/scene.jpg",
  );
  texture.colorSpace = THREE.SRGBColorSpace;
  const suffix = innerWidth < 700 ? "-mobile" : "";
  const [depthMap, normalMap, noiseMap] = useTexture([
    BASE + "textures/scene-depth" + suffix + ".jpg",
    BASE + "textures/scene-normal" + suffix + ".jpg",
    BASE + "textures/noise.jpg",
  ]);
  [depthMap, normalMap, noiseMap].forEach((t) => {
    t.colorSpace = THREE.NoColorSpace;
    t.minFilter = THREE.LinearFilter;
    t.magFilter = THREE.LinearFilter;
  });
  noiseMap.wrapS = noiseMap.wrapT = THREE.RepeatWrapping;

  const uniforms = useMemo(
    () => ({
      uScene: { value: texture },
      uDepth: { value: depthMap },
      uNormal: { value: normalMap },
      uNoise: { value: noiseMap },
      uFogStrength: { value: 0.11 },
      uParticleDensity: { value: 0.22 },
      uIntensity: { value: 0 },
      uTime: { value: 0 },
      uPointer: { value: new THREE.Vector2() },
      uFogWarm: { value: new THREE.Color("#D4AF37") },
      uFogCool: { value: new THREE.Color("#5A1D28") },
    }),
    [],
  );

  useFrame(({ clock }, dt) => {
    const live = ref.current.material.uniforms;
    live.uTime.value = s.reduced ? 0 : clock.elapsedTime;
    live.uIntensity.value =
      range(progress.current, 0.58, 0.81) * (1 - s.outro);
    live.uPointer.value.lerp(
      innerWidth < 700
        ? new THREE.Vector2(0, progress.current * 0.4)
        : s.pointer,
      1 - Math.pow(0.001, dt),
    );
  });

  return (
    <mesh ref={ref} frustumCulled={false} renderOrder={-100}>
      <planeGeometry args={[2, 2, 1, 1]} />
      <shaderMaterial
        depthTest={false}
        depthWrite={false}
        transparent={false}
        uniforms={uniforms}
        vertexShader="varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.999, 1.0); }"
        fragmentShader={`varying vec2 vUv;uniform sampler2D uScene;uniform sampler2D uDepth;uniform sampler2D uNormal;uniform sampler2D uNoise;uniform float uFogStrength;uniform float uParticleDensity;uniform float uIntensity;uniform float uTime;uniform vec2 uPointer;uniform vec3 uFogWarm;uniform vec3 uFogCool;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}void main(){if(uIntensity<.001)discard;vec2 uv=vUv+uPointer*.025;float n=noise(uv*5.+vec2(uTime*.015,0.));n+=noise(uv*12.-uTime*.012)*.35;float fog=pow(1.-vUv.y,2.)*n*uFogStrength;float depth=texture2D(uDepth,vUv).r;vec3 normal=texture2D(uNormal,vUv).rgb*2.-1.;vec2 sceneUv=vUv+uPointer*.015*depth+normal.xy*.001;vec3 room=texture2D(uScene,sceneUv).rgb;vec3 c=room*.48+vec3(.016,.011,.007)+uFogWarm*fog+uFogCool*n*.035*vUv.y;float vignette=smoothstep(.2,.82,length(vUv-.5));c*=1.-vignette*.48;float dust=step(.998,texture2D(uNoise,vUv*2.+vec2(uTime*.002,0.)).r)*uParticleDensity;c+=uFogWarm*dust*.14;gl_FragColor=vec4(c,uIntensity);
#include <tonemapping_fragment>
#include <colorspace_fragment>
gl_FragColor.rgb*=uIntensity;
}`}
      />
    </mesh>
  );
}

function World({ items, onEnterBubble, onCycleProp }) {
  const { camera, gl, scene, size } = useThree();
  const layout = useHeroLayout();
  const mobile = size.width < 700;
  usePointerTracking();
  const cluster = useRef(),
    progress = useRef(0);
  const target = useMemo(() => new THREE.Vector3(), []),
    look = useMemo(() => new THREE.Vector3(), []),
    cameraLook = useMemo(() => new THREE.Vector3(), []);
  const heroEnv = useMemo(() => new THREE.Scene(), []);
  const lastPhase = useRef("");

  useEffect(() => {
    items.forEach((item) =>
      useGLTF.preload(
        BASE + "props/" + item.file,
        BASE + "draco/",
        true,
        (loader) => configureLoader(loader, gl),
      ),
    );
  }, [gl, items]);

  useFrame((_, dt) => {
    const k = 1 - Math.pow(0.001, Math.min(dt, 0.1));
    progress.current = s.progress;
    const p = progress.current;
    const phase = p > JOURNEY.zoomStart ? "ZOOM" : "HERO";
    s.phase = phase;
    if (lastPhase.current !== phase) {
      gl.domElement.closest(".canvas-container").style.pointerEvents = "auto";
      lastPhase.current = phase;
    }
    if (heroEnv.environment) scene.environment = heroEnv.environment;

    const zoom = range(p, JOURNEY.zoomStart, JOURNEY.zoomEnd);
    const K = mobile ? 0.66 : 0.72;
    const aimX = s.palmX * (mobile ? 0.72 : 0.9) * K;
    const aimY = mobile
      ? layout.palmY + layout.radius * 0.46
      : (layout.palmY + layout.radius * 0.42) * K;
    const endZ = mobile ? 4.02 : 3.3;
    target.set(lerp(0, aimX, zoom), lerp(0, aimY, zoom), lerp(6, endZ, zoom));
    look.set(lerp(0, aimX, zoom), lerp(0, aimY, zoom), 0);
    camera.position.lerp(target, k);
    cameraLook.lerp(look, k);
    camera.lookAt(cameraLook);
    gl.domElement.style.opacity = 1 - s.outro;
  }, -2);

  return (
    <>
      <ambientLight intensity={0.95} />
      <directionalLight position={[2, 4, 5]} intensity={2.5} color="#fff4de" />
      <Atmosphere progress={progress} />
      <Suspense fallback={null}>
        <HeroField mobile={mobile} />
        <HeroCharacter layout={layout} mobile={mobile} />
      </Suspense>
      <Environment
        scene={heroEnv}
        resolution={256}
        frames={1}
        background={false}
      >
        <Lightformer
          form="rect"
          intensity={2.4}
          color="#D4AF37"
          scale={[14, 14, 1]}
          position={[0, 0, -6]}
        />
        <Lightformer
          form="rect"
          intensity={4.2}
          color="#FFF7E8"
          scale={[3, 8, 1]}
          position={[-4, 2, 3]}
          rotation={[0, Math.PI / 3, 0]}
        />
        <Lightformer
          form="ring"
          intensity={6}
          color="#FFE8AE"
          scale={1.2}
          position={[3.5, 3, 2]}
        />
        <Lightformer
          form="rect"
          intensity={0.22}
          color="#3A1219"
          scale={[10, 10, 1]}
          position={[0, -5, 2]}
        />
      </Environment>
      <group ref={cluster}>
        {items.map((item, i) => (
          <Prop
            key={item.id}
            item={item}
            index={i}
            count={items.length}
            progress={progress}
            onCycleProp={onCycleProp}
          />
        ))}
      </group>
      <ShowcaseHitTarget mobile={mobile} onCycleProp={onCycleProp} />
      <FloatingJusticeStars />
      <Bubble layout={layout} mobile={mobile} onEnter={onEnterBubble} />
    </>
  );
}

export default function Scene(props) {
  const [dpr, setDpr] = useState(() =>
    typeof window !== "undefined"
      ? Math.min(window.devicePixelRatio || 2, 2)
      : 2,
  );
  const [active, setActive] = useState(true);
  useEffect(() => {
    const onVisibility = () => setActive(!document.hidden);
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);
  return (
    <div className="canvas-container">
      <Canvas
        camera={{ position: [0, 0, 6], fov: 45, near: 0.05, far: 100 }}
        dpr={dpr}
        frameloop={active ? "always" : "never"}
        gl={{ alpha: true, antialias: true, powerPreference: "high-performance" }}
        onCreated={({ gl }) => {
          gl.outputColorSpace = THREE.SRGBColorSpace;
          gl.domElement.addEventListener("webglcontextlost", props.onFail);
        }}
      >
        <PerformanceMonitor onDecline={() => setDpr(1.5)} />
        <Suspense fallback={null}>
          <World {...props} />
        </Suspense>
      </Canvas>
    </div>
  );
}

export function SceneLoader() {
  const { active, progress } = useProgress();
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    if (active) {
      setVisible(true);
      return;
    }
    const timer = setTimeout(
      () => setVisible(false),
      matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 900,
    );
    return () => clearTimeout(timer);
  }, [active]);
  return visible ? (
    <div className="scene-loader" data-loading={active} role="status">
      <span>HK A ⚖</span>
      <p>Membuka ruang keadilan · Chapter of Us.</p>
      <div className="loading-rule">
        <i style={{ transform: `scaleX(${progress / 100})` }} />
      </div>
      <small>{Math.round(progress)}%</small>
    </div>
  ) : null;
}
