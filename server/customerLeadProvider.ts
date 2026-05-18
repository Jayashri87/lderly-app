import { createHash, randomBytes } from "node:crypto";
import { getAdminDatabase } from "./firebaseAdmin";

export type CustomerLeadStatus =
  | "new"
  | "contacted"
  | "qualified"
  | "customer_created"
  | "not_reachable"
  | "archived";

export type CustomerLead = {
  id: string;
  name: string;
  email: string;
  phone: string;
  source: string;
  status: CustomerLeadStatus;
  touchCount: number;
  notes?: string;
  lastAction?: string;
  createdCustomerId?: string;
  createdAt: number;
  updatedAt: number;
  contactedAt?: number;
  qualifiedAt?: number;
  archivedAt?: number;
};

const normalizeObject = <T>(value: unknown) =>
  Object.entries((value || {}) as Record<string, T>).map(([id, item]) => ({
    ...(item || {}),
    id: (item as { id?: string })?.id || id
  })) as Array<T & { id: string }>;

const toCustomerId = (lead: CustomerLead) =>
  `customer-${createHash("sha256")
    .update(`${lead.email.toLowerCase()}|${lead.phone}`)
    .digest("hex")
    .slice(0, 16)}`;

const temporaryPassword = () => `LDERLY-${randomBytes(3).toString("hex").toUpperCase()}`;

export const CustomerLeadProvider = {
  async getSnapshot() {
    const database = getAdminDatabase();

    if (!database) {
      return { ok: false as const, status: 503, error: "Firebase Admin is not configured" };
    }

    const snapshot = await database.ref("customerLeads").limitToLast(120).get();
    const leads = normalizeObject<CustomerLead>(snapshot.val())
      .filter((lead) => lead.name || lead.email || lead.phone)
      .map((lead) => ({
        ...lead,
        status: lead.status || "new",
        touchCount: lead.touchCount || 1,
        createdAt: lead.createdAt || lead.updatedAt || 0,
        updatedAt: lead.updatedAt || lead.createdAt || 0
      }))
      .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

    return {
      ok: true as const,
      snapshot: {
        generatedAt: Date.now(),
        total: leads.length,
        newCount: leads.filter((lead) => lead.status === "new").length,
        contactedCount: leads.filter((lead) => lead.status === "contacted").length,
        qualifiedCount: leads.filter((lead) => lead.status === "qualified").length,
        customerCreatedCount: leads.filter((lead) => lead.status === "customer_created").length,
        notReachableCount: leads.filter((lead) => lead.status === "not_reachable").length,
        archivedCount: leads.filter((lead) => lead.status === "archived").length,
        leads
      }
    };
  },

  async updateLead({
    leadId,
    status,
    notes,
    actor
  }: {
    leadId: string;
    status: CustomerLeadStatus;
    notes?: string;
    actor: string;
  }) {
    const database = getAdminDatabase();

    if (!database) {
      return { ok: false as const, status: 503, error: "Firebase Admin is not configured" };
    }

    const leadRef = database.ref(`customerLeads/${leadId}`);
    const snapshot = await leadRef.get();
    const lead = snapshot.val() as CustomerLead | null;

    if (!lead) {
      return { ok: false as const, status: 404, error: "Lead not found" };
    }

    const timestamp = Date.now();
    const lifecycleTime =
      status === "contacted"
        ? { contactedAt: timestamp }
        : status === "qualified"
          ? { qualifiedAt: timestamp }
          : status === "archived"
            ? { archivedAt: timestamp }
            : {};

    await leadRef.update({
      status,
      ...(notes !== undefined ? { notes } : {}),
      lastAction: `Marked ${status.replaceAll("_", " ")}`,
      updatedAt: timestamp,
      ...lifecycleTime
    });
    await database.ref(`operations/customerLeadActions/${leadId}/${timestamp}`).set({
      id: `lead-action-${timestamp}`,
      leadId,
      action: "status_update",
      status,
      notes: notes || "",
      actor,
      createdAt: timestamp
    });

    return { ok: true as const, leadId, status };
  },

  async createCustomerFromLead({ leadId, actor }: { leadId: string; actor: string }) {
    const database = getAdminDatabase();

    if (!database) {
      return { ok: false as const, status: 503, error: "Firebase Admin is not configured" };
    }

    const leadRef = database.ref(`customerLeads/${leadId}`);
    const snapshot = await leadRef.get();
    const lead = snapshot.val() as CustomerLead | null;

    if (!lead) {
      return { ok: false as const, status: 404, error: "Lead not found" };
    }

    const timestamp = Date.now();
    const customerId = toCustomerId({ ...lead, id: leadId });
    const loginId = lead.email.toLowerCase();
    const password = temporaryPassword();

    await database.ref(`users/${customerId}`).update({
      uid: customerId,
      name: lead.name,
      email: lead.email,
      phone: lead.phone,
      role: "customer",
      sourceLeadId: leadId,
      accountStatus: "manual_setup_pending",
      updatedAt: timestamp,
      createdAt: timestamp
    });
    await database.ref(`customerAccounts/${customerId}`).update({
      uid: customerId,
      leadId,
      loginId,
      temporaryPassword: password,
      passwordDelivery: "manual_call",
      status: "pending_delivery",
      createdBy: actor,
      createdAt: timestamp,
      updatedAt: timestamp
    });
    await leadRef.update({
      status: "customer_created",
      createdCustomerId: customerId,
      lastAction: "Customer account prepared",
      updatedAt: timestamp
    });
    await database.ref(`operations/customerLeadActions/${leadId}/${timestamp}`).set({
      id: `lead-action-${timestamp}`,
      leadId,
      action: "customer_created",
      status: "customer_created",
      customerId,
      loginId,
      actor,
      createdAt: timestamp
    });

    return {
      ok: true as const,
      customerId,
      loginId,
      temporaryPassword: password
    };
  }
};
