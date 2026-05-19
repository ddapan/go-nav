"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import { activeIdAtom, categoriesAtom } from "@/lib/store/site";

/** 滚动停止后再同步侧栏选中态，避免滚动过程中频繁改 selectedKeys */
const SCROLL_END_DELAY = 140;
/** 跳转后若长时间持续滚动，保护态的最长保留时间 */
const JUMP_GUARD_MAX_MS = 3600;
/** 跳转滚动停止后多久解除保护 */
const JUMP_GUARD_END_DELAY = 220;
const ACTIVE_TOP_OFFSET = 120;

// 模块级共享抑制标志：跳转后短时间内禁用滚动检测，避免把 activeId 冲回去
const jumpGuard = { scrolling: false };

/**
 * 绑定滚动监听并将当前活跃分类 id 写入 activeIdAtom。
 *
 * 订阅 categoriesAtom 以获得顶级分类列表，但不读取 activeIdAtom，
 * 因此滚动带来的 activeId 更新不会重渲染调用者（通常是 AppLayout）。
 */
export function useActiveSectionWriter() {
	const categories = useAtomValue(categoriesAtom);
	const setActiveId = useSetAtom(activeIdAtom);
	const scrollEndTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const lastScrollYRef = useRef(0);

	const topIds = useMemo(() => categories.map((c) => c.id), [categories]);

	useEffect(() => {
		if (typeof window === "undefined") return;
		if (topIds.length === 0) return;
		lastScrollYRef.current = window.scrollY;

		const elements = topIds
			.map((id) => document.getElementById(id))
			.filter((el): el is HTMLElement => el !== null);

		if (elements.length === 0) return;

		const findActiveByPosition = () => {
			const currentScrollY = window.scrollY;
			const scrollingUp = currentScrollY < lastScrollYRef.current - 1;
			lastScrollYRef.current = currentScrollY;

			// 底部场景：最后一段通常无法滚到锚点线，避免误判成倒数第二项。
			const doc = document.documentElement;
			const nearBottom =
				currentScrollY + window.innerHeight >= doc.scrollHeight - 6;
			if (nearBottom && !scrollingUp) {
				const lastId = elements[elements.length - 1]?.id;
				if (lastId) {
					setActiveId((prev) => (prev === lastId ? prev : lastId));
				}
				return;
			}

			// 常规场景按“已越过锚点线的最后一个分类”判定，避免分类间空隙导致回跳。
			const anchorY = ACTIVE_TOP_OFFSET;
			let current = elements[0]?.id;
			for (const el of elements) {
				const rect = el.getBoundingClientRect();
				if (rect.top <= anchorY) {
					current = el.id;
				} else {
					break;
				}
			}
			setActiveId((prev) => (prev === current ? prev : current));
		};

		let rafId = 0;
		const flushActive = () => {
			if (jumpGuard.scrolling || rafId) return;
			rafId = requestAnimationFrame(() => {
				rafId = 0;
				findActiveByPosition();
			});
		};

		const scheduleAfterScrollEnd = () => {
			if (jumpGuard.scrolling) return;
			if (scrollEndTimerRef.current) clearTimeout(scrollEndTimerRef.current);
			scrollEndTimerRef.current = setTimeout(flushActive, SCROLL_END_DELAY);
		};

		const rawHash = window.location.hash.startsWith("#")
			? window.location.hash.slice(1)
			: "";
		let initialHashId = rawHash;
		try {
			initialHashId = decodeURIComponent(rawHash);
		} catch {
			initialHashId = rawHash;
		}

		const hasInitialHashTarget =
			initialHashId.length > 0 &&
			elements.some((el) => el.id === initialHashId);

		if (hasInitialHashTarget) {
			setActiveId((prev) => (prev === initialHashId ? prev : initialHashId));
			// 某些客户端跳转下 hash 定位时机会偏晚，主动补一次定位。
			requestAnimationFrame(() => {
				document
					.getElementById(initialHashId)
					?.scrollIntoView({ behavior: "auto", block: "start" });
			});
			if (scrollEndTimerRef.current) clearTimeout(scrollEndTimerRef.current);
			scrollEndTimerRef.current = setTimeout(flushActive, SCROLL_END_DELAY * 2);
		} else {
			findActiveByPosition();
		}

		window.addEventListener("scroll", scheduleAfterScrollEnd, { passive: true });
		window.addEventListener("resize", scheduleAfterScrollEnd, { passive: true });

		return () => {
			window.removeEventListener("scroll", scheduleAfterScrollEnd);
			window.removeEventListener("resize", scheduleAfterScrollEnd);
			if (scrollEndTimerRef.current) clearTimeout(scrollEndTimerRef.current);
			if (rafId) cancelAnimationFrame(rafId);
		};
	}, [topIds, setActiveId]);
}

/**
 * 返回稳定的跳转函数：设置 activeId，并在跳转滚动完成前抑制滚动检测。
 * 供导航（侧边栏/抽屉）等调用。
 */
export function useJumpToSection() {
	const setActiveId = useSetAtom(activeIdAtom);
	const guardMaxTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const guardEndTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const cleanupGuardRef = useRef<(() => void) | null>(null);

	useEffect(() => {
		return () => {
			cleanupGuardRef.current?.();
		};
	}, []);

	return useCallback(
		(id: string) => {
			cleanupGuardRef.current?.();
			jumpGuard.scrolling = true;
			setActiveId(id || undefined);

			if (typeof window === "undefined") return;

			const release = () => {
				window.removeEventListener("scroll", onScrollOrResize);
				window.removeEventListener("resize", onScrollOrResize);
				if (guardEndTimerRef.current) clearTimeout(guardEndTimerRef.current);
				if (guardMaxTimerRef.current) clearTimeout(guardMaxTimerRef.current);
				guardEndTimerRef.current = null;
				guardMaxTimerRef.current = null;
				cleanupGuardRef.current = null;
				jumpGuard.scrolling = false;
			};

			const onScrollOrResize = () => {
				if (guardEndTimerRef.current) clearTimeout(guardEndTimerRef.current);
				guardEndTimerRef.current = setTimeout(release, JUMP_GUARD_END_DELAY);
			};

			window.addEventListener("scroll", onScrollOrResize, { passive: true });
			window.addEventListener("resize", onScrollOrResize, { passive: true });

			// 立刻安排一次“滚动结束”检测；如果没有发生滚动会很快解锁。
			onScrollOrResize();
			guardMaxTimerRef.current = setTimeout(release, JUMP_GUARD_MAX_MS);
			cleanupGuardRef.current = release;
		},
		[setActiveId],
	);
}
