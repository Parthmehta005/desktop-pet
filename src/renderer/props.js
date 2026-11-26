/**
 * Props the pet can show: things it holds, wears, or that float around it.
 *
 * Each prop has a `layer` (where the rig places it) and a `render(pet)` function that
 * draws it from the pet's anchors, so the same laptop or nightcap fits every pet.
 *   head   moves with the head (headphones, nightcap, sweat, zzz...)
 *   front  in front of the body, behind the paws (laptop, controller, popcorn, flag)
 *   fx     effects around the whole pet, not flipped or bobbed (confetti, sparkles...)
 *
 * Shapes are drawn around (0, 0) and placed with static translate() wrappers; the
 * inner groups carry the classes that animations.css moves.
 */

const at = (x, y, inner) => `<g transform="translate(${x} ${y})">${inner}</g>`;
const OUTLINE = '#3d4450';

const DROP = '<path d="M0 -6 C 3 -1 4 2 4 3.5 A4 4 0 0 1 -4 3.5 C -4 2 -3 -1 0 -6 Z" fill="#7cc6f2" stroke="#3b7fb0" stroke-width="1.5"/>';
const PUFF = '<circle r="7" fill="#eef1f4" stroke="#b9c0c8" stroke-width="1.5"/><circle cx="7" cy="2" r="5" fill="#eef1f4" stroke="#b9c0c8" stroke-width="1.5"/>';
const Z = '<path d="M-5 -5 H5 L-5 5 H5" fill="none" stroke="#6b7fd7" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/>';
const HEART = '<path d="M0 4 C -7 -1 -8 -7 -4 -8 C -2 -8.5 -0.5 -7 0 -5.5 C 0.5 -7 2 -8.5 4 -8 C 8 -7 7 -1 0 4 Z" fill="#ff6b8b" stroke="#c63d5d" stroke-width="1.2" stroke-linejoin="round"/>';
const STAR = '<path d="M0 -7 L1.8 -1.8 L7 0 L1.8 1.8 L0 7 L-1.8 1.8 L-7 0 L-1.8 -1.8 Z" fill="#ffd23f" stroke="#d9a400" stroke-width="1" stroke-linejoin="round"/>';
const NOTE = '<path d="M0 0 V-13 Q6 -11 7 -6" fill="none" stroke="#7c5cff" stroke-width="2.2" stroke-linecap="round"/><ellipse cx="-2.6" cy="0" rx="3.3" ry="2.6" fill="#7c5cff"/>';
const DOUBLE_NOTE = '<path d="M0 0 V-12 L9 -14 V-2" fill="none" stroke="#ff7ab6" stroke-width="2.2" stroke-linejoin="round"/><ellipse cx="-2.6" cy="0" rx="3.3" ry="2.6" fill="#ff7ab6"/><ellipse cx="6.4" cy="-2" rx="3.3" ry="2.6" fill="#ff7ab6"/>';
const KERNEL = '<circle r="3.2" fill="#fff4d6" stroke="#d8b878" stroke-width="1"/>';

const CONFETTI_COLORS = ['#ff6b8b', '#ffd23f', '#4cc38a', '#5aa9ff', '#b07cff', '#ff9f1c'];

