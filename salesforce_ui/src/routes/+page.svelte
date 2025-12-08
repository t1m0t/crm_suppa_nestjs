<script lang="ts">
	import { onMount } from 'svelte'
	import maplibregl, { FullscreenControl } from 'maplibre-gl'
	import 'maplibre-gl/dist/maplibre-gl.css'
	import { dev } from '$app/environment'

	onMount(() => {
		const map = new maplibregl.Map({
			container: 'map',
			attributionControl: false,
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
			center: [75.5717, 31.6881],
			zoom: 10,
		})
		map.addControl(new maplibregl.NavigationControl(), 'top-right')
		map.dragRotate.disable()
		map.addControl(
			new FullscreenControl({ container: document.querySelector('body') })
		)

		map.on('load', () => {
			// admin_5_source
			map.addSource('admin_5_source', {
				type: 'vector',
				tiles: [
					'http://localhost:3030/tiles/public.v_osm_polygons_admin_5/{z}/{x}/{y}.pbf',
				],
				minzoom: 0,
				maxzoom: 22,
			})
			map.addLayer({
				id: 'admin_5_layer',
				type: 'fill',
				source: 'admin_5_source',
				'source-layer': 'public.v_osm_polygons_admin_5',
				paint: {
					'fill-outline-color': 'green',
					'fill-color': 'rgba(0, 255, 0, 0.1)',
				},
			}) // Add below pind points layer

			// pind_points_source
			map.addSource('pind_points_source', {
				type: 'vector',
				tiles: [
					'http://localhost:3030/tiles/public.v_osm_points_pinds/{z}/{x}/{y}.pbf',
				],
				minzoom: 0,
				maxzoom: 22,
			})
			map.addLayer(
				{
					id: 'pind_points_layer',
					type: 'circle',
					source: 'pind_points_source',
					'source-layer': 'public.v_osm_points_pinds',
					paint: {
						'circle-color': 'blue',
						'circle-radius': 3,
						'circle-opacity': 0.5,
					},
				},
				'admin_5_layer'
			)

			// Change cursor when hovering (optional but nice UX)
			map.on('mouseenter', 'pind_points_layer', () => {
				map.getCanvas().style.cursor = 'pointer'
			})

			map.on('mouseleave', 'pind_points_layer', () => {
				map.getCanvas().style.cursor = ''
			})

			map.on('click', 'pind_points_layer', (e) => {
				// e.features is an array of features at the click point
				const feature = e.features && e.features[0]
				if (!feature) return

				// All attributes from your vector tile are here:
				dev && console.log('Clicked feature:', feature)
				dev && console.log('Properties:', feature.properties)

				// Example: show a popup with some properties
				const coordinates = feature.geometry.coordinates.slice()
				const props = feature.properties

				// Build some HTML from properties (adapt to your schema)
				const html = `
				<div class="text-gray-700">
					<strong>Town: ${props.name ?? 'Not provided'}</strong><br>
				</div>
  			`

				new maplibregl.Popup().setLngLat(coordinates).setHTML(html).addTo(map)
			})

			map.on('click', 'admin_5_layer', (e) => {
				// Check if there are any features on the pind_points_layer at this click location
				const pointFeatures = map.queryRenderedFeatures(e.point, {
					layers: ['pind_points_layer'],
				})

				// Only show admin layer popup if no points are at this location
				if (pointFeatures.length > 0) return

				// e.features is an array of features at the click point
				const feature = e.features && e.features[0]
				if (!feature) return

				// All attributes from your vector tile are here:
				dev && console.log('Clicked feature:', feature)
				dev && console.log('Properties:', feature.properties)

				// Example: show a popup with some properties
				const props = feature.properties

				// Build some HTML from properties (adapt to your schema)
				const html = `
				<div class="text-gray-700">
					<strong>Admin Level: ${props.admin_level ?? 'Not provided'}</strong><br>
					<strong>Name: ${props.name ?? 'Not provided'}</strong><br>
				</div>
  			`

				new maplibregl.Popup().setLngLat(e.lngLat).setHTML(html).addTo(map)
			})
		})
	})
</script>

<main>
	<div
		id="map"
		style="position: absolute; top: 0; bottom: 0; width: 100%; height: auto;"
	></div>
</main>
