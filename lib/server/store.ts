import fs from "node:fs";
import path from "node:path";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import type { NavConfig, WebsiteData } from "@/types";
import {
	getStructuredFileFormat,
	listStructuredDataFileCandidates,
	resolveNavFilePathForRead,
	resolveNavFilePathForWrite,
	resolveWebsiteFilePathForRead,
	resolveWebsiteFilePathForWrite,
	UPLOADS_DIR,
} from "./paths";

/**
 * 网站内容数据默认值（未生成 website 配置文件时使用）。
 */
export const DEFAULT_WEBSITE: WebsiteData = { categories: [] };

/**
 * 导航配置默认值（未生成 nav 配置文件时使用）。
 * 保持一份最小可用配置，确保前台页面能渲染、后台登录后能直接开始编辑。
 */
export const DEFAULT_NAV: NavConfig = {
	title: "Go Nav",
	name: "Go Nav",
	description: "简洁高效的网址导航站",
	keywords: ["网址导航站", "导航站", "网址导航", "个人导航"],
	logo: "/images/logo.svg",
	favicon: "/favicon.ico",
	author: "dengxiwang",
	copyright: "版权所有 © 2026 GOTAB. 保留所有权利",
	icp: "豫ICP备2023009053号-6",
	beian: "豫公网安备41072402001147号",
	qrCode: "https://www.gotab.cn/images/wx.webp",
	qrCodeText: "微信扫一扫",
	footerLinks: [
		{
			label: "GOTAB 官网",
			href: "https://www.gotab.cn",
		},
		{
			label: "作者 GitHub",
			href: "https://github.com/dengxiwang/go-nav",
		},
		{
			label: " GoTab 新标签页",
			href: "https://web.gotab.cn",
		},
		{
			label: "博客",
			href: "https://blog.gotab.cn",
		},
	],
	themeMode: "system",
	search: {
		defaultEngine: "local",
		enableLocalSearch: true,
		showEngineSelector: true,
		enableSuggestion: true,
		enableTabFocus: true,
		placeholder: "搜索网站或直接按 Enter 通过外部引擎搜索...",
		engines: [
			{
				id: "baidu",
				name: "百度",
				icon: "/images/baidu.svg",
				url: "https://www.baidu.com/s?wd={query}&tn=68018901_11_oem_dg",
			},
			{
				id: "bing",
				name: "必应",
				icon: "/images/bing.svg",
				url: "https://www.bing.com/search?q={query}",
			},
			{
				id: "google",
				name: "谷歌",
				icon: "/images/google.svg",
				url: "https://www.google.com/search?q={query}",
			},
		],
	},
	ads: [
		{
			id: "ad-1778577116508",
			title: "雨云服务器",
			description: "",
			image: "https://blog.gotab.cn/upload/rainyun_ad.webp",
			url: "https://www.rainyun.com/gotab_",
			enabled: true,
		},
	],
	plugins: [],
	layout: {
		maxWidth: "1400",
		showFooter: true,
		showFooterQrCode: true,
		showFloatingQrCode: true,
		showFloatingActions: true,
		defaultIconPadding: "8",
		linkTarget: "new",
		autoUseIntranet: false,
		enableSiteDetailPage: false,
	},
	adsAspectRatio: "4/3",
};

function isMissingFileError(e: unknown): boolean {
	return (e as NodeJS.ErrnoException)?.code === "ENOENT";
}

const structuredCache = new Map<string, { stamp: string; value: unknown }>();

function cloneJson<T>(value: T): T {
	return JSON.parse(JSON.stringify(value)) as T;
}

/**
 * 读取结构化配置文件（JSON/YAML）并递归剥离 `_comment*` 注释字段。
 */
export function readJson<T>(file: string): T {
	const stat = fs.statSync(file);
	const stamp = `${stat.mtimeMs}:${stat.size}`;
	const cached = structuredCache.get(file);
	if (cached?.stamp === stamp) return cached.value as T;

	const raw = fs.readFileSync(file, "utf-8");
	const value = stripComments(parseStructuredFile(raw, file)) as T;
	structuredCache.set(file, { stamp, value });
	return value;
}

/**
 * 容错读取：文件不存在或解析失败时返回 fallback。
 * 解析错误仅打印警告，不向上抛，避免首次部署或配置损坏导致整站 500。
 */
