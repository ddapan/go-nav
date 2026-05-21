"use client";
import { BiLinkExternal } from "react-icons/bi";
import { useCallback, useEffect, useMemo } from "react";
import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAtomValue, useSetAtom } from "jotai";
import { Button, Chip, EmptyState } from "@heroui/react";
import { HeaderBundle } from "./header-bundle";
import { AppSidebar } from "./app-sidebar";
import { AppFooter } from "./app-footer";
import { CategorySection } from "./category-section";
import { RecentVisits } from "./recent-visits";
import { FloatingActions } from "./floating-actions";
import { useActiveSectionWriter } from "@/hooks/use-active-section";
import { recordVisit } from "@/hooks/use-recent-visits";
import {
	activeIdAtom,
	adsAspectRatioAtom,
	categoriesAtom,
	enabledAdsAtom,
	layoutAtom,
	recentVisitsMaxAtom,
	showAdsAtom,
	showRecentVisitsAtom,
	showSubcategoryTabsAtom,
} from "@/lib/store/site";
import { openSiteWithPreference } from "@/lib/client/site-link";
import {
	clearHomeSnapshot,
	consumeHomeRestoreRequest,
	readHomeSnapshot,
	requestHomeRestore,
} from "@/lib/client/home-restore";
import {
	collectSiteDetailEntries,
	findSiteDetailEntryBySlug,
	type SiteDetailEntry,
} from "@/lib/site-detail";
import { SiteIcon, toPx } from "./site-icon";
import type { LayoutConfig } from "@/types";

/**
 * 顶层布局组件（Jotai 订阅版）。
 *
 * 设计要点：
 * - 不再接收 props，websiteData / nav 已通过 SiteStoreProvider 水合到 atom。
 * - activeId 改由 useActiveSectionWriter 直接写入 activeIdAtom，
 *   AppLayout 本身不再订阅 activeId，滚动时不会重渲染。
 * - 抽屉开关 / 搜索引擎等状态下沉到 HeaderBundle。
 */
