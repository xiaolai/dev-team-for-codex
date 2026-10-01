import assert from 'node:assert/strict';
import { test } from 'node:test';
import { initialState, advance } from './workflow.mjs';

const pass = stage => ({ stage, outcome: 'pass', report: `${stage}.md` });
const fail = stage => ({ stage, outcome: 'fail', report: `${stage}.md` });

test('small tasks still require planning and tests before implementation', () => {
  let state = initialState('small', 'auto');
  assert.equal(state.next, 'planner');
  assert.throws(() => advance(state, pass('coder')), /Expected planner/);
  state = advance(state, pass('planner'));
  state = advance(state, pass('tester'));
  state = advance(state, pass('coder'));
  state = advance(state, pass('audit'));
  assert.equal(state.status, 'complete');
});

test('hard-to-reverse plans are audited before tests and get only one revision', () => {
  let state = advance(initialState('standard', 'auto'), pass('scout'));
  state = advance(state, { ...pass('planner'), hardToReverse: true });
  assert.equal(state.next, 'plan-audit');
  state = advance(state, fail('plan-audit'));
  state = advance(state, pass('planner'));
  state = advance(state, fail('plan-audit'));
  assert.equal(state.status, 'blocked');
});

test('invalid red runs get one correction and audit fixes stop after two rounds', () => {
  let state = advance(initialState('small', 'never'), pass('planner'));
  state = advance(state, fail('tester'));
  assert.equal(state.next, 'tester');
  assert.equal(advance(state, fail('tester')).status, 'blocked');
  state = advance(state, pass('tester'));
  for (let round = 0; round < 3; round++) {
    state = advance(state, pass('coder'));
    state = advance(state, fail('audit'));
  }
  assert.equal(state.status, 'blocked');
  assert.throws(() => advance(state, pass('coder')), /blocked/);
});

test('engine errors, coder gate failures, and disputed tests stop immediately', () => {
  let state = advance(initialState('small', 'never'), pass('planner'));
  state = advance(state, pass('tester'));
  assert.equal(advance(state, fail('coder')).status, 'blocked');
  state = advance(state, pass('coder'));
  assert.equal(advance(state, { stage: 'audit', outcome: 'error', report: 'failed.md' }).status, 'blocked');
});
