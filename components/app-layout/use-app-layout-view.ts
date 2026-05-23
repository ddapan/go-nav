"use client";

import { useMemo, type CSSProperties } from "react";
import type { NavCategory, LayoutConfig } from "@/types";
import { toPx } from "../site-icon";
import type {
	AppLayoutViewModel,
	DisplayCategoryItem,
} from "./app-layout.types";
import type {
	CardGridModel,
	CategoryDisplayModel,
	CategorySectionModel,
} from "../layout.types";

export function useAppLayoutView({
	layout,
	categories,
	showSubcategoryTabs,
}: {
	layout: Required<LayoutConfig>;
	categories: NavCategory[];
	showSubcategoryTabs: boolean;
}): AppLayoutViewModel {
	const contentPaddingLeft = toPx(layout.contentPaddingLeft);
	const contentPaddingRight = toPx(layout.contentPaddingRight);

	const cardGrid = useMemo<CardGridModel>(
		() => ({
			minWidth: toPx(layout.cardMinWidth) ?? "160px",
			height: toPx(layout.cardHeight) ?? "64px",
			padding: toPx(layout.cardGridPadding) ?? "8px",
		}),
		[layout.cardGridPadding, layout.cardHeight, layout.cardMinWidth],
	);

	const categoryDisplay = useMemo<CategoryDisplayModel>(
		() => ({
			showTitle: layout.showCategoryTitle,
			showDescription: layout.showCategoryDescription,
		}),
		[layout.showCategoryDescription, layout.showCategoryTitle],
	);

	const categorySectionView = useMemo<CategorySectionModel>(
		() => ({
			cards: cardGrid,
			display: categoryDisplay,
			layout,
		}),
		[cardGrid, categoryDisplay, layout],
	);

	const displayCategories = useMemo<DisplayCategoryItem[]>(() => {
		if (showSubcategoryTabs) {
			return categories.map((category) => ({ category, isChild: false }));
		}

		const flattened: DisplayCategoryItem[] = [];
		for (const category of categories) {
			flattened.push({ category, isChild: false });
			if (!category.children?.length) continue;

			for (const child of category.children) {
				flattened.push({ category: child, isChild: true });
			}
		}

		return flattened;
	}, [categories, showSubcategoryTabs]);

	const appShellStyle = useMemo(
		() =>
			({
				maxWidth: toPx(layout.maxWidth),
				"--content-pad-mobile": contentPaddingLeft,
				"--content-pad-left": contentPaddingLeft,
				"--content-pad-right": contentPaddingRight,
			}) as CSSProperties,
		[contentPaddingLeft, contentPaddingRight, layout.maxWidth],
	);

	const mainStyle = useMemo(
		() =>
			({
				paddingBottom: "max(2.5rem, env(safe-area-inset-bottom))",
			}) as CSSProperties,
		[],
	);

	const sectionsStyle = useMemo(
		() =>
			({
				display: "flex",
				flexDirection: "column",
				gap: toPx(layout.sectionGap),
			}) as CSSProperties,
		[layout.sectionGap],
	);

	return {
		appShellStyle,
		cardGrid,
		categorySectionView,
		displayCategories,
		mainStyle,
		sectionsStyle,
		sidebarWidth: toPx(layout.sidebarWidth) ?? "224px",
	};
}
