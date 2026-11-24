<script lang="ts">
  import * as Empty from '#ui/empty';
  import Link2OffIcon from '@lucide/svelte/icons/link-2-off';

  // Same page for expired, revoked and unknown share links, so a token's state never leaks.
</script>

<main class="flex min-h-svh items-center justify-center p-4">
  <Empty.Root>
    <Empty.Header>
      <Empty.Media variant="icon"><Link2OffIcon /></Empty.Media>
      <Empty.Title>This link has expired or was removed</Empty.Title>
      <Empty.Description>Ask the person who shared it for a new link.</Empty.Description>
    </Empty.Header>
  </Empty.Root>
</main>
