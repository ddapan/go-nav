"use client";

import type { Key } from "@heroui/react";
import { Description, Drawer, Label, ListBox } from "@heroui/react";
import type { SearchEngine } from "@/types";
import { IconView } from "./icon-view";

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
	const engineOptions = (() => {
		const base: SearchEngine[] = [];
		if (enableLocal) {
			base.push({
				id: "local",
				name: "本站",
				icon: "/images/search.svg",
				url: "",
			});
		}
		return [...base, ...engines.filter((e) => e.id !== "local")];
	})();

	return (
		<Drawer>
			<Drawer.Backdrop isOpen={open} onOpenChange={onOpenChange}>
				<Drawer.Content placement="right">
					<Drawer.Dialog className="ml-auto w-dvw max-w-72 p-3 bg-background">
						<Drawer.CloseTrigger />
						<Drawer.Header>
							<Drawer.Heading className="p-3 text-base font-semibold">
								切换搜索引擎
							</Drawer.Heading>
						</Drawer.Header>
						<Drawer.Body className="p-0">
							<ListBox
								aria-label="搜索引擎列表"
								selectedKeys={
									currentEngine === null
										? new Set()
										: new Set([String(currentEngine)])
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
						</Drawer.Body>
					</Drawer.Dialog>
				</Drawer.Content>
			</Drawer.Backdrop>
		</Drawer>
	);
}
