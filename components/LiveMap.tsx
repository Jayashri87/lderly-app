"use client";

import { ReactNode, useEffect, useMemo, useRef, useState } from "react";
import {
  GoogleMap,
  Libraries,
  PolylineF,
  useGoogleMap,
  useJsApiLoader
} from "@react-google-maps/api";
import { AlertTriangle, MapPinned, Navigation } from "lucide-react";
import { CareJourney } from "../services/journeyService";

type LiveMapProps = {
  journey: CareJourney | null;
};

type RouteEtaResponse = {
  route?: {
    etaMinutes: number;
    distanceKm: number;
    distanceMeters: number;
    durationSeconds: number;
    encodedPolyline: string;
    source: "google-routes" | "distance-fallback";
  };
};

const defaultCenter = {
  lat: 12.9783,
  lng: 77.6023
};

const googleMapsLibraries: Libraries = ["marker"];

const formatCoord = (value: number) => value.toFixed(4);

const decodePolyline = (encoded = ""): google.maps.LatLngLiteral[] => {
  const points: google.maps.LatLngLiteral[] = [];
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

const interpolateLocation = (
  from: google.maps.LatLngLiteral,
  to: google.maps.LatLngLiteral,
  progress: number
) => ({
  lat: from.lat + (to.lat - from.lat) * progress,
  lng: from.lng + (to.lng - from.lng) * progress
});

const useAnimatedLocation = (target: google.maps.LatLngLiteral) => {
  const [position, setPosition] = useState(target);
  const positionRef = useRef(target);
  const startedAtRef = useRef(0);

  useEffect(() => {
    const from = positionRef.current;
    const to = {
      lat: target.lat,
      lng: target.lng
    };
    startedAtRef.current = Date.now();
    let frame = 0;

    const tick = () => {
      const progress = Math.min(1, (Date.now() - startedAtRef.current) / 900);
      const nextPosition = interpolateLocation(from, to, progress);
      positionRef.current = nextPosition;
      setPosition(nextPosition);

      if (progress < 1) {
        frame = window.requestAnimationFrame(tick);
      }
    };

    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [target.lat, target.lng]);

  return position;
};

const useRouteEta = (journey: CareJourney | null) => {
  const [route, setRoute] = useState<{
    etaMinutes: number;
    distanceKm: number;
    encodedPolyline: string;
    source: "google-routes" | "distance-fallback";
    updatedAt: number;
  } | null>(null);
  const originLat = journey?.caretakerLocation?.lat;
  const originLng = journey?.caretakerLocation?.lng;
  const destinationLat = journey?.customerLocation?.lat;
  const destinationLng = journey?.customerLocation?.lng;
  const status = journey?.status;

  useEffect(() => {
    if (
      typeof originLat !== "number" ||
      typeof originLng !== "number" ||
      typeof destinationLat !== "number" ||
      typeof destinationLng !== "number"
    ) {
      return;
    }

    let cancelled = false;
    const activeTracking = ["accepted", "en_route", "arrived", "in_progress"].includes(
      status || ""
    );
    const refreshMs = activeTracking ? 15_000 : 45_000;
    const origin = {
      lat: originLat,
      lng: originLng
    };
    const destination = {
      lat: destinationLat,
      lng: destinationLng
    };

    const refresh = async () => {
      const response = await fetch("/api/locations/route-eta", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          origin,
          destination
        })
      }).catch(() => null);

      if (!response?.ok || cancelled) {
        return;
      }

      const payload = (await response.json()) as RouteEtaResponse;
      if (!payload.route || cancelled) {
        return;
      }

      setRoute({
        etaMinutes: payload.route.etaMinutes,
        distanceKm: payload.route.distanceKm,
        encodedPolyline: payload.route.encodedPolyline,
        source: payload.route.source,
        updatedAt: Date.now()
      });
    };

    refresh();
    const interval = window.setInterval(refresh, refreshMs);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [
    destinationLat,
    destinationLng,
    originLat,
    originLng,
    status
  ]);

  return route;
};

