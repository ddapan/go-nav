"use client";

import type { Key } from "@heroui/react";
import { Label, ListBox, Select } from "@heroui/react";
import type { SearchEngine } from "@/types";
import { getIconImageSrc } from "@/lib/icon";

export function SearchBarEngineSelect({
	engineId,
	engineOptions,
	onEngineChange,
}: {
	engineId: Key | null;
	engineOptions: SearchEngine[];
	onEngineChange: (id: Key | null) => void;
}) {
	return (
		<div className="hidden w-30 shrink-0 min-[480px]:block">
			<Select
				aria-label="选择搜索引擎"
				className="w-full h-9"
				value={engineId}
				onChange={(value) => onEngineChange(value)}
			>
				<Label className="sr-only">搜索引擎</Label>
				<Select.Trigger className="overflow-hidden">
					<Select.Value className="truncate" />
					<Select.Indicator />
				</Select.Trigger>
				<Select.Popover>
					<ListBox>
						{engineOptions.map((engine) => {
							const iconSrc = getIconImageSrc(engine.icon);
							return (
								<ListBox.Item
									key={engine.id}
									id={engine.id}
									textValue={engine.name}
								>
									<span
										className="flex items-center gap-2"
										style={{ maxWidth: "calc(100% - 16px)" }}
									>
										{engine.icon ? (
											iconSrc ? (
												// eslint-disable-next-line @next/next/no-img-element
												<img
													src={iconSrc}
													alt=""
													width={16}
													height={16}
													className="inline-block h-4 w-4 shrink-0 rounded object-contain"
												/>
											) : (
												<span aria-hidden className="shrink-0 text-center">
													{engine.icon}
												</span>
											)
										) : null}
										<span className="truncate">{engine.name}</span>
									</span>
									<ListBox.ItemIndicator />
								</ListBox.Item>
							);
						})}
					</ListBox>
				</Select.Popover>
			</Select>
		</div>
	);
}
