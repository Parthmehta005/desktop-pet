// The preview stage: the real controller running on a pretend desktop.
import { getPet } from '../src/renderer/pets/index.js';
import { createController } from '../src/renderer/controller.js';

const stage = document.getElementById('stage');
const strip = document.getElementById('strip');

const controller = createController({ strip, pet: getPet('cat') });
controller.dispatch({ type: 'app-start' });

// For tests and curious developers.
window.__stage = { controller };
stage.dataset.ready = 'true';
