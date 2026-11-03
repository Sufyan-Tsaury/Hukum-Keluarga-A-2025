// Authoring utility (invoked by scripts/build-assets.mjs in headless Chrome):
// Generates 6 sculpted PBR .glb models + 5 transparent studio portraits + bubble.png
// + chroma-keyed character.png + 2.5D depth & normal maps.
import * as THREE from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

function makeWoodTexture(baseHex = "#4a2218", grainHex = "#240d08") {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 512;
  const ctx = c.getContext("2d");
  ctx.fillStyle = baseHex;
  ctx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 240; i++) {
    const y = (i / 240) * 512;
    ctx.strokeStyle = i % 3 === 0 ? grainHex : "rgba(120,62,40,0.28)";
    ctx.lineWidth = 1 + (i % 4) * 0.7;
    ctx.beginPath();
    for (let x = 0; x <= 512; x += 16) {
      const wy = y + Math.sin(x * 0.025 + i * 0.7) * 5;
      if (x === 0) ctx.moveTo(x, wy);
      else ctx.lineTo(x, wy);
    }
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function makeBookCoverTexture() {
  const c = document.createElement("canvas");
  c.width = 768;
  c.height = 1024;
  const ctx = c.getContext("2d");

  // Deep crimson leather base
  const grad = ctx.createLinearGradient(0, 0, 768, 1024);
  grad.addColorStop(0, "#5e1522");
  grad.addColorStop(0.5, "#470e18");
  grad.addColorStop(1, "#2f0810");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 768, 1024);

  // Subtle leather grain speckles
  ctx.fillStyle = "rgba(255,215,150,0.03)";
  for (let i = 0; i < 4000; i++) {
    const x = (Math.sin(i * 12.9898) * 43758.5453) % 1;
    const y = (Math.sin(i * 78.233) * 29432.123) % 1;
    ctx.fillRect(Math.abs(x) * 768, Math.abs(y) * 1024, 2, 2);
  }

  // Ornate double gold border
  ctx.strokeStyle = "#e0b84c";
  ctx.lineWidth = 10;
  ctx.strokeRect(54, 54, 660, 916);
  ctx.lineWidth = 4;
  ctx.strokeRect(74, 74, 620, 876);

  // Corner flourishes
  const corners = [
    [54, 54],
    [714, 54],
    [54, 970],
    [714, 970],
  ];
  ctx.fillStyle = "#e0b84c";
  for (const [cx, cy] of corners) {
    ctx.beginPath();
    ctx.arc(cx, cy, 18, 0, Math.PI * 2);
    ctx.fill();
  }

  // Scales of Justice emblem in the middle
  ctx.strokeStyle = "#f0cc68";
  ctx.fillStyle = "#f0cc68";
  ctx.lineWidth = 9;
  ctx.lineCap = "round";
  // Pillar
  ctx.beginPath();
  ctx.moveTo(384, 340);
  ctx.lineTo(384, 560);
  ctx.moveTo(324, 560);
  ctx.lineTo(444, 560);
  // Beam
  ctx.moveTo(264, 385);
  ctx.lineTo(504, 385);
  ctx.stroke();
  // Pans
  for (const px of [264, 504]) {
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(px, 385);
    ctx.lineTo(px - 38, 468);
    ctx.moveTo(px, 385);
    ctx.lineTo(px + 38, 468);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(px, 468, 42, 0, Math.PI, false);
    ctx.fill();
  }

  // Gold-leaf typography
  ctx.fillStyle = "#f5d77f";
  ctx.textAlign = "center";
  ctx.font = "bold 58px Georgia, serif";
  ctx.fillText("KITAB HUKUM", 384, 210);
  ctx.font = "bold 64px Georgia, serif";
  ctx.fillText("KELUARGA", 384, 282);

  ctx.font = "600 32px Georgia, serif";
  ctx.fillStyle = "#dfc06c";
  ctx.fillText("CHAPTER OF US", 384, 760);
  ctx.font = "bold 40px Georgia, serif";
  ctx.fillText("HK A · 2025", 384, 822);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makePolaroidTexture() {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 620;
  const ctx = c.getContext("2d");

  // Cream polaroid card
  ctx.fillStyle = "#f5efe4";
  ctx.fillRect(0, 0, 512, 620);

  // Inner warm golden-hour memory frame
  const g = ctx.createLinearGradient(36, 36, 476, 476);
  g.addColorStop(0, "#241310");
  g.addColorStop(0.55, "#6b262c");
  g.addColorStop(1, "#d4af37");
  ctx.fillStyle = g;
  ctx.fillRect(36, 36, 440, 440);

  // Sunburst / lens flare + silhouettes
  ctx.fillStyle = "rgba(255, 232, 175, 0.26)";
  ctx.beginPath();
  ctx.arc(256, 210, 110, 0, Math.PI * 2);
  ctx.fill();

  // Stylized silhouettes of classmates together
  ctx.fillStyle = "#180d0b";
  const heads = [125, 190, 256, 322, 387];
  heads.forEach((hx, idx) => {
    const hy = 310 + (idx % 2) * 14;
    ctx.beginPath();
    ctx.arc(hx, hy, 28, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(hx, hy + 95, 56, Math.PI, 0, false);
    ctx.fill();
  });
  ctx.fillRect(36, 395, 440, 81);

  // Caption on Polaroid bottom margin
  ctx.fillStyle = "#2b1915";
  ctx.textAlign = "center";
  ctx.font = "bold 30px Georgia, serif";
  ctx.fillText("Chapter of Us · HK A", 256, 548);
  ctx.font = "22px sans-serif";
  ctx.fillStyle = "#6e554c";
  ctx.fillText("Hukum Keluarga 2025", 256, 584);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// 1. GAVEL & SOUND BLOCK (Web Kelas)
function buildGavel() {
  const group = new THREE.Group();
  const woodMap = makeWoodTexture("#592619", "#2a0e08");
  const wood = new THREE.MeshStandardMaterial({
    map: woodMap,
    roughness: 0.42,
    metalness: 0.08,
  });
  const gold = new THREE.MeshStandardMaterial({
    color: "#e2ba52",
    roughness: 0.24,
    metalness: 0.88,
  });

  // Sound block base
  const blockPts = [
    new THREE.Vector2(0, -0.14),
    new THREE.Vector2(0.58, -0.14),
    new THREE.Vector2(0.6, -0.07),
    new THREE.Vector2(0.54, -0.03),
    new THREE.Vector2(0.5, 0.04),
    new THREE.Vector2(0.46, 0.08),
    new THREE.Vector2(0, 0.08),
  ];
  const block = new THREE.Mesh(new THREE.LatheGeometry(blockPts, 48), wood);
  block.position.set(-0.12, -0.52, 0);
  group.add(block);

  const blockRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.52, 0.022, 16, 48),
    gold,
  );
  blockRing.rotation.x = Math.PI / 2;
  blockRing.position.set(-0.12, -0.5, 0);
  group.add(blockRing);

  // Poised gavel assembly
  const gavel = new THREE.Group();
  const headPts = [
    new THREE.Vector2(0, -0.42),
    new THREE.Vector2(0.21, -0.42),
    new THREE.Vector2(0.24, -0.36),
    new THREE.Vector2(0.22, -0.22),
    new THREE.Vector2(0.18, 0),
    new THREE.Vector2(0.22, 0.22),
    new THREE.Vector2(0.24, 0.36),
    new THREE.Vector2(0.21, 0.42),
    new THREE.Vector2(0, 0.42),
  ];
  const head = new THREE.Mesh(new THREE.LatheGeometry(headPts, 40), wood);
  head.rotation.z = Math.PI / 2;
  gavel.add(head);

  // Center gold band + twin accent rings on mallet head
  const centerBand = new THREE.Mesh(
    new THREE.CylinderGeometry(0.186, 0.186, 0.16, 40),
    gold,
  );
  centerBand.rotation.z = Math.PI / 2;
  gavel.add(centerBand);

  for (const sx of [-0.27, 0.27]) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.222, 0.014, 14, 40),
      gold,
    );
    ring.rotation.y = Math.PI / 2;
    ring.position.x = sx;
    gavel.add(ring);
  }

  // Turned handle
  const handlePts = [
    new THREE.Vector2(0, 0),
    new THREE.Vector2(0.065, 0.02),
    new THREE.Vector2(0.052, 0.45),
    new THREE.Vector2(0.072, 0.88),
    new THREE.Vector2(0.088, 1.08),
    new THREE.Vector2(0.055, 1.16),
    new THREE.Vector2(0, 1.18),
  ];
  const handle = new THREE.Mesh(new THREE.LatheGeometry(handlePts, 32), wood);
  handle.rotation.z = -Math.PI / 2;
  handle.position.set(0.05, 0, 0);
  gavel.add(handle);

  const pommel = new THREE.Mesh(
    new THREE.TorusGeometry(0.075, 0.014, 14, 32),
    gold,
  );
  pommel.rotation.y = Math.PI / 2;
  pommel.position.set(0.95, 0, 0);
  gavel.add(pommel);

  gavel.position.set(-0.22, 0.18, 0.06);
  gavel.rotation.set(0.22, -0.32, -0.46);
  group.add(gavel);
  return group;
}

