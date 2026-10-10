import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { renderStaticPage, staticSections } from './static-site.mjs';
import http from 'node:http';
import { createServer } from 'vite';

function loadUtility(file, location = 'https://fork.example/learn/') {
  const source = readFileSync(new URL(`../src/shared/utils/${file}.ts`, import.meta.url), 'utf8')
    .replaceAll('import.meta.env.BASE_URL', '"/learn/"');
  const exports = {};
  const siteCopy = { diagnostics: { downloadUnknown: '无法确认下载', downloadReady: '可以下载', downloadUnavailable: '下载不可用', gatewayReleaseUnknown: '无法确认可选发布信息', gatewayReleaseReady: '发布信息可用', gatewayReleaseIncomplete: '信息不完整' } };
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText,
    { exports, require: () => ({ siteCopy }), URL, window: { location: new URL(location) } });
  return exports;
}

test('fork and local deployments download official releases while keeping resources and guides local', () => {
  for (const origin of ['https://fork.example/learn/', 'http://127.0.0.1:5174/learn/', 'https://wordtap.cn/']) {
    const urls = loadUtility('assetUrls', origin);
    assert.equal(urls.appDownloadUrl('downloads/WordTap-Setup.exe'), 'https://wordtap.cn/downloads/WordTap-Setup.exe');
    assert.equal(urls.appAssetUrl('dict/manifest.json'), new URL('/learn/dict/manifest.json', origin).href);
    if (origin.includes('/learn/')) assert.equal(urls.appSectionUrl('install/gateway/'), new URL('install/gateway/', origin).href);
  }
});

test('occupied dev port uses the actual port, subdirectory deep routes render and unknown IDs return 404', async () => {
  const occupied = http.createServer((_, res) => res.end('occupied'));
  await new Promise(resolve => occupied.listen(0, '127.0.0.1', resolve));
  let server;
  try {
    const port = occupied.address().port;
    server = await createServer({ base: '/learn/', logLevel: 'silent', server: { host: '127.0.0.1', port } });
    await server.listen();
    const actual = server.httpServer.address().port;
    assert.notEqual(actual, port);
    assert.equal(server.config.server.hmr, undefined);
    const base = `http://127.0.0.1:${actual}/learn`;
    for (const route of ['/nce/nce1-001/', '/english-vocabulary/books/evjunior/', '/exam/', '/install/windows/']) {
      const response = await fetch(base + route);
      assert.equal(response.status, 200, route);
      assert.equal(await response.text(), await renderStaticPage(route));
    }
    assert.equal((await fetch(base + '/nce/not-found/')).status, 404);
    assert.equal((await fetch(base + '/english-vocabulary/books/not-found/')).status, 404);
    const redirect = await fetch(base + '/nce/nce1-001?from=test', { redirect: 'manual' });
    assert.equal(redirect.status, 302);
    assert.equal(redirect.headers.get('location'), '/learn/nce/nce1-001/?from=test');
    assert.equal((await fetch(base + '/nce/manifest.json')).status, 200);
  } finally {
    await server?.close();
    await new Promise(resolve => occupied.close(resolve));
  }
});

test('external downloads and metadata do not probe CORS; optional missing metadata warns instead of failing', async () => {
  const probes = loadUtility('downloadDiagnostics');
  let calls = 0;
  const fail = async () => { calls++; throw new TypeError('blocked'); };
  const download = await probes.probeDownload('https://wordtap.cn/downloads/WordTap-Setup.exe', fail);
  const release = await probes.probeGatewayRelease('https://wordtap.cn/downloads/release.json', fail);
  assert.equal(download.status, 'warn'); assert.match(download.detail, /无法确认/);
  assert.equal(release.status, 'warn'); assert.equal(calls, 0);
  assert.equal((await probes.probeGatewayRelease('/downloads/release.json', fail)).status, 'warn');
  assert.equal((await probes.probeDownload('/downloads/setup.exe', async () => ({ ok: false }))).status, 'fail');
  assert.equal((await probes.probeDownload('/downloads/setup.exe', async () => ({ ok: true }))).status, 'ok');
  assert.equal((await probes.probeDownload('/downloads/setup.exe', fail)).status, 'warn');
  assert.equal((await probes.probeGatewayRelease('/release.json', async () => ({ sha256: 'a'.repeat(64), sizeBytes: 123 }))).status, 'ok');
  for (const payload of [null, {}, { sha256: 'x', sizeBytes: -1 }, { sha256: 'a'.repeat(64), sizeBytes: Infinity }]) {
    assert.equal((await probes.probeGatewayRelease('/release.json', async () => payload)).status, 'warn');
  }
});

test('every dev directory renders from published data, including vocabulary books, exams and guides', async () => {
  for (const section of staticSections.filter(section => section !== 'install')) assert.match(await renderStaticPage(`/${section}/`), /<!doctype html>/i);
  for (const section of staticSections.filter(section => !['exam', 'install'].includes(section))) {
    const manifest = JSON.parse(readFileSync(new URL(`../public/${section}/manifest.json`, import.meta.url), 'utf8'));
    const lesson = (manifest.groups ?? manifest.books ?? manifest.levels ?? manifest.volumes)[0].lessons[0];
    const html = await renderStaticPage(`/${section}/${lesson.id}/`);
    assert.ok(html.includes(lesson.id) || html.includes('?l='));
    assert.match(html, /在 WordTap 中学习/);
    assert.equal(await renderStaticPage(`/${section}/unknown-identity/`), null);
  }
  assert.match(await renderStaticPage('/english-vocabulary/books/evjunior/'), /初中词汇/);
  assert.equal(await renderStaticPage('/english-vocabulary/books/unknown/'), null);
  for (const id of ['gateway', 'windows']) {
    // Installer IDs follow the existing published guide identity.
    const html = await renderStaticPage(`/install/${id}/`);
    assert.ok(html.includes(`https://wordtap.cn/downloads/${id === 'gateway' ? 'WordTapGatewaySetup.exe' : 'WordTap-Setup.exe'}`));
  }
  assert.equal(await renderStaticPage('/install/unknown/'), null);
  assert.equal(await renderStaticPage('/nce/manifest.json'), undefined);
  assert.equal(await renderStaticPage('/nce/%2e%2e/private/'), null);
});
