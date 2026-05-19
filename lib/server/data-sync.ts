import fs from "node:fs";
import path from "node:path";
import { SYNC_FILE, UPLOADS_DIR } from "@/lib/server/paths";
import { readJsonOr, readNav, readWebsiteData, writeJsonAtomic, writeNav, writeWebsiteData } from "@/lib/server/store";
import {
	createDataBackupZip,
	MAX_BACKUP_SIZE,
	restoreDataBackupZip,
	type BackupRestoreResult,
} from "@/lib/server/backup";
import type { NavConfig, WebsiteData } from "@/types";

export type SyncProvider = "github" | "webdav";
export type SyncAction = "push" | "pull";

const WEBDAV_BACKUP_FILE_PREFIX = "go-nav-data";
const WEBDAV_BACKUP_FILE_SUFFIX = ".zip";

const ALLOWED_UPLOAD_EXTENSIONS = new Set([
	".png",
	".jpg",
	".jpeg",
	".gif",
	".webp",
	".svg",
	".ico",
]);

export interface GitHubSyncConfig {
	repo: string;
	branch: string;
	filePath: string;
	token: string;
	commitMessage: string;
}

export interface WebDavSyncConfig {
	url: string;
	filePath: string;
	username: string;
	password: string;
}

export interface WebDavBackupEntry {
	name: string;
	path: string;
	size?: number;
	createdAt?: string;
	modifiedAt?: string;
}

export interface DataSyncRunResult {
	ok: boolean;
	provider: SyncProvider;
	action: SyncAction;
	at: string;
	message: string;
	remote?: string;
	size?: number;
	restored?: BackupRestoreResult;
}

export interface DataSyncConfig {
	github: GitHubSyncConfig;
	webdav: WebDavSyncConfig;
}

export interface PublicDataSyncConfig {
	github: Omit<GitHubSyncConfig, "token"> & { hasToken: boolean };
	webdav: Omit<WebDavSyncConfig, "password"> & { hasPassword: boolean };
}

export interface DataSyncConfigInput {
	github?: Partial<GitHubSyncConfig>;
	webdav?: Partial<WebDavSyncConfig>;
}

export interface DataSyncRunOptions {
	target?: string;
}

interface GitHubRepoParts {
	owner: string;
	repo: string;
}

interface GitHubContentResponse {
	type?: string;
	name?: string;
	path?: string;
	sha?: string;
	content?: string;
	encoding?: string;
	download_url?: string | null;
}

interface GitHubBlobResponse {
	content?: string;
	encoding?: string;
	size?: number;
}

interface GitHubRepoResponse {
	default_branch?: string;
}

interface GitHubRefResponse {
	object?: {
		sha?: string;
	};
}

interface GitHubCreateBlobResponse {
	sha: string;
}

interface GitHubCreateTreeResponse {
	sha: string;
}

interface GitHubCreateCommitResponse {
	sha: string;
}

interface GitHubCommitResponse {
	tree?: {
		sha?: string;
	};
}

interface GitHubPushBase {
	parentCommitSha?: string;
	parentTreeSha?: string;
	sourceBranch?: string;
	createRef: boolean;
}

interface GitHubPushResult {
	remote: string;
	changed: boolean;
}

interface SyncUploadFile {
	name: string;
	data: Buffer;
}

interface SyncFileEntry {
	path: string;
	data: Buffer;
}

interface WebDavPropfindItem {
	href: string;
	isCollection: boolean;
	size?: number;
	createdAt?: string;
	modifiedAt?: string;
}

const DEFAULT_SYNC_CONFIG: DataSyncConfig = {
	github: {
		repo: "",
		branch: "main",
		filePath: "data",
		token: "",
		commitMessage: "chore: backup Go Nav data",
	},
	webdav: {
		url: "",
		filePath: "backup/go-nav",
		username: "",
		password: "",
	},
};

function cloneDefaultConfig(): DataSyncConfig {
	return JSON.parse(JSON.stringify(DEFAULT_SYNC_CONFIG)) as DataSyncConfig;
}

function asString(value: unknown, fallback = ""): string {
	return typeof value === "string" ? value : fallback;
}

function normalizeRemotePath(value: string, fallback: string): string {
	const trimmed = value.trim().replace(/\\/g, "/").replace(/^\/+/, "");
	const compact = trimmed.replace(/\/{2,}/g, "/");
	if (!compact) return fallback;
	const parts = compact.split("/");
	if (parts.some((part) => !part || part === "." || part === "..")) {
		return fallback;
	}
	return compact;
}

