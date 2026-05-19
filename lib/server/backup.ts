import fs from "node:fs";
import path from "node:path";
import { UPLOADS_DIR } from "@/lib/server/paths";
import {
	parseStructuredContent,
	readNav,
	readWebsiteData,
	stringifyStructuredContent,
	writeNav,
	writeWebsiteData,
} from "@/lib/server/store";
import { createZip, parseZip, type ZipEntry } from "@/lib/server/zip";
import type { NavConfig, WebsiteData } from "@/types";

export const MAX_BACKUP_SIZE = 20 * 1024 * 1024;

const ALLOWED_UPLOAD_EXTENSIONS = new Set([
	".png",
	".jpg",
	".jpeg",
	".gif",
	".webp",
	".svg",
	".ico",
]);
const WEBSITE_BACKUP_IMPORT_FILES = ["website.yaml", "website.yml", "website.json"] as const;
const NAV_BACKUP_IMPORT_FILES = ["nav.yaml", "nav.yml", "nav.json"] as const;
const WEBSITE_BACKUP_EXPORT_FILES = ["website.yaml", "website.json"] as const;
const NAV_BACKUP_EXPORT_FILES = ["nav.yaml", "nav.json"] as const;

export interface BackupRestoreResult {
	website: boolean;
	nav: boolean;
	uploads: number;
}

function safeUploadName(name: string): string | null {
	const base = path.basename(name);
	if (!base || base.startsWith(".")) return null;
	if (base !== name) return null;
	if (!ALLOWED_UPLOAD_EXTENSIONS.has(path.extname(base).toLowerCase())) return null;
	return base;
}

function readAllUploads(): ZipEntry[] {
	if (!fs.existsSync(UPLOADS_DIR)) return [];
	const entries: ZipEntry[] = [];
	for (const file of fs.readdirSync(UPLOADS_DIR)) {
		const full = path.join(UPLOADS_DIR, file);
		try {
			const stat = fs.statSync(full);
			if (!stat.isFile()) continue;
			entries.push({
				name: `uploads/${file}`,
				data: fs.readFileSync(full),
			});
		} catch {
			// 单个素材读取失败不应中断整包导出。
		}
	}
	return entries;
}

export function createDataBackupZip(): Buffer {
	const websiteData = readWebsiteData();
	const nav = readNav();
	const meta = {
		version: "2.0",
		scope: "go-nav-data",
		exportTime: new Date().toISOString(),
	};
	const entries: ZipEntry[] = [
		{
			name: "meta.json",
			data: Buffer.from(JSON.stringify(meta, null, 2), "utf8"),
		},
		...collectStructuredBackupEntries("website", websiteData),
		...collectStructuredBackupEntries("nav", nav),
		...readAllUploads(),
	];
	return createZip(entries);
}

export function createBackupFileName(date = new Date()): string {
	return `go-nav-backup-${date.toISOString().slice(0, 10)}.zip`;
}

export function restoreDataBackupZip(buf: Buffer): BackupRestoreResult {
	let entries: ZipEntry[];
	try {
		entries = parseZip(buf);
	} catch (e) {
		throw new Error(`解析 zip 失败：${(e as Error).message}`);
	}

	let websiteData: WebsiteData | null = null;
	let nav: NavConfig | null = null;
	const uploads: { name: string; data: Buffer }[] = [];
	const websiteEntry = findBackupEntry(entries, WEBSITE_BACKUP_IMPORT_FILES);
	const navEntry = findBackupEntry(entries, NAV_BACKUP_IMPORT_FILES);

	for (const ent of entries) {
		if (ent.name.startsWith("uploads/")) {
			const safe = safeUploadName(ent.name.slice("uploads/".length));
			if (safe) uploads.push({ name: safe, data: ent.data });
		}
	}

	if (websiteEntry) {
		try {
			websiteData = parseStructuredContent<WebsiteData>(
				websiteEntry.data.toString("utf8"),
			);
		} catch {
			throw new Error(`${websiteEntry.name} 解析失败`);
		}
	}
	if (navEntry) {
		try {
			nav = parseStructuredContent<NavConfig>(navEntry.data.toString("utf8"));
		} catch {
			throw new Error(`${navEntry.name} 解析失败`);
		}
	}

	if (!websiteData && !nav && uploads.length === 0) {
		throw new Error("压缩包中未找到 website/nav 配置文件或 uploads/");
	}

	if (websiteData) writeWebsiteData(websiteData);
	if (nav) writeNav(nav);
	if (uploads.length > 0) {
		fs.mkdirSync(UPLOADS_DIR, { recursive: true });
		for (const u of uploads) {
			fs.writeFileSync(path.join(UPLOADS_DIR, u.name), u.data);
		}
	}

	return {
		website: !!websiteData,
		nav: !!nav,
		uploads: uploads.length,
	};
}

function collectStructuredBackupEntries(
	baseName: "website" | "nav",
	value: unknown,
): ZipEntry[] {
	const names =
		baseName === "website" ? WEBSITE_BACKUP_EXPORT_FILES : NAV_BACKUP_EXPORT_FILES;
	return names.map((name) => ({
		name,
		data: Buffer.from(
			name.endsWith(".json")
				? JSON.stringify(value, null, 2)
				: stringifyStructuredContent(value, `${baseName}.yaml`),
			"utf8",
		),
	}));
}

function findBackupEntry(
	entries: ZipEntry[],
	names: readonly string[],
): ZipEntry | null {
	for (const name of names) {
		const matched = entries.find((entry) => entry.name === name);
		if (matched) return matched;
	}
	return null;
}
