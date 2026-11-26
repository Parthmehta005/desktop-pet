/**
 * The pet controller: runs one pet along a strip element.
 *
 * It owns the mood engine, the walker and the pet view, and every animation frame it
 * moves the pet, expires timed moods, and shows the right animation and speech bubble.
 * Events from outside (the preview stage's buttons, or the Electron main process) go in
 * through `dispatch()`. The browser preview and the desktop window both use this file
 * unchanged.
 *
 *   const pet = createController({ strip, pet: getPet('cat'), config });
 *   pet.dispatch({ type: 'claude', hook: 'UserPromptSubmit', sessionId: 'a' });
 */

import { createEngine } from '../core/engine.js';
import { MOODS, presentation, animationStateFor } from '../core/moods.js';
import { createWalker, stepWalker, resizeWalker } from '../core/walker.js';
import { createPetView } from './pet-view.js';

/** Pet size in CSS pixels at petSize 1. */
export const BASE_PET_SIZE = 140;
/** How often the engine is ticked so timed moods expire. */
const TICK_MS = 250;
/** How long a speech bubble stays up, in real time. */
export const BUBBLE_MS = 3500;

function petSizePx(config) {
  const scale = Number(config.petSize);
  return Math.round(BASE_PET_SIZE * (Number.isFinite(scale) && scale > 0 ? scale : 1));
}

/**
 * @param {object} options
 * @param {HTMLElement} options.strip     The element the pet walks along (bottom edge = ground).
 * @param {object} options.pet            A pet definition from src/renderer/pets.
 * @param {object} [options.config]       Validated config (see src/core/config.js).
 * @param {() => number} [options.now]    Clock in ms; the preview passes a faster one.
 * @param {() => number} [options.rng]    Random source for walking.
 */
export function createController({ strip, pet, config = {}, now = Date.now, rng = Math.random }) {
  const actor = document.createElement('div');
  actor.className = 'pet-actor';
  const view = createPetView(pet, {});
  actor.append(view.element);
  strip.append(actor);

  let settings = { walkSpeed: 1, petSize: 1, ...config };
  let size = petSizePx(settings);
  const engine = createEngine(settings);
  let result = engine.mood(now());
  let walker = createWalker({ width: strip.clientWidth, petWidth: size, rng });
  const lift = 0; // height above the ground; dragging (M4 step 3) lifts the pet
  let lastFrame = null;
  let lastTick = -Infinity;
  let frameId = null;
  let lastViewProps = '';
  // Speech bubble: shown when a mood starts, and again every bubbleEveryMs (engine clock)
  // for long moods like bedtime; it stays up for BUBBLE_MS of real time.
  const bubble = { mood: null, text: null, until: 0, lastAt: -Infinity };

  function applySize() {
    view.element.style.setProperty('--pet-size', `${size}px`);
    walker = resizeWalker(walker, strip.clientWidth, size);
  }
  applySize();

  function showBubble(text) {
    bubble.text = text;
    bubble.until = performance.now() + BUBBLE_MS;
    bubble.lastAt = now();
  }

  function currentBubble(look) {
    const def = MOODS[result.mood];
    if (result.mood !== bubble.mood) {
      bubble.mood = result.mood;
      if (def.bubble) showBubble(def.bubble);
      else bubble.until = 0;
    } else if (def.bubble && def.bubbleEveryMs && now() - bubble.lastAt >= def.bubbleEveryMs) {
      showBubble(def.bubble);
    }
    return look.showBubbles && performance.now() < bubble.until ? bubble.text : null;
  }

  function render() {
    const look = presentation(result);
    actor.style.transform = `translate(${walker.x}px, ${-lift}px)`;
    const props = {
      state: animationStateFor(result),
      intensity: result.intensity,
      facing: walker.facing,
      moving: walker.moving && look.speed > 0,
      meeting: result.modifiers.meeting,
      hidden: result.modifiers.hidden,
      bubble: currentBubble(look),
    };
    const key = JSON.stringify(props);
    if (key !== lastViewProps) {
      lastViewProps = key;
      view.update(props);
    }
  }

  function frame(time) {
    const dt = lastFrame === null ? 0 : time - lastFrame;
    lastFrame = time;
    const t = now();
    if (t - lastTick >= TICK_MS) {
      result = engine.dispatch({ type: 'tick' }, t);
      lastTick = t;
    }
    walker = stepWalker(walker, {
      dtMs: dt,
      speed: presentation(result).speed,
      walkSpeed: settings.walkSpeed,
      rng,
    });
    render();
    frameId = requestAnimationFrame(frame);
  }

  const resizeObserver = new ResizeObserver(() => {
    walker = resizeWalker(walker, strip.clientWidth, size);
    render();
  });
  resizeObserver.observe(strip);
  frameId = requestAnimationFrame(frame);

  return {
    /** Sends an engine event (see src/core/engine.js) and returns the new mood. */
    dispatch(event) {
      result = engine.dispatch(event, now());
      render();
      return result;
    },
    /** Swaps the pet drawing; the mood and position carry on. */
    setPet(next) {
      view.update({ pet: next });
      lastViewProps = '';
      render();
    },
    /** Applies changed settings (walk speed, pet size, idle minutes, app rules...). */
    setConfig(changes) {
      settings = { ...settings, ...changes };
      size = petSizePx(settings);
      result = engine.dispatch({ type: 'config', config: changes }, now());
      applySize();
      render();
    },
    /** A plain snapshot of what the pet is doing, for status displays and tests. */
    snapshot() {
      return {
        pet: view.state.pet.id,
        mood: result.mood,
        state: animationStateFor(result),
        intensity: result.intensity,
        modifiers: { ...result.modifiers },
        claude: { ...result.claude },
        x: walker.x,
        lift,
        width: walker.width,
        petSize: size,
        facing: walker.facing,
        moving: walker.moving,
        bubble: view.state.bubble,
        opacity: getComputedStyle(view.element).opacity,
      };
    },
    destroy() {
      cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      actor.remove();
    },
  };
}
