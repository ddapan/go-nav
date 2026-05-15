"use client";
import { AiOutlineQrcode } from "react-icons/ai";
import { Button } from "@heroui/react";
import Image from "next/image";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import { useAtomValue } from "jotai";
import { navQrCodeAtom, navQrCodeTextAtom } from "@/lib/store/site";

/**
 * 悬浮按钮（Jotai 订阅版）：
 * - 只订阅 qrCode / qrCodeText，避免 nav 其它字段变化牵连
 * - showTop state 由自己的 scroll 监听调度，memo 防止父级重渲染牵连
 */
export const FloatingActions = memo(function FloatingActions({
	showQrCode = true,
}: {
	showQrCode?: boolean;
}) {
	const qrCode = useAtomValue(navQrCodeAtom);
	const qrCodeText = useAtomValue(navQrCodeTextAtom);
	const [showTop, setShowTop] = useState(false);
	const [showQrPanel, setShowQrPanel] = useState(false);
	const [supportsHover, setSupportsHover] = useState(false);
	const rafRef = useRef(0);
	const qrContainerRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const onScroll = () => {
			if (rafRef.current) return;
			rafRef.current = requestAnimationFrame(() => {
				const next = window.scrollY > 300;
				// 相等性短路：避免滚动时频繁触发相同值的 setState 导致 memo 失效
				setShowTop((prev) => (prev === next ? prev : next));
				rafRef.current = 0;
			});
		};

		window.addEventListener("scroll", onScroll, { passive: true });
		onScroll();

		return () => {
			window.removeEventListener("scroll", onScroll);
			if (rafRef.current) cancelAnimationFrame(rafRef.current);
		};
	}, []);

	useEffect(() => {
		const mq = window.matchMedia("(hover: hover) and (pointer: fine)");
		const apply = (matches: boolean) => {
			setSupportsHover(matches);
			if (matches) {
				setShowQrPanel(false);
			}
		};

		apply(mq.matches);
		const handleChange = (event: MediaQueryListEvent) => apply(event.matches);
		mq.addEventListener("change", handleChange);
		return () => mq.removeEventListener("change", handleChange);
	}, []);

	useEffect(() => {
		if (!showQrPanel) return;

		const handlePointerDown = (event: MouseEvent | TouchEvent) => {
			if (
				qrContainerRef.current &&
				!qrContainerRef.current.contains(event.target as Node)
			) {
				setShowQrPanel(false);
			}
		};

		document.addEventListener("mousedown", handlePointerDown);
		document.addEventListener("touchstart", handlePointerDown);
		return () => {
			document.removeEventListener("mousedown", handlePointerDown);
			document.removeEventListener("touchstart", handlePointerDown);
		};
	}, [showQrPanel]);

	const scrollToTop = useCallback(() => {
		window.scrollTo({ top: 0, behavior: "smooth" });
	}, []);

	const toggleQrPanel = useCallback(() => {
		if (supportsHover) return;
		setShowQrPanel((prev) => !prev);
	}, [supportsHover]);

	return (
		<div className="fixed bottom-8 right-6 z-50 flex flex-col items-center gap-3">
			<Button
				size="lg"
				isIconOnly
				aria-label="回到顶部"
				variant="tertiary"
				className={`shadow bg-(--primary-foreground) rounded-full transition-all duration-300 [@media(hover:hover)]:hover:-translate-y-0.5 ${
					showTop
						? "pointer-events-auto opacity-100"
						: "pointer-events-none translate-y-2 opacity-0"
				}`}
				onPress={scrollToTop}
			>
				<svg
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
					strokeWidth={2}
				>
					<path
						strokeLinecap="round"
						strokeLinejoin="round"
						d="M5 15l7-7 7 7"
					/>
				</svg>
			</Button>

			{showQrCode && qrCode && (
				<div ref={qrContainerRef} className="group relative flex items-center">
					<div
						id="floating-actions-qr-panel"
						className={`absolute bottom-0 right-12 translate-x-2 opacity-0 transition-all duration-200 ${
							showQrPanel
								? "pointer-events-auto translate-x-0 opacity-100"
								: "pointer-events-none"
						} ${
							supportsHover
								? "[@media(hover:hover)]:group-hover:pointer-events-auto [@media(hover:hover)]:group-hover:translate-x-0 [@media(hover:hover)]:group-hover:opacity-100"
								: ""
						}`}
					>
						<div className="relative w-44 rounded-2xl bg-(--primary-foreground) p-4 text-center shadow-lg">
							<div className="mx-auto flex h-28 w-28 items-center justify-center rounded-xl bg-default p-2 dark:bg-zinc-700">
								<Image
									src={qrCode}
									alt="公众号二维码"
									width={112}
									height={112}
									loading="eager"
									className="h-full w-full rounded-lg object-cover"
								/>
							</div>

							<p className="mt-3 text-sm font-medium">关注公众号</p>

							<p className="mt-1 text-xs leading-relaxed text-muted">
								{qrCodeText ?? "扫码关注，获取更多内容"}
							</p>

							<div className="absolute -right-1.5 bottom-5 h-3 w-3 rotate-45 border-r border-t bg-(--primary-foreground)" />
						</div>
					</div>

					<Button
						size="lg"
						isIconOnly
						aria-label="关注公众号"
						aria-controls="floating-actions-qr-panel"
						aria-expanded={showQrPanel}
						variant="tertiary"
						className="shadow bg-(--primary-foreground) rounded-full transition-all duration-300 [@media(hover:hover)]:hover:-translate-y-0.5"
						onPress={toggleQrPanel}
					>
						<AiOutlineQrcode />
					</Button>
				</div>
			)}
		</div>
	);
});
