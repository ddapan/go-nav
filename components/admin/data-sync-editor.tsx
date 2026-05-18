"use client";

import {
	Button,
	Card,
	Chip,
	Input,
	Label,
	Spinner,
	TextField,
	toast,
} from "@heroui/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
	BiCheckCircle,
	BiCloudDownload,
	BiCloudUpload,
	BiGitBranch,
	BiSync,
	BiXCircle,
} from "react-icons/bi";

type SyncProvider = "github" | "webdav";
type SyncAction = "push" | "pull";

interface BackupRestoreResult {
	website: boolean;
	nav: boolean;
	uploads: number;
}

interface DataSyncRunResult {
	ok: boolean;
	provider: SyncProvider;
	action: SyncAction;
	at: string;
	message: string;
	remote?: string;
	size?: number;
	restored?: BackupRestoreResult;
}

interface PublicDataSyncConfig {
	github: {
		repo: string;
		branch: string;
		filePath: string;
		commitMessage: string;
		hasToken: boolean;
	};
	webdav: {
		url: string;
		filePath: string;
		username: string;
		hasPassword: boolean;
	};
}

interface SyncDraft {
	github: PublicDataSyncConfig["github"] & { token: string };
	webdav: PublicDataSyncConfig["webdav"] & { password: string };
}

const DEFAULT_DRAFT: SyncDraft = {
	github: {
		repo: "",
		branch: "main",
		filePath: "backups/go-nav-data.zip",
		token: "",
		commitMessage: "chore: backup Go Nav data",
		hasToken: false,
	},
	webdav: {
		url: "",
		filePath: "go-nav/go-nav-data.zip",
		username: "",
		password: "",
		hasPassword: false,
	},
};

function draftFromConfig(config: PublicDataSyncConfig): SyncDraft {
	return {
		github: {
			...config.github,
			token: "",
		},
		webdav: {
			...config.webdav,
			password: "",
		},
	};
}

function providerLabel(provider: SyncProvider): string {
	return provider === "github" ? "GitHub" : "WebDAV";
}

function actionLabel(action: SyncAction): string {
	return action === "push" ? "推送" : "拉取";
}

function Field({
	label,
	description,
	children,
}: {
	label: string;
	description?: string;
	children: React.ReactNode;
}) {
	return (
		<div className="flex flex-col gap-2">
			<Label className="text-sm font-medium">{label}</Label>
			{children}
			{description && <p className="text-xs text-default-500">{description}</p>}
		</div>
	);
}

