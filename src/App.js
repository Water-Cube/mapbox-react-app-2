// App.js
import React, { useState, useEffect } from 'react'; // Added useEffect for event listeners
import styled from 'styled-components';
import MapboxExample from './components/map';
import SidePanel from './components/sidepanel';
import LoginPage from './components/LoginPage';
import 'bootstrap/dist/css/bootstrap.min.css';

const MapContainer = styled.div`
  position: relative;
  width: 100%;
  height: 100vh;
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

  const handleLocationSelect = (coordinates) => {
    setSelectedCoordinates(coordinates);
  };

  const handleLogin = (username) => {
    setUserId(username);
    setIsLoggedIn(true);
  };

  const togglePanel = () => {
    setIsPanelOpen((prev) => !prev);
  };

  const togglePaths = () => {
    setShowPaths((prev) => !prev);
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

  return (
    <div>
      {!isLoggedIn ? (
        <LoginPage onLogin={handleLogin} />
      ) : (
        <MapContainer>
          <MapboxExample
            selectedCoordinates={selectedCoordinates}
            userId={userId}
            onMapLoad={setMap}
            showPaths={showPaths} // Pass to MapboxExample
            togglePaths={togglePaths} // Pass to MapboxExample
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
          />
        </MapContainer>
      )}
    </div>
  );
};

export default App;