function normalizeConfig(input: Partial<DataSyncConfig>): DataSyncConfig {
	const defaults = cloneDefaultConfig();
	const github: Partial<GitHubSyncConfig> = input.github ?? {};
	const webdav: Partial<WebDavSyncConfig> = input.webdav ?? {};
	return {
		github: {
			repo: asString(github.repo).trim(),
			branch: asString(github.branch, defaults.github.branch).trim() || "main",
			filePath: normalizeRemotePath(
				asString(github.filePath, defaults.github.filePath),
				defaults.github.filePath,
			),
			token: asString(github.token).trim(),
			commitMessage:
				asString(github.commitMessage, defaults.github.commitMessage).trim() ||
				defaults.github.commitMessage,
		},
		webdav: {
			url: asString(webdav.url).trim(),
			filePath: normalizeRemotePath(
				asString(webdav.filePath, defaults.webdav.filePath),
				defaults.webdav.filePath,
			),
			username: asString(webdav.username).trim(),
			password: asString(webdav.password),
		},
	};
}

function normalizeWebDavTarget(target: string | undefined): string {
	const trimmed = (target || "")
		.trim()
		.replace(/\\/g, "/")
		.replace(/^\/+/, "")
		.replace(/\/{2,}/g, "/");
	if (!trimmed) return "";
	const parts = trimmed.split("/");
	if (parts.some((part) => !part || part === "." || part === "..")) return "";
	return parts.join("/");
}

function safeUploadName(name: string): string | null {
	const base = path.basename(name);
	if (!base || base.startsWith(".")) return null;
	if (base !== name) return null;
	if (!ALLOWED_UPLOAD_EXTENSIONS.has(path.extname(base).toLowerCase())) return null;
	return base;
}

function getUploadEntriesForSync(): SyncUploadFile[] {
	if (!fs.existsSync(UPLOADS_DIR)) return [];
	const uploads: SyncUploadFile[] = [];
	for (const file of fs.readdirSync(UPLOADS_DIR)) {
		const safe = safeUploadName(file);
		if (!safe) continue;
		const full = path.join(UPLOADS_DIR, safe);
		try {
			if (!fs.statSync(full).isFile()) continue;
			uploads.push({ name: safe, data: fs.readFileSync(full) });
		} catch {
			// 单个文件读取失败不应阻塞整体同步。
		}
	}
	return uploads;
}

function collectGitHubSyncFiles(baseDir: string): SyncFileEntry[] {
	const websiteData = readWebsiteData();
	const nav = readNav();
	const files: SyncFileEntry[] = [
		{
			path: `${baseDir}/website.json`,
			data: Buffer.from(JSON.stringify(websiteData, null, 2), "utf8"),
		},
		{
			path: `${baseDir}/nav.json`,
			data: Buffer.from(JSON.stringify(nav, null, 2), "utf8"),
		},
	];

	for (const upload of getUploadEntriesForSync()) {
		files.push({
			path: `${baseDir}/uploads/${upload.name}`,
			data: upload.data,
		});
	}

	return files;
}

export function readDataSyncConfig(): DataSyncConfig {
	const raw = readJsonOr<Partial<DataSyncConfig>>(SYNC_FILE, cloneDefaultConfig());
	return normalizeConfig(raw);
}

export function writeDataSyncConfig(config: DataSyncConfig) {
	writeJsonAtomic(SYNC_FILE, normalizeConfig(config));
	try {
		fs.chmodSync(SYNC_FILE, 0o600);
	} catch {
		// 某些挂载卷不支持 chmod，同步功能不应因此整体不可用。
	}
}

export function toPublicDataSyncConfig(
	config: DataSyncConfig,
): PublicDataSyncConfig {
	return {
		github: {
			repo: config.github.repo,
			branch: config.github.branch,
			filePath: config.github.filePath,
			commitMessage: config.github.commitMessage,
			hasToken: Boolean(config.github.token),
		},
		webdav: {
			url: config.webdav.url,
			filePath: config.webdav.filePath,
			username: config.webdav.username,
			hasPassword: Boolean(config.webdav.password),
		},
	};
}

export function saveDataSyncConfigFromInput(
	input: DataSyncConfigInput,
): PublicDataSyncConfig {
	const current = readDataSyncConfig();
	const next = normalizeConfig({
		github: {
			...current.github,
			...input.github,
			token:
				input.github && "token" in input.github
					? input.github.token?.trim() || current.github.token
					: current.github.token,
		},
		webdav: {
			...current.webdav,
			...input.webdav,
			password:
				input.webdav && "password" in input.webdav
					? input.webdav.password || current.webdav.password
					: current.webdav.password,
		},
	});
	writeDataSyncConfig(next);
	return toPublicDataSyncConfig(next);
}

