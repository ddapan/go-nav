"use client";

import {
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
	type CSSProperties,
	type TransitionEventHandler,
} from "react";
import { SHARED_SPRING_EASE } from "../ui/ui.constants";

export function useRecentVisitsEntrance({
	mounted,
	visibleItemCount,
	delay,
	disableEntranceAnimation,
}: {
	mounted: boolean;
	visibleItemCount: number;
	delay: number;
	disableEntranceAnimation: boolean;
}) {
	const wrapperRef = useRef<HTMLDivElement>(null);
	const contentRef = useRef<HTMLDivElement>(null);
	const entranceRafRef = useRef(0);
	const releaseHeightRafRef = useRef(0);
	const hasPlayedEntranceRef = useRef(disableEntranceAnimation);
	const [visible, setVisible] = useState(disableEntranceAnimation);
	const [animatedHeight, setAnimatedHeight] = useState<string | null>(
		disableEntranceAnimation ? null : "0px",
	);

	useEffect(() => {
		if (disableEntranceAnimation) {
			hasPlayedEntranceRef.current = true;
			setVisible(true);
			setAnimatedHeight(null);
			return;
		}

		const timer = setTimeout(() => setVisible(true), delay);
		return () => clearTimeout(timer);
	}, [delay, disableEntranceAnimation]);

	useEffect(() => {
		if (!mounted || !visible || disableEntranceAnimation) return;
		if (hasPlayedEntranceRef.current) return;

		if (entranceRafRef.current) {
			cancelAnimationFrame(entranceRafRef.current);
		}

		setAnimatedHeight("0px");
		entranceRafRef.current = requestAnimationFrame(() => {
			entranceRafRef.current = requestAnimationFrame(() => {
				entranceRafRef.current = 0;
				const contentHeight = contentRef.current?.scrollHeight ?? 0;
				setAnimatedHeight(contentHeight > 0 ? `${contentHeight}px` : "0px");
				hasPlayedEntranceRef.current = true;
			});
		});

		return () => {
			if (entranceRafRef.current) {
				cancelAnimationFrame(entranceRafRef.current);
				entranceRafRef.current = 0;
			}
		};
	}, [disableEntranceAnimation, mounted, visible, visibleItemCount]);

	const handleTransitionEnd = useCallback<TransitionEventHandler<HTMLDivElement>>(
		(event) => {
			if (event.target !== wrapperRef.current) return;
			if (event.propertyName !== "height") return;
			if (disableEntranceAnimation || !visible) return;

			if (releaseHeightRafRef.current) {
				cancelAnimationFrame(releaseHeightRafRef.current);
			}

			releaseHeightRafRef.current = requestAnimationFrame(() => {
				releaseHeightRafRef.current = requestAnimationFrame(() => {
					releaseHeightRafRef.current = 0;
					setAnimatedHeight(null);
				});
			});
		},
		[disableEntranceAnimation, visible],
	);

	const wrapperStyle = useMemo<CSSProperties>(
		() => ({
			height: disableEntranceAnimation ? "auto" : (animatedHeight ?? "auto"),
			overflow:
				disableEntranceAnimation || animatedHeight === null
					? "visible"
					: "hidden",
			opacity: visible ? 1 : 0,
			transform:
				disableEntranceAnimation || visible
					? "translateY(0)"
					: "translateY(8px)",
			willChange:
				disableEntranceAnimation || animatedHeight === null
					? "auto"
					: "height, opacity, transform",
			transition: disableEntranceAnimation
				? "none"
				: `height 640ms ${SHARED_SPRING_EASE}, opacity 380ms ease-out, transform 640ms ${SHARED_SPRING_EASE}`,
		}),
		[animatedHeight, disableEntranceAnimation, visible],
	);

	return {
		contentRef,
		wrapperRef,
		wrapperStyle,
		handleTransitionEnd,
	};
}
