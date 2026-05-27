import type { CareBooking } from "../services/bookingService";
import type { CareLocation } from "../services/bookingService";

export type LocationResolution = {
  address: string;
  city: string;
  zone: string;
  latitude?: number;
  longitude?: number;
  source: "google-geocode" | "local-heuristic";
};

export type RouteEta = {
  ok: boolean;
  etaMinutes: number;
  distanceKm: number;
  distanceMeters: number;
  durationSeconds: number;
  encodedPolyline: string;
  decodedPath: CareLocation[];
  cacheSource: "redis" | "memory" | "fresh" | "none";
  source: "google-routes" | "distance-fallback";
  error?: string;
};

export const hasGeocodingConfig = Boolean(process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY);
export const hasGoogleRoutesConfig = Boolean(
  process.env.GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
);

const zoneFromText = (address: string) => {
  const value = address.toLowerCase();

  if (
    value.includes("whitefield") ||
    value.includes("marathahalli") ||
    value.includes("indiranagar") ||
    value.includes("kr puram")
  ) {
    return "East";
  }

  if (
    value.includes("rajajinagar") ||
    value.includes("malleshwaram") ||
    value.includes("yeshwanthpur") ||
    value.includes("hebbal")
  ) {
    return "North";
  }

  if (
    value.includes("jayanagar") ||
    value.includes("jp nagar") ||
    value.includes("banashankari") ||
    value.includes("basavanagudi")
  ) {
    return "South";
  }

  if (
    value.includes("vijayanagar") ||
    value.includes("nagarbhavi") ||
    value.includes("mysore road")
  ) {
    return "West";
  }

  return "Central";
};

const cityFromComponents = (
  components: Array<{ long_name: string; types: string[] }>
) => {
  const cityComponent = components.find((component) =>
    component.types.some((type) =>
      ["locality", "administrative_area_level_3", "postal_town"].includes(type)
    )
  );

  return cityComponent?.long_name || "Bengaluru";
};

const distanceKm = (from: CareLocation, to: CareLocation) => {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const earthKm = 6371;
  const dLat = toRad(to.lat - from.lat);
  const dLng = toRad(to.lng - from.lng);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(from.lat)) *
      Math.cos(toRad(to.lat)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  return Number((earthKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))).toFixed(2));
};

const routeMemoryCache = new Map<string, { route: RouteEta; expiresAt: number }>();
const routeCacheTtlSeconds = 60;
const routeCacheMaxEntries = 120;

const routeCacheKeyFor = (origin: CareLocation, destination: CareLocation) =>
  [
    "route",
    origin.lat.toFixed(5),
    origin.lng.toFixed(5),
    destination.lat.toFixed(5),
    destination.lng.toFixed(5)
  ].join(":");

const decodePolyline = (encoded = ""): CareLocation[] => {
  const points: CareLocation[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let shift = 0;
    let result = 0;
    let byte = 0;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    lat += result & 1 ? ~(result >> 1) : result >> 1;
    shift = 0;
    result = 0;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    lng += result & 1 ? ~(result >> 1) : result >> 1;
    points.push({
      lat: lat / 1e5,
      lng: lng / 1e5
    });
  }

  return points;
};

const redisRestConfig = () => {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.REDIS_REST_TOKEN;

  return url && token ? { url: url.replace(/\/$/, ""), token } : null;
};

const readRedisRoute = async (key: string): Promise<RouteEta | null> => {
  const config = redisRestConfig();
  if (!config) {
    return null;
  }

  try {
    const response = await fetch(`${config.url}/get/${encodeURIComponent(key)}`, {
      headers: {
        Authorization: `Bearer ${config.token}`
      },
      cache: "no-store"
    });
    const payload = (await response.json()) as { result?: string | null };
    return payload.result ? ({ ...JSON.parse(payload.result), cacheSource: "redis" } as RouteEta) : null;
  } catch {
    return null;
  }
};

