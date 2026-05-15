"use client";

import { memo, useCallback, useEffect, useRef, useState } from "react";
import type { AdConfig } from "@/types";

/**
 * 侧边栏广告轮播组件
 * 多个广告使用 swiper 滑动轮播效果，支持自动播放、手动切换和点击跳转
 *
 * 使用 memo 包裹：父级（AppSidebar）会因滚动 activeId 变化而重渲染，
 * 但广告区域的 props (ads / aspectRatio) 不会变，memo 可跳过重渲染。
 */
function AdBannerImpl({ ads, aspectRatio = "16/9" }: { ads: AdConfig[]; aspectRatio?: string }) {
	const [current, setCurrent] = useState(0);
	const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
	const total = ads.length;

	const startAutoPlay = useCallback(() => {
		if (total <= 1) return;
		if (timerRef.current) return;
		timerRef.current = setInterval(() => {
			setCurrent((prev) => (prev + 1) % total);
		}, 4000);
	}, [total]);

	const stopAutoPlay = useCallback(() => {
		if (timerRef.current) {
			clearInterval(timerRef.current);
			timerRef.current = null;
		}
	}, []);

	useEffect(() => {
		startAutoPlay();
		return stopAutoPlay;
	}, [startAutoPlay, stopAutoPlay]);

	useEffect(() => {
		setCurrent((prev) => (prev >= total ? 0 : prev));
	}, [total]);

	// 预取+预解码下一张广告图，避免切换时因网络或解码导致闪白
	useEffect(() => {
		if (total <= 1) return;
		const nextSrc = ads[(current + 1) % total]?.image;
		if (!nextSrc) return;
		const img = new window.Image();
		img.src = nextSrc;
		// decode() 在部分老浏览器不存在，做兼容
		if (typeof img.decode === "function") {
			img.decode().catch(() => {});
		}
	}, [current, ads, total]);

	const handleDotClick = (index: number) => {
		setCurrent((prev) => (prev === index ? prev : index));
	};

	if (total === 0) return null;

	return (
		<div
			className="relative overflow-hidden rounded-md"
			onMouseEnter={stopAutoPlay}
			onMouseLeave={startAutoPlay}
		>
			{/* 滑动容器 */}
			<div
				className="flex transition-transform duration-500 ease-out"
				style={{
					transform: `translateX(-${current * 100}%)`,
					aspectRatio: aspectRatio,
				}}
			>
				{ads.map((ad, i) => (
					<a
						key={ad.id}
						href={ad.url}
						target="_blank"
						rel="noopener noreferrer"
						className="block w-full shrink-0"
					>
						{ad.image ? (
							// eslint-disable-next-line @next/next/no-img-element
							<img
								src={ad.image}
								alt={ad.title}
								className="h-full w-full object-cover"
								loading={i === 0 ? "eager" : "lazy"}
								decoding="async"
							/>
						) : (
							<div className="flex h-full w-full flex-col items-center justify-center bg-linear-to-br from-primary/10 to-primary/5">
								<span className="text-3xl">📢</span>
								<span className="mt-2 text-xs font-medium">{ad.title}</span>
								{ad.description && (
									<span className="mt-1 text-[10px]! text-muted">{ad.description}</span>
								)}
							</div>
						)}
					</a>
				))}
			</div>

			{/* 指示器 */}
			{total > 1 && (
				<div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1.5">
					{ads.map((_, i) => (
						<button
							key={ads[i].id}
							type="button"
							aria-label={`切换到广告 ${i + 1}`}
							className={`h-1.5 rounded-full transition-all duration-300 ${
								i === current
									? "w-6 bg-primary"
									: "w-1.5 bg-black/20 dark:bg-white/20 [@media(hover:hover)]:hover:bg-black/40 dark:[@media(hover:hover)]:hover:bg-white/40"
							}`}
							onClick={() => handleDotClick(i)}
						/>
					))}
				</div>
			)}
		</div>
	);
}

export const AdBanner = memo(AdBannerImpl);