export async function listWebDavBackups(): Promise<WebDavBackupEntry[]> {
	const config = readDataSyncConfig();
	const entries = await listWebDavBackupFiles(config.webdav);
	return entries
		.filter((entry) => !entry.isCollection)
		.map((entry) => ({
			name: entry.name,
			path: entry.path,
			size: entry.size,
			createdAt: entry.createdAt,
			modifiedAt: entry.modifiedAt,
		}))
		.sort((a, b) => {
			const at = Date.parse(a.createdAt || a.modifiedAt || "");
			const bt = Date.parse(b.createdAt || b.modifiedAt || "");
			if (Number.isFinite(at) && Number.isFinite(bt)) return bt - at;
			if (Number.isFinite(at)) return -1;
			if (Number.isFinite(bt)) return 1;
			return b.name.localeCompare(a.name);
		});
}

export async function deleteWebDavBackup(targetPathInput: string): Promise<void> {
	const config = readDataSyncConfig();
	await deleteWebDavBackupFile(config.webdav, targetPathInput);
}

export async function runDataSync(
	provider: SyncProvider,
	action: SyncAction,
	options: DataSyncRunOptions = {},
): Promise<DataSyncRunResult> {
	const config = readDataSyncConfig();
	const at = new Date().toISOString();
	let result: DataSyncRunResult;

	try {
		if (provider === "github") {
			if (action === "push") {
				const pushed = await pushToGitHub(config.github);
				result = {
					ok: true,
					provider,
					action,
					at,
					remote: pushed.remote,
					message: pushed.changed ? "推送成功" : "数据没有变化，无需推送",
				};
			} else {
				const restored = await pullFromGitHub(config.github);
				result = {
					ok: true,
					provider,
					action,
					at,
					remote: restored.remote,
					restored: restored.result,
					message: "拉取并还原成功",
				};
			}
		} else if (action === "push") {
			const zip = createDataBackupZip();
			if (zip.length > MAX_BACKUP_SIZE) {
				throw new Error("备份文件过大，当前远端同步最大支持 20MB");
			}
			const remote = await pushToWebDav(config.webdav, zip);
			result = {
				ok: true,
				provider,
				action,
				at,
				remote,
				size: zip.length,
				message: "推送成功",
			};
		} else {
			const { remote, zip } = await pullFromWebDav(config.webdav, options.target);
			if (zip.length > MAX_BACKUP_SIZE) {
				throw new Error("远端备份文件过大，当前最大支持 20MB");
			}
			const restored = restoreDataBackupZip(zip);
			result = {
				ok: true,
				provider,
				action,
				at,
				remote,
				size: zip.length,
				restored,
				message: "拉取并还原成功",
			};
		}
	} catch (e) {
		result = {
			ok: false,
			provider,
			action,
			at,
			message: (e as Error).message,
		};
	}

	return result;
}

