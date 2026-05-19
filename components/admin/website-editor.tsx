"use client";

import {
	Button,
	Input,
	Label,
	Separator,
	Switch,
	TextField,
} from "@heroui/react";
import { BiSun, BiMoon, BiDesktop } from "react-icons/bi";
import type { CardStyle, LayoutConfig, ThemeMode, NavConfig } from "@/types";
import { useAtom } from "jotai";
import { navAtom } from "@/lib/store/admin";
import { DEFAULT_LAYOUT } from "@/lib/store/site";
import { IconPicker } from "./icon-picker";

export type WebsiteSection = "basic" | "layout" | "theme" | "footer";

export function WebsiteEditor({
	section = "basic",
}: {
	section?: WebsiteSection;
}) {
	const [value, setValue] = useAtom(navAtom);
	const patch = (p: Partial<NavConfig>) => {
		setValue({ ...value, ...p });
	};

	if (section === "layout") {
		return (
			<LayoutEditor
				layout={value.layout}
				onChange={(l) => patch({ layout: l })}
			/>
		);
	}

	if (section === "theme") {
		return <ThemeEditor value={value} onPatch={patch} />;
	}

	if (section === "footer") {
		return <FooterEditor value={value} onPatch={patch} />;
	}

	return <BasicEditor value={value} onPatch={patch} />;
}

function BasicEditor({
	value,
	onPatch,
}: {
	value: NavConfig;
	onPatch: (p: Partial<NavConfig>) => void;
}) {
	return (
		<div className="grid grid-cols-1 gap-6 md:grid-cols-2">
			<div className="flex flex-col gap-2">
				<Label className="text-sm font-medium">站点标题</Label>
				<TextField value={value.title} onChange={(v) => onPatch({ title: v })}>
					<Label className="sr-only">title</Label>
					<Input placeholder="浏览器标签标题" />
				</TextField>
			</div>

			<div className="flex flex-col gap-2">
				<Label className="text-sm font-medium">站点名称</Label>
				<TextField value={value.name} onChange={(v) => onPatch({ name: v })}>
					<Label className="sr-only">name</Label>
					<Input placeholder="左上角显示名" />
				</TextField>
			</div>

			<div className="flex flex-col gap-2 md:col-span-2">
				<Label className="text-sm font-medium">站点描述</Label>
				<TextField
					value={value.description}
					onChange={(v) => onPatch({ description: v })}
				>
					<Label className="sr-only">description</Label>
					<Input placeholder="网站描述，用于 SEO" />
				</TextField>
			</div>

			<div className="flex flex-col gap-2 md:col-span-2">
				<Label className="text-sm font-medium">关键词</Label>
				<TextField
					value={value.keywords?.join(", ") ?? ""}
					onChange={(v) =>
						onPatch({
							keywords: v
								.split(",")
								.map((s) => s.trim())
								.filter(Boolean),
						})
					}
				>
					<Label className="sr-only">keywords</Label>
					<Input placeholder="导航, nav, 书签" />
				</TextField>
				<p className="text-xs text-gray-400 dark:text-neutral-500">
					多个关键词用逗号分隔
				</p>
			</div>

			<div className="flex flex-col gap-2">
				<Label className="text-sm font-medium">Logo</Label>
				<IconPicker value={value.logo} onChange={(v) => onPatch({ logo: v })} />
			</div>

			<div className="flex flex-col gap-2">
				<Label className="text-sm font-medium">Favicon</Label>
				<IconPicker
					value={value.favicon}
					onChange={(v) => onPatch({ favicon: v })}
				/>
			</div>

			<div className="flex flex-col gap-2">
				<Label className="text-sm font-medium">作者</Label>
				<TextField
					value={value.author}
					onChange={(v) => onPatch({ author: v })}
				>
					<Label className="sr-only">author</Label>
					<Input />
				</TextField>
			</div>

			<div className="flex flex-col gap-2">
				<Label className="text-sm font-medium">版权</Label>
				<TextField
					value={value.copyright}
					onChange={(v) => onPatch({ copyright: v })}
				>
					<Label className="sr-only">copyright</Label>
					<Input />
				</TextField>
			</div>
		</div>
	);
}

