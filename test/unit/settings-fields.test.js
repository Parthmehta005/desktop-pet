import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SECTIONS, FIELDS, HIDDEN_FIELDS } from '../../src/renderer/settings-fields.js';
import { CONFIG_SCHEMA, CONFIG_KEYS } from '../../src/core/config.js';

const CONTROLS = ['pets', 'checkbox', 'number', 'range', 'time', 'folders', 'rules'];

test('every user-facing setting appears exactly once in the settings window', () => {
  const shown = SECTIONS.flatMap((s) => s.fields);
  assert.equal(new Set(shown).size, shown.length, 'no setting appears twice');
  assert.deepEqual([...shown].sort(), CONFIG_KEYS.filter((k) => !CONFIG_SCHEMA[k].internal).sort());
  assert.deepEqual(HIDDEN_FIELDS, ['hookToken']);
});

test('every field has a label, a known control, and a control that fits its type', () => {
  for (const key of Object.keys(FIELDS)) {
    const info = FIELDS[key];
    const type = CONFIG_SCHEMA[key].type;
    assert.ok(info.label, `${key} label`);
    assert.ok(CONTROLS.includes(info.control), `${key} control`);
    const fits = {
      boolean: ['checkbox'], integer: ['number'], number: ['range', 'number'], enum: ['pets'],
      time: ['time'], folders: ['folders'], appRules: ['rules'],
    }[type];
    assert.ok(fits.includes(info.control), `${key}: ${info.control} for a ${type}`);
    if (CONFIG_SCHEMA[key].nullable) assert.equal(info.nullable, true, `${key} can be switched off`);
  }
  assert.deepEqual(Object.keys(FIELDS).sort(), SECTIONS.flatMap((s) => s.fields).sort());
});
