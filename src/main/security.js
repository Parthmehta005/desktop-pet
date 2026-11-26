// App-wide hardening, plus the app:// protocol the windows load from.
import { app, protocol, net, session } from 'electron';
import { pathToFileURL } from 'node:url';
import { APP_HOST, resolveAppPath } from './app-paths.js';

/** Must run before the app is ready. */
export function registerAppScheme() {
  protocol.registerSchemesAsPrivileged([
    { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true } },
  ]);
}

/** Serves src/renderer and src/core over app://desktop-pet/. Call once the app is ready. */
export function handleAppProtocol() {
  protocol.handle('app', async (request) => {
    const url = new URL(request.url);
    const file = url.host === APP_HOST ? resolveAppPath(url.pathname) : null;
    if (!file) return new Response('Not found', { status: 404 });
    return net.fetch(pathToFileURL(file).toString());
  });
}

/**
 * Locks down every web page the app creates: no navigation away, no new windows, no
 * webviews, and no permission prompts (camera, notifications...).
 */
export function hardenApp() {
  app.on('web-contents-created', (_event, contents) => {
    contents.on('will-navigate', (e) => e.preventDefault());
    contents.on('will-attach-webview', (e) => e.preventDefault());
    contents.setWindowOpenHandler(() => ({ action: 'deny' }));
  });
  session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  session.defaultSession.setPermissionCheckHandler(() => false);
}

/** webPreferences every window uses. */
export function secureWebPreferences(preload) {
  return {
    preload,
    contextIsolation: true,
    sandbox: true,
    nodeIntegration: false,
    nodeIntegrationInWorker: false,
    webSecurity: true,
    allowRunningInsecureContent: false,
    spellcheck: false,
    backgroundThrottling: false,
  };
}