const writeRedisRoute = async (key: string, route: RouteEta) => {
  const config = redisRestConfig();
  if (!config) {
    return;
  }

  try {
    await fetch(`${config.url}/set/${encodeURIComponent(key)}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        value: JSON.stringify({ ...route, cacheSource: "fresh" }),
        ex: routeCacheTtlSeconds
      }),
      cache: "no-store"
    });
  } catch {
    // Cache failure must not break care tracking.
  }
};

const readMemoryRoute = (key: string) => {
  const cached = routeMemoryCache.get(key);

  if (!cached) {
    return null;
  }

  if (cached.expiresAt < Date.now()) {
    routeMemoryCache.delete(key);
    return null;
  }

  return { ...cached.route, cacheSource: "memory" as const };
};

const writeMemoryRoute = (key: string, route: RouteEta) => {
  routeMemoryCache.set(key, {
    route: { ...route, cacheSource: "fresh" },
    expiresAt: Date.now() + routeCacheTtlSeconds * 1000
  });

  if (routeMemoryCache.size > routeCacheMaxEntries) {
    const oldestKey = routeMemoryCache.keys().next().value;
    if (oldestKey) {
      routeMemoryCache.delete(oldestKey);
    }
  }
};

const fallbackRouteEta = (
  origin: CareLocation,
  destination: CareLocation,
  error?: string
): RouteEta => {
  const kms = distanceKm(origin, destination);
  const etaMinutes = Math.max(3, Math.round(kms * 4 + 2));

  return {
    ok: !error,
    etaMinutes,
    distanceKm: kms,
    distanceMeters: Math.round(kms * 1000),
    durationSeconds: etaMinutes * 60,
    encodedPolyline: "",
    decodedPath: [origin, destination],
    cacheSource: "none",
    source: "distance-fallback",
    error
  };
};

const durationSecondsFromGoogle = (duration = "") => {
  const seconds = Number(duration.replace(/s$/i, ""));
  return Number.isFinite(seconds) ? Math.max(0, Math.round(seconds)) : 0;
};

export const computeRouteEta = async (
  origin: CareLocation,
  destination: CareLocation
): Promise<RouteEta> => {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const cacheKey = routeCacheKeyFor(origin, destination);
  const cachedRoute = readMemoryRoute(cacheKey) || (await readRedisRoute(cacheKey));

  if (cachedRoute) {
    return cachedRoute;
  }

  if (!apiKey) {
    return fallbackRouteEta(origin, destination, "Google Routes API key is not configured");
  }

  try {
    const response = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": "routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline"
      },
      body: JSON.stringify({
        origin: {
          location: {
            latLng: {
              latitude: origin.lat,
              longitude: origin.lng
            }
          }
        },
        destination: {
          location: {
            latLng: {
              latitude: destination.lat,
              longitude: destination.lng
            }
          }
        },
        travelMode: "DRIVE",
        routingPreference: "TRAFFIC_AWARE",
        computeAlternativeRoutes: false,
        languageCode: "en-IN",
        units: "METRIC"
      })
    });

    if (!response.ok) {
      return fallbackRouteEta(origin, destination, `Google Routes API returned ${response.status}`);
    }

    const payload = (await response.json()) as {
      routes?: Array<{
        duration?: string;
        distanceMeters?: number;
        polyline?: {
          encodedPolyline?: string;
        };
      }>;
    };
    const route = payload.routes?.[0];

    if (!route) {
      return fallbackRouteEta(origin, destination, "Google Routes API returned no route");
    }

    const durationSeconds = durationSecondsFromGoogle(route.duration);
    const distanceMeters = route.distanceMeters || fallbackRouteEta(origin, destination).distanceMeters;
    const etaMinutes = Math.max(1, Math.ceil((durationSeconds || 60) / 60));
    const encodedPolyline = route.polyline?.encodedPolyline || "";
    const decodedPath = encodedPolyline ? decodePolyline(encodedPolyline) : [origin, destination];

    const routeEta: RouteEta = {
      ok: true,
      etaMinutes,
      distanceKm: Number((distanceMeters / 1000).toFixed(2)),
      distanceMeters,
      durationSeconds,
      encodedPolyline,
      decodedPath,
      cacheSource: "fresh",
      source: "google-routes"
    };

    writeMemoryRoute(cacheKey, routeEta);
    await writeRedisRoute(cacheKey, routeEta);

    return routeEta;
  } catch (error) {
    return fallbackRouteEta(
      origin,
      destination,
      error instanceof Error ? error.message : "Google Routes API failed"
    );
  }
};

export const resolveLocation = async (address: string): Promise<LocationResolution> => {
  const fallback: LocationResolution = {
    address,
    city: "Bengaluru",
    zone: zoneFromText(address),
    source: "local-heuristic"
  };

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  if (!apiKey || !address.trim()) {
    return fallback;
  }

  try {
    const params = new URLSearchParams({
      address,
      key: apiKey
    });
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?${params.toString()}`
    );

    if (!response.ok) {
      return fallback;
    }

    const payload = (await response.json()) as {
      results?: Array<{
        formatted_address: string;
        address_components: Array<{ long_name: string; types: string[] }>;
        geometry: { location: { lat: number; lng: number } };
      }>;
      status?: string;
    };
    const result = payload.results?.[0];

    if (!result) {
      return fallback;
    }

    return {
      address: result.formatted_address || address,
      city: cityFromComponents(result.address_components),
      zone: zoneFromText(result.formatted_address || address),
      latitude: result.geometry.location.lat,
      longitude: result.geometry.location.lng,
      source: "google-geocode"
    };
  } catch {
    return fallback;
  }
};

export const enrichBookingLocation = async (booking: CareBooking) => {
  const address =
    booking.requestDetails?.location.detail ||
    booking.requestDetails?.location.label ||
    booking.matching.zone;
  const location = await resolveLocation(address);

  return {
    ...booking,
    matching: {
      ...booking.matching,
      city: location.city,
      zone: location.zone
    }
  };
};
