// Client-safe: the server pages tables with it, and the browser repeats it in client mode.
import { CLIENT_MODE_MAX_ROWS, type TableQuery } from '#lib/schemas/storage.ts';

export type TablePage<Row> = {
  rows: Row[];
  total: number;
  /**
   * True when `rows` holds the whole result set, so the table can search, sort and page in the
   * browser without asking the server again.
   */
  clientMode: boolean;
};

type Comparators<Row> = Record<string, (a: Row, b: Row) => number>;

export type TableQueryOptions<Row> = {
  searchText: (row: Row) => string;
  comparators: Comparators<Row>;
  defaultSort: (a: Row, b: Row) => number;
  pinFirst?: (row: Row) => boolean;
};

/** Search and sort only; no paging. */
export const filterAndSort = <Row>(
  rows: Row[],
  query: Pick<TableQuery, 'search' | 'sorts'>,
  { searchText, comparators, defaultSort, pinFirst }: TableQueryOptions<Row>
) => {
  const needle = query.search.trim().toLocaleLowerCase();
  const filtered = needle
    ? rows.filter((row) => searchText(row).toLocaleLowerCase().includes(needle))
    : [...rows];

  const sorts = query.sorts.filter((sort) => comparators[sort.id]);
  filtered.sort((a, b) => {
    if (pinFirst) {
      const pinned = Number(pinFirst(b)) - Number(pinFirst(a));
      if (pinned) return pinned;
    }
    for (const sort of sorts) {
      const result = comparators[sort.id](a, b);
      if (result) return sort.desc ? -result : result;
    }
    return defaultSort(a, b);
  });
  return filtered;
};

/**
 * Applies a data-table query to rows that were already scoped to one owner and one view.
 * Search matches `searchText(row)`; sorts use the named comparators and ignore unknown ids.
 * `pinFirst` keeps a group (e.g. folders before files) on top whatever the sort is.
 */
export const applyTableQuery = <Row>(
  rows: Row[],
  query: TableQuery,
  options: TableQueryOptions<Row>
): TablePage<Row> => {
  const filtered = filterAndSort(rows, query, options);
  const total = filtered.length;
  // Whole unfiltered set fits: send everything and let the browser take over.
  if (!query.search.trim() && rows.length <= CLIENT_MODE_MAX_ROWS) {
    return { rows: filtered, total, clientMode: true };
  }
  const start = (query.page - 1) * query.pageSize;
  return { rows: filtered.slice(start, start + query.pageSize), total, clientMode: false };
};

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
export const compareText = (a: string, b: string) => collator.compare(a, b);
export const compareNumber = (a: number, b: number) => a - b;
export const compareDate = (a: Date, b: Date) => a.getTime() - b.getTime();
