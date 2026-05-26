"use client";

import {
	Button,
	Input,
	Label,
	Switch,
	TextField,
	Table,
	Modal,
} from "@heroui/react";
import { useRef, useState } from "react";
import {
	BiPlus,
	BiTrash,
	BiImage,
	BiChevronUp,
	BiChevronDown,
} from "react-icons/bi";
import type { AdConfig, NavConfig } from "@/types";
import { useAtom } from "jotai";
import { navAtom } from "@/lib/store/admin";
import { IconPicker } from "./icon-picker";

export function AdsEditor() {
	const [value, setValue] = useAtom(navAtom);
	const onChange = (v: NavConfig) => setValue(v);
	const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

	const setAds = (ads: AdConfig[]) => {
		onChange({ ...value, ads });
	};

	const moveAd = (idx: number, dir: "up" | "down") => {
		const newIdx = dir === "up" ? idx - 1 : idx + 1;
		if (newIdx < 0 || newIdx >= value.ads.length) return;
		const copy = value.ads.slice();
		const [moved] = copy.splice(idx, 1);
		copy.splice(newIdx, 0, moved);
		setAds(copy);
	};

	const ratioPresets = ["16/9", "4/3", "1/1", "2/1", "3/1"];
	const currentRatio = value.adsAspectRatio ?? "16/9";
	const isCustomRatio = !ratioPresets.includes(currentRatio);

	const addAd = () =>
		setAds([
			...value.ads,
			{
				id: `ad-${Date.now()}`,
				title: "新广告",
				description: "",
				image: "",
				url: "https://",
				enabled: true,
			},
		]);

	return (
		<div className="flex flex-col gap-4">
			{/* 首页模块设置 */}
			<section className="flex flex-col gap-4">
				<div>
					<h3 className="text-sm font-semibold">首页模块设置</h3>
					<p className="mt-1 text-xs text-default-500">
						控制首页各模块的显示与隐藏
					</p>
				</div>

				<div className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-100 pb-4 dark:border-neutral-800">
					<div className="flex flex-col gap-1">
						<span className="text-sm font-medium">广告区域</span>
						<span className="text-xs text-default-500">
							控制首页是否展示广告位
						</span>
					</div>
					<Switch
						isSelected={value.showAds ?? true}
						onChange={(v) => onChange({ ...value, showAds: v })}
					>
						<Switch.Control>
							<Switch.Thumb />
						</Switch.Control>
						<Switch.Content>
							<Label className="text-sm">
								{value.showAds !== false ? "已开启" : "已关闭"}
							</Label>
						</Switch.Content>
					</Switch>
				</div>

				<div className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-100 pb-4 dark:border-neutral-800">
					<div className="flex flex-col gap-1">
						<span className="text-sm font-medium">最近访问</span>
						<span className="text-xs text-default-500">
							显示用户最近访问过的站点快捷入口
						</span>
					</div>
					<Switch
						isSelected={value.showRecentVisits ?? true}
						onChange={(v) => onChange({ ...value, showRecentVisits: v })}
					>
						<Switch.Control>
							<Switch.Thumb />
						</Switch.Control>
						<Switch.Content>
							<Label className="text-sm">
								{value.showRecentVisits !== false ? "已开启" : "已关闭"}
							</Label>
						</Switch.Content>
					</Switch>
				</div>

				<div className="flex flex-wrap items-center gap-3">
					<span className="text-sm">最近访问最大条数</span>
					<TextField
						className="w-28"
						value={String(value.recentVisitsMax ?? 10)}
						onChange={(v) => {
							const n = Number.parseInt(v.replace(/\D/g, ""), 10);
							onChange({
								...value,
								recentVisitsMax: Number.isFinite(n) && n > 0 ? n : undefined,
							});
						}}
					>
						<Label className="sr-only">recentVisitsMax</Label>
						<Input inputMode="numeric" placeholder="10" />
					</TextField>
					<span className="text-xs text-default-500">
						留空或 0 使用默认值 10
					</span>
				</div>
			</section>

			{/* 广告宽高比配置 */}
			<section className="flex flex-col gap-3 border-t border-gray-100 pt-4 dark:border-neutral-800">
				<div>
					<h3 className="text-sm font-semibold">广告区域宽高比</h3>
					<p className="mt-1 text-xs text-default-500">
						作用于整个广告位区域，所有广告按此比例展示
					</p>
				</div>
				<div className="flex flex-wrap items-center gap-2">
					{ratioPresets.map((r) => {
						const active = currentRatio === r;
						return (
							<button
								key={r}
								type="button"
								onClick={() => onChange({ ...value, adsAspectRatio: r })}
								className={`rounded-lg border px-3 py-1.5 text-xs transition ${
									active
										? "border-blue-500 bg-blue-50 text-blue-600 dark:border-blue-400 dark:bg-blue-950/40 dark:text-blue-300"
										: "border-default hover:border-default/80"
								}`}
							>
								{r.replace("/", " : ")}
							</button>
						);
					})}
					<span className="text-xs text-default-500">或自定义：</span>
					<TextField
						className="w-32"
						value={isCustomRatio ? currentRatio : ""}
						onChange={(v) => {
							const trimmed = v.trim();
							onChange({
								...value,
								adsAspectRatio: trimmed || undefined,
							});
						}}
					>
						<Label className="sr-only">自定义宽高比</Label>
						<Input placeholder="如 21/9" />
					</TextField>
					<span className="text-xs text-default-500">
						格式为 宽/高，如 16/9
					</span>
				</div>
			</section>

			{/* 广告列表 */}
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-2">
					<h3 className="text-base font-semibold">广告列表</h3>
				</div>
				<Button variant="primary" size="sm" onPress={addAd}>
					<BiPlus data-icon="inline-start" />
					新增广告
				</Button>
			</div>

			{value.ads.length === 0 ? (
				<div className="flex h-48 items-center justify-center rounded-xl border-2 border-dashed border-gray-200 dark:border-neutral-800">
					<div className="text-center">
						<BiImage className="mx-auto mb-2 size-8" />
						<p className="text-sm text-default-500">暂无广告，点击右上角新增</p>
					</div>
				</div>
			) : (
				<Table variant="secondary" aria-label="广告列表">
					<Table.ScrollContainer>
						<Table.Content aria-label="广告列表">
							<Table.Header>
								<Table.Column className="w-24">图片</Table.Column>
								<Table.Column isRowHeader className="w-40">
									标题
								</Table.Column>
								<Table.Column className="w-40">描述</Table.Column>
								<Table.Column className="w-48">链接</Table.Column>
								<Table.Column className="w-20">启用</Table.Column>
								<Table.Column className="w-32">操作</Table.Column>
							</Table.Header>
							<Table.Body
								renderEmptyState={() => (
									<div className="py-12 text-center text-sm text-gray-400">
										暂无广告
									</div>
								)}
							>
								{value.ads.map((ad, idx) => (
									<AdRow
										key={ad.id}
										ad={ad}
										isFirst={idx === 0}
										isLast={idx === value.ads.length - 1}
										onChange={(next) => {
											const copy = [...value.ads];
											copy[idx] = next;
											setAds(copy);
										}}
										onDelete={() => setDeleteConfirm(idx)}
										onMoveUp={() => moveAd(idx, "up")}
										onMoveDown={() => moveAd(idx, "down")}
									/>
								))}
							</Table.Body>
						</Table.Content>
					</Table.ScrollContainer>
				</Table>
			)}

			{/* 删除确认对话框 */}
			<Modal>
				<Modal.Backdrop
					isOpen={deleteConfirm !== null}
					onOpenChange={(open) => !open && setDeleteConfirm(null)}
				>
					<Modal.Container>
						<Modal.Dialog>
							<Modal.Header>
								<Modal.Heading>确认删除广告</Modal.Heading>
							</Modal.Header>
							<Modal.Body>
								<p className="text-sm text-gray-600 dark:text-neutral-300">
									删除后该广告数据将被永久删除，此操作不可撤销。
								</p>
							</Modal.Body>
							<Modal.Footer>
								<Button
									variant="outline"
									onPress={() => setDeleteConfirm(null)}
								>
									取消
								</Button>
								<Button
									variant="danger"
									onPress={() => {
										if (deleteConfirm !== null) {
											setAds(value.ads.filter((_, i) => i !== deleteConfirm));
											setDeleteConfirm(null);
										}
									}}
								>
									确认删除
								</Button>
							</Modal.Footer>
						</Modal.Dialog>
					</Modal.Container>
				</Modal.Backdrop>
			</Modal>
		</div>
	);
}

