"use client";

import { useOverlayState, type Key } from "@heroui/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAtomValue } from "jotai";
import { AppHeader } from "./app-header";
import { EngineDrawer } from "./engine-drawer";
import { MobileNavDrawer } from "./mobile-nav-drawer";
import {
	categoriesAtom,
	flatSitesAtom,
	layoutAtom,
	navLogoAtom,
	navNameAtom,
	searchConfigAtom,
} from "@/lib/store/site";
import { useJumpToSection } from "@/hooks/use-active-section";

/**
 * 头部聚合组件：AppHeader + 移动端导航抽屉 + 搜索引擎抽屉。
 *
 * Jotai 订阅版：
 * - 顶层只订阅 name/logo；搜索关闭时不再构建 flatSites 搜索索引。
 * - 分类列表只在移动抽屉打开后订阅，降低 Header 的常驻客户端负担。
 * - drawerOpen / engineDrawerOpen / engineId 下沉在各自小组件中，
 *   它们变化不会牵连外层 AppLayout。
 */
export function HeaderBundle({ showSearch }: { showSearch: boolean }) {
	const name = useAtomValue(navNameAtom);
	const logo = useAtomValue(navLogoAtom);
	const onNavigate = useJumpToSection();
	const drawerState = useOverlayState();

	// 断点切换时自动关闭抽屉
	useEffect(() => {
		if (!drawerState.isOpen) return;
		const onResize = () => {
			if (window.innerWidth >= 768) drawerState.close();
		};
		window.addEventListener("resize", onResize);
		return () => window.removeEventListener("resize", onResize);
	}, [drawerState]);

	const openMenu = useCallback(() => drawerState.open(), [drawerState]);

	// 移动端导航点击后除了跳转还要关掉抽屉
	const handleDrawerNavigate = useCallback(
		(id: string) => {
			onNavigate(id);
			drawerState.close();
		},
		[drawerState, onNavigate],
	);

	const header = showSearch ? (
		<SearchHeader
			name={name}
			logo={logo}
			onMenuOpen={openMenu}
			onNavigate={onNavigate}
		/>
	) : (
		<AppHeader
			websiteName={name}
			websiteLogo={logo}
			onMenuOpen={openMenu}
			showSearch={false}
		/>
	);

	return (
		<>
			{header}

			<MobileNavDrawerHost
				open={drawerState.isOpen}
				onOpenChange={drawerState.setOpen}
				onItemClick={handleDrawerNavigate}
				title={name}
				logo={logo}
			/>
		</>
	);
}

function MobileNavDrawerHost({
	open,
	onOpenChange,
	onItemClick,
	title,
	logo,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onItemClick: (id: string) => void;
	title: string;
	logo: string;
}) {
	if (!open) return null;

	return (
		<MobileNavDrawerContent
			open={open}
			onOpenChange={onOpenChange}
			onItemClick={onItemClick}
			title={title}
			logo={logo}
		/>
	);
}

function MobileNavDrawerContent({
	open,
	onOpenChange,
	onItemClick,
	title,
	logo,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onItemClick: (id: string) => void;
	title: string;
	logo: string;
}) {
	const categories = useAtomValue(categoriesAtom);

	return (
		<MobileNavDrawer
			open={open}
			onOpenChange={onOpenChange}
			categories={categories}
			onItemClick={onItemClick}
			title={title}
			logo={logo}
		/>
	);
}

function SearchHeader({
	name,
	logo,
	onMenuOpen,
	onNavigate,
}: {
	name: string;
	logo: string;
	onMenuOpen: () => void;
	onNavigate: (id: string) => void;
}) {
	const search = useAtomValue(searchConfigAtom);
	const flatSites = useAtomValue(flatSitesAtom);
	const layout = useAtomValue(layoutAtom);
	const engineDrawerState = useOverlayState();

	const engineOptions = useMemo(() => {
		const base = search.enableLocalSearch
			? [{ id: "local" }, ...search.engines]
			: search.engines.filter((engine) => engine.id !== "local");
		return base.map((engine) => engine.id);
	}, [search.enableLocalSearch, search.engines]);
	const resolvedDefaultEngine = useMemo(
		() =>
			engineOptions.includes(search.defaultEngine)
				? search.defaultEngine
				: (engineOptions[0] ?? null),
		[engineOptions, search.defaultEngine],
	);
	const [engineId, setEngineId] = useState<Key | null>(resolvedDefaultEngine);

	useEffect(() => {
		if (!engineDrawerState.isOpen) return;
		const onResize = () => {
			if (window.innerWidth >= 480) engineDrawerState.close();
		};
		window.addEventListener("resize", onResize);
		return () => window.removeEventListener("resize", onResize);
	}, [engineDrawerState]);

	useEffect(() => {
		if (engineId !== null && engineOptions.includes(String(engineId))) return;
		setEngineId(resolvedDefaultEngine);
	}, [engineId, engineOptions, resolvedDefaultEngine]);

	const openEngineDrawer = useCallback(
		() => engineDrawerState.open(),
		[engineDrawerState],
	);
	const showEngineSelector = search.showEngineSelector !== false;

	return (
		<>
			<AppHeader
				websiteName={name}
				websiteLogo={logo}
				engines={search.engines}
				defaultEngine={resolvedDefaultEngine ?? ""}
				enableLocal={search.enableLocalSearch}
				enableSuggestion={search.enableSuggestion !== false}
				enableTabFocus={search.enableTabFocus !== false}
				placeholder={search.placeholder}
				sites={flatSites}
				onNavigate={onNavigate}
				onMenuOpen={onMenuOpen}
				engineId={engineId}
				onEngineChange={setEngineId}
				onEngineDrawerOpen={openEngineDrawer}
				showSearch
				showEngineSelector={showEngineSelector}
				layout={layout}
			/>

			<EngineDrawer
				open={engineDrawerState.isOpen}
				onOpenChange={engineDrawerState.setOpen}
				engines={search.engines}
				enableLocal={search.enableLocalSearch}
				currentEngine={engineId}
				onEngineChange={setEngineId}
			/>
		</>
	);
}
