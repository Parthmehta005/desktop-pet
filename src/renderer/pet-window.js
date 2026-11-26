// The desktop pet window: runs the controller and connects it to the main process
// through the preload bridge (window.desktopPet).
import { createController } from './controller.js';
import { getPet } from './pets/index.js';

const bridge = window.desktopPet;
const strip = document.getElementById('strip');

const { config } = await bridge.getConfig();

const controller = createController({
  strip,
  pet: getPet(config.pet),
  config,
  onHoverChange: (over) => bridge.setInteractive(over),
});

bridge.onEvent((event) => controller.dispatch(event));
bridge.onConfig((changes) => {
  if (changes.pet) controller.setPet(getPet(changes.pet));
  controller.setConfig(changes);
});

controller.dispatch({ type: 'app-start' });

// Lets tests and the developer console look at the pet; it has no special powers.
window.__pet = { controller };
document.body.dataset.ready = 'true';
bridge.ready();
