// Import d3 
import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';

// Import Mapbox as an ESM module
import mapboxgl from 'https://cdn.jsdelivr.net/npm/mapbox-gl@2.15.0/+esm';

// Check that Mapbox GL JS is loaded
console.log('Mapbox GL JS Loaded:', mapboxgl);

// Set your Mapbox access token here
mapboxgl.accessToken = 'pk.eyJ1Ijoia2hwMDIzIiwiYSI6ImNsZWYzcTR5MzAxeGUzdmxtbnQ1a2t2dnUifQ.yTrF0fs0tk_okMdYY31sYQ';

// Initialize the map
const map = new mapboxgl.Map({
    container: 'map', // ID of the div where the map will render
    style: 'mapbox://styles/mapbox/light-v10', // Map style
    // style: 'mapbox://styles/khp023/cmhsc2swr009b01suaq5j8hvm', // Custom style URL (commented out)
    center: [-71.09415, 42.36027], // [longitude, latitude] for Boston, MA
    zoom: 12, // Initial zoom level 
    minZoom: 5, // Minimum allowed zoom
    maxZoom: 18, // Maximum allowed zoom
});

// Define styling for the bike route layers
const routeStyling = {
    'line-color': '#5bb450',
    'line-width': 3,
    'line-opacity': 0.4,
};

map.on('load', async () => { // Ensure JSON data is loaded after the map is ready
    
    // Add Boston bike routes and layer to the map
    map.addSource('boston_route', { // 'boston_route' is the source ID, can be any string
        type: 'geojson',
        data: 'https://bostonopendata-boston.opendata.arcgis.com/datasets/boston::existing-bike-network-2022.geojson'
    });
    map.addLayer({ // Add a line layer to visualize the bike routes
        id: 'bike-lanes',
        type: 'line', // Line layer type, can be 'fill', 'circle', 'symbol' etc.
        source: 'boston_route',
        paint: routeStyling,
    });
    
    // Add Cambridge bike routes and layer to the map
    map.addSource('cambridge_route', {
        type: 'geojson',
        data: 'https://raw.githubusercontent.com/cambridgegis/cambridgegis_data/main/Recreation/Bike_Facilities/RECREATION_BikeFacilities.geojson'
    });
    map.addLayer({
        id: 'cambridge-bike-lanes',
        type: 'line', // Line layer type, can be 'fill', 'circle', 'symbol' etc.
        source: 'cambridge_route',
        paint: routeStyling,
    });
    console.log('Bike routes layers added to the map.');

    // Load Bluebikes station data from JSON, using d3 
    let jsonData; 
    try {
        const jsonurl = 'https://dsc-courses.github.io/dsc209r-2025-fa/labs/lab07/data/bluebikes-stations.json';
        // Await JSON fetch
        const jsonData = await d3.json(jsonurl); // Load JSON file asynchronously using D3.js, jsonData holds loaded data
        console.log('Loaded JSON Data:', jsonData); // Log to verify structure
    } catch (error) { // Handle errors (e.g. file not found, CORS issues, incorrect JSON formatting)
        console.error('Error loading JSON:', error); // Handle errors
    }
    // let stations = jsonData.data.stations;
    // console.log('Stations Array:', stations);
});