// 2. VINTAGE BRASS CAMERA + POLAROID (Galeri Kelas)
function buildGaleri() {
  const group = new THREE.Group();
  const leather = new THREE.MeshStandardMaterial({
    color: "#1b1716",
    roughness: 0.72,
    metalness: 0.12,
  });
  const brass = new THREE.MeshStandardMaterial({
    color: "#e2bc59",
    roughness: 0.26,
    metalness: 0.86,
  });
  const darkMetal = new THREE.MeshStandardMaterial({
    color: "#2a2625",
    roughness: 0.35,
    metalness: 0.78,
  });
  const lensGlass = new THREE.MeshStandardMaterial({
    color: "#182838",
    emissive: "#243b55",
    emissiveIntensity: 0.35,
    roughness: 0.08,
    metalness: 0.92,
  });

  const cam = new THREE.Group();
  // Rounded body via extruded rounded rect
  const shape = new THREE.Shape();
  const bw = 1.08,
    bh = 0.66,
    br = 0.1;
  shape.moveTo(-bw / 2 + br, -bh / 2);
  shape.lineTo(bw / 2 - br, -bh / 2);
  shape.quadraticCurveTo(bw / 2, -bh / 2, bw / 2, -bh / 2 + br);
  shape.lineTo(bw / 2, bh / 2 - br);
  shape.quadraticCurveTo(bw / 2, bh / 2, bw / 2 - br, bh / 2);
  shape.lineTo(-bw / 2 + br, bh / 2);
  shape.quadraticCurveTo(-bw / 2, bh / 2, -bw / 2, bh / 2 - br);
  shape.lineTo(-bw / 2, -bh / 2 + br);
  shape.quadraticCurveTo(-bw / 2, -bh / 2, -bw / 2 + br, -bh / 2);

  const bodyGeo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.34,
    bevelEnabled: true,
    bevelThickness: 0.03,
    bevelSize: 0.025,
    bevelSegments: 4,
  });
  bodyGeo.center();
  cam.add(new THREE.Mesh(bodyGeo, leather));

  // Brass top plate
  const topGeo = new THREE.BoxGeometry(1.11, 0.15, 0.39);
  const topPlate = new THREE.Mesh(topGeo, brass);
  topPlate.position.y = 0.29;
  cam.add(topPlate);

  // Bottom brass trim
  const botPlate = new THREE.Mesh(
    new THREE.BoxGeometry(1.11, 0.055, 0.39),
    brass,
  );
  botPlate.position.y = -0.33;
  cam.add(botPlate);

  // Dials & shutter button
  const dial1 = new THREE.Mesh(
    new THREE.CylinderGeometry(0.1, 0.1, 0.09, 28),
    brass,
  );
  dial1.position.set(0.34, 0.4, 0);
  cam.add(dial1);

  const shutter = new THREE.Mesh(
    new THREE.CylinderGeometry(0.042, 0.042, 0.13, 20),
    darkMetal,
  );
  shutter.position.set(0.16, 0.41, 0.04);
  cam.add(shutter);

  const rewind = new THREE.Mesh(
    new THREE.CylinderGeometry(0.075, 0.085, 0.08, 24),
    brass,
  );
  rewind.position.set(-0.36, 0.4, 0);
  cam.add(rewind);

  // Viewfinder window
  const vf = new THREE.Mesh(
    new THREE.BoxGeometry(0.18, 0.09, 0.03),
    lensGlass,
  );
  vf.position.set(-0.28, 0.29, 0.19);
  cam.add(vf);

  // Stepped lens barrel
  const barrel1 = new THREE.Mesh(
    new THREE.CylinderGeometry(0.3, 0.32, 0.14, 40),
    brass,
  );
  barrel1.rotation.x = Math.PI / 2;
  barrel1.position.set(0.04, -0.02, 0.24);
  cam.add(barrel1);

  const barrel2 = new THREE.Mesh(
    new THREE.CylinderGeometry(0.26, 0.28, 0.16, 40),
    darkMetal,
  );
  barrel2.rotation.x = Math.PI / 2;
  barrel2.position.set(0.04, -0.02, 0.35);
  cam.add(barrel2);

  const frontRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.245, 0.022, 16, 40),
    brass,
  );
  frontRing.position.set(0.04, -0.02, 0.43);
  cam.add(frontRing);

  const glass = new THREE.Mesh(
    new THREE.SphereGeometry(0.23, 32, 20, 0, Math.PI * 2, 0, Math.PI * 0.38),
    lensGlass,
  );
  glass.rotation.x = Math.PI / 2;
  glass.position.set(0.04, -0.02, 0.34);
  cam.add(glass);

  cam.position.set(-0.14, -0.12, 0.12);
  cam.rotation.set(0.08, 0.28, -0.08);
  group.add(cam);

  // Floating Polaroid photo card behind/right of camera
  const polaroidTex = makePolaroidTexture();
  const cardGeo = new THREE.BoxGeometry(0.78, 0.94, 0.018, 16, 20, 1);
  const pos = cardGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    pos.setZ(i, pos.getZ(i) + 0.04 * x * x);
  }
  cardGeo.computeVertexNormals();
  const cardEdge = new THREE.MeshStandardMaterial({
    color: "#efe7d8",
    roughness: 0.85,
  });
  const cardFront = new THREE.MeshStandardMaterial({
    map: polaroidTex,
    roughness: 0.62,
  });
  const card = new THREE.Mesh(cardGeo, [
    cardEdge,
    cardEdge,
    cardEdge,
    cardEdge,
    cardFront,
    cardEdge,
  ]);
  card.position.set(0.32, 0.22, -0.16);
  card.rotation.set(-0.08, -0.24, 0.16);
  group.add(card);

  return group;
}