function ThemeEditor({
	value,
	onPatch,
}: {
	value: NavConfig;
	onPatch: (p: Partial<NavConfig>) => void;
}) {
	const patchCardStyle = (cardStyle: CardStyle) => {
		onPatch({ layout: { ...(value.layout ?? {}), cardStyle } });
	};

	return (
		<div className="flex flex-col gap-4">
			<div>
				<h3 className="text-sm font-semibold text-gray-900 dark:text-neutral-100">
					主题模式
				</h3>
				<p className="mt-1 text-xs text-gray-500 dark:text-neutral-400">
					决定站点的默认配色方案。"跟随系统"会根据访客操作系统偏好自动切换。
				</p>
			</div>
			<div className="grid grid-cols-3 gap-4">
				{(
					[
						{
							key: "light" as ThemeMode,
							icon: BiSun,
							label: "浅色",
							desc: "明亮清新",
						},
						{
							key: "dark" as ThemeMode,
							icon: BiMoon,
							label: "深色",
							desc: "护眼沉浸",
						},
						{
							key: "system" as ThemeMode,
							icon: BiDesktop,
							label: "跟随系统",
							desc: "自动切换",
						},
					] as const
				).map((mode) => {
					const active = (value.themeMode ?? "light") === mode.key;
					const Icon = mode.icon;
					return (
						<button
							key={mode.key}
							type="button"
							onClick={() => onPatch({ themeMode: mode.key })}
							className={`flex cursor-pointer flex-col items-center gap-2 rounded-xl border p-6 transition-all ${
								active
									? "border-blue-500 bg-blue-50 text-blue-600 dark:border-blue-400 dark:bg-blue-950/40 dark:text-blue-300"
									: "border-gray-200 hover:border-gray-300 hover:bg-gray-50 dark:border-neutral-800 dark:hover:border-neutral-700 dark:hover:bg-neutral-900"
							}`}
						>
							<Icon className="w-6! h-6!" />
							<span className="text-base! font-medium">{mode.label}</span>
							<span className="text-xs font-medium opacity-60">
								{mode.desc}
							</span>
						</button>
					);
				})}
			</div>

			<Separator />

			<div>
				<h3 className="text-sm font-semibold text-gray-900 dark:text-neutral-100">
					卡片样式
				</h3>
				<p className="mt-1 text-xs text-gray-500 dark:text-neutral-400">
					常规样式保留当前紧凑卡片；预览图样式会展示网址的预览图，适合更视觉化的首页。
				</p>
			</div>
			<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
				{(
					[
						{
							key: "compact" as CardStyle,
							label: "常规卡片",
							desc: "紧凑、信息密度高",
						},
						{
							key: "preview" as CardStyle,
							label: "预览图卡片",
							desc: "类似 Vercel 模板卡片",
						},
					] as const
				).map((item) => {
					const active = (value.layout?.cardStyle ?? "compact") === item.key;
					return (
						<button
							key={item.key}
							type="button"
							onClick={() => patchCardStyle(item.key)}
							className={`cursor-pointer rounded-2xl border p-4 text-left transition-all ${
								active
									? "border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-400 dark:bg-blue-950/40 dark:text-blue-200"
									: "border-gray-200 hover:border-gray-300 hover:bg-gray-50 dark:border-neutral-800 dark:hover:border-neutral-700 dark:hover:bg-neutral-900"
							}`}
						>
							<div className="mb-4 flex h-28 items-center justify-center rounded-xl bg-white/80 p-3 shadow-inner dark:bg-neutral-950/60">
								{item.key === "compact" ? (
									<div className="flex w-full max-w-64 items-center gap-3 rounded-xl bg-white p-3 shadow-sm dark:bg-zinc-800">
										<div className="size-10 rounded-full bg-blue-100 dark:bg-blue-950" />
										<div className="min-w-0 flex-1">
											<div className="h-3 w-24 rounded bg-zinc-900/80 dark:bg-zinc-100/80" />
											<div className="mt-2 h-2 w-36 rounded bg-zinc-300 dark:bg-zinc-600" />
										</div>
									</div>
								) : (
									<div className="relative h-full w-full max-w-64 overflow-hidden rounded-xl border border-black/10 bg-white dark:border-white/10 dark:bg-zinc-900">
										<div className="p-4">
											<div className="h-3 w-28 rounded bg-zinc-900/80 dark:bg-zinc-100/80" />
											<div className="mt-2 h-2 w-40 rounded bg-zinc-300 dark:bg-zinc-600" />
										</div>
										<div className="absolute -bottom-4.5 left-8 h-16 w-48 -rotate-6 rounded-lg border bg-linear-to-br from-zinc-100 to-zinc-300 shadow-lg dark:border-white/10 dark:from-zinc-800 dark:to-zinc-950" />
									</div>
								)}
							</div>
							<div className="text-sm font-semibold">{item.label}</div>
							<div className="mt-1 text-xs opacity-65">{item.desc}</div>
						</button>
					);
				})}
			</div>
		</div>
	);
}

