// The preview gallery: one live cell per animation state, plus the three sweat levels.
//
// Query parameters:
//   pet=<id>     which pet to show (default: cat)
//   bg=dark      dark page background, to check the pets read well on both
import { ANIMATION_STATE_IDS, MOODS, MODIFIERS } from '../src/core/moods.js';
import { getPet } from '../src/renderer/pets/index.js';
import { createPetView } from '../src/renderer/pet-view.js';

const gallery = document.getElementById('gallery');
const params = new URLSearchParams(location.search);
const pet = getPet(params.get('pet') ?? 'cat');

function setBackground(bg) {
  document.documentElement.dataset.bg = bg;
  toggle.textContent = bg === 'dark' ? 'Light background' : 'Dark background';
  toggle.setAttribute('aria-pressed', String(bg === 'dark'));
}

const toolbar = document.createElement('div');
toolbar.className = 'toolbar';
const toggle = document.createElement('button');
toggle.type = 'button';
toggle.className = 'bg-toggle';
toggle.addEventListener('click', () => {
  const bg = document.documentElement.dataset.bg === 'dark' ? 'light' : 'dark';
  setBackground(bg);
  params.set('bg', bg);
  history.replaceState(null, '', `?${params}`);
});
toolbar.append(toggle);
setBackground(params.get('bg') === 'dark' ? 'dark' : 'light');

function cell({ state, intensity = 1, title, detail }) {
  const figure = document.createElement('figure');
  figure.className = 'cell';
  figure.dataset.state = state;
  figure.dataset.pet = pet.id;
  figure.dataset.intensity = String(intensity);

  const view = createPetView(pet, {
    state,
    intensity,
    bubble: MOODS[state]?.bubble ?? null,
    moving: state === 'wander',
    meeting: state === 'meeting',
  });

  const caption = document.createElement('figcaption');
  const name = document.createElement('strong');
  name.textContent = title;
  const id = document.createElement('code');
  id.textContent = state;
  const trigger = document.createElement('span');
  trigger.className = 'trigger';
  trigger.textContent = detail;
  caption.append(name, ' ', id, trigger);

  figure.append(view.element, caption);
  return figure;
}

function section(heading, className, cells) {
  const wrapper = document.createElement('section');
  wrapper.className = className;
  const h2 = document.createElement('h2');
  h2.textContent = heading;
  const grid = document.createElement('div');
  grid.className = 'grid';
  grid.append(...cells);
  wrapper.append(h2, grid);
  return wrapper;
}

const states = ANIMATION_STATE_IDS.map((state) => {
  const def = MOODS[state] ?? MODIFIERS[state];
  return cell({ state, title: def.label, detail: def.trigger });
});

const sweat = [1, 2, 3].map((intensity) => cell({
  state: 'working',
  intensity,
  title: `Sweat level ${intensity}`,
  detail: intensity === 3 ? '3 or more Claude sessions busy' : `${intensity} Claude session${intensity > 1 ? 's' : ''} busy`,
}));

gallery.append(
  toolbar,
  section(`${pet.name} the ${pet.species.toLowerCase()}: every state`, 'states', states),
  section('Working harder: sweat levels', 'intensities', sweat),
);
gallery.dataset.ready = 'true';
