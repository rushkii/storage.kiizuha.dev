<script lang="ts">
  import * as Dialog from '#ui/dialog';
  import { Button } from '#ui/button';
  import { Slider } from '#ui/slider';
  import { AVATAR_SIZE_PX } from '#lib/schemas/account.ts';

  import ZoomInIcon from '@lucide/svelte/icons/zoom-in';
  import ZoomOutIcon from '@lucide/svelte/icons/zoom-out';

  // Square crop for a new avatar: drag to move, slider (or wheel) to zoom. Apply renders the crop
  // in the browser and hands back a 512 × 512 image; nothing is uploaded until the profile is saved.

  let {
    source,
    onApply,
    onCancel
  }: {
    /** Object URL of the picked image, or `null` when the dialog is closed. */
    source: string | null;
    onApply: (file: File) => void;
    onCancel: () => void;
  } = $props();

  const VIEWPORT = 256;
  const ZOOM_MIN = 1;
  const ZOOM_MAX = 3;

  let image = $state<HTMLImageElement | null>(null);
  let natural = $state({ width: 0, height: 0 });
  let zoom = $state(1);
  let offset = $state({ x: 0, y: 0 });
  let drag: { pointerId: number; x: number; y: number; startX: number; startY: number } | null =
    null;
  let busy = $state(false);

  /** Scale at which the image's shorter side fills the viewport (zoom 1). */
  const baseScale = $derived(
    natural.width && natural.height ? VIEWPORT / Math.min(natural.width, natural.height) : 1
  );
  const scale = $derived(baseScale * zoom);

  /** Keeps the image covering the whole viewport. */
  const clamp = (x: number, y: number, s = scale) => {
    const maxX = Math.max(0, (natural.width * s - VIEWPORT) / 2);
    const maxY = Math.max(0, (natural.height * s - VIEWPORT) / 2);
    return { x: Math.min(maxX, Math.max(-maxX, x)), y: Math.min(maxY, Math.max(-maxY, y)) };
  };

  const setZoom = (value: number) => {
    const next = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, value));
    zoom = next;
    offset = clamp(offset.x, offset.y, baseScale * next);
  };

  const reset = () => {
    zoom = 1;
    offset = { x: 0, y: 0 };
    natural = { width: 0, height: 0 };
  };

  const onLoad = () => {
    if (!image) return;
    natural = { width: image.naturalWidth, height: image.naturalHeight };
    zoom = 1;
    offset = { x: 0, y: 0 };
  };

  const onPointerDown = (event: PointerEvent) => {
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    drag = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      startX: offset.x,
      startY: offset.y
    };
  };

  const onPointerMove = (event: PointerEvent) => {
    if (!drag || drag.pointerId !== event.pointerId) return;
    offset = clamp(drag.startX + event.clientX - drag.x, drag.startY + event.clientY - drag.y);
  };

  const onPointerUp = (event: PointerEvent) => {
    if (drag?.pointerId === event.pointerId) drag = null;
  };

  const onWheel = (event: WheelEvent) => {
    event.preventDefault();
    setZoom(zoom - event.deltaY * 0.002);
  };

  /** Arrow keys move the image, + and - zoom, for keyboard users. */
  const onKeyDown = (event: KeyboardEvent) => {
    const step = event.shiftKey ? 32 : 8;
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [step, 0],
      ArrowRight: [-step, 0],
      ArrowUp: [0, step],
      ArrowDown: [0, -step]
    };
    if (event.key in moves) {
      event.preventDefault();
      const [dx, dy] = moves[event.key];
      offset = clamp(offset.x + dx, offset.y + dy);
    } else if (event.key === '+' || event.key === '=') {
      event.preventDefault();
      setZoom(zoom + 0.1);
    } else if (event.key === '-') {
      event.preventDefault();
      setZoom(zoom - 0.1);
    }
  };

  const toBlob = (canvas: HTMLCanvasElement, type: string) =>
    new Promise<Blob | null>((done) => canvas.toBlob(done, type, 0.9));

  /** WebP where the browser can encode it (Safari cannot), JPEG otherwise. */
  const apply = async () => {
    if (!image || !natural.width) return;
    busy = true;
    try {
      const canvas = document.createElement('canvas');
      canvas.width = AVATAR_SIZE_PX;
      canvas.height = AVATAR_SIZE_PX;
      const context = canvas.getContext('2d');
      if (!context) return;

      const ratio = AVATAR_SIZE_PX / VIEWPORT;
      context.imageSmoothingQuality = 'high';
      context.translate(
        AVATAR_SIZE_PX / 2 + offset.x * ratio,
        AVATAR_SIZE_PX / 2 + offset.y * ratio
      );
      context.scale(scale * ratio, scale * ratio);
      context.drawImage(image, -natural.width / 2, -natural.height / 2);

      let blob = await toBlob(canvas, 'image/webp');
      if (!blob || blob.type !== 'image/webp') blob = await toBlob(canvas, 'image/jpeg');
      if (!blob) return;
      const extension = blob.type === 'image/webp' ? 'webp' : 'jpg';
      onApply(new File([blob], `avatar.${extension}`, { type: blob.type }));
      reset();
    } finally {
      busy = false;
    }
  };

  const cancel = () => {
    reset();
    onCancel();
  };
