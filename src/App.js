// App.js
import React, { useState } from 'react';
import styled from 'styled-components';
import MapboxExample from './map';
import SidePanel from './components/sidepanel3';
import LoginPage from './components/LoginPage';

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
  const [map, setMap] = useState(null); // To hold the Mapbox map instance

  const handleLocationSelect = (coordinates) => {
    setSelectedCoordinates(coordinates);
  };

  const handleLogin = (username) => {
    setUserId(username); // The username becomes the userId
    setIsLoggedIn(true);
  };

  const togglePanel = () => {
    setIsPanelOpen((prev) => !prev);
  };

  return (
    <div>
      {!isLoggedIn ? (
        <LoginPage onLogin={handleLogin} />
      ) : (
        <MapContainer>
          {/* Pass onMapLoad so that MapboxExample can update the parent's state */}
          <MapboxExample 
            selectedCoordinates={selectedCoordinates} 
            userId={userId} 
            onMapLoad={setMap} 
          />
          {/* Pass the map instance to the side panel */}
          <SidePanel
            onLocationSelect={handleLocationSelect}
            isOpen={isPanelOpen}
            togglePanel={togglePanel}
            userId={userId}
            map={map}
          />
        </MapContainer>
      )}
    </div>
  );
};

export default App;