const locationFreshnessFor = (journey: CareJourney | null) => {
  const timestamp = journey?.lastLocationAt || journey?.updatedAt || 0;

  if (!timestamp) {
    return {
      label: "Location pending",
      tone: "bg-amber-300/20 text-amber-100",
      stale: true
    };
  }

  const ageMinutes = Math.max(0, Math.round((Date.now() - timestamp) / 60000));
  const activeTracking = ["accepted", "en_route", "arrived", "in_progress"].includes(
    journey?.status || ""
  );
  const stale = activeTracking && ageMinutes > 5;

  return {
    label:
      ageMinutes <= 0
        ? "Location just now"
        : `${stale ? "GPS stale" : "GPS fresh"} ${ageMinutes}m ago`,
    tone: stale ? "bg-red-500/25 text-red-100" : "bg-emerald-300/20 text-emerald-100",
    stale
  };
};

const routeMoodFor = (journey: CareJourney | null) => {
  const eta = journey?.eta ?? 0;
  const status = journey?.status || "idle";

  if (status === "arrived" || status === "in_progress") {
    return {
      label: status === "in_progress" ? "Care in progress" : "Caregiver has arrived",
      tone: "bg-emerald-300 text-[#06130f]",
      pulse: "bg-emerald-300"
    };
  }

  if (status === "en_route" && eta > 0 && eta <= 3) {
    return {
      label: "Arriving soon",
      tone: "bg-amber-300 text-[#06130f]",
      pulse: "bg-amber-300"
    };
  }

  if (status === "en_route" || status === "accepted") {
    return {
      label: "Live tracking",
      tone: "bg-blue-300 text-[#06130f]",
      pulse: "bg-blue-300"
    };
  }

  return {
    label: "Tracking ready",
    tone: "bg-white/15 text-white",
    pulse: "bg-white/70"
  };
};

function GoogleLiveMap({ journey }: LiveMapProps) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";
  const mapId = process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID || "DEMO_MAP_ID";
  const { isLoaded, loadError } = useJsApiLoader({
    id: "lderly-google-map",
    googleMapsApiKey: apiKey,
    libraries: googleMapsLibraries,
    preventGoogleFontsLoading: true
  });

  const customerLocation = journey?.customerLocation ?? defaultCenter;
  const caretakerLocation =
    journey?.caretakerLocation ?? {
      lat: defaultCenter.lat + 0.01,
      lng: defaultCenter.lng + 0.01
    };
  const animatedCaretakerLocation = useAnimatedLocation(caretakerLocation);
  const liveRoute = useRouteEta(journey);
  const encodedPolyline = liveRoute?.encodedPolyline || journey?.routePolyline || "";
  const routePath = useMemo(() => decodePolyline(encodedPolyline), [encodedPolyline]);
  const displayEta = liveRoute?.etaMinutes ?? journey?.eta ?? 0;
  const routeSource = liveRoute?.source || journey?.routeSource || "distance-fallback";
  const center = {
    lat: (customerLocation.lat + animatedCaretakerLocation.lat) / 2,
    lng: (customerLocation.lng + animatedCaretakerLocation.lng) / 2
  };

  if (loadError || !isLoaded) {
    return (
      <MapFrame
        journey={journey}
        mode={loadError ? "Fallback Map" : "Google Maps Loading"}
        reason={
          loadError
            ? "Google Maps did not load. Check API restrictions and Maps JavaScript API."
            : "Loading Google Maps script."
        }
      >
        <FallbackVisual journey={journey} />
      </MapFrame>
    );
  }

  return (
    <MapFrame journey={journey} mode="Google Maps" reason="Live map active.">
      <GoogleMap
        mapContainerClassName="h-full w-full"
        center={center}
        zoom={13}
        options={{
          disableDefaultUI: true,
          clickableIcons: false,
          gestureHandling: "greedy",
          mapId
        }}
      >
        <AdvancedMapMarker
          position={customerLocation}
          title={journey?.destinationLabel || "Care location"}
          label="Home"
          tone="home"
        />
        <AdvancedMapMarker
          position={animatedCaretakerLocation}
          title={journey?.caretakerName || "Caretaker"}
          label="Care"
          tone="caretaker"
        />
        <PolylineF
          path={routePath.length > 1 ? routePath : [animatedCaretakerLocation, customerLocation]}
          options={{
            strokeColor: "#60a5fa",
            strokeOpacity: 0.9,
            strokeWeight: 4
          }}
        />
      </GoogleMap>
      <MapOverlay journey={journey} eta={displayEta} routeSource={routeSource} />
    </MapFrame>
  );
}

