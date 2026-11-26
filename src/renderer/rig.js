/**
 * The pet rig: turns a pet definition into an SVG whose parts every animation can move.
 *
 * ## Pet definition format
 *
 *   definePet({
 *     id: 'cat', name: 'Mochi', species: 'Cat',
 *     colors:  { line, ink, ... }          // line = outlines, ink = eyes and mouth
 *     anchors: { name: [x, y], ... }       // where faces and props attach (see REQUIRED_ANCHORS)
 *     pivots:  { part: [x, y], ... }       // what each part rotates/scales around
 *     parts:   { part: '<svg markup>' }    // drawn in absolute viewBox coordinates
 *     eyes?:   { variant: (side, colors) => markup }   // override default eye shapes
 *     mouths?: { variant: (colors) => markup }         // override default mouth shapes
 *   })
 *
 * All pets share one 200 x 200 viewBox with the ground at y = 184, and must stand inside
 * the same footprint so walking, dropping and landing line up for every pet.
 *
 * Parts are layered back to front: shadow, tail, feet, body, head (ears behind the head
 * shape, then the face and head-mounted props), front props (laptop, controller...),
 * then paws, so paws rest on top of whatever the pet is holding.
 *
 * Eye and mouth shapes are drawn centred on (0, 0); the rig places them at the eyeL, eyeR
 * and mouth anchors. `side` is -1 for the left eye and 1 for the right.
 *
 * ## Markup rules (checked by test/unit/rig.test.js)
 *
 *   - No `style` attributes: the Electron window's content security policy blocks them.
 *   - No `id`s, gradients or clip paths: many pets share one page in the preview.
 *   - No `transform` attribute on anything CSS animates. The rig wraps parts in groups
 *     that carry only `class` and `transform-origin`; CSS transforms go on those.
 */

import { PROPS, PROP_NAMES } from './props.js';

export const VIEWBOX_SIZE = 200;
export const GROUND_Y = 184;

export const PART_NAMES = Object.freeze([
  'shadow', 'tail', 'footL', 'footR', 'body', 'earL', 'earR', 'head', 'faceExtras', 'pawL', 'pawR',
]);
export const REQUIRED_PARTS = Object.freeze(['shadow', 'footL', 'footR', 'body', 'head', 'pawL', 'pawR']);
export const REQUIRED_ANCHORS = Object.freeze(['head', 'headTop', 'eyeL', 'eyeR', 'mouth', 'hands', 'sweat']);
export const REQUIRED_PIVOTS = Object.freeze(['rig', 'body', 'head', 'pawL', 'pawR', 'footL', 'footR']);
export const REQUIRED_COLORS = Object.freeze(['line', 'ink']);

export const EYE_VARIANTS = Object.freeze(['open', 'happy', 'closed', 'sleepy', 'worried', 'wide', 'down']);
export const MOUTH_VARIANTS = Object.freeze(['neutral', 'smile', 'worried', 'o', 'flat']);

const MOUTH_RED = '#7a2e3a';
const TONGUE = '#f08aa0';

/** Default eye shapes, centred on (0, 0). */
export const DEFAULT_EYES = Object.freeze({
  open: (_side, c) => `<ellipse rx="5.5" ry="7" fill="${c.ink}"/><circle cx="1.8" cy="-2.6" r="2" fill="#fff"/>`,
  happy: (_side, c) => `<path d="M-6 2 Q0 -7 6 2" fill="none" stroke="${c.ink}" stroke-width="3.2" stroke-linecap="round"/>`,
  closed: (_side, c) => `<path d="M-6 -1 Q0 5 6 -1" fill="none" stroke="${c.ink}" stroke-width="3" stroke-linecap="round"/>`,
  sleepy: (_side, c) => `<path d="M-5.5 0 A5.5 6 0 0 0 5.5 0 Z" fill="${c.ink}"/><path d="M-7 0 L7 0" stroke="${c.ink}" stroke-width="2.6" stroke-linecap="round"/>`,
  worried: (side, c) => `<ellipse rx="5" ry="6.5" fill="${c.ink}"/><circle cx="1.6" cy="-2.4" r="1.8" fill="#fff"/><path d="M${6 * side} -11 L${-5 * side} -15" stroke="${c.ink}" stroke-width="2.6" stroke-linecap="round"/>`,
  wide: (_side, c) => `<circle r="7.5" fill="#fff" stroke="${c.ink}" stroke-width="2.2"/><circle r="4" fill="${c.ink}"/><circle cx="1.5" cy="-1.5" r="1.4" fill="#fff"/>`,
  down: (_side, c) => `<ellipse cy="2" rx="5.5" ry="5" fill="${c.ink}"/><path d="M-6.5 -3 Q0 -6 6.5 -3" fill="none" stroke="${c.ink}" stroke-width="2.4" stroke-linecap="round"/>`,
});

