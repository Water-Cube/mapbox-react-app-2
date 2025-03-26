const fs = require('fs');
const Papa = require('papaparse');

// Path to your CSV file
const csvFilePath = './public/data/ais_data/femeren_fleet_aisdk-2025-03-21_11_45_filtered.csv';
// Path to save the GeoJSON file
const geojsonFilePath = './public/data/ais_data/femeren_fleet_aisdk-2025-03-21_11_45_filtered.json';

// Function to convert CSV to GeoJSON
const csvToGeoJSON = (csvData) => {
  const features = csvData
    .filter((row) => row.Latitude && row.Longitude) // Ensure valid coordinates
    .map((row) => ({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [parseFloat(row.Longitude), parseFloat(row.Latitude)],
      },
      properties: {
        timestamp: row.Timestamp,
        mmsi: row.MMSI,
        name: row.Name,
        shipType: row['Ship type'],
        status: row['Navigational status'],
        sog: row.SOG,
        cog: row.COG,
        destination: row.Destination,
        eta: row.ETA,
      },
    }));
  return {
    type: 'FeatureCollection',
    features,
  };
};

// Read the CSV file
const csvText = fs.readFileSync(csvFilePath, 'utf8');

// Parse the CSV and convert to GeoJSON
Papa.parse(csvText, {
  header: true,
  skipEmptyLines: true,
  complete: (result) => {
    const geojson = csvToGeoJSON(result.data);
    // Write the GeoJSON to a file
    fs.writeFileSync(geojsonFilePath, JSON.stringify(geojson, null, 2), 'utf8');
    console.log(`GeoJSON file saved to ${geojsonFilePath}`);
  },
  error: (error) => {
    console.error('Error parsing CSV:', error);
  },
});