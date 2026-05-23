"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import {
	buildSearchIndexEntry,
	getLocalSearchScore,
} from "./search-bar.utils";
import type { SearchBarSite } from "./search-bar.types";

export function useLocalSearch({
	enableLocal,
	isLocal,
	query,
	sites,
}: {
	enableLocal: boolean;
	isLocal: boolean;
	query: string;
	sites: SearchBarSite[];
}) {
	const [searchIndexReady, setSearchIndexReady] = useState(false);

	useEffect(() => {
		if (!isLocal || !query.trim()) return;
		setSearchIndexReady(true);
	}, [isLocal, query]);

	const searchIndex = useMemo(() => {
		if (!enableLocal || !searchIndexReady) {
			return [] as Array<{
				site: SearchBarSite;
				title: string;
				titlePinyin: string;
				titleInitials: string;
				hay: string;
			}>;
		}

		return sites.map((site) => ({
			site,
			...buildSearchIndexEntry(site),
		}));
	}, [enableLocal, searchIndexReady, sites]);

	const deferredQuery = useDeferredValue(query);
	const results = useMemo(() => {
		if (!isLocal) return [] as SearchBarSite[];

		const normalizedQuery = deferredQuery.trim().toLowerCase();
		if (!normalizedQuery) return [] as SearchBarSite[];

		return searchIndex
			.map((entry, index) => ({
				site: entry.site,
				score: getLocalSearchScore(normalizedQuery, entry),
				index,
			}))
			.filter((entry) => Number.isFinite(entry.score))
			.sort((a, b) => a.score - b.score || a.index - b.index)
			.slice(0, 10)
			.map((entry) => entry.site);
	}, [deferredQuery, isLocal, searchIndex]);

	return {
		results,
		markSearchIndexReady: () => setSearchIndexReady(true),
	};
}
