"use client";

import { Drawer } from "@heroui/react";
import { CategorySidebar } from "./category-sidebar";
import { IconView } from "./icon-view";
import type { NavCategory } from "@/types";

export function MobileNavDrawer({
	open,
	onOpenChange,
	categories,
	onItemClick,
	title,
	logo,
}: {
	open: boolean;
	onOpenChange: (v: boolean) => void;
	categories: NavCategory[];
	onItemClick: (id: string) => void;
	title: string;
	logo?: string;
}) {
	return (
		<Drawer>
			<Drawer.Backdrop isOpen={open} onOpenChange={onOpenChange}>
				<Drawer.Content placement="left">
					<Drawer.Dialog className="w-dvw max-w-72 p-3 bg-background">
						<Drawer.CloseTrigger />
						<Drawer.Header>
							<Drawer.Heading className="flex items-center gap-2 p-3">
								<IconView icon={logo} alt={title} size={24} />
								<span className="text-base truncate font-semibold">
									{title}
								</span>
							</Drawer.Heading>
						</Drawer.Header>
						<Drawer.Body className="p-0">
							<CategorySidebar
								categories={categories}
								onItemClick={onItemClick}
							/>
						</Drawer.Body>
					</Drawer.Dialog>
				</Drawer.Content>
			</Drawer.Backdrop>
		</Drawer>
	);
}
