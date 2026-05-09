import { getAdminDatabase } from "./firebaseAdmin";

export type PartnerType =
  | "ambulance"
  | "diagnostic_lab"
  | "hospital"
  | "pharmacy"
  | "physiotherapy";

export type PartnerRecord = {
  id: string;
  name: string;
  type: PartnerType;
  city: string;
  zone: string;
  availability: "available" | "busy" | "offline";
  slaMinutes: number;
  rating: number;
  phone: string;
  createdAt: number;
  updatedAt: number;
};

const defaultPartners: PartnerRecord[] = [
  {
    id: "partner-ambulance-central",
    name: "Central Emergency Ambulance",
    type: "ambulance",
    city: "Bengaluru",
    zone: "Central",
    availability: "available",
    slaMinutes: 12,
    rating: 4.8,
    phone: "+91 90000 10001",
    createdAt: Date.now(),
    updatedAt: Date.now()
  },
  {
    id: "partner-lab-south",
    name: "South Diagnostics",
    type: "diagnostic_lab",
    city: "Bengaluru",
    zone: "South",
    availability: "available",
    slaMinutes: 45,
    rating: 4.7,
    phone: "+91 90000 10002",
    createdAt: Date.now(),
    updatedAt: Date.now()
  },
  {
    id: "partner-pharmacy-central",
    name: "Care Pharmacy Central",
    type: "pharmacy",
    city: "Bengaluru",
    zone: "Central",
    availability: "available",
    slaMinutes: 30,
    rating: 4.8,
    phone: "+91 90000 10003",
    createdAt: Date.now(),
    updatedAt: Date.now()
  }
];

export const PartnerMarketplace = {
  async seedDefaults() {
    const database = getAdminDatabase();

    if (!database) {
      return { ok: false as const, status: 503, error: "Firebase Admin is not configured" };
    }

    const updates = Object.fromEntries(
      defaultPartners.flatMap((partner) => [
        [`partners/byId/${partner.id}`, partner],
        [`partners/byType/${partner.type}/${partner.id}`, true],
        [`partners/byZone/${partner.zone}/${partner.id}`, true]
      ])
    );

    await database.ref().update(updates);

    return { ok: true as const, partners: defaultPartners };
  },

  async dispatch({
    partnerType,
    bookingId,
    zone = "Central",
    reason
  }: {
    partnerType: PartnerType;
    bookingId?: string;
    zone?: string;
    reason: string;
  }) {
    const database = getAdminDatabase();

    if (!database) {
      return { ok: false as const, status: 503, error: "Firebase Admin is not configured" };
    }

    const partnersSnapshot = await database.ref(`partners/byId`).get();
    const partners = Object.values(
      (partnersSnapshot.val() || {}) as Record<string, PartnerRecord>
    );
    const selected =
      partners
        .filter(
          (partner) =>
            partner.type === partnerType &&
            partner.availability === "available" &&
            (partner.zone === zone || partner.city === "Bengaluru")
        )
        .sort((a, b) => a.slaMinutes - b.slaMinutes || b.rating - a.rating)[0] ||
      null;

    if (!selected) {
      return { ok: false as const, status: 409, error: "No partner available" };
    }

    const id = `partner-dispatch-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const dispatch = {
      id,
      bookingId: bookingId || "",
      partnerId: selected.id,
      partnerName: selected.name,
      partnerType,
      zone,
      reason,
      status: "requested",
      etaMinutes: selected.slaMinutes,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    await database.ref().update({
      [`partnerDispatches/byId/${id}`]: dispatch,
      [`partnerDispatches/byPartner/${selected.id}/${id}`]: true,
      [`operations/partnerDispatchQueue/${partnerType}/${id}`]: true
    });

    return { ok: true as const, dispatch };
  }
};
