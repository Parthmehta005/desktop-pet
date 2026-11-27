// The settings window. Builds the form from settings-fields.js, saves each change as you
// make it (after checking it with the same validation the app uses), and shows errors
// next to the field. Talks to the main process only through window.petSettings.
import { SECTIONS, FIELDS } from './settings-fields.js';
import { CONFIG_SCHEMA, validateConfig } from '../core/config.js';
import { PETS } from '../core/pets.js';
import { DEFAULT_APP_RULES, RULE_FIELDS } from '../core/app-rules.js';
import { APP_RULE_MOODS } from '../core/moods.js';
import { PET_DEFINITIONS } from './pets/index.js';
import { createPetView } from './pet-view.js';

const bridge = window.petSettings;
const form = document.getElementById('settings');
let state = await bridge.getState();

const el = (tag, props = {}, ...children) => {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'dataset') Object.assign(node.dataset, v);
    else if (k in node) node[k] = v;
    else node.setAttribute(k, v);
  }
  node.append(...children.filter((c) => c !== null && c !== undefined));
  return node;
};

// ---------- Saving ----------

function showError(key, message) {
  const box = form.querySelector(`[data-field="${key}"] .field-error`);
  box.textContent = message ?? '';
  box.hidden = !message;
}

async function save(changes) {
  const [key] = Object.keys(changes);
  const local = validateConfig({ ...state.config, ...changes }).errors.filter((e) => e.key === key);
  if (local.length) {
    showError(key, local.map((e) => e.message).join('; '));
    return false;
  }
  const result = await bridge.save(changes);
  if (!result.ok) {
    showError(key, result.errors.map((e) => e.message).join('; '));
    return false;
  }
  showError(key, null);
  state = result.state;
  refresh();
  return true;
}

// ---------- Controls ----------

/**
 * Wraps a control with its label, help text and error line. `labelled` is the input the
 * label names, even when `control` is a row around it. Pass null for compound fields
 * (folder list, rules table): their title then names the group, so buttons inside keep
 * their own names.
 */
function fieldShell(key, info, control, labelled = control) {
  const id = `field-${key}`;
  const help = info.help ? el('p', { className: 'field-help', id: `${id}-help` }, info.help) : null;
  let label;
  if (labelled) {
    labelled.id = id;
    label = el('label', { htmlFor: id, className: 'field-label' }, info.label);
    if (help) labelled.setAttribute('aria-describedby', help.id);
  } else {
    label = el('p', { className: 'field-label', id: `${id}-label` }, info.label);
    control.setAttribute('role', 'group');
    control.setAttribute('aria-labelledby', label.id);
    if (help) control.setAttribute('aria-describedby', help.id);
  }
  return el('div', { className: `field field-${info.control}`, dataset: { field: key } },
    label, control, help, el('p', { className: 'field-error', role: 'alert', hidden: true }));
}

function checkbox(key, info) {
  const input = el('input', { type: 'checkbox' });
  input.addEventListener('change', () => save({ [key]: input.checked }));
  const wrap = fieldShell(key, info, input);
  wrap.update = () => { input.checked = state.config[key]; };
  return wrap;
}

function number(key, info) {
  const spec = CONFIG_SCHEMA[key];
  const input = el('input', { type: 'number', min: spec.min, max: spec.max, step: spec.type === 'integer' ? 1 : 'any' });
  input.addEventListener('change', () => save({ [key]: input.value === '' ? Number.NaN : Number(input.value) }));
  const unit = info.unit ? el('span', { className: 'unit' }, info.unit) : null;
  const row = el('span', { className: 'number-row' }, input, unit);
  const wrap = fieldShell(key, info, row, input);
  wrap.update = () => { if (document.activeElement !== input) input.value = String(state.config[key]); };
  return wrap;
}

function range(key, info) {
  const spec = CONFIG_SCHEMA[key];
  const input = el('input', { type: 'range', min: spec.min, max: spec.max, step: info.step });
  const value = el('output', { className: 'range-value' });
  input.addEventListener('input', () => { value.textContent = `${Number(input.value).toFixed(2)}${info.unit}`; });
  input.addEventListener('change', () => save({ [key]: Number(input.value) }));
  const row = el('span', { className: 'range-row' }, input, value);
  const wrap = fieldShell(key, info, row, input);
  wrap.update = () => {
    input.value = String(state.config[key]);
    value.textContent = `${Number(state.config[key]).toFixed(2)}${info.unit}`;
  };
  return wrap;
}

