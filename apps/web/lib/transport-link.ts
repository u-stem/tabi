type TransportLinkParams = {
  from: string;
  to: string;
  method?: string | null;
  date?: string;
  time?: string | null;
};

const GOOGLE_MAPS_SEARCH_URL = "https://www.google.com/maps/search/";
const YAHOO_TRANSIT_URL = "https://transit.yahoo.co.jp/search/result";
const GOOGLE_MAPS_DIR_URL = "https://www.google.com/maps/dir/";

export function buildMapsSearchUrl(address: string): string {
  return `${GOOGLE_MAPS_SEARCH_URL}?api=1&query=${encodeURIComponent(address)}`;
}

const GOOGLE_MAPS_METHODS = new Set(["walk", "car", "taxi"]);

const TRAVEL_MODE_MAP: Record<string, string> = {
  walk: "walking",
  car: "driving",
  taxi: "driving",
};

// Yahoo Transit transport filters per method
const YAHOO_METHOD_PARAMS: Record<string, Record<string, string>> = {
  shinkansen: { shin: "1" },
  bus: { hb: "1", lb: "1" },
  airplane: { al: "1" },
};

export function buildTransportUrl({
  from,
  to,
  method,
  date,
  time,
}: TransportLinkParams): string | null {
  if (!from || !to) return null;

  if (method && GOOGLE_MAPS_METHODS.has(method)) {
    return buildGoogleMapsUrl(from, to, TRAVEL_MODE_MAP[method]);
  }

  return buildYahooTransitUrl(from, to, method, date, time);
}

function buildGoogleMapsUrl(origin: string, destination: string, travelmode: string): string {
  const params = new URLSearchParams();
  params.set("api", "1");
  params.set("origin", origin);
  params.set("destination", destination);
  params.set("travelmode", travelmode);
  return `${GOOGLE_MAPS_DIR_URL}?${params.toString()}`;
}

function buildYahooTransitUrl(
  from: string,
  to: string,
  method: string | null | undefined,
  date: string | undefined,
  time: string | null | undefined,
): string {
  const params = new URLSearchParams();
  params.set("from", from);
  params.set("to", to);

  if (date) {
    const [y, m, d] = date.split("-");
    params.set("y", y);
    params.set("m", m);
    params.set("d", d);
  }

  if (time) {
    const [hh, mm] = time.split(":");
    params.set("hh", hh);
    params.set("m1", String(Math.floor(Number(mm) / 10)));
    params.set("m2", String(Number(mm) % 10));
    params.set("type", "1");
  }

  params.set("ticket", "ic");

  if (method && YAHOO_METHOD_PARAMS[method]) {
    for (const [key, val] of Object.entries(YAHOO_METHOD_PARAMS[method])) {
      params.set(key, val);
    }
  }

  return `${YAHOO_TRANSIT_URL}?${params.toString()}`;
}
