<script lang="ts">
	import { onMount } from 'svelte';
	import L from 'leaflet';
	import 'leaflet.vectorgrid';

	let mapElement = $state();
	let map = $state();

	onMount(() => {
		(async () => {
			const map = L.map(mapElement).setView([31.5272, 75.355], 10);

			// Optional basemap
			L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
				attribution: '&copy; OpenStreetMap contributors'
			}).addTo(map);

			// Vector tiles from pg_tileserv
			const url = 'http://localhost:7800/public.v_osm_points_named_notower/{z}/{x}/{y}.pbf';

			const points = L.vectorGrid
				.protobuf(url, {
					// Style is applied to the MVT sublayer named after your view
					vectorTileLayerStyles: {
						v_osm_points_named_notower: {
							// radius: 1, // point size
							weight: 1,
							opacity: 1,
							fill: false,
							fillOpacity: 1
						}
					},
					interactive: true,
					maxZoom: 14
				})
				.on('click', (e) => {
					const props = e.layer.properties || {};
					const n = props.name || '(no name)';
					L.popup().setLatLng(e.latlng).setContent(`<strong>${n}</strong>`).openOn(map);
				});

			points.addTo(map);
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
