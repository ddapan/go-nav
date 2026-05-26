"use client";

import type { HeaderSearchConfig } from "../header.types";

export interface SuggestionItem {
	label: string;
	key: number;
}

export interface BaiduSuggestionResponse {
	s?: unknown[];
}

export type SearchBarSite = HeaderSearchConfig["sites"][number];
