import fs from "node:fs";
import { SYNC_FILE } from "@/lib/server/paths";
import { readJsonOr, writeJsonAtomic } from "@/lib/server/store";
import {
	createDataBackupZip,
	MAX_BACKUP_SIZE,
	restoreDataBackupZip,
	type BackupRestoreResult,
} from "@/lib/server/backup";

export type SyncProvider = "github" | "webdav";
export type SyncAction = "push" | "pull";

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

const DEFAULT_SYNC_CONFIG: DataSyncConfig = {
	github: {
		repo: "",
		branch: "main",
		filePath: "backups/go-nav-data.zip",
		token: "",
		commitMessage: "chore: backup Go Nav data",
	},
	webdav: {
		url: "",
		filePath: "go-nav/go-nav-data.zip",
		username: "",
		password: "",
	},
};

interface GitHubRepoParts {
	owner: string;
	repo: string;
}

interface GitHubContentResponse {
	type?: string;
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

export async function runDataSync(
	provider: SyncProvider,
	action: SyncAction,
): Promise<DataSyncRunResult> {
	const config = readDataSyncConfig();
	const at = new Date().toISOString();
	let result: DataSyncRunResult;

	try {
		if (action === "push") {
			const zip = createDataBackupZip();
			if (zip.length > MAX_BACKUP_SIZE) {
				throw new Error("备份文件过大，当前远端同步最大支持 20MB");
			}
			const remote =
				provider === "github"
					? await pushToGitHub(config.github, zip)
					: await pushToWebDav(config.webdav, zip);
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
			const { remote, zip } =
				provider === "github"
					? await pullFromGitHub(config.github)
					: await pullFromWebDav(config.webdav);
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
		throw new Error("请填写 GitHub 备份路径");
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
			return `GitHub 请求参数无效：请检查分支、文件路径与提交信息（原始信息：${message}）`;
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

async function getGitHubContent(
	parts: GitHubRepoParts,
	filePath: string,
	branch: string,
	token: string,
): Promise<GitHubContentResponse | null> {
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
	const data = (await res.json()) as GitHubContentResponse;
	if (data.type && data.type !== "file") {
		throw new Error("GitHub 备份路径不是文件");
	}
	return data;
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

async function bootstrapGitHubEmptyRepo(
	parts: GitHubRepoParts,
	config: GitHubSyncConfig,
	zip: Buffer,
) {
	const apiBase = `https://api.github.com/repos/${parts.owner}/${parts.repo}`;
	const blob = await githubFetch<GitHubCreateBlobResponse>(
		`${apiBase}/git/blobs`,
		config.token,
		{
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				content: zip.toString("base64"),
				encoding: "base64",
			}),
		},
	);

	const tree = await githubFetch<GitHubCreateTreeResponse>(
		`${apiBase}/git/trees`,
		config.token,
		{
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				tree: [
					{
						path: config.filePath,
						mode: "100644",
						type: "blob",
						sha: blob.sha,
					},
				],
			}),
		},
	);

	const commit = await githubFetch<GitHubCreateCommitResponse>(
		`${apiBase}/git/commits`,
		config.token,
		{
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				message: config.commitMessage || "chore: backup Go Nav data",
				tree: tree.sha,
				parents: [],
			}),
		},
	);

	await createGitHubRef(parts, `heads/${config.branch}`, commit.sha, config.token);
}

async function ensureGitHubBranchForPush(
	parts: GitHubRepoParts,
	config: GitHubSyncConfig,
	zip: Buffer,
) {
	const targetRef = await getGitHubRef(
		parts,
		`heads/${config.branch}`,
		config.token,
	);
	if (targetRef?.object?.sha) return;

	const repoInfo = await githubFetch<GitHubRepoResponse>(
		`https://api.github.com/repos/${parts.owner}/${parts.repo}`,
		config.token,
	);
	const defaultBranch = (repoInfo.default_branch || "").trim();
	if (defaultBranch) {
		const defaultRef = await getGitHubRef(
			parts,
			`heads/${defaultBranch}`,
			config.token,
		);
		if (defaultRef?.object?.sha) {
			await createGitHubRef(
				parts,
				`heads/${config.branch}`,
				defaultRef.object.sha,
				config.token,
			);
			return;
		}
	}

	// 走到这里代表仓库无任何提交（空仓库），创建首个提交并建立目标分支。
	await bootstrapGitHubEmptyRepo(parts, config, zip);
}

async function pushToGitHub(
	config: GitHubSyncConfig,
	zip: Buffer,
): Promise<string> {
	const parts = validateGitHubConfig(config);
	await ensureGitHubBranchForPush(parts, config, zip);
	const existing = await getGitHubContent(
		parts,
		config.filePath,
		config.branch,
		config.token,
	);
	const url = `https://api.github.com/repos/${parts.owner}/${parts.repo}/contents/${encodeGitHubPath(config.filePath)}`;
	await githubFetch<unknown>(url, config.token, {
		method: "PUT",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			message: config.commitMessage || "chore: backup Go Nav data",
			content: zip.toString("base64"),
			branch: config.branch,
			...(existing?.sha ? { sha: existing.sha } : {}),
		}),
	});
	return `github:${parts.owner}/${parts.repo}@${config.branch}:${config.filePath}`;
}

async function pullFromGitHub(
	config: GitHubSyncConfig,
): Promise<{ remote: string; zip: Buffer }> {
	const parts = validateGitHubConfig(config);
	const content = await getGitHubContent(
		parts,
		config.filePath,
		config.branch,
		config.token,
	);
	if (!content?.sha) {
		throw new Error("GitHub 上未找到备份文件");
	}
	if (content.content && content.encoding === "base64") {
		return {
			remote: `github:${parts.owner}/${parts.repo}@${config.branch}:${config.filePath}`,
			zip: Buffer.from(content.content.replace(/\s/g, ""), "base64"),
		};
	}
	const blobUrl = `https://api.github.com/repos/${parts.owner}/${parts.repo}/git/blobs/${content.sha}`;
	const blob = await githubFetch<GitHubBlobResponse>(blobUrl, config.token);
	if (!blob.content || blob.encoding !== "base64") {
		throw new Error("GitHub 备份文件不是 base64 blob");
	}
	return {
		remote: `github:${parts.owner}/${parts.repo}@${config.branch}:${config.filePath}`,
		zip: Buffer.from(blob.content.replace(/\s/g, ""), "base64"),
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
		throw new Error("请填写 WebDAV 备份路径");
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

function buildWebDavUrl(baseUrl: string, filePath: string): string {
	const base = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
	const encodedPath = filePath.split("/").map(encodeURIComponent).join("/");
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

async function readWebDavError(res: Response): Promise<string> {
	const text = await res.text().catch(() => "");
	return text.slice(0, 200) || `WebDAV 请求失败 (${res.status})`;
}

async function ensureWebDavDirectories(config: WebDavSyncConfig) {
	const auth = webDavAuthHeader(config);
	for (const url of buildWebDavDirectoryUrls(config.url, config.filePath)) {
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

async function pushToWebDav(
	config: WebDavSyncConfig,
	zip: Buffer,
): Promise<string> {
	validateWebDavConfig(config);
	await ensureWebDavDirectories(config);
	const target = buildWebDavUrl(config.url, config.filePath);
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
): Promise<{ remote: string; zip: Buffer }> {
	validateWebDavConfig(config);
	const target = buildWebDavUrl(config.url, config.filePath);
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