export function AppLayout() {
	const pathname = usePathname();
	const detailSlug = useMemo(() => {
		if (!pathname.startsWith("/site/")) return null;
		const rawSlug = pathname.slice("/site/".length).split("/")[0];
		if (!rawSlug) return null;
		try {
			return decodeURIComponent(rawSlug);
		} catch {
			return rawSlug;
		}
	}, [pathname]);
	const isDetailRoute = detailSlug !== null;
	const layout = useAtomValue(layoutAtom);
	const categories = useAtomValue(categoriesAtom);
	const enabledAds = useAtomValue(enabledAdsAtom);
	const adsAspectRatio = useAtomValue(adsAspectRatioAtom);
	const showAds = useAtomValue(showAdsAtom);
	const showRecentVisits = useAtomValue(showRecentVisitsAtom);
	const recentVisitsMax = useAtomValue(recentVisitsMaxAtom);
	const showSubcategoryTabs = useAtomValue(showSubcategoryTabsAtom);
	const setActiveId = useSetAtom(activeIdAtom);
	const [disableRecentVisitsEntrance, setDisableRecentVisitsEntrance] =
		useState(false);

	const displayCategories = useMemo(() => {
		if (showSubcategoryTabs) return categories.map((c) => ({ category: c, isChild: false }));
		const result: Array<{ category: typeof categories[number]; isChild: boolean }> = [];
		for (const cat of categories) {
			result.push({ category: cat, isChild: false });
			if (cat.children && cat.children.length > 0) {
				for (const child of cat.children) {
					result.push({ category: child, isChild: true });
				}
			}
		}
		return result;
	}, [categories, showSubcategoryTabs]);

	// 滚动监听：只写入 activeIdAtom，不触发本组件重渲染
	useActiveSectionWriter();
	const detailEnabled = layout.enableSiteDetailPage;
	const detailEntries = useMemo(
		() => collectSiteDetailEntries(categories),
		[categories],
	);
	const selectedEntry = useMemo(() => {
		if (!detailEnabled || !detailSlug) return null;
		return findSiteDetailEntryBySlug(detailEntries, detailSlug);
	}, [detailEnabled, detailEntries, detailSlug]);

	// 进入详情页时总是从顶部开始，避免继承上次页面滚动位置
	useEffect(() => {
		if (!isDetailRoute) return;
		window.scrollTo({ top: 0, behavior: "auto" });
	}, [isDetailRoute, pathname]);

	// 从详情返回首页时，恢复离开前的分类和滚动位置
	useEffect(() => {
		if (pathname !== "/") return;
		const shouldRestore = consumeHomeRestoreRequest();
		if (!shouldRestore) return;
		setDisableRecentVisitsEntrance(true);
		const snapshot = readHomeSnapshot();
		if (!snapshot) return;
		if (snapshot.activeId) {
			setActiveId(snapshot.activeId);
		}
		const restoreSmooth = () =>
			window.scrollTo({ top: snapshot.scrollY, behavior: "smooth" });
		const restoreFinal = () =>
			window.scrollTo({ top: snapshot.scrollY, behavior: "auto" });
		const timers = [
			window.setTimeout(restoreSmooth, 40),
			window.setTimeout(restoreFinal, 900),
		];
		requestAnimationFrame(restoreSmooth);
		clearHomeSnapshot();
		return () => {
			for (const timer of timers) {
				window.clearTimeout(timer);
			}
		};
	}, [pathname, setActiveId]);

	useEffect(() => {
		if (pathname !== "/") {
			setDisableRecentVisitsEntrance(false);
		}
	}, [pathname]);

	return (
		<div className="flex min-h-dvh flex-col">
			<HeaderBundle showSearch={layout.showSearch} />

			<div className="flex min-w-0 flex-1">
				{layout.showSidebar && displayCategories.length > 0 && (
					<AppSidebar
						width={toPx(layout.sidebarWidth)}
						ads={enabledAds}
						showAds={showAds}
						adsAspectRatio={adsAspectRatio}
					/>
				)}

				<div
					className={`mx-auto flex min-w-0 flex-1 flex-col w-full px-(--content-pad-mobile) md:pl-(--content-pad-left) md:pr-(--content-pad-right) ${
						layout.showSearch ? "" : "-mt-12"
					}`}
					style={
						{
							maxWidth: toPx(layout.maxWidth),
							"--content-pad-mobile": toPx(layout.contentPaddingLeft),
							"--content-pad-left": toPx(layout.contentPaddingLeft),
							"--content-pad-right": toPx(layout.contentPaddingRight),
						} as React.CSSProperties
					}
				>
					<main className="min-w-0 flex-1 py-2">
						{selectedEntry ? (
							<SiteDetailPage entry={selectedEntry} layout={layout} />
						) : isDetailRoute ? (
							<div className="flex flex-col items-center justify-center py-24">
								<EmptyState className="text-center">
									<h2 className="text-xl font-semibold">未找到该网址</h2>
									<p className="text-sm text-muted">
										当前详情页地址无效，请返回首页重新选择。
									</p>
								</EmptyState>
							</div>
						) : displayCategories.length === 0 ? (
							<div className="flex flex-col items-center justify-center py-24">
								<EmptyState className="text-center">
									<h2 className="text-xl font-semibold">开始使用 Go Nav</h2>
									<p className="text-sm text-muted">
										还没有添加任何网站分类和内容，请先在后台管理中添加分类与网站。
									</p>
								</EmptyState>
							</div>
						) : (
							<>
								{showRecentVisits && (
									<RecentVisits
										maxItems={recentVisitsMax}
										cardMinWidth={toPx(layout.cardMinWidth)}
										cardHeight={toPx(layout.cardHeight)}
										cardGridPadding={toPx(layout.cardGridPadding)}
										sectionGap={toPx(layout.sectionGap)}
										disableEntranceAnimation={
											disableRecentVisitsEntrance
										}
										layout={layout}
									/>
								)}

								<div
									style={{
										display: "flex",
										flexDirection: "column",
										gap: toPx(layout.sectionGap),
									}}
								>
									{displayCategories.map((c) => (
										<CategorySection
											key={c.category.id}
											category={c.category}
											isChild={c.isChild}
											cardMinWidth={toPx(layout.cardMinWidth)}
											cardHeight={toPx(layout.cardHeight)}
											cardGridPadding={toPx(layout.cardGridPadding)}
											showCategoryTitle={layout.showCategoryTitle}
											showCategoryDescription={
												layout.showCategoryDescription
											}
											layout={layout}
										/>
									))}
								</div>
							</>
						)}
					</main>

					{layout.showFooter && (
						<AppFooter showQrCode={layout.showFooterQrCode} />
					)}
				</div>
			</div>

			{layout.showFloatingActions && (
				<FloatingActions showQrCode={layout.showFloatingQrCode} />
			)}
		</div>
	);
}

