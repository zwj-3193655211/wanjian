// 冒烟测试：加载 dist 页面，截屏验证渲染，检查关键资源是否可加载
const { app, BrowserWindow, session, protocol, net } = require('electron');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');

const DIST_DIR = path.join(__dirname, '..', 'dist');
const OUT = path.join(__dirname, '..', 'smoke.png');

app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true, bypassCSP: true } },
]);

app.whenReady().then(async () => {
  session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => {
    callback(['media', 'display-capture'].includes(permission));
  });

  protocol.handle('app', (request) => {
    const { pathname } = new URL(request.url);
    let relPath = decodeURIComponent(pathname);
    if (relPath === '/' || relPath === '') relPath = '/index.html';
    const filePath = path.normalize(path.join(DIST_DIR, relPath));
    if (!filePath.startsWith(DIST_DIR + path.sep) && filePath !== DIST_DIR) {
      return new Response('Forbidden', { status: 403 });
    }
    return net.fetch(pathToFileURL(filePath).toString());
  });

  const win = new BrowserWindow({ width: 1280, height: 800, show: true, backgroundColor: '#000011' });
  const errors = [];

  win.webContents.on('console-message', (_e, _level, message) => {
    if (message.includes('❌') || message.includes('Error') || message.includes('Failed')) errors.push(message);
  });
  win.webContents.on('did-fail-load', (_e, code, desc) => errors.push(`did-fail-load: ${code} ${desc}`));

  await win.loadURL('app://app/index.html');
  await new Promise(r => setTimeout(r, 4000));

  const pageState = await win.webContents.executeJavaScript(`({
    title: document.title,
    rootChildren: document.getElementById('root')?.children.length ?? 0,
    bodyText: document.body.innerText.slice(0, 200),
  })`);

  // 验证关键资源可通过协议访问
  const modelCheck = await win.webContents.executeJavaScript(
    `fetch('app://app/models/hands.js').then(r => r.ok).catch(() => false)`
  );

  const image = await win.webContents.capturePage();
  fs.writeFileSync(OUT, image.toPNG());

  console.log('PAGE_STATE=' + JSON.stringify(pageState));
  console.log('MODEL_FETCH_OK=' + modelCheck);
  console.log('ERRORS=' + JSON.stringify(errors));
  console.log('SCREENSHOT=' + OUT);
  app.exit(0);
});
