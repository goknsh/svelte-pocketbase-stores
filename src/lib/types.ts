import type {
	Admin,
	ListResult,
	Record,
	RecordListQueryParams,
	RecordQueryParams
} from 'pocketbase';
import type { Reloadable } from '@square/svelte-store';

export interface PaginatedLoadable<T> extends Reloadable<T> {
	setPage: (page: number) => Promise<void>;
	next: () => Promise<void>;
	prev: () => Promise<void>;
}

export interface KnownUser {
	isLoggedIn: true;
}

export interface UnknownUser {
	isLoggedIn: false;
}

export const isRecord = (test: Record | Admin | null): test is Record =>
	test !== null && 'collectionId' in test && 'collectionName' in test && 'expand' in test;

export interface RecordStoreOptions<T> {
	disableRealtime?: boolean;
	initial?: T;
	queryParams?: RecordQueryParams;
}

export interface CollectionStoreOptions<T, U = T[]> extends RecordStoreOptions<U> {
	queryParams?: RecordListQueryParams;
	sortFunction?: (a: T, b: T) => number;
	filterFunction?: (value: T, index: number, array: T[]) => unknown;
	filterFunctionThisArg?: any;
}

export interface PaginatedCollectionStoreOptions<T, U = ListResult<T>>
	extends CollectionStoreOptions<T, U> {
	page?: number;
	perPage?: number;
}