function AdvancedMapMarker({
  position,
  title,
  label,
  tone
}: {
  position: google.maps.LatLngLiteral;
  title: string;
  label: string;
  tone: "home" | "caretaker";
}) {
  const map = useGoogleMap();
  const markerRef = useRef<google.maps.marker.AdvancedMarkerElement | null>(null);
  const content = useMemo(() => {
    const wrapper = document.createElement("div");
    wrapper.className = "relative flex h-10 w-10 items-center justify-center";

    if (tone === "caretaker") {
      const pulse = document.createElement("span");
      pulse.className =
        "absolute h-10 w-10 animate-ping rounded-full bg-blue-300/35";
      wrapper.appendChild(pulse);
    }

    const pin = document.createElement("span");
    pin.className = `relative flex h-8 min-w-8 items-center justify-center rounded-full border-2 border-white px-2 text-[10px] font-bold text-slate-950 shadow-xl transition-transform duration-700 ${
      tone === "home" ? "bg-emerald-300" : "bg-blue-300"
    }`;
    pin.textContent = label;
    wrapper.appendChild(pin);

    return wrapper;
  }, [label, tone]);

  useEffect(() => {
    if (!map) {
      return;
    }

    markerRef.current = new google.maps.marker.AdvancedMarkerElement({
      map,
      content,
      position,
      title
    });

    return () => {
      if (markerRef.current) {
        markerRef.current.map = null;
        markerRef.current = null;
      }
    };
  }, [content, map, position, title]);

  useEffect(() => {
    if (markerRef.current) {
      markerRef.current.position = position;
      markerRef.current.title = title;
    }
  }, [position, title]);

  return null;
}

function MapOverlay({
  journey,
  eta,
  routeSource
}: LiveMapProps & {
  eta?: number;
  routeSource?: "google-routes" | "distance-fallback";
}) {
  const freshness = locationFreshnessFor(journey);
  const routeMood = routeMoodFor(journey);
  const sourceLabel = routeSource === "google-routes" ? "Live route" : "Distance ETA";

  return (
    <div className="pointer-events-none absolute inset-x-3 top-3 flex items-center justify-between gap-3">
      <div className="rounded-full border border-white/10 bg-[#050816]/75 px-3 py-2 text-xs backdrop-blur-md">
        {journey?.destinationLabel || "Patient Home"}
      </div>
      <div className="flex items-center gap-2">
        <div className={`flex items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold backdrop-blur-md ${routeMood.tone}`}>
          <span className={`h-2 w-2 rounded-full ${routeMood.pulse}`} />
          {routeMood.label}
        </div>
        <div className={`rounded-full px-3 py-2 text-xs backdrop-blur-md ${freshness.tone}`}>
          {freshness.label}
        </div>
        <div className="rounded-full border border-white/10 bg-[#050816]/75 px-3 py-2 text-xs backdrop-blur-md">
          ETA {eta ?? journey?.eta ?? 0} min
        </div>
        <div className="hidden rounded-full border border-white/10 bg-[#050816]/75 px-3 py-2 text-xs backdrop-blur-md sm:block">
          {sourceLabel}
        </div>
      </div>
    </div>
  );
}

