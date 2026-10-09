// Original generative placeholder artwork for the demo catalog.
// Deterministic SVG compositions from a seed string — no external assets,
// no copied artwork. Replace with the store owner's authorized images in production.
export const PALETTES = {
  neon: { bg: ["#0b0714", "#1a1033"], glow: "#00f0ff", accent: "#ff2fb3", soft: "#7b5cff", disc: "#f5f0ff" },
  ember: { bg: ["#120806", "#2b120a"], glow: "#ff7a1a", accent: "#ff3d2e", soft: "#c98a2d", disc: "#ffe9d2" },
  moon: { bg: ["#060a18", "#101c3f"], glow: "#7fb2ff", accent: "#c9d8ff", soft: "#3d5a99", disc: "#f2f5ff" },
  nocturne: { bg: ["#0a0a12", "#1c1c2e"], glow: "#9d7bff", accent: "#ff7ad9", soft: "#4a4a6a", disc: "#eceaff" },
};

function hashSeed(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function artSVG(seed, paletteName = "nocturne", variant = 0, w = 600, h = 750) {
  const pal = PALETTES[paletteName] || PALETTES.nocturne;
  const rnd = mulberry32(hashSeed(seed + "::" + variant));
  const gid = `g${hashSeed(seed + variant).toString(36)}`;
  let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid slice">`;
  s += `<defs><radialGradient id="${gid}" cx="50%" cy="38%" r="90%">`
    + `<stop offset="0%" stop-color="${pal.bg[1]}"/><stop offset="100%" stop-color="${pal.bg[0]}"/></radialGradient>`
    + `<filter id="${gid}n"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" result="n"/>`
    + `<feColorMatrix in="n" type="matrix" values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.05 0"/></filter></defs>`;
  s += `<rect width="${w}" height="${h}" fill="url(#${gid})"/>`;
  // stars
  for (let i = 0; i < 70; i++) {
    const x = (rnd() * w).toFixed(1), y = (rnd() * h).toFixed(1), r = (rnd() * 1.6 + 0.4).toFixed(2);
    s += `<circle cx="${x}" cy="${y}" r="${r}" fill="${pal.disc}" opacity="${(rnd() * 0.7 + 0.1).toFixed(2)}"/>`;
  }
  // main disc (moon/sun)
  const dx = w * (0.3 + rnd() * 0.4), dy = h * (0.2 + rnd() * 0.25), dr = w * (0.16 + rnd() * 0.12);
  s += `<circle cx="${dx.toFixed(0)}" cy="${dy.toFixed(0)}" r="${(dr * 1.35).toFixed(0)}" fill="${pal.glow}" opacity="0.16"/>`;
  s += `<circle cx="${dx.toFixed(0)}" cy="${dy.toFixed(0)}" r="${dr.toFixed(0)}" fill="${pal.disc}" opacity="0.92"/>`;
  s += `<circle cx="${(dx - dr * 0.35).toFixed(0)}" cy="${(dy - dr * 0.2).toFixed(0)}" r="${(dr * 0.82).toFixed(0)}" fill="${pal.bg[0]}" opacity="0.28"/>`;
  // arcs / rings
  for (let i = 0; i < 3; i++) {
    const rr = dr * (1.5 + i * 0.45 + rnd() * 0.2);
    s += `<circle cx="${dx.toFixed(0)}" cy="${dy.toFixed(0)}" r="${rr.toFixed(0)}" fill="none" stroke="${i % 2 ? pal.accent : pal.glow}" stroke-width="${(1 + rnd() * 2).toFixed(1)}" opacity="${(0.35 - i * 0.08).toFixed(2)}"/>`;
  }
  // horizon bands
  const bands = 3 + Math.floor(rnd() * 3);
  for (let i = 0; i < bands; i++) {
    const y = h * (0.55 + (i / bands) * 0.4);
    const bh = 6 + rnd() * 26;
    s += `<rect x="0" y="${y.toFixed(0)}" width="${w}" height="${bh.toFixed(0)}" fill="${i % 2 ? pal.accent : pal.soft}" opacity="${(0.10 + rnd() * 0.14).toFixed(2)}"/>`;
  }
  // geometric shards
  for (let i = 0; i < 5; i++) {
    const x = rnd() * w, y = h * 0.45 + rnd() * h * 0.5, sz = 20 + rnd() * 70;
    const rot = (rnd() * 360).toFixed(0);
    s += `<polygon points="0,${(-sz / 2).toFixed(0)} ${(sz / 2).toFixed(0)},${(sz / 2).toFixed(0)} ${(-sz / 2).toFixed(0)},${(sz / 2).toFixed(0)}" `
      + `transform="translate(${x.toFixed(0)} ${y.toFixed(0)}) rotate(${rot})" fill="${i % 2 ? pal.glow : pal.accent}" opacity="${(0.12 + rnd() * 0.2).toFixed(2)}"/>`;
  }
  // glow orb
  const ox = rnd() * w, oy = h * (0.6 + rnd() * 0.3);
  s += `<circle cx="${ox.toFixed(0)}" cy="${oy.toFixed(0)}" r="${(30 + rnd() * 40).toFixed(0)}" fill="${pal.glow}" opacity="0.25"/>`;
  s += `<rect width="${w}" height="${h}" filter="url(#${gid}n)"/>`;
  // variant crop mark for gallery depth
  if (variant > 0) {
    s += `<rect x="${(w * 0.08).toFixed(0)}" y="${(h * 0.08).toFixed(0)}" width="${(w * 0.84).toFixed(0)}" height="${(h * 0.84).toFixed(0)}" fill="none" stroke="${pal.disc}" stroke-width="2" opacity="0.25"/>`;
  }
  s += `</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(s)}`;
}

export function avatarSVG(seed, size = 96) {
  const rnd = mulberry32(hashSeed("avatar::" + seed));
  const pal = PALETTES.nocturne;
  const hue = Math.floor(rnd() * 360);
  const s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">`
    + `<defs><linearGradient id="av" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${hue},60%,38%)"/><stop offset="1" stop-color="hsl(${(hue + 60) % 360},65%,22%)"/></linearGradient></defs>`
    + `<circle cx="50" cy="50" r="48" fill="url(#av)"/>`
    + `<circle cx="64" cy="36" r="16" fill="${pal.disc}" opacity="0.9"/>`
    + `<circle cx="58" cy="32" r="13" fill="hsl(${hue},60%,30%)" opacity="0.5"/>`
    + `<path d="M20 78 Q50 58 80 78" stroke="${pal.disc}" stroke-width="4" fill="none" opacity="0.7"/></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(s)}`;
}
