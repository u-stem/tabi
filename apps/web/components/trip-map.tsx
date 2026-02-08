"use client";

import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import type { SpotResponse } from "@tabi/shared";

type TripMapProps = {
  spots: SpotResponse[];
};

// Fix default marker icon issue with webpack/turbopack
const defaultIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

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
