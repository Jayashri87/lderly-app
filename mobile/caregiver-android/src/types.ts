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

export type LocationPoint = {
  lat: number;
  lng: number;
  accuracyMeters?: number;
};

