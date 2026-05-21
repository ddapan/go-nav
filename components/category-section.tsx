"use client";

import {
	memo,
	useEffect,
	useMemo,
	useRef,
	useState
} from "react";
import { Tabs } from "@heroui/react";
import type { LayoutConfig, NavCategory } from "@/types";
import { IconView } from "./icon-view";
import { SiteGrid } from "./site-card";

export const CategorySection = memo(function CategorySection({
	category,
	cardMinWidth = "160px",
	cardHeight = "64px",
	cardGridPadding = "8px",
	showCategoryTitle = true,
	showCategoryDescription = true,
	layout,
	isChild = false,
}: {
	category: NavCategory;
	cardMinWidth?: string;
	cardHeight?: string;
	cardGridPadding?: string;
	showCategoryTitle?: boolean;
	showCategoryDescription?: boolean;
	layout?: Required<LayoutConfig>;
	isChild?: boolean;
}) {
	const hasMultipleChildren =
		(category.children && category.children.length > 1);
	const hasAnyChildren =
		(category.children && category.children.length > 0);
	const useTabs = layout?.showSubcategoryTabs !== false;

	const shouldHideContent =
		!useTabs && hasAnyChildren && !(category.sites && category.sites.length > 0);

	return (
		<section
			id={category.id}
			data-category-id={category.id}
			className="category-anchor scroll-mt-20"
		>
			{showCategoryTitle && (
				<div className={`px-3 flex items-center gap-2 ${isChild ? "text-sm" : "*:text-xl"} ${shouldHideContent ? "" : "mb-3"}`}>
					<IconView icon={category.icon} size={isChild ? 16 : 20} className="align-text-bottom" />
					<h2 className={`font-semibold text-nowrap ${isChild ? "text-lg" : ""}`}>{category.name}</h2>
					{showCategoryDescription && category.description ? (
						<span className="text-sm! font-medium text-muted truncate">
							{category.description}
						</span>
					) : null}
				</div>
			)}

			{hasMultipleChildren && useTabs ? (
				<SubcategoryTabs
					category={category}
					cardMinWidth={cardMinWidth}
					cardHeight={cardHeight}
					cardGridPadding={cardGridPadding}
					showCategoryTitle={showCategoryTitle}
					showCategoryDescription={showCategoryDescription}
					layout={layout}
				/>
			) : !shouldHideContent ? (
				<CategoryContent
					category={category}
					cardMinWidth={cardMinWidth}
					cardHeight={cardHeight}
					cardGridPadding={cardGridPadding}
					showCategoryTitle={showCategoryTitle}
					showCategoryDescription={showCategoryDescription}
					layout={layout}
				/>
			) : null}
		</section>
	);
});

function CategoryContent({
	category,
	cardMinWidth,
	cardHeight,
	cardGridPadding,
	showCategoryTitle,
	showCategoryDescription,
	layout,
}: {
	category: NavCategory;
	cardMinWidth: string;
	cardHeight: string;
	cardGridPadding: string;
	showCategoryTitle: boolean;
	showCategoryDescription: boolean;
	layout?: Required<LayoutConfig>;
}) {
	if (category.children && category.children.length === 1) {
		return (
			<SubcategoryContent
				category={category.children[0]}
				cardMinWidth={cardMinWidth}
				cardHeight={cardHeight}
				cardGridPadding={cardGridPadding}
				showCategoryTitle={showCategoryTitle}
				showCategoryDescription={showCategoryDescription}
				layout={layout}
			/>
		);
	}

	if (category.sites && category.sites.length > 0) {
		return (
			<SiteGrid
				sites={category.sites}
				cardMinWidth={cardMinWidth}
				cardHeight={cardHeight}
				cardGridPadding={cardGridPadding}
				layout={layout}
			/>
		);
	}

	return <EmptyHint />;
}

