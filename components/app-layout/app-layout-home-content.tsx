"use client";

import type { LayoutConfig } from "@/types";
import { CategorySection } from "../category-section";
import { RecentVisits } from "../recent-visits";
import { PageEmptyState } from "../ui/empty-state-blocks";
import type { AppLayoutViewModel } from "./app-layout.types";

export function AppLayoutHomeContent({
	displayCategories,
	layout,
	recentVisitsMax,
	showRecentVisits,
	disableRecentVisitsEntrance,
	cardGrid,
	categorySectionView,
	sectionsStyle,
}: Pick<
	AppLayoutViewModel,
	"displayCategories" | "cardGrid" | "categorySectionView" | "sectionsStyle"
> & {
	layout: Required<LayoutConfig>;
	recentVisitsMax: number;
	showRecentVisits: boolean;
	disableRecentVisitsEntrance: boolean;
}) {
	if (displayCategories.length === 0) {
		return (
			<PageEmptyState
				title="开始使用 Go Nav"
				description="还没有添加任何网站分类和内容，请先在后台管理中添加分类与网站。"
			/>
		);
	}

	return (
		<>
			{showRecentVisits ? (
				<RecentVisits
					maxItems={recentVisitsMax}
					cards={cardGrid}
					disableEntranceAnimation={disableRecentVisitsEntrance}
					layout={layout}
				/>
			) : null}

			<div style={sectionsStyle}>
				{displayCategories.map((item) => (
					<CategorySection
						key={item.category.id}
						category={item.category}
						isChild={item.isChild}
						view={categorySectionView}
					/>
				))}
			</div>
		</>
	);
}
