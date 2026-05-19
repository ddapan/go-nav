"use client";

import type { Selection } from "@heroui/react";
import { Chip, EmptyState, ListBox, ListBoxItem } from "@heroui/react";
import type { Key } from "@heroui/react";
import { memo, useCallback, useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAtomValue } from "jotai";
import type { NavCategory } from "@/types";
import { activeIdAtom } from "@/lib/store/site";
import { IconView } from "./icon-view";

function countSites(category: NavCategory): number {
	let count = category.sites?.length ?? 0;
	if (category.children) {
		for (const child of category.children) {
			count += countSites(child);
		}
	}
	return count;
}

/**
 * 分类侧栏（Jotai 订阅版）。
 *
 * 直接订阅 activeIdAtom，滚动时只重渲染本组件，不波及上层 AppSidebar。
 * categories / onItemClick 仍由调用者注入，以便在移动端抽屉里传入"点击后关抽屉"的闭包。
 */
export const CategorySidebar = memo(function CategorySidebar({
	categories,
	onItemClick,
}: {
	categories: NavCategory[];
	onItemClick?: (id: string) => void;
}) {
	const activeId = useAtomValue(activeIdAtom);
	const pathname = usePathname();
	const router = useRouter();
	const topIds = useMemo(() => categories.map((c) => c.id), [categories]);
	const selectedKey =
		!activeId || !topIds.includes(activeId) ? "home" : activeId;
	const inDetailPage = pathname.startsWith("/site/");

	const selectedKeys: Selection = useMemo(
		() => new Set([selectedKey]),
		[selectedKey],
	);

	const hasAnyIcon = useMemo(
		() => categories.some((c) => !!c.icon),
		[categories],
	);

	const siteCounts = useMemo(() => {
		const map = new Map<string, number>();
		for (const c of categories) {
			map.set(c.id, countSites(c));
		}
		return map;
	}, [categories]);

	const jumpTo = useCallback(
		(key: Key) => {
			const id = String(key);
			if (inDetailPage) {
				if (id === "home") {
					onItemClick?.("");
					router.push("/");
					return;
				}
				onItemClick?.(id);
				router.push(`/#${encodeURIComponent(id)}`);
				return;
			}

			if (id === "home") {
				if (typeof window !== "undefined") {
					window.scrollTo({ top: 0, behavior: "smooth" });
				}
				onItemClick?.("");
			} else {
				onItemClick?.(id);
				const el = document.getElementById(id);
				if (el) {
					el.scrollIntoView({ behavior: "smooth", block: "start" });
				}
			}
		},
		[inDetailPage, onItemClick, router],
	);

	if (categories.length === 0) {
		return (
			<div className="flex items-center justify-center p-8">
				<EmptyState className="text-center">
					<p className="text-sm text-muted">暂无分类</p>
				</EmptyState>
			</div>
		);
	}

	return (
		<ListBox
			aria-label="导航菜单"
			selectedKeys={selectedKeys}
			selectionMode="single"
			onSelectionChange={(keys) => {
				const first = [...keys][0];
				if (first) jumpTo(first);
			}}
			className="px-2 *:px-4 *:font-medium"
		>
			{categories.map((c) => {
				const siteCount = siteCounts.get(c.id) ?? 0;
				return (
					<ListBoxItem
						key={c.id}
						id={c.id}
						textValue={c.name}
						className="gap-2.5 rounded-xl data-[selected=true]:bg-(--primary-foreground)! data-[selected=true]:shadow!"
					>
						{hasAnyIcon ? (
							<span
								className="inline-flex h-4 w-4 shrink-0 items-center justify-center text-sm leading-none"
								aria-hidden
							>
								<IconView icon={c.icon} size={16} textClassName="w-full" />
							</span>
						) : (
							<GridIcon />
						)}
						<span className="flex-1 truncate">{c.name}</span>
						{siteCount > 0 && (
							<Chip size="sm" variant="soft" className="ml-auto">
								{siteCount}
							</Chip>
						)}
					</ListBoxItem>
				);
			})}
		</ListBox>
	);
});

function GridIcon() {
	return (
		<svg
			width="16"
			height="16"
			viewBox="0 0 16 16"
			fill="none"
			aria-hidden
			className="shrink-0"
		>
			<rect
				x="2"
				y="2"
				width="5"
				height="5"
				rx="1"
				stroke="currentColor"
				strokeWidth="1.5"
			/>
			<rect
				x="9"
				y="2"
				width="5"
				height="5"
				rx="1"
				stroke="currentColor"
				strokeWidth="1.5"
			/>
			<rect
				x="2"
				y="9"
				width="5"
				height="5"
				rx="1"
				stroke="currentColor"
				strokeWidth="1.5"
			/>
			<rect
				x="9"
				y="9"
				width="5"
				height="5"
				rx="1"
				stroke="currentColor"
				strokeWidth="1.5"
			/>
		</svg>
	);
}
