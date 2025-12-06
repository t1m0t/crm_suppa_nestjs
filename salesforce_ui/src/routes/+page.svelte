<script lang="ts">
	import { onMount } from 'svelte';
	import maplibregl from 'maplibre-gl';
	import 'maplibre-gl/dist/maplibre-gl.css';

	onMount(() => {
		const map = new maplibregl.Map({
			container: 'map', // container id
			style: {
					'version': 8,
					'sources': {
						'raster-tiles': {
							'type': 'raster',
							'tiles': ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
							'tileSize': 256,
							'minzoom': 0,
							'maxzoom': 19
						}
					},
					'layers': [
						{
							'id': 'simple-tiles',
							'type': 'raster',
							'source': 'raster-tiles',
						}
					],
				},
			center: [31.5272, 75.355], // starting position [lng, lat]
			zoom: 10 // starting zoom
		});

	map.addSource('some id', {
		type: 'vector',
		tiles: ['http://localhost:3030/tiles/{z}/{x}/{y}.mvt'],
		minzoom: 6,
		maxzoom: 14
});

	});
</script>

<main>
	<div id="map" style="width: 100%; height: 400px;"></div>
</main>
