/**
 * OpenTradex Desktop App - Electron Main Process
 */

import { app, BrowserWindow, Menu, shell, ipcMain, dialog, session, safeStorage } from 'electron';
import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { SecretStore, buildGatewayEnv, PROVIDER_ENV } from './secrets';

// Encrypted secret store (OS keychain via Electron safeStorage when available,
// plaintext-0600 fallback otherwise). Migration from plaintext v1 files happens
// on first boot via migrateToEncrypted().
const secretStore = new SecretStore({
  crypto: {
    isEncryptionAvailable: () => {
      try { return safeStorage.isEncryptionAvailable(); } catch { return false; }
    },
    encryptString: (plain: string) => safeStorage.encryptString(plain),
    decryptString: (cipher: Buffer) => safeStorage.decryptString(cipher),
  },
});

let mainWindow: BrowserWindow | null = null;
let gatewayProcess: ChildProcess | null = null;

const isDev = process.env.NODE_ENV === 'development';
const isMac = process.platform === 'darwin';
const isWin = process.platform === 'win32';
const GATEWAY_PORT = 3210;
const DASHBOARD_PORT = 3000;

// Hosts the app is allowed to open in the system browser via shell.openExternal.
// Anything outside this allowlist is refused.
const EXTERNAL_LINK_ALLOWLIST = [
  'github.com',
  'www.github.com',
  'discord.gg',
  'discord.com',
  'opentradex.net',
  'www.opentradex.net',
];

function isAllowedExternalUrl(rawUrl: string): boolean {
  try {
    const u = new URL(rawUrl);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return false;
    return EXTERNAL_LINK_ALLOWLIST.includes(u.hostname);
  } catch {
    return false;
  }
}

function openExternalSafe(url: string): void {
  if (isAllowedExternalUrl(url)) {
    shell.openExternal(url);
  } else {
    console.warn('[Security] Refused to open non-allowlisted URL:', url);
  }
}

// Content-Security-Policy for the loaded dashboard HTML. The gateway lives at
// localhost:3210 (http + ws). We deliberately do NOT allow unsafe-inline/eval.
const CSP_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  `connect-src 'self' http://localhost:${GATEWAY_PORT} ws://localhost:${GATEWAY_PORT} http://127.0.0.1:${GATEWAY_PORT} ws://127.0.0.1:${GATEWAY_PORT}`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

// Start the gateway server
async function startGateway(): Promise<void> {
  return new Promise((resolve) => {
    // In dev: resolve from packages/desktop/dist → project root.
    // In packaged: expect gateway bundled at resources/app/dist/bin/cli.js.
    const candidates = [
      path.join(__dirname, '..', '..', '..', 'dist', 'bin', 'cli.js'),
      path.join(process.resourcesPath || '', 'app', 'dist', 'bin', 'cli.js'),
      path.join(process.resourcesPath || '', 'dist', 'bin', 'cli.js'),
    ];
    const gatewayPath = candidates.find((p) => p && fs.existsSync(p));

    if (!gatewayPath) {
      console.log('[Gateway] cli.js not found — dashboard will expect an externally-running gateway');
      resolve();
      return;
    }

    // Decrypt any keychain-stored API keys and inject them as env vars for the
    // gateway child process. This is how US-006 keeps the JSON file encrypted
    // at rest while the gateway can still read provider keys from process.env
    // without knowing anything about keychains.
    const secretEnv = buildGatewayEnv(secretStore, process.env);
    const secretNames = Object.keys(secretEnv);
    if (secretNames.length > 0) {
      console.log(`[Keychain] Injected ${secretNames.length} decrypted secret(s) into gateway env:`,
        secretNames.join(', '));
    }

    gatewayProcess = spawn('node', [gatewayPath, 'run', String(GATEWAY_PORT)], {
      stdio: 'pipe',
      shell: isWin,
      windowsHide: true,
      env: { ...process.env, ...secretEnv, NODE_ENV: 'production' },
    });

    gatewayProcess.stdout?.on('data', (data) => console.log('[Gateway]', data.toString().trim()));
    gatewayProcess.stderr?.on('data', (data) => console.error('[Gateway err]', data.toString().trim()));
    gatewayProcess.on('error', (err) => {
      console.error('Failed to start gateway:', err);
      resolve();
    });

    // Poll the gateway until it answers, then resolve.
    const deadline = Date.now() + 15000;
    const ping = async (): Promise<void> => {
      try {
        const res = await fetch(`http://127.0.0.1:${GATEWAY_PORT}/api/health`, { signal: AbortSignal.timeout(500) });
        if (res.ok) return resolve();
      } catch { /* not ready */ }
      if (Date.now() > deadline) return resolve();
      setTimeout(ping, 250);
    };
    setTimeout(ping, 300);
  });
}