</script>

<Dialog.Root
  open={source !== null}
  onOpenChange={(open) => {
    if (!open) cancel();
  }}
>
  <Dialog.Content class="sm:max-w-sm">
    <Dialog.Header>
      <Dialog.Title>Crop avatar</Dialog.Title>
      <Dialog.Description>Drag to move the image. Use the slider to zoom.</Dialog.Description>
    </Dialog.Header>

    <div class="flex justify-center rounded-lg bg-muted p-4">
      <button
        type="button"
        aria-label="Crop area. Use the arrow keys to move the image, plus and minus to zoom."
        class="relative block cursor-grab touch-none overflow-hidden rounded-sm bg-black outline-none select-none focus-visible:ring-2 focus-visible:ring-ring/30 active:cursor-grabbing"
        style:width="{VIEWPORT}px"
        style:height="{VIEWPORT}px"
        onpointerdown={onPointerDown}
        onpointermove={onPointerMove}
        onpointerup={onPointerUp}
        onpointercancel={onPointerUp}
        onwheel={onWheel}
        onkeydown={onKeyDown}
      >
        {#if source}
          <img
            bind:this={image}
            src={source}
            alt=""
            draggable="false"
            onload={onLoad}
            class="pointer-events-none absolute top-1/2 left-1/2 max-w-none origin-center"
            style:width="{natural.width}px"
            style:height="{natural.height}px"
            style:transform="translate(-50%, -50%) translate({offset.x}px, {offset.y}px) scale({scale})"
          />
        {/if}
        <div
          aria-hidden="true"
          class="pointer-events-none absolute inset-0 grid grid-cols-3 grid-rows-3 ring-2 ring-white ring-inset"
        >
          {#each { length: 9 }, i (i)}
            <div class="border-white/30 not-nth-[3n]:border-e not-nth-[n+7]:border-b"></div>
          {/each}
        </div>
      </button>
    </div>

    <div class="flex items-center gap-2.5">
      <ZoomOutIcon class="size-3.5 text-muted-foreground" aria-hidden="true" />
      <Slider
        type="single"
        min={ZOOM_MIN}
        max={ZOOM_MAX}
        step={0.01}
        value={zoom}
        onValueChange={setZoom}
        aria-label="Zoom"
        class="flex-1"
      />
      <ZoomInIcon class="size-3.5 text-muted-foreground" aria-hidden="true" />
    </div>

    <p class="text-xs text-muted-foreground">
      Saved as a {AVATAR_SIZE_PX} × {AVATAR_SIZE_PX} image. It is uploaded when you save your profile.
    </p>

    <Dialog.Footer>
      <Button variant="outline" onclick={cancel} disabled={busy}>Cancel</Button>
      <Button onclick={apply} disabled={busy || !natural.width}>Apply</Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
