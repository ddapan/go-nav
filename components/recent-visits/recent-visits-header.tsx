"use client";

import { Button } from "@heroui/react";
import { memo } from "react";

export const RecentVisitsHeader = memo(function RecentVisitsHeader({
	onClear,
}: {
	onClear: () => void;
}) {
	return (
		<div className="mb-3 flex items-center justify-between px-3">
			<h2 className="font-semibold text-nowrap text-xl">最近访问</h2>
			<Button
				variant="tertiary"
				size="sm"
				className="text-xs text-muted"
				onPress={onClear}
			>
				清空
			</Button>
		</div>
	);
});