function parseGitHubRepo(input: string): GitHubRepoParts | null {
	const trimmed = input.trim();
	if (!trimmed) return null;
	const urlMatch = trimmed.match(
		/^https?:\/\/github\.com\/([^/]+)\/([^/#?]+?)(?:\.git)?(?:[/?#].*)?$/i,
	);
	if (urlMatch?.[1] && urlMatch[2]) {
		return { owner: urlMatch[1], repo: urlMatch[2].replace(/\.git$/i, "") };
	}
	const shortMatch = trimmed.match(/^([^/\s]+)\/([^/\s]+?)(?:\.git)?$/);
	if (shortMatch?.[1] && shortMatch[2]) {
		return { owner: shortMatch[1], repo: shortMatch[2].replace(/\.git$/i, "") };
	}
	return null;
}

function encodeGitHubPath(filePath: string): string {
	return filePath.split("/").map(encodeURIComponent).join("/");
}

function validateGitHubConfig(config: GitHubSyncConfig): GitHubRepoParts {
	const parsed = parseGitHubRepo(config.repo);
	if (!parsed) {
		throw new Error("请填写 GitHub 仓库，格式如 owner/repo");
	}
	if (!config.branch.trim()) {
		throw new Error("请填写 GitHub 分支");
	}
	if (!config.filePath.trim()) {
		throw new Error("请填写 GitHub 备份目录");
	}
	if (!config.token.trim()) {
		throw new Error("请填写 GitHub Token");
	}
	return parsed;
}

async function readGitHubError(res: Response): Promise<string> {
	const text = await res.text().catch(() => "");
	const status = res.status;
	if (!text) return `GitHub 请求失败 (${res.status})`;
	try {
		const data = JSON.parse(text) as { message?: string };
		const message = data.message || `GitHub 请求失败 (${status})`;
		if (status === 401 || status === 403) {
			return `GitHub 鉴权失败：请检查 Token 是否有效，以及是否授予目标仓库 Contents 读写权限（原始信息：${message}）`;
		}
		if (status === 404) {
			return `GitHub 资源不存在：请检查仓库名、分支名以及 Token 是否有该仓库访问权限（原始信息：${message}）`;
		}
		if (status === 422) {
			return `GitHub 请求参数无效：请检查分支、路径与提交信息（原始信息：${message}）`;
		}
		if (status === 409 && message.includes("Git Repository is empty")) {
			return "GitHub 仓库尚未初始化（空仓库）。请先在仓库中创建一个 README 或任意首个文件并提交一次，然后再执行同步推送。";
		}
		return message;
	} catch {
		return text.slice(0, 200) || `GitHub 请求失败 (${res.status})`;
	}
}

async function githubFetch<T>(
	url: string,
	token: string,
	init: RequestInit = {},
): Promise<T> {
	const res = await fetch(url, {
		...init,
		headers: {
			Accept: "application/vnd.github+json",
			Authorization: `Bearer ${token}`,
			"X-GitHub-Api-Version": "2022-11-28",
			...(init.headers ?? {}),
		},
	});
	if (!res.ok) {
		throw new Error(await readGitHubError(res));
	}
	return (await res.json()) as T;
}

async function getGitHubPathContent(
	parts: GitHubRepoParts,
	filePath: string,
	branch: string,
	token: string,
): Promise<GitHubContentResponse | GitHubContentResponse[] | null> {
	const url = `https://api.github.com/repos/${parts.owner}/${parts.repo}/contents/${encodeGitHubPath(filePath)}?ref=${encodeURIComponent(branch)}`;
	const res = await fetch(url, {
		headers: {
			Accept: "application/vnd.github+json",
			Authorization: `Bearer ${token}`,
			"X-GitHub-Api-Version": "2022-11-28",
		},
	});
	if (res.status === 404) return null;
	if (!res.ok) throw new Error(await readGitHubError(res));
	return (await res.json()) as GitHubContentResponse | GitHubContentResponse[];
}

function githubHeaders(token: string): Record<string, string> {
	return {
		Accept: "application/vnd.github+json",
		Authorization: `Bearer ${token}`,
		"X-GitHub-Api-Version": "2022-11-28",
	};
}

async function getGitHubRef(
	parts: GitHubRepoParts,
	ref: string,
	token: string,
): Promise<GitHubRefResponse | null> {
	const url = `https://api.github.com/repos/${parts.owner}/${parts.repo}/git/ref/${encodeURIComponent(ref)}`;
	const res = await fetch(url, { headers: githubHeaders(token) });
	if (res.status === 404) return null;
	if (res.status === 409) {
		const text = await res.text().catch(() => "");
		if (text.includes("Git Repository is empty")) {
			return null;
		}
		throw new Error(
			text ? text.slice(0, 200) : `GitHub 请求失败 (${res.status})`,
		);
	}
	if (!res.ok) throw new Error(await readGitHubError(res));
	return (await res.json()) as GitHubRefResponse;
}

async function createGitHubRef(
	parts: GitHubRepoParts,
	ref: string,
	sha: string,
	token: string,
) {
	const url = `https://api.github.com/repos/${parts.owner}/${parts.repo}/git/refs`;
	await githubFetch<unknown>(url, token, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			ref: `refs/${ref}`,
			sha,
		}),
	});
}

async function updateGitHubRef(
	parts: GitHubRepoParts,
	ref: string,
	sha: string,
	token: string,
) {
	const url = `https://api.github.com/repos/${parts.owner}/${parts.repo}/git/refs/${encodeGitHubPath(ref)}`;
	await githubFetch<unknown>(url, token, {
		method: "PATCH",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			sha,
			force: false,
		}),
	});
}

async function getGitHubCommit(
	parts: GitHubRepoParts,
	commitSha: string,
	token: string,
): Promise<GitHubCommitResponse> {
	const url = `https://api.github.com/repos/${parts.owner}/${parts.repo}/git/commits/${commitSha}`;
	return await githubFetch<GitHubCommitResponse>(url, token);
}

