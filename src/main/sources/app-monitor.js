// Which app is in the foreground, and the battery (Windows only). Runs foreground.ps1 in a
// hidden, long-lived PowerShell and turns each JSON line it prints into an engine 'app'
// or 'battery' event. Elsewhere it does nothing and starts no process.
import { spawn as nodeSpawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import readline from 'node:readline';

export const SCRIPT_PATH = fileURLToPath(new URL('./foreground.ps1', import.meta.url));
/** Wait before restarting a crashed monitor: 1s, then 5s, then every 30s. */
export const RESTART_DELAYS = Object.freeze([1000, 5000, 30000]);

/** One line of monitor output -> { process, title, path, fullscreen }, or null if it isn't one. */
export function parseForegroundLine(line) {
  let data;
  try {
    data = JSON.parse(line);
  } catch {
    return null;
  }
  if (data === null || typeof data !== 'object' || Array.isArray(data)) return null;
  if (typeof data.process !== 'string' || typeof data.title !== 'string') return null;
  const text = (v) => (typeof v === 'string' ? v.slice(0, 1000) : '');
  return { process: text(data.process), title: text(data.title), path: text(data.path), fullscreen: data.fullscreen === true };
}

/** One battery line of monitor output -> a 'battery' event, or null if it isn't one. */
export function parseBatteryLine(line) {
  let data;
  try {
    data = JSON.parse(line);
  } catch {
    return null;
  }
  const b = data?.battery;
  if (b === null || typeof b !== 'object' || Array.isArray(b)) return null;
  const percent = Number(b.percent);
  if (!Number.isFinite(percent) || typeof b.charging !== 'boolean' || typeof b.present !== 'boolean') return null;
  return { type: 'battery', percent: Math.min(100, Math.max(0, percent)), charging: b.charging, present: b.present };
}

/**
 * PowerShell arguments that run `script` without a script file (so execution policy and
 * packaged-app paths don't matter), with $ParentPid set so it exits with the pet.
 */
export function powerShellArgs(script, parentPid) {
  const encoded = Buffer.from(`$ParentPid = ${Number(parentPid)}\n${script}`, 'utf16le').toString('base64');
  return ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', encoded];
}

/**
 * @param {object} options
 * @param {(event: object) => void} options.emit  Foreground-app events.
 * @param {(event: object) => void} [options.emitBattery]  Battery events.
 * Everything else can be swapped in tests.
 */
export function createAppMonitor({
  emit,
  emitBattery = () => {},
  platform = process.platform,
  spawn = nodeSpawn,
  readScript = () => readFileSync(SCRIPT_PATH, 'utf8'),
  parentPid = process.pid,
  setTimer = setTimeout,
  clearTimer = clearTimeout,
  restartDelays = RESTART_DELAYS,
  onError = (err) => console.warn('Desktop Pet: foreground-app monitor:', err.message),
}) {
  let child = null;
  let stopped = true;
  let failures = 0;
  let timer = null;

  function scheduleRestart() {
    const delay = restartDelays[Math.min(failures, restartDelays.length - 1)];
    failures++;
    timer = setTimer(() => {
      timer = null;
      if (!stopped) launch();
    }, delay);
  }

  function launch() {
    let ended = false;
    const current = spawn('powershell.exe', powerShellArgs(readScript(), parentPid), {
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    child = current;
    // Keep the end of what PowerShell complains about, to say why it stopped.
    let complaints = '';
    current.stderr?.on('data', (chunk) => { complaints = (complaints + chunk).slice(-2000); });
    const end = (code) => {
      if (ended) return;
      ended = true;
      if (child === current) child = null;
      if (!stopped && Number.isInteger(code) && code !== 0) {
        const why = complaints.trim().split(/\r?\n/).filter(Boolean).slice(-3).join(' | ');
        onError(new Error(`PowerShell stopped with exit code ${code}${why ? `: ${why}` : ''}`));
      }
      if (!stopped) scheduleRestart();
    };
    readline.createInterface({ input: current.stdout }).on('line', (line) => {
      const battery = parseBatteryLine(line);
      if (battery) {
        failures = 0;
        emitBattery(battery);
        return;
      }
      const app = parseForegroundLine(line);
      if (!app) return;
      failures = 0;
      emit({ type: 'app', ...app });
    });
    current.on('error', (err) => {
      onError(err);
      end();
    });
    current.on('exit', (code) => end(code));
  }

  return {
    /** Starts watching. Returns false (and starts nothing) off Windows. */
    start() {
      if (platform !== 'win32' || !stopped) return false;
      stopped = false;
      failures = 0;
      launch();
      return true;
    },
    stop() {
      stopped = true;
      clearTimer(timer);
      timer = null;
      child?.kill();
      child = null;
    },
    get running() {
      return child !== null;
    },
  };
}