/** Default mouth shapes, centred on (0, 0). */
export const DEFAULT_MOUTHS = Object.freeze({
  neutral: (c) => `<path d="M-5 -1 Q0 4 5 -1" fill="none" stroke="${c.ink}" stroke-width="2.6" stroke-linecap="round"/>`,
  smile: (c) => `<path d="M-8 -2 Q0 11 8 -2 Z" fill="${MOUTH_RED}" stroke="${c.ink}" stroke-width="2.2" stroke-linejoin="round"/><path d="M-4 4.5 Q0 8.5 4 4.5 Q0 2.5 -4 4.5 Z" fill="${TONGUE}"/>`,
  worried: (c) => `<path d="M-7 2 Q-3.5 -2 0 2 Q3.5 6 7 2" fill="none" stroke="${c.ink}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>`,
  o: (c) => `<ellipse rx="4" ry="5" fill="${MOUTH_RED}" stroke="${c.ink}" stroke-width="2"/>`,
  flat: (c) => `<path d="M-5 1 L5 1" stroke="${c.ink}" stroke-width="2.6" stroke-linecap="round"/>`,
});

/**
 * What each animation state looks like: which eyes and mouth to show, and which props.
 * `yawn` is a special mouth that alternates between neutral and o.
 */
export const STATE_LOOKS = Object.freeze({
  wander: { eyes: 'open', mouth: 'neutral', props: [] },
  focused: { eyes: 'down', mouth: 'neutral', props: ['laptop'] },
  bedtime: { eyes: 'sleepy', mouth: 'yawn', props: ['nightcap'] },
  stretch: { eyes: 'closed', mouth: 'o', props: [] },
  watching: { eyes: 'wide', mouth: 'neutral', props: ['popcorn'] },
  gaming: { eyes: 'down', mouth: 'flat', props: ['controller'] },
  vibing: { eyes: 'happy', mouth: 'smile', props: ['headphones', 'notes'] },
  greeting: { eyes: 'happy', mouth: 'smile', props: [] },
  sleeping: { eyes: 'closed', mouth: 'neutral', props: ['zzz'] },
  'away-done': { eyes: 'open', mouth: 'smile', props: ['flag'] },
  working: { eyes: 'worried', mouth: 'worried', props: ['laptop', 'sweat', 'steam'] },
  happy: { eyes: 'happy', mouth: 'smile', props: ['sparkles'] },
  celebrating: { eyes: 'happy', mouth: 'smile', props: ['confetti'] },
  alert: { eyes: 'wide', mouth: 'o', props: ['exclaim'] },
  petted: { eyes: 'happy', mouth: 'smile', props: ['hearts'] },
  held: { eyes: 'wide', mouth: 'worried', props: [] },
  falling: { eyes: 'wide', mouth: 'o', props: ['speedlines'] },
  meeting: { eyes: 'open', mouth: 'flat', props: ['muted'] },
});

function isPoint(p) {
  return Array.isArray(p) && p.length === 2 && p.every(Number.isFinite);
}

