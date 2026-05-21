import { Spinner } from "@heroui/react";

export default function Loading() {
	return (
		<div
			className="flex flex-col items-center justify-center gap-2"
			style={{
				height: `calc(100dvh - 106px)`,
			}}
		>
			<Spinner size="sm" />
			<span className="text-xs text-default-500">加载中...</span>
		</div>
	);
}
