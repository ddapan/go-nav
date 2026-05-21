const HOME_SNAPSHOT_KEY = "go-nav:home-snapshot";
const HOME_RESTORE_FLAG_KEY = "go-nav:home-restore";

export interface HomeSnapshot {
	scrollY: number;
	activeId?: string;
}

export function saveHomeSnapshot(snapshot: HomeSnapshot) {
	if (typeof window === "undefined") return;
	try {
		sessionStorage.setItem(HOME_SNAPSHOT_KEY, JSON.stringify(snapshot));
	} catch {
		// ignore
	}
}

export function readHomeSnapshot(): HomeSnapshot | null {
	if (typeof window === "undefined") return null;
	const raw = sessionStorage.getItem(HOME_SNAPSHOT_KEY);
	if (!raw) return null;
	try {
		const parsed = JSON.parse(raw) as Partial<HomeSnapshot>;
		if (typeof parsed.scrollY !== "number") return null;
		return {
			scrollY: parsed.scrollY,
			activeId: typeof parsed.activeId === "string" ? parsed.activeId : undefined,
		};
	} catch {
		return null;
	}
}

export function clearHomeSnapshot() {
	if (typeof window === "undefined") return;
	sessionStorage.removeItem(HOME_SNAPSHOT_KEY);
}

export function requestHomeRestore() {
	if (typeof window === "undefined") return;
	sessionStorage.setItem(HOME_RESTORE_FLAG_KEY, "1");
}

export function consumeHomeRestoreRequest(): boolean {
	if (typeof window === "undefined") return false;
	const flagged = sessionStorage.getItem(HOME_RESTORE_FLAG_KEY) === "1";
	if (flagged) {
		sessionStorage.removeItem(HOME_RESTORE_FLAG_KEY);
	}
	return flagged;
}
