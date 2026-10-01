import assert from 'node:assert/strict';
import { test } from 'node:test';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { readOnlyCommand } from './read-only-command.mjs';

test('read commands preserve quoted arguments without interpreting them', () => {
  assert.deepEqual(readOnlyCommand("rg '$(touch bad); text' 'file name'"), { systemProgram: 'rg', args: ['--no-config', '$(touch bad); text', 'file name'] });
  assert.deepEqual(readOnlyCommand("sed -n '10,20p' file"), { systemProgram: 'sed', args: ['-n', '10,20p', 'file'] });
  assert.equal(readOnlyCommand('rg "\\bTODO\\b" pattern.txt').args[1], '\\bTODO\\b');
});

test('read policy rejects writes, interpreters, processors, and shell composition', () => {
  for (const command of ['printf x > file', 'cat file; touch other', 'cat file | sh', 'cat $(touch bad)', 'node -e "1"', 'find . -delete', 'sed -i s/a/b/ file', 'git diff --output=stolen', 'git show --textconv HEAD', 'rg --pre=touch file', 'cat "$(touch bad)"']) {
    assert.throws(() => readOnlyCommand(command), undefined, command);
  }
});

test('read executor can read and cannot turn quoted content into shell commands', () => {
  const root = mkdtempSync(join(tmpdir(), 'dt-read-'));
  writeFileSync(join(root, 'file name'), 'read worked\n');
  const run = command => spawnSync(process.execPath, [join(import.meta.dirname, 'read-only-shell.mjs'), Buffer.from(command).toString('base64')], { cwd: root, encoding: 'utf8' });
  assert.equal(run("cat 'file name'").stdout, 'read worked\n');
  assert.equal(run("printf '%s' '$(touch bad)'").stdout, '$(touch bad)');
  assert.equal(existsSync(join(root, 'bad')), false);
  assert.equal(run('printf bad > written').status, 2);
  assert.equal(existsSync(join(root, 'written')), false);
});

test('Git diff does not execute repository clean filters', () => {
  const root = mkdtempSync(join(tmpdir(), 'dt-filter-'));
  const git = (...args) => {
    const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
  };
  git('init', '-q');
  writeFileSync(join(root, 'fixture.txt'), 'original\n');
  git('add', 'fixture.txt');
  git('-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-qm', 'Fixture');
  git('config', 'filter.side-effect.clean', 'touch helper-ran; cat');
  writeFileSync(join(root, '.gitattributes'), '*.txt filter=side-effect\n');
  writeFileSync(join(root, 'fixture.txt'), 'changed\n');
  const result = spawnSync(process.execPath, [join(import.meta.dirname, 'read-only-shell.mjs'), Buffer.from('git diff').toString('base64')], { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /changed/);
  assert.equal(existsSync(join(root, 'helper-ran')), false);
});
