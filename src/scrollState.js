import * as THREE from "three";

export const scrollState = {
  progress: 0,
  selectedId: "web-kelas",
  propBounds: {},
  phase: "HERO",
  focusedId: null,
  hoveredId: null,
  outro: 0,
  entrance: 0,
  reduced: false,

  pointer: new THREE.Vector2(),
  pointerVelocity: 0,
  bubbleCenter: new THREE.Vector3(),
  bubbleRadius: 0.8,
  bubbleBase: 0.8,
  bubbleHover: 0,
  propHover: 0,
  rippleAt: -10,
  rippleDir: new THREE.Vector3(0, 0, 1),

  palmX: 0,
  palmY: 0,
};

if (import.meta.env.DEV) window.__hkDebug = { state: scrollState };
