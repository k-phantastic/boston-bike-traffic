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
    
    // Load Bluebikes traffic data
    let trips;
    try {
        const csvurl = 'https://dsc-courses.github.io/dsc209r-2025-fa/labs/lab07/data/bluebikes-traffic-2024-03.csv';
        trips = await d3.csv(csvurl); // Load CSV file asynchronously using D3.js
        console.log('Loaded Bluebikes Trips Data:', trips); // Log to verify structure
    } catch (error) {
        console.error('Error loading CSV:', error); // Handle errors
    }
    
    const departures = d3.rollup(
        trips,
        (v) => v.length,
        (d) => d.start_station_id,
    );
    console.log('Departures by Station ID:', departures);

    const arrivals = d3.rollup(
        trips,
        (v) => v.length,
        (d) => d.end_station_id,
    );
    console.log('Arrivals by Station ID:', arrivals);
    
    // Load Bluebikes station data from JSON, using d3 
    let jsonData; 
    try {
        const jsonurl = 'https://dsc-courses.github.io/dsc209r-2025-fa/labs/lab07/data/bluebikes-stations.json';
        // Await JSON fetch
        jsonData = await d3.json(jsonurl); // Load JSON file asynchronously using D3.js, jsonData holds loaded data
        console.log('Loaded JSON Data:', jsonData); // Log to verify structure
    } catch (error) { // Handle errors (e.g. file not found, CORS issues, incorrect JSON formatting)
        console.error('Error loading JSON:', error); // Handle errors
    }

    let stations = jsonData.data.stations; // Extract stations array from loaded JSON data

    const svg = d3.select('#map').select('svg'); // Select the SVG overlay within the map container

    // Function to convert station lon/lat to pixel coordinates on the map
    function getCoords(station) {
        const point = new mapboxgl.LngLat(+station.lon, +station.lat); // Convert lon/lat to Mapbox LngLat
        const { x, y } = map.project(point); // Project to pixel coordinates
        return { cx: x, cy: y }; // Return as object for use in SVG attributes
    }

    // Addition of arrivals, departures, and totalTraffic to each station object
    stations = stations.map((station) => {
        let id = station.short_name;
        station.arrivals = arrivals.get(id) ?? 0; // Default to 0 if no arrivals
        station.departures = departures.get(id) ?? 0; // Default to 0 if no departures
        station.totalTraffic = station.arrivals + station.departures;
        return station;
    });
    console.log('Stations Array:', stations);

    // Define a radius scale for circle sizes based on total traffic
    const radiusScale = d3
        .scaleSqrt()
        .domain([0, d3.max(stations, (d) => d.totalTraffic)])
        .range([0, 25]);

    // Append circles to the SVG for each station
    const circles = svg
        .selectAll('circle')
        .data(stations)
        .enter()
        .append('circle')
        .attr('r', (d) => radiusScale(d.totalTraffic)) // Radius of the circle based on total traffic
        .attr('fill', 'steelblue') // Circle fill color
        .attr('stroke', 'white') // Circle border color
        .attr('stroke-width', 1) // Circle border thickness
        .attr('opacity', 0.6) // Circle opacity
        .attr('pointer-events', 'auto') // Ensure circles can capture mouse events
        .each(function (d) {
            // Add <title> for browser tooltips
            d3.select(this)
                .append('title')
                .text(
                    `${d.totalTraffic} trips (${d.departures} departures, ${d.arrivals} arrivals) at ${d.name}`,
                );
        });

    // Function to update circle positions when the map moves/zooms
    function updatePositions() {
        circles
            .attr('cx', (d) => getCoords(d).cx) // Set the x-position using projected coordinates
            .attr('cy', (d) => getCoords(d).cy); // Set the y-position using projected coordinates
    }

    // Reposition markers on map interactions
    map.on('move', updatePositions); // Update during map movement
    map.on('zoom', updatePositions); // Update during zooming
    map.on('resize', updatePositions); // Update on window resize
    map.on('moveend', updatePositions); // Final adjustment after movement ends
});

// Reactivity 