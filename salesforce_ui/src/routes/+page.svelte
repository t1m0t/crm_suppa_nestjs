<script lang="ts">
	import { onMount } from 'svelte'
	import maplibregl from 'maplibre-gl'
	import 'maplibre-gl/dist/maplibre-gl.css'

	onMount(() => {
		const map = new maplibregl.Map({
			container: 'map', // container id
			style: {
				version: 8,
				sources: {
					'raster-tiles': {
						type: 'raster',
						tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
						tileSize: 256,
						minzoom: 0,
						maxzoom: 19,
					},
				},
				layers: [
					{
						id: 'simple-tiles',
						type: 'raster',
						source: 'raster-tiles',
					},
				],
			},
			center: [75.5717, 31.6881], // example: Bangalore
			zoom: 10,
		})
		map.addControl(new maplibregl.NavigationControl(), 'top-right')
		map.on('load', () => {
			map.addSource('my_pgtileserv_source', {
				type: 'vector',
				tiles: [
					'http://localhost:7800/public.v_osm_points_named_notower/{z}/{x}/{y}.pbf',
				],
				minzoom: 0,
				maxzoom: 22,
			})
			map.addLayer({
				id: 'my_pgtileserv_layer',
				type: 'circle',
				source: 'my_pgtileserv_source',
				'source-layer': 'public.v_osm_points_named_notower',
				// paint: {
				// 	'circle-color': 'blue',
				// 	'circle-radius': 3,
				// },
			})
		})
	})
</script>

<main>
	<div
		id="map"
		style="position: absolute; top: 0; bottom: 0; width: 100%; height: 70%;"
	></div>
</main>
