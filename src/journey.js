export const JOURNEY = Object.freeze({
  scrollVh: 220,
  scrub: 1.4,
  revealEnd: 0.16,
  zoomStart: 0.16,
  zoomEnd: 1.0,
  bubbleFade: [0.18, 0.44],
  propsFade: [0.2, 0.4],
  dollStart: 0.24,
  dollEnd: 0.78,
  panelStart: 0.5,
  panelEnd: 0.82,
});

export function range(value, start, end) {
  const t = Math.max(0, Math.min(1, (value - start) / (end - start)));
  return t * t * (3 - 2 * t);
}
