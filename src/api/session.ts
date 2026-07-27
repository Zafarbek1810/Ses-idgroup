export type AuthUser = {
  id: number;
  username: string;
  surname: string;
  email: string;
  createdAt: string;
};

export type LoginResponse = {
  user: AuthUser & { password?: string };
  accessToken: string;
  exspiresIn_accessToken: string;
  refreshToken: string;
  exspiresIn_refreshToken: string;
};

const STORAGE_KEYS = {
  accessToken: "ses_access_token",
  refreshToken: "ses_refresh_token",
  user: "ses_user",
} as const;

function storage(persist: boolean): Storage {
  return persist ? localStorage : sessionStorage;
}

export function saveSession(data: LoginResponse, persist = true) {
  const store = storage(persist);
  const other = persist ? sessionStorage : localStorage;

  other.removeItem(STORAGE_KEYS.accessToken);
  other.removeItem(STORAGE_KEYS.refreshToken);
  other.removeItem(STORAGE_KEYS.user);

  const { password: _pw, ...safeUser } = data.user;
  store.setItem(STORAGE_KEYS.accessToken, data.accessToken);
  store.setItem(STORAGE_KEYS.refreshToken, data.refreshToken);
  store.setItem(STORAGE_KEYS.user, JSON.stringify(safeUser));
}

export function clearSession() {
  for (const store of [localStorage, sessionStorage]) {
    store.removeItem(STORAGE_KEYS.accessToken);
    store.removeItem(STORAGE_KEYS.refreshToken);
    store.removeItem(STORAGE_KEYS.user);
  }
}

export function getAccessToken(): string | null {
  return (
    localStorage.getItem(STORAGE_KEYS.accessToken) ??
    sessionStorage.getItem(STORAGE_KEYS.accessToken)
  );
}

export function getRefreshToken(): string | null {
  return (
    localStorage.getItem(STORAGE_KEYS.refreshToken) ??
    sessionStorage.getItem(STORAGE_KEYS.refreshToken)
  );
}

export function getStoredUser(): AuthUser | null {
  const raw =
    localStorage.getItem(STORAGE_KEYS.user) ??
    sessionStorage.getItem(STORAGE_KEYS.user);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

export function isAuthenticated(): boolean {
  return Boolean(getAccessToken());
}
