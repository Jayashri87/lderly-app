export type UserRole = "customer" | "caretaker" | "admin" | "superadmin";

export type SessionUser = {
  uid: string;
  name: string;
  role: UserRole;
  authMode: "firebase" | "demo";
};

export const userRoles: UserRole[] = ["customer", "caretaker", "admin", "superadmin"];

export const isUserRole = (role: unknown): role is UserRole =>
  typeof role === "string" && userRoles.includes(role as UserRole);
