import L from 'leaflet';
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Circle,
  CircleMarker,
  useMap
} from 'react-leaflet';
import { useEffect } from 'react';

// Fix default marker icon
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

const FitToUserAndPins = ({
  userLocation,
  nearestPins,
  zoomOutLevels,
  fitWorld = false
}) => {
  const map = useMap();

  useEffect(() => {
    if (fitWorld) {
      map.setView([20, 0], 2, { animate: true });
      return;
    }

    if (!userLocation) return;

    const userLatLng = L.latLng(userLocation.lat, userLocation.lng);
    const farthestPinDistanceMeters = nearestPins.reduce((maxDistance, pin) => {
      const distance = userLatLng.distanceTo(L.latLng(pin.lat, pin.lng));
      return Math.max(maxDistance, distance);
    }, 0);

    // Keep the user at the center while still fitting the relevant nearby pins.
    const focusRadiusMeters = Math.max(450, farthestPinDistanceMeters * 1.25);
    const focusBounds = userLatLng.toBounds(focusRadiusMeters * 2);

    if (zoomOutLevels > 0) {
      map.once('moveend', () => {
        const nextZoom = Math.max(2, map.getZoom() - zoomOutLevels);
        map.setZoom(nextZoom, { animate: true });
      });
    }

    map.fitBounds(focusBounds, {
      padding: [52, 52],
      maxZoom: 20,
      animate: true
    });
  }, [fitWorld, map, nearestPins, userLocation, zoomOutLevels]);

  return null;
};

export const MapView = ({
  pins,
  filteredPins,
  userLocation,
  nearestPins,
  zoomOutLevels = 0,
  isEtherapyMode = false,
  etherapyPins = []
}) => {
  const visiblePins = isEtherapyMode
    ? etherapyPins
    : filteredPins.length > 0
      ? filteredPins
      : pins;

  const initialCenter = isEtherapyMode ? [20, 0] : [userLocation.lat, userLocation.lng];
  const initialZoom = isEtherapyMode ? 2 : 7;

  return (
    <MapContainer
      center={initialCenter}
      zoom={initialZoom}
      style={{ height: '100%', width: '100%' }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      <FitToUserAndPins
        userLocation={userLocation}
        nearestPins={nearestPins}
        zoomOutLevels={zoomOutLevels}
        fitWorld={isEtherapyMode}
      />

      {!isEtherapyMode && (
        <>
          <Circle
            center={[userLocation.lat, userLocation.lng]}
            radius={420}
            pathOptions={{ color: '#24686a', fillColor: '#2f9f93', fillOpacity: 0.1, weight: 2 }}
          />

          <CircleMarker
            center={[userLocation.lat, userLocation.lng]}
            radius={9}
            pathOptions={{ color: '#ffffff', fillColor: '#1f7a71', fillOpacity: 1, weight: 3 }}
          >
            <Popup>
              <div className="popup-content">
                <h3>Your location</h3>
                <p>Used to find your three nearest walkable options.</p>
              </div>
            </Popup>
          </CircleMarker>
        </>
      )}

      {/* Render filtered pins or all pins if none filtered */}
      {visiblePins.map((pin) => (
        <Marker key={pin.id} position={[pin.lat, pin.lng]}>
          <Popup>
            {isEtherapyMode ? (
              <div className="popup-content">
                <h3>Generic e-therapy service</h3>
                <p>Virtual care available online.</p>
                <p>Accessible from anywhere worldwide.</p>
              </div>
            ) : (
              <div className="popup-content">
                <h3>{pin.name}</h3>
                <p><strong>Type:</strong> {pin.type}</p>
                <p><strong>Address:</strong> {pin.address}</p>
                <p><strong>Phone:</strong> {pin.phone}</p>
                <p><strong>Specializations:</strong> {pin.specializations.join(', ')}</p>
                <p><strong>Insurance:</strong> {pin.acceptsInsurance ? 'Yes' : 'No'}</p>
                <p><strong>Hours:</strong> {pin.availability}</p>
                <p><strong>Rating:</strong> {'⭐'.repeat(Math.floor(pin.rating))} {pin.rating}</p>
              </div>
            )}
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
};
