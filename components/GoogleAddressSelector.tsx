"use client";

import { useEffect, useRef, useState } from "react";
import { GoogleMap, Libraries, MarkerF, useJsApiLoader } from "@react-google-maps/api";
import { LocateFixed, MapPinned, Search } from "lucide-react";
import { Button } from "./ui/button";

export type SelectedAddress = {
  label: string;
  detail: string;
  latitude?: number;
  longitude?: number;
  placeId?: string;
};

type GoogleAddressSelectorProps = {
  selectedAddress?: SelectedAddress;
  onSelect: (address: SelectedAddress) => void;
};

type GeocodeResponse = {
  location?: {
    address: string;
    latitude?: number;
    longitude?: number;
  };
};

const googleMapsLibraries: Libraries = ["places"];
const bengaluruCenter = { lat: 12.9716, lng: 77.5946 };

const shortAddressLabel = (value: string) => {
  const firstPart = value.split(",")[0]?.trim();
  return firstPart || "Selected care location";
};

export function GoogleAddressSelector({ selectedAddress, onSelect }: GoogleAddressSelectorProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [manualAddress, setManualAddress] = useState(selectedAddress?.detail || "");
  const [lookupBusy, setLookupBusy] = useState(false);
  const [lookupMessage, setLookupMessage] = useState("");
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";
  const mapId = process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID || "";
  const { isLoaded, loadError } = useJsApiLoader({
    id: "lderly-address-selector",
    googleMapsApiKey: apiKey,
    libraries: googleMapsLibraries,
    preventGoogleFontsLoading: true
  });

  const selectedPosition =
    typeof selectedAddress?.latitude === "number" && typeof selectedAddress?.longitude === "number"
      ? {
          lat: selectedAddress.latitude,
          lng: selectedAddress.longitude
        }
      : bengaluruCenter;

  useEffect(() => {
    if (!isLoaded || loadError || !inputRef.current || !window.google?.maps?.places) {
      return;
    }

    const autocomplete = new window.google.maps.places.Autocomplete(inputRef.current, {
      componentRestrictions: { country: "in" },
      fields: ["formatted_address", "geometry", "name", "place_id"]
    });

    const listener = autocomplete.addListener("place_changed", () => {
      const place = autocomplete.getPlace();
      const detail = place.formatted_address || place.name || inputRef.current?.value || "";
      const location = place.geometry?.location;

      if (!detail) {
        return;
      }

      setManualAddress(detail);
      onSelect({
        label: shortAddressLabel(detail),
        detail,
        latitude: location?.lat(),
        longitude: location?.lng(),
        placeId: place.place_id
      });
      setLookupMessage("Address selected. We will use this for caregiver matching and ETA.");
    });

    return () => {
      window.google.maps.event.removeListener(listener);
    };
  }, [isLoaded, loadError, onSelect]);

  const useManualAddress = async () => {
    const address = manualAddress.trim();

    if (!address) {
      setLookupMessage("Enter the care address first.");
      return;
    }

    setLookupBusy(true);
    setLookupMessage("");

    try {
      const response = await fetch("/api/locations/geocode", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ address })
      });
      const payload = response.ok ? ((await response.json()) as GeocodeResponse) : null;
      const resolved = payload?.location;
      const detail = resolved?.address || address;

      onSelect({
        label: shortAddressLabel(detail),
        detail,
        latitude: resolved?.latitude,
        longitude: resolved?.longitude
      });
      setManualAddress(detail);
      setLookupMessage(
        resolved?.latitude && resolved.longitude
          ? "Address verified on map."
          : "Address saved. We could not verify exact map coordinates yet."
      );
    } catch {
      onSelect({
        label: shortAddressLabel(address),
        detail: address
      });
      setLookupMessage("Address saved. Map verification can be completed by ops if needed.");
    } finally {
      setLookupBusy(false);
    }
  };

  return (
    <div className="rounded-[1.5rem] border border-white/10 bg-white/10 p-3">
      <div className="flex items-center gap-2 text-sm font-semibold text-emerald-100">
        <MapPinned className="h-4 w-4" />
        Search exact care location
      </div>
      <div className="mt-3 flex items-center gap-2 rounded-2xl bg-white px-3 py-2 text-[#06130f]">
        <Search className="h-4 w-4 shrink-0 text-slate-400" />
        <input
          ref={inputRef}
          value={manualAddress}
          onChange={(event) => setManualAddress(event.target.value)}
          placeholder="Search home, hospital, clinic, or lab address"
          className="min-h-10 w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
        />
      </div>
      <Button
        type="button"
        onClick={useManualAddress}
        disabled={lookupBusy}
        className="mt-3 w-full rounded-2xl bg-emerald-300 text-[#06130f] hover:bg-emerald-200 disabled:cursor-wait disabled:bg-white/30"
      >
        <LocateFixed className="mr-2 h-4 w-4" />
        {lookupBusy ? "Checking address..." : "Use this address"}
      </Button>
      {lookupMessage && <p className="mt-3 text-xs leading-5 text-white/60">{lookupMessage}</p>}
      {!apiKey && (
        <p className="mt-3 text-xs leading-5 text-amber-100">
          Google Maps key is not configured. Manual address entry still works.
        </p>
      )}
      {loadError && (
        <p className="mt-3 text-xs leading-5 text-amber-100">
          Google Places could not load. Check Maps JavaScript and Places API restrictions.
        </p>
      )}
      {isLoaded && selectedAddress?.latitude && selectedAddress.longitude && (
        <div className="mt-3 overflow-hidden rounded-2xl border border-white/10">
          <GoogleMap
            mapContainerStyle={{ width: "100%", height: "180px" }}
            center={selectedPosition}
            zoom={15}
            options={{
              disableDefaultUI: true,
              gestureHandling: "greedy",
              mapId: mapId || undefined,
              zoomControl: true
            }}
          >
            <MarkerF position={selectedPosition} />
          </GoogleMap>
        </div>
      )}
    </div>
  );
}
