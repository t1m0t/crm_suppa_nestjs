<script lang="ts">
	import { onMount } from 'svelte';
	import L from 'leaflet';
	import 'leaflet.vectorgrid';

	let mapElement = $state();
	let map = $state();

	onMount(() => {
		(async () => {
			const map = L.map(mapElement).setView([31.5272, 75.355], 10);

			// Base map
			L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

			// MVT layer
			const mvtLayer = L.vectorGrid.protobuf('http://localhost:3000/tiles/{z}/{x}/{y}.mvt', {
				vectorTileLayerStyles: {
					'your-layer': {
						weight: 2,
						color: '#blue',
						fillOpacity: 0.7
					}
				},
				interactive: true
			});

			mvtLayer.addTo(map);
		})();

		return () => {
			if (map) {
				map.remove();
			}
		};
	});
</script>

<main>
	<div bind:this={mapElement}></div>
</main>
