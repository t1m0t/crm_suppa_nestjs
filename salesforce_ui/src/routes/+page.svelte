<script lang="ts">
import { onMount } from "svelte";
import maplibregl, {
	FullscreenControl,
	type GeoJSONFeature,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { dev } from "$app/environment";
import {
	PUBLIC_RASTER_TILE_URL,
	PUBLIC_SOURCE_LAYER_ADM5,
	PUBLIC_SOURCE_LAYER_PIND,
	PUBLIC_TILE_URL_BASE,
} from "$env/static/public";

let mapPopup: maplibregl.Popup | null = $state(null);

onMount(() => {
	const map = new maplibregl.Map({
		container: "map",
		attributionControl: false,
		style: {
			version: 8,
			sources: {
				"raster-tiles": {
					type: "raster",
					tiles: [`${PUBLIC_RASTER_TILE_URL}/{z}/{x}/{y}.png`],
					tileSize: 256,
					minzoom: 0,
					maxzoom: 19,
				},
			},
			layers: [
				{
					id: "simple-tiles",
					type: "raster",
					source: "raster-tiles",
				},
			],
		},
		center: [75.5717, 31.6881],
		zoom: 10,
	});
	map.addControl(new maplibregl.NavigationControl(), "top-right");
	map.dragRotate.disable();
	const mapHtmlElement = document.getElementById("map");
	if (mapHtmlElement) {
		map.addControl(new FullscreenControl({ container: mapHtmlElement }));
	}

	map.on("load", () => {
		// admin_5_source
		map.addSource("admin_5_source", {
			type: "vector",
			tiles: [
				`${PUBLIC_TILE_URL_BASE}/${PUBLIC_SOURCE_LAYER_ADM5}/{z}/{x}/{y}.pbf`,
			],
			minzoom: 0,
			maxzoom: 22,
		});
		map.addLayer({
			id: "admin_5_layer",
			type: "fill",
			source: "admin_5_source",
			"source-layer": PUBLIC_SOURCE_LAYER_ADM5,
			paint: {
				"fill-outline-color": "green",
				"fill-color": "rgba(0, 255, 0, 0.1)",
			},
		}); // Add below pind points layer

		// pind_points_source
		map.addSource("pind_points_source", {
			type: "vector",
			tiles: [
				`${PUBLIC_TILE_URL_BASE}/${PUBLIC_SOURCE_LAYER_PIND}/{z}/{x}/{y}.pbf`,
			],
			minzoom: 0,
			maxzoom: 22,
		});
		map.addLayer(
			{
				id: "pind_points_layer",
				type: "circle",
				source: "pind_points_source",
				"source-layer": PUBLIC_SOURCE_LAYER_PIND,
				paint: {
					"circle-color": "blue",
					"circle-radius": 3,
					"circle-opacity": 0.5,
				},
			},
			"admin_5_layer",
		);

		// Change cursor when hovering (optional but nice UX)
		map.on("mouseenter", "pind_points_layer", () => {
			map.getCanvas().style.cursor = "pointer";
		});

		map.on("mouseleave", "pind_points_layer", () => {
			map.getCanvas().style.cursor = "";
		});

		map.on("click", "pind_points_layer", (e) => {
			// e.features is an array of features at the click point
			const feature: GeoJSONFeature | undefined = e.features?.[0];
			if (!feature) return;

			// All attributes from your vector tile are here:
			dev && console.log("Clicked feature:", feature);
			dev && console.log("Properties:", feature.properties);

			// Example: show a popup with some properties
			// @ts-expect-error
			const coordinates = feature.geometry.coordinates.slice();
			const props = feature.properties;

			// Build some HTML from properties (adapt to your schema)
			const html = `
				<div class="text-gray-700">
					<strong>Town: ${props.name ?? "Not provided"}</strong><br>
				</div>
  			`;

			mapPopup = new maplibregl.Popup()
				.setLngLat(coordinates)
				.setHTML(html)
				.addTo(map);
		});

		map.on("click", "admin_5_layer", (e) => {
			// Check if there are any features on the pind_points_layer at this click location
			const pointFeatures = map.queryRenderedFeatures(e.point, {
				layers: ["pind_points_layer"],
			});

			// Only show admin layer popup if no points are at this location
			if (pointFeatures.length > 0) return;

			// e.features is an array of features at the click point
			const feature = e.features?.[0];
			if (!feature) return;

			// All attributes from your vector tile are here:
			dev && console.log("Clicked feature:", feature);
			dev && console.log("Properties:", feature.properties);

			// Example: show a popup with some properties
			const props = feature.properties;

			// Build some HTML from properties (adapt to your schema)
			const html = `
				<div class="text-gray-700">
					<strong>Admin Level: ${props.admin_level ?? "Not provided"}</strong><br>
					<strong>Name: ${props.name ?? "Not provided"}</strong><br>
				</div>
  			`;

			mapPopup = new maplibregl.Popup()
				.setLngLat(e.lngLat)
				.setHTML(html)
				.addTo(map);
		});
	});
});

window.addEventListener("keydown", (e) => {
	if (e.key === "Escape" && mapPopup) {
		mapPopup.remove();
		mapPopup = null;
	}
});
</script>

<main>
	<div
		id="map"
		style="position: absolute; top: 0; bottom: 0; width: 100%; height: auto;"
	></div>
</main>
