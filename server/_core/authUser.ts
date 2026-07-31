import type { User } from "../../drizzle/schema";

/**
 * The only user shape that may cross the authentication API boundary.
 * Sensitive authentication, lockout, approval, and internal audit fields are
 * deliberately omitted instead of being removed with an object spread.
 */
export type AuthUser = Pick<
  User,
  | "id"
  | "openId"
  | "name"
  | "email"
  | "avatarUrl"
  | "role"
  | "userStatus"
  | "department"
  | "specialty"
  | "employeeNumber"
  | "preferredTheme"
  | "createdAt"
  | "lastSignedIn"
>;

export function toAuthUser(user: User): AuthUser {
  return {
    id: user.id,
    openId: user.openId,
    name: user.name,
    email: user.email,
    avatarUrl: user.avatarUrl,
    role: user.role,
    userStatus: user.userStatus,
    department: user.department,
    specialty: user.specialty,
    employeeNumber: user.employeeNumber,
    preferredTheme: user.preferredTheme,
    createdAt: user.createdAt,
    lastSignedIn: user.lastSignedIn,
  };
}