// 3. HARDCOVER GOLD-LEAF LAW TOME (Bank Materi & UU)
function buildKitab() {
  const group = new THREE.Group();
  const coverTex = makeBookCoverTexture();
  const leather = new THREE.MeshStandardMaterial({
    color: "#4a0f1a",
    roughness: 0.56,
    metalness: 0.12,
  });
  const frontMat = new THREE.MeshStandardMaterial({
    map: coverTex,
    roughness: 0.46,
    metalness: 0.24,
  });
  const goldPages = new THREE.MeshStandardMaterial({
    color: "#ebd28c",
    roughness: 0.36,
    metalness: 0.62,
  });
  const brass = new THREE.MeshStandardMaterial({
    color: "#e5be55",
    roughness: 0.24,
    metalness: 0.88,
  });

  const book = new THREE.Group();
  const W = 1.06,
    H = 1.42,
    T = 0.28;

  // Front cover
  const front = new THREE.Mesh(
    new THREE.BoxGeometry(W, H, 0.036),
    [leather, leather, leather, leather, frontMat, leather],
  );
  front.position.z = T / 2;
  book.add(front);

  // Back cover
  const back = new THREE.Mesh(new THREE.BoxGeometry(W, H, 0.036), leather);
  back.position.z = -T / 2;
  book.add(back);

  // Rounded spine
  const spine = new THREE.Mesh(
    new THREE.CylinderGeometry(T / 2 + 0.018, T / 2 + 0.018, H, 28, 1, false, Math.PI, Math.PI),
    leather,
  );
  spine.position.x = -W / 2;
  book.add(spine);

  // 5 raised gold spine hubs
  for (const sy of [-0.5, -0.25, 0, 0.25, 0.5]) {
    const hub = new THREE.Mesh(
      new THREE.TorusGeometry(T / 2 + 0.02, 0.014, 12, 24, Math.PI),
      brass,
    );
    hub.rotation.x = Math.PI / 2;
    hub.rotation.z = Math.PI / 2;
    hub.position.set(-W / 2, sy, 0);
    book.add(hub);
  }

  // Gilded page block
  const pages = new THREE.Mesh(
    new THREE.BoxGeometry(W - 0.05, H - 0.06, T - 0.04),
    goldPages,
  );
  pages.position.x = 0.01;
  book.add(pages);

  // Brass corner protectors
  for (const cy of [-H / 2 + 0.05, H / 2 - 0.05]) {
    for (const cz of [-T / 2, T / 2]) {
      const corner = new THREE.Mesh(
        new THREE.BoxGeometry(0.13, 0.13, 0.046),
        brass,
      );
      corner.position.set(W / 2 - 0.055, cy, cz);
      book.add(corner);
    }
  }

  // Silk bookmark ribbon tail
  const ribbon = new THREE.Mesh(
    new THREE.BoxGeometry(0.07, 0.28, 0.012),
    new THREE.MeshStandardMaterial({ color: "#9e1c2e", roughness: 0.6 }),
  );
  ribbon.position.set(0.12, -H / 2 - 0.1, 0.02);
  ribbon.rotation.z = 0.14;
  book.add(ribbon);

  book.rotation.set(0.1, -0.34, 0.08);
  group.add(book);
  return group;
}

