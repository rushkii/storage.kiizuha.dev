// Client-safe. Used for icons and the Recent page's Type filter.

export const FILE_KINDS = ['folder', 'document', 'image', 'video', 'archive', 'other'] as const;
export type FileKind = (typeof FILE_KINDS)[number];

const EXTENSIONS: Record<Exclude<FileKind, 'folder' | 'other'>, string[]> = {
  document: [
    'pdf',
    'doc',
    'docx',
    'odt',
    'rtf',
    'txt',
    'md',
    'xls',
    'xlsx',
    'ods',
    'csv',
    'ppt',
    'pptx',
    'odp',
    'epub'
  ],
  image: [
    'png',
    'jpg',
    'jpeg',
    'gif',
    'webp',
    'avif',
    'bmp',
    'svg',
    'heic',
    'heif',
    'tif',
    'tiff',
    'raw',
    'arw',
    'cr2',
    'cr3',
    'nef',
    'dng',
    'raf',
    'orf',
    'psd'
  ],
  video: ['mp4', 'm4v', 'mov', 'webm', 'mkv', 'avi', 'wmv', 'flv', 'mts', 'm2ts', 'ogv', '3gp'],
  archive: ['zip', 'rar', '7z', 'tar', 'gz', 'tgz', 'bz2', 'xz', 'zst', 'iso', 'dmg', 'qcow2']
};

const KIND_BY_EXTENSION = new Map<string, FileKind>(
  Object.entries(EXTENSIONS).flatMap(([kind, exts]) => exts.map((ext) => [ext, kind as FileKind]))
);

/** Lowercased extension without the dot. Empty for no extension or dotfiles like `.env`. */
export const extensionOf = (name: string) => {
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : '';
};

/** File kind from the name's extension, used for icons and filters. Unknown extensions are `other`. */
export const fileKindOf = (name: string): FileKind =>
  KIND_BY_EXTENSION.get(extensionOf(name)) ?? 'other';

const UNITS = ['B', 'KB', 'MB', 'GB', 'TB'];

/** 1536 → "1.54 KB". Decimal units, like the OS file managers most people compare against. */
export const formatBytes = (bytes: number) => {
  if (!Number.isFinite(bytes) || bytes < 0) return '—';
  let value = bytes;
  let unit = 0;
  while (value >= 1000 && unit < UNITS.length - 1) {
    value /= 1000;
    unit++;
  }
  const digits = unit === 0 || value >= 100 ? 0 : value >= 10 ? 1 : 2;
  return `${value.toFixed(digits)} ${UNITS[unit]}`;
};
