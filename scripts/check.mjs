import { readdir, readFile, access } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { resolve, join } from 'node:path';

const root = resolve(import.meta.dirname, '..');
async function sourceFilesIn(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(entries.map((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? sourceFilesIn(path) : [path];
  }));
  return files.flat();
}

const directories = ['extension', 'scripts', 'tests'];
const sourceFiles = (await Promise.all(directories.map((directory) => sourceFilesIn(join(root, directory))))).flat();
const javascriptFiles = sourceFiles.filter((file) => /\.(?:m?js)$/.test(file));
for (const file of javascriptFiles) {
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(result.stderr);
}
const manifest = JSON.parse(await readFile(join(root, 'extension/manifest.json'), 'utf8'));
const packageJson = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
const assets = [
  manifest.background.service_worker,
  manifest.action.default_popup,
  ...Object.values(manifest.icons),
  ...manifest.content_scripts.flatMap((entry) => [...entry.js, ...entry.css]),
];
await Promise.all(assets.map((asset) => access(join(root, 'extension', asset))));
if (manifest.manifest_version !== 3 || manifest.permissions.join() !== 'storage') throw new Error('Manifest o permessi inattesi.');
if (manifest.version !== packageJson.version) throw new Error('La versione del manifest deve corrispondere a package.json.');
console.log(`Sintassi valida; ${assets.length} risorse del manifest presenti; Manifest V3 e permessi verificati.`);
