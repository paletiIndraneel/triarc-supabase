// Admin roles and the rules the Access page enforces. A role is a value of the admin_access
// picklist (admin_users.access); the list itself comes from the database
// (admin_access_levels()), so a value added there needs no code change. Pure, so tests/ can
// load it and the browser can import it.

export type AccessLevel = string;
export type Level = { id: AccessLevel; label: string; full: boolean };

// The roles that see and manage everything. Same set as admin_full_access() in Postgres; any
// other role sees the CMS dashboard and enquiries, for all stations or only its own.
export const FULL_ACCESS_ROLES = ["partner", "it_admin"];

export function hasFullAccess(access: string | null | undefined) {
  return FULL_ACCESS_ROLES.includes(access ?? "");
}

// A picklist value as people read it: "it_admin" -> "IT admin", "partner" -> "Partner"
// (words of two letters or fewer are taken as abbreviations).
export function roleLabel(access: string | null | undefined) {
  if (!access) return "Admin";
  const words = access.split("_").filter(Boolean).map((w) => (w.length <= 2 ? w.toUpperCase() : w.toLowerCase()));
  const label = words.join(" ");
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function toLevels(values: string[]): Level[] {
  return values.map((id) => ({ id, label: roleLabel(id), full: hasFullAccess(id) }));
}

export type AdminRecord = { user_id: string; access: string; active: boolean };

// Why a change to `target` would be refused, or null. `actorId` is the admin making it and
// `levels` the picklist's values. Nobody can lower their own access or turn themselves off,
// and the last active full-access admin stays, so the admin can never lock everyone out.
export function accessChangeError(
  admins: AdminRecord[],
  actorId: string,
  targetId: string,
  change: { access?: string; active?: boolean },
  levels: string[]
) {
  const target = admins.find((a) => a.user_id === targetId);
  if (!target) return "That admin does not exist.";
  if (change.access !== undefined && !levels.includes(change.access)) return "Unknown access level.";
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
