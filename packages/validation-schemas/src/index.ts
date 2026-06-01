import { z } from "zod";

export const userRoleSchema = z.enum(["customer", "caretaker", "admin", "superadmin"]);

export const customerLeadSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(160),
  phone: z.string().trim().min(8).max(20),
  careFor: z.string().trim().max(80).optional(),
  careNeed: z.string().trim().max(140).optional(),
  preferredContact: z.string().trim().max(40).optional(),
  source: z.string().trim().max(40).optional()
});

export const bookingLocationSchema = z.object({
  label: z.string().trim().min(1).max(120),
  detail: z.string().trim().min(1).max(500),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  placeId: z.string().trim().max(160).optional()
});

export const analyticsEventSchema = z.object({
  name: z.string().trim().min(2).max(120),
  bookingId: z.string().trim().max(120).optional(),
  properties: z.record(z.string(), z.unknown()).default({})
});

export const authStateSchema = z.object({
  user: z
    .object({
      id: z.string().trim().min(1).max(160),
      email: z.string().trim().email().max(160).optional(),
      name: z.string().trim().min(1).max(120),
      role: userRoleSchema,
      phone: z.string().trim().min(8).max(20).optional()
    })
    .nullable(),
  ready: z.boolean(),
  sessionId: z.string().trim().min(1).max(220).nullable()
});

export const careStateSchema = z.union([
  z.object({ type: z.literal("idle"), data: z.null() }),
  z.object({ type: z.literal("journey"), data: z.object({ id: z.string().trim().min(1) }) }),
  z.object({ type: z.literal("booking"), data: z.object({ id: z.string().trim().min(1) }) })
]);

export const customerTabSchema = z.enum(["home", "journey", "profile"]);
export const bookingStepSchema = z.enum([
  "need",
  "service",
  "duration",
  "time",
  "location",
  "review"
]);

export const uiStateSchema = z.object({
  activeTab: customerTabSchema,
  bookingOpen: z.boolean(),
  bookingStep: bookingStepSchema,
  careOnWay: z.boolean(),
  sidebarOpen: z.boolean().default(false),
  darkMode: z.boolean().default(true)
});

export const appStateSchema = z.object({
  auth: authStateSchema,
  care: careStateSchema,
  ui: uiStateSchema
});

export type CustomerLeadInput = z.infer<typeof customerLeadSchema>;
export type BookingLocationInput = z.infer<typeof bookingLocationSchema>;
export type AnalyticsEventInput = z.infer<typeof analyticsEventSchema>;
export type AuthStateInput = z.infer<typeof authStateSchema>;
export type CareStateInput = z.infer<typeof careStateSchema>;
export type CustomerTabInput = z.infer<typeof customerTabSchema>;
export type BookingStepInput = z.infer<typeof bookingStepSchema>;
export type UiStateInput = z.infer<typeof uiStateSchema>;
export type AppStateInput = z.infer<typeof appStateSchema>;