function time(key, info) {
  const input = el('input', { type: 'time' });
  const parts = [input];
  let toggle = null;
  if (info.nullable) {
    toggle = el('input', { type: 'checkbox', id: `field-${key}-on` });
    toggle.addEventListener('change', () => save({ [key]: toggle.checked ? (input.value || '00:30') : null }));
    parts.unshift(el('label', { className: 'inline-toggle', htmlFor: toggle.id }, toggle, ' On'));
  }
  input.addEventListener('change', () => { if (input.value) save({ [key]: input.value }); });
  const row = el('span', { className: 'time-row' }, ...parts);
  const wrap = fieldShell(key, info, row, input);
  wrap.update = () => {
    const v = state.config[key];
    input.disabled = v === null;
    if (v !== null) input.value = v;
    if (toggle) toggle.checked = v !== null;
  };
  return wrap;
}

function pets(key, info) {
  const group = el('div', { className: 'pet-cards', role: 'radiogroup', 'aria-label': info.label });
  const cards = PETS.map((pet) => {
    const radio = el('input', { type: 'radio', name: 'pet', value: pet.id, id: `pet-${pet.id}` });
    radio.addEventListener('change', () => save({ pet: pet.id }));
    const view = createPetView(PET_DEFINITIONS[pet.id], { state: 'wander' });
    view.element.style.setProperty('--pet-size', '84px');
    const card = el('label', { className: 'pet-card', htmlFor: radio.id, dataset: { pet: pet.id } },
      radio, view.element, el('span', { className: 'pet-name' }, pet.name), el('span', { className: 'pet-species' }, pet.species));
    group.append(card);
    return { radio, card };
  });
  const wrap = el('div', { className: 'field field-pets', dataset: { field: key } },
    el('p', { className: 'field-label' }, info.label), group,
    el('p', { className: 'field-help' }, info.help), el('p', { className: 'field-error', role: 'alert', hidden: true }));
  wrap.update = () => {
    for (const { radio, card } of cards) {
      radio.checked = radio.value === state.config.pet;
      card.classList.toggle('selected', radio.checked);
    }
  };
  return wrap;
}

function folders(key, info) {
  const list = el('ul', { className: 'folder-list' });
  const add = el('button', { type: 'button', className: 'add-folder' }, 'Add folder...');
  add.addEventListener('click', async () => {
    const folder = await bridge.pickFolder();
    if (folder) save({ watchedFolders: [...state.config.watchedFolders, folder] });
  });
  const box = el('div', { className: 'folders' }, list, add);
  const wrap = fieldShell(key, info, box, null);
  wrap.update = () => {
    list.replaceChildren(...state.config.watchedFolders.map((folder, i) => {
      const remove = el('button', { type: 'button', className: 'remove', 'aria-label': `Stop watching ${folder}` }, 'Remove');
      remove.addEventListener('click', () => save({ watchedFolders: state.config.watchedFolders.filter((_, j) => j !== i) }));
      return el('li', {}, el('code', {}, folder), remove);
    }));
    if (state.config.watchedFolders.length === 0) list.append(el('li', { className: 'empty' }, 'None yet: every Claude session counts.'));
  };
  return wrap;
}

