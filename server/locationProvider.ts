import type { CareBooking } from "../services/bookingService";

export type LocationResolution = {
  address: string;
  city: string;
  zone: string;
  latitude?: number;
  longitude?: number;
  source: "google-geocode" | "local-heuristic";
};

export const hasGeocodingConfig = Boolean(process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY);

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