export function DataSyncEditor() {
	const [draft, setDraft] = useState<SyncDraft>(DEFAULT_DRAFT);
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [running, setRunning] = useState<string | null>(null);

	const isBusy = loading || saving || running !== null;

	const loadConfig = useCallback(async () => {
		setLoading(true);
		try {
			const res = await fetch("/api/sync/config/", { method: "GET" });
			const data = (await res.json().catch(() => ({}))) as
				| PublicDataSyncConfig
				| { error?: string };
			if (!res.ok) {
				throw new Error(
					"error" in data ? data.error : `读取失败 (${res.status})`,
				);
			}
			setDraft(draftFromConfig(data as PublicDataSyncConfig));
		} catch (e) {
			toast.danger((e as Error).message);
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		void loadConfig();
	}, [loadConfig]);

	const saveConfig = useCallback(
		async (silent = false) => {
			setSaving(true);
			try {
				const res = await fetch("/api/sync/config/", {
					method: "PUT",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						github: {
							repo: draft.github.repo,
							branch: draft.github.branch,
							filePath: draft.github.filePath,
							token: draft.github.token,
							commitMessage: draft.github.commitMessage,
						},
						webdav: {
							url: draft.webdav.url,
							filePath: draft.webdav.filePath,
							username: draft.webdav.username,
							password: draft.webdav.password,
						},
					}),
				});
				const data = (await res.json().catch(() => ({}))) as
					| PublicDataSyncConfig
					| { error?: string };
				if (!res.ok) {
					throw new Error(
						"error" in data ? data.error : `保存失败 (${res.status})`,
					);
				}
				setDraft(draftFromConfig(data as PublicDataSyncConfig));
				if (!silent) toast.success("同步配置已保存");
			} catch (e) {
				if (!silent) toast.danger((e as Error).message);
				throw e;
			} finally {
				setSaving(false);
			}
		},
		[draft],
	);

	const runAction = useCallback(
		async (provider: SyncProvider, action: SyncAction) => {
			const key = `${provider}:${action}`;
			setRunning(key);
			try {
				await saveConfig(true);
				const res = await fetch("/api/sync/action/", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ provider, action }),
				});
				const data = (await res.json().catch(() => ({}))) as
					| DataSyncRunResult
					| { error?: string; message?: string };
				if (!res.ok) {
					throw new Error(
						"message" in data && data.message
							? data.message
							: "error" in data && data.error
								? data.error
								: `${actionLabel(action)}失败 (${res.status})`,
					);
				}
				toast.success(`${providerLabel(provider)} ${actionLabel(action)}成功`);
				if (action === "pull") {
					setTimeout(() => window.location.reload(), 900);
				}
			} catch (e) {
				toast.danger((e as Error).message);
			} finally {
				setRunning(null);
			}
		},
		[saveConfig],
	);

	const githubReady = useMemo(
		() =>
			Boolean(
				draft.github.repo &&
				draft.github.branch &&
				draft.github.filePath &&
				draft.github.hasToken,
			),
		[
			draft.github.branch,
			draft.github.filePath,
			draft.github.hasToken,
			draft.github.repo,
		],
	);

	const webdavReady = useMemo(
		() =>
			Boolean(
				draft.webdav.url &&
				draft.webdav.username &&
				draft.webdav.filePath &&
				draft.webdav.hasPassword,
			),
		[
			draft.webdav.filePath,
			draft.webdav.hasPassword,
			draft.webdav.url,
			draft.webdav.username,
		],
	);

	if (loading) {
		return (
			<div
				className="flex flex-col items-center justify-center gap-2"
				style={{
					height: `calc(100dvh - 106px)`,
				}}
			>
				<Spinner size="sm" />
				<span className="text-xs text-default-500">正在读取同步配置...</span>
			</div>
		);
	}

	return (
		<div
			className="flex flex-col gap-4"
			style={{
				minHeight: `calc(100dvh - 106px)`,
			}}
		>
			<section className="flex flex-col gap-3">
				<div className="flex flex-col gap-1">
					<h3 className="text-sm font-semibold text-gray-900 dark:text-neutral-100">
						数据同步
					</h3>
					<p className="text-xs text-default-500">
						将 data/website.json、data/nav.json 与 data/uploads 打包为统一 zip
						备份，并推送到 GitHub 或 WebDAV。同步配置中的凭据只保存在本机
						data/sync.json，不会写入远端备份包。
					</p>
				</div>
				<div className="flex flex-wrap gap-2 text-xs">
					<Chip
						variant="secondary"
						className={
							githubReady
								? "text-success border-success/40"
								: "text-danger border-danger/40"
						}
					>
						<Chip.Label className="inline-flex items-center gap-1">
							{githubReady ? (
								<BiCheckCircle className="size-3.5" />
							) : (
								<BiXCircle className="size-3.5" />
							)}
							GitHub {githubReady ? "完整配置" : "未完整配置"}
						</Chip.Label>
					</Chip>
					<Chip
						variant="secondary"
						className={
							webdavReady
								? "text-success border-success/40"
								: "text-danger border-danger/40"
						}
					>
						<Chip.Label className="inline-flex items-center gap-1">
							{webdavReady ? (
								<BiCheckCircle className="size-3.5" />
							) : (
								<BiXCircle className="size-3.5" />
							)}
							WebDAV {webdavReady ? "完整配置" : "未完整配置"}
						</Chip.Label>
					</Chip>
				</div>
			</section>

			<div className="grid grid-cols-1 items-stretch gap-4 xl:grid-cols-2">
				<div>
					<Card variant="secondary" className="h-full gap-4">
						<Card.Header>
							<div className="flex items-center gap-2">
								<BiGitBranch className="size-5 text-blue-600 dark:text-blue-300" />
								<div>
									<Card.Title>GitHub 同步</Card.Title>
									<Card.Description>
										通过 GitHub Contents API 将备份包提交到指定仓库路径。
									</Card.Description>
								</div>
							</div>
						</Card.Header>
						<Card.Content className="grid grid-cols-1 gap-4 md:grid-cols-2">
							<Field
								label="仓库"
								description="支持 owner/repo 或完整 GitHub 仓库 URL"
							>
								<TextField
									value={draft.github.repo}
									onChange={(repo) =>
										setDraft((prev) => ({
											...prev,
											github: { ...prev.github, repo },
										}))
									}
								>
									<Label className="sr-only">GitHub 仓库</Label>
									<Input placeholder="dengxiwang/go-nav-data" />
								</TextField>
							</Field>
							<Field label="分支">
								<TextField
									value={draft.github.branch}
									onChange={(branch) =>
										setDraft((prev) => ({
											...prev,
											github: { ...prev.github, branch },
										}))
									}
								>
									<Label className="sr-only">GitHub 分支</Label>
									<Input placeholder="main" />
								</TextField>
							</Field>
							<Field
								label="备份路径"
								description="建议固定路径，推送会覆盖同一路径的旧备份"
							>
								<TextField
									value={draft.github.filePath}
									onChange={(filePath) =>
										setDraft((prev) => ({
											...prev,
											github: { ...prev.github, filePath },
										}))
									}
								>
									<Label className="sr-only">GitHub 备份路径</Label>
									<Input placeholder="backups/go-nav-data.zip" />
								</TextField>
							</Field>
							<Field label="提交信息">
								<TextField
									value={draft.github.commitMessage}
									onChange={(commitMessage) =>
										setDraft((prev) => ({
											...prev,
											github: { ...prev.github, commitMessage },
										}))
									}
								>
									<Label className="sr-only">GitHub 提交信息</Label>
									<Input placeholder="chore: backup Go Nav data" />
								</TextField>
							</Field>
							<div className="md:col-span-2">
								<Field label="GitHub Token">
									<TextField
										value={draft.github.token}
										onChange={(token) =>
											setDraft((prev) => ({
												...prev,
												github: { ...prev.github, token },
											}))
										}
									>
										<Label className="sr-only">GitHub Token</Label>
										<Input
											type="password"
											autoComplete="off"
											placeholder="Fine-grained token，需 Contents 读写权限"
										/>
									</TextField>
									<p className="text-xs text-default-500">
										<span
											className={
												draft.github.hasToken ? "text-success" : "text-warning"
											}
										>
											{draft.github.hasToken
												? "已保存 Token，留空则保持不变"
												: "尚未保存 Token，请填写后再同步"}
										</span>
									</p>
								</Field>
							</div>
						</Card.Content>
						<Card.Footer className="flex flex-wrap gap-2">
							<Button
								variant="primary"
								size="sm"
								isPending={running === "github:push"}
								isDisabled={isBusy}
								onPress={() => runAction("github", "push")}
							>
								<BiCloudUpload data-icon="inline-start" />
								推送到 GitHub
							</Button>
							<Button
								variant="outline"
								size="sm"
								isPending={running === "github:pull"}
								isDisabled={isBusy}
								onPress={() => runAction("github", "pull")}
							>
								<BiCloudDownload data-icon="inline-start" />从 GitHub 拉取
							</Button>
						</Card.Footer>
					</Card>
				</div>
				<div>
					<Card variant="secondary" className="h-full gap-4">
						<Card.Header>
							<div className="flex items-center gap-2">
								<BiSync className="size-5 text-emerald-600 dark:text-emerald-300" />
								<div>
									<Card.Title>WebDAV 同步</Card.Title>
									<Card.Description>
										适配坚果云、Nextcloud、Alist 等支持 WebDAV 的存储。
									</Card.Description>
								</div>
							</div>
						</Card.Header>
						<Card.Content className="grid grid-cols-1 gap-4 md:grid-cols-2">
							<div className="md:col-span-2">
								<Field
									label="WebDAV 地址"
									description="填写目录地址，备份路径会拼接在这个地址后面"
								>
									<TextField
										value={draft.webdav.url}
										onChange={(url) =>
											setDraft((prev) => ({
												...prev,
												webdav: { ...prev.webdav, url },
											}))
										}
									>
										<Label className="sr-only">WebDAV 地址</Label>
										<Input placeholder="https://dav.example.com/dav/go-nav/" />
									</TextField>
								</Field>
							</div>
							<Field
								label="备份路径"
								description="建议固定路径，推送会覆盖同一路径的旧备份"
							>
								<TextField
									value={draft.webdav.filePath}
									onChange={(filePath) =>
										setDraft((prev) => ({
											...prev,
											webdav: { ...prev.webdav, filePath },
										}))
									}
								>
									<Label className="sr-only">WebDAV 备份路径</Label>
									<Input placeholder="go-nav/go-nav-data.zip" />
								</TextField>
							</Field>
							<Field label="用户名">
								<TextField
									value={draft.webdav.username}
									onChange={(username) =>
										setDraft((prev) => ({
											...prev,
											webdav: { ...prev.webdav, username },
										}))
									}
								>
									<Label className="sr-only">WebDAV 用户名</Label>
									<Input autoComplete="username" placeholder="WebDAV 用户名" />
								</TextField>
							</Field>
							<div className="md:col-span-2">
								<Field label="密码 / 应用密码">
									<TextField
										value={draft.webdav.password}
										onChange={(password) =>
											setDraft((prev) => ({
												...prev,
												webdav: { ...prev.webdav, password },
											}))
										}
									>
										<Label className="sr-only">WebDAV 密码</Label>
										<Input
											type="password"
											autoComplete="current-password"
											placeholder="WebDAV 密码或应用专用密码"
										/>
									</TextField>
									<p className="text-xs text-default-500">
										<span
											className={
												draft.webdav.hasPassword
													? "text-success"
													: "text-warning"
											}
										>
											{draft.webdav.hasPassword
												? "已保存密码，留空则保持不变"
												: "尚未保存密码，请填写后再同步"}
										</span>
									</p>
								</Field>
							</div>
						</Card.Content>
						<Card.Footer className="flex flex-wrap gap-2">
							<Button
								variant="primary"
								size="sm"
								isPending={running === "webdav:push"}
								isDisabled={isBusy}
								onPress={() => runAction("webdav", "push")}
							>
								<BiCloudUpload data-icon="inline-start" />
								推送到 WebDAV
							</Button>
							<Button
								variant="outline"
								size="sm"
								isPending={running === "webdav:pull"}
								isDisabled={isBusy}
								onPress={() => runAction("webdav", "pull")}
							>
								<BiCloudDownload data-icon="inline-start" />从 WebDAV 拉取
							</Button>
						</Card.Footer>
					</Card>
				</div>
			</div>

			<div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-xs text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
				<p className="mb-1.5 font-semibold">操作提示</p>
				<ul className="list-disc list-inside space-y-1">
					<li>
						推送会把当前服务器 data 数据打包上传到远端固定路径；同一路径会被覆盖，建议使用稳定路径（如
						<code>backups/go-nav-data.zip</code> 或
						<code>go-nav/go-nav-data.zip</code>）
					</li>
					<li>
						拉取会直接覆盖本机 website.json、nav.json，并写入备份中的 uploads
						文件
					</li>
					<li>
						GitHub Token 获取路径：GitHub 右上角头像 → Settings → Developer
						settings → Personal access tokens → Fine-grained tokens。创建时请在
						Repository access 里选中目标仓库，并将 Repository permissions 的
						Contents 设为 Read and write
					</li>
					<li>
						GitHub 新建空仓库请先初始化一次（创建 README 并提交），再执行同步推送
					</li>
					<li>
						WebDAV 需要填写可访问目录地址（例如
						<code>https://dav.example.com/dav/go-nav/</code>）；如果备份路径包含子目录，系统会自动尝试创建目录
					</li>
					<li>
						WebDAV 建议优先使用应用专用密码；若推送失败，请先用 WebDAV
						客户端验证该地址、用户名、密码是否具备写入权限
					</li>
					<li>
						若提示分支不存在，请先使用仓库默认分支（常见为
						<code>main</code>），再按需切换到自定义分支
					</li>
				</ul>
			</div>
		</div>
	);
}