function rules(key, info) {
  const body = el('tbody');
  const table = el('table', { className: 'rules' },
    el('thead', {}, el('tr', {}, el('th', {}, 'Name'), el('th', {}, 'Process'), el('th', {}, 'Window title'),
      el('th', {}, 'Install path'), el('th', {}, 'Mood'), el('th', {}, el('span', { className: 'visually-hidden' }, 'Actions')))),
    body);
  const addRule = el('button', { type: 'button' }, 'Add rule');
  const reset = el('button', { type: 'button' }, 'Restore default rules');
  const saveRules = (next) => save({ appRules: next });
  addRule.addEventListener('click', () => saveRules([...state.config.appRules, { name: 'New rule', process: '^app-name$', mood: 'vibing' }]));
  reset.addEventListener('click', () => saveRules(DEFAULT_APP_RULES.map((r) => ({ ...r }))));
  const box = el('div', { className: 'rules-box' }, table, el('div', { className: 'rules-actions' }, addRule, reset));
  const wrap = fieldShell(key, info, box, null);

  wrap.update = () => {
    const current = state.config.appRules;
    body.replaceChildren(...current.map((rule, i) => {
      const edit = (changes) => {
        const next = current.map((r, j) => (j === i ? { ...r, ...changes } : r));
        for (const f of RULE_FIELDS) if (next[i][f] === '') delete next[i][f];
        saveRules(next);
      };
      const text = (field, aria) => {
        const input = el('input', { type: 'text', value: rule[field] ?? '', 'aria-label': `${aria}, rule ${i + 1}`, spellcheck: false });
        input.addEventListener('change', () => edit({ [field]: input.value }));
        return el('td', {}, input);
      };
      const mood = el('select', { 'aria-label': `Mood, rule ${i + 1}` },
        ...APP_RULE_MOODS.map((m) => el('option', { value: m, selected: m === rule.mood }, m)));
      mood.addEventListener('change', () => edit({ mood: mood.value }));
      const move = (delta, label) => {
        const b = el('button', { type: 'button', 'aria-label': `${label} rule ${i + 1}`, disabled: i + delta < 0 || i + delta >= current.length }, label === 'Move up' ? '↑' : '↓');
        b.addEventListener('click', () => {
          const next = [...current];
          [next[i], next[i + delta]] = [next[i + delta], next[i]];
          saveRules(next);
        });
        return b;
      };
      const remove = el('button', { type: 'button', 'aria-label': `Delete rule ${i + 1}` }, '✕');
      remove.addEventListener('click', () => saveRules(current.filter((_, j) => j !== i)));
      return el('tr', {}, text('name', 'Name'), text('process', 'Process'), text('title', 'Window title'), text('path', 'Install path'),
        el('td', {}, mood), el('td', { className: 'row-actions' }, move(-1, 'Move up'), move(1, 'Move down'), remove));
    }));
  };
  return wrap;
}

const BUILDERS = { checkbox, number, range, time, pets, folders, rules };

// ---------- Claude Code hooks panel ----------

function hooksPanel() {
  const status = el('p', { className: 'hooks-status', role: 'status' });
  const where = el('p', { className: 'field-help' });
  const install = el('button', { type: 'button' }, 'Install Claude Code hooks');
  const remove = el('button', { type: 'button' }, 'Remove Claude Code hooks');
  const message = el('p', { className: 'field-help hooks-message', role: 'status' });
  const act = async (fn) => {
    install.disabled = true;
    remove.disabled = true;
    const result = await fn();
    message.textContent = result.message;
    state = result.state;
    refresh();
  };
  install.addEventListener('click', () => act(bridge.installHooks));
  remove.addEventListener('click', () => act(bridge.uninstallHooks));
  const panel = el('div', { className: 'hooks-panel', dataset: { panel: 'hooks' } },
    el('h3', {}, 'Hooks'), status, where, el('div', { className: 'hooks-actions' }, install, remove), message);
  panel.update = () => {
    const { status: s, settingsPath, serverError } = state.hooks;
    status.dataset.status = s;
    status.textContent = serverError ?? {
      installed: 'Connected: Claude Code tells the pet what it is doing.',
      outdated: 'Out of date: reinstall to use the current port and token.',
      'not-installed': 'Not installed yet.',
      'invalid-settings': "Can't read Claude Code's settings.json. Fix or remove it, then try again.",
    }[s] ?? 'Checking...';
    where.textContent = settingsPath ? `Claude Code settings: ${settingsPath}` : '';
    install.disabled = s === 'installed' || s === 'invalid-settings';
    remove.disabled = !(s === 'installed' || s === 'outdated');
  };
  return panel;
}

// ---------- Build and refresh ----------

const updaters = [];
for (const section of SECTIONS) {
  const fieldset = el('section', { className: 'settings-section', dataset: { section: section.id } }, el('h2', {}, section.title));
  for (const key of section.fields) {
    const build = BUILDERS[FIELDS[key].control];
    if (!build) continue; // added in later steps
    const field = build(key, FIELDS[key]);
    updaters.push(field);
    fieldset.append(field);
  }
  if (section.id === 'claude') {
    const panel = hooksPanel();
    updaters.push(panel);
    fieldset.append(panel);
  }
  form.append(fieldset);
}

function refresh() {
  for (const u of updaters) u.update();
}

bridge.onState((next) => {
  state = next;
  refresh();
});
refresh();
document.body.dataset.ready = 'true';