function FooterEditor({
	value,
	onPatch,
}: {
	value: NavConfig;
	onPatch: (p: Partial<NavConfig>) => void;
}) {
	return (
		<div className="flex flex-col gap-4">
			<div className="flex flex-col gap-2">
				<Label className="text-sm font-medium">ICP 备案号</Label>
				<TextField value={value.icp} onChange={(v) => onPatch({ icp: v })}>
					<Label className="sr-only">icp</Label>
					<Input placeholder="京ICP备xxxxxxxx号-1 / 留空" />
				</TextField>
			</div>

			<div className="flex flex-col gap-2">
				<Label className="text-sm font-medium">公安备案号</Label>
				<TextField value={value.beian} onChange={(v) => onPatch({ beian: v })}>
					<Label className="sr-only">beian</Label>
					<Input placeholder="留空则不显示" />
				</TextField>
			</div>

			<div className="flex flex-col gap-2">
				<Label className="text-sm font-medium">底部声明</Label>
				<TextField
					value={value.copyright}
					onChange={(v) => onPatch({ copyright: v })}
				>
					<Label className="sr-only">copyright</Label>
					<Input />
				</TextField>
			</div>

			<div className="flex flex-col gap-2">
				<Label className="text-sm font-medium">公众号二维码</Label>
				<IconPicker
					value={value.qrCode}
					onChange={(v) => onPatch({ qrCode: v })}
				/>
			</div>

			<div className="flex flex-col gap-2">
				<Label className="text-sm font-medium">二维码提示文字</Label>
				<TextField
					value={value.qrCodeText}
					onChange={(v) => onPatch({ qrCodeText: v })}
				>
					<Label className="sr-only">qrCodeText</Label>
					<Input placeholder="微信扫码关注" />
				</TextField>
			</div>

			<Separator />

			<div className="flex items-center justify-between">
				<span className="text-sm font-medium">底部链接</span>
				<Button
					size="sm"
					variant="outline"
					onPress={() =>
						onPatch({
							footerLinks: [
								...(value.footerLinks ?? []),
								{ label: "新链接", href: "#" },
							],
						})
					}
				>
					+ 添加链接
				</Button>
			</div>

			{(value.footerLinks ?? []).map((link, idx) => (
				<div
					key={`${idx}-${link.label}`}
					className="flex flex-wrap items-center gap-3"
				>
					<TextField
						value={link.label}
						className="flex-1 min-w-40"
						onChange={(v) => {
							const next = [...(value.footerLinks ?? [])];
							next[idx] = { ...next[idx], label: v };
							onPatch({ footerLinks: next });
						}}
					>
						<Label className="sr-only">label</Label>
						<Input placeholder="显示文案" variant="secondary" />
					</TextField>
					<TextField
						value={link.href}
						className="flex-2 min-w-50"
						onChange={(v) => {
							const next = [...(value.footerLinks ?? [])];
							next[idx] = { ...next[idx], href: v };
							onPatch({ footerLinks: next });
						}}
					>
						<Label className="sr-only">href</Label>
						<Input placeholder="跳转链接" variant="secondary" />
					</TextField>
					<Button
						size="sm"
						variant="tertiary"
						className="text-red-600 dark:text-red-400"
						onPress={() => {
							const next = (value.footerLinks ?? []).filter(
								(_, i) => i !== idx,
							);
							onPatch({ footerLinks: next });
						}}
					>
						删除
					</Button>
				</div>
			))}
		</div>
	);
}

