// Checks pet and prop SVG markup against the rig's markup rules (see src/renderer/rig.js).
import assert from 'node:assert/strict';

const FORBIDDEN = [
  [/\sstyle\s*=/i, 'a style attribute (blocked by the content security policy)'],
  [/\sid\s*=/i, 'an id (many pets share one page)'],
  [/<script/i, 'a script'],
  [/\son[a-z]+\s*=/i, 'an event handler attribute'],
  [/href\s*=/i, 'a link'],
  [/url\(/i, 'a url() reference'],
  [/<(defs|clipPath|mask|linearGradient|radialGradient|pattern|filter|use)\b/i, 'defs/gradients/clip paths'],
  [/<(image|foreignObject|text)\b/i, 'images, foreign objects or text (draw shapes instead)'],
];

const ANIMATED = /\bclass="[^"]*\b(rig|flip|part|prop|eye|eyes|mouth|face|shadow|anim)\b[^"]*"/;

export function assertSafeMarkup(markup, label) {
  for (const [pattern, what] of FORBIDDEN) {
    assert.doesNotMatch(markup, pattern, `${label} contains ${what}`);
  }
  for (const tag of markup.match(/<g\b[^>]*>/g) ?? []) {
    if (ANIMATED.test(tag)) {
      assert.doesNotMatch(tag, /\stransform\s*=/, `${label}: animated group carries a transform attribute: ${tag}`);
    }
  }
  const opens = (markup.match(/<g\b[^>]*[^/]>|<g>/g) ?? []).length;
  const closes = (markup.match(/<\/g>/g) ?? []).length;
  assert.equal(opens, closes, `${label}: unbalanced <g> tags`);
}
