// Automated asset builder for HK A 2025:
// 1. Chroma-keys raw-assets/themis-green.jpg -> public/character.png + calibrates src/characterMetrics.js
// 2. Generates 2.5D character & room depth/normal/noise textures in public/textures/
// 3. Generates all 6 sculpted 3D .glb models + 5 transparent portraits + bubble.png
import { chromium } from "playwright";
import { createServer } from "vite";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
await mkdir(path.join(ROOT, "public/props"), { recursive: true });
await mkdir(path.join(ROOT, "public/textures"), { recursive: true });
await mkdir(path.join(ROOT, "public/editorial"), { recursive: true });

const themisB64 =
  "data:image/jpeg;base64," +
  (await readFile(path.join(ROOT, "raw-assets/themis-green.jpg"))).toString(
    "base64",
  );
const roomB64 =
  "data:image/jpeg;base64," +
  (await readFile(path.join(ROOT, "raw-assets/courtroom-scene.jpg"))).toString(
    "base64",
  );

const vite = await createServer({
  root: ROOT,
  server: { port: 5194, strictPort: false, hmr: false, watch: null },
  logLevel: "error",
});
await vite.listen();
const address = vite.httpServer.address();
const baseUrl = `http://localhost:${address.port}`;
console.log("Asset build server at", baseUrl);