// Stop the gateway server
function stopGateway(): void {
  if (gatewayProcess) {
    gatewayProcess.kill();
    gatewayProcess = null;
  }
}

// Create the main window
function createWindow(): void {
  const iconFile = isWin ? 'icon.ico' : isMac ? 'icon.icns' : 'icon.png';
  const iconPath = path.join(__dirname, '..', 'assets', iconFile);

  mainWindow = new BrowserWindow({
    width: 1600,
    height: 1000,
    minWidth: 1200,
    minHeight: 700,
    backgroundColor: '#0B0F14',
    // hiddenInset is macOS-only; Windows gets a normal title bar.
    ...(isMac ? { titleBarStyle: 'hiddenInset' as const, trafficLightPosition: { x: 15, y: 15 } } : {}),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      preload: path.join(__dirname, 'preload.js'),
    },
    ...(fs.existsSync(iconPath) ? { icon: iconPath } : {}),
  });

  // Load the dashboard. The gateway (port 3210) already serves the built dashboard,
  // so we point there in both dev and prod — single source of truth.
  mainWindow.loadURL(`http://127.0.0.1:${GATEWAY_PORT}`);
  if (isDev) mainWindow.webContents.openDevTools();

  // Handle external links — route through the allowlist and always deny in-app opens.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    openExternalSafe(url);
    return { action: 'deny' };
  });

  // Block navigation away from the local gateway. Only allow http(s)://127.0.0.1:<port>
  // and http(s)://localhost:<port>; anything else gets cancelled and (if allowlisted)
  // opened externally.
  mainWindow.webContents.on('will-navigate', (event, url) => {
    try {
      const u = new URL(url);
      const isLocal =
        (u.hostname === '127.0.0.1' || u.hostname === 'localhost') &&
        (u.protocol === 'http:' || u.protocol === 'https:');
      if (!isLocal) {
        event.preventDefault();
        openExternalSafe(url);
      }
    } catch {
      event.preventDefault();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Create application menu
function createMenu(): void {
  const appMenuSubmenu: Electron.MenuItemConstructorOptions[] = [
    { role: 'about' },
    { type: 'separator' },
    {
      label: 'Preferences...',
      accelerator: 'CmdOrCtrl+,',
      click: () => {
        mainWindow?.webContents.send('open-settings');
      },
    },
    { type: 'separator' },
    ...(isMac
      ? ([
          { role: 'services' as const },
          { type: 'separator' as const },
          { role: 'hide' as const },
          { role: 'hideOthers' as const },
          { role: 'unhide' as const },
          { type: 'separator' as const },
        ] as Electron.MenuItemConstructorOptions[])
      : []),
    { role: 'quit' },
  ];

  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: 'OpenTradex',
      submenu: appMenuSubmenu,
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Trading',
      submenu: [
        {
          label: 'Run Cycle',
          accelerator: 'CmdOrCtrl+R',
          click: () => {
            mainWindow?.webContents.send('run-cycle');
          },
        },
        {
          label: 'Toggle Auto Loop',
          accelerator: 'CmdOrCtrl+L',
          click: () => {
            mainWindow?.webContents.send('toggle-autoloop');
          },
        },
        { type: 'separator' },
        {
          label: 'PANIC - Emergency Stop',
          accelerator: 'CmdOrCtrl+Shift+P',
          click: async () => {
            const result = await dialog.showMessageBox(mainWindow!, {
              type: 'warning',
              buttons: ['Cancel', 'PANIC'],
              defaultId: 0,
              title: 'Emergency Stop',
              message: 'This will flatten all positions and halt trading.',
              detail: 'Are you sure you want to proceed?',
            });
            if (result.response === 1) {
              mainWindow?.webContents.send('panic');
            }
          },
        },
      ],
    },
    {
      label: 'Window',
      submenu: isMac
        ? [
            { role: 'minimize' },
            { role: 'zoom' },
            { type: 'separator' },
            { role: 'front' },
            { type: 'separator' },
            { role: 'window' },
          ]
        : [
            { role: 'minimize' },
            { role: 'close' },
          ],
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'Documentation',
          click: () => {
            openExternalSafe('https://github.com/deonmenezes/opentradex#readme');
          },
        },
        {
          label: 'Report Issue',
          click: () => {
            openExternalSafe('https://github.com/deonmenezes/opentradex/issues');
          },
        },
        { type: 'separator' },
        {
          label: 'Join Discord',
          click: () => {
            openExternalSafe('https://discord.gg/tNfdVQU5');
          },
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// IPC handlers
ipcMain.handle('get-gateway-url', () => {
  return `http://localhost:${GATEWAY_PORT}`;
});

ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

// ============ Secrets / keychain IPC ============
// Renderer → main bridge for the keychain-backed secret store. We do NOT expose
// the raw values out of main — each handler accepts a provider name and does
// its own side-effect. The renderer never sees the plaintext again after save.

ipcMain.handle('secrets:list', () => {
  return { names: secretStore.list(), canEncrypt: secretStore.canEncrypt() };
});

ipcMain.handle('secrets:save', async (_e, { provider, apiKey }: { provider: string; apiKey: string }) => {
  if (!provider || !PROVIDER_ENV[provider]) {
    return { ok: false, error: `Unknown provider: ${provider}` };
  }
  try {
    secretStore.set(provider, apiKey);
    // Hydrate the live desktop env so a subsequent gateway restart picks it up.
    process.env[PROVIDER_ENV[provider]] = apiKey.trim();
    // Also tell the gateway about the new key so the user doesn't have to
    // restart to use it — fire a best-effort HTTP save too.
    try {
      await fetch(`http://127.0.0.1:${GATEWAY_PORT}/api/ai/providers/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, apiKey }),
        signal: AbortSignal.timeout(2000),
      });
    } catch { /* gateway not up yet — it'll read from env on next boot */ }
    return { ok: true, provider, encrypted: secretStore.canEncrypt() };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Save failed' };
  }
});

ipcMain.handle('secrets:delete', async (_e, { provider }: { provider: string }) => {
  if (!provider) return { ok: false, error: 'provider is required' };
  secretStore.delete(provider);
  const envKey = PROVIDER_ENV[provider];
  if (envKey) delete process.env[envKey];
  try {
    await fetch(`http://127.0.0.1:${GATEWAY_PORT}/api/ai/providers/delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider }),
      signal: AbortSignal.timeout(2000),
    });
  } catch { /* best effort */ }
  return { ok: true, provider };
});

ipcMain.handle('secrets:canEncrypt', () => {
  return { canEncrypt: secretStore.canEncrypt() };
});

// App lifecycle
app.whenReady().then(async () => {
  // Inject a Content-Security-Policy on every response. We do this at the session
  // level because the dashboard HTML is served by the local gateway and we don't
  // control its headers. `frame-ancestors 'none'` + strict script-src defangs XSS.
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const headers = { ...details.responseHeaders };
    headers['Content-Security-Policy'] = [CSP_POLICY];
    headers['X-Content-Type-Options'] = ['nosniff'];
    headers['X-Frame-Options'] = ['DENY'];
    headers['Referrer-Policy'] = ['strict-origin-when-cross-origin'];
    callback({ responseHeaders: headers });
  });

  // Upgrade any plaintext secrets on disk to encrypted form now that Electron
  // is ready and safeStorage is available. No-op when there are no secrets or
  // when encryption is unsupported on this platform.
  try {
    const { migrated, skipped } = secretStore.migrateToEncrypted();
    if (migrated.length > 0) {
      console.log(`[Keychain] Migrated ${migrated.length} plaintext secret(s) to encrypted:`,
        migrated.join(', '));
    }
    if (!secretStore.canEncrypt() && skipped.length > 0) {
      console.warn('[Keychain] OS encryption unavailable — secrets remain plaintext (0600) on this machine.');
    }
  } catch (err) {
    console.error('[Keychain] Migration failed:', err);
  }

  createMenu();
  await startGateway();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  stopGateway();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  stopGateway();
});