export const PROPS = Object.freeze({
  laptop: {
    layer: 'front',
    render: ({ anchors: { hands: [x, y] } }) => at(x, y, [
      `<rect x="-26" y="-30" width="52" height="34" rx="4" fill="#a3adbb" stroke="${OUTLINE}" stroke-width="2.5"/>`,
      '<path d="M0 -8 C -6 -12 -8 -18 -4 -19.5 C -2 -20 -0.6 -19 0 -17.5 C 0.6 -19 2 -20 4 -19.5 C 8 -18 6 -12 0 -8 Z" fill="#eef2f6"/>',
      `<rect x="-32" y="3" width="64" height="7" rx="3" fill="#7d8796" stroke="${OUTLINE}" stroke-width="2.5"/>`,
    ].join('')),
  },

  sweat: {
    layer: 'head',
    render: ({ anchors: { sweat: [sx, sy], head: [hx] } }) => [
      at(sx, sy, `<g class="drop drop-1">${DROP}</g>`),
      at(2 * hx - sx + 2, sy + 6, `<g class="drop drop-2">${DROP}</g>`),
      at(sx - 8, sy - 16, `<g class="drop drop-3">${DROP}</g>`),
    ].join(''),
  },

  steam: {
    layer: 'head',
    render: ({ anchors: { headTop: [x, y] } }) => [
      at(x - 26, y - 4, `<g class="puff puff-1">${PUFF}</g>`),
      at(x - 2, y - 12, `<g class="puff puff-2">${PUFF}</g>`),
      at(x + 22, y - 4, `<g class="puff puff-3">${PUFF}</g>`),
    ].join(''),
  },

  zzz: {
    layer: 'head',
    render: ({ anchors: { headTop: [x, y] } }) => [
      at(x + 30, y + 6, `<g class="z z-1">${Z}</g>`),
      at(x + 42, y - 10, `<g class="z z-2">${Z}</g>`),
      at(x + 54, y - 26, `<g class="z z-3">${Z}</g>`),
    ].join(''),
  },

  hearts: {
    layer: 'fx',
    render: ({ anchors: { headTop: [x, y] } }) => [
      at(x - 34, y + 8, `<g class="heart heart-1">${HEART}</g>`),
      at(x + 32, y + 2, `<g class="heart heart-2">${HEART}</g>`),
      at(x - 2, y - 14, `<g class="heart heart-3">${HEART}</g>`),
    ].join(''),
  },

  sparkles: {
    layer: 'fx',
    render: ({ anchors: { head: [x, y], headTop: [, ty] } }) => [
      [x - 56, y - 26], [x + 58, y - 18], [x - 54, y + 44], [x + 56, y + 52], [x + 4, ty - 18],
    ].map(([sx, sy], i) => at(sx, sy, `<g class="sparkle sparkle-${i + 1}">${STAR}</g>`)).join(''),
  },

  confetti: {
    layer: 'fx',
    render: ({ anchors: { head: [x, y] } }) => {
      const bits = Array.from({ length: 14 }, (_, i) => {
        const color = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
        const shape = i % 3 === 0
          ? `<circle r="2.6" fill="${color}"/>`
          : `<rect x="-2" y="-4" width="4" height="8" rx="1" fill="${color}"/>`;
        return `<g class="bit">${shape}</g>`;
      });
      return at(x, y - 14, bits.join(''));
    },
  },

  exclaim: {
    layer: 'head',
    render: ({ anchors: { headTop: [x, y] } }) => at(x + 36, y - 6, [
      '<g class="badge">',
      '<circle r="11" fill="#ff9f1c" stroke="#b35c00" stroke-width="2.5"/>',
      '<rect x="-2" y="-7" width="4" height="9" rx="2" fill="#fff"/><circle cy="5.5" r="2.2" fill="#fff"/>',
      '</g>',
    ].join('')),
  },

  notes: {
    layer: 'head',
    render: ({ anchors: { headTop: [x, y] } }) => [
      at(x - 44, y + 16, `<g class="note note-1">${NOTE}</g>`),
      at(x + 44, y + 6, `<g class="note note-2">${DOUBLE_NOTE}</g>`),
    ].join(''),
  },

  headphones: {
    layer: 'head',
    render: ({ anchors: { head: [x, y], headSize: [rx, ry] } }) => {
      const top = y - ry - 8;
      return [
        `<path d="M${x - rx} ${y - 4} C ${x - rx} ${top}, ${x + rx} ${top}, ${x + rx} ${y - 4}" fill="none" stroke="#3d3d4d" stroke-width="6" stroke-linecap="round"/>`,
        `<rect x="${x - rx - 7}" y="${y - 14}" width="13" height="27" rx="6" fill="#ff5d73" stroke="#3d3d4d" stroke-width="2.5"/>`,
        `<rect x="${x + rx - 6}" y="${y - 14}" width="13" height="27" rx="6" fill="#ff5d73" stroke="#3d3d4d" stroke-width="2.5"/>`,
      ].join('');
    },
  },

  controller: {
    layer: 'front',
    render: ({ anchors: { hands: [x, y] } }) => at(x, y - 6, [
      '<g class="pad">',
      '<path d="M-26 -5 C -26 -14 -15 -16 0 -14 C 15 -16 26 -14 26 -5 C 28 7 23 13 17 11 L 8 5 H -8 L -17 11 C -23 13 -28 7 -26 -5 Z" fill="#5b5f97" stroke="#2f3157" stroke-width="2.5" stroke-linejoin="round"/>',
      '<path d="M-15 -6 V2 M-19 -2 H-11" stroke="#e9ebff" stroke-width="2.6" stroke-linecap="round"/>',
      '<circle cx="12" cy="-5" r="2.6" fill="#ff6b8b"/><circle cx="17" cy="0" r="2.6" fill="#ffd23f"/>',
      '</g>',
    ].join('')),
  },

  popcorn: {
    layer: 'front',
    render: ({ anchors: { hands: [x, y] } }) => at(x + 22, y - 6, [
      '<path d="M-12 -18 L12 -18 L9 12 L-9 12 Z" fill="#fff" stroke="#8a2a2a" stroke-width="2.2" stroke-linejoin="round"/>',
      '<path d="M-6 -18 L-4.5 12 M6 -18 L4.5 12" stroke="#e5484d" stroke-width="4"/>',
      at(-6, -21, KERNEL), at(1, -24, KERNEL), at(7, -20, KERNEL), at(-1, -19, KERNEL),
      at(-4, -24, `<g class="kernel kernel-1">${KERNEL}</g>`),
      at(5, -24, `<g class="kernel kernel-2">${KERNEL}</g>`),
    ].join('')),
  },

  nightcap: {
    layer: 'head',
    render: ({ anchors: { headTop: [x, y] } }) => at(x, y + 6, [
      '<g class="cap">',
      '<path d="M-28 6 Q -8 -30 34 -36 Q 22 -12 26 6 Z" fill="#5a7bd8" stroke="#2d3f7a" stroke-width="2.5" stroke-linejoin="round"/>',
      '<path d="M-29 7 Q -1 -1 27 7 L 26 0 Q -1 -8 -27 0 Z" fill="#f4f1ea" stroke="#2d3f7a" stroke-width="2" stroke-linejoin="round"/>',
      '<circle cx="34" cy="-36" r="6" fill="#f4f1ea" stroke="#2d3f7a" stroke-width="2"/>',
      '</g>',
    ].join('')),
  },

  flag: {
    layer: 'front',
    render: ({ anchors: { hands: [x, y] } }) => at(x, y, [
      '<path d="M22 4 L32 -56" stroke="#8a5a3c" stroke-width="3.2" stroke-linecap="round"/>',
      '<g class="cloth">',
      '<path d="M32 -56 C 42 -60 50 -52 60 -56 L 57 -38 C 48 -34 40 -42 30 -38 Z" fill="#4cc38a" stroke="#2a7a52" stroke-width="2" stroke-linejoin="round"/>',
      '<path d="M38 -47 L43 -42 L51 -51" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>',
      '</g>',
    ].join('')),
  },

  muted: {
    layer: 'head',
    render: ({ anchors: { headTop: [x, y] } }) => at(x + 36, y - 4, [
      '<circle r="11" fill="#fff" stroke="#6d6a75" stroke-width="2"/>',
      '<rect x="-3" y="-7" width="6" height="10" rx="3" fill="#6d6a75"/>',
      '<path d="M-6 0 A6 6 0 0 0 6 0 M0 6 V8" fill="none" stroke="#6d6a75" stroke-width="1.8" stroke-linecap="round"/>',
      '<path d="M-7 -7 L7 7" stroke="#e5484d" stroke-width="2.6" stroke-linecap="round"/>',
    ].join('')),
  },

  speedlines: {
    layer: 'fx',
    render: ({ anchors: { headTop: [x, y] } }) => [-26, 0, 26].map((dx, i) => at(x + dx, y - 14 + Math.abs(dx) / 3,
      `<g class="line line-${i + 1}"><path d="M0 -9 V9" stroke="#9aa3ad" stroke-width="3" stroke-linecap="round"/></g>`)).join(''),
  },
});

export const PROP_NAMES = Object.freeze(Object.keys(PROPS));