async function resolveGitHubPushBase(
	parts: GitHubRepoParts,
	config: GitHubSyncConfig,
): Promise<GitHubPushBase> {
	const targetRef = await getGitHubRef(parts, `heads/${config.branch}`, config.token);
	if (targetRef?.object?.sha) {
		const commit = await getGitHubCommit(parts, targetRef.object.sha, config.token);
		return {
			parentCommitSha: targetRef.object.sha,
			parentTreeSha: commit.tree?.sha,
			sourceBranch: config.branch,
			createRef: false,
		};
	}
	const repoInfo = await githubFetch<GitHubRepoResponse>(
		`https://api.github.com/repos/${parts.owner}/${parts.repo}`,
		config.token,
	);
	const defaultBranch = (repoInfo.default_branch || "").trim();
	if (defaultBranch) {
		const defaultRef = await getGitHubRef(parts, `heads/${defaultBranch}`, config.token);
		if (defaultRef?.object?.sha) {
			const commit = await getGitHubCommit(parts, defaultRef.object.sha, config.token);
			return {
				parentCommitSha: defaultRef.object.sha,
				parentTreeSha: commit.tree?.sha,
				sourceBranch: defaultBranch,
				createRef: true,
			};
		}
	}
	return { createRef: true };
}

async function readGitHubFileBuffer(
	parts: GitHubRepoParts,
	filePath: string,
	branch: string,
	token: string,
): Promise<Buffer> {
	const content = await getGitHubPathContent(parts, filePath, branch, token);
	if (!content || Array.isArray(content)) {
		throw new Error(`GitHub 路径不是文件：${filePath}`);
	}
	if (content.content && content.encoding === "base64") {
		return Buffer.from(content.content.replace(/\s/g, ""), "base64");
	}
	if (!content.sha) {
		throw new Error(`GitHub 文件读取失败：${filePath}`);
	}
	const blobUrl = `https://api.github.com/repos/${parts.owner}/${parts.repo}/git/blobs/${content.sha}`;
	const blob = await githubFetch<GitHubBlobResponse>(blobUrl, token);
	if (!blob.content || blob.encoding !== "base64") {
		throw new Error(`GitHub 文件不是 base64 blob：${filePath}`);
	}
	return Buffer.from(blob.content.replace(/\s/g, ""), "base64");
}

async function listGitHubDirectoryRecursive(
	parts: GitHubRepoParts,
	dirPath: string,
	branch: string,
	token: string,
): Promise<GitHubContentResponse[]> {
	const content = await getGitHubPathContent(parts, dirPath, branch, token);
	if (!content) return [];
	if (!Array.isArray(content)) {
		if (content.type === "dir") {
			return [];
		}
		throw new Error(`GitHub 目录路径无效：${dirPath}`);
	}

	const files: GitHubContentResponse[] = [];
	for (const entry of content) {
		if (entry.type === "file") {
			files.push(entry);
			continue;
		}
		if (entry.type === "dir" && entry.path) {
			const children = await listGitHubDirectoryRecursive(
				parts,
				entry.path,
				branch,
				token,
			);
			files.push(...children);
		}
	}

	return files;
}

async function pushToGitHub(config: GitHubSyncConfig): Promise<GitHubPushResult> {
	const parts = validateGitHubConfig(config);
	const baseDir = normalizeRemotePath(
		config.filePath,
		DEFAULT_SYNC_CONFIG.github.filePath,
	);
	const files = collectGitHubSyncFiles(baseDir);
	if (files.length === 0) {
		throw new Error("没有可同步到 GitHub 的数据文件");
	}

	const pushBase = await resolveGitHubPushBase(parts, config);
	if (pushBase.parentCommitSha && !pushBase.parentTreeSha) {
		throw new Error("无法获取 GitHub 基线树信息，请稍后重试");
	}

	const desiredPaths = new Set(files.map((file) => file.path));
	let stalePaths: string[] = [];
	if (pushBase.sourceBranch) {
		const existingFiles = await listGitHubDirectoryRecursive(
			parts,
			baseDir,
			pushBase.sourceBranch,
			config.token,
		).catch(() => []);
		stalePaths = existingFiles
			.map((entry) => entry.path || "")
			.filter((p) => p && !desiredPaths.has(p));
	}

	const apiBase = `https://api.github.com/repos/${parts.owner}/${parts.repo}`;
	const tree: Array<{
		path: string;
		mode: "100644";
		type: "blob";
		sha: string | null;
	}> = [];

	for (const file of files) {
		const blob = await githubFetch<GitHubCreateBlobResponse>(
			`${apiBase}/git/blobs`,
			config.token,
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					content: file.data.toString("base64"),
					encoding: "base64",
				}),
			},
		);
		tree.push({
			path: file.path,
			mode: "100644",
			type: "blob",
			sha: blob.sha,
		});
	}

	for (const stalePath of stalePaths) {
		tree.push({
			path: stalePath,
			mode: "100644",
			type: "blob",
			sha: null,
		});
	}

	const newTree = await githubFetch<GitHubCreateTreeResponse>(
		`${apiBase}/git/trees`,
		config.token,
		{
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				tree,
				...(pushBase.parentTreeSha ? { base_tree: pushBase.parentTreeSha } : {}),
			}),
		},
	);

	const remote = `github:${parts.owner}/${parts.repo}@${config.branch}:${baseDir}/(website.json,nav.json,uploads/*)`;
	if (pushBase.parentTreeSha && newTree.sha === pushBase.parentTreeSha) {
		return { remote, changed: false };
	}

	const commit = await githubFetch<GitHubCreateCommitResponse>(
		`${apiBase}/git/commits`,
		config.token,
		{
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				message: config.commitMessage || "chore: backup Go Nav data",
				tree: newTree.sha,
				parents: pushBase.parentCommitSha ? [pushBase.parentCommitSha] : [],
			}),
		},
	);

	if (pushBase.createRef) {
		await createGitHubRef(parts, `heads/${config.branch}`, commit.sha, config.token);
	} else {
		await updateGitHubRef(parts, `heads/${config.branch}`, commit.sha, config.token);
	}

	return { remote, changed: true };
}

