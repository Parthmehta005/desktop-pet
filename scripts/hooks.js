// Manage the pet's Claude Code hooks from a terminal.
//
//   npm run hooks:install
//   npm run hooks:uninstall
//   npm run hooks:status
//
// Options (after `--`, e.g. `npm run hooks:install -- --wsl --settings <file>`):
//   --settings <file>   Claude Code settings file (default: ~/.claude/settings.json,
//                       or $CLAUDE_CONFIG_DIR/settings.json)
//   --user-data <dir>   The pet's settings folder, to read its hook port and token
//   --wsl               Hooks for Claude Code running inside WSL: uses `curl` and needs
//                       --settings pointing at the WSL settings file
//   --host <host>       Address the hook posts to (default 127.0.0.1)
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  installHooks, uninstallHooks, readHookStatus, claudeSettingsPath,
} from '../src/main/hooks-installer.js';
import { userDataDir } from '../src/main/user-data.js';

const USAGE = `Usage: node scripts/hooks.js <install|uninstall|status> [--settings <file>] [--user-data <dir>] [--wsl] [--host <host>]`;

function parseArgs(argv) {
  const args = { command: argv[0], flags: {} };
  for (let i = 1; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--wsl') args.flags.wsl = true;
    else if (['--settings', '--user-data', '--host'].includes(arg)) {
      if (i + 1 >= argv.length) throw new Error(`${arg} needs a value`);
      args.flags[arg.slice(2)] = argv[++i];
    } else throw new Error(`Unknown option: ${arg}`);
  }
  return args;
}

async function readPetConfig(dir) {
  const file = path.join(dir, 'config.json');
  let config;
  try {
    config = JSON.parse(await readFile(file, 'utf8'));
  } catch {
    config = null;
  }
  if (!config?.hookToken || !Number.isInteger(config.hookPort)) {
    throw new Error(`Couldn't find the pet's hook token in ${file}. Start Desktop Pet once (npm start) so it can create one, then try again.`);
  }
  return { port: config.hookPort, token: config.hookToken };
}

/**
 * Runs the tool. Returns the exit code; output goes to `out` and `err`.
 * @param {string[]} argv
 * @param {{ env?: object, out?: (line: string) => void, err?: (line: string) => void }} [io]
 */
export async function run(argv, { env = process.env, out = console.log, err = console.error } = {}) {
  let args;
  try {
    args = parseArgs(argv);
  } catch (e) {
    err(e.message);
    err(USAGE);
    return 1;
  }
  const { command, flags } = args;
  if (!['install', 'uninstall', 'status'].includes(command)) {
    err(USAGE);
    return 1;
  }
  if (flags.wsl && !flags.settings) {
    err('With --wsl, pass --settings pointing at the settings file inside WSL, for example:');
    err('  --settings "\\\\wsl.localhost\\Ubuntu\\home\\<you>\\.claude\\settings.json"');
    return 1;
  }
  const settingsPath = flags.settings ?? claudeSettingsPath(env);
  const shell = flags.wsl ? 'posix' : undefined;
  const host = flags.host;

  try {
    if (command === 'uninstall') {
      const result = await uninstallHooks({ settingsPath });
      out(result.changed
        ? `Removed the Desktop Pet hooks from ${settingsPath}.\nBackup of the previous file: ${result.backup}`
        : `No Desktop Pet hooks found in ${settingsPath}; nothing to do.`);
      return 0;
    }

    const { port, token } = await readPetConfig(flags['user-data'] ?? userDataDir(env));
    if (command === 'install') {
      const result = await installHooks({ settingsPath, port, token, shell, host });
      if (!result.changed) out(`The Desktop Pet hooks were already installed in ${settingsPath}.`);
      else {
        out(`Installed the Desktop Pet hooks in ${settingsPath}.`);
        if (result.backup) out(`Backup of the previous file: ${result.backup}`);
        out('Start a new Claude Code session (or restart open ones) for them to take effect.');
      }
      return 0;
    }

    const status = await readHookStatus({ settingsPath, port, token, shell, host });
    const messages = {
      installed: `Installed: Claude Code will tell the pet what it's doing (${settingsPath}).`,
      outdated: `Out of date: the hooks in ${settingsPath} point at an old port or token. Run hooks:install again.`,
      'not-installed': `Not installed in ${settingsPath}. Run: npm run hooks:install`,
      'invalid-settings': `Can't read ${settingsPath}: ${status.error}`,
    };
    out(messages[status.status]);
    return status.status === 'installed' ? 0 : 1;
  } catch (e) {
    err(e.message);
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await run(process.argv.slice(2));
}
