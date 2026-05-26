"use client";

import type { Key } from "@heroui/react";
import { Description, Drawer, Label, ListBox } from "@heroui/react";
import type { SearchEngine } from "@/types";
import { HeaderDrawerShell } from "./header-drawer-shell";
import { IconView } from "./icon-view";
import { buildSearchEngineOptions } from "./search-bar/search-bar.utils";

export function EngineDrawer({
	open,
	onOpenChange,
	engines,
	enableLocal,
	currentEngine,
	onEngineChange,
}: {
	open: boolean;
	onOpenChange: (v: boolean) => void;
	engines: SearchEngine[];
	enableLocal: boolean;
	currentEngine: Key | null;
	onEngineChange: (id: Key) => void;
}) {
	const engineOptions = buildSearchEngineOptions(engines, enableLocal);

	return (
		<HeaderDrawerShell
			open={open}
			onOpenChange={onOpenChange}
			placement="right"
			header={
				<Drawer.Heading className="p-3 text-base font-semibold">
					切换搜索引擎
				</Drawer.Heading>
			}
		>
			<ListBox
				aria-label="搜索引擎列表"
				selectedKeys={
					currentEngine === null ? new Set() : new Set([String(currentEngine)])
				}
				selectionMode="single"
				className="px-2"
				onSelectionChange={(keys) => {
					if (keys === "all") return;
					const [key] = keys;
					if (key == null) return;
					onEngineChange(key);
					onOpenChange(false);
				}}
			>
				{engineOptions.map((e) => {
					return (
						<ListBox.Item
							key={e.id}
							id={e.id}
							textValue={e.name}
							className="min-h-14 gap-2.5 rounded-xl px-4 py-2 data-[selected=true]:bg-(--primary-foreground)! data-[selected=true]:shadow!"
						>
							<IconView icon={e.icon} size={20} textClassName="text-xl" />
							<div className="flex min-w-0 flex-1 flex-col gap-0.5">
								<Label className="truncate text-sm font-medium leading-5">
									{e.name}
								</Label>
								<Description className="truncate text-xs leading-4 text-muted">
									{e.id === "local" ? "搜索本站内容" : "外部搜索引擎"}
								</Description>
							</div>
							<ListBox.ItemIndicator />
						</ListBox.Item>
					);
				})}
			</ListBox>
		</HeaderDrawerShell>
	);
}
