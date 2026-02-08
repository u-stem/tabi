type GeocodingResult = {
  latitude: number;
  longitude: number;
};

export async function geocode(address: string): Promise<GeocodingResult | null> {
  if (!address) return null;

  try {
    const params = new URLSearchParams({
      q: address,
      format: "json",
      limit: "1",
    });

    const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
      headers: {
        "User-Agent": "tabi-travel-app/1.0",
        Accept: "application/json",
      },
    });

    if (!res.ok) return null;

    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) return null;

    const { lat, lon } = data[0];
    return { latitude: Number(lat), longitude: Number(lon) };
  } catch {
    return null;
  }
}
