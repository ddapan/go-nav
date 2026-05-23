"use client";

import {
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
	type SetStateAction,
} from "react";
import type { NavCategory } from "@/types";
import {
	clearHomeSnapshot,
	consumeHomeRestoreRequest,
	readHomeSnapshot,
} from "@/lib/client/home-restore";
import {
	collectSiteDetailEntries,
	findSiteDetailEntryBySlug,
	type SiteDetailEntry,
} from "@/lib/site-detail";

export function useHomeRouteState({
	pathname,
	categories,
	detailEnabled,
	setActiveId,
}: {
	pathname: string;
	categories: NavCategory[];
	detailEnabled: boolean;
	setActiveId: (value: SetStateAction<string | undefined>) => void;
}) {
	const [disableRecentVisitsEntrance, setDisableRecentVisitsEntrance] =
		useState(false);
	const restoredFromDetailRef = useRef(false);

	const detailSlug = useMemo(() => {
		if (!pathname.startsWith("/site/")) return null;
		const rawSlug = pathname.slice("/site/".length).split("/")[0];
		if (!rawSlug) return null;
		try {
			return decodeURIComponent(rawSlug);
		} catch {
			return rawSlug;
		}
	}, [pathname]);

	const isDetailRoute = detailSlug !== null;
	const detailEntries = useMemo(
		() => collectSiteDetailEntries(categories),
		[categories],
	);
	const selectedEntry = useMemo<SiteDetailEntry | null>(() => {
		if (!detailEnabled || !detailSlug) return null;
		return findSiteDetailEntryBySlug(detailEntries, detailSlug);
	}, [detailEnabled, detailEntries, detailSlug]);

	useEffect(() => {
		if (!isDetailRoute) return;
		window.scrollTo({ top: 0, behavior: "auto" });
	}, [isDetailRoute, pathname]);

	useEffect(() => {
		if (pathname !== "/") return;

		const shouldRestore = consumeHomeRestoreRequest();
		if (!shouldRestore) {
			restoredFromDetailRef.current = false;
			return;
		}

		restoredFromDetailRef.current = true;
		setDisableRecentVisitsEntrance(true);

		const snapshot = readHomeSnapshot();
		if (!snapshot) return;

		if (snapshot.activeId) {
			setActiveId(snapshot.activeId);
		}

		const restoreSmooth = () =>
			window.scrollTo({ top: snapshot.scrollY, behavior: "smooth" });
		const restoreFinal = () =>
			window.scrollTo({ top: snapshot.scrollY, behavior: "auto" });
		const timers = [
			window.setTimeout(restoreSmooth, 40),
			window.setTimeout(restoreFinal, 900),
		];

		requestAnimationFrame(restoreSmooth);
		clearHomeSnapshot();

		return () => {
			for (const timer of timers) {
				window.clearTimeout(timer);
			}
		};
	}, [pathname, setActiveId]);

	useLayoutEffect(() => {
		if (pathname !== "/") return;
		if (restoredFromDetailRef.current) return;

		const navEntry = performance.getEntriesByType("navigation")[0] as
			| PerformanceNavigationTiming
			| undefined;
		if (navEntry?.type !== "reload") return;

		window.scrollTo({ top: 0, behavior: "auto" });
		const firstParentId = categories[0]?.id;
		if (firstParentId) {
			setActiveId((prev) => (prev === firstParentId ? prev : firstParentId));
		}
	}, [categories, pathname, setActiveId]);

	useEffect(() => {
		if (pathname !== "/") {
			setDisableRecentVisitsEntrance(false);
		}
	}, [pathname]);

	return {
		disableRecentVisitsEntrance,
		isDetailRoute,
		selectedEntry,
	};
}
