"use client";

import { memo } from "react";
import { useSiteLinkMode } from "@/lib/client/site-link";
import type { SiteGridProps } from "./site-card.types";
import { SiteCard } from "./site-card-item";
import { useSiteGridBatch } from "./use-site-grid-batch";

export const SiteGrid = memo(function SiteGrid({
	sites,
	cards,
	trackVisit = true,
	layout,
}: SiteGridProps) {
	const siteLinkMode = useSiteLinkMode();
	const { total, visibleKeys, visibleSites } = useSiteGridBatch(sites);
	if (total === 0) return null;

	const effectiveCardHeight =
		layout?.cardStyle === "preview" ? `calc(${cards.height} * 2)` : cards.height;

	return (
		<div style={{ padding: `8px ${cards.padding}` }}>
			<div
				className="grid gap-3"
				style={{
					gridTemplateColumns: `repeat(auto-fill, minmax(${cards.minWidth}, 1fr))`,
					gridAutoRows: effectiveCardHeight,
				}}
			>
				{visibleSites.map((site, index) => (
					<SiteCard
						key={visibleKeys[index]}
						site={site}
						trackVisit={trackVisit}
						layout={layout}
						siteLinkMode={siteLinkMode}
					/>
				))}
			</div>
		</div>
	);
});
