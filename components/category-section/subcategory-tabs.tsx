"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import type { NavCategory } from "@/types";
import type { CategorySectionModel } from "../layout.types";
import { IconView } from "../icon-view";
import { TabPanelContent } from "./category-section-content";

export function SubcategoryTabs({
	category,
	view,
}: {
	category: NavCategory;
	view: CategorySectionModel;
}) {
	const tabs = useMemo(() => category.children ?? [], [category.children]);
	const scrollerRef = useRef<HTMLDivElement>(null);
	const tabButtonRefs = useRef<Array<HTMLButtonElement | null>>([]);
	const firstTabId = tabs[0]?.id ?? "";
	const [selectedTabId, setSelectedTabId] = useState(firstTabId);

	useEffect(() => {
		if (!firstTabId) return;
		setSelectedTabId((current) =>
			tabs.some((tab) => tab.id === current) ? current : firstTabId,
		);
	}, [firstTabId, tabs]);

	const selectedIndex = useMemo(() => {
		const index = tabs.findIndex((tab) => tab.id === selectedTabId);
		return index >= 0 ? index : 0;
	}, [selectedTabId, tabs]);
	const activeTab = tabs[selectedIndex] ?? tabs[0];

	const focusTab = useCallback((index: number) => {
		requestAnimationFrame(() => {
			tabButtonRefs.current[index]?.focus();
		});
	}, []);

	const handleTabKeyDown = useCallback(
		(event: ReactKeyboardEvent<HTMLDivElement>) => {
			if (tabs.length === 0) return;

			let nextIndex = selectedIndex;
			if (event.key === "ArrowRight") {
				nextIndex = (selectedIndex + 1) % tabs.length;
			} else if (event.key === "ArrowLeft") {
				nextIndex = (selectedIndex - 1 + tabs.length) % tabs.length;
			} else if (event.key === "Home") {
				nextIndex = 0;
			} else if (event.key === "End") {
				nextIndex = tabs.length - 1;
			} else {
				return;
			}

			event.preventDefault();
			const nextTab = tabs[nextIndex];
			if (!nextTab) return;
			setSelectedTabId(nextTab.id);
			focusTab(nextIndex);
		},
		[focusTab, selectedIndex, tabs],
	);

	useEffect(() => {
		const element = scrollerRef.current;
		if (!element) return;

		const onWheel = (event: WheelEvent) => {
			if (element.scrollWidth <= element.clientWidth) return;

			const hasHorizontalDelta =
				Math.abs(event.deltaX) > Math.abs(event.deltaY);
			const maxScrollLeft = element.scrollWidth - element.clientWidth;

			if (event.shiftKey) {
				const delta = hasHorizontalDelta ? event.deltaX : event.deltaY;
				event.preventDefault();
				element.scrollLeft = Math.max(
					0,
					Math.min(maxScrollLeft, element.scrollLeft + delta),
				);
				return;
			}

			if (!hasHorizontalDelta) return;

			const nextScrollLeft = element.scrollLeft + event.deltaX;
			const canScrollHorizontally =
				(event.deltaX < 0 && element.scrollLeft > 0) ||
				(event.deltaX > 0 && element.scrollLeft < maxScrollLeft);

			if (!canScrollHorizontally) return;
			event.preventDefault();
			element.scrollLeft = Math.max(
				0,
				Math.min(maxScrollLeft, nextScrollLeft),
			);
		};

		element.addEventListener("wheel", onWheel, { passive: false });
		return () => element.removeEventListener("wheel", onWheel);
	}, []);

	const panelId = activeTab ? `${category.id}-${activeTab.id}-panel` : undefined;
	const selectedTabButtonId = activeTab
		? `${category.id}-${activeTab.id}-tab`
		: undefined;

	return (
		<div className="w-full">
			<div
				ref={scrollerRef}
				className="w-full overflow-x-auto px-2 scrollbar-none [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
			>
				<div
					role="tablist"
					aria-label={`${category.name}的子分类`}
					className="inline-flex min-w-max items-center gap-1 rounded-2xl bg-black/4 p-1 dark:bg-white/8"
					onKeyDown={handleTabKeyDown}
				>
					{tabs.map((tab, index) => {
						const selected = index === selectedIndex;
						const tabButtonId = `${category.id}-${tab.id}-tab`;
						const tabPanelId = `${category.id}-${tab.id}-panel`;

						return (
							<button
								key={tab.id}
								ref={(node) => {
									tabButtonRefs.current[index] = node;
								}}
								type="button"
								id={tabButtonId}
								role="tab"
								aria-selected={selected}
								aria-controls={tabPanelId}
								tabIndex={selected ? 0 : -1}
								className={`inline-flex h-8 shrink-0 cursor-pointer items-center rounded-xl px-3 text-sm font-medium text-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
									selected
										? "bg-(--primary-foreground) text-zinc-950 shadow-sm dark:text-zinc-100"
										: "text-muted [@media(hover:hover)]:hover:bg-black/5 [@media(hover:hover)]:hover:text-zinc-900 dark:[@media(hover:hover)]:hover:bg-white/8 dark:[@media(hover:hover)]:hover:text-zinc-100"
								}`}
								onClick={() => {
									setSelectedTabId(tab.id);
								}}
							>
								{tab.icon ? (
									<span className="mr-1 inline-flex items-center" aria-hidden>
										<IconView icon={tab.icon} size={14} />
									</span>
								) : null}
								{tab.name}
							</button>
						);
					})}
				</div>
			</div>

			{activeTab ? (
				<div
					id={panelId}
					role="tabpanel"
					aria-labelledby={selectedTabButtonId}
					className="p-0"
					tabIndex={0}
				>
					<TabPanelContent tab={activeTab} view={view} />
				</div>
			) : null}
		</div>
	);
}
