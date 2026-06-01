import type { SessionUser } from "./auth";

export type BookingStatus =
  | "none"
  | "requested"
  | "searching"
  | "assigned"
  | "accepted"
  | "en_route"
  | "arrived"
  | "in_progress"
  | "completed"
  | "payment_settled"
  | "report_generated"
  | "cancelled";

export type CareLocation = {
  lat: number;
  lng: number;
  accuracyMeters?: number;
  capturedAt?: number;
};

export type BookingRequestDetails = {
  careFor: {
    relationship: string;
    displayName: string;
  };
  careNeed: string;
  service: string;
  duration: {
    label: string;
    price: string;
    note: string;
  };
  schedule: {
    label: string;
    detail: string;
    requestedFor: number;
  };
  location: {
    label: string;
    detail: string;
    latitude?: number;
    longitude?: number;
    placeId?: string;
  };
  pricing: {
    careEstimate: string;
    coordinationFee: string;
    estimatedTotal: string;
  };
  trust: string[];
};

export type BookingLifecycle = {
  allowedNextStatuses: BookingStatus[];
  currentStep: string;
  nextStep: string;
  lastActor: SessionUser["role"] | "system";
};