async function pullFromGitHub(
	config: GitHubSyncConfig,
): Promise<{ remote: string; result: BackupRestoreResult }> {
	const parts = validateGitHubConfig(config);
	const baseDir = normalizeRemotePath(config.filePath, DEFAULT_SYNC_CONFIG.github.filePath);
	const websitePath = `${baseDir}/website.json`;
	const navPath = `${baseDir}/nav.json`;
	const uploadsDirPath = `${baseDir}/uploads`;

	const websiteBuf = await readGitHubFileBuffer(
		parts,
		websitePath,
		config.branch,
		config.token,
	);
	const navBuf = await readGitHubFileBuffer(
		parts,
		navPath,
		config.branch,
		config.token,
	);

	let websiteData: WebsiteData;
	let navData: NavConfig;
	try {
		websiteData = JSON.parse(websiteBuf.toString("utf8")) as WebsiteData;
	} catch {
		throw new Error("GitHub 的 website.json 解析失败");
	}
	try {
		navData = JSON.parse(navBuf.toString("utf8")) as NavConfig;
	} catch {
		throw new Error("GitHub 的 nav.json 解析失败");
	}

	writeWebsiteData(websiteData);
	writeNav(navData);

	const uploadEntries = await listGitHubDirectoryRecursive(
		parts,
		uploadsDirPath,
		config.branch,
		config.token,
	).catch(() => []);

	let uploadsCount = 0;
	if (uploadEntries.length > 0) {
		fs.mkdirSync(UPLOADS_DIR, { recursive: true });
		for (const entry of uploadEntries) {
			if (!entry.path) continue;
			const name = entry.path.slice(uploadsDirPath.length + 1);
			const safe = safeUploadName(name);
			if (!safe) continue;
			const buf = await readGitHubFileBuffer(
				parts,
				entry.path,
				config.branch,
				config.token,
			);
			fs.writeFileSync(path.join(UPLOADS_DIR, safe), buf);
			uploadsCount += 1;
		}
	}

	return {
		remote: `github:${parts.owner}/${parts.repo}@${config.branch}:${baseDir}`,
		result: {
			website: true,
			nav: true,
			uploads: uploadsCount,
		},
	};
}

function validateWebDavConfig(config: WebDavSyncConfig) {
	if (!config.url.trim()) {
		throw new Error("请填写 WebDAV 地址");
	}
	try {
		new URL(config.url);
	} catch {
		throw new Error("WebDAV 地址不是有效 URL");
	}
	if (!config.filePath.trim()) {
		throw new Error("请填写 WebDAV 备份目录");
	}
	if (!config.username.trim()) {
		throw new Error("请填写 WebDAV 用户名");
	}
	if (!config.password) {
		throw new Error("请填写 WebDAV 密码");
	}
}

function webDavAuthHeader(config: WebDavSyncConfig): string {
	return `Basic ${Buffer.from(`${config.username}:${config.password}`).toString("base64")}`;
}

function buildWebDavUrl(baseUrl: string, remotePath: string): string {
	const base = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
	const encodedPath = remotePath.split("/").map(encodeURIComponent).join("/");
	return new URL(encodedPath, base).toString();
}

function buildWebDavDirectoryUrls(baseUrl: string, filePath: string): string[] {
	const parts = filePath.split("/").slice(0, -1);
	const urls: string[] = [];
	for (let i = 0; i < parts.length; i++) {
		const dir = parts.slice(0, i + 1).join("/");
		urls.push(buildWebDavUrl(baseUrl, `${dir}/`));
	}
	return urls;
}

