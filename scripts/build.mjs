import { cp, mkdir, readFile, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const manifest = JSON.parse(await readFile(resolve(root, 'extension/manifest.json'), 'utf8'));
const output = resolve(root, 'dist');
const folder = resolve(output, 'sorpresa');
const archive = resolve(output, `sorpresa-${manifest.version}.zip`);
await mkdir(output, { recursive: true });
await rm(folder, { recursive: true, force: true });
await cp(resolve(root, 'extension'), folder, { recursive: true });
await cp(resolve(root, 'README.md'), resolve(folder, 'README.md'));
await rm(archive, { force: true });
const result = spawnSync('zip', ['-rq', archive, 'sorpresa'], { cwd: output, encoding: 'utf8' });
if (result.error?.code === 'ENOENT') throw new Error('Comando zip non trovato. Installa zip e riesegui npm run build.');
if (result.status !== 0) throw new Error(result.stderr || 'Impossibile creare lo ZIP.');
console.log(`Estensione pronta: ${folder}\nArchivio: ${archive}`);