const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  const page = await browser.newPage();
  await page.goto(baseUrl + "/index.html?author=1", { waitUntil: "networkidle" });

  // Step 1: Process character chroma-key + depth/normal maps + room textures inside browser Canvas2D
  const imgAssets = await page.evaluate(
    async ({ themisSrc, roomSrc }) => {
      const loadImg = (src) =>
        new Promise((res, rej) => {
          const i = new Image();
          i.onload = () => res(i);
          i.onerror = rej;
          i.src = src;
        });

      const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
      const smoothstep = (e0, e1, x) => {
        const t = clamp((x - e0) / (e1 - e0));
        return t * t * (3 - 2 * t);
      };
      const byte = (v) => Math.max(0, Math.min(255, Math.round(v * 255)));

      function blurField(src, w, h, radius, passes = 2) {
        let a = Float32Array.from(src),
          b = new Float32Array(w * h);
        for (let p = 0; p < passes; p++) {
          for (let y = 0; y < h; y++) {
            let sum = 0;
            for (let x = -radius; x <= radius; x++)
              sum += a[y * w + clamp(x, 0, w - 1)];
            for (let x = 0; x < w; x++) {
              b[y * w + x] = sum / (radius * 2 + 1);
              sum -= a[y * w + clamp(x - radius, 0, w - 1)];
              sum += a[y * w + clamp(x + radius + 1, 0, w - 1)];
            }
          }
          for (let x = 0; x < w; x++) {
            let sum = 0;
            for (let y = -radius; y <= radius; y++)
              sum += b[clamp(y, 0, h - 1) * w + x];
            for (let y = 0; y < h; y++) {
              a[y * w + x] = sum / (radius * 2 + 1);
              sum -= b[clamp(y - radius, 0, h - 1) * w + x];
              sum += b[clamp(y + radius + 1, 0, h - 1) * w + x];
            }
          }
        }
        return a;
      }

      // --- A. Character Cutout & Metrics ---
      const themis = await loadImg(themisSrc);
      // Pad horizontally so her outstretched fingertips have clean breathing margin
      const padX = Math.round(themis.width * 0.14);
      const padTop = Math.round(themis.height * 0.03);
      const W = themis.width + padX * 2;
      const H = themis.height + padTop;

      const c = document.createElement("canvas");
      c.width = W;
      c.height = H;
      const ctx = c.getContext("2d");
      // Fill with corner green before keying so padded area keys cleanly
      const tmp = document.createElement("canvas");
      tmp.width = themis.width;
      tmp.height = themis.height;
      const tctx = tmp.getContext("2d");
      tctx.drawImage(themis, 0, 0);
      const cornerPx = tctx.getImageData(8, 8, 1, 1).data;
      ctx.fillStyle = `rgb(${cornerPx[0]},${cornerPx[1]},${cornerPx[2]})`;
      ctx.fillRect(0, 0, W, H);
      ctx.drawImage(themis, padX, padTop);

      const imgData = ctx.getImageData(0, 0, W, H);
      const d = imgData.data;
      const bgR = cornerPx[0] / 255,
        bgG = cornerPx[1] / 255,
        bgB = cornerPx[2] / 255;

      let minX = W,
        maxX = 0,
        minY = H,
        maxY = 0;
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const idx = (y * W + x) * 4;
          const r = d[idx] / 255,
            g = d[idx + 1] / 255,
            b = d[idx + 2] / 255;

          // Chroma distance + green dominance matting
          const greenExcess = g - Math.max(r * 0.92, b * 0.92);
          const bgExcess = bgG - Math.max(bgR * 0.92, bgB * 0.92);
          const ratio = greenExcess / Math.max(0.15, bgExcess);
          // ratio ~1 on green background, <=0 on subject
          const alpha = 1 - smoothstep(0.28, 0.72, ratio);

          // Spill suppression: clamp green channel where green spill exists
          if (g > Math.max(r, b)) {
            const cap = Math.max(r, b) * 0.96 + Math.min(r, b) * 0.04;
            const despill = alpha < 0.99 ? 1.0 : 0.65;
            d[idx + 1] = byte(g - (g - cap) * despill);
          }
          // Unpremultiply edge colors slightly for crisp dark silhouette
          d[idx + 3] = byte(alpha);

          if (alpha > 0.5) {
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
        }
      }
      ctx.putImageData(imgData, 0, 0);
      const characterPng = c.toDataURL("image/png");

      // Measure head/torso center X (rows 22% to 38% of height)
      let headSumX = 0,
        headCount = 0;
      for (let y = Math.round(H * 0.22); y < Math.round(H * 0.38); y++) {
        for (let x = 0; x < W; x++) {
          if (d[(y * W + x) * 4 + 3] > 180) {
            headSumX += x;
            headCount++;
          }
        }
      }
      const midX = headCount > 0 ? headSumX / headCount / W : 0.5;

      // Measure raised open palm centroid on viewer's right (x > midX + 0.14*W, y in [0.40*H, 0.56*H])
      let palmSumX = 0,
        palmSumY = 0,
        palmCount = 0;
      for (let y = Math.round(H * 0.41); y < Math.round(H * 0.55); y++) {
        for (let x = Math.round(W * (midX + 0.15)); x < W; x++) {
          const idx = (y * W + x) * 4;
          const a = d[idx + 3];
          const r = d[idx],
            g = d[idx + 1],
            b = d[idx + 2];
          // Warm skin pixels (exclude black blazer sleeve)
          if (a > 180 && r > 95 && r > b) {
            palmSumX += x;
            palmSumY += y;
            palmCount++;
          }
        }
      }
      const palmU =
        palmCount > 50 ? palmSumX / palmCount / W : midX + 0.28;
      const palmV = palmCount > 50 ? palmSumY / palmCount / H : 0.49;

      // --- B. Character Volume & Normal Maps (Chamfer distance transform) ---
      const CW = 768;
      const CH = Math.round((CW * H) / W);
      const sc = document.createElement("canvas");
      sc.width = CW;
      sc.height = CH;
      const sctx = sc.getContext("2d");
      sctx.drawImage(c, 0, 0, CW, CH);
      const sd = sctx.getImageData(0, 0, CW, CH).data;

      const INF = 1e9;
      const dist = new Float32Array(CW * CH);
      for (let i = 0; i < CW * CH; i++) dist[i] = sd[i * 4 + 3] > 127 ? INF : 0;
      const D1 = 1,
        D2 = Math.SQRT2;
      const relax = (i, j, cost) => {
        const v = dist[j] + cost;
        if (v < dist[i]) dist[i] = v;
      };
      for (let y = 0; y < CH; y++)
        for (let x = 0; x < CW; x++) {
          const i = y * CW + x;
          if (dist[i] === 0) continue;
          if (x > 0) relax(i, i - 1, D1);
          if (y > 0) relax(i, i - CW, D1);
          if (x > 0 && y > 0) relax(i, i - CW - 1, D2);
          if (x < CW - 1 && y > 0) relax(i, i - CW + 1, D2);
        }
      for (let y = CH - 1; y >= 0; y--)
        for (let x = CW - 1; x >= 0; x--) {
          const i = y * CW + x;
          if (dist[i] === 0) continue;
          if (x < CW - 1) relax(i, i + 1, D1);
          if (y < CH - 1) relax(i, i + CW, D1);
          if (x < CW - 1 && y < CH - 1) relax(i, i + CW + 1, D2);
          if (x > 0 && y < CH - 1) relax(i, i + CW - 1, D2);
        }

      const radius = CW * 0.15;
      const vol = new Float32Array(CW * CH);
      const interior = new Float32Array(CW * CH);
      for (let i = 0; i < CW * CH; i++) {
        vol[i] = Math.pow(clamp(dist[i] / radius), 0.55);
        interior[i] = smoothstep(0, 15, dist[i]);
      }
      const sVol = blurField(vol, CW, CH, 7, 2);
      const sInt = blurField(interior, CW, CH, 3, 1);

      const depthImg = sctx.createImageData(CW, CH);
      const normImg = sctx.createImageData(CW, CH);
      const strength = CW * 0.1;
      for (let y = 0; y < CH; y++) {
        for (let x = 0; x < CW; x++) {
          const i = y * CW + x;
          depthImg.data[i * 4] = byte(sVol[i]);
          depthImg.data[i * 4 + 1] = byte(sInt[i]);
          depthImg.data[i * 4 + 2] = sd[i * 4 + 3];
          depthImg.data[i * 4 + 3] = 255;

          const l = sVol[y * CW + Math.max(0, x - 1)],
            r = sVol[y * CW + Math.min(CW - 1, x + 1)],
            t = sVol[Math.max(0, y - 1) * CW + x],
            b = sVol[Math.min(CH - 1, y + 1) * CW + x];
          const dx = (r - l) * strength,
            dy = (b - t) * strength;
          const len = Math.hypot(dx, dy, 1);
          normImg.data[i * 4] = byte((-dx / len) * 0.5 + 0.5);
          normImg.data[i * 4 + 1] = byte((-dy / len) * 0.5 + 0.5);
          normImg.data[i * 4 + 2] = byte((1 / len) * 0.5 + 0.5);
          normImg.data[i * 4 + 3] = 255;
        }
      }
      sctx.putImageData(depthImg, 0, 0);
      const charDepthJpg = sc.toDataURL("image/jpeg", 0.94);
      sctx.putImageData(normImg, 0, 0);
      const charNormalJpg = sc.toDataURL("image/jpeg", 0.94);

      // --- C. Courtroom Scene + Analytic Depth/Normal + Noise ---
      const room = await loadImg(roomSrc);
      const roomOut = {};
      for (const [rw, suffix] of [
        [1600, ""],
        [960, "-mobile"],
      ]) {
        const rh = Math.round((rw * 9) / 16);
        const rc = document.createElement("canvas");
        rc.width = rw;
        rc.height = rh;
        const rctx = rc.getContext("2d");
        rctx.drawImage(room, 0, 0, rw, rh);
        roomOut["scene" + suffix] = rc.toDataURL("image/jpeg", 0.9);

        const rDepth = new Float32Array(rw * rh);
        const rdImg = rctx.createImageData(rw, rh);
        const rnImg = rctx.createImageData(rw, rh);
        for (let y = 0; y < rh; y++) {
          for (let x = 0; x < rw; x++) {
            const u = x / (rw - 1),
              v = y / (rh - 1);
            const dv = Math.max(
              Math.max(0, (v - 0.58) / 0.42) * 0.85,
              Math.pow(Math.abs(u - 0.5) * 2, 4) * 0.65,
            );
            rDepth[y * rw + x] = dv;
            const k = (y * rw + x) * 4;
            rdImg.data[k] = rdImg.data[k + 1] = rdImg.data[k + 2] = byte(dv);
            rdImg.data[k + 3] = 255;
          }
        }
        for (let y = 0; y < rh; y++) {
          for (let x = 0; x < rw; x++) {
            const dx =
              (rDepth[y * rw + Math.min(rw - 1, x + 1)] -
                rDepth[y * rw + Math.max(0, x - 1)]) *
              90;
            const dy =
              (rDepth[Math.min(rh - 1, y + 1) * rw + x] -
                rDepth[Math.max(0, y - 1) * rw + x]) *
              90;
            const len = Math.hypot(dx, dy, 1);
            const k = (y * rw + x) * 4;
            rnImg.data[k] = byte((-dx / len) * 0.5 + 0.5);
            rnImg.data[k + 1] = byte((-dy / len) * 0.5 + 0.5);
            rnImg.data[k + 2] = byte((1 / len) * 0.5 + 0.5);
            rnImg.data[k + 3] = 255;
          }
        }
        rctx.putImageData(rdImg, 0, 0);
        roomOut["scene-depth" + suffix] = rc.toDataURL("image/jpeg", 0.92);
        rctx.putImageData(rnImg, 0, 0);
        roomOut["scene-normal" + suffix] = rc.toDataURL("image/jpeg", 0.92);
      }

      // Noise texture
      const nc = document.createElement("canvas");
      nc.width = 128;
      nc.height = 128;
      const nctx = nc.getContext("2d");
      const nImg = nctx.createImageData(128, 128);
      let seed = 93281;
      for (let i = 0; i < 128 * 128; i++) {
        seed = (1664525 * seed + 1013904223) >>> 0;
        const val = Math.round((seed / 4294967296) * 255);
        nImg.data[i * 4] = nImg.data[i * 4 + 1] = nImg.data[i * 4 + 2] = val;
        nImg.data[i * 4 + 3] = 255;
      }
      nctx.putImageData(nImg, 0, 0);
      roomOut.noise = nc.toDataURL("image/jpeg", 0.95);

      return {
        characterPng,
        charDepthJpg,
        charNormalJpg,
        roomOut,
        metrics: {
          aspect: Number((W / H).toFixed(5)),
          body: {
            x0: Number((minX / W).toFixed(4)),
            y0: Number((minY / H).toFixed(4)),
            x1: Number((maxX / W).toFixed(4)),
            y1: Number((maxY / H).toFixed(4)),
          },
          midX: Number(midX.toFixed(4)),
          palm: {
            u: Number(palmU.toFixed(4)),
            v: Number(palmV.toFixed(4)),
          },
        },
      };
    },
    { themisSrc: themisB64, roomSrc: roomB64 },
  );

  const saveDataUrl = async (relPath, dataUrl) => {
    const b64 = dataUrl.split(",")[1];
    await writeFile(path.join(ROOT, relPath), Buffer.from(b64, "base64"));
  };

  await saveDataUrl("public/character.png", imgAssets.characterPng);
  await saveDataUrl(
    "public/textures/character-depth.jpg",
    imgAssets.charDepthJpg,
  );
  await saveDataUrl(
    "public/textures/character-normal.jpg",
    imgAssets.charNormalJpg,
  );
  for (const [k, url] of Object.entries(imgAssets.roomOut)) {
    await saveDataUrl(`public/textures/${k}.jpg`, url);
  }

  // Step 2: Generate 6 3D .glb models + 5 transparent portraits + bubble.png
  const threeAssets = await page.evaluate(async () => {
    const mod = await import("/src/lawModelsAuthor.js");
    return mod.generateAll3DAssets();
  });

  for (const [file, bytes] of Object.entries(threeAssets.models)) {
    await writeFile(
      path.join(ROOT, "public/props", file),
      Buffer.from(bytes),
    );
    console.log("Wrote 3D model:", file, bytes.length, "bytes");
  }
  for (const [id, pngUrl] of Object.entries(threeAssets.portraits)) {
    await saveDataUrl(`public/editorial/${id}.png`, pngUrl);
    console.log("Wrote portrait:", id + ".png");
  }
  await saveDataUrl("public/bubble.png", threeAssets.bubblePng);

  const metricsCode = `// Auto-calibrated by scripts/build-assets.mjs from public/character.png
export const CHAR_METRICS = ${JSON.stringify(imgAssets.metrics, null, 2)};
`;
  await writeFile(path.join(ROOT, "src/characterMetrics.js"), metricsCode);
  console.log("Calibrated CHAR_METRICS:", imgAssets.metrics);
  console.log("All assets built successfully!");
} finally {
  await browser.close();
  await vite.close();
}
