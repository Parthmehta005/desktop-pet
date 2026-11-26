/**
 * A pet on screen: an element showing one pet in one state, plus its speech bubble.
 * Used by the preview gallery and (from M4) by the controller that walks it around.
 *
 *   const view = createPetView(getPet('cat'), { state: 'working', intensity: 2 });
 *   container.append(view.element);
 *   view.update({ state: 'happy', bubble: 'Done!' });
 */

import { buildPetMarkup, lookFor, VIEWBOX_SIZE } from './rig.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

function setFlag(el, name, value) {
  el.dataset[name] = value ? 'true' : 'false';
}

export function createPetView(pet, initial = {}) {
  const element = document.createElement('div');
  element.className = 'pet-view';

  const bubble = document.createElement('div');
  bubble.className = 'pet-bubble';
  bubble.hidden = true;
  const bubbleText = document.createElement('span');
  bubble.append(bubbleText);

  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', 'pet-svg');
  svg.setAttribute('viewBox', `0 0 ${VIEWBOX_SIZE} ${VIEWBOX_SIZE}`);
  svg.setAttribute('role', 'img');

  element.append(bubble, svg);

  let current = {
    pet: null,
    state: 'wander',
    intensity: 1,
    bubble: null,
    facing: 1,
    moving: false,
    meeting: false,
    hidden: false,
  };

  function update(changes = {}) {
    const next = { ...current, ...changes };
    if (next.pet !== current.pet) {
      svg.innerHTML = buildPetMarkup(next.pet);
      element.dataset.pet = next.pet.id;
    }
    const look = lookFor(next.state);
    element.dataset.state = next.state;
    element.dataset.eyes = look.eyes;
    element.dataset.mouth = look.mouth;
    element.dataset.props = look.props.join(' ');
    element.dataset.intensity = String(Math.min(3, Math.max(1, Math.floor(next.intensity) || 1)));
    element.dataset.facing = next.facing === -1 ? '-1' : '1';
    setFlag(element, 'moving', next.moving);
    setFlag(element, 'meeting', next.meeting);
    setFlag(element, 'hidden', next.hidden);
    svg.setAttribute('aria-label', `${next.pet.name} the ${next.pet.species.toLowerCase()}: ${next.state}`);

    const text = next.meeting || next.hidden ? null : next.bubble;
    if (text !== current.bubble || bubble.hidden !== !text) {
      bubbleText.textContent = text ?? '';
      bubble.hidden = !text;
    }
    current = { ...next, bubble: text };
  }

  update({ ...initial, pet });

  return {
    element,
    update,
    get state() { return { ...current }; },
  };
}
