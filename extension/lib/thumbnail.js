import { safeImageUrl } from './catalog.js';

const MAX_DOWNLOAD_BYTES = 8_000_000;
const MAX_THUMBNAIL_BYTES = 45_000;
const MAX_DIMENSION = 320;

export async function createThumbnail(value) {
  const url = safeImageUrl(value);
  if (!url) return '';

  try {
    const response = await fetch(url, {
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      signal: AbortSignal.timeout(6000),
    });
    if (!response.ok || !response.headers.get('content-type')?.startsWith('image/')) return '';

    const blob = await response.blob();
    if (blob.size > MAX_DOWNLOAD_BYTES) return '';
    return await encodeThumbnail(blob);
  } catch {
    // Saving the product still succeeds when its photo cannot be downloaded.
    return '';
  }
}

async function encodeThumbnail(blob) {
  const bitmap = await createImageBitmap(blob);
  const ratio = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
  const canvas = new OffscreenCanvas(
    Math.max(1, Math.round(bitmap.width * ratio)),
    Math.max(1, Math.round(bitmap.height * ratio)),
  );
  const context = canvas.getContext('2d');
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  const thumbnail = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.76 });
  const bytes = new Uint8Array(await thumbnail.arrayBuffer());
  if (bytes.length > MAX_THUMBNAIL_BYTES) return '';

  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return `data:image/jpeg;base64,${btoa(binary)}`;
}
