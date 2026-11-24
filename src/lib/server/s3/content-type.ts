/**
 * Every file is stored as `application/octet-stream` with `Content-Disposition: attachment`, so
 * any type can be uploaded but nothing is rendered by default. Only the types below may be opened
 * inline, and their `Content-Type` comes from this map, never from the uploader.
 *
 * Left out on purpose: HTML, SVG, XML, XHTML, JavaScript and plain text, which a browser can
 * render as a page or run as script.
 */
const INLINE_CONTENT_TYPES: Record<string, string> = {
  // Raster images (no SVG: it can carry script).
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  avif: 'image/avif',
  bmp: 'image/bmp',
  // Documents (rendered by the browser's sandboxed PDF viewer).
  pdf: 'application/pdf',
  // Video
  mp4: 'video/mp4',
  m4v: 'video/mp4',
  webm: 'video/webm',
  mov: 'video/quicktime',
  ogv: 'video/ogg',
  // Audio
  mp3: 'audio/mpeg',
  m4a: 'audio/mp4',
  aac: 'audio/aac',
  wav: 'audio/wav',
  flac: 'audio/flac',
  ogg: 'audio/ogg',
  oga: 'audio/ogg',
  opus: 'audio/ogg'
};

/** `Content-Type` every object is stored and downloaded with unless it is opened inline. */
export const STORED_CONTENT_TYPE = 'application/octet-stream';

/** `Content-Disposition` every object is stored with. */
export const STORED_CONTENT_DISPOSITION = 'attachment';

const extensionOf = (filename: string) => {
  const dot = filename.lastIndexOf('.');
  return dot > 0 ? filename.slice(dot + 1).toLowerCase() : '';
};

/**
 * `Content-Type` to serve `filename` inline with, or `null` when it must be downloaded as an
 * attachment. Decided by the extension only, so a file renamed to `x.png` is still served as
 * `image/png`, which the browser decodes as an image and never runs as a page.
 */
export const getInlineContentType = (filename: string): string | null =>
  INLINE_CONTENT_TYPES[extensionOf(filename)] ?? null;

/** True when `filename` may be opened in the browser instead of downloaded. */
export const canOpenInline = (filename: string) => getInlineContentType(filename) !== null;
