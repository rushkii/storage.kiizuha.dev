<script lang="ts">
  import type { DateRange } from 'bits-ui';
  import { RangeCalendar as RangeCalendarPrimitive } from 'bits-ui';
  import { tick } from 'svelte';
  import { cn, type WithoutChildrenOrChild } from '#lib/utils.js';
  import { buttonVariants, type ButtonVariant } from '#ui/button/index.js';
  import * as Calendar from '#ui/calendar/index.js';
  // import { isEqualMonth, type DateValue } from '@internationalized/date';

  let {
    ref = $bindable(null),
    value = $bindable(),
    placeholder = $bindable(),
    class: className,
    weekdayFormat = 'short',
    buttonVariant = 'ghost',
    captionLayout = 'label',
    locale = 'en-US',
    months: monthsProp,
    years,
    monthFormat: monthFormatProp,
    yearFormat = 'numeric',
    disableDaysOutsideMonth = false,
    initialFocus = false,
    ...restProps
  }: WithoutChildrenOrChild<RangeCalendarPrimitive.RootProps> & {
    buttonVariant?: ButtonVariant;
    captionLayout?: 'dropdown' | 'dropdown-months' | 'dropdown-years' | 'label';
    months?: RangeCalendarPrimitive.MonthSelectProps['months'];
    years?: RangeCalendarPrimitive.YearSelectProps['years'];
    monthFormat?: RangeCalendarPrimitive.MonthSelectProps['monthFormat'];
    yearFormat?: RangeCalendarPrimitive.YearSelectProps['yearFormat'];
    initialFocus?: boolean;
  } = $props();

  let didInitialFocus = $state(false);

  const monthFormat = $derived.by(() => {
    if (monthFormatProp) return monthFormatProp;
    if (captionLayout.startsWith('dropdown')) return 'short';
    return 'long';
  });

  $effect(() => {
    if (!initialFocus || !ref || didInitialFocus) return;

    didInitialFocus = true;
    tick().then(() => {
      const root = ref as HTMLElement | null;
      const target =
        root?.querySelector<HTMLElement>('[data-bits-day][data-selected]') ??
        root?.querySelector<HTMLElement>('[data-bits-day][data-today]') ??
        root?.querySelector<HTMLElement>('[data-bits-day]:not([data-disabled])');
      target?.focus();
    });
  });
</script>

<RangeCalendarPrimitive.Root
  bind:value={value as DateRange}
  bind:ref
  bind:placeholder
  {weekdayFormat}
  {disableDaysOutsideMonth}
  class={cn(
    'group/calendar w-fit bg-background p-3 [--cell-size:--spacing(8)] in-data-[slot=card-content]:bg-transparent in-data-[slot=popover-content]:bg-transparent',
    className
  )}
  {locale}
  {monthFormat}
  {yearFormat}
  {...restProps}
>
  {#snippet children({ months, weekdays })}
    <Calendar.Months>
      <Calendar.Nav>
        <Calendar.PrevButton variant={buttonVariant} />
        <Calendar.NextButton variant={buttonVariant} />
      </Calendar.Nav>
      {#each months as month, monthIndex (month)}
        <Calendar.Month>
          <Calendar.Header>
            <Calendar.Caption
              {captionLayout}
              months={monthsProp}
              {monthFormat}
              {years}
              {yearFormat}
              month={month.value}
              bind:placeholder
              {locale}
              {monthIndex}
            />
          </Calendar.Header>
          <Calendar.Grid>
            <Calendar.GridHead>
              <Calendar.GridRow class="select-none">
                {#each weekdays as weekday (weekday)}
                  <Calendar.HeadCell>
                    {weekday.slice(0, 2)}
                  </Calendar.HeadCell>
                {/each}
              </Calendar.GridRow>
            </Calendar.GridHead>
            <Calendar.GridBody>
              {#each month.weeks as weekDates (weekDates)}
                <Calendar.GridRow class="mt-2 w-full">
                  {#each weekDates as date (date)}
                    <RangeCalendarPrimitive.Cell
                      {date}
                      month={month.value}
                      class={cn(
                        'relative aspect-square h-full w-full p-0 text-center text-sm select-none focus-within:z-20',
                        '[&:first-child_[data-bits-day]]:rounded-l-md [&:last-child_[data-bits-day]]:rounded-r-md',
                        '[&[data-range-middle]_[data-bits-day]]:rounded-none [&[data-range-middle]_[data-bits-day]]:bg-accent [&[data-range-middle]_[data-bits-day]]:text-accent-foreground',
                        '[&[data-highlighted]_[data-bits-day]]:bg-accent [&[data-highlighted]_[data-bits-day]]:text-accent-foreground'
                      )}
                    >
                      <RangeCalendarPrimitive.Day
                        class={cn(
                          buttonVariants({ variant: buttonVariant }),
                          'flex aspect-square size-auto w-full min-w-(--cell-size) flex-col items-center justify-center gap-1 p-0 leading-none font-normal whitespace-nowrap select-none',
                          '[&[data-today]:not([data-selected])]:bg-accent [&[data-today]:not([data-selected])]:text-accent-foreground [&[data-today][data-disabled]]:text-muted-foreground',
                          'data-selected:bg-primary data-selected:text-primary-foreground dark:data-selected:hover:bg-accent/50',
                          'data-[range-start][data-range-end]:rounded-md data-range-end:rounded-l-none data-range-start:rounded-r-none',
                          '[&[data-outside-month]:not([data-selected])]:text-muted-foreground [&[data-outside-month]:not([data-selected])]:hover:text-accent-foreground',
                          'data-disabled:pointer-events-none data-disabled:text-muted-foreground data-disabled:opacity-50',
                          'data-unavailable:text-muted-foreground data-unavailable:line-through',
                          'focus:relative focus:z-10 focus:border-ring focus:ring-[3px] focus:ring-ring/50 dark:hover:text-accent-foreground [&>span]:text-xs [&>span]:opacity-70'
                        )}
                      />
                    </RangeCalendarPrimitive.Cell>
                  {/each}
                </Calendar.GridRow>
              {/each}
            </Calendar.GridBody>
          </Calendar.Grid>
        </Calendar.Month>
      {/each}
    </Calendar.Months>
  {/snippet}
</RangeCalendarPrimitive.Root>