function formatCompactTimestamp(date: Date): string {
	const y = date.getFullYear();
	const m = String(date.getMonth() + 1).padStart(2, "0");
	const d = String(date.getDate()).padStart(2, "0");
	const hh = String(date.getHours()).padStart(2, "0");
	const mm = String(date.getMinutes()).padStart(2, "0");
	const ss = String(date.getSeconds()).padStart(2, "0");
	return `${y}${m}${d}${hh}${mm}${ss}`;
}

function generateWebDavBackupFileName(date = new Date()): string {
	return `${WEBDAV_BACKUP_FILE_PREFIX}-${formatCompactTimestamp(date)}${WEBDAV_BACKUP_FILE_SUFFIX}`;
}

function decodeHtmlEntities(input: string): string {
	return input
		.replace(/&amp;/g, "&")
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'");
}

function parseWebDavMultiStatus(xml: string, baseUrl: string): WebDavPropfindItem[] {
	const responses =
		xml.match(/<[^>]*:?response\b[\s\S]*?<\/[^>]*:?response>/gi) || [];
	const list: WebDavPropfindItem[] = [];

	for (const block of responses) {
		const hrefMatch = block.match(
			/<[^>]*:?href\b[^>]*>([\s\S]*?)<\/[^>]*:?href>/i,
		);
		if (!hrefMatch?.[1]) continue;
		const rawHref = decodeHtmlEntities(hrefMatch[1].trim());

		let pathname = "";
		try {
			pathname = decodeURIComponent(new URL(rawHref, baseUrl).pathname);
		} catch {
			continue;
		}
		const trimmedPath = pathname.replace(/\/+$/, "");
		const name = trimmedPath.slice(trimmedPath.lastIndexOf("/") + 1);
		if (!name) continue;

		const propBlock =
			block.match(
				/<[^>]*:?prop\b[^>]*>([\s\S]*?)<\/[^>]*:?prop>/i,
			)?.[1] || "";
		const isCollection = /<[^>]*:?collection\b[^>]*\/?\s*>/i.test(propBlock);

		const sizeText =
			propBlock.match(
				/<[^>]*:?getcontentlength\b[^>]*>([\s\S]*?)<\/[^>]*:?getcontentlength>/i,
			)?.[1] || "";
		const sizeNum = Number(sizeText.trim());

		const createdAt =
			propBlock.match(
				/<[^>]*:?creationdate\b[^>]*>([\s\S]*?)<\/[^>]*:?creationdate>/i,
			)?.[1]?.trim() || undefined;
		const modifiedAt =
			propBlock.match(
				/<[^>]*:?getlastmodified\b[^>]*>([\s\S]*?)<\/[^>]*:?getlastmodified>/i,
			)?.[1]?.trim() || undefined;

		list.push({
			href: rawHref,
			isCollection,
			size: Number.isFinite(sizeNum) ? sizeNum : undefined,
			createdAt,
			modifiedAt,
		});
	}

	return list;
}

function normalizeWebDavEntryPath(
	baseUrl: string,
	href: string,
	fallbackName: string,
): string {
	try {
		const url = new URL(href, baseUrl);
		const rawPath = decodeURIComponent(url.pathname);
		const cleaned = rawPath.replace(/^\/+/, "").replace(/\/+$/, "");
		return cleaned || fallbackName;
	} catch {
		return fallbackName;
	}
}

async function readWebDavError(res: Response): Promise<string> {
	const text = await res.text().catch(() => "");
	return text.slice(0, 200) || `WebDAV 请求失败 (${res.status})`;
}

async function ensureWebDavDirectories(config: WebDavSyncConfig, dirPath: string) {
	const auth = webDavAuthHeader(config);
	for (const url of buildWebDavDirectoryUrls(config.url, `${dirPath}/x`)) {
		const res = await fetch(url, {
			method: "MKCOL",
			headers: { Authorization: auth },
		});
		if (res.ok || res.status === 405) continue;
		if (res.status === 409) {
			throw new Error("WebDAV 父目录不存在，请检查基础地址");
		}
		throw new Error(await readWebDavError(res));
	}
}