/** Validates and freezes a pet definition. Throws with every problem listed. */
export function definePet(def) {
  const problems = [];
  for (const key of ['id', 'name', 'species']) {
    if (typeof def?.[key] !== 'string' || def[key] === '') problems.push(`${key} is required`);
  }
  for (const c of REQUIRED_COLORS) if (typeof def?.colors?.[c] !== 'string') problems.push(`colors.${c} is required`);
  for (const a of REQUIRED_ANCHORS) if (!isPoint(def?.anchors?.[a])) problems.push(`anchors.${a} must be [x, y]`);
  for (const p of REQUIRED_PIVOTS) if (!isPoint(def?.pivots?.[p])) problems.push(`pivots.${p} must be [x, y]`);
  for (const p of REQUIRED_PARTS) if (typeof def?.parts?.[p] !== 'string') problems.push(`parts.${p} is required`);
  for (const p of Object.keys(def?.parts ?? {})) if (!PART_NAMES.includes(p)) problems.push(`parts.${p} is not a rig part`);
  for (const v of Object.keys(def?.eyes ?? {})) if (!EYE_VARIANTS.includes(v)) problems.push(`eyes.${v} is not an eye variant`);
  for (const v of Object.keys(def?.mouths ?? {})) if (!MOUTH_VARIANTS.includes(v)) problems.push(`mouths.${v} is not a mouth variant`);
  if (problems.length) throw new Error(`Invalid pet "${def?.id ?? '?'}": ${problems.join('; ')}`);
  return Object.freeze({ eyes: {}, mouths: {}, ...def });
}

const origin = (point) => (point ? ` transform-origin="${point[0]}px ${point[1]}px"` : '');
const group = (cls, pivot, inner) => `<g class="${cls}"${origin(pivot)}>${inner}</g>`;
const at = ([x, y], inner) => `<g transform="translate(${x} ${y})">${inner}</g>`;

function eyesMarkup(pet) {
  return EYE_VARIANTS.map((variant) => {
    const shape = pet.eyes[variant] ?? DEFAULT_EYES[variant];
    const pair = [['eyeL', -1], ['eyeR', 1]]
      .map(([anchor, side]) => at(pet.anchors[anchor], `<g class="eye">${shape(side, pet.colors)}</g>`))
      .join('');
    return `<g class="eyes eyes-${variant}">${pair}</g>`;
  }).join('');
}

function mouthsMarkup(pet) {
  return MOUTH_VARIANTS.map((variant) => {
    const shape = pet.mouths[variant] ?? DEFAULT_MOUTHS[variant];
    return `<g class="mouth mouth-${variant}">${at(pet.anchors.mouth, shape(pet.colors))}</g>`;
  }).join('');
}

function propsMarkup(pet, layer) {
  return PROP_NAMES
    .filter((name) => PROPS[name].layer === layer)
    .map((name) => `<g class="prop prop-${name}">${PROPS[name].render(pet)}</g>`)
    .join('');
}

function part(pet, name, cls = `part ${name}`) {
  const markup = pet.parts[name];
  return markup === undefined ? '' : group(cls, pet.pivots[name], markup);
}

/** The inner markup of a pet's <svg>: every part, face variant and prop. */
export function buildPetMarkup(pet) {
  const head = [
    part(pet, 'earL', 'part ear ear-l'),
    part(pet, 'earR', 'part ear ear-r'),
    pet.parts.head,
    `<g class="face">${eyesMarkup(pet)}${mouthsMarkup(pet)}${pet.parts.faceExtras ?? ''}</g>`,
    propsMarkup(pet, 'head'),
  ].join('');

  const rig = [
    part(pet, 'tail'),
    part(pet, 'footL', 'part foot foot-l'),
    part(pet, 'footR', 'part foot foot-r'),
    part(pet, 'body'),
    group('part head', pet.pivots.head, head),
    `<g class="props-front">${propsMarkup(pet, 'front')}</g>`,
    part(pet, 'pawL', 'part paw paw-l'),
    part(pet, 'pawR', 'part paw paw-r'),
  ].join('');

  const center = [VIEWBOX_SIZE / 2, VIEWBOX_SIZE / 2];
  return [
    `<g class="shadow">${pet.parts.shadow}</g>`,
    group('flip', center, group('rig', pet.pivots.rig, rig)),
    `<g class="props-fx">${propsMarkup(pet, 'fx')}</g>`,
  ].join('');
}

/** Everything the view needs to show `state`: face variants and visible props. */
export function lookFor(state) {
  return STATE_LOOKS[state] ?? STATE_LOOKS.wander;
}
