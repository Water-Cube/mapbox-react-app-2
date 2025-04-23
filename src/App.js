// App.js
import React, { useState, useEffect } from 'react'; // Added useEffect for event listeners
import styled from 'styled-components';
import MapboxExample from './components/map';
import SidePanel from './components/sidepanel';
import LoginPage from './components/LoginPage';
import 'bootstrap/dist/css/bootstrap.min.css';
import { TimelineProvider } from './context/TimelineContext';
import Timeline from './components/Timeline';

const MapContainer = styled.div`
  position: relative;
  width: 100%;
  height: 100vh;
`;

const TimelineWrapper = styled.div`
  position: fixed;
  bottom: 40px;
  left: 400px;
  right: 40px;
  z-index: 1;
  pointer-events: none;
`;

const TimelineContainer = styled.div`
  pointer-events: auto;
`;

const App = () => {
  const [selectedCoordinates, setSelectedCoordinates] = useState(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userId, setUserId] = useState(null);
  const [isPanelOpen, setIsPanelOpen] = useState(true);
  const [map, setMap] = useState(null);
  const [aisMarkers, setAisMarkers] = useState({ active: [], all: [] }); // Added for AIS markers
  const [selectedVessel, setSelectedVessel] = useState(null); // Added for vessel selection
  const [showPaths, setShowPaths] = useState(false); // Added for path visibility
  const [isAisEnabled, setIsAisEnabled] = useState(false); // Added for AIS tracking state
  const [availableDates, setAvailableDates] = useState([]);
  const [userData, setUserData] = useState(null);

  const handleLocationSelect = (coordinates) => {
    setSelectedCoordinates(coordinates);
  };

  const handleLogin = (username) => {
    setUserId(username);
    setIsLoggedIn(true);
    
    // Fetch user data after login
    fetch('data/users/femern@email.com.json')
      .then(response => response.json())
      .then(data => {
        setUserData(data);
        
        // Get all dates from tilesets
        const dates = [];
        if (data.areas) {
          data.areas.forEach(area => {
            if (area.tilesets) {
              area.tilesets.forEach(tileset => {
                if (tileset.date) {
                  // Just get the date part (YYYY-MM-DD)
                  const dateOnly = tileset.date.split('T')[0];
                  dates.push(dateOnly);
                }
              });
            }
          });
        }
        console.log('Timeline Dates Found:', dates);
        setAvailableDates(dates);
      })
      .catch(error => console.error('Error loading data:', error));
  };

  const togglePanel = () => {
    setIsPanelOpen((prev) => !prev);
  };

  const togglePaths = () => {
    setShowPaths((prev) => !prev);
  };

  const toggleAisTracking = (enabled) => {
    setIsAisEnabled(enabled);
  };

  // Added event listeners for AIS markers and vessel selection
  useEffect(() => {
    const handleAisMarkersUpdated = (e) => {
      setAisMarkers(e.detail);
    };
    const handleVesselSelected = (e) => {
      setSelectedVessel(e.detail);
    };

    window.addEventListener('aisMarkersUpdated', handleAisMarkersUpdated);
    window.addEventListener('vesselSelected', handleVesselSelected);

    return () => {
      window.removeEventListener('aisMarkersUpdated', handleAisMarkersUpdated);
      window.removeEventListener('vesselSelected', handleVesselSelected);
    };
  }, []);

  // Function to format date from tileset
  const formatDateFromTileset = (dateStr) => {
    const cleanDateStr = dateStr.replace(/Z|[+-]\d{2}:\d{2}$/, '');
    const date = new Date(cleanDateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <TimelineProvider>
      <div className="App">
        {!isLoggedIn ? (
          <LoginPage onLogin={handleLogin} />
        ) : (
          <MapContainer>
            <MapboxExample
              selectedCoordinates={selectedCoordinates}
              userId={userId}
              onMapLoad={setMap}
              showPaths={showPaths}
              togglePaths={togglePaths}
              isAisEnabled={isAisEnabled}
              toggleAisTracking={toggleAisTracking}
            />
            <SidePanel
              onLocationSelect={handleLocationSelect}
              isOpen={isPanelOpen}
              togglePanel={togglePanel}
              userId={userId}
              map={map}
              aisMarkers={aisMarkers} // Pass to SidePanel
              selectedVessel={selectedVessel} // Pass to SidePanel
              setSelectedVessel={setSelectedVessel} // Pass to SidePanel
              showPaths={showPaths} // Pass to SidePanel
              togglePaths={togglePaths} // Pass to SidePanel
              isAisEnabled={isAisEnabled}
              toggleAisTracking={toggleAisTracking}
              userData={userData}
            />
            <TimelineWrapper>
              <TimelineContainer>
                <Timeline availableDates={availableDates} />
              </TimelineContainer>
            </TimelineWrapper>
          </MapContainer>
        )}
      </div>
    </TimelineProvider>
  );
};

export default App;