function SiteDetailPage({
	entry,
	layout,
}: {
	entry: SiteDetailEntry;
	layout: Required<LayoutConfig>;
}) {
	const router = useRouter();
	const site = entry.site;
	const tags = site.tags?.filter((tag) => tag.trim()) ?? [];
	const handleBack = useCallback(() => {
		requestHomeRestore();
		router.push("/", { scroll: false });
	}, [router]);
	const handleVisit = useCallback(() => {
		recordVisit(site);
		void openSiteWithPreference(site, {
			linkTarget: layout.linkTarget,
			autoUseIntranet: layout.autoUseIntranet,
		});
	}, [layout.autoUseIntranet, layout.linkTarget, site]);

		return (
			<section className="w-full px-2">
				<div className="mb-4 flex items-center gap-3">
					<button
						type="button"
						onClick={handleBack}
						aria-label="返回列表"
						className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-black/10 bg-white text-base text-zinc-700 transition hover:border-black/20 hover:text-zinc-900 dark:border-white/10 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-white/20 dark:hover:text-zinc-100"
					>
						←
					</button>
					<h2 className="text-lg font-semibold text-zinc-800 dark:text-zinc-200">
						网址详情
					</h2>
			</div>

			<div className="space-y-4">
				<div className="flex flex-col gap-4 rounded-2xl border border-black/10 bg-white p-4 sm:flex-row sm:items-start sm:justify-between dark:border-white/10 dark:bg-zinc-900">
					<div className="flex items-center gap-4">
						<div className="rounded-2xl border border-black/10 bg-white p-2 dark:border-white/10 dark:bg-zinc-900">
							<SiteIcon
								site={site}
								layout={layout}
								size={56}
								className="shrink-0 text-xl!"
								initialClassName="text-sm!"
							/>
						</div>
						<div>
							<h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
								{site.title}
							</h1>
							{tags.length > 0 ? (
								<div className="mt-3 flex flex-wrap gap-2">
									{tags.map((tag) => (
										<Chip
											key={tag}
											size="sm"
											variant="secondary"
											className="text-xs!"
										>
											{tag}
										</Chip>
									))}
								</div>
							) : null}
						</div>
					</div>
					<div className="sm:self-center">
						<Button variant="primary" onPress={handleVisit}>
							<BiLinkExternal />
							访问链接
						</Button>
					</div>
				</div>

				<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
					<div className="rounded-2xl border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-zinc-900">
						<p className="text-xs font-medium uppercase tracking-[0.08em] text-zinc-500">
							链接
						</p>
						<a
							href={site.url}
							target="_blank"
							rel="noopener noreferrer"
							className="mt-2 block break-all text-sm leading-6 text-primary underline-offset-4 hover:underline"
						>
							{site.url}
						</a>
					</div>
					<div className="rounded-2xl border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-zinc-900">
						<p className="text-xs font-medium uppercase tracking-[0.08em] text-zinc-500">
							分类
						</p>
						<p className="mt-2 text-sm leading-6 text-zinc-700 dark:text-zinc-300">
							{entry.categoryPath.join(" / ")}
						</p>
					</div>
				</div>

				{site.description ? (
					<div className="rounded-2xl border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-zinc-900">
						<p className="text-xs font-medium uppercase tracking-[0.08em] text-zinc-500">
							描述
						</p>
						<p className="mt-2 text-sm leading-7 text-zinc-700 dark:text-zinc-300">
							{site.description}
						</p>
					</div>
				) : null}

				<div className="space-y-3">
					<p className="text-xs font-medium uppercase tracking-[0.08em] text-zinc-500 px-2">
						预览图
					</p>
					{site.previewImage ? (
						<div className="aspect-video w-full overflow-hidden rounded-2xl border border-black/10 bg-zinc-100 dark:border-white/10 dark:bg-zinc-900">
							{/* eslint-disable-next-line @next/next/no-img-element */}
							<img
								src={site.previewImage}
								alt={`${site.title} 预览图`}
								className="h-full w-full object-cover"
							/>
						</div>
					) : (
						<div className="flex h-24 w-full items-center justify-center rounded-2xl border border-dashed border-black/10 bg-zinc-50 text-xs text-zinc-500 dark:border-white/10 dark:bg-zinc-900/60">
							暂无预览图
						</div>
					)}
				</div>
			</div>
		</section>
	);
}
