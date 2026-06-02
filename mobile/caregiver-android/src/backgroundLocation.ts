import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { CaregiverApi, readSession } from "./api";
import { LocationPoint } from "./types";

const backgroundLocationTask = "LDERLY_CAREGIVER_BACKGROUND_LOCATION";
const activeBookingKey = "lderly-active-background-booking-id";
const locationHealthKey = "lderly-location-health";
const queuedLocationsKey = "lderly-location-queue";
const maxQueuedLocations = 25;

let activeBookingId: string | undefined;

export type LocationHealth = {
  active: boolean;
  permission: "unknown" | "granted" | "foreground_only" | "denied";
  lastSentAt?: number;
  lastCapturedAt?: number;
  lastAccuracyMeters?: number;
  queued: number;
  error?: string;
};

const defaultHealth: LocationHealth = {
  active: false,
  permission: "unknown",
  queued: 0
};

const readQueue = async () => {
  const value = await AsyncStorage.getItem(queuedLocationsKey);
  return value ? (JSON.parse(value) as Array<{ bookingId?: string; location: LocationPoint }>) : [];
};

const writeHealth = async (patch: Partial<LocationHealth>) => {
  const current = await CaregiverLocation.getStatus();
  await AsyncStorage.setItem(
    locationHealthKey,
    JSON.stringify({
      ...current,
      ...patch
    })
  );
};

const queueLocation = async (bookingId: string | undefined, location: LocationPoint) => {
  const queue = await readQueue();
  const nextQueue = [...queue, { bookingId, location }].slice(-maxQueuedLocations);
  await AsyncStorage.setItem(queuedLocationsKey, JSON.stringify(nextQueue));
  await writeHealth({
    queued: nextQueue.length,
    error: "Location update queued while network/backend was unavailable."
  });
};

const sendOrQueueLocation = async (bookingId: string | undefined, location: LocationPoint) => {
  const session = await readSession();

  if (!session) {
    await queueLocation(bookingId, location);
    return;
  }

  try {
    await CaregiverApi.sendLocation(session, bookingId, location);
    await writeHealth({
      active: true,
      lastSentAt: Date.now(),
      lastCapturedAt: location.capturedAt,
      lastAccuracyMeters: location.accuracyMeters,
      error: undefined
    });
  } catch {
    await queueLocation(bookingId, location);
  }
};

TaskManager.defineTask(backgroundLocationTask, async ({ data, error }) => {
  if (error) {
    await writeHealth({
      error: error.message
    });
    return;
  }

  const payload = data as { locations?: Location.LocationObject[] };
  const latest = payload.locations?.[0];

  if (!latest) {
    return;
  }

  const bookingId = activeBookingId || (await AsyncStorage.getItem(activeBookingKey)) || undefined;

  await sendOrQueueLocation(bookingId, {
    lat: latest.coords.latitude,
    lng: latest.coords.longitude,
    accuracyMeters: latest.coords.accuracy ?? undefined,
    capturedAt: latest.timestamp,
    source: "background"
  }).catch(() => undefined);
});

export const CaregiverLocation = {
  async getStatus(): Promise<LocationHealth> {
    const value = await AsyncStorage.getItem(locationHealthKey);

    if (!value) {
      return defaultHealth;
    }

    return {
      ...defaultHealth,
      ...(JSON.parse(value) as LocationHealth)
    };
  },

  async requestPermissions() {
    const foreground = await Location.requestForegroundPermissionsAsync();

    if (foreground.status !== "granted") {
      await writeHealth({
        active: false,
        permission: "denied",
        error: "Location permission was not granted."
      });
      return {
        ok: false as const,
        reason: "Location permission was not granted."
      };
    }

    const background = await Location.requestBackgroundPermissionsAsync();

    if (background.status !== "granted") {
      await writeHealth({
        active: false,
        permission: "foreground_only",
        error: "Background location permission was not granted."
      });
      return {
        ok: false as const,
        reason: "Background location permission was not granted."
      };
    }

    await writeHealth({
      permission: "granted",
      error: undefined
    });

    return { ok: true as const };
  },

  async flushQueue() {
    const session = await readSession();

    if (!session) {
      return;
    }

    const queue = await readQueue();

    if (queue.length === 0) {
      return;
    }

    const remaining: typeof queue = [];

    for (const item of queue) {
      try {
        await CaregiverApi.sendLocation(session, item.bookingId, item.location);
      } catch {
        remaining.push(item);
      }
    }

    await AsyncStorage.setItem(queuedLocationsKey, JSON.stringify(remaining));
    await writeHealth({
      queued: remaining.length,
      lastSentAt: remaining.length < queue.length ? Date.now() : undefined,
      error: remaining.length > 0 ? "Some queued GPS updates are still pending." : undefined
    });
  },

  async start(bookingId: string) {
    activeBookingId = bookingId;
    await AsyncStorage.setItem(activeBookingKey, bookingId);
    const permissions = await this.requestPermissions();

    if (!permissions.ok) {
      return permissions;
    }

    const alreadyStarted = await Location.hasStartedLocationUpdatesAsync(backgroundLocationTask);

    if (!alreadyStarted) {
      await Location.startLocationUpdatesAsync(backgroundLocationTask, {
        accuracy: Location.Accuracy.BestForNavigation,
        distanceInterval: 10,
        timeInterval: 10000,
        pausesUpdatesAutomatically: false,
        foregroundService: {
          notificationTitle: "LDERLY care visit tracking",
          notificationBody: "Live location is active during this assigned care visit.",
          notificationColor: "#34d399"
        }
      });
    }

    const current = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High
    });

    await sendOrQueueLocation(bookingId, {
      lat: current.coords.latitude,
      lng: current.coords.longitude,
      accuracyMeters: current.coords.accuracy ?? undefined,
      capturedAt: current.timestamp,
      source: "device"
    });
    await this.flushQueue();
    await writeHealth({
      active: true,
      permission: "granted",
      error: undefined
    });

    return { ok: true as const };
  },

  async stop() {
    activeBookingId = undefined;
    await AsyncStorage.removeItem(activeBookingKey);
    const alreadyStarted = await Location.hasStartedLocationUpdatesAsync(backgroundLocationTask);

    if (alreadyStarted) {
      await Location.stopLocationUpdatesAsync(backgroundLocationTask);
    }

    await writeHealth({
      active: false
    });
  }
};
