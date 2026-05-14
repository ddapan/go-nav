"use client";

import type { Key } from "@heroui/react";
import { Button, Drawer } from "@heroui/react";
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

	const current = engineOptions.find((e) => e.id === currentEngine);

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
						<Drawer.Body className="p-3">
							{current && (
								<div className="mb-4 flex items-center gap-2 rounded-lg border bg-default/50 p-3">
									<IconView icon={current.icon} size={24} textClassName="text-xl" />
									<div className="min-w-0">
										<div className="text-xs text-muted">当前引擎</div>
										<div className="truncate text-sm font-medium">
											{current.name}
										</div>
									</div>
								</div>
							)}
							<div className="flex flex-col gap-2">
								{engineOptions.map((e) => {
									const active = e.id === currentEngine;
									return (
										<Button
											key={e.id}
											variant={active ? "primary" : "outline"}
											className="w-full justify-start gap-3"
											onPress={() => {
												onEngineChange(e.id);
												onOpenChange(false);
											}}
										>
											<IconView icon={e.icon} size={20} textClassName="text-xl" />
											<span className="flex-1 truncate text-left text-sm font-medium">
												{e.name}
											</span>
											{active && <span aria-hidden>✓</span>}
										</Button>
									);
								})}
							</div>
						</Drawer.Body>
					</Drawer.Dialog>
				</Drawer.Content>
			</Drawer.Backdrop>
		</Drawer>
	);
}
