import { Database } from "firebase/database";
import { off, onValue, ref, set } from "firebase/database";
import { db } from "../firebase";
import { SessionUser } from "./authService";
import { NotificationService } from "./notificationService";

export type JourneyStatus =
  | "idle"
  | "requested"
  | "assigned"
  | "accepted"
  | "en_route"
  | "arrived"
  | "in_progress"
  | "completed"
  | "escalated";

export type CareJourney = {
  id: string;
  status: JourneyStatus;
  summary: string;
  serviceType: string;
  eta: number;
  customerId: string;
  customerName: string;
  caretakerId: string;
  caretakerName: string;
  priority: "normal" | "urgent" | "critical";
  destinationLabel: string;
  customerLocation: {
    lat: number;
    lng: number;
  };
  caretakerLocation: {
    lat: number;
    lng: number;
  };
  lastLocationAt?: number;
  createdAt: number;
  updatedAt: number;
  timeline: Array<{
    label: string;
    at: number;
  }>;
};

const storageKey = "lderly-active-journey";

const now = () => Date.now();

const createDefaultJourney = (): CareJourney => ({
  id: "demo-journey",
  status: "idle",
  summary: "All Stable",
  serviceType: "Emergency Assistance",
  eta: 0,
  customerId: "",
  customerName: "Family",
  caretakerId: "",
  caretakerName: "Awaiting",
  priority: "normal",
  destinationLabel: "Patient Home",
  customerLocation: {
    lat: 12.9716,
    lng: 77.5946
  },
  caretakerLocation: {
    lat: 12.985,
    lng: 77.61
  },
  createdAt: now(),
  updatedAt: now(),
  timeline: [{ label: "System stable", at: now() }]
});

let localJourney = createDefaultJourney();
const localSubscribers = new Set<(journey: CareJourney) => void>();

const canUseStorage = () => typeof window !== "undefined";

const journeyRef = (database: Database, journeyId: string) =>
  ref(database, `journeys/byId/${journeyId}`);

const readLocalJourney = () => {
  if (!canUseStorage()) {
    return localJourney;
  }

  const storedJourney = window.localStorage.getItem(storageKey);

  if (!storedJourney) {
    return localJourney;
  }

  try {
    localJourney = JSON.parse(storedJourney) as CareJourney;
  } catch {
    window.localStorage.removeItem(storageKey);
  }

  return localJourney;
};

const writeLocalJourney = (journey: CareJourney) => {
  localJourney = journey;

  if (canUseStorage()) {
    window.localStorage.setItem(storageKey, JSON.stringify(journey));
  }

  localSubscribers.forEach((callback) => callback(journey));
};

const addTimeline = (journey: CareJourney, label: string): CareJourney => {
  const timestamp = now();

  return {
    ...journey,
    updatedAt: timestamp,
    timeline: [...journey.timeline, { label, at: timestamp }]
  };
};

const activePathFor = (session: SessionUser) => {
  if (session.role === "customer") {
    return `users/${session.uid}/activeJourneyId`;
  }

  if (session.role === "caretaker") {
    return `caretakers/${session.uid}/activeJourneyId`;
  }

  return "operations/activeJourneyId";
};

const writeJourneyIndexes = async (journey: CareJourney) => {
  if (!db) {
    return;
  }

  await Promise.all([
    set(journeyRef(db, journey.id), journey),
    set(ref(db, `users/${journey.customerId}/activeJourneyId`), journey.id),
    set(ref(db, "operations/activeJourneyId"), journey.id),
    journey.caretakerId
      ? set(ref(db, `caretakers/${journey.caretakerId}/activeJourneyId`), journey.id)
      : Promise.resolve()
  ]);
};

const saveJourney = (journey: CareJourney) => {
  writeLocalJourney(journey);
  writeJourneyIndexes(journey).catch(() => writeLocalJourney(journey));
};

const patchJourney = (patch: Partial<CareJourney>, label: string) => {
  const nextJourney = addTimeline(
    {
      ...readLocalJourney(),
      ...patch
    },
    label
  );

  saveJourney(nextJourney);
};

const statusSummary: Record<JourneyStatus, string> = {
  idle: "All Stable",
  requested: "Emergency Request Created",
  assigned: "Caretaker Assigned",
  accepted: "Caretaker Accepted",
  en_route: "Caretaker En Route",
  arrived: "Caretaker Arrived",
  in_progress: "Care Visit In Progress",
  completed: "Care Visit Completed",
  escalated: "Escalated to Emergency Network"
};

