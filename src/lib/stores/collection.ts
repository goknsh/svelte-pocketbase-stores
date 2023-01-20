import { readable, asyncWritable, type Unsubscriber, type Reloadable } from '@square/svelte-store';

import type Client from 'pocketbase';
import {
	type Record,
	type RecordListQueryParams,
	type RecordSubscription,
	ListResult
} from 'pocketbase';

import { realtimeStoreExpand } from './../internal';
import type {
	CollectionStoreOptions,
	PaginatedCollectionStoreOptions,
	PaginatedLoadable
} from './../types';

const collectionStoreCallback = async <T extends Pick<Record, 'id'>>(
	list: T[],
	subscription: RecordSubscription<T>,
	collection: ReturnType<Client['collection']>,
	queryParams: RecordListQueryParams | undefined = undefined
) => {
	switch (subscription.action) {
		case 'update':
			subscription.record = await realtimeStoreExpand(
				collection,
				subscription.record,
				queryParams?.expand
			);
			return list.map((item) => (item.id === subscription.record.id ? subscription.record : item));
		case 'create':
			subscription.record = await realtimeStoreExpand(
				collection,
				subscription.record,
				queryParams?.expand
			);
			return [...list, subscription.record];
		case 'delete':
			return list.filter((item) => item.id !== subscription.record.id);
		default:
			return list;
	}
};

/**
 * Readable async Svelte store wrapper around an entire Pocketbase collection that updates in realtime.
 *
 * Notes:
 * - When running server-side, this store returns the "empty version" version of this store, i.e. an empty array.
 * - Create action received by the realtime subscription are added to the end of the returned store.
 * - When an action is received via the realtime subscription, `sortFunction` runs first, then `filterFunction` runs.
 * - This version of the collection store does not have pagination. Use `paginatedCollectionStore` if you want pagination.
 *
 * @param collection Collection whose updates to fetch in realtime.
 * @param [options.queryParams] Pocketbase query parameters to apply on inital data fetch. **Only `expand` field is used when an action is received via the realtime subscription. Use `sortFunction` and `filterFunction` to apply sorting and filtering on actions received via the realtime subscription.**
 * @param [options.sortFunction] `compareFn` from `Array.prototype.sort` that runs when an action is received via the realtime subscription. This is used since realtime subscriptions does not support `sort` in `queryParams`.
 * @param [options.filterFunction] `predicate` from `Array.prototype.filter` that runs when an action is received via the realtime subscription. This is used since realtime subscriptions does not support `filter` in `queryParams`.
 * @param [options.filterFunctionThisArg] `thisArg` from `Array.prototype.filter` that runs when an action is received via the realtime subscription. This is used since realtime subscriptions does not support `filter` in `queryParams`.
 * @param [options.initial] If provided, skips initial data fetching and uses the provided value instead. Useful if you want to perform initial fetch during SSR and initialize a realtime subscription client-side.
 * @param [options.disableRealtime] Only performs the initial fetch and does not subscribe to anything. This has an effect only when provided client-side.
 */
export const collectionStore = <T extends Pick<Record, 'id'>>(
	collection: ReturnType<Client['collection']>,
	{ disableRealtime = false, ...options }: CollectionStoreOptions<T> = {}
): Required<Omit<Reloadable<T[]>, 'reset'>> => {
	let result: T[] = [];

	if (import.meta.env.SSR) {
		const store = readable(result);
		return {
			load: store.load,
			reload: store.reload as Reloadable<typeof result>['reload'],
			state: store.state as Required<Reloadable<typeof result>>['state'],
			store: store.store,
			subscribe: store.subscribe
		};
	} else {
		console.log('loading', collection.collectionIdOrName);

		let unsubscribe: Unsubscriber = () => {
			console.log('failed to unsubscribe', collection.collectionIdOrName);
		};

		const unsubscribeStore = readable('unsubscribeStore', () => unsubscribe);

		console.log('subscribing', collection.collectionIdOrName);
		const store = asyncWritable<typeof unsubscribeStore, typeof result>(
			unsubscribeStore,
			async () =>
				(result = options.initial
					? options.initial
					: await collection.getFullList<T>(undefined, options.queryParams)),
			async (v) => v,
			{ reloadable: true, trackState: true }
		);

		const unsubscribePromise: Promise<() => Promise<void>> =
			disableRealtime || import.meta.env.SSR
				? new Promise((r1) => r1(() => new Promise((r2) => r2())))
				: collection.subscribe<T>('*', (data) =>
						collectionStoreCallback(result, data, collection, options.queryParams).then((items) =>
							store.set(
								(result = options.filterFunction
									? items
											.sort(options.sortFunction)
											.filter(options.filterFunction, options.filterFunctionThisArg)
									: items.sort(options.sortFunction))
							)
						)
				  );

		unsubscribe = () => {
			console.log('unsubscribing', collection.collectionIdOrName);
			(async () => await (await unsubscribePromise)())();
			console.log('unsubscribingDone', collection.collectionIdOrName);
		};

		return {
			load: store.load,
			reload: store.reload as Reloadable<typeof result>['reload'],
			state: store.state as Required<Reloadable<typeof result>>['state'],
			store: store.store,
			subscribe: store.subscribe
		};
	}
};

