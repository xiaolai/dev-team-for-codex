import { installProject } from './project.mjs';

try {
  const args = process.argv.slice(2);
  let directory;
  let check = false;
  let uninstall = false;
  for (let index = 0; index < args.length; index++) {
    if (args[index] === '--cwd') directory = args[++index];
    else if (args[index] === '--check') check = true;
    else if (args[index] === '--uninstall') uninstall = true;
    else throw new Error(`Unknown argument: ${args[index]}`);
  }
  if (!directory || directory.startsWith('--')) throw new Error('Usage: node scripts/install.mjs --cwd <repository> [--check | --uninstall]');
  process.stdout.write(JSON.stringify(installProject(directory, { check, uninstall }), null, 2) + '\n');
} catch (error) {
  process.stderr.write(`dev-team install: ${error.message}\n`);
  process.exitCode = 2;
}