async function listWebDavBackupFiles(
	config: WebDavSyncConfig,
): Promise<Array<WebDavBackupEntry & { isCollection: boolean }>> {
	validateWebDavConfig(config);
	const baseDir = normalizeRemotePath(config.filePath, DEFAULT_SYNC_CONFIG.webdav.filePath);
	const targetDirUrl = buildWebDavUrl(config.url, `${baseDir}/`);
	const res = await fetch(targetDirUrl, {
		method: "PROPFIND",
		headers: {
			Authorization: webDavAuthHeader(config),
			Depth: "1",
			"Content-Type": "application/xml; charset=utf-8",
		},
		body: `<?xml version="1.0" encoding="utf-8" ?>\n<d:propfind xmlns:d="DAV:"><d:prop><d:resourcetype /><d:getcontentlength /><d:creationdate /><d:getlastmodified /></d:prop></d:propfind>`,
	});
	if (res.status === 404) {
		return [];
	}
	if (!res.ok && res.status !== 207) {
		throw new Error(await readWebDavError(res));
	}
	const xml = await res.text();
	const parsed = parseWebDavMultiStatus(xml, config.url);
	if (parsed.length === 0) return [];

	const normalizedDirPath = normalizeWebDavEntryPath(config.url, targetDirUrl, baseDir)
		.replace(/\/+$/, "")
		.toLowerCase();

	const entries: Array<WebDavBackupEntry & { isCollection: boolean }> = [];
	for (const item of parsed) {
		const pathValue = normalizeWebDavEntryPath(config.url, item.href, "");
		if (!pathValue) continue;
		if (pathValue.replace(/\/+$/, "").toLowerCase() === normalizedDirPath) {
			continue;
		}
		const name = pathValue.slice(pathValue.lastIndexOf("/") + 1);
		if (!name) continue;
		entries.push({
			name,
			path: pathValue,
			size: item.size,
			createdAt: item.createdAt,
			modifiedAt: item.modifiedAt,
			isCollection: item.isCollection,
		});
	}
	return entries;
}

async function pushToWebDav(
	config: WebDavSyncConfig,
	zip: Buffer,
): Promise<string> {
	validateWebDavConfig(config);
	const baseDir = normalizeRemotePath(config.filePath, DEFAULT_SYNC_CONFIG.webdav.filePath);
	await ensureWebDavDirectories(config, baseDir);
	const filename = generateWebDavBackupFileName();
	const targetPath = `${baseDir}/${filename}`;
	const target = buildWebDavUrl(config.url, targetPath);
	const res = await fetch(target, {
		method: "PUT",
		headers: {
			Authorization: webDavAuthHeader(config),
			"Content-Type": "application/zip",
		},
		body: new Uint8Array(zip),
	});
	if (!res.ok) {
		throw new Error(await readWebDavError(res));
	}
	return target;
}

async function pullFromWebDav(
	config: WebDavSyncConfig,
	targetPathInput?: string,
): Promise<{ remote: string; zip: Buffer }> {
	validateWebDavConfig(config);
	const baseDir = normalizeRemotePath(config.filePath, DEFAULT_SYNC_CONFIG.webdav.filePath);
	const normalizedTarget = normalizeWebDavTarget(targetPathInput);
	if (!normalizedTarget) {
		throw new Error("请选择要恢复的 WebDAV 备份文件");
	}

	const expectedPrefix = `${baseDir}/`.toLowerCase();
	if (!normalizedTarget.toLowerCase().startsWith(expectedPrefix)) {
		throw new Error("所选备份文件不在当前 WebDAV 备份目录下");
	}

	const target = buildWebDavUrl(config.url, normalizedTarget);
	const res = await fetch(target, {
		method: "GET",
		headers: { Authorization: webDavAuthHeader(config) },
	});
	if (!res.ok) {
		throw new Error(await readWebDavError(res));
	}
	return {
		remote: target,
		zip: Buffer.from(await res.arrayBuffer()),
	};
}

async function deleteWebDavBackupFile(
	config: WebDavSyncConfig,
	targetPathInput: string,
): Promise<void> {
	validateWebDavConfig(config);
	const baseDir = normalizeRemotePath(
		config.filePath,
		DEFAULT_SYNC_CONFIG.webdav.filePath,
	);
	const normalizedTarget = normalizeWebDavTarget(targetPathInput);
	if (!normalizedTarget) {
		throw new Error("请选择要删除的 WebDAV 备份文件");
	}
	const expectedPrefix = `${baseDir}/`.toLowerCase();
	if (!normalizedTarget.toLowerCase().startsWith(expectedPrefix)) {
		throw new Error("所选备份文件不在当前 WebDAV 备份目录下");
	}

	const target = buildWebDavUrl(config.url, normalizedTarget);
	const res = await fetch(target, {
		method: "DELETE",
		headers: { Authorization: webDavAuthHeader(config) },
	});
	if (res.status === 404) {
		throw new Error("备份文件不存在或已被删除");
	}
	if (!res.ok) {
		throw new Error(await readWebDavError(res));
	}
}
