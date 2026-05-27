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

    return {
      ok: true,
      etaMinutes,
      distanceKm: Number((distanceMeters / 1000).toFixed(2)),
      distanceMeters,
      durationSeconds,
      encodedPolyline: route.polyline?.encodedPolyline || "",
      source: "google-routes"
    };
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