export function readJsonOr<T>(file: string, fallback: T): T {
	try {
		return readJson<T>(file);
	} catch (e) {
		if (isMissingFileError(e)) return cloneJson(fallback);
		console.warn(
			`[store] 读取 ${file} 失败，使用默认值：${(e as Error).message}`,
		);
		return cloneJson(fallback);
	}
}

/**
 * 原子性写入结构化配置文件（先写临时文件再 rename，避免中途读到半截数据）。
 */
export function writeJsonAtomic(file: string, value: unknown) {
	fs.mkdirSync(path.dirname(file), { recursive: true });
	const tmp = `${file}.tmp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
	fs.writeFileSync(tmp, stringifyStructuredFile(value, file), "utf-8");
	fs.renameSync(tmp, file);
	structuredCache.delete(file);
}

export function parseStructuredContent<T>(content: string): T {
	return stripComments(parseYaml(content)) as T;
}

export function stringifyStructuredContent(value: unknown, file: string): string {
	return stringifyStructuredFile(value, file);
}

export function readWebsiteData(): WebsiteData {
	return readJsonOr<WebsiteData>(resolveWebsiteFilePathForRead(), DEFAULT_WEBSITE);
}

export function writeWebsiteData(v: WebsiteData) {
	const target = resolveWebsiteFilePathForWrite();
	writeJsonAtomic(target, v);
	pruneLegacyStructuredFiles("website", target);
}

export function readNav(): NavConfig {
	return readJsonOr<NavConfig>(resolveNavFilePathForRead(), DEFAULT_NAV);
}

export function writeNav(v: NavConfig) {
	const target = resolveNavFilePathForWrite();
	writeJsonAtomic(target, v);
	pruneLegacyStructuredFiles("nav", target);
}

/**
 * 保存上传文件到 UPLOADS_DIR，返回对外可访问的 URL（/uploads/xxx）。
 */
export function saveUpload(fileName: string, bytes: Buffer): string {
	fs.mkdirSync(UPLOADS_DIR, { recursive: true });
	const ext = sanitizeExtension(path.extname(fileName)) || ".bin";
	const base = createUploadBaseName(
		path.basename(fileName, path.extname(fileName)),
	);
	let unique = "";
	do {
		unique = `${base}-${Math.random().toString(36).slice(2, 8)}${ext}`;
	} while (fs.existsSync(path.join(UPLOADS_DIR, unique)));
	fs.writeFileSync(path.join(UPLOADS_DIR, unique), bytes);
	return `/uploads/${unique}`;
}

function sanitizeExtension(ext: string): string {
	const normalized = ext.toLowerCase();
	return /^\.[a-z0-9]+$/.test(normalized) ? normalized : "";
}

function createUploadBaseName(name: string): string {
	const slug = name
		.normalize("NFKD")
		.replace(/[\u0300-\u036f]/g, "")
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.replace(/-{2,}/g, "-")
		.slice(0, 28)
		.replace(/-+$/g, "");
	return slug || "icon";
}

function stripComments<T>(input: T): T {
	if (Array.isArray(input)) {
		return input.map((v) => stripComments(v)) as unknown as T;
	}
	if (input && typeof input === "object") {
		const out: Record<string, unknown> = {};
		for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
			if (k.startsWith("_comment")) continue;
			out[k] = stripComments(v);
		}
		return out as unknown as T;
	}
	return input;
}

function parseStructuredFile(raw: string, file: string): unknown {
	if (getStructuredFileFormat(file) === "json") {
		return JSON.parse(raw);
	}
	return parseYaml(raw);
}

function stringifyStructuredFile(value: unknown, file: string): string {
	if (getStructuredFileFormat(file) === "json") {
		return JSON.stringify(value, null, 2);
	}
	return stringifyYaml(value, { indent: 2, lineWidth: 0 });
}

function pruneLegacyStructuredFiles(baseName: string, keepFile: string) {
	for (const file of listStructuredDataFileCandidates(baseName)) {
		if (file === keepFile || !fs.existsSync(file)) continue;
		try {
			fs.unlinkSync(file);
			structuredCache.delete(file);
		} catch {
			// 某些挂载目录可能不允许删除旧文件，不应影响主流程。
		}
	}
}
