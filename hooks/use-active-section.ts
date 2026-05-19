"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import { activeIdAtom, categoriesAtom } from "@/lib/store/site";

/** 滚动停止后再同步侧栏选中态，避免滚动过程中频繁改 selectedKeys */
const SCROLL_END_DELAY = 140;
/** 跳转后屏蔽滚动检测的时长，避免 smooth 滚动中误别 */
const JUMP_GUARD_MS = 800;
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

	const topIds = useMemo(() => categories.map((c) => c.id), [categories]);

	useEffect(() => {
		if (typeof window === "undefined") return;
		if (topIds.length === 0) return;

		const elements = topIds
			.map((id) => document.getElementById(id))
			.filter((el): el is HTMLElement => el !== null);

		if (elements.length === 0) return;

		const findActiveByPosition = () => {
			let current: string | undefined;
			for (let i = elements.length - 1; i >= 0; i--) {
				const el = elements[i];
				if (el.getBoundingClientRect().top <= ACTIVE_TOP_OFFSET) {
					current = el.id;
					break;
				}
			}
			if (!current && topIds.length > 0) current = topIds[0];
			setActiveId((prev) => (prev === current ? prev : current));
		};

		findActiveByPosition();

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
 * 返回稳定的跳转函数：设置 activeId 并在 JUMP_GUARD_MS 内抑制滚动检测。
 * 供导航（侧边栏/抽屉）等调用。
 */
export function useJumpToSection() {
	const setActiveId = useSetAtom(activeIdAtom);
	const guardTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	return useCallback(
		(id: string) => {
			jumpGuard.scrolling = true;
			setActiveId(id || undefined);
			if (guardTimerRef.current) clearTimeout(guardTimerRef.current);
			guardTimerRef.current = setTimeout(() => {
				jumpGuard.scrolling = false;
			}, JUMP_GUARD_MS);
		},
		[setActiveId],
	);
}
