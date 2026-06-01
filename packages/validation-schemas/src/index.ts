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

export type CustomerLeadInput = z.infer<typeof customerLeadSchema>;
export type BookingLocationInput = z.infer<typeof bookingLocationSchema>;
export type AnalyticsEventInput = z.infer<typeof analyticsEventSchema>;
