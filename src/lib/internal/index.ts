import type { StoreOptions } from './../types';
import type Client from 'pocketbase';
import type { Record } from 'pocketbase';
import type { Reloadable, WritableLoadable } from '@square/svelte-store';

export const realtimeStoreExpand = async <T extends Pick<Record, 'id'>>(
	collection: ReturnType<Client['collection']>,
	record: T,
	expand: string | undefined = undefined
): Promise<T> =>
	expand
		? await collection.getOne<T>(record.id, typeof expand === 'string' ? { expand } : undefined)
		: record;
