import type { CSSProperties } from "react";
import type { NavCategory } from "@/types";
import type { CardGridModel, CategorySectionModel } from "../layout.types";

export interface DisplayCategoryItem {
	category: NavCategory;
	isChild: boolean;
}

export interface AppLayoutViewModel {
	appShellStyle: CSSProperties;
	cardGrid: CardGridModel;
	categorySectionView: CategorySectionModel;
	displayCategories: DisplayCategoryItem[];
	mainStyle: CSSProperties;
	sectionsStyle: CSSProperties;
	sidebarWidth: string;
}
