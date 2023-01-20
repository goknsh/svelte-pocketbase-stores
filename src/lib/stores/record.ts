import { asyncWritable, readable, type Unsubscriber, type Reloadable } from '@square/svelte-store';

import type Client from 'pocketbase';
import type { Record, RecordQueryParams, RecordSubscription } from 'pocketbase';

import { realtimeStoreExpand } from '../internal';
import type { RecordStoreOptions } from '../types';

const recordStoreCallback = async <T extends Pick<Record, 'id'>>(
	item: T | undefined,
	subscription: RecordSubscription<T>,
	collection: ReturnType<Client['collection']>,
	queryParams: RecordQueryParams | undefined = undefined
) => {
	switch (subscription.action) {
		case 'update':
			return await realtimeStoreExpand(collection, subscription.record, queryParams?.expand);
		case 'create':
			return await realtimeStoreExpand(collection, subscription.record, queryParams?.expand);
		case 'delete':
			return undefined;
		default:
			return item;
	}
};

/**
 * Readable async Svelte store wrapper around a Pocketbase record that updates in realtime.
 *
 * Notes:
 * - When running server-side, this store returns the "empty version" version of this store, i.e. `undefined`.
 * - If a delete action is received via the realtime subscription, the store's value changes to `undefined`.
 *
 * @param collection Collection the record is a part of whose updates to fetch in realtime.
 * @param id ID of the Pocketbase record which will be updated in realtime.
 * @param [options.queryParams] Pocketbase query paramteres to apply on initial data fetch and everytime an update is received via the realtime subscription. **Only `expand` field is used when an action is received via the realtime subscription.**
 * @param [options.initial] If provided, skips initial data fetching and uses the provided value instead. Useful if you want to perform initial fetch during SSR and initialize a realtime subscription client-side.
 * @param [options.disableRealtime] Only performs the initial fetch and does not subscribe to anything. This has an effect only when provided client-side.
 */
export const recordStore = <T extends Pick<Record, 'id'>>(
	collection: ReturnType<Client['collection']>,
	id: string,
	{ disableRealtime = false, ...options }: RecordStoreOptions<T> = {}
): Required<Omit<Reloadable<T | undefined>, 'reset'>> => {
	let result: T | undefined;

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
		let unsubscribe: Unsubscriber = () => {
			console.log('failed to unsubscribe', collection.collectionIdOrName);
		};

		const unsubscribeStore = readable('unsubscribeStore', () => unsubscribe);

		const store = asyncWritable<typeof unsubscribeStore, typeof result>(
			unsubscribeStore,
			async () =>
				(result = options.initial
					? options.initial
					: await collection.getOne<T>(id, options.queryParams)),
			async (v) => v,
			{
				reloadable: true,
				trackState: true
			}
		);

		const unsubscribePromise: Promise<() => Promise<void>> = disableRealtime
			? new Promise((r1) => r1(() => new Promise((r2) => r2())))
			: collection.subscribe<T>(id, (data) =>
					recordStoreCallback(result, data, collection, options.queryParams).then((r) =>
						store.set((result = r))
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
