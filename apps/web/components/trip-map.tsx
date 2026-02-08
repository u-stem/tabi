"use client";

import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import type { SpotResponse } from "@tabi/shared";

type TripMapProps = {
  spots: SpotResponse[];
};

// Fix default marker icon issue with webpack/turbopack
const defaultIcon = L.icon({
  iconUrl: "/leaflet/marker-icon.png",
  iconRetinaUrl: "/leaflet/marker-icon-2x.png",
  shadowUrl: "/leaflet/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

function FitBounds({ spots }: { spots: SpotResponse[] }) {
  const map = useMap();

  useEffect(() => {
    const validSpots = spots.filter(
      (s) => s.latitude != null && s.longitude != null,
    );
    if (validSpots.length === 0) return;

    const bounds = L.latLngBounds(
      validSpots.map(
        (s) => [Number(s.latitude), Number(s.longitude)] as L.LatLngTuple,
      ),
    );
    map.fitBounds(bounds, { padding: [50, 50] });
  }, [map, spots]);

  return null;
}

export function TripMapInner({ spots }: TripMapProps) {
  useEffect(() => {
    L.Marker.prototype.options.icon = defaultIcon;
  }, []);

  const validSpots = spots.filter(
    (s) => s.latitude != null && s.longitude != null,
  );

  const center: [number, number] =
    validSpots.length > 0
      ? [Number(validSpots[0].latitude), Number(validSpots[0].longitude)]
      : [35.6762, 139.6503];

  return (
    <MapContainer
      center={center}
      zoom={13}
      className="h-full w-full rounded-lg"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitBounds spots={spots} />
      {validSpots.map((spot) => (
        <Marker
          key={spot.id}
          position={[Number(spot.latitude), Number(spot.longitude)]}
        >
          <Popup>{spot.name}</Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
