import { page } from '$app/state';
import type { RemoteQuery } from '$app/server';
import type { TableQuery } from '#lib/schemas/storage.ts';
import { setSearchParams } from '#lib/navigation.ts';
import {
  compareDate,
  compareNumber,
  compareText,
  filterAndSort,
  type TablePage
} from '#lib/table-query.ts';

// Table state that belongs in the URL, so it survives reloads and shared links: search `q`, `sort`
// (`name.asc,size.desc`), `page`, `perPage` and the `view` toggle.

export type TableView = 'table' | 'grid';
export type Sort = { id: string; desc: boolean };

const PAGE_SIZES = [25, 50, 100, 200];
export const TABLE_PAGE_SIZES = PAGE_SIZES;

const parseSorts = (value: string | null): Sort[] =>
  (value ?? '')
    .split(',')
    .map((part) => part.split('.'))
    .filter(([id, dir]) => id && /^[A-Za-z]{1,64}$/.test(id) && (dir === 'asc' || dir === 'desc'))
    .map(([id, dir]) => ({ id, desc: dir === 'desc' }))
    .slice(0, 8);

const positiveInt = (value: string | null, fallback: number) => {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : fallback;
};

export class TableState {
  search = $state('');
  sorts = $state<Sort[]>([]);
  page = $state(1);
  pageSize = $state(50);
  view = $state<TableView>('table');
  /** Columns hidden from the View menu. Kept here (not in the URL) so it survives remounts. */
  columnVisibility = $state<Record<string, boolean>>({});

  constructor(options: { pageSize?: number; withView?: boolean } = {}) {
    const params = page.url.searchParams;
    this.search = (params.get('q') ?? '').slice(0, 200);
    this.sorts = parseSorts(params.get('sort'));
    this.page = positiveInt(params.get('page'), 1);
    const perPage = positiveInt(params.get('perPage'), options.pageSize ?? 50);
    this.pageSize = Math.min(perPage, 500);
    this.view = options.withView && params.get('view') === 'grid' ? 'grid' : 'table';

    $effect(() => {
      const changes = {
        q: this.search.trim() || null,
        sort: this.sorts.map((s) => `${s.id}.${s.desc ? 'desc' : 'asc'}`).join(',') || null,
        page: this.page > 1 ? String(this.page) : null,
        perPage: this.pageSize !== (options.pageSize ?? 50) ? String(this.pageSize) : null,
        view: this.view === 'grid' ? 'grid' : null
      };
      setSearchParams(changes).catch(() => {
        // The router is not ready on the very first effect run; the next change syncs it.
      });
    });
  }

  /** The query sent to the server when the table is in server mode. */
  get query(): TableQuery {
    return { search: this.search, sorts: this.sorts, page: this.page, pageSize: this.pageSize };
  }

  setSearch(value: string) {
    this.search = value;
    this.page = 1;
  }

  setSorts(sorts: Sort[]) {
    this.sorts = sorts;
    this.page = 1;
  }
}

/** Generic comparison of a row field, used for client-mode sorting. */
const compareField = (a: unknown, b: unknown) => {
  if (a == null || b == null) return Number(a != null) - Number(b != null);
  if (a instanceof Date && b instanceof Date) return compareDate(a, b);
  if (typeof a === 'number' && typeof b === 'number') return compareNumber(a, b);
  const text = (value: unknown) =>
    typeof value === 'object' && value && 'name' in value ? String(value.name) : String(value);
  return compareText(text(a), text(b));
};

const BASE_QUERY: TableQuery = { search: '', sorts: [], page: 1, pageSize: 50 };

/**
 * Hybrid loading: ask for the unfiltered set first. If it fits
 * (`clientMode`), search, sort and paging stay in the browser. Otherwise every change asks the
 * server.
 */
export class HybridTable<Data, Row extends object> {
  #serverMode = $state(false);
  #state: TableState;
  #load: (query: TableQuery) => RemoteQuery<Data>;
  #select: (data: Data) => TablePage<Row> | null;
  #options: {
    searchText: (row: Row) => string;
    pinFirst?: (row: Row) => boolean;
    defaultSort: Sort;
  };

  constructor(options: {
    state: TableState;
    load: (query: TableQuery) => RemoteQuery<Data>;
    select: (data: Data) => TablePage<Row> | null;
    searchText: (row: Row) => string;
    pinFirst?: (row: Row) => boolean;
    defaultSort: Sort;
  }) {
    this.#state = options.state;
    this.#load = options.load;
    this.#select = options.select;
    this.#options = options;

    $effect(() => {
      const result = this.pageData;
      if (result && !result.clientMode && !this.#serverMode) this.#serverMode = true;
    });
  }

  readonly resource = $derived.by(() =>
    this.#load(this.#serverMode ? this.#state.query : BASE_QUERY)
  );

  /** The raw query result, kept while a refetch is in flight. */
  readonly data = $derived.by(() => this.resource.current);
  readonly pageData = $derived.by(() =>
    this.data === undefined ? undefined : this.#select(this.data)
  );

  readonly #clientRows = $derived.by(() => {
    const result = this.pageData;
    if (!result?.clientMode) return null;
    const sorts = this.#state.sorts.length ? this.#state.sorts : [this.#options.defaultSort];
    const comparators = Object.fromEntries(
      sorts.map((s) => [
        s.id,
        (a: Row, b: Row) => compareField(a[s.id as keyof Row], b[s.id as keyof Row])
      ])
    );
    return filterAndSort(result.rows, this.#state, {
      searchText: this.#options.searchText,
      pinFirst: this.#options.pinFirst,
      comparators,
      defaultSort: () => 0
    });
  });

  /** Rows of the current page. */
  readonly rows = $derived.by(() => {
    if (this.#clientRows) {
      const start = (this.#state.page - 1) * this.#state.pageSize;
      return this.#clientRows.slice(start, start + this.#state.pageSize);
    }
    return this.pageData?.rows ?? [];
  });

  readonly total = $derived.by(() => this.#clientRows?.length ?? this.pageData?.total ?? 0);
  readonly pageCount = $derived.by(() => Math.max(1, Math.ceil(this.total / this.#state.pageSize)));
  readonly loading = $derived.by(() => this.resource.loading);
  readonly ready = $derived.by(() => this.data !== undefined);
  readonly error = $derived.by(() => this.resource.error);

  /** Every row of the current filter (all pages), for Ctrl/Cmd + A in client mode. */
  readonly allRows = $derived.by(() => this.#clientRows ?? this.rows);

  refresh() {
    return this.resource.refresh();
  }
}
