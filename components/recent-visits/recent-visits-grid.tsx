"use client";

import { memo, type RefObject } from "react";
import type { LayoutConfig } from "@/types";
import type { RecentVisit } from "@/hooks/use-recent-visits";
import type { SiteLinkMode } from "@/lib/client/site-link";
import type { CardGridModel } from "../layout.types";
import { SiteCard } from "../site-card";

export const RecentVisitsGrid = memo(function RecentVisitsGrid({
	visits,
	displayCount,
	cards,
	layout,
	gridRef,
	siteLinkMode,
}: {
	visits: RecentVisit[];
	displayCount: number;
	cards: CardGridModel;
	layout?: Required<LayoutConfig>;
	gridRef: RefObject<HTMLDivElement | null>;
	siteLinkMode: SiteLinkMode;
}) {
	const isPreviewStyle = layout?.cardStyle === "preview";
	const effectiveCardHeight = isPreviewStyle
		? `calc(${cards.height} * 2)`
		: cards.height;

	return (
		<div style={{ padding: `8px ${cards.padding}` }}>
			<div
				ref={gridRef}
				className="grid gap-3"
				style={{
					gridTemplateColumns: `repeat(auto-fill, minmax(${cards.minWidth}, 1fr))`,
					gridAutoRows: effectiveCardHeight,
				}}
			>
				{visits.map((visit, index) => (
					<div
						key={`${visit.url}::${visit.title}`}
						style={{ display: index < displayCount ? undefined : "none" }}
					>
						<SiteCard
							site={visit}
							trackVisit={false}
							layout={layout}
							siteLinkMode={siteLinkMode}
						/>
					</div>
				))}
			</div>
		</div>
	);
});
