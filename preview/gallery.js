// The preview gallery: every pet in every animation state.
//
// Query parameters:
//   pet=<id>|all   one pet (with its sweat levels) or every pet (default: all)
//   bg=dark        dark page background, to check the pets read well on both
import { ANIMATION_STATE_IDS, MOODS, MODIFIERS } from '../src/core/moods.js';
import { PET_DEFINITIONS } from '../src/renderer/pets/index.js';
import { createPetView } from '../src/renderer/pet-view.js';

const gallery = document.getElementById('gallery');
const params = new URLSearchParams(location.search);
const requested = params.get('pet') ?? 'all';
const selected = PET_DEFINITIONS[requested] ? requested : 'all';
const pets = selected === 'all' ? Object.values(PET_DEFINITIONS) : [PET_DEFINITIONS[selected]];

function navigate(changes) {
  for (const [key, value] of Object.entries(changes)) params.set(key, value);
  location.search = `?${params}`;
}

function setBackground(bg) {
  document.documentElement.dataset.bg = bg;
  bgToggle.textContent = bg === 'dark' ? 'Light background' : 'Dark background';
  bgToggle.setAttribute('aria-pressed', String(bg === 'dark'));
}

// ---------- Toolbar: pet filter and background toggle ----------

const toolbar = document.createElement('div');
toolbar.className = 'toolbar';

const filterGroup = document.createElement('span');
filterGroup.className = 'pet-filter';
const filterLabel = document.createElement('label');
filterLabel.htmlFor = 'pet-filter';
filterLabel.textContent = 'Pet';
const filter = document.createElement('select');
filter.id = 'pet-filter';
filter.name = 'pet';
for (const [value, text] of [['all', 'All pets'], ...Object.values(PET_DEFINITIONS).map((p) => [p.id, `${p.name} (${p.species})`])]) {
  const option = document.createElement('option');
  option.value = value;
  option.textContent = text;
  option.selected = value === selected;
  filter.append(option);
}
filter.addEventListener('change', () => navigate({ pet: filter.value }));
filterGroup.append(filterLabel, filter);

const bgToggle = document.createElement('button');
bgToggle.type = 'button';
bgToggle.className = 'bg-toggle';
bgToggle.addEventListener('click', () => {
  const bg = document.documentElement.dataset.bg === 'dark' ? 'light' : 'dark';
  setBackground(bg);
  params.set('bg', bg);
  history.replaceState(null, '', `?${params}`);
});

toolbar.append(filterGroup, bgToggle);
setBackground(params.get('bg') === 'dark' ? 'dark' : 'light');

// ---------- Cells ----------

function cell(pet, { state, intensity = 1, title, detail }) {
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

function section(heading, className, cells, petId) {
  const wrapper = document.createElement('section');
  wrapper.className = className;
  if (petId) wrapper.dataset.pet = petId;
  const h2 = document.createElement('h2');
  h2.textContent = heading;
  const grid = document.createElement('div');
  grid.className = 'grid';
  grid.append(...cells);
  wrapper.append(h2, grid);
  return wrapper;
}

gallery.append(toolbar);

for (const pet of pets) {
  const states = ANIMATION_STATE_IDS.map((state) => {
    const def = MOODS[state] ?? MODIFIERS[state];
    return cell(pet, { state, title: def.label, detail: def.trigger });
  });
  gallery.append(section(`${pet.name} the ${pet.species.toLowerCase()}`, 'states', states, pet.id));
}

if (selected !== 'all') {
  const [pet] = pets;
  const sweat = [1, 2, 3].map((intensity) => cell(pet, {
    state: 'working',
    intensity,
    title: `Sweat level ${intensity}`,
    detail: intensity === 3 ? '3 or more Claude sessions busy' : `${intensity} Claude session${intensity > 1 ? 's' : ''} busy`,
  }));
  gallery.append(section('Working harder: sweat levels', 'intensities', sweat, pet.id));
}

gallery.dataset.ready = 'true';
