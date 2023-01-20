<script lang="ts">
	import Pocketbase from 'pocketbase';
	import { safeLoad, paginatedCollectionStore } from '$lib';

	const pocketbase = new Pocketbase('https://pocketbase.local');

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
