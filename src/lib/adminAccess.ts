// Admin access levels (admin_users.access) and the rules the Access page enforces. Pure, so
// tests/ can load it and the browser can import it.

export type AccessLevel = "partner" | "it_admin" | "investor";

export const ACCESS_LEVELS: Array<{ id: AccessLevel; label: string; full: boolean }> = [
  { id: "partner", label: "Partner", full: true },
  { id: "it_admin", label: "IT admin", full: true },
  { id: "investor", label: "Investor", full: false },
];

// Partners and IT admins see and manage everything; investors see the CMS dashboard and
// enquiries, optionally only some stations. Same rule as admin_full_access() in Postgres.
export function hasFullAccess(access: string | null | undefined) {
  return ACCESS_LEVELS.some((level) => level.id === access && level.full);
}

export function accessLabel(access: string | null | undefined) {
  return ACCESS_LEVELS.find((level) => level.id === access)?.label ?? "Admin";
}

export type AdminRecord = { user_id: string; access: string; active: boolean };

// Why a change to `target` would be refused, or null. `actorId` is the admin making it.
// Nobody can lower their own access or turn themselves off, and the last active full-access
// admin stays, so the admin can never lock everyone out.
export function accessChangeError(
  admins: AdminRecord[],
  actorId: string,
  targetId: string,
  change: { access?: string; active?: boolean }
) {
  const target = admins.find((a) => a.user_id === targetId);
  if (!target) return "That admin does not exist.";
  if (change.access !== undefined && !ACCESS_LEVELS.some((l) => l.id === change.access)) return "Unknown access level.";
  const losesFull =
    hasFullAccess(target.access) && target.active &&
    ((change.access !== undefined && !hasFullAccess(change.access)) || change.active === false);
  if (targetId === actorId && losesFull) return "You cannot remove your own full access or turn yourself off.";
  if (losesFull && !admins.some((a) => a.user_id !== targetId && a.active && hasFullAccess(a.access))) {
    return "At least one active partner or IT admin must remain.";
  }
  return null;
}

// A plain email check for invites (Supabase validates it again).
export const isEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
