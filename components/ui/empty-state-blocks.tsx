"use client";

import { EmptyState } from "@heroui/react";
import type { PropsWithChildren } from "react";

export function PageEmptyState({
	title,
	description,
}: {
	title: string;
	description: string;
}) {
	return (
		<div className="flex flex-col items-center justify-center py-24">
			<EmptyState className="text-center">
				<h2 className="text-xl font-semibold">{title}</h2>
				<p className="text-sm text-muted">{description}</p>
			</EmptyState>
		</div>
	);
}

export function InlineEmptyHint({ children }: PropsWithChildren) {
	return (
		<div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted">
			{children}
		</div>
	);
}
