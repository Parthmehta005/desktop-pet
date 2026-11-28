/**
 * Sizes shared by the pet window (main process) and the renderer.
 */

/** Pet size in CSS pixels at petSize 1. */
export const BASE_PET_SIZE = 140;
/** Room above the pet for speech bubbles, hops and props. */
export const HEADROOM = 110;

function scale(petSize) {
  const n = Number(petSize);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

export function petSizePx(petSize) {
  return Math.round(BASE_PET_SIZE * scale(petSize));
}

export function stripHeight(petSize) {
  return petSizePx(petSize) + HEADROOM;
}

/**
 * Where the pet's window goes: a strip across the bottom of the work area (the screen
 * minus the taskbar), so the pet stands on top of the taskbar.
 *
 * While the pet is carried (or falling after being dropped) the window is `lifted`: it
 * fills the whole work area, so the pet can be lifted anywhere above the taskbar. The
 * bottom edge stays put, so the pet doesn't move on screen when the window changes.
 *
 * @param {{ x: number, y: number, width: number, height: number }} workArea
 * @param {number} petSize
 * @param {{ lifted?: boolean }} [options]
 */
export function stripBounds(workArea, petSize, { lifted = false } = {}) {
  const full = Math.max(1, Math.round(workArea.height));
  const height = lifted ? full : Math.min(stripHeight(petSize), full);
  return {
    x: Math.round(workArea.x),
    y: Math.round(workArea.y + workArea.height - height),
    width: Math.max(1, Math.round(workArea.width)),
    height,
  };
}
