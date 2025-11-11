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
    
    // Filter the data to trips that started/ended within 1 hour before or after selected time
    let departuresByMinute = Array.from({ length: 1440 }, () => []);
    let arrivalsByMinute = Array.from({ length: 1440 }, () => []);

    // Load Bluebikes traffic data, converting date strings to Date objects
    let trips = await d3.csv(
        'https://dsc106.com/labs/lab07/data/bluebikes-traffic-2024-03.csv',
        (trip) => {
            trip.started_at = new Date(trip.started_at);
            trip.ended_at = new Date(trip.ended_at);
            
            // Populate departuresByMinute and arrivalsByMinute for efficient time filtering
            let startedMinutes = minutesSinceMidnight(trip.started_at);
            //This function returns how many minutes have passed since `00:00` (midnight).
            departuresByMinute[startedMinutes].push(trip);
            //This adds the trip to the correct index in `departuresByMinute` so that later we can efficiently retrieve all trips that started at a specific time.
            let endedMinutes = minutesSinceMidnight(trip.ended_at);
            arrivalsByMinute[endedMinutes].push(trip);

            return trip;
        },
    );

    function filterByMinute(tripsByMinute, minute) {
        if (minute === -1) {
            return tripsByMinute.flat(); // No filtering, return all trips
        }

        // Normalize both min and max minutes to the valid range [0, 1439]
        let minMinute = (minute - 60 + 1440) % 1440;
        let maxMinute = (minute + 60) % 1440;

        // Handle time filtering across midnight
        if (minMinute > maxMinute) {
            let beforeMidnight = tripsByMinute.slice(minMinute);
            let afterMidnight = tripsByMinute.slice(0, maxMinute);
            return beforeMidnight.concat(afterMidnight).flat();
        } else {
            return tripsByMinute.slice(minMinute, maxMinute).flat();
        }
    }

    // Compute station traffic from trips data
    function computeStationTraffic(stations, timeFilter = -1) {
        // Compute departures
        const departures = d3.rollup(
            filterByMinute(departuresByMinute, timeFilter), // Efficient retrieval,
            (v) => v.length,
            (d) => d.start_station_id,
        );
        const arrivals = d3.rollup(
            filterByMinute(arrivalsByMinute, timeFilter), // Efficient retrieval,
            (v) => v.length,
            (d) => d.end_station_id,
        );

        // Update each station..
        return stations.map((station) => {
            let id = station.short_name;
            station.arrivals = arrivals.get(id) ?? 0; // Default to 0 if no arrivals
            station.departures = departures.get(id) ?? 0; // Default to 0 if no departures
            station.totalTraffic = station.arrivals + station.departures;
            return station;
        });
    }
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

    const stations = computeStationTraffic(jsonData.data.stations); // Extract stations array from loaded JSON data

    const svg = d3.select('#map').select('svg'); // Select the SVG overlay within the map container

    // Function to convert station lon/lat to pixel coordinates on the map
    function getCoords(station) {
        const point = new mapboxgl.LngLat(+station.lon, +station.lat); // Convert lon/lat to Mapbox LngLat
        const { x, y } = map.project(point); // Project to pixel coordinates
        return { cx: x, cy: y }; // Return as object for use in SVG attributes
    }

    // Define a radius scale for circle sizes based on total traffic
    const radiusScale = d3
        .scaleSqrt()
        .domain([0, d3.max(stations, (d) => d.totalTraffic)])
        .range([0, 25]);

    // Append circles to the SVG for each station
    const circles = svg
        .selectAll('circle')
        .data(stations, (d) => d.short_name) // Use station short_name as the key
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

    // Reactivity for time slider
    const timeSlider = document.getElementById('time-slider');
    const selectedTime = document.getElementById('selected-time');
    const anyTimeLabel = document.getElementById('any-time');
    let timeFilter = -1; // Initialize time filter variable


    // Update scatter plot based on time filter, updates whenever slider value changes
    function updateScatterPlot(timeFilter) {
        // Get only the trips that match the selected time filter 
        const filteredStations = computeStationTraffic(stations, timeFilter);

        // Adjust radius scale range based on whether a time filter is applied
        // If no filtering is applied (-1), circle sizes default to [0, 25]; if filtering is applied, min/max is [03, 50]
        timeFilter === -1 ? radiusScale.range([0, 25]) : radiusScale.range([3, 50]);

        // Define a quantize scale for station flow (not used directly here but can be useful for color coding)
        let stationFlow = d3.scaleQuantize().domain([0, 1]).range([0, 0.5, 1]);
        
        // Update the scatterplot by adjusting the radius of circles based on filtered data
        circles
            .data(filteredStations, (d) => d.short_name) // Ensure D3 tracks elements correctly
            .join('circle') // Ensure the data is bound correctly
            .style('--departure-ratio', (d) => stationFlow(d.departures / d.totalTraffic))
            .attr('r', (d) => radiusScale(d.totalTraffic)); // Update circle sizes
    }
    // Update time display based on slider value
    function updateTimeDisplay() {
        timeFilter = Number(timeSlider.value); // Get slider value

        if (timeFilter === -1) {
            selectedTime.textContent = ''; // Clear time display
            anyTimeLabel.style.display = 'block'; // Show "(any time)"
        } else {
            selectedTime.textContent = formatTime(timeFilter); // Display formatted time
            anyTimeLabel.style.display = 'none'; // Hide "(any time)"
        }
        // Call updateScatterPlot to reflect changes on the map
        updateScatterPlot(timeFilter);
    }
    // Listen for input changes on the time slider, call function to update display
    timeSlider.addEventListener('input', updateTimeDisplay);
    updateTimeDisplay();

});

// Helper function to format minutes since midnight into HH:MM AM/PM
function formatTime(minutes) {
    const date = new Date(0, 0, 0, 0, minutes); // Set hours & minutes
    return date.toLocaleString('en-US', { timeStyle: 'short' }); // Format as HH:MM AM/PM
}

// Helper function to determine minutes since midnight
function minutesSinceMidnight(date) {
    return date.getHours() * 60 + date.getMinutes();
}


