export type ProductEventProperties = Record<string, unknown>;

export type ProductEventPayload = {
  name: string;
  bookingId?: string;
  properties: ProductEventProperties;
};
