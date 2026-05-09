import { getAdminDatabase } from "./firebaseAdmin";

export type AttendanceAction =
  | "break_end"
  | "break_start"
  | "check_in"
  | "check_out";

export type AttendanceLocation = {
  lat?: number;
  lng?: number;
  accuracyMeters?: number;
};

const activeShiftPath = (caretakerId: string) =>
  `caretakerAttendance/activeShifts/${caretakerId}`;

const shiftHistoryPath = (caretakerId: string, shiftId: string) =>
  `caretakerAttendance/byCaretaker/${caretakerId}/${shiftId}`;

const dayIndexPath = (dateKey: string, caretakerId: string, shiftId: string) =>
  `caretakerAttendance/byDate/${dateKey}/${caretakerId}/${shiftId}`;

const dateKeyFor = (timestamp: number) => new Date(timestamp).toISOString().slice(0, 10);

export const CaretakerAttendance = {
  async record({
    caretakerId,
    action,
    location,
    note
  }: {
    caretakerId: string;
    action: AttendanceAction;
    location?: AttendanceLocation;
    note?: string;
  }) {
    const database = getAdminDatabase();

    if (!database) {
      return { ok: false as const, status: 503, error: "Firebase Admin is not configured" };
    }

    const timestamp = Date.now();
    const activeSnapshot = await database.ref(activeShiftPath(caretakerId)).get();
    const activeShift = activeSnapshot.val() as
      | {
          id: string;
          startedAt: number;
          breakMinutes?: number;
        }
      | null;
    const shiftId =
      activeShift?.id || `shift-${caretakerId}-${timestamp}`;
    const event = {
      action,
      at: timestamp,
      location: location || null,
      note: note || ""
    };
    const updates: Record<string, unknown> = {
      [`caretakers/${caretakerId}/lastSeenAt`]: timestamp,
      [`${shiftHistoryPath(caretakerId, shiftId)}/id`]: shiftId,
      [`${shiftHistoryPath(caretakerId, shiftId)}/caretakerId`]: caretakerId,
      [`${shiftHistoryPath(caretakerId, shiftId)}/updatedAt`]: timestamp,
      [`${shiftHistoryPath(caretakerId, shiftId)}/events/${timestamp}`]: event,
      [dayIndexPath(dateKeyFor(timestamp), caretakerId, shiftId)]: true
    };

    if (action === "check_in") {
      updates[activeShiftPath(caretakerId)] = {
        id: shiftId,
        caretakerId,
        status: "active",
        startedAt: timestamp,
        updatedAt: timestamp
      };
      updates[`${shiftHistoryPath(caretakerId, shiftId)}/startedAt`] = timestamp;
      updates[`${shiftHistoryPath(caretakerId, shiftId)}/status`] = "active";
      updates[`caretakers/${caretakerId}/status`] = "available";
      updates[`caretakers/${caretakerId}/available`] = true;
    }

    if (action === "break_start") {
      updates[`${activeShiftPath(caretakerId)}/status`] = "break";
      updates[`${activeShiftPath(caretakerId)}/breakStartedAt`] = timestamp;
      updates[`${shiftHistoryPath(caretakerId, shiftId)}/status`] = "break";
      updates[`caretakers/${caretakerId}/status`] = "standby";
    }

    if (action === "break_end") {
      const breakStartedAt = (activeShift as { breakStartedAt?: number } | null)
        ?.breakStartedAt;
      const breakMinutes = breakStartedAt
        ? Math.max(1, Math.round((timestamp - breakStartedAt) / 60000))
        : 0;

      updates[`${activeShiftPath(caretakerId)}/status`] = "active";
      updates[`${activeShiftPath(caretakerId)}/breakStartedAt`] = null;
      updates[`${activeShiftPath(caretakerId)}/breakMinutes`] =
        (activeShift?.breakMinutes || 0) + breakMinutes;
      updates[`${shiftHistoryPath(caretakerId, shiftId)}/status`] = "active";
      updates[`${shiftHistoryPath(caretakerId, shiftId)}/breakMinutes`] =
        (activeShift?.breakMinutes || 0) + breakMinutes;
      updates[`caretakers/${caretakerId}/status`] = "available";
    }

    if (action === "check_out") {
      const startedAt = activeShift?.startedAt || timestamp;
      updates[activeShiftPath(caretakerId)] = null;
      updates[`${shiftHistoryPath(caretakerId, shiftId)}/status`] = "completed";
      updates[`${shiftHistoryPath(caretakerId, shiftId)}/endedAt`] = timestamp;
      updates[`${shiftHistoryPath(caretakerId, shiftId)}/durationMinutes`] = Math.max(
        1,
        Math.round((timestamp - startedAt) / 60000)
      );
      updates[`caretakers/${caretakerId}/status`] = "offline";
      updates[`caretakers/${caretakerId}/available`] = false;
    }

    await database.ref().update(updates);

    return {
      ok: true as const,
      shift: {
        id: shiftId,
        caretakerId,
        action,
        updatedAt: timestamp
      }
    };
  }
};