function SubcategoryTabs({
	category,
	cardMinWidth,
	cardHeight,
	cardGridPadding,
	showCategoryTitle,
	showCategoryDescription,
	layout,
}: {
	category: NavCategory;
	cardMinWidth: string;
	cardHeight: string;
	cardGridPadding: string;
	showCategoryTitle: boolean;
	showCategoryDescription: boolean;
	layout?: Required<LayoutConfig>;
}) {
	const tabs = useMemo(() => category.children ?? [], [category.children]);
	const listRef = useRef<HTMLDivElement>(null);
	const firstTabId = tabs[0]?.id ?? "";
	const [selectedTabId, setSelectedTabId] = useState(firstTabId);
	const [mountedTabIds, setMountedTabIds] = useState<Set<string>>(
		() => new Set(firstTabId ? [firstTabId] : []),
	);

	useEffect(() => {
		if (!firstTabId) return;
		setSelectedTabId((current) =>
			tabs.some((tab) => tab.id === current) ? current : firstTabId,
		);
		setMountedTabIds((current) => {
			if (current.has(firstTabId)) return current;
			const next = new Set(current);
			next.add(firstTabId);
			return next;
		});
	}, [firstTabId, tabs]);

	useEffect(() => {
		const el = listRef.current;
		if (!el) return;

		const onWheel = (e: WheelEvent) => {
			const isOverflowing = el.scrollWidth > el.clientWidth;
			if (!isOverflowing) return;

			if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
				e.preventDefault();
				el.scrollLeft += e.deltaY;
			}
		};

		el.addEventListener("wheel", onWheel, { passive: false });
		return () => el.removeEventListener("wheel", onWheel);
	}, []);

	return (
		<Tabs
			className="w-full"
			selectedKey={selectedTabId}
			onSelectionChange={(key) => {
				const id = String(key);
				setSelectedTabId(id);
				setMountedTabIds((current) => {
					if (current.has(id)) return current;
					const next = new Set(current);
					next.add(id);
					return next;
				});
			}}
		>
			<Tabs.ListContainer
				ref={listRef}
				className="w-full overflow-x-auto px-2"
				style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
			>
				<Tabs.List aria-label={`${category.name}的子分类`} className="w-fit">
					{tabs.map((t) => (
						<Tabs.Tab key={t.id} id={t.id} className="text-nowrap">
							{"icon" in t && t.icon ? (
								<span className="mr-1 inline-flex items-center" aria-hidden>
									<IconView icon={t.icon} size={14} />
								</span>
							) : null}
							{t.name}
							<Tabs.Indicator />
						</Tabs.Tab>
					))}
				</Tabs.List>
			</Tabs.ListContainer>

			{tabs.filter((t) => mountedTabIds.has(t.id)).map((t) => (
				<Tabs.Panel key={t.id} id={t.id} className="p-0">
					{"sites" in t ? (
						<SiteGrid
							sites={t.sites}
							cardMinWidth={cardMinWidth}
							cardHeight={cardHeight}
							cardGridPadding={cardGridPadding}
							layout={layout}
						/>
					) : (
						<SubcategoryContent
							category={t as NavCategory}
							cardMinWidth={cardMinWidth}
							cardHeight={cardHeight}
							cardGridPadding={cardGridPadding}
							showCategoryTitle={showCategoryTitle}
							showCategoryDescription={showCategoryDescription}
							layout={layout}
						/>
					)}
				</Tabs.Panel>
			))}
		</Tabs>
	);
}

function SubcategoryContent({
	category,
	cardMinWidth,
	cardHeight,
	cardGridPadding,
	showCategoryTitle,
	showCategoryDescription,
	layout,
}: {
	category: NavCategory;
	cardMinWidth: string;
	cardHeight: string;
	cardGridPadding: string;
	showCategoryTitle: boolean;
	showCategoryDescription: boolean;
	layout?: Required<LayoutConfig>;
}) {
	return (
		<div id={category.id}>
			{category.sites && category.sites.length > 0 ? (
				<SiteGrid
					sites={category.sites}
					cardMinWidth={cardMinWidth}
					cardHeight={cardHeight}
					cardGridPadding={cardGridPadding}
					layout={layout}
				/>
			) : null}

			{category.children?.map((child) => (
				<div key={child.id} id={child.id} className="category-anchor space-y-3">
					{showCategoryTitle && (
						<h3 className="text-sm font-semibold">
							{child.icon ? (
								<span className="mr-1 inline-flex items-center" aria-hidden>
									<IconView icon={child.icon} size={16} />
								</span>
							) : null}
							{child.name}
							{showCategoryDescription && child.description ? (
								<span className="ml-2 text-sm font-normal text-muted">{child.description}</span>
							) : null}
						</h3>
					)}
					{child.sites && child.sites.length > 0 ? (
						<SiteGrid
							sites={child.sites}
							cardMinWidth={cardMinWidth}
							cardHeight={cardHeight}
							cardGridPadding={cardGridPadding}
							layout={layout}
						/>
					) : null}
				</div>
			))}
		</div>
	);
}

function EmptyHint() {
	return (
		<div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted">
			暂无内容
		</div>
	);
}
