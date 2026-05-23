"use client";

import Link from "next/link";
import type { PropsWithChildren } from "react";
import type { SiteCardNavigationModel } from "./site-card.types";

export function SiteCardLinkShell({
	ariaLabel,
	className,
	navigation,
	children,
}: PropsWithChildren<{
	ariaLabel: string;
	className: string;
	navigation: SiteCardNavigationModel;
}>) {
	if (navigation.useDetailPage) {
		return (
			<Link
				href={navigation.detailHref}
				scroll
				onClick={navigation.handleDetailNavigate}
				aria-label={ariaLabel}
				className={className}
			>
				{children}
			</Link>
		);
	}

	return (
		<a
			href={navigation.href}
			target={navigation.target}
			rel={navigation.rel}
			aria-label={ariaLabel}
			onClick={navigation.handleClick}
			onAuxClick={navigation.handleAuxClick}
			className={className}
		>
			{children}
		</a>
	);
}
