"use client";

import { useMapsLibrary } from "@vis.gl/react-google-maps";
import { useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";

type PlaceSelectResult = {
  formattedAddress: string;
  lat: number;
  lng: number;
  placeId: string;
  displayName: string;
};

type Props = {
  id?: string;
  defaultValue?: string;
  onPlaceSelect: (result: PlaceSelectResult) => void;
};

export function PlacesAutocompleteInput({ id, defaultValue, onPlaceSelect }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const placesLib = useMapsLibrary("places");

  useEffect(() => {
    if (!placesLib || !inputRef.current) return;

    const autocomplete = new placesLib.Autocomplete(inputRef.current, {
      fields: ["formatted_address", "geometry", "place_id", "name"],
    });

    const listener = autocomplete.addListener("place_changed", () => {
      const place = autocomplete.getPlace();
      if (!place.geometry?.location) return;
      onPlaceSelect({
        formattedAddress: place.formatted_address ?? "",
        lat: place.geometry.location.lat(),
        lng: place.geometry.location.lng(),
        placeId: place.place_id ?? "",
        displayName: place.name ?? "",
      });
    });

    return () => {
      listener.remove();
    };
  }, [placesLib, onPlaceSelect]);

  return (
    <Input
      ref={inputRef}
      id={id}
      name="address"
      defaultValue={defaultValue}
      placeholder="場所を検索..."
      onKeyDown={(e) => {
        // Prevent Enter from submitting the form — autocomplete consumes Enter
        // to select a suggestion, so the user must use the submit button.
        if (e.key === "Enter") e.preventDefault();
      }}
    />
  );
}
