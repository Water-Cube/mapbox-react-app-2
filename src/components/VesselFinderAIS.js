// eslint-disable-next-line no-unused-vars
import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import mapboxgl from 'mapbox-gl';

const VesselFinderAIS = ({ map, isEnabled = false, toggleAisTracking, onLoadingChange }) => {
    const [vessels, setVessels] = useState([]);
    const [targetVessels, setTargetVessels] = useState([]);
    const [error, setError] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const API_KEY = 'WS-31F23A10-716D12';
    const API_BASE_URL = 'https://api.vesselfinder.com';
    
    // Update parent component when loading state changes
    useEffect(() => {
        if (onLoadingChange) {
            onLoadingChange(isLoading);
        }
    }, [isLoading, onLoadingChange]);

    // List of MMSI numbers to track - wrapped in useMemo to prevent dependency changes
    const TARGET_MMSIS = useMemo(() => [
        '205196000',
        '205210000',
        '205214000',
        '219033078',
        '219033078', // Duplicate, will be handled
        '245043000'
    ], []);
    
    // Set refresh interval to 5 minutes to avoid rate limiting
    const REFRESH_INTERVAL = 300000; // 5 minutes in milliseconds
    // Set to false to disable console logs
    const DEBUG_MODE = false;
    // Maximum number of retries for API calls
    const MAX_RETRIES = 3;
    // Initial delay between retries in milliseconds (will increase with exponential backoff)
    const INITIAL_RETRY_DELAY = 30000; // 30 seconds initial delay

    // Add refs to track the last fetch time and prevent duplicate calls
    const lastFetchTimeRef = useRef(0);
    const fetchCountRef = useRef(0);
    const intervalIdRef = useRef(null);
    const isMountedRef = useRef(true);
    const retryCountRef = useRef(0);
    const retryTimeoutRef = useRef(null);
    const vesselsAddedToListRef = useRef(false);
    const isRetryingRef = useRef(false);
    const listCheckedRef = useRef(false);

    // Helper function for conditional logging
    const log = useCallback((...args) => {
        if (DEBUG_MODE) {
            console.log(...args);
        }
    }, [DEBUG_MODE]);

    // Helper function to safely update state only if component is mounted
    const safeSetState = useCallback((setter, value) => {
        if (isMountedRef.current) {
            setter(value);
        }
    }, []);

    // Helper function to calculate exponential backoff delay
    const getRetryDelay = useCallback((retryCount) => {
        // Exponential backoff: 30s, 60s, 120s
        return Math.min(INITIAL_RETRY_DELAY * Math.pow(2, retryCount), 600000); // Max 10 minutes
    }, [INITIAL_RETRY_DELAY]);

    // Helper function to clear all timeouts and intervals
    const clearAllTimers = useCallback(() => {
        if (intervalIdRef.current) {
            clearInterval(intervalIdRef.current);
            intervalIdRef.current = null;
        }
        if (retryTimeoutRef.current) {
            clearTimeout(retryTimeoutRef.current);
            retryTimeoutRef.current = null;
        }
    }, []);

    // Helper function to handle API errors with retry logic
    const handleApiError = useCallback(async (error, retryFunction) => {
        console.error('API error:', error);
        
        // Check if it's a rate limit error
        const isRateLimit = error.message.includes('rate limit') || error.message.includes('Too frequent');
        
        // Only retry if we haven't exceeded the maximum retries and we're not already retrying
        if (retryCountRef.current < MAX_RETRIES && !isRetryingRef.current) {
            isRetryingRef.current = true;
            retryCountRef.current += 1;
            
            // For rate limit errors, use a longer fixed delay
            const delay = isRateLimit ? 
                Math.max(300000, getRetryDelay(retryCountRef.current)) : // At least 5 minutes for rate limits
                getRetryDelay(retryCountRef.current);
            
            log(`Retrying API call (${retryCountRef.current}/${MAX_RETRIES}) after ${delay/1000} seconds`);
            
            // Set error message for user
            safeSetState(setError, `Error: ${error.message}. Retrying in ${Math.round(delay/1000)} seconds...`);
            
            // Clear any existing retry timeout
            if (retryTimeoutRef.current) {
                clearTimeout(retryTimeoutRef.current);
            }
            
            // Set up retry timeout
            retryTimeoutRef.current = setTimeout(() => {
                if (isMountedRef.current) {
                    isRetryingRef.current = false;
                    retryFunction();
                }
            }, delay);
        } else {
            // Reset retry count and set final error
            retryCountRef.current = 0;
            isRetryingRef.current = false;
            const errorMessage = isRateLimit ? 
                'API rate limit exceeded. The application will automatically retry in 15 minutes.' :
                `Error fetching vessel data: ${error.message}. Please try again later.`;
            
            safeSetState(setError, errorMessage);
            safeSetState(setIsLoading, false);
            
            // If it's a rate limit error, set up a longer retry after 15 minutes
            if (isRateLimit) {
                // Clear any existing timers before setting new one
                clearAllTimers();
                
                // Set up new interval for future updates
                intervalIdRef.current = setTimeout(() => {
                    if (isMountedRef.current) {
                        retryCountRef.current = 0;
                        isRetryingRef.current = false;
                        retryFunction();
                    }
                }, REFRESH_INTERVAL);
            }
        }
    }, [safeSetState, log, MAX_RETRIES, getRetryDelay, REFRESH_INTERVAL, clearAllTimers]);

    // Helper function to check the current list of tracked vessels
    const checkTrackedVessels = useCallback(async () => {
        // Skip if we've already checked the list
        if (listCheckedRef.current) {
            log('List already checked, skipping');
            return true;
        }

        try {
            const listManagerUrl = `/listmanager?userkey=${API_KEY}&action=list`;
            log('Checking current list of tracked vessels');
            
            const listManagerResponse = await fetch(listManagerUrl, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json'
                }
            });
            
            if (!listManagerResponse.ok) {
                const errorText = await listManagerResponse.text();
                console.warn(`ListManager response not OK: ${listManagerResponse.status} - ${errorText}`);
                return false;
            }
            
            const listManagerData = await listManagerResponse.json();
            log('Current list of tracked vessels:', listManagerData);
            
            if (listManagerData.error) {
                console.warn(`Error checking tracked vessels: ${listManagerData.error}`);
                return false;
            }
            
            // Check if all target vessels are in the list
            const uniqueMmsis = [...new Set(TARGET_MMSIS)]; // Remove duplicates
            const trackedMmsis = listManagerData.mmsi || [];
            
            log(`Found ${trackedMmsis.length} vessels in tracking list`);
            
            const missingVessels = uniqueMmsis.filter(mmsi => !trackedMmsis.includes(mmsi));
            if (missingVessels.length > 0) {
                log(`Missing vessels from tracking list: ${missingVessels.join(', ')}`);
                // Reset the flag so we'll try to add them again
                vesselsAddedToListRef.current = false;
                return false;
            } else {
                log('All target vessels are in the tracking list');
                listCheckedRef.current = true;
                return true;
            }
        } catch (error) {
            console.error('Error checking tracked vessels:', error);
            return false;
        }
    }, [API_KEY, TARGET_MMSIS, log]);

    // Helper function to add vessels to the tracking list
    const addVesselsToList = useCallback(async () => {
        if (vesselsAddedToListRef.current) {
            log('Vessels already added to tracking list, skipping ListManager calls');
            return true;
        }

        const uniqueMmsis = [...new Set(TARGET_MMSIS)]; // Remove duplicates
        log(`Adding ${uniqueMmsis.length} unique vessels to tracking list`);
        
        try {
            // First check if vessels are already in the list
            const vesselsInList = await checkTrackedVessels();
            if (vesselsInList) {
                vesselsAddedToListRef.current = true;
                return true;
            }
            
            // If not, add them one by one
            for (const mmsi of uniqueMmsis) {
                const listManagerUrl = `/listmanager?userkey=${API_KEY}&action=add&mmsi=${mmsi}`;
                log(`Adding vessel ${mmsi} to tracked list`);
                
                try {
                    const listManagerResponse = await fetch(listManagerUrl, {
                        method: 'GET',
                        headers: {
                            'Accept': 'application/json'
                        }
                    });
                    
                    if (!listManagerResponse.ok) {
                        const errorText = await listManagerResponse.text();
                        console.warn(`ListManager response not OK for MMSI ${mmsi}: ${listManagerResponse.status} - ${errorText}`);
                        // Continue anyway, as the vessel might already be in the list
                    } else {
                        const listManagerData = await listManagerResponse.json();
                        log(`ListManager response for MMSI ${mmsi}:`, listManagerData);
                        
                        // Check if the vessel was successfully added
                        if (listManagerData.error) {
                            console.warn(`Error adding vessel ${mmsi}: ${listManagerData.error}`);
                        } else if (listManagerData.mmsi && listManagerData.mmsi.includes(mmsi)) {
                            log(`Vessel ${mmsi} successfully added to tracking list`);
                        } else {
                            log(`Vessel ${mmsi} may not have been added to tracking list`);
                        }
                    }

                    // Add a small delay between requests to avoid rate limiting
                    await new Promise(resolve => setTimeout(resolve, 1000));
                } catch (error) {
                    console.warn(`Error adding vessel ${mmsi} to tracked list:`, error);
                    // Continue with other vessels
                }
            }
            
            // Verify that all vessels are now in the list
            const vesselsAdded = await checkTrackedVessels();
            if (vesselsAdded) {
                vesselsAddedToListRef.current = true;
                return true;
            }
            
            return false;
        } catch (error) {
            console.error('Error adding vessels to list:', error);
            return false;
        }
    }, [API_KEY, TARGET_MMSIS, log, checkTrackedVessels]);

    // Fetch vessel data function
    const fetchVesselData = useCallback(async () => {
        // Skip if component is unmounted or not enabled
        if (!isMountedRef.current || !isEnabled) {
            log('Component unmounted or not enabled, skipping fetch');
            return;
        }
        
        // Check if we've fetched data recently
        const now = Date.now();
        const timeSinceLastFetch = now - lastFetchTimeRef.current;
        
        if (timeSinceLastFetch < REFRESH_INTERVAL) {
            log(`Skipping fetch - last fetch was ${Math.round(timeSinceLastFetch/1000)} seconds ago`);
            return;
        }
        
        // Prevent multiple simultaneous requests
        if (isLoading) {
            log('Already fetching data, skipping this request');
            return;
        }
        
        // Update the last fetch time
        lastFetchTimeRef.current = now;
        fetchCountRef.current += 1;
        
        log(`Fetch #${fetchCountRef.current} - Time since last fetch: ${Math.round(timeSinceLastFetch/1000)} seconds`);
        
        safeSetState(setIsLoading, true);
        safeSetState(setError, null);
        
        try {
            // First ensure vessels are in the tracking list
            if (!vesselsAddedToListRef.current) {
                await addVesselsToList();
            }
            
            // Now fetch the vessel data using VesselsList endpoint
            const vesselsListUrl = `/vesselslist?userkey=${API_KEY}&format=json`;
            log('VesselsList URL:', vesselsListUrl);
            
            const vesselsListResponse = await fetch(vesselsListUrl, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json'
                }
            });
            
            if (!vesselsListResponse.ok) {
                const errorText = await vesselsListResponse.text();
                throw new Error(`Failed to fetch vessel data: ${vesselsListResponse.status} - ${errorText}`);
            }
            
            const data = await vesselsListResponse.json();
            log('Vessel data received:', data);
            
            // Check for rate limiting error
            if (data.error === 'Too frequent requests!') {
                throw new Error('API rate limit exceeded. Please try again later.');
            }
            
            // Check for other API errors or limitations
            if (data.error) {
                log('API returned an error:', data.error);
                throw new Error(`API error: ${data.error}`);
            }
            
            // Log the total number of vessels in the response
            log(`Total vessels in API response: ${Array.isArray(data) ? data.length : 'Not an array'}`);
            
            // Process the data according to the API documentation
            if (Array.isArray(data) && data.length > 0) {
                const uniqueMmsis = [...new Set(TARGET_MMSIS)]; // Remove duplicates
                log('Looking for vessels with MMSIs:', uniqueMmsis);
                
                // Log all MMSIs in the response for debugging
                const allMmsis = data.map(v => v.AIS?.MMSI?.toString() || 'No MMSI').filter(Boolean);
                log('All MMSIs in response:', allMmsis);
                
                const foundVessels = data.filter(v => {
                    const hasAis = v.AIS && v.AIS.MMSI;
                    const mmsi = hasAis ? v.AIS.MMSI.toString() : null;
                    const isTarget = mmsi && uniqueMmsis.includes(mmsi);
                    
                    if (hasAis) {
                        log(`Found vessel with MMSI ${mmsi}:`, {
                            name: v.AIS.NAME,
                            hasPosition: !!(v.AIS.LATITUDE && v.AIS.LONGITUDE),
                            isTarget
                        });
                    }
                    
                    return isTarget;
                });
                
                log('Found target vessels:', foundVessels.length);
                
                if (foundVessels.length > 0) {
                    if (isMountedRef.current) {
                        safeSetState(setVessels, foundVessels);
                        safeSetState(setTargetVessels, foundVessels);
                        
                        // Center map on the first vessel if we have coordinates
                        const firstVessel = foundVessels[0];
                        if (map && firstVessel.AIS && firstVessel.AIS.LATITUDE && firstVessel.AIS.LONGITUDE) {
                            log(`Centering map on vessel at: ${firstVessel.AIS.LONGITUDE}, ${firstVessel.AIS.LATITUDE}`);
                            map.flyTo({
                                center: [firstVessel.AIS.LONGITUDE, firstVessel.AIS.LATITUDE],
                                zoom: 10,
                                speed: 1.5
                            });
                        }
                    }
                } else {
                    if (isMountedRef.current) {
                        // If no vessels found, we might need to re-add them to the list
                        vesselsAddedToListRef.current = false;
                        safeSetState(setError, `None of the target vessels were found in the response. Will re-add vessels to tracking list on next update.`);
                    }
                }
            } else {
                if (isMountedRef.current) {
                    safeSetState(setError, 'No vessel data available or invalid response format');
                }
            }
            
            // Reset retry count on success
            retryCountRef.current = 0;
        } catch (error) {
            // Handle API errors with retry logic
            handleApiError(error, fetchVesselData);
        } finally {
            if (isMountedRef.current) {
                safeSetState(setIsLoading, false);
            }
        }
    }, [map, isLoading, safeSetState, handleApiError, log, TARGET_MMSIS, API_KEY, REFRESH_INTERVAL, addVesselsToList, isEnabled]);

    // Set up the component
    useEffect(() => {
        // Set mounted flag
        isMountedRef.current = true;
        
        // Reset retry flags
        retryCountRef.current = 0;
        isRetryingRef.current = false;
        
        // Only fetch data if enabled
        if (isEnabled) {
            // Initial fetch with a small delay to avoid immediate rate limiting
            const initialFetchTimeout = setTimeout(() => {
                if (isMountedRef.current) {
                    fetchVesselData();
                }
            }, 1000);

            // Set up interval to fetch data every 5 minutes
            intervalIdRef.current = setInterval(fetchVesselData, REFRESH_INTERVAL);
            
            // Debug: Log when the component mounts and when the interval is set up
            console.log('VesselFinderAIS component mounted, interval set to', REFRESH_INTERVAL, 'ms');
            
            return () => {
                // Set unmounted flag
                isMountedRef.current = false;
                
                // Clear all timeouts and intervals
                clearAllTimers();
                clearTimeout(initialFetchTimeout);
                
                console.log('VesselFinderAIS component unmounted, all timers cleared');
            };
        }
        
        return () => {
            // Set unmounted flag
            isMountedRef.current = false;
            
            // Clear all timeouts and intervals
            clearAllTimers();
            
            console.log('VesselFinderAIS component unmounted, all timers cleared');
        };
    }, [fetchVesselData, REFRESH_INTERVAL, clearAllTimers, isEnabled]);

    // Update markers when vessels change
    useEffect(() => {
        if (!map || !isEnabled) return;

        // If tracking is disabled, remove all markers and return
        if (!isEnabled) {
            // Remove all vessel markers
            const existingMarkers = document.querySelectorAll('.vessel-marker');
            existingMarkers.forEach(marker => marker.remove());
            return;
        }

        // Skip if no vessels or tracking is disabled
        if (vessels.length === 0) return;

        // Remove existing vessel markers
        const existingMarkers = document.querySelectorAll('.vessel-marker');
        existingMarkers.forEach(marker => marker.remove());

        function addVesselMarkers() {
            // Remove any existing markers first
            const existingMarkers = document.querySelectorAll('.vessel-marker');
            existingMarkers.forEach(marker => marker.remove());

            vessels.forEach(vessel => {
                if (vessel.AIS && vessel.AIS.LATITUDE && vessel.AIS.LONGITUDE) {
                    // Get the vessel's course or heading for rotation
                    let rotation = 0;
                    if (vessel.AIS.COURSE !== undefined && vessel.AIS.COURSE !== null) {
                        rotation = vessel.AIS.COURSE;
                    } else if (vessel.AIS.HEADING !== undefined && vessel.AIS.HEADING !== null) {
                        rotation = vessel.AIS.HEADING;
                    }

                    // Create marker element
                    const el = document.createElement('div');
                    el.className = 'vessel-marker';
                    
                    // Assign color based on MMSI
                    const mmsi = vessel.AIS.MMSI.toString();
                    let color = '#007bff'; // Default blue
                    
                    if (mmsi === '205196000') color = '#ff0000'; // Red
                    else if (mmsi === '205210000') color = '#00ff00'; // Green
                    else if (mmsi === '205214000') color = '#ffff00'; // Yellow
                    else if (mmsi === '219033078') color = '#ff00ff'; // Magenta
                    else if (mmsi === '245043000') color = '#00ffff'; // Cyan

                    // Create the arrow SVG
                    el.innerHTML = `
                        <svg width="32" height="32" viewBox="0 0 24 24" style="transform: rotate(${rotation}deg);">
                            <path d="M12 2L4 20L12 14L20 20L12 2Z" fill="${color}"/>
                        </svg>
                    `;

                    // Create popup content
                    const popupContent = `
                        <div style="padding: 10px;">
                            <h3 style="margin: 0 0 10px 0;">${vessel.AIS.NAME || 'Unknown Vessel'}</h3>
                            <p><strong>MMSI:</strong> ${vessel.AIS.MMSI}</p>
                            <p><strong>IMO:</strong> ${vessel.AIS.IMO || 'N/A'}</p>
                            <p><strong>Speed:</strong> ${vessel.AIS.SPEED || 'N/A'} knots</p>
                            <p><strong>Course:</strong> ${vessel.AIS.COURSE || 'N/A'}°</p>
                            <p><strong>Heading:</strong> ${vessel.AIS.HEADING || 'N/A'}°</p>
                            <p><strong>Destination:</strong> ${vessel.AIS.DESTINATION || 'N/A'}</p>
                            <p><strong>Last Update:</strong> ${vessel.AIS.TIMESTAMP || 'N/A'}</p>
                        </div>
                    `;

                    // Create popup
                    const popup = new mapboxgl.Popup({
                        offset: 25,
                        closeButton: true,
                        closeOnClick: true
                    }).setHTML(popupContent);

                    // Add marker to map without popup
                    const marker = new mapboxgl.Marker({
                        element: el,
                        rotation: rotation
                    })
                    .setLngLat([vessel.AIS.LONGITUDE, vessel.AIS.LATITUDE])
                    .addTo(map);
                    
                    // Add click handler for vessel selection
                    el.addEventListener('click', () => {
                        // Convert AIS vessel data to GeoJSON feature format
                        const feature = {
                            type: 'Feature',
                            properties: {
                                mmsi: vessel.AIS.MMSI.toString(),
                                name: vessel.AIS.NAME || 'Unknown Vessel',
                                imo: vessel.AIS.IMO || 'N/A',
                                sog: vessel.AIS.SPEED || 0,
                                cog: vessel.AIS.COURSE || 0,
                                heading: vessel.AIS.HEADING || 0,
                                destination: vessel.AIS.DESTINATION || 'N/A',
                                timestamp: vessel.AIS.TIMESTAMP || new Date().toISOString(),
                                shipType: 'AIS Live Vessel',
                                aisSource: 'VesselFinder',
                                color: color
                            },
                            geometry: {
                                type: 'Point',
                                coordinates: [vessel.AIS.LONGITUDE, vessel.AIS.LATITUDE]
                            }
                        };
                        
                        // Dispatch vessel selection event
                        window.dispatchEvent(new CustomEvent('vesselSelected', { 
                            detail: feature 
                        }));
                    });
                }
            });
        }

        // Add the markers
        addVesselMarkers();
        
        // Cleanup function
        return () => {
            console.log('VesselFinderAIS unmounting');
            // Remove all vessel markers
            const existingMarkers = document.querySelectorAll('.vessel-marker');
            existingMarkers.forEach(marker => marker.remove());
        };
    }, [map, isEnabled, vessels]);

    // Add CSS for the vessel markers
    useEffect(() => {
        // Add CSS to head
        const style = document.createElement('style');
        style.textContent = `
            .vessel-marker {
                width: 32px;
                height: 32px;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            .vessel-marker svg {
                filter: drop-shadow(0 0 2px rgba(0,0,0,0.5));
            }
            .vessel-marker:hover svg {
                transform: scale(1.2);
                transition: transform 0.2s ease;
            }
        `;
        document.head.appendChild(style);

        // Cleanup
        return () => {
            document.head.removeChild(style);
        };
    }, []);

    // Only show the info panel if we have an error or vessel data and the component is enabled
    if (!isEnabled || (!error && targetVessels.length === 0)) return null;

    return (
        <div style={{
            position: 'absolute',
            top: '80px',
            right: '20px',
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            color: 'white',
            padding: '0',
            borderRadius: '8px',
            maxWidth: '250px',
            maxHeight: '60vh',
            overflowY: 'auto',
            zIndex: 1000,
            boxShadow: '0 2px 10px rgba(0,0,0,0.3)',
            fontSize: '12px'
        }}>
            <div style={{
                position: 'sticky',
                top: 0,
                backgroundColor: 'rgba(0, 0, 0, 0.8)',
                padding: '10px 10px 8px 10px',
                zIndex: 1001,
                borderBottom: '1px solid rgba(255,255,255,0.2)',
                boxShadow: '0 2px 5px rgba(0,0,0,0.3)'
            }}>
                <h3 style={{ margin: '0 0 8px 0', color: '#007bff', fontSize: '14px' }}>LIVE VESSELS</h3>
                {isLoading && <p style={{ color: '#ffcc00', fontSize: '12px' }}>Loading vessel data...</p>}
                {error ? (
                    <div style={{ color: '#ff6b6b', padding: '8px', backgroundColor: 'rgba(255,0,0,0.1)', borderRadius: '4px', fontSize: '12px' }}>
                        <p style={{ margin: 0 }}>{error}</p>
                    </div>
                ) : targetVessels.length > 0 ? (
                    <p style={{ marginBottom: '8px', fontSize: '12px' }}><strong>Tracking {targetVessels.length} vessels:</strong></p>
                ) : null}
            </div>
            
            {!error && targetVessels.length > 0 && (
                <div style={{ padding: '0 10px 10px 10px' }}>
                    {targetVessels.map((vessel, index) => {
                        if (!vessel.AIS) return null;
                        
                        // Assign different colors based on MMSI
                        const mmsi = vessel.AIS.MMSI.toString();
                        let color = '#007bff'; // Default blue
                        
                        if (mmsi === '205196000') color = '#ff0000'; // Red
                        else if (mmsi === '205210000') color = '#00ff00'; // Green
                        else if (mmsi === '205214000') color = '#ffff00'; // Yellow
                        else if (mmsi === '219033078') color = '#ff00ff'; // Magenta
                        else if (mmsi === '245043000') color = '#00ffff'; // Cyan
                        
                        return (
                            <div 
                                key={mmsi || index} 
                                style={{ 
                                    marginBottom: '10px',
                                    padding: '8px',
                                    backgroundColor: 'rgba(255,255,255,0.1)',
                                    borderRadius: '5px',
                                    borderLeft: `3px solid ${color}`,
                                    fontSize: '11px'
                                }}
                            >
                                <h4 style={{ margin: '0 0 3px 0', color: color, fontSize: '12px' }}>{vessel.AIS.NAME || 'Unknown Vessel'}</h4>
                                <p style={{ margin: '0 0 3px 0' }}><strong>MMSI:</strong> {vessel.AIS.MMSI}</p>
                                <p style={{ margin: '0 0 3px 0' }}><strong>IMO:</strong> {vessel.AIS.IMO || 'N/A'}</p>
                                <p style={{ margin: '0 0 3px 0' }}><strong>Position:</strong> {vessel.AIS.LATITUDE?.toFixed(4)}, {vessel.AIS.LONGITUDE?.toFixed(4)}</p>
                                <p style={{ margin: '0 0 3px 0' }}><strong>Speed:</strong> {vessel.AIS.SPEED || 'N/A'} knots</p>
                                <p style={{ margin: '0 0 3px 0' }}><strong>Course:</strong> {vessel.AIS.COURSE || 'N/A'}°</p>
                                <p style={{ margin: '0 0 3px 0' }}><strong>Heading:</strong> {vessel.AIS.HEADING || 'N/A'}°</p>
                                <p style={{ margin: '0 0 3px 0' }}><strong>Destination:</strong> {vessel.AIS.DESTINATION || 'N/A'}</p>
                                <p style={{ margin: '0 0 3px 0' }}><strong>Last Update:</strong> {vessel.AIS.TIMESTAMP || 'N/A'}</p>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default VesselFinderAIS; 