// 4. BRASS & CRYSTAL HOURGLASS (Jadwal & Agenda)
function buildJadwal() {
  const group = new THREE.Group();
  const brass = new THREE.MeshStandardMaterial({
    color: "#e3bc54",
    roughness: 0.22,
    metalness: 0.88,
  });
  const wood = new THREE.MeshStandardMaterial({
    map: makeWoodTexture("#471d14", "#1f0905"),
    roughness: 0.45,
    metalness: 0.1,
  });
  const glass = new THREE.MeshStandardMaterial({
    color: "#fff8eb",
    roughness: 0.12,
    metalness: 0.25,
    transparent: true,
    opacity: 0.42,
  });
  const sand = new THREE.MeshStandardMaterial({
    color: "#eab949",
    emissive: "#7a5310",
    emissiveIntensity: 0.22,
    roughness: 0.55,
    metalness: 0.35,
  });

  const hg = new THREE.Group();
  // Top and bottom stepped bases
  for (const dir of [-1, 1]) {
    const capWood = new THREE.Mesh(
      new THREE.CylinderGeometry(0.46, 0.46, 0.08, 40),
      wood,
    );
    capWood.position.y = dir * 0.72;
    hg.add(capWood);

    const capBrass = new THREE.Mesh(
      new THREE.CylinderGeometry(0.42, 0.44, 0.045, 40),
      brass,
    );
    capBrass.position.y = dir * 0.66;
    hg.add(capBrass);
  }

  // 3 turned brass pillars
  for (let i = 0; i < 3; i++) {
    const a = (i * Math.PI * 2) / 3 + 0.3;
    const px = Math.cos(a) * 0.37;
    const pz = Math.sin(a) * 0.37;
    const rod = new THREE.Mesh(
      new THREE.CylinderGeometry(0.026, 0.026, 1.32, 20),
      brass,
    );
    rod.position.set(px, 0, pz);
    hg.add(rod);

    const knot = new THREE.Mesh(
      new THREE.SphereGeometry(0.048, 20, 16),
      brass,
    );
    knot.position.set(px, 0, pz);
    hg.add(knot);
  }

  // Double-bulb glass silhouette
  const bulbPts = [];
  for (let i = 0; i <= 40; i++) {
    const t = i / 40; // 0 to 1
    const y = -0.63 + t * 1.26;
    const ny = Math.abs(y) / 0.63; // 0 at neck, 1 at ends
    const r = 0.045 + 0.27 * Math.sin(ny * Math.PI * 0.82);
    bulbPts.push(new THREE.Vector2(r, y));
  }
  const glassMesh = new THREE.Mesh(new THREE.LatheGeometry(bulbPts, 40), glass);
  hg.add(glassMesh);

  // Brass waist collar
  const waist = new THREE.Mesh(
    new THREE.TorusGeometry(0.068, 0.018, 14, 32),
    brass,
  );
  waist.rotation.x = Math.PI / 2;
  hg.add(waist);

  // Golden sand mounds + falling stream
  const lowerSand = new THREE.Mesh(
    new THREE.ConeGeometry(0.26, 0.34, 36),
    sand,
  );
  lowerSand.position.y = -0.44;
  hg.add(lowerSand);

  const upperSand = new THREE.Mesh(
    new THREE.ConeGeometry(0.22, 0.26, 36),
    sand,
  );
  upperSand.rotation.x = Math.PI;
  upperSand.position.y = 0.22;
  hg.add(upperSand);

  const stream = new THREE.Mesh(
    new THREE.CylinderGeometry(0.012, 0.016, 0.56, 12),
    sand,
  );
  stream.position.y = -0.14;
  hg.add(stream);

  hg.rotation.set(0.1, 0.35, -0.1);
  group.add(hg);
  return group;
}

