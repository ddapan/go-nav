"use client";
import type { Key } from "@heroui/react";
import { Button } from "@heroui/react";
import { memo } from "react";
import type { LayoutConfig, NavSite, SearchEngine } from "@/types";
import { getIconImageSrc } from "@/lib/icon";
import { SearchBar } from "./search-bar";
import { BiMenuAltLeft, BiGlobe } from "react-icons/bi";

/**
 * 用 memo 包裹：父级 HeaderBundle 只保留少量交互 state，AppHeader 的
 * props 未变时可跳过重渲染。engineId 作为 props 传入，变化时会重渲染
 * SearchBar，这是必要的受控状态同步。
 */
export const AppHeader = memo(function AppHeader({
	websiteName,
	websiteLogo,
	engines = [],
	defaultEngine = "",
	enableLocal = false,
	enableSuggestion = false,
	enableTabFocus = true,
	placeholder = "",
	sites = [],
	onNavigate,
	onMenuOpen,
	engineId,
	onEngineChange,
	onEngineDrawerOpen,
	showSearch = true,
	showEngineSelector = true,
	layout,
}: {
	websiteName: string;
	websiteLogo: string;
	engines?: SearchEngine[];
	defaultEngine?: string;
	enableLocal?: boolean;
	enableSuggestion?: boolean;
	enableTabFocus?: boolean;
	placeholder?: string;
	sites?: Array<NavSite & { categoryId: string; categoryName: string }>;
	onNavigate?: (id: string) => void;
	onMenuOpen: () => void;
	engineId?: Key | null;
	onEngineChange?: (id: Key | null) => void;
	onEngineDrawerOpen?: () => void;
	showSearch?: boolean;
	showEngineSelector?: boolean;
	layout?: Pick<LayoutConfig, "defaultIconPadding" | "iconBorderRadius">;
}) {
	const logoSrc = getIconImageSrc(websiteLogo);
	return (
		<header className="sticky top-0 z-30 flex h-16 items-center gap-3 px-4 sm:px-6 min-[860px]:grid min-[860px]:grid-cols-[minmax(0,1fr)_minmax(0,36rem)_minmax(0,1fr)] pointer-events-none *:pointer-events-auto">
			<div className="flex min-w-0 items-center gap-2 min-[860px]:col-start-1 min-[860px]:justify-self-start">
				<Button
					variant="tertiary"
					isIconOnly
					aria-label="打开菜单"
					className="shrink-0 shadow bg-(--primary-foreground) md:hidden"
					onPress={onMenuOpen}
				>
					<BiMenuAltLeft className="scale-150" />
				</Button>
				<div className="max-md:hidden flex min-w-0 items-center gap-2">
					{logoSrc ? (
						// eslint-disable-next-line @next/next/no-img-element
						<img
							src={logoSrc}
							alt={websiteName}
							className="h-6 w-6 object-contain"
						/>
					) : null}
					<span className="text-base! max-w-32 truncate font-semibold">
						{websiteName}
					</span>
				</div>
			</div>
			{showSearch && (
				<div className="ml-auto w-full flex-1 max-w-xl min-[860px]:col-start-2 min-[860px]:max-w-none">
					<SearchBar
						engines={engines}
						defaultEngine={defaultEngine}
						enableLocal={enableLocal}
						enableSuggestion={enableSuggestion}
						enableTabFocus={enableTabFocus}
						placeholder={placeholder}
						sites={sites}
						onNavigate={onNavigate}
						engineId={engineId}
						onEngineChange={onEngineChange}
						showEngineSelector={showEngineSelector}
						layout={layout}
					/>
				</div>
			)}
			{showSearch && showEngineSelector && (
				<div className="flex max-[479px]:flex min-[480px]:hidden">
					<Button
						variant="tertiary"
						isIconOnly
						aria-label="切换搜索引擎"
						className="shrink-0 shadow bg-(--primary-foreground)"
						onPress={onEngineDrawerOpen}
					>
						<BiGlobe className="scale-150" />
					</Button>
				</div>
			)}
		</header>
	);
});
