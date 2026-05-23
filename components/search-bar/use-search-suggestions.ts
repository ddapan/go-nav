"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import type {
	BaiduSuggestionResponse,
	SuggestionItem,
} from "./search-bar.types";

const EMPTY_SUGGESTIONS: SuggestionItem[] = [];

export function useSearchSuggestions({
	enableSuggestion,
	isLocal,
	query,
}: {
	enableSuggestion: boolean;
	isLocal: boolean;
	query: string;
}) {
	const [suggestions, setSuggestions] = useState<SuggestionItem[]>(
		EMPTY_SUGGESTIONS,
	);
	const [, startTransition] = useTransition();
	const suggestionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const suggestionRequestRef = useRef(0);

	useEffect(() => {
		if (isLocal || !enableSuggestion || !query.trim()) {
			suggestionRequestRef.current += 1;
			setSuggestions((prev) =>
				prev.length === 0 ? prev : EMPTY_SUGGESTIONS,
			);
			return;
		}

		if (suggestionTimerRef.current) {
			clearTimeout(suggestionTimerRef.current);
		}

		const requestId = suggestionRequestRef.current + 1;
		suggestionRequestRef.current = requestId;
		suggestionTimerRef.current = setTimeout(() => {
			const content = query.trim();
			const api = `https://suggestion.baidu.com/su?wd=${encodeURIComponent(content)}&ie=utf-8&p=3`;

			import("fetch-jsonp")
				.then((mod) => mod.default(api, { jsonpCallback: "cb" }))
				.then((response) => response.json())
				.then((data: BaiduSuggestionResponse) => {
					if (suggestionRequestRef.current !== requestId) return;
					const nextSuggestions = (data.s ?? [])
						.filter((item): item is string => typeof item === "string")
						.slice(0, 10)
						.map((item, index) => ({
							label: item,
							key: index,
						}));

					startTransition(() => {
						setSuggestions(
							nextSuggestions.length === 0
								? EMPTY_SUGGESTIONS
								: nextSuggestions,
						);
					});
				})
				.catch(() => {
					if (suggestionRequestRef.current !== requestId) return;
					startTransition(() => {
						setSuggestions((prev) =>
							prev.length === 0 ? prev : EMPTY_SUGGESTIONS,
						);
					});
				});
		}, 300);

		return () => {
			if (suggestionTimerRef.current) {
				clearTimeout(suggestionTimerRef.current);
			}
		};
	}, [enableSuggestion, isLocal, query]);

	return {
		suggestions,
		clearSuggestions: () =>
			setSuggestions((prev) => (prev.length === 0 ? prev : EMPTY_SUGGESTIONS)),
	};
}