// 5. SCALES OF JUSTICE (Instagram @chapterofushk_a)
function buildScales() {
  const group = new THREE.Group();
  const gold = new THREE.MeshStandardMaterial({
    color: "#e6c15a",
    roughness: 0.22,
    metalness: 0.9,
  });
  const darkMarble = new THREE.MeshStandardMaterial({
    color: "#211614",
    roughness: 0.32,
    metalness: 0.2,
  });

  // Pedestal base
  const base1 = new THREE.Mesh(
    new THREE.CylinderGeometry(0.38, 0.44, 0.1, 40),
    darkMarble,
  );
  base1.position.y = -0.7;
  group.add(base1);

  const base2 = new THREE.Mesh(
    new THREE.CylinderGeometry(0.28, 0.36, 0.08, 40),
    gold,
  );
  base2.position.y = -0.62;
  group.add(base2);

  // Central fluted column
  const pillar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.048, 0.072, 1.28, 28),
    gold,
  );
  pillar.position.y = 0.04;
  group.add(pillar);

  // Top finial crown
  const finial = new THREE.Mesh(new THREE.OctahedronGeometry(0.11, 0), gold);
  finial.position.y = 0.74;
  group.add(finial);

  // Tilted balance assembly
  const beamGroup = new THREE.Group();
  beamGroup.position.y = 0.58;
  beamGroup.rotation.z = -0.07;

  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.026, 0.026, 1.24, 24),
    gold,
  );
  beam.rotation.z = Math.PI / 2;
  beamGroup.add(beam);

  for (const sx of [-0.6, 0.6]) {
    const endCap = new THREE.Mesh(new THREE.SphereGeometry(0.046, 20, 16), gold);
    endCap.position.x = sx;
    beamGroup.add(endCap);

    // Pan hanger assembly (stays vertical in gravity!)
    const hanger = new THREE.Group();
    hanger.position.x = sx;
    hanger.rotation.z = 0.07;

    const dropH = 0.54;
    for (let c = 0; c < 3; c++) {
      const ca = (c * Math.PI * 2) / 3;
      const r = 0.2;
      const chain = new THREE.Mesh(
        new THREE.CylinderGeometry(0.008, 0.008, Math.hypot(dropH, r), 10),
        gold,
      );
      chain.position.set((Math.cos(ca) * r) / 2, -dropH / 2, (Math.sin(ca) * r) / 2);
      chain.lookAt(
        hanger.position.x + Math.cos(ca) * r,
        -dropH,
        Math.sin(ca) * r,
      );
      chain.rotateX(Math.PI / 2);
      // Simpler exact orientation using quaternion from top to rim point
      const pTop = new THREE.Vector3(0, 0, 0);
      const pBot = new THREE.Vector3(Math.cos(ca) * r, -dropH, Math.sin(ca) * r);
      const dir = pBot.clone().sub(pTop);
      chain.position.copy(pTop).addScaledVector(dir, 0.5);
      chain.quaternion.setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        dir.normalize(),
      );
      hanger.add(chain);
    }

    // Concave weighing pan
    const panPts = [];
    for (let i = 0; i <= 14; i++) {
      const t = i / 14;
      panPts.push(new THREE.Vector2(t * 0.22, -dropH - (1 - t * t) * 0.065));
    }
    const pan = new THREE.Mesh(
      new THREE.LatheGeometry(panPts, 32),
      new THREE.MeshStandardMaterial({
        color: "#e8c45e",
        roughness: 0.2,
        metalness: 0.9,
        side: THREE.DoubleSide,
      }),
    );
    hanger.add(pan);
    beamGroup.add(hanger);
  }

  group.add(beamGroup);
  group.rotation.y = 0.22;
  return group;
}

