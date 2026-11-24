// Client-safe date labels for tables.

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

/** Today: "10:42". This year: "17 Nov". Older: "17 Nov 2025". */
export const formatShortDate = (date: Date, now = new Date()) => {
  if (sameDay(date, now)) {
    return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  }
  return date.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    ...(date.getFullYear() === now.getFullYear() ? {} : { year: 'numeric' })
  });
};

/** Full date and time in the user's locale, e.g. "24 Nov 2026, 16:42". For tooltips and details. */
export const formatLongDate = (date: Date) =>
  date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

/** Monday-based start of the week. */
const startOfWeek = (date: Date) => {
  const day = startOfDay(date);
  day.setDate(day.getDate() - ((day.getDay() + 6) % 7));
  return day;
};

/** Heading for the Recent page groups, e.g. Today, Yesterday, Earlier this week. */
export const recentGroupOf = (date: Date, now = new Date()) => {
  const today = startOfDay(now);
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const thisWeek = startOfWeek(now);
  const lastWeek = new Date(thisWeek);
  lastWeek.setDate(thisWeek.getDate() - 7);

  if (date >= today) return 'Today';
  if (date >= yesterday) return 'Yesterday';
  if (date >= thisWeek) return 'Earlier this week';
  if (date >= lastWeek) return 'Last week';
  if (date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth()) {
    return 'Earlier this month';
  }
  if (date.getFullYear() === now.getFullYear()) return 'Earlier this year';
  return 'Older';
};
