# svelte-pocketbase-stores

> **Warning**
> Package has been deprecated in favor of [`svelte-query-pocketbase`](https://github.com/goknsh/svelte-query-pocketbase)

A set of asynchronous Svelte store wrappers for Pocketbase that update in realtime.

## Installation

```
npm i -D svelte-pocketbase-stores
```

## Record Store

Readable asynchronous Svelte store wrapper around a Pocketbase record that updates in realtime.

Notes:

- When running server-side, this store returns the "empty version" version of this store, i.e. `undefined`.
- If a delete action is received via the realtime subscription, the store's value changes to `undefined`.

### Simple Example

```svelte
<script lang="ts">
	import Pocketbase from 'pocketbase';
	import { safeLoad, recordStore } from 'svelte-pocketbase-stores';

	const pocketbase = new Pocketbase(process.env.PB_URL);

	// If you use https://github.com/patmood/pocketbase-typegen, you should do `recordStore<SomeCollectionResponse>(Collections.SomeCollection)`.
	const { state, ...record } = recordStore(pocketbase.collection('some_collection'), 'some_id');
</script>

{#await safeLoad(record)}
	<p>Loading...</p>
{:then loadedSafely}
	{#if !loadedSafely}
		Something went wrong...
	{:else}
		<!-- This will now update in realtime -->
		<pre>{JSON.stringify($record, null, 2)}</pre>
		<button on:click={() => record.reload()} disabled={$state.isReloading}
			>{$state.isReloading ? 'Reloading...' : 'Reload'}</button
		>
	{/if}
{/await}
```

### With Query Params

```svelte
<script lang="ts">
	import Pocketbase from 'pocketbase';
	import { safeLoad, recordStore } from 'svelte-pocketbase-stores';

	const pocketbase = new Pocketbase(process.env.PB_URL);

	// `queryParams` will be used during the inital fetch, and everytime an update is received via the realtime subscription
	const { state, ...record } = recordStore(pocketbase.collection('some_collection'), 'some_id', {
		queryParams: { expand: 'some_field' }
	});
</script>

{#await safeLoad(record)}
	<p>Loading...</p>
{:then loadedSafely}
	{#if !loadedSafely}
		Something went wrong...
	{:else}
		<!-- This will now update in realtime -->
		<pre>{JSON.stringify($record, null, 2)}</pre>
		<button on:click={() => record.reload()} disabled={$state.isReloading}
			>{$state.isReloading ? 'Reloading...' : 'Reload'}</button
		>
	{/if}
{/await}
```

### Using SSR

When running server-side, this store returns the "empty version" version of this store, i.e. `undefined`, and then executes normally client-side. So you could use it normally as shown in the previous examples, or you could fetch the record server-side and pass it to `recordStore`. When done so, `recordStore` will skip the initial fetch and only create the realtime subscription client-side.

```typescript
// +page.server.ts or +page.ts
export async function load() {
	const pocketbase = new Pocketbase(process.env.PB_URL);

	return {
		initial: await collection.getOne('some_id')
	};
}
```

```svelte
<!-- +page.svelte -->
<script lang="ts">
	import Pocketbase from 'pocketbase';
	import { safeLoad, recordStore } from 'svelte-pocketbase-stores';
	import type { PageData } from './$types';

	export let data: PageData;

	const pocketbase = new Pocketbase(process.env.PB_URL);

	const { state, ...record } = recordStore(pocketbase.collection('some_collection'), 'some_id', {
		initial: data.initial
	});
</script>

{#await safeLoad(record)}
	<p>Loading...</p>
{:then loadedSafely}
	{#if !loadedSafely}
		Something went wrong...
	{:else}
		<!-- This will now update in realtime -->
		<pre>{JSON.stringify($record, null, 2)}</pre>
		<button on:click={() => record.reload()} disabled={$state.isReloading}
			>{$state.isReloading ? 'Reloading...' : 'Reload'}</button
		>
	{/if}
{/await}
```

## Collection Store

Readable async Svelte store wrapper around an entire Pocketbase collection that updates in realtime.

- When running server-side, this store returns the "empty version" version of this store, i.e. an empty array.
- Create action received by the realtime subscription are added to the end of the returned store.
- When an action is received via the realtime subscription, `sortFunction` runs first, then `filterFunction` runs.
- This version of the collection store does not have pagination. Use `paginatedCollectionStore` if you want pagination.

### Simple Example

```svelte
<script lang="ts">
	import Pocketbase from 'pocketbase';
	import { safeLoad, collectionStore } from 'svelte-pocketbase-stores';

	const pocketbase = new Pocketbase(process.env.PB_URL);

	// If you use https://github.com/patmood/pocketbase-typegen, you should do `collectionStore<SomeRecordResponse>(Collections.SomeRecord)`.
	const { state, ...collection } = collectionStore(pocketbase.collection('test'));
</script>

{#await safeLoad(collection)}
	<p>Loading...</p>
{:then loadedSafely}
	{#if !loadedSafely}
		Something went wrong...
	{:else}
		<!-- This will now update in realtime. -->
		{#each $collection as record}
			<p>Record: '{record.id}'</p>
			<pre>{JSON.stringify(record, null, 2)}</pre>
		{/each}
		<button on:click={() => collection.reload()} disabled={$state.isReloading}
			>{$state.isReloading ? 'Reloading...' : 'Reload'}</button
		>
	{/if}
{/await}
```

### With Query Params

```svelte
<script lang="ts">
	import Pocketbase from 'pocketbase';
	import { safeLoad, collectionStore } from 'svelte-pocketbase-stores';

	const pocketbase = new Pocketbase(process.env.PB_URL);

	// If you wanted to sort, you can do so by adding `queryParams.sort` and `sortFunction`
	const { state, ...record } = collectionStore(pocketbase.collection('test'), {
		queryParams: { filter: 'verified = true' },
		filterFunction: (value, index, array) => value.verified
	});
</script>

{#await safeLoad(collection)}
	<p>Loading...</p>
{:then loadedSafely}
	{#if !loadedSafely}
		Something went wrong...
	{:else}
		<!-- This will now update in realtime. -->
		{#each $collection as record}
			<p>Record: '{record.id}'</p>
			<pre>{JSON.stringify(record, null, 2)}</pre>
		{/each}
		<button on:click={() => collection.reload()} disabled={$state.isReloading}
			>{$state.isReloading ? 'Reloading...' : 'Reload'}</button
		>
	{/if}
{/await}
```

### With SSR

When running server-side, this store returns the "empty version" version of this store, i.e. an empty array, and then executes normally client-side. So you could use it normally as shown in the previous examples, or you could fetch the collection server-side and pass it to `collectionStore`. When done so, `collectionStore` will skip the initial fetch and only create the realtime subscription client-side.

```typescript
// +page.server.ts or +page.ts
export async function load() {
	const pocketbase = new Pocketbase(process.env.PB_URL);

	return {
		initial: await collection.getFullList()
	};
}
```

```svelte
<!-- +page.svelte -->
<script lang="ts">
	import Pocketbase from 'pocketbase';
	import { safeLoad, collectionStore } from 'svelte-pocketbase-stores';
	import type { PageData } from './$types';

	export let data: PageData;

	const pocketbase = new Pocketbase(process.env.PB_URL);

	const { state, ...record } = collectionStore(pocketbase.collection('some_collection'), {
		initial: data.initial
	});
</script>

{#await safeLoad(record)}
	<p>Loading...</p>
{:then loadedSafely}
	{#if !loadedSafely}
		Something went wrong...
	{:else}
		<!-- This will now update in realtime -->
		<pre>{JSON.stringify($record, null, 2)}</pre>
		<button on:click={() => record.reload()} disabled={$state.isReloading}
			>{$state.isReloading ? 'Reloading...' : 'Reload'}</button
		>
	{/if}
{/await}
```

## Paginated Collection Store

Paginated readable async Svelte store wrapper around a Pocketbase collection that updates in realtime.

Notes:

- When running server-side, this store returns the "empty version" version of this store, i.e. an empty `ListResult` with `items` set to `[]`, `totalItems` and `totalPages` set to 0. `setPage`, `next`, and `prev` will also have no effects.
- Pagination is only applied when we first get the data and anytime the page number is updated. Pagination is not applied to the realtime subscription, which gets updates from the entire collection.
- When `setPage`, `next`, or `prev` is called, the returned store is reset to have only the items in the specified page.
- Create action received by the realtime subscription are added to the end of the returned store.
- When an action is received via the realtime subscription, `sortFunction` runs first, then `filterFunction` runs.
- This version of the collection store does not get the entire collection. Use `collectionStore` if you want the entire collection.

### Simple Example

```svelte
<script lang="ts">
	import Pocketbase from 'pocketbase';
	import { safeLoad, paginatedCollectionStore } from 'svelte-pocketbase-stores';

	const pocketbase = new Pocketbase(process.env.PB_URL);

	// If you use https://github.com/patmood/pocketbase-typegen, you should do `collectionStore<SomeRecordResponse>(Collections.SomeRecord)`.
	const { state, ...collection } = paginatedCollectionStore(pocketbase.collection('test'), {
		page: 1,
		perPage: 20
	});
</script>

{#await safeLoad(collection)}
	<p>Loading...</p>
{:then loadedSafely}
	{#if !loadedSafely}
		Something went wrong...
	{:else}
		<!-- This will now update in realtime. -->
		{#each $collection.items as record}
			<p>Record: '{record.id}'</p>
			<pre>{JSON.stringify(record, null, 2)}</pre>
		{/each}
		<p>Current page: {$collection.page}</p>
		<p>Items per page: {$collection.perPage}</p>
		<p>Total items: {$collection.totalItems}</p>
		<p>Total pages: {$collection.totalPages}</p>
		<button on:click={() => collection.next()}>Next Page</button>
		<button on:click={() => collection.prev()}>Previous Page</button>
		<button on:click={() => collection.reload()} disabled={$state.isReloading}
			>{$state.isReloading ? 'Reloading...' : 'Reload'}</button
		>
	{/if}
{/await}
```

### With Query Params

```svelte
<script lang="ts">
	import Pocketbase from 'pocketbase';
	import { safeLoad, paginatedCollectionStore } from 'svelte-pocketbase-stores';

	const pocketbase = new Pocketbase(process.env.PB_URL);

	// If you wanted to sort, you can do so by adding `queryParams.sort` and `sortFunction`
	const { state, ...record } = paginatedCollectionStore(pocketbase.collection('test'), {
		queryParams: { filter: 'verified = true' },
		filterFunction: (value, index, array) => value.verified
	});
</script>

{#await safeLoad(collection)}
	<p>Loading...</p>
{:then loadedSafely}
	{#if !loadedSafely}
		Something went wrong...
	{:else}
		<!-- This will now update in realtime. -->
		{#each $collection.items as record}
			<p>Record: '{record.id}'</p>
			<pre>{JSON.stringify(record, null, 2)}</pre>
		{/each}
		<p>Current page: {$collection.page}</p>
		<p>Items per page: {$collection.perPage}</p>
		<p>Total items: {$collection.totalItems}</p>
		<p>Total pages: {$collection.totalPages}</p>
		<button on:click={() => collection.next()}>Next Page</button>
		<button on:click={() => collection.prev()}>Previous Page</button>
		<button on:click={() => collection.reload()} disabled={$state.isReloading}
			>{$state.isReloading ? 'Reloading...' : 'Reload'}</button
		>
	{/if}
{/await}
```

### With SSR

When running server-side, this store returns the "empty version" version of this store, i.e. an empty `ListResult` with `items` set to `[]`, `totalItems` and `totalPages` set to 0. `setPage`, `next`, and `prev` will also have no effects, and then executes normally client-side. So you could use it normally as shown in the previous examples, or you could fetch the collection server-side and pass it to `paginatedCollectionStore`. When done so, `paginatedCollectionStore` will skip the initial fetch and only create the realtime subscription client-side.

```typescript
// +page.server.ts or +page.ts
export async function load() {
	const pocketbase = new Pocketbase(process.env.PB_URL);

	return {
		initial: await collection.getList(1, 20)
	};
}
```

```svelte
<!-- +page.svelte -->
<script lang="ts">
	import Pocketbase from 'pocketbase';
	import { safeLoad, paginatedCollectionStore } from 'svelte-pocketbase-stores';
	import type { PageData } from './$types';

	export let data: PageData;

	const pocketbase = new Pocketbase(process.env.PB_URL);

	const { state, ...record } = paginatedCollectionStore(pocketbase.collection('some_collection'), {
		initial: data.initial,
		page: 1,
		perPage: 20
	});
</script>

{#await safeLoad(record)}
	<p>Loading...</p>
{:then loadedSafely}
	{#if !loadedSafely}
		Something went wrong...
	{:else}
		<!-- This will now update in realtime -->
		<pre>{JSON.stringify($record, null, 2)}</pre>
		<button on:click={() => record.reload()} disabled={$state.isReloading}
			>{$state.isReloading ? 'Reloading...' : 'Reload'}</button
		>
	{/if}
{/await}
```
