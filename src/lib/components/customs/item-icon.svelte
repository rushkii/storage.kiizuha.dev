<script lang="ts">
  import type { FileKind } from '#lib/file-kind.ts';
  import { cn } from '#lib/utils.ts';

  import FolderIcon from '@lucide/svelte/icons/folder';
  import FileTextIcon from '@lucide/svelte/icons/file-text';
  import ImageIcon from '@lucide/svelte/icons/image';
  import VideoIcon from '@lucide/svelte/icons/video';
  import FileArchiveIcon from '@lucide/svelte/icons/file-archive';
  import FileIcon from '@lucide/svelte/icons/file';

  let { kind, class: className }: { kind: FileKind; class?: string } = $props();

  const ICONS = {
    folder: { icon: FolderIcon, color: 'text-sky-600 dark:text-sky-400' },
    document: { icon: FileTextIcon, color: 'text-blue-600 dark:text-blue-400' },
    image: { icon: ImageIcon, color: 'text-rose-600 dark:text-rose-400' },
    video: { icon: VideoIcon, color: 'text-violet-600 dark:text-violet-400' },
    archive: { icon: FileArchiveIcon, color: 'text-amber-600 dark:text-amber-400' },
    other: { icon: FileIcon, color: 'text-muted-foreground' }
  } as const;

  const entry = $derived(ICONS[kind]);
</script>

<entry.icon class={cn('size-4 shrink-0', entry.color, className)} aria-hidden="true" />
