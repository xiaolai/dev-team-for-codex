export function initialState(size, planAudit) {
  if (!['small', 'standard'].includes(size)) throw new Error('Size must be small or standard');
  if (!['auto', 'always', 'never'].includes(planAudit)) throw new Error('Plan audit must be auto, always, or never');
  return { schema: 1, status: 'running', size, planAudit, hardToReverse: false, next: size === 'small' ? 'planner' : 'scout', attempts: {}, history: [] };
}

export function advance(previous, event) {
  if (previous.status !== 'running') throw new Error(`Run is ${previous.status}`);
  if (event.stage !== previous.next) throw new Error(`Expected ${previous.next}, got ${event.stage}`);
  if (!['pass', 'fail', 'error'].includes(event.outcome) || !event.report) throw new Error('Outcome and report are required');
  const state = structuredClone(previous);
  state.attempts[event.stage] = (state.attempts[event.stage] ?? 0) + 1;
  state.history.push(event);
  if (event.hardToReverse) state.hardToReverse = true;
  if (event.outcome === 'error') state.status = 'blocked';
  else if (event.stage === 'scout') {
    if (event.outcome === 'fail') state.status = 'blocked';
    else state.next = 'planner';
  } else if (event.stage === 'planner') {
    if (event.outcome === 'fail') state.status = 'blocked';
    else state.next = state.planAudit === 'always' || (state.planAudit === 'auto' && state.hardToReverse) ? 'plan-audit' : 'tester';
  } else if (event.stage === 'plan-audit') {
    if (event.outcome === 'pass') state.next = 'tester';
    else if (state.attempts['plan-audit'] < 2) state.next = 'planner';
    else state.status = 'blocked';
  } else if (event.stage === 'tester') {
    if (event.outcome === 'pass') state.next = 'coder';
    else if (state.attempts.tester >= 2) state.status = 'blocked';
  } else if (event.stage === 'coder') {
    if (event.outcome === 'pass') state.next = 'audit';
    else state.status = 'blocked';
  } else if (event.stage === 'audit') {
    if (event.outcome === 'pass') state.status = 'complete';
    else if (state.attempts.audit < 3) state.next = 'coder';
    else state.status = 'blocked';
  }
  if (state.status !== 'running') state.next = null;
  return state;
}
