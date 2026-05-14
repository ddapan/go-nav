"use client";

import {
    Button,
    Chip,
    Drawer,
    Input,
    Label,
    ListBox,
    Modal,
    Select,
    Switch,
    Table,
    TextField,
} from "@heroui/react";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { useMemo, useState } from "react";
import {
    BiChevronDown,
    BiChevronUp,
    BiCode,
    BiCodeAlt,
    BiPencil,
    BiPlus,
    BiTrash,
} from "react-icons/bi";
import {
    pluginAtomFamily,
    pluginsAtom,
} from "@/lib/store/admin";
import type { PluginConfig } from "@/types";

type EditingState =
	| { mode: "create"; draft: PluginConfig }
	| { mode: "edit"; id: string; draft: PluginConfig }
	| null;

function makeEmptyPlugin(): PluginConfig {
	return {
		id: `plugin-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
		name: "新插件",
		type: "css",
		code: "",
		enabled: true,
		description: "",
		loading: "sync",
	};
}

export function PluginsEditor() {
	const [plugins, setPlugins] = useAtom(pluginsAtom);
	const [editing, setEditing] = useState<EditingState>(null);
	const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

	const counts = useMemo(() => {
		let css = 0;
		let js = 0;
		let enabled = 0;
		for (const p of plugins) {
			if (p.type === "css") css++;
			else js++;
			if (p.enabled) enabled++;
		}
		return { css, js, enabled, total: plugins.length };
	}, [plugins]);

	const addPlugin = () => {
		setEditing({ mode: "create", draft: makeEmptyPlugin() });
	};

	const movePlugin = (idx: number, dir: "up" | "down") => {
		const newIdx = dir === "up" ? idx - 1 : idx + 1;
		if (newIdx < 0 || newIdx >= plugins.length) return;
		const copy = plugins.slice();
		const [moved] = copy.splice(idx, 1);
		copy.splice(newIdx, 0, moved);
		setPlugins(copy);
	};

	const deletePlugin = (id: string) => {
		setPlugins(plugins.filter((p) => p.id !== id));
		setDeleteConfirm(null);
	};

	const commitEditing = () => {
		if (!editing) return;
		const draft = editing.draft;
		if (!draft.name.trim()) return;
		if (editing.mode === "create") {
			setPlugins([...plugins, draft]);
		} else {
			const idx = plugins.findIndex((p) => p.id === editing.id);
			if (idx >= 0) {
				const copy = plugins.slice();
				copy[idx] = draft;
				setPlugins(copy);
			}
		}
		setEditing(null);
	};

	return (
		<div className="flex flex-col gap-4">
			{/* 说明 */}
			<section className="flex flex-col gap-2">
				<div>
					<h3 className="text-sm font-semibold">插件管理</h3>
					<p className="mt-1 text-xs text-default-500">
						注入自定义 CSS / JS 到前台页面，仅前台页面生效，管理后台不受影响。
					</p>
				</div>
				<div className="flex flex-wrap gap-2 text-xs text-default-500">
					<Chip variant="secondary">
						<Chip.Label>共 {counts.total} 个</Chip.Label>
					</Chip>
					<Chip variant="secondary">
						<Chip.Label>启用 {counts.enabled}</Chip.Label>
					</Chip>
					<Chip variant="secondary">
						<Chip.Label>CSS {counts.css}</Chip.Label>
					</Chip>
					<Chip variant="secondary">
						<Chip.Label>JS {counts.js}</Chip.Label>
					</Chip>
				</div>
			</section>

			{/* 列表头部 */}
			<div className="flex items-center justify-between">
				<h3 className="text-base font-semibold">插件列表</h3>
				<Button variant="primary" size="sm" onPress={addPlugin}>
					<BiPlus data-icon="inline-start" />
					新增插件
				</Button>
			</div>

			{plugins.length === 0 ? (
				<div className="flex h-48 items-center justify-center rounded-xl border-2 border-dashed border-gray-200 dark:border-neutral-800">
					<div className="text-center">
						<BiCode className="mx-auto mb-2 size-8" />
						<p className="text-sm text-default-500">
							暂无插件，点击右上角新增
						</p>
					</div>
				</div>
			) : (
				<Table variant="secondary" aria-label="插件列表">
					<Table.ScrollContainer>
						<Table.Content aria-label="插件列表">
							<Table.Header>
								<Table.Column className="w-20">启用</Table.Column>
								<Table.Column isRowHeader className="w-48">
									名称
								</Table.Column>
								<Table.Column className="w-24">类型</Table.Column>
								<Table.Column>描述</Table.Column>
								<Table.Column className="w-24">代码</Table.Column>
								<Table.Column className="w-40">操作</Table.Column>
							</Table.Header>
							<Table.Body
								renderEmptyState={() => (
									<div className="py-12 text-center text-sm text-gray-400">
										暂无插件
									</div>
								)}
							>
								{plugins.map((p, idx) => (
									<PluginRow
										key={p.id}
										pluginId={p.id}
										isFirst={idx === 0}
										isLast={idx === plugins.length - 1}
										onEdit={() =>
											setEditing({
												mode: "edit",
												id: p.id,
												draft: { ...p },
											})
										}
										onDelete={() => setDeleteConfirm(p.id)}
										onMoveUp={() => movePlugin(idx, "up")}
										onMoveDown={() => movePlugin(idx, "down")}
									/>
								))}
							</Table.Body>
						</Table.Content>
					</Table.ScrollContainer>
				</Table>
			)}

			{/* 编辑 / 新增 Drawer */}
			<Drawer>
				<Drawer.Backdrop
					isOpen={editing !== null}
					onOpenChange={(open) => !open && setEditing(null)}
				>
					<Drawer.Content placement="right">
						<Drawer.Dialog className="w-dvw max-w-xl bg-white dark:bg-neutral-900">
							<Drawer.CloseTrigger />
							<Drawer.Header>
								<Drawer.Heading>
									{editing?.mode === "edit" ? "编辑插件" : "新增插件"}
								</Drawer.Heading>
							</Drawer.Header>
							<Drawer.Body>
								{editing && (
									<PluginForm
										value={editing.draft}
										onChange={(d) =>
											setEditing(
												editing.mode === "edit"
													? { ...editing, draft: d }
													: { mode: "create", draft: d },
											)
										}
									/>
								)}
							</Drawer.Body>
							<Drawer.Footer>
								<Button variant="outline" onPress={() => setEditing(null)}>
									取消
								</Button>
								<Button variant="primary" onPress={commitEditing}>
									{editing?.mode === "edit" ? "保存修改" : "添加"}
								</Button>
							</Drawer.Footer>
						</Drawer.Dialog>
					</Drawer.Content>
				</Drawer.Backdrop>
			</Drawer>

			{/* 删除确认 */}
			<Modal>
				<Modal.Backdrop
					isOpen={deleteConfirm !== null}
					onOpenChange={(open) => !open && setDeleteConfirm(null)}
				>
					<Modal.Container>
						<Modal.Dialog>
							<Modal.Header>
								<Modal.Heading>确认删除插件</Modal.Heading>
							</Modal.Header>
							<Modal.Body>
								<p className="text-sm text-gray-600 dark:text-neutral-300">
									删除后该插件代码将被永久移除，此操作不可撤销。
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
										if (deleteConfirm) deletePlugin(deleteConfirm);
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

function PluginRow({
	pluginId,
	isFirst,
	isLast,
	onEdit,
	onDelete,
	onMoveUp,
	onMoveDown,
}: {
	pluginId: string;
	isFirst: boolean;
	isLast: boolean;
	onEdit: () => void;
	onDelete: () => void;
	onMoveUp: () => void;
	onMoveDown: () => void;
}) {
	const plugin = useAtomValue(pluginAtomFamily(pluginId));
	const patchPlugin = useSetAtom(pluginAtomFamily(pluginId));
	if (!plugin) return null;

	const codeLen = plugin.code?.length ?? 0;

	return (
		<Table.Row key={plugin.id} id={plugin.id}>
			<Table.Cell>
				<Switch
					isSelected={plugin.enabled}
					onChange={(v) => patchPlugin({ enabled: v })}
					aria-label="启用"
				>
					<Switch.Control>
						<Switch.Thumb />
					</Switch.Control>
				</Switch>
			</Table.Cell>
			<Table.Cell>
				<div className="flex items-center gap-2">
					{plugin.type === "css" ? (
						<BiCode className="size-4 text-blue-500 shrink-0" />
					) : (
						<BiCodeAlt className="size-4 text-orange-500 shrink-0" />
					)}
					<span className="truncate text-sm font-medium">{plugin.name}</span>
				</div>
			</Table.Cell>
			<Table.Cell>
				<Chip
					variant={plugin.type === "css" ? "primary" : "tertiary"}
					size="sm"
				>
					<Chip.Label>
						{plugin.type === "css" ? "CSS" : "JS"}
					</Chip.Label>
				</Chip>
			</Table.Cell>
			<Table.Cell>
				<span className="block truncate text-xs text-default-500">
					{plugin.description || "—"}
				</span>
			</Table.Cell>
			<Table.Cell>
				<span className="text-xs text-default-500">
					{codeLen > 0 ? `${codeLen} 字符` : "空"}
				</span>
			</Table.Cell>
			<Table.Cell>
				<div className="flex items-center gap-1">
					<Button
						isIconOnly
						size="sm"
						variant="outline"
						aria-label="编辑"
						onPress={onEdit}
					>
						<BiPencil />
					</Button>
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

function PluginForm({
	value,
	onChange,
}: {
	value: PluginConfig;
	onChange: (v: PluginConfig) => void;
}) {
	const patch = (p: Partial<PluginConfig>) => onChange({ ...value, ...p });
	const isJs = value.type === "js";

	return (
		<div className="flex flex-col gap-4">
			<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
				<div className="flex flex-col gap-2">
					<Label className="text-sm font-medium">插件名称</Label>
					<TextField
						value={value.name}
						onChange={(v) => patch({ name: v })}
					>
						<Label className="sr-only">name</Label>
						<Input placeholder="例如：全局字体放大" />
					</TextField>
				</div>
				<div className="flex flex-col gap-2">
					<Label className="text-sm font-medium">类型</Label>
					<Select
						selectedKey={value.type}
						onSelectionChange={(key) => {
							if (!key) return;
							patch({ type: String(key) as PluginConfig["type"] });
						}}
					>
						<Label className="sr-only">type</Label>
						<Select.Trigger>
							<Select.Value />
							<Select.Indicator />
						</Select.Trigger>
						<Select.Popover>
							<ListBox>
								<ListBox.Item id="css">
									自定义 CSS
									<ListBox.ItemIndicator />
								</ListBox.Item>
								<ListBox.Item id="js">
									自定义 JS
									<ListBox.ItemIndicator />
								</ListBox.Item>
							</ListBox>
						</Select.Popover>
					</Select>
				</div>
			</div>

			<div className="flex flex-col gap-2">
				<Label className="text-sm font-medium">描述（可选）</Label>
				<TextField
					value={value.description ?? ""}
					onChange={(v) => patch({ description: v })}
				>
					<Label className="sr-only">description</Label>
					<Input placeholder="方便后台识别用途" />
				</TextField>
			</div>

			{isJs && (
				<div className="flex flex-col gap-2">
					<Label className="text-sm font-medium">加载模式</Label>
					<Select
						selectedKey={value.loading ?? "sync"}
						onSelectionChange={(key) => {
							if (!key) return;
							patch({ loading: String(key) as PluginConfig["loading"] });
						}}
					>
						<Label className="sr-only">loading</Label>
						<Select.Trigger>
							<Select.Value />
							<Select.Indicator />
						</Select.Trigger>
						<Select.Popover>
							<ListBox>
								<ListBox.Item id="sync">
									同步（默认，body 末尾执行）
									<ListBox.ItemIndicator />
								</ListBox.Item>
								<ListBox.Item id="defer">
									defer（DOM 解析后执行）
									<ListBox.ItemIndicator />
								</ListBox.Item>
								<ListBox.Item id="async">
									async（异步执行）
									<ListBox.ItemIndicator />
								</ListBox.Item>
							</ListBox>
						</Select.Popover>
					</Select>
				</div>
			)}

			<div className="flex flex-col gap-2">
				<div className="flex items-center justify-between">
					<Label className="text-sm font-medium">
						代码内容 {isJs ? "(JavaScript)" : "(CSS)"}
					</Label>
					<span className="text-xs text-default-500">
						{value.code?.length ?? 0} 字符
					</span>
				</div>
				<textarea
					value={value.code}
					onChange={(e) => patch({ code: e.target.value })}
					placeholder={
						isJs
							? "// 在这里编写自定义 JavaScript 代码\nconsole.log('hello from plugin');"
							: "/* 在这里编写自定义 CSS */\nbody { /* ... */ }"
					}
					spellCheck={false}
					rows={14}
					className="w-full rounded-lg border border-gray-200 bg-gray-50 p-3 font-mono text-xs leading-relaxed text-gray-900 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
				/>
				<p className="text-xs text-default-500">
					{isJs
						? "JS 代码将以 <script> 标签注入到 <body> 末尾。请注意安全，避免引入来源不明的代码。"
						: "CSS 代码将以 <style> 标签注入到 <head>。可用于覆盖主题样式。"}
				</p>
			</div>

			<div className="flex items-center justify-between border-t border-gray-100 pt-3 dark:border-neutral-800">
				<Label className="text-sm font-medium">启用此插件</Label>
				<Switch
					isSelected={value.enabled}
					onChange={(v) => patch({ enabled: v })}
				>
					<Switch.Control>
						<Switch.Thumb />
					</Switch.Control>
					<Switch.Content>
						<Label className="text-sm">
							{value.enabled ? "已启用" : "已停用"}
						</Label>
					</Switch.Content>
				</Switch>
			</div>
		</div>
	);
}
