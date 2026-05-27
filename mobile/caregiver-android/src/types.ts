export type CaregiverSession = {
  uid: string;
  username: string;
  role: "caretaker";
  cookie: string;
};

export type ActiveAssignment = {
  id: string;
  status:
    | "searching"
    | "assigned"
    | "accepted"
    | "en_route"
    | "arrived"
    | "in_progress"
    | "completed"
    | "payment_settled"
    | "cancelled";
  customerName: string;
  caretakerId: string;
  caretakerName: string;
  serviceType: string;
  serviceStart?: {
    otp?: string;
    verifiedAt?: number;
  };
  tracking?: {
    etaMinutes: number;
    distanceKm: number;
    destinationLabel: string;
    lastLocationAt: number;
    customerLocation: {
      lat: number;
      lng: number;
    };
    caretakerLocation: {
      lat: number;
      lng: number;
    };
  };
};

export type CaregiverProfile = {
  uid: string;
  name: string;
  status: "available" | "standby" | "offline" | "on_visit" | string;
  available: boolean;
  activeAssignments: number;
  rating: number;
  punctualityScore: number;
  repeatVisits: number;
};

export type DispatchOffer = {
  bookingId: string;
  caretakerId: string;
  caretakerName?: string;
  serviceType?: string;
  customerName?: string;
  destinationLabel?: string;
  distanceKm?: number;
  etaMinutes?: number;
  score?: number;
  status: "sent" | "accepted" | "rejected" | "expired" | "cancelled";
  notifiedAt?: number;
  expiresAt?: number;
};

export type AssignmentFeed = {
  caretaker: CaregiverProfile;
  bookings: ActiveAssignment[];
  offers: DispatchOffer[];
  serverTime: number;
};

export type LocationPoint = {
  lat: number;
  lng: number;
  accuracyMeters?: number;
  capturedAt?: number;
  source?: "device" | "background";
};
