"use client";

import type { NavCategory } from "@/types";
import { IconView } from "../icon-view";

export function CategorySectionHeader({
	category,
	showDescription,
	isChild,
	withBottomSpacing,
}: {
	category: NavCategory;
	showDescription: boolean;
	isChild: boolean;
	withBottomSpacing: boolean;
}) {
	return (
		<div
			className={`px-3 flex items-center gap-2 ${isChild ? "text-sm" : "*:text-xl"} ${withBottomSpacing ? "mb-3" : ""}`}
		>
			<IconView
				icon={category.icon}
				size={isChild ? 16 : 20}
				className="align-text-bottom"
			/>
			<h2 className={`font-semibold text-nowrap ${isChild ? "text-lg" : ""}`}>
				{category.name}
			</h2>
			{showDescription && category.description ? (
				<span className="truncate text-sm! font-medium text-muted">
					{category.description}
				</span>
			) : null}
		</div>
	);
}
