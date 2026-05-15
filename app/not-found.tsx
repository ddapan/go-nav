import Link from "next/link";

export default function NotFound() {
	return (
		<div className="flex min-h-dvh flex-col items-center justify-center px-6">
			<div className="flex flex-col items-center gap-6 text-center">
				<div className="flex flex-col items-center gap-2">
					<span className="text-8xl font-bold text-primary/20">404</span>
					<h1 className="text-xl font-semibold">页面未找到</h1>
				</div>
				<p className="max-w-sm text-sm text-muted">
					抱歉，您访问的页面不存在或已被移除。
				</p>
				<Link
					href="/"
					className="inline-flex items-center rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors [@media(hover:hover)]:hover:bg-zinc-700 dark:bg-white dark:text-zinc-950 dark:[@media(hover:hover)]:hover:bg-zinc-200"
				>
					返回首页
				</Link>
			</div>
		</div>
	);
}
