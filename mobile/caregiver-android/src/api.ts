import AsyncStorage from "@react-native-async-storage/async-storage";
import { ActiveAssignment, AssignmentFeed, CaregiverSession, LocationPoint } from "./types";

const sessionKey = "lderly-caregiver-session";

const apiBaseUrl =
  process.env.EXPO_PUBLIC_LDERLY_API_BASE_URL || "https://lderly-app.vercel.app";

const cookieFrom = (headers: Headers) => {
  const raw = headers.get("set-cookie") || "";
  return raw.split(";")[0];
};

export const saveSession = async (session: CaregiverSession) => {
  await AsyncStorage.setItem(sessionKey, JSON.stringify(session));
};

export const readSession = async () => {
  const value = await AsyncStorage.getItem(sessionKey);
  return value ? (JSON.parse(value) as CaregiverSession) : null;
};

export const clearSession = async () => {
  await AsyncStorage.removeItem(sessionKey);
};

const request = async <T>(
  path: string,
  session: CaregiverSession | null,
  options: RequestInit = {}
) => {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(session?.cookie ? { Cookie: session.cookie } : {}),
      ...(options.headers || {})
    }
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : {};

  if (!response.ok) {
    throw new Error(data.error || "LDERLY request failed");
  }

  return data as T;
};

export const CaregiverApi = {
  async login(username: string, password: string) {
    const response = await fetch(`${apiBaseUrl}/api/auth/caretaker`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ username, password })
    });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Login failed");
    }

    const session: CaregiverSession = {
      uid: data.uid || "demo-caretaker",
      username,
      role: "caretaker",
      cookie: cookieFrom(response.headers)
    };

    await saveSession(session);
    return session;
  },

  async acceptBooking(session: CaregiverSession, bookingId: string) {
    return request<{ ok: true }>(`/api/bookings/${bookingId}/accept`, session, {
      method: "POST",
      headers: {
        "idempotency-key": `accept-${bookingId}-${Date.now()}`
      }
    });
  },

  async rejectBooking(session: CaregiverSession, bookingId: string, reason: string) {
    return request<{ booking?: ActiveAssignment }>(`/api/bookings/${bookingId}/reject`, session, {
      method: "POST",
      headers: {
        "idempotency-key": `reject-${bookingId}-${reason}`
      },
      body: JSON.stringify({ reason })
    });
  },

  async assignments(session: CaregiverSession) {
    return request<AssignmentFeed>("/api/caretaker/assignments", session, {
      method: "GET"
    });
  },

  async updateAvailability(
    session: CaregiverSession,
    available: boolean,
    status: "available" | "standby" | "offline" | "on_visit"
  ) {
    return request<{ ok: true }>("/api/caretaker/availability", session, {
      method: "POST",
      body: JSON.stringify({
        available,
        status
      })
    });
  },

  async updateStatus(
    session: CaregiverSession,
    bookingId: string,
    status: "en_route" | "arrived" | "completed"
  ) {
    return request<{ booking?: ActiveAssignment }>(
      `/api/bookings/${bookingId}/status`,
      session,
      {
        method: "POST",
        headers: {
          "idempotency-key": `status-${bookingId}-${status}-${Date.now()}`
        },
        body: JSON.stringify({ status })
      }
    );
  },

  async startService(session: CaregiverSession, bookingId: string, otp: string) {
    return request<{ booking?: ActiveAssignment }>(
      `/api/bookings/${bookingId}/start`,
      session,
      {
        method: "POST",
        headers: {
          "idempotency-key": `start-${bookingId}-${Date.now()}`
        },
        body: JSON.stringify({ otp })
      }
    );
  },

  async sendLocation(
    session: CaregiverSession,
    bookingId: string | undefined,
    location: LocationPoint
  ) {
    return request<{ ok: true }>("/api/caretaker/location", session, {
      method: "POST",
      body: JSON.stringify({
        bookingId,
        lat: location.lat,
        lng: location.lng,
        accuracyMeters: location.accuracyMeters,
        capturedAt: location.capturedAt,
        source: location.source
      })
    });
  },

  async createEmergencyEscalation(
    session: CaregiverSession,
    bookingId: string | undefined,
    reason: string,
    locationLabel?: string
  ) {
    return request<{ ok: true }>("/api/emergency/escalate", session, {
      method: "POST",
      body: JSON.stringify({
        action: "create",
        bookingId,
        reason,
        locationLabel,
        severity: "critical"
      })
    });
  }
};
