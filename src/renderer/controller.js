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
import { createWalker, stepWalker, resizeWalker, placeWalker } from '../core/walker.js';
import { petSizePx as petSizeFor } from '../core/layout.js';
import { createPetView } from './pet-view.js';

/** How often the engine is ticked so timed moods expire. */
const TICK_MS = 250;
/** How long a speech bubble stays up, in real time. */
export const BUBBLE_MS = 3500;
/** Falling acceleration in px/s². */
const GRAVITY = 2600;
/** Pointer travel (px) that turns a click into a drag. */
const DRAG_THRESHOLD = 5;
/** Length of the landing squash. */
const LANDING_MS = 350;
/** Fraction of the pet's box, on each side, that doesn't count as "on the pet". */
const HIT_INSET = 0.14;
/** How many recent mood changes snapshot() reports. */
const HISTORY_LENGTH = 50;

function petSizePx(config) {
  return petSizeFor(config.petSize);
}

/**
 * @param {object} options
 * @param {HTMLElement} options.strip     The element the pet walks along (bottom edge = ground).
 * @param {object} options.pet            A pet definition from src/renderer/pets.
 * @param {object} [options.config]       Validated config (see src/core/config.js).
 * @param {() => number} [options.now]    Clock in ms; the preview passes a faster one.
 * @param {() => number} [options.rng]    Random source for walking.
 * @param {(over: boolean) => void} [options.onHoverChange]
 *   Called when the pointer moves onto or off the pet (or a drag starts or ends). The
 *   desktop window uses it to stop letting clicks through while the pet is under them.
 * @param {() => void} [options.onBatteryClick]
 *   Called instead of petting when the pet is clicked while it panics about the battery;
 *   the desktop window opens Windows' battery settings.
 */
export function createController({
  strip, pet, config = {}, now = Date.now, rng = Math.random, onHoverChange = () => {},
  onBatteryClick = () => {},
}) {
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
  let lift = 0; // height above the ground while held or falling
  let velocity = 0;
  let falling = false;
  let drag = null;
  let hovering = false;
  let landingTimer = null;
  let lastFrame = null;
  let lastTick = -Infinity;
  let frameId = null;
  let lastViewProps = '';
  // Speech bubble: shown when a mood starts, and again every bubbleEveryMs (engine clock)
  // for long moods like bedtime; it stays up for BUBBLE_MS of real time.
  const bubble = { mood: null, text: null, until: 0, lastAt: -Infinity };
  const history = [];

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
    if (history.at(-1) !== result.mood) {
      history.push(result.mood);
      if (history.length > HISTORY_LENGTH) history.shift();
    }
    const look = presentation(result);
    actor.style.transform = `translate(${walker.x}px, ${-lift}px)`;
    const props = {
      state: animationStateFor(result),
      intensity: result.intensity,
      facing: walker.facing,
      moving: walker.moving && (look.speed > 0 || MOODS[result.mood].goesTo !== null),
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

  function dispatch(event) {
    result = engine.dispatch(event, now());
    render();
    return result;
  }

  function maxLift() {
    return Math.max(0, strip.clientHeight - size);
  }

  function land() {
    falling = false;
    velocity = 0;
    lift = 0;
    dispatch({ type: 'land' });
    // Restart the squash even if the last one hasn't finished.
    view.element.classList.remove('landing');
    void view.element.offsetWidth;
    view.element.classList.add('landing');
    clearTimeout(landingTimer);
    landingTimer = setTimeout(() => view.element.classList.remove('landing'), LANDING_MS);
  }

  function frame(time) {
    const dt = lastFrame === null ? 0 : Math.min(time - lastFrame, 1000);
    lastFrame = time;
    const t = now();
    if (t - lastTick >= TICK_MS) {
      result = engine.dispatch({ type: 'tick' }, t);
      lastTick = t;
    }
    if (falling) {
      velocity += (GRAVITY * dt) / 1000;
      lift = Math.max(0, lift - (velocity * dt) / 1000);
      if (lift === 0) land();
    } else if (!drag?.active) {
      walker = stepWalker(walker, {
        dtMs: dt,
        speed: presentation(result).speed,
        walkSpeed: settings.walkSpeed,
        goTo: MOODS[result.mood].goesTo,
        rng,
      });
    }
    render();
    frameId = requestAnimationFrame(frame);
  }

  // ---------- Pointer: click to pet, drag to carry, release to drop ----------

  function isOverPet(clientX, clientY) {
    if (result.modifiers.hidden) return false;
    const r = view.element.getBoundingClientRect();
    const dx = r.width * HIT_INSET;
    const dy = r.height * HIT_INSET;
    return clientX >= r.left + dx && clientX <= r.right - dx && clientY >= r.top + dy && clientY <= r.bottom;
  }

  function setHover(over) {
    if (over === hovering) return;
    hovering = over;
    onHoverChange(over);
  }

  function onPointerDown(e) {
    if (e.button !== 0 || !isOverPet(e.clientX, e.clientY)) return;
    const r = strip.getBoundingClientRect();
    drag = {
      id: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      offsetX: e.clientX - r.left - walker.x,
      offsetY: r.bottom - e.clientY - lift,
      active: false,
    };
    view.element.setPointerCapture?.(e.pointerId);
    e.preventDefault();
  }

  function onPointerMove(e) {
    if (!drag || e.pointerId !== drag.id) {
      setHover(isOverPet(e.clientX, e.clientY));
      return;
    }
    if (!drag.active && Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) >= DRAG_THRESHOLD) {
      drag.active = true;
      falling = false;
      actor.classList.add('dragging');
      dispatch({ type: 'grab' });
    }
    if (drag.active) {
      const r = strip.getBoundingClientRect();
      walker = placeWalker(walker, e.clientX - r.left - drag.offsetX);
      lift = Math.min(Math.max(r.bottom - e.clientY - drag.offsetY, 0), maxLift());
      render();
    }
  }

  function onPointerUp(e) {
    if (!drag || e.pointerId !== drag.id) return;
    const wasDragging = drag.active;
    drag = null;
    actor.classList.remove('dragging');
    view.element.releasePointerCapture?.(e.pointerId);
    if (wasDragging) {
      dispatch({ type: 'drop' });
      falling = true;
      velocity = 0;
      if (lift === 0) land();
    } else if (e.type === 'pointerup') {
      // While it panics about the battery, a click asks for the battery settings.
      if (result.mood === 'low-battery') onBatteryClick();
      else dispatch({ type: 'pet' });
    }
    setHover(isOverPet(e.clientX, e.clientY));
  }

  view.element.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
  window.addEventListener('pointercancel', onPointerUp);

  const resizeObserver = new ResizeObserver(() => {
    walker = resizeWalker(walker, strip.clientWidth, size);
    lift = Math.min(lift, maxLift());
    render();
  });
  resizeObserver.observe(strip);
  frameId = requestAnimationFrame(frame);

  return {
    /** Sends an engine event (see src/core/engine.js) and returns the new mood. */
    dispatch,
    /** True if a screen point is over the pet (used for click-through on the desktop). */
    isOverPet,
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
        dragging: Boolean(drag?.active),
        falling,
        hovering,
        history: [...history],
      };
    },
    destroy() {
      cancelAnimationFrame(frameId);
      clearTimeout(landingTimer);
      resizeObserver.disconnect();
      view.element.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
      actor.remove();
    },
  };
}