export const JourneyService = {
  subscribe(session: SessionUser, callback: (journey: CareJourney) => void) {
    callback(readLocalJourney());
    localSubscribers.add(callback);

    if (!db) {
      return () => {
        localSubscribers.delete(callback);
      };
    }

    const database = db;
    let activeJourneyId = "";
    let activeJourneyPath = "";

    const activeRef = ref(database, activePathFor(session));
    const unsubscribeActive = onValue(
      activeRef,
      (snapshot) => {
        const journeyId = snapshot.val() as string | null;

        if (!journeyId) {
          callback(readLocalJourney());
          return;
        }

        if (activeJourneyPath) {
          off(ref(database, activeJourneyPath));
        }

        activeJourneyId = journeyId;
        activeJourneyPath = `journeys/byId/${activeJourneyId}`;

        onValue(ref(database, activeJourneyPath), (journeySnapshot) => {
          const journey =
            (journeySnapshot.val() as CareJourney | null) ?? readLocalJourney();
          writeLocalJourney(journey);
        });
      },
      () => {
        callback(readLocalJourney());
      }
    );

    return () => {
      localSubscribers.delete(callback);
      unsubscribeActive();

      if (activeJourneyPath) {
        off(ref(database, activeJourneyPath));
      }
    };
  },

  requestService(session: SessionUser, serviceType = "Emergency Assistance") {
    const timestamp = now();
    const request: CareJourney = {
      id: `journey-${timestamp}`,
      status: "requested",
      summary: statusSummary.requested,
      serviceType,
      eta: 0,
      customerId: session.uid,
      customerName: session.name,
      caretakerId: "",
      caretakerName: "Awaiting assignment",
      priority: "critical",
      destinationLabel: "Patient Home",
      customerLocation: {
        lat: 12.9716,
        lng: 77.5946
      },
      caretakerLocation: {
        lat: 12.985,
        lng: 77.61
      },
      createdAt: timestamp,
      updatedAt: timestamp,
      timeline: [{ label: `${serviceType} requested`, at: timestamp }]
    };

    saveJourney(request);
    NotificationService.create({
      userId: session.uid,
      role: "admin",
      title: "SOS request created",
      body: `${session.name} requested ${serviceType}.`,
      priority: "critical"
    });
  },

  assignCaretaker() {
    patchJourney(
      {
        status: "assigned",
        summary: statusSummary.assigned,
        caretakerId: "demo-caretaker",
        caretakerName: "Anita",
        eta: 8
      },
      "Admin assigned Anita"
    );
    NotificationService.create({
      userId: readLocalJourney().customerId,
      role: "caretaker",
      title: "Emergency assigned",
      body: "You have been assigned to an emergency request.",
      priority: "critical"
    });
  },

  updateStatus(status: JourneyStatus) {
    const etaByStatus: Partial<Record<JourneyStatus, number>> = {
      accepted: 8,
      en_route: 5,
      arrived: 0,
      completed: 0,
      escalated: 3
    };

    patchJourney(
      {
        status,
        summary: statusSummary[status],
        eta: etaByStatus[status] ?? readLocalJourney().eta
      },
      statusSummary[status]
    );
    NotificationService.create({
      userId: readLocalJourney().customerId,
      role: "all",
      title: statusSummary[status],
      body: `Journey status changed to ${status}.`,
      priority: status === "escalated" ? "critical" : "normal"
    });
  },

  moveCaretakerCloser() {
    const journey = readLocalJourney();
    const nextLat =
      journey.caretakerLocation.lat +
      (journey.customerLocation.lat - journey.caretakerLocation.lat) * 0.35;
    const nextLng =
      journey.caretakerLocation.lng +
      (journey.customerLocation.lng - journey.caretakerLocation.lng) * 0.35;
    const nextEta = Math.max(0, journey.eta - 2);

    patchJourney(
      {
        caretakerLocation: {
          lat: Number(nextLat.toFixed(6)),
          lng: Number(nextLng.toFixed(6))
        },
        eta: nextEta,
        status: nextEta === 0 ? "arrived" : journey.status,
        summary: nextEta === 0 ? statusSummary.arrived : journey.summary
      },
      nextEta === 0 ? "Caretaker arrived at destination" : "Caretaker location updated"
    );
  },

  clearJourney() {
    saveJourney(addTimeline(createDefaultJourney(), "Journey cleared"));
  }
};
