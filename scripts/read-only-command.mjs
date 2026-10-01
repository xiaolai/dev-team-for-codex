export function readOnlyCommand(command) {
  const words = [];
  let word = '';
  let started = false;
  let quote = null;
  for (let index = 0; index < command.length; index++) {
    const character = command[index];
    if (quote === "'") {
      if (character === "'") quote = null;
      else word += character;
    } else if (character === '\\') {
      if (index + 1 >= command.length || /[\r\n]/.test(command[index + 1])) throw new Error('Unsupported shell escape');
      if (quote === '"' && !'$`"\\'.includes(command[index + 1])) word += '\\';
      else word += command[++index];
      started = true;
    } else if (quote === '"') {
      if (character === '"') quote = null;
      else if ('$`'.includes(character)) throw new Error('Shell expansion is not allowed');
      else word += character;
    } else if (character === '"' || character === "'") {
      quote = character;
      started = true;
    } else if (';&|<>()$`\r\n'.includes(character)) throw new Error('Use one read command; no shell operators, expansion, or redirection');
    else if (/\s/.test(character)) {
      if (started) words.push(word);
      word = '';
      started = false;
    } else {
      word += character;
      started = true;
    }
  }
  if (quote) throw new Error('Unclosed shell quote');
  if (started) words.push(word);
  const [program, ...args] = words;
  if (['cat', 'ls', 'pwd', 'head', 'tail', 'wc', 'printf'].includes(program)) return { systemProgram: program, args };
  if (program === 'sed' && args.length >= 3 && args[0] === '-n' && /^\d+(?:,\d+)?p$/.test(args[1]) && args.slice(2).every(value => !value.startsWith('-'))) return { systemProgram: 'sed', args };
  if (program === 'rg') {
    if (args.some(value => /^--(?:pre|hostname-bin)(?:=|$)/.test(value))) throw new Error('External rg processors are not allowed');
    return { systemProgram: 'rg', args: ['--no-config', ...args] };
  }
  if (program === 'git') {
    const [subcommand, ...rest] = args;
    if (!['status', 'diff', 'log', 'show', 'blame', 'rev-parse', 'ls-files', 'ls-tree'].includes(subcommand)) throw new Error('Only read-only Git subcommands are allowed');
    if (rest.some(value => /^--(?:output|ext-diff|textconv|remerge-diff|config-env)(?:=|$)/.test(value) || /^-(?:o|c)/.test(value))) throw new Error('Git output, execution, and configuration overrides are not allowed');
    const flags = ['diff', 'log', 'show', 'blame'].includes(subcommand) ? ['--no-ext-diff', '--no-textconv'] : [];
    return { systemProgram: 'git', args: ['--no-pager', '--no-optional-locks', '-c', 'core.fsmonitor=false', '-c', 'core.hooksPath=/dev/null', subcommand, ...flags, ...rest] };
  }
  throw new Error('Read-only roles support cat, ls, pwd, head, tail, wc, printf, rg, sed -n RANGEp FILE, and read-only git commands; ask the orchestrator for other checks');
}