function MapFrame({
  children,
  journey,
  mode,
  reason
}: LiveMapProps & {
  children: ReactNode;
  mode: string;
  reason: string;
}) {
  const customerLocation = journey?.customerLocation ?? defaultCenter;
  const caretakerLocation =
    journey?.caretakerLocation ?? {
      lat: defaultCenter.lat + 0.01,
      lng: defaultCenter.lng + 0.01
  };
  const freshness = locationFreshnessFor(journey);
  const routeMood = routeMoodFor(journey);
  const sourceLabel =
    journey?.routeSource === "google-routes" ? "Google traffic-aware route" : "Distance fallback";

  return (
    <div className="space-y-3">
      <div className="relative h-64 overflow-hidden rounded-3xl border border-white/10 bg-[#07111f]">
        {children}
      </div>
      <div className="rounded-2xl border border-white/10 bg-white/10 p-4 text-xs text-gray-300">
        <div className="flex items-center justify-between gap-3">
          <span className="font-semibold text-white">{mode}</span>
          <span className="rounded-full bg-white/10 px-2 py-1">
            ETA {journey?.eta || 0} min
          </span>
        </div>
        <div className={`mt-3 rounded-2xl px-3 py-2 font-semibold ${freshness.tone}`}>
          {freshness.label}
        </div>
        <div className={`mt-2 rounded-2xl px-3 py-2 font-semibold ${routeMood.tone}`}>
          {routeMood.label}
        </div>
        <div className="mt-2 rounded-2xl bg-white/10 px-3 py-2 font-semibold">
          {sourceLabel}
        </div>
        <div className="mt-3 flex gap-2 text-amber-100">
          {mode !== "Google Maps" && <AlertTriangle className="h-4 w-4 shrink-0" />}
          <span>{reason}</span>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div>
            <p className="text-gray-500">Customer</p>
            <p>
              {formatCoord(customerLocation.lat)}, {formatCoord(customerLocation.lng)}
            </p>
          </div>
          <div>
            <p className="text-gray-500">Caretaker</p>
            <p>
              {formatCoord(caretakerLocation.lat)},{" "}
              {formatCoord(caretakerLocation.lng)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function FallbackVisual({ journey }: LiveMapProps) {
  const progress =
    journey?.status === "arrived" || journey?.status === "completed"
      ? 4
      : Math.min(4, Math.max(0, Math.round((8 - (journey?.eta || 8)) / 2)));

  return (
    <>
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,.06)_1px,transparent_1px),linear-gradient(rgba(255,255,255,.06)_1px,transparent_1px)] bg-[size:36px_36px]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_25%,rgba(59,130,246,.5),transparent_25%),radial-gradient(circle_at_75%_70%,rgba(34,197,94,.35),transparent_20%)]" />
      <div className="absolute left-8 top-10 flex items-center gap-2 rounded-full border border-white/10 bg-white/15 px-3 py-2 text-xs backdrop-blur-md">
        <MapPinned className="h-4 w-4 text-green-300" />
        {journey?.destinationLabel || "Patient Home"}
      </div>
      <div className="absolute bottom-9 right-7 flex items-center gap-2 rounded-full border border-white/10 bg-white/15 px-3 py-2 text-xs backdrop-blur-md">
        <Navigation className="h-4 w-4 text-blue-300" />
        {journey?.caretakerName || "Caretaker"}
      </div>
      <div className="absolute left-[30%] top-[42%] h-3 w-3 rounded-full bg-green-300 shadow-[0_0_32px_rgba(134,239,172,.9)]" />
      {[
        ["38%", "48%"],
        ["47%", "54%"],
        ["56%", "60%"],
        ["65%", "66%"]
      ].map(([left, top], index) => (
        <div
          key={`${left}-${top}`}
          className={`absolute h-2 w-2 rounded-full ${
            index < progress ? "bg-blue-300" : "bg-white/20"
          }`}
          style={{ left, top }}
        />
      ))}
      <div
        className="absolute h-4 w-4 animate-pulse rounded-full bg-blue-400 shadow-[0_0_36px_rgba(96,165,250,.95)] transition-all duration-700 ease-out"
        style={{
          left: `${72 - progress * 8}%`,
          top: `${72 - progress * 7}%`
        }}
      />
      <MapOverlay journey={journey} routeSource={journey?.routeSource} />
    </>
  );
}

function FallbackMap({ journey }: LiveMapProps) {
  return (
    <MapFrame
      journey={journey}
      mode="Fallback Map"
      reason="Add a valid Google Maps key to enable live map tiles."
    >
      <FallbackVisual journey={journey} />
    </MapFrame>
  );
}

export default function LiveMap({ journey }: LiveMapProps) {
  const [, setTick] = useState(0);
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  useEffect(() => {
    const interval = window.setInterval(() => setTick((value) => value + 1), 30000);
    return () => window.clearInterval(interval);
  }, []);

  if (!apiKey) {
    return <FallbackMap journey={journey} />;
  }

  return <GoogleLiveMap journey={journey} />;
}
