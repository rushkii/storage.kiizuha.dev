<script lang="ts">
  import type { Snippet } from 'svelte';
  import { Badge } from '#ui/badge';
  import { cn } from '#lib/utils.ts';

  // Status badge, heading and explanation under an error illustration.

  type Tone = 'primary' | 'destructive' | 'warning';

  let {
    code,
    title,
    tone = 'primary',
    children
  }: { code: string; title: string; tone?: Tone; children: Snippet } = $props();

  const DOT: Record<Tone, string> = {
    primary: 'bg-primary',
    destructive: 'bg-destructive',
    warning: 'bg-amber-500'
  };
</script>

<Badge
  variant={tone === 'destructive' ? 'destructive' : 'secondary'}
  class={cn('mt-5 gap-1.5 font-mono uppercase', tone !== 'destructive' && 'text-muted-foreground')}
>
  <span class={cn('size-1.5 rounded-full', DOT[tone])}></span>
  {code}
</Badge>
<h1 class="mt-3 text-2xl font-semibold tracking-tight text-balance sm:text-[1.75rem]">{title}</h1>
<p class="mt-2 max-w-md text-sm text-pretty text-muted-foreground">
  {@render children()}
</p>
