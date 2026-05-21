"use client";

import Link from "next/link";
import {
	memo,
	useCallback,
	useEffect,
	useMemo,
	useState,
	type MouseEvent,
} from "react";
import type { LayoutConfig, NavSite } from "@/types";
import { recordVisit } from "@/hooks/use-recent-visits";
import {
	getPreferredSiteHref,
	openSiteWithPreference,
	type SiteLinkMode,
	useSiteLinkMode,
} from "@/lib/client/site-link";
import { saveHomeSnapshot } from "@/lib/client/home-restore";
import { buildSiteDetailPath } from "@/lib/site-detail";
import { SiteIcon } from "./site-icon";
export {
	isTransparentColor,
	resolveConfiguredValue,
	resolveSiteBackgroundColor,
	toPx,
} from "./site-icon";

export interface SiteCardData {
	url: string;
	intranetUrl?: string;
	title: string;
	icon?: string;
	previewImage?: string;
	description?: string;
	tags?: string[];
	bgColor?: string;
	iconPadding?: string;
}

export const SiteCard = memo(function SiteCard({
	site,
	trackVisit = true,
	layout,
	siteLinkMode,
}: {
	site: SiteCardData;
	trackVisit?: boolean;
	layout?: Required<LayoutConfig>;
	siteLinkMode: SiteLinkMode;
}) {
	const detailHref = useMemo(() => buildSiteDetailPath(site), [site]);
	const useDetailPage = layout?.enableSiteDetailPage === true;
	const target =
		useDetailPage || layout?.linkTarget === "current" ? undefined : "_blank";
	const rel = target ? "noopener noreferrer" : undefined;
	const preferredHref = useMemo(
		() =>
			getPreferredSiteHref(
				site,
				{
					autoUseIntranet: layout?.autoUseIntranet,
				},
				siteLinkMode,
			),
		[layout?.autoUseIntranet, site, siteLinkMode],
	);
	const href = useDetailPage ? detailHref : preferredHref;

	const handleClick = useCallback(
		(event: MouseEvent<HTMLAnchorElement>) => {
			if (useDetailPage) return;
			const isModifiedClick =
				event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
			if (isModifiedClick) {
				if (trackVisit) recordVisit(site as NavSite);
				return;
			}

			event.preventDefault();
			if (trackVisit) {
				recordVisit(site as NavSite);
			}
			void openSiteWithPreference(site, {
				linkTarget: layout?.linkTarget,
				autoUseIntranet: layout?.autoUseIntranet,
			});
		},
		[
			layout?.autoUseIntranet,
			layout?.linkTarget,
			site,
			trackVisit,
			useDetailPage,
		],
	);
	const handleAuxClick = useCallback(
		(event: MouseEvent<HTMLAnchorElement>) => {
			if (useDetailPage) return;
			if (event.button !== 1) return;
			event.preventDefault();
			if (trackVisit) {
				recordVisit(site as NavSite);
			}
			void openSiteWithPreference(
				site,
				{
					linkTarget: layout?.linkTarget,
					autoUseIntranet: layout?.autoUseIntranet,
				},
				{ forceNewTab: true },
			);
		},
		[
			layout?.autoUseIntranet,
			layout?.linkTarget,
			site,
			trackVisit,
			useDetailPage,
		],
	);
	const handleDetailNavigate = useCallback(
		(event: MouseEvent<HTMLAnchorElement>) => {
			if (!useDetailPage) return;
			if (event.defaultPrevented) return;
			if (event.button !== 0) return;
			if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
			const selected = document.querySelector<HTMLElement>(
				"aside [role=option][data-selected=true]",
			);
			const fallbackFirst = document.querySelector<HTMLElement>(
				"aside [role=option]",
			);
			saveHomeSnapshot({
				scrollY: window.scrollY,
				activeId: selected?.id || fallbackFirst?.id,
			});
		},
		[useDetailPage],
	);

	if (layout?.cardStyle === "preview") {
		if (useDetailPage) {
			return (
				<Link
					href={detailHref}
					scroll
					onClick={handleDetailNavigate}
					aria-label={site.title}
					className="group relative flex gap-3 h-full transform-gpu flex-col overflow-hidden rounded-2xl border border-black/10 bg-white text-left shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary dark:border-white/10 dark:bg-zinc-900 [@media(hover:hover)]:hover:-translate-y-1 [@media(hover:hover)]:hover:border-black/15 [@media(hover:hover)]:hover:shadow-[0_18px_45px_rgba(15,23,42,0.12)] active:translate-y-0 active:scale-[0.99] dark:[@media(hover:hover)]:hover:border-white/20"
				>
					<div className="relative z-10 p-3">
						<div className="truncate line-clamp-1 font-semibold tracking-[-0.02em] text-zinc-950 dark:text-zinc-50">
							{site.title}
						</div>
						<div
							className="leading-snug text-xs font-medium line-clamp-2 text-zinc-500 dark:text-zinc-400"
							style={{
								display: "-webkit-box",
								WebkitLineClamp: 2,
								WebkitBoxOrient: "vertical",
								overflow: "hidden",
							}}
						>
							{site.description}
						</div>
					</div>

					<div className="absolute flex justify-center top-[50%] left-[15%] h-full w-full">
						<div className="flex h-full w-full origin-center -rotate-8 overflow-hidden rounded-md border border-solid bg-linear-to-br from-zinc-100 to-zinc-300 dark:border-white/10 dark:from-zinc-800 dark:to-zinc-950 transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] [@media(hover:hover)]:group-hover:-translate-y-1 [@media(hover:hover)]:group-hover:-rotate-1">
							{site.previewImage ? (
								// eslint-disable-next-line @next/next/no-img-element
								<img
									src={site.previewImage}
									alt=""
									loading="lazy"
									className="object-cover"
								/>
							) : (
								<>
									{/* <SiteIcon
										className="m-auto mb-[20%]"
										site={site as NavSite}
										layout={layout}
										size={Number(layout.cardHeight) || 72}
										initialClassName="text-sm!"
										showDefaultBackgroundColor={false}
									/> */}
								</>
							)}
						</div>
					</div>
				</Link>
			);
		}

		return (
			<a
				href={href}
				target={target}
				rel={rel}
				aria-label={site.title}
				onClick={handleClick}
				onAuxClick={handleAuxClick}
				className="group relative flex gap-3 h-full transform-gpu flex-col overflow-hidden rounded-2xl border border-black/10 bg-white text-left shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary dark:border-white/10 dark:bg-zinc-900 [@media(hover:hover)]:hover:-translate-y-1 [@media(hover:hover)]:hover:border-black/15 [@media(hover:hover)]:hover:shadow-[0_18px_45px_rgba(15,23,42,0.12)] active:translate-y-0 active:scale-[0.99] dark:[@media(hover:hover)]:hover:border-white/20"
			>
				<div className="relative z-10 p-3">
					<div className="truncate line-clamp-1 font-semibold tracking-[-0.02em] text-zinc-950 dark:text-zinc-50">
						{site.title}
					</div>
					<div
						className="leading-snug text-xs font-medium line-clamp-2 text-zinc-500 dark:text-zinc-400"
						style={{
							display: "-webkit-box",
							WebkitLineClamp: 2,
							WebkitBoxOrient: "vertical",
							overflow: "hidden",
						}}
					>
						{site.description}
					</div>
				</div>

				<div className="absolute flex justify-center top-[50%] left-[15%] h-full w-full">
					<div className="flex h-full w-full origin-center -rotate-8 overflow-hidden rounded-md border border-solid bg-linear-to-br from-zinc-100 to-zinc-300 dark:border-white/10 dark:from-zinc-800 dark:to-zinc-950 transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] [@media(hover:hover)]:group-hover:-translate-y-1 [@media(hover:hover)]:group-hover:-rotate-1">
						{site.previewImage ? (
							// eslint-disable-next-line @next/next/no-img-element
							<img
								src={site.previewImage}
								alt=""
								loading="lazy"
								className="object-cover"
							/>
						) : (
							<>
								{/* <SiteIcon
									className="m-auto mb-[20%]"
									site={site as NavSite}
									layout={layout}
									size={Number(layout.cardHeight) || 72}
									initialClassName="text-sm!"
									showDefaultBackgroundColor={false}
								/> */}
							</>
						)}
					</div>
				</div>
			</a>
		);
	}

	if (useDetailPage) {
		return (
			<Link
				href={detailHref}
				scroll
				onClick={handleDetailNavigate}
				aria-label={site.title}
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
			</Link>
		);
	}

	return (
		<a
			href={href}
			target={target}
			rel={rel}
			aria-label={site.title}
			onClick={handleClick}
			onAuxClick={handleAuxClick}
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

const BATCH_THRESHOLD = 80;
const BATCH_INITIAL = 60;
const BATCH_STEP = 80;

const scheduleIdle = (cb: () => void) => {
	if (typeof window === "undefined") return 0;
	const ric = (
		window as unknown as {
			requestIdleCallback?: (
				cb: IdleRequestCallback,
				opts?: { timeout: number },
			) => number;
		}
	).requestIdleCallback;
	if (typeof ric === "function") {
		return ric(() => cb(), { timeout: 300 });
	}
	return window.setTimeout(cb, 50) as unknown as number;
};
const cancelIdle = (id: number) => {
	if (typeof window === "undefined" || !id) return;
	const cic = (
		window as unknown as { cancelIdleCallback?: (id: number) => void }
	).cancelIdleCallback;
	if (typeof cic === "function") cic(id);
	else clearTimeout(id);
};

export const SiteGrid = memo(function SiteGrid({
	sites,
	cardMinWidth = "160px",
	cardHeight = "64px",
	cardGridPadding = "8px",
	trackVisit = true,
	layout,
}: {
	sites?: SiteCardData[];
	cardMinWidth?: string;
	cardHeight?: string;
	cardGridPadding?: string;
	trackVisit?: boolean;
	layout?: Required<LayoutConfig>;
}) {
	const siteLinkMode = useSiteLinkMode();
	const total = sites?.length ?? 0;
	const needBatch = total > BATCH_THRESHOLD;
	const [renderCount, setRenderCount] = useState(() =>
		needBatch ? BATCH_INITIAL : total,
	);

	useEffect(() => {
		setRenderCount(needBatch ? BATCH_INITIAL : total);
	}, [needBatch, sites, total]);

	useEffect(() => {
		if (!needBatch || renderCount >= total) return;
		const id = scheduleIdle(() => {
			setRenderCount((c) => Math.min(c + BATCH_STEP, total));
		});
		return () => cancelIdle(id);
	}, [needBatch, renderCount, total]);

	if (!sites || total === 0) return null;
	const visible = renderCount >= total ? sites : sites.slice(0, renderCount);
	const isPreviewStyle = layout?.cardStyle === "preview";
	const effectiveCardMinWidth = cardMinWidth;
	const effectiveCardHeight = isPreviewStyle
		? `calc(${cardHeight} * 2)`
		: cardHeight;

	return (
		<div style={{ padding: `8px ${cardGridPadding}` }}>
			<div
				className="grid gap-3"
				style={{
					gridTemplateColumns: `repeat(auto-fill, minmax(${effectiveCardMinWidth}, 1fr))`,
					gridAutoRows: effectiveCardHeight,
				}}
			>
				{visible.map((s) => (
					<SiteCard
						key={`${s.title}-${s.url}`}
						site={s}
						trackVisit={trackVisit}
						layout={layout}
						siteLinkMode={siteLinkMode}
					/>
				))}
			</div>
		</div>
	);
});