function AdRow({
	ad,
	isFirst,
	isLast,
	onChange,
	onDelete,
	onMoveUp,
	onMoveDown,
}: {
	ad: AdConfig;
	isFirst: boolean;
	isLast: boolean;
	onChange: (a: AdConfig) => void;
	onDelete: () => void;
	onMoveUp: () => void;
	onMoveDown: () => void;
}) {
	const titleRef = useRef<HTMLInputElement>(null);
	const descriptionRef = useRef<HTMLInputElement>(null);
	const urlRef = useRef<HTMLInputElement>(null);
	const patch = (p: Partial<AdConfig>) =>
		onChange({
			...ad,
			title: titleRef.current?.value ?? ad.title,
			description: descriptionRef.current?.value ?? ad.description ?? "",
			url: urlRef.current?.value ?? ad.url,
			...p,
		});

	const commitText = (field: "title" | "description" | "url", next: string) => {
		if (field === "description") {
			if ((ad.description ?? "") !== next) patch({ description: next });
			return;
		}
		if (ad[field] !== next)
			patch({ [field]: next } as Pick<AdConfig, typeof field>);
	};

	return (
		<Table.Row key={ad.id} id={ad.id}>
			<Table.Cell>
				<div className="flex items-center gap-2 w-max">
					<IconPicker
						value={ad.image ?? ""}
						onChange={(v) => patch({ image: v })}
					/>
				</div>
			</Table.Cell>
			<Table.Cell>
				<Input
					ref={titleRef}
					aria-label="title"
					defaultValue={ad.title}
					onBlur={(e) => commitText("title", e.currentTarget.value)}
				/>
			</Table.Cell>
			<Table.Cell>
				<Input
					ref={descriptionRef}
					aria-label="description"
					defaultValue={ad.description ?? ""}
					placeholder="可选"
					className="w-full min-w-52"
					onBlur={(e) => commitText("description", e.currentTarget.value)}
				/>
			</Table.Cell>
			<Table.Cell>
				<Input
					ref={urlRef}
					aria-label="url"
					defaultValue={ad.url}
					placeholder="https://"
					className="w-full min-w-52"
					onBlur={(e) => commitText("url", e.currentTarget.value)}
				/>
			</Table.Cell>
			<Table.Cell>
				<Switch
					isSelected={ad.enabled}
					onChange={(v) => patch({ enabled: v })}
					aria-label="启用"
				>
					<Switch.Control>
						<Switch.Thumb />
					</Switch.Control>
				</Switch>
			</Table.Cell>
			<Table.Cell>
				<div className="flex items-center gap-1">
					<Button
						isIconOnly
						size="sm"
						variant="outline"
						aria-label="上移"
						isDisabled={isFirst}
						onPress={onMoveUp}
					>
						<BiChevronUp />
					</Button>
					<Button
						isIconOnly
						size="sm"
						variant="outline"
						aria-label="下移"
						isDisabled={isLast}
						onPress={onMoveDown}
					>
						<BiChevronDown />
					</Button>
					<Button
						isIconOnly
						size="sm"
						variant="outline"
						className="text-danger"
						aria-label="删除"
						onPress={onDelete}
					>
						<BiTrash />
					</Button>
				</div>
			</Table.Cell>
		</Table.Row>
	);
}
