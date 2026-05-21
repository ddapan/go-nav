"use client";

/**
 * Jotai Provider + SSR 水合封装。
 *
 * 每个请求创建独立的 Provider 实例；useHydrateAtoms 只在挂载时把服务端数据
 * 写入对应 atom，之后内部状态完全由客户端接管。前台 atom 为只读，后台 atom
 * 在水合后可由编辑器改写。
 */
import { Provider } from "jotai";
import { useHydrateAtoms } from "jotai/utils";
import type { NavConfig, WebsiteData } from "@/types";
import {
	_navBaseAtom,
	_savedNavAtom,
	_savedWebsiteDataAtom,
	_websiteDataBaseAtom,
	configRevisionAtom,
} from "./admin";
import { siteNavAtom, siteWebsiteDataAtom } from "./site";

function AdminHydrate({
	initial,
	children,
}: {
	initial: { websiteData: WebsiteData; nav: NavConfig; revision?: string };
	children: React.ReactNode;
}) {
	useHydrateAtoms([
		[_websiteDataBaseAtom, initial.websiteData],
		[_navBaseAtom, initial.nav],
		[_savedWebsiteDataAtom, initial.websiteData],
		[_savedNavAtom, initial.nav],
		[configRevisionAtom, initial.revision ?? ""],
	] as const);
	return <>{children}</>;
}

export function AdminStoreProvider({
	initial,
	children,
}: {
	initial: { websiteData: WebsiteData; nav: NavConfig; revision?: string };
	children: React.ReactNode;
}) {
	return (
		<Provider>
			<AdminHydrate initial={initial}>{children}</AdminHydrate>
		</Provider>
	);
}

function SiteHydrate({
	initial,
	children,
}: {
	initial: { websiteData: WebsiteData; nav: NavConfig };
	children: React.ReactNode;
}) {
	useHydrateAtoms([
		[siteWebsiteDataAtom, initial.websiteData],
		[siteNavAtom, initial.nav],
	] as const);
	return <>{children}</>;
}

export function SiteStoreProvider({
	initial,
	children,
}: {
	initial: { websiteData: WebsiteData; nav: NavConfig };
	children: React.ReactNode;
}) {
	return (
		<Provider>
			<SiteHydrate initial={initial}>{children}</SiteHydrate>
		</Provider>
	);
}