// 6. ORBITING GOLDEN JUSTICE STAR (replaces push_pin.glb)
function buildEmblemStar() {
  const group = new THREE.Group();
  const gold = new THREE.MeshStandardMaterial({
    color: "#f2cf6b",
    emissive: "#8c6414",
    emissiveIntensity: 0.35,
    roughness: 0.18,
    metalness: 0.92,
  });
  const spikeV = new THREE.Mesh(new THREE.OctahedronGeometry(0.55, 0), gold);
  spikeV.scale.set(0.28, 1.0, 0.28);
  group.add(spikeV);

  const spikeH = new THREE.Mesh(new THREE.OctahedronGeometry(0.45, 0), gold);
  spikeH.scale.set(1.0, 0.28, 0.28);
  group.add(spikeH);

  const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.22, 0), gold);
  group.add(core);
  return group;
}

export async function generateAll3DAssets() {
  const specs = [
    { id: "web-kelas", file: "gavel.glb", build: buildGavel },
    { id: "galeri", file: "galeri.glb", build: buildGaleri },
    { id: "materi", file: "kitab.glb", build: buildKitab },
    { id: "jadwal", file: "jadwal.glb", build: buildJadwal },
    { id: "instagram", file: "instagram.glb", build: buildScales },
    { id: "star", file: "emblem_star.glb", build: buildEmblemStar },
  ];

  // Shared studio renderer for crisp transparent editorial portraits
  const renderer = new THREE.WebGLRenderer({
    alpha: true,
    antialias: true,
    preserveDrawingBuffer: true,
  });
  renderer.setSize(600, 720);
  renderer.setPixelRatio(1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.22;

  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const env = pmrem.fromScene(room, 0.04);

  const exporter = new GLTFExporter();
  const out = { models: {}, portraits: {}, bubblePng: "" };

  for (const spec of specs) {
    const model = spec.build();
    model.updateMatrixWorld(true);
    const glb = await exporter.parseAsync(model, { binary: true });
    out.models[spec.file] = Array.from(new Uint8Array(glb));

    if (spec.id !== "star") {
      const scene = new THREE.Scene();
      scene.environment = env.texture;
      scene.add(new THREE.AmbientLight("#fff1d6", 1.35));
      const key = new THREE.DirectionalLight("#fff6e5", 3.2);
      key.position.set(-2.5, 4, 5);
      scene.add(key);
      const rim = new THREE.DirectionalLight("#d4af37", 1.8);
      rim.position.set(3, 2, -3);
      scene.add(rim);

      const camera = new THREE.PerspectiveCamera(32, 600 / 720, 0.1, 100);
      camera.position.set(0, 0.05, 5.2);
      camera.lookAt(0, 0, 0);

      const clone = model.clone(true);
      const box = new THREE.Box3().setFromObject(clone);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      clone.position.sub(center);
      const wrap = new THREE.Group();
      wrap.add(clone);
      wrap.scale.setScalar(2.35 / Math.max(size.x, size.y, size.z));
      scene.add(wrap);

      renderer.render(scene, camera);
      out.portraits[spec.id] = renderer.domElement.toDataURL("image/png");
    }
  }

  // Also generate fallback golden orb bubble.png
  const bCanvas = document.createElement("canvas");
  bCanvas.width = 512;
  bCanvas.height = 512;
  const bctx = bCanvas.getContext("2d");
  const rg = bctx.createRadialGradient(210, 190, 20, 256, 256, 230);
  rg.addColorStop(0, "rgba(255,248,225,0.22)");
  rg.addColorStop(0.68, "rgba(212,175,55,0.12)");
  rg.addColorStop(0.92, "rgba(235,198,96,0.48)");
  rg.addColorStop(1, "rgba(212,175,55,0)");
  bctx.fillStyle = rg;
  bctx.beginPath();
  bctx.arc(256, 256, 230, 0, Math.PI * 2);
  bctx.fill();
  out.bubblePng = bCanvas.toDataURL("image/png");

  env.dispose();
  room.dispose();
  pmrem.dispose();
  renderer.dispose();
  return out;
}
