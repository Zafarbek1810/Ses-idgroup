/** App role keys used for menu / page access. */
export type AppRole =
  | "admin"
  | "director"
  | "kassir"
  | "lab_director"
  | "lab_asistant";

/** Nav item ids from App sidebar. */
export type NavId =
  | "dashboard"
  | "management"
  | "companies"
  | "patients"
  | "kassa"
  | "orders"
  | "results"
  | "employees";

const ROLE_NAV: Record<AppRole, readonly NavId[]> = {
  admin: ["dashboard", "companies"],
  director: ["dashboard", "management", "patients", "kassa", "orders", "results"],
  kassir: ["patients", "kassa"],
  lab_director: ["dashboard", "orders", "results"],
  lab_asistant: ["dashboard", "orders"],
};

/** Accept common spellings / casing from the API. */
const ROLE_ALIASES: Record<string, AppRole> = {
  admin: "admin",
  director: "director",
  kassir: "kassir",
  cashier: "kassir",
  lab_director: "lab_director",
  labdirector: "lab_director",
  lab_asistant: "lab_asistant",
  lab_assistant: "lab_asistant",
  labasistant: "lab_asistant",
  labassistant: "lab_asistant",
};

export function normalizeRoleName(name: string | null | undefined): AppRole | null {
  if (!name) return null;
  const key = name.trim().toLowerCase().replace(/[\s-]+/g, "_");
  return ROLE_ALIASES[key] ?? null;
}

export function getAllowedNavIds(roleName: string | null | undefined): readonly NavId[] {
  const role = normalizeRoleName(roleName);
  if (!role) return [];
  return ROLE_NAV[role];
}

export function canAccessNav(roleName: string | null | undefined, navId: string): boolean {
  return getAllowedNavIds(roleName).includes(navId as NavId);
}

export function getDefaultNavId(roleName: string | null | undefined): NavId {
  const allowed = getAllowedNavIds(roleName);
  return allowed[0] ?? "dashboard";
}
