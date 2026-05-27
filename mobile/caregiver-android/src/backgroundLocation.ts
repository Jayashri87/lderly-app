import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { CaregiverApi, readSession } from "./api";

const backgroundLocationTask = "LDERLY_CAREGIVER_BACKGROUND_LOCATION";
const activeBookingKey = "lderly-active-background-booking-id";

let activeBookingId: string | undefined;

TaskManager.defineTask(backgroundLocationTask, async ({ data, error }) => {
  if (error) {
    return;
  }

  const payload = data as { locations?: Location.LocationObject[] };
  const latest = payload.locations?.[0];

  if (!latest) {
    return;
  }

  const session = await readSession();

  if (!session) {
    return;
  }

  const bookingId = activeBookingId || (await AsyncStorage.getItem(activeBookingKey)) || undefined;

  await CaregiverApi.sendLocation(session, bookingId, {
    lat: latest.coords.latitude,
    lng: latest.coords.longitude,
    accuracyMeters: latest.coords.accuracy ?? undefined,
    capturedAt: latest.timestamp,
    source: "background"
  }).catch(() => undefined);
});

export const CaregiverLocation = {
  async requestPermissions() {
    const foreground = await Location.requestForegroundPermissionsAsync();

    if (foreground.status !== "granted") {
      return {
        ok: false as const,
        reason: "Location permission was not granted."
      };
    }

    const background = await Location.requestBackgroundPermissionsAsync();

    if (background.status !== "granted") {
      return {
        ok: false as const,
        reason: "Background location permission was not granted."
      };
    }

    return { ok: true as const };
  },

  async start(bookingId: string) {
    activeBookingId = bookingId;
    await AsyncStorage.setItem(activeBookingKey, bookingId);
    const permissions = await this.requestPermissions();

    if (!permissions.ok) {
      return permissions;
    }

    const alreadyStarted = await Location.hasStartedLocationUpdatesAsync(
      backgroundLocationTask
    );

    if (!alreadyStarted) {
      await Location.startLocationUpdatesAsync(backgroundLocationTask, {
        accuracy: Location.Accuracy.High,
        distanceInterval: 25,
        timeInterval: 15000,
        pausesUpdatesAutomatically: false,
        foregroundService: {
          notificationTitle: "LDERLY care visit tracking",
          notificationBody:
            "Live location is active during this assigned care visit."
        }
      });
    }

    return { ok: true as const };
  },

  async stop() {
    activeBookingId = undefined;
    await AsyncStorage.removeItem(activeBookingKey);
    const alreadyStarted = await Location.hasStartedLocationUpdatesAsync(
      backgroundLocationTask
    );

    if (alreadyStarted) {
      await Location.stopLocationUpdatesAsync(backgroundLocationTask);
    }
  }
};
