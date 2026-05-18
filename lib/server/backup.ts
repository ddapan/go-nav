import fs from "node:fs";
import path from "node:path";
import { UPLOADS_DIR } from "@/lib/server/paths";
import {
	readNav,
	readWebsiteData,
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
		{
			name: "website.json",
			data: Buffer.from(JSON.stringify(websiteData, null, 2), "utf8"),
		},
		{
			name: "nav.json",
			data: Buffer.from(JSON.stringify(nav, null, 2), "utf8"),
		},
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

	for (const ent of entries) {
		if (ent.name === "website.json") {
			try {
				websiteData = JSON.parse(ent.data.toString("utf8")) as WebsiteData;
			} catch {
				throw new Error("website.json 解析失败");
			}
		} else if (ent.name === "nav.json") {
			try {
				nav = JSON.parse(ent.data.toString("utf8")) as NavConfig;
			} catch {
				throw new Error("nav.json 解析失败");
			}
		} else if (ent.name.startsWith("uploads/")) {
			const safe = safeUploadName(ent.name.slice("uploads/".length));
			if (safe) uploads.push({ name: safe, data: ent.data });
		}
	}

	if (!websiteData && !nav && uploads.length === 0) {
		throw new Error("压缩包中未找到 website.json / nav.json / uploads/");
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
