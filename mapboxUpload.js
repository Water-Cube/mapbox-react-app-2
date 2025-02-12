// mapboxUpload.js
// This script demonstrates how to upload a TIFF file to Mapbox using the Uploads API.
// Install the required dependency with: npm install node-fetch

const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

// Replace these with your actual Mapbox credentials.
const MAPBOX_ACCESS_TOKEN = 'sk.eyJ1Ijoic2ltb252cCIsImEiOiJjbTZzczM1Y3kwOHJrMmpzZjFlNXUwOWNtIn0.449LWA2pOpadwlMduS9TJA';
const MAPBOX_USERNAME = 'simonvp'; // From your provided code snippet

/**
 * Step 1: Get temporary S3 credentials from Mapbox.
 */
async function getS3Credentials() {
  const credentialsUrl = `https://api.mapbox.com/uploads/v1/${MAPBOX_USERNAME}/credentials?access_token=${MAPBOX_ACCESS_TOKEN}`;
  const response = await fetch(credentialsUrl);
  if (!response.ok) {
    throw new Error(`Error fetching S3 credentials: ${response.statusText}`);
  }
  const credentials = await response.json();
  return credentials; // This includes a temporary S3 URL and other info.
}

/**
 * Step 2: Upload your file to the S3 URL provided by Mapbox.
 */
async function uploadFileToS3(s3Url, filePath) {
  const fileStream = fs.createReadStream(filePath);
  const stats = fs.statSync(filePath);
  const fileSizeInBytes = stats.size;

  // Only setting the Content-Length header so as not to conflict with the signed URL.
  const response = await fetch(s3Url, {
    method: 'PUT',
    body: fileStream,
    headers: {
      'Content-Length': fileSizeInBytes
    }
  });

  if (!response.ok) {
    const responseText = await response.text();
    throw new Error(`Error uploading file to S3: ${response.statusText}. Response body: ${responseText}`);
  }
  console.log('File uploaded to S3 successfully.');
  return true;
}

/**
 * Step 3: Create an upload job with Mapbox to convert the uploaded file into a tileset.
 *
 * @param {string} tilesetId - A unique ID for your new tileset.
 * @param {string} fileUrl - The URL of your uploaded file on S3.
 */
async function createUploadJob(tilesetId, fileUrl) {
  const uploadUrl = `https://api.mapbox.com/uploads/v1/${MAPBOX_USERNAME}?access_token=${MAPBOX_ACCESS_TOKEN}`;
  const body = {
    tileset: `${MAPBOX_USERNAME}.${tilesetId}`, // e.g., "simonvp.my_unique_tileset_id"
    url: fileUrl, // The S3 URL where the file was uploaded
    name: tilesetId
  };

  const response = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    throw new Error(`Error creating upload job: ${response.statusText}`);
  }
  const uploadJob = await response.json();
  console.log('Upload job created:', uploadJob);
  return uploadJob;
}

/**
 * Main function to run the upload process.
 */
(async () => {
  try {
    // Replace with the path to your TIFF file.
    const filePath = '/Users/mountainmedia/Desktop/Map V1.3 React 6 Feb 1639/mapbox-react-app/public/data/20180108_101339_ssc1d3_0013_visual_fixed.tif';

    // Choose a unique tileset ID for your new tileset.
    const tilesetId = 'my_unique_tileset_id';

    // Step 1: Get S3 credentials from Mapbox.
    const s3Credentials = await getS3Credentials();
    console.log('S3 credentials obtained:', s3Credentials);

    // Step 2: Upload your file to the provided S3 URL.
    await uploadFileToS3(s3Credentials.url, filePath);

    // Step 3: Create an upload job in Mapbox to process your file.
    const uploadJob = await createUploadJob(tilesetId, s3Credentials.url);

    // (Optional) You can implement polling here to wait for the job to complete.
    console.log(`Tileset creation initiated. Once complete, your tileset will be available at:`);
    console.log(`mapbox://${MAPBOX_USERNAME}.${tilesetId}`);
  } catch (error) {
    console.error('An error occurred during the upload process:', error);
  }
})();
