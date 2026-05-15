"use client";

import { Button } from "@heroui/react";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import { BiChevronUp } from "react-icons/bi";

export const AdminScrollTopButton = memo(function AdminScrollTopButton() {
	const [showTop, setShowTop] = useState(false);
	const rafRef = useRef(0);

	useEffect(() => {
		const onScroll = () => {
			if (rafRef.current) return;
			rafRef.current = requestAnimationFrame(() => {
				const next = window.scrollY > 320;
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

	const scrollToTop = useCallback(() => {
		window.scrollTo({ top: 0, behavior: "smooth" });
	}, []);

	return (
		<div className="pointer-events-none fixed bottom-6 right-4 z-40 sm:bottom-8 sm:right-6">
			<Button
				size="lg"
				isIconOnly
				aria-label="回到顶部"
				variant="outline"
				className={`pointer-events-auto rounded-full border border-gray-200 bg-white/92 shadow-lg backdrop-blur-sm transition-all duration-300 dark:border-neutral-800 dark:bg-neutral-900/92 ${
					showTop
						? "translate-y-0 opacity-100"
						: "pointer-events-none translate-y-2 opacity-0"
				}`}
				onPress={scrollToTop}
			>
				<BiChevronUp className="size-5" />
			</Button>
		</div>
	);
});
