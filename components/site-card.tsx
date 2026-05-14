"use client";

import { memo } from "react";
import type { LayoutConfig, NavSite } from "@/types";
import { recordVisit } from "@/hooks/use-recent-visits";
import { SiteIcon } from "./site-icon";
export {
	isTransparentColor,
	resolveConfiguredValue,
	resolveSiteBackgroundColor,
	toPx,
} from "./site-icon";

/** SiteCard 接受的站点数据，description 可选以兼容 RecentVisit */
export interface SiteCardData {
	url: string;
	title: string;
	icon?: string;
	description?: string;
	tags?: string[];
}

/**
 * 通用网站卡片 - 同时用于分类网格和最近访问
 * 大量渲染场景（>1 万）下：移除 useCallback / 子 memo 子组件，
 * 减少每个实例的 hook slot 与额外函数组件实例。
 */
export const SiteCard = memo(function SiteCard({
	site,
	trackVisit = true,
	layout,
}: {
	site: SiteCardData;
	trackVisit?: boolean;
	layout?: Required<LayoutConfig>;
}) {
	return (
		<a
			href={site.url}
			target="_blank"
			rel="noopener noreferrer"
			aria-label={site.title}
			onClick={trackVisit ? () => recordVisit(site as NavSite) : undefined}
			className="group flex transform-gpu items-center gap-3 rounded-xl bg-white p-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary dark:bg-zinc-800 [@media(hover:hover)]:hover:-translate-y-0.5 [@media(hover:hover)]:hover:bg-white [@media(hover:hover)]:hover:shadow-[0_12px_28px_rgba(15,23,42,0.11)] active:translate-y-0 active:scale-[0.99] dark:[@media(hover:hover)]:hover:bg-zinc-800"
		>
			<SiteIcon
				site={site as NavSite}
				layout={layout}
				size={40}
				className="text-lg! transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] [@media(hover:hover)]:group-hover:scale-105"
				initialClassName="text-sm!"
			/>
			<div className="min-w-0 flex-1">
				<div className="truncate text-sm font-medium">{site.title}</div>
				<div className="mt-0.5 truncate text-xs text-muted">
					{site.description}
				</div>
			</div>
		</a>
	);
});