function LayoutEditor({
	layout,
	onChange,
}: {
	layout?: LayoutConfig;
	onChange: (v: LayoutConfig) => void;
}) {
	const l = layout ?? {};
	const patch = (p: Partial<LayoutConfig>) => onChange({ ...l, ...p });
	const getLayoutValue = (key: keyof LayoutConfig) =>
		l[key] ?? DEFAULT_LAYOUT[key];
	const getToggleValue = (key: keyof LayoutConfig) => {
		if (key === "showFooterQrCode" && !getLayoutValue("showFooter")) {
			return false;
		}
		if (
			key === "showFloatingQrCode" &&
			!getLayoutValue("showFloatingActions")
		) {
			return false;
		}
		if (
			key === "showCategoryDescription" &&
			!getLayoutValue("showCategoryTitle")
		) {
			return false;
		}
		if (key === "linkTarget") {
			return getLayoutValue(key) === "new";
		}

		return Boolean(getLayoutValue(key));
	};
	const patchToggle = (key: keyof LayoutConfig, value: boolean) => {
		const next: Partial<LayoutConfig> = { [key]: value };

		if (key === "showFooter" && !value) {
			next.showFooterQrCode = false;
		}
		if (key === "showFloatingActions" && !value) {
			next.showFloatingQrCode = false;
		}
		if (key === "showCategoryTitle" && !value) {
			next.showCategoryDescription = false;
		}
		if (key === "linkTarget") {
			next.linkTarget = value ? "new" : "current";
		}

		patch(next);
	};

	const toggleItems: {
		label: string;
		key: keyof LayoutConfig;
		disabled?: boolean;
	}[] = [
		{ label: "显示左侧侧边栏（桌面端）", key: "showSidebar" },
		{ label: "显示搜索栏", key: "showSearch" },
		{ label: "显示分类标题", key: "showCategoryTitle" },
		{
			label: "显示分类描述",
			key: "showCategoryDescription",
			disabled: !getLayoutValue("showCategoryTitle"),
		},
		{ label: "显示页脚", key: "showFooter" },
		{ label: "显示浮动操作按钮", key: "showFloatingActions" },
		{
			label: "浮动按钮显示二维码入口",
			key: "showFloatingQrCode",
			disabled: !getLayoutValue("showFloatingActions"),
		},
		{
			label: "页脚显示二维码",
			key: "showFooterQrCode",
			disabled: !getLayoutValue("showFooter"),
		},
		{
			label: "新标签页打开链接",
			key: "linkTarget",
		},
		{
			label: "自动访问内网（可达时优先）",
			key: "autoUseIntranet",
		},
		{
			label: "点击卡片先进入网址详情页",
			key: "enableSiteDetailPage",
		},
	];

	return (
		<div className="flex flex-col gap-4">
			<div>
				<h3 className="text-sm font-semibold text-gray-900 dark:text-neutral-100">
					布局与显示控制
				</h3>
				<p className="mt-1 text-xs text-gray-500 dark:text-neutral-400">
					自定义站点的布局样式和显示效果
				</p>
			</div>

			<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
				<div className="flex flex-col gap-2">
					<Label className="text-sm font-medium">内容区最大宽度</Label>
					<TextField
						value={l.maxWidth ?? ""}
						onChange={(v) => patch({ maxWidth: v || undefined })}
					>
						<Label className="sr-only">maxWidth</Label>
						<Input placeholder="1200px / 1400px / 100%" />
					</TextField>
				</div>

				<div className="flex flex-col gap-2">
					<Label className="text-sm font-medium">侧边栏宽度</Label>
					<TextField
						value={l.sidebarWidth ?? ""}
						onChange={(v) => patch({ sidebarWidth: v || undefined })}
					>
						<Label className="sr-only">sidebarWidth</Label>
						<Input placeholder="224px / 200px" />
					</TextField>
				</div>

				<div className="flex flex-col gap-2">
					<Label className="text-sm font-medium">内容区左侧内边距</Label>
					<TextField
						value={l.contentPaddingLeft ?? ""}
						onChange={(v) => patch({ contentPaddingLeft: v || undefined })}
					>
						<Label className="sr-only">contentPaddingLeft</Label>
						<Input placeholder="8px / 16px（有侧边栏时较小）" />
					</TextField>
				</div>

				<div className="flex flex-col gap-2">
					<Label className="text-sm font-medium">内容区右侧内边距</Label>
					<TextField
						value={l.contentPaddingRight ?? ""}
						onChange={(v) => patch({ contentPaddingRight: v || undefined })}
					>
						<Label className="sr-only">contentPaddingRight</Label>
						<Input placeholder="16px / 24px" />
					</TextField>
				</div>

				<div className="flex flex-col gap-2">
					<Label className="text-sm font-medium">网站卡片最小宽度</Label>
					<TextField
						value={l.cardMinWidth ?? ""}
						onChange={(v) => patch({ cardMinWidth: v || undefined })}
					>
						<Label className="sr-only">cardMinWidth</Label>
						<Input placeholder="160px / 200px" />
					</TextField>
				</div>

				<div className="flex flex-col gap-2">
					<Label className="text-sm font-medium">网站卡片高度</Label>
					<TextField
						value={l.cardHeight ?? ""}
						onChange={(v) => patch({ cardHeight: v || undefined })}
					>
						<Label className="sr-only">cardHeight</Label>
						<Input placeholder="64px / 72px" />
					</TextField>
				</div>

				<div className="flex flex-col gap-2">
					<Label className="text-sm font-medium">分类间距</Label>
					<TextField
						value={l.sectionGap ?? ""}
						onChange={(v) => patch({ sectionGap: v || undefined })}
					>
						<Label className="sr-only">sectionGap</Label>
						<Input placeholder="16px / 24px" />
					</TextField>
				</div>

				<div className="flex flex-col gap-2">
					<Label className="text-sm font-medium">卡片网格内边距</Label>
					<TextField
						value={l.cardGridPadding ?? ""}
						onChange={(v) => patch({ cardGridPadding: v || undefined })}
					>
						<Label className="sr-only">cardGridPadding</Label>
						<Input placeholder="8px / 12px" />
					</TextField>
				</div>

				<div className="flex flex-col gap-2">
					<Label className="text-sm font-medium">图标圆角</Label>
					<TextField
						value={l.iconBorderRadius ?? ""}
						onChange={(v) => patch({ iconBorderRadius: v || undefined })}
					>
						<Label className="sr-only">iconBorderRadius</Label>
						<Input placeholder="full / 12px / 8px" />
					</TextField>
				</div>

				<div className="flex flex-col gap-2">
					<Label className="text-sm font-medium">图标默认内间距</Label>
					<TextField
						value={l.defaultIconPadding ?? ""}
						onChange={(v) => patch({ defaultIconPadding: v || undefined })}
					>
						<Label className="sr-only">defaultIconPadding</Label>
						<Input placeholder="8 / 8px / 留空" />
					</TextField>
				</div>
			</div>

			<Separator />

			<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
				{toggleItems.map((item) => {
					const cur = getToggleValue(item.key);
					return (
						<Switch
							key={item.key}
							isSelected={cur}
							isDisabled={item.disabled}
							onChange={(v) => patchToggle(item.key, v)}
						>
							<Switch.Control>
								<Switch.Thumb />
							</Switch.Control>
							<Switch.Content>
								<Label className="text-sm">{item.label}</Label>
							</Switch.Content>
						</Switch>
					);
				})}
			</div>
		</div>
	);
}
