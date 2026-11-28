import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {runInNewContext} from 'node:vm';

const read = name => readFileSync(new URL('../public/' + name, import.meta.url), 'utf8');

function makeDialogue() {
  const timers = new Map();
  let next = 0;
  const {mapDialogueLines, createMapDialogue} = runInNewContext(
    read('map-dialogue.js') + '\n({mapDialogueLines, createMapDialogue})',
    {
      setTimeout(callback) { timers.set(++next, callback); return next; },
      clearTimeout(id) { timers.delete(id); },
    },
  );
  const label = {textContent: ''};
  const quote = {textContent: ''};
  const bubble = {hidden: true, dataset: {}, querySelector: selector => selector.endsWith('name') ? label : quote};
  const viewport = {getBoundingClientRect: () => ({left: 10, right: 310, top: 50, bottom: 450})};
  return {mapDialogueLines, speech: createMapDialogue(bubble, viewport), bubble, label, quote, timers};
}

test('通常マップの20場面に異なるセリフが各5種あり、一巡するまで繰り返さない', () => {
  const {mapDialogueLines, speech, quote} = makeDialogue();
  const events = Object.entries(mapDialogueLines);
  const lines = new Set();
  assert.equal(events.length, 20);
  for (const [event, variants] of events) {
    assert.equal(variants.length, 5);
    for (const variant of variants) {
      assert.ok(variant.trim());
      assert.ok(!lines.has(variant), variant);
      lines.add(variant);
      speech.show(event, '作戦司令部', 'friendly');
      assert.equal(quote.textContent, variant);
    }
    speech.show(event, '作戦司令部', 'friendly');
    assert.equal(quote.textContent, variants[0]);
  }
  assert.equal(lines.size, 100);
});

test('吹き出しは部隊の反対側に配置し、敵の連続移動は表示中のセリフを上書きしない', () => {
  const {speech, bubble, label, timers} = makeDialogue();
  const left = {getBoundingClientRect: () => ({left: 12, right: 60, top: 60, bottom: 108})};
  speech.show('move', '味方歩兵', 'friendly', left);
  assert.equal(bubble.dataset.align, 'right');
  assert.equal(label.textContent, '味方歩兵');
  speech.show('enemyAdvance', '敵戦車', 'enemy', undefined, true);
  assert.equal(bubble.dataset.event, 'move');

  speech.show('enemyDeploy', '敵戦車', 'enemy');
  assert.equal(bubble.dataset.side, 'enemy');
  assert.equal(label.textContent, '敵戦車');
  assert.equal(timers.size, 1);
  for (const hide of timers.values()) hide();
  assert.equal(bubble.hidden, true);
  assert.equal(timers.size, 0);
});
