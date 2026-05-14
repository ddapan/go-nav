"use client";

import { useAtomValue } from "jotai";
import { EmptyState } from "@heroui/react";
import { HeaderBundle } from "./header-bundle";
import { AppSidebar } from "./app-sidebar";
import { AppFooter } from "./app-footer";
import { CategorySection } from "./category-section";
import { RecentVisits } from "./recent-visits";
import { FloatingActions } from "./floating-actions";
import { useActiveSectionWriter } from "@/hooks/use-active-section";
import {
	adsAspectRatioAtom,
	categoriesAtom,
	enabledAdsAtom,
	layoutAtom,
	recentVisitsMaxAtom,
	showAdsAtom,
	showRecentVisitsAtom,
} from "@/lib/store/site";
import { toPx } from "./site-icon";

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
	const layout = useAtomValue(layoutAtom);
	const categories = useAtomValue(categoriesAtom);
	const enabledAds = useAtomValue(enabledAdsAtom);
	const adsAspectRatio = useAtomValue(adsAspectRatioAtom);
	const showAds = useAtomValue(showAdsAtom);
	const showRecentVisits = useAtomValue(showRecentVisitsAtom);
	const recentVisitsMax = useAtomValue(recentVisitsMaxAtom);

	// 滚动监听：只写入 activeIdAtom，不触发本组件重渲染
	useActiveSectionWriter();

	return (
		<div className="flex min-h-dvh flex-col">
			<HeaderBundle showSearch={layout.showSearch} />

			<div className="flex min-w-0 flex-1">
				{layout.showSidebar && categories.length > 0 && (
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
						{categories.length === 0 ? (
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
									{categories.map((c) => (
										<CategorySection
											key={c.id}
											category={c}
											cardMinWidth={toPx(layout.cardMinWidth)}
											cardHeight={toPx(layout.cardHeight)}
											cardGridPadding={toPx(layout.cardGridPadding)}
											showCategoryTitle={layout.showCategoryTitle}
											showCategoryDescription={layout.showCategoryDescription}
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
