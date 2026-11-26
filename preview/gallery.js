// The preview gallery: one live cell per animation state.
import { ANIMATION_STATE_IDS, MOODS, MODIFIERS } from '../src/core/moods.js';
import { getPet } from '../src/renderer/pets/index.js';
import { createPetView } from '../src/renderer/pet-view.js';

const gallery = document.getElementById('gallery');
const params = new URLSearchParams(location.search);
const pet = getPet(params.get('pet') ?? 'cat');

const grid = document.createElement('div');
grid.className = 'grid';

for (const state of ANIMATION_STATE_IDS) {
  const def = MOODS[state] ?? MODIFIERS[state];
  const cell = document.createElement('figure');
  cell.className = 'cell';
  cell.dataset.state = state;
  cell.dataset.pet = pet.id;

  const view = createPetView(pet, {
    state,
    bubble: MOODS[state]?.bubble ?? null,
    moving: state === 'wander',
    meeting: state === 'meeting',
  });

  const caption = document.createElement('figcaption');
  const title = document.createElement('strong');
  title.textContent = def.label;
  const id = document.createElement('code');
  id.textContent = state;
  caption.append(title, ' ', id);

  cell.append(view.element, caption);
  grid.append(cell);
}

gallery.append(grid);
gallery.dataset.ready = 'true';