const paginatedCollectionStoreCallback = async <T extends Pick<Record, 'id'>>(
	list: ListResult<T>,
	subscription: RecordSubscription<T>,
	collection: ReturnType<Client['collection']>,
	queryParams: RecordListQueryParams | undefined = undefined
) => {
	switch (subscription.action) {
		case 'update':
			subscription.record = await realtimeStoreExpand(
				collection,
				subscription.record,
				queryParams?.expand
			);
			return list.items.map((item) =>
				item.id === subscription.record.id ? subscription.record : item
			);
		case 'create':
			subscription.record = await realtimeStoreExpand(
				collection,
				subscription.record,
				queryParams?.expand
			);
			return [...list.items, subscription.record];
		case 'delete':
			return list.items.filter((item) => item.id !== subscription.record.id);
		default:
			return list.items;
	}
};

/**
 * Paginated readable async Svelte store wrapper around a Pocketbase collection that updates in realtime.
 *
 * Notes:
 * - When running server-side, this store returns the "empty version" version of this store, i.e. an empty `ListResult` with `items` set to `[]`, `totalItems` and `totalPages` set to 0. `setPage`, `next`, and `prev` will also have no effects.
 * - Pagination is only applied when we first get the data and anytime the page number is updated. Pagination is not applied to the realtime subscription, which gets updates from the entire collection.
 * - When `setPage`, `next`, or `prev` is called, the returned store is reset to have only the items in the specified page.
 * - Create action received by the realtime subscription are added to the end of the returned store.
 * - When an action is received via the realtime subscription, `sortFunction` runs first, then `filterFunction` runs.
 * - This version of the collection store does not get the entire collection. Use `collectionStore` if you want the entire collection.
 *
 * @param collection Collection whose updates to fetch in realtime.
 * @param [options.page] Page number to start the store on.
 * @param [options.perPage] Number of items per page.
 * @param [options.queryParams] Pocketbase query parameters to apply on inital data fetch and if `setPage`, `next`, or `prev` is called. **Only `expand` field is used when an action is received via the realtime subscription. Use `sortFunction` and `filterFunction` to apply sorting and filtering on actions received via the realtime subscription.**
 * @param [options.sortFunction] `compareFn` from `Array.prototype.sort` that runs when an action is received via the realtime subscription. This is used since realtime subscriptions does not support `sort` in `queryParams`.
 * @param [options.filterFunction] `predicate` from `Array.prototype.filter` that runs when an action is received via the realtime subscription. This is used since realtime subscriptions does not support `filter` in `queryParams`.
 * @param [options.filterFunctionThisArg] `thisArg` from `Array.prototype.filter` that runs when an action is received via the realtime subscription. This is used since realtime subscriptions does not support `filter` in `queryParams`.
 * @param [options.initial] If provided, skips initial data fetching and uses the provided value instead. Useful if you want to perform initial fetch during SSR and initialize a realtime subscription client-side.
 * @param [options.disableRealtime] Only performs the initial fetch and does not subscribe to anything. This has an effect only when provided client-side.
 */
export const paginatedCollectionStore = <T extends Pick<Record, 'id'>>(
	collection: ReturnType<Client['collection']>,
	{
		page = 1,
		perPage = 20,
		disableRealtime = false,
		...options
	}: PaginatedCollectionStoreOptions<T> = {}
): Required<Omit<PaginatedLoadable<ListResult<T>>, 'reset'>> => {
	let result = new ListResult<T>(page, perPage, 0, 0, []);

	if (import.meta.env.SSR) {
		const store = readable(result);
		const setPage = async (page: number) => {};
		return {
			load: store.load,
			reload: store.reload as Reloadable<typeof result>['reload'],
			state: store.state as Required<Reloadable<typeof result>>['state'],
			store: store.store,
			subscribe: store.subscribe,
			setPage,
			next: () => setPage(result.page + 1),
			prev: () => setPage(result.page - 1)
		};
	} else {
		console.log('loading', collection.collectionIdOrName);

		let unsubscribe: Unsubscriber = () => {
			console.log('failed to unsubscribe', collection.collectionIdOrName);
		};

		const unsubscribeStore = readable('unsubscribeStore', () => unsubscribe);

		console.log('subscribing', collection.collectionIdOrName);
		const store = asyncWritable<typeof unsubscribeStore, typeof result>(
			unsubscribeStore,
			async () =>
				(result = options.initial
					? options.initial
					: await collection.getList<T>(page, perPage, options.queryParams)),
			async (v) => v,
			{ reloadable: true, trackState: true }
		);

		const unsubscribePromise: Promise<() => Promise<void>> =
			disableRealtime || import.meta.env.SSR
				? new Promise((r1) => r1(() => new Promise((r2) => r2())))
				: collection.subscribe<T>('*', (data) =>
						paginatedCollectionStoreCallback(result, data, collection, options.queryParams).then(
							(items) =>
								store.set(
									(result = {
										...result,
										items: options.filterFunction
											? items
													.sort(options.sortFunction)
													.filter(options.filterFunction, options.filterFunctionThisArg)
											: items.sort(options.sortFunction)
									})
								)
						)
				  );

		unsubscribe = () => {
			console.log('unsubscribing', collection.collectionIdOrName);
			(async () => await (await unsubscribePromise)())();
			console.log('unsubscribingDone', collection.collectionIdOrName);
		};

		const setPage = async (page: number) => {
			if (page > 0 && page <= result.totalPages) {
				store.set(
					(result = await collection.getList<T>(page, result.perPage, options.queryParams))
				);
			}
		};

		return {
			load: store.load,
			reload: store.reload as Reloadable<typeof result>['reload'],
			state: store.state as Required<Reloadable<typeof result>>['state'],
			store: store.store,
			subscribe: store.subscribe,
			setPage,
			next: () => setPage(result.page + 1),
			prev: () => setPage(result.page - 1)
		};
	}
};
