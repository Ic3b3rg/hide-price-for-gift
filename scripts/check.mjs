import { readdir, readFile, access } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { resolve, join } from 'node:path';

const root = resolve(import.meta.dirname, '..');
async function files(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  return (await Promise.all(entries.map((entry) => entry.isDirectory() ? files(join(directory, entry.name)) : [join(directory, entry.name)]))).flat();
}
const sourceFiles = (await Promise.all(['extension', 'scripts', 'tests'].map((directory) => files(join(root, directory))))).flat();
for (const file of sourceFiles.filter((file) => /\.(?:m?js)$/.test(file))) {
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(result.stderr);
}
const manifest = JSON.parse(await readFile(join(root, 'extension/manifest.json'), 'utf8'));
const assets = [manifest.background.service_worker, manifest.action.default_popup, ...Object.values(manifest.icons), ...manifest.content_scripts.flatMap((entry) => [...entry.js, ...entry.css])];
await Promise.all(assets.map((asset) => access(join(root, 'extension', asset))));
if (manifest.manifest_version !== 3 || manifest.permissions.join() !== 'storage') throw new Error('Manifest o permessi inattesi.');
console.log(`Sintassi valida; ${assets.length} risorse del manifest presenti; Manifest V3 e permessi verificati.`);
