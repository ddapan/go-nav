import type { LayoutConfig } from "@/types";

export interface CardGridModel {
	minWidth: string;
	height: string;
	padding: string;
}

export interface CategoryDisplayModel {
	showTitle: boolean;
	showDescription: boolean;
}

export interface CategorySectionModel {
	cards: CardGridModel;
	display: CategoryDisplayModel;
	layout?: Required<LayoutConfig>;
}
