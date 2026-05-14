"use client";

import {
	Button,
	Chip,
	Input,
	InputGroup,
	Label,
	Link,
	Modal,
	TextField,
	Table,
	AlertDialog,
	toast,
	Drawer,
	cn,
	useOverlayState,
} from "@heroui/react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
	BiPencil,
	BiTrash,
	BiSearch,
	BiChevronRight,
	BiX,
	BiMenu,
	BiPlus,
	BiChevronUp,
	BiChevronDown,
} from "react-icons/bi";
import type { NavCategory, WebsiteData, NavSite } from "@/types";
import { useAtom, useAtomValue } from "jotai";
import { categoriesAtom, navAtom } from "@/lib/store/admin";
import { getIconImageSrc } from "@/lib/icon";
import { IconPicker } from "./icon-picker";
import {
	resolveConfiguredValue,
	resolveSiteBackgroundColor,
	toPx,
} from "../site-icon";

interface FlatCategory {
	category: NavCategory;
	id: string;
	name: string;
	icon?: string;
	level: number;
	hasChildren: boolean;
	siteCount: number;
	path: string[];
}

function collectExpandableIds(categories: NavCategory[]) {
	const ids = new Set<string>();
	const walk = (items: NavCategory[]) => {
		for (const item of items) {
			if ((item.children?.length ?? 0) > 0) {
				ids.add(item.id);
				walk(item.children ?? []);
			}
		}
	};
	walk(categories);
	return ids;
}

function findFirstSelectableCategoryId(
	categories: NavCategory[],
): string | null {
	for (const category of categories) {
		if ((category.children?.length ?? 0) > 0) {
			const childId = findFirstSelectableCategoryId(category.children ?? []);
			if (childId) return childId;
			continue;
		}
		return category.id;
	}
	return null;
}

function sameSet(a: Set<string>, b: Set<string>) {
	if (a.size !== b.size) return false;
	for (const item of a) {
		if (!b.has(item)) return false;
	}
	return true;
}

export function SitesEditor() {
	const [categories, setCategories] = useAtom(categoriesAtom);
	const nav = useAtomValue(navAtom);
	const value: WebsiteData = { categories };
	const onChange = (v: WebsiteData) => setCategories(v.categories);
	const [selectedCategory, setSelectedCategory] = useState<string | null>(() =>
		findFirstSelectableCategoryId(categories),
	);
	const [search, setSearch] = useState("");
	const [isModalOpen, setIsModalOpen] = useState(false);
	const [editingSite, setEditingSite] = useState<NavSite | null>(null);
	const [editingIndex, setEditingIndex] = useState<number>(-1);
	const [deleteTarget, setDeleteTarget] = useState<number | null>(null);
	const [expandedKeys, setExpandedKeys] = useState<Set<string>>(() =>
		collectExpandableIds(categories),
	);
	const knownExpandableIdsRef = useRef(collectExpandableIds(categories));
	const mobileDrawerState = useOverlayState();
	const defaultIconPadding = nav.layout?.defaultIconPadding;

	const flatCategories = useMemo(() => {
		const result: FlatCategory[] = [];
		const walk = (cats: NavCategory[], level: number, path: string[]) => {
			for (const c of cats) {
				const currentPath = [...path, c.id];
				const hasChildren = (c.children?.length ?? 0) > 0;
				const siteCount = c.sites?.length ?? 0;
				result.push({
					category: c,
					id: c.id,
					name: c.name,
					icon: c.icon,
					level,
					hasChildren,
					siteCount,
					path: currentPath,
				});
				if (c.children) {
					walk(c.children, level + 1, currentPath);
				}
			}
		};
		walk(value.categories, 0, []);
		return result;
	}, [value.categories]);

	useEffect(() => {
		const nextExpandableIds = collectExpandableIds(value.categories);
		setExpandedKeys((prev) => {
			const next = new Set<string>();
			for (const id of prev) {
				if (nextExpandableIds.has(id)) next.add(id);
			}
			for (const id of nextExpandableIds) {
				if (!knownExpandableIdsRef.current.has(id)) next.add(id);
			}
			knownExpandableIdsRef.current = nextExpandableIds;
			return sameSet(prev, next) ? prev : next;
		});
	}, [value.categories]);

	useEffect(() => {
		const selected = flatCategories.find((c) => c.id === selectedCategory);
		if (selected && !selected.hasChildren) return;
		setSelectedCategory(findFirstSelectableCategoryId(value.categories));
	}, [flatCategories, selectedCategory, value.categories]);

	const currentCategory = useMemo(() => {
		if (!selectedCategory) return null;
		const find = (cats: NavCategory[]): NavCategory | null => {
			for (const c of cats) {
				if (c.id === selectedCategory) return c;
				if (c.children) {
					const found = find(c.children);
					if (found) return found;
				}
			}
			return null;
		};
		return find(value.categories);
	}, [selectedCategory, value.categories]);

	const currentSites = useMemo(() => {
		if (!currentCategory) return [];
		return currentCategory.sites ?? [];
	}, [currentCategory]);

	const filteredSites = useMemo(() => {
		if (!search.trim()) return currentSites;
		const q = search.toLowerCase();
		return currentSites.filter(
			(s) =>
				s.title.toLowerCase().includes(q) ||
				s.url.toLowerCase().includes(q) ||
				s.description?.toLowerCase().includes(q) ||
				s.tags?.some((t) => t.toLowerCase().includes(q)),
		);
	}, [currentSites, search]);

	const updateSites = (updater: (sites: NavSite[]) => NavSite[]) => {
		if (!selectedCategory) return null;
		const deepUpdate = (cats: NavCategory[]): NavCategory[] =>
			cats.map((c) => {
				if (c.id === selectedCategory) {
					return { ...c, sites: updater(c.sites ?? []) };
				}
				if (c.children) return { ...c, children: deepUpdate(c.children) };
				return c;
			});
		const newData = { ...value, categories: deepUpdate(value.categories) };
		onChange(newData);
		return newData;
	};

	const openAddModal = () => {
		setEditingSite({
			title: "",
			description: "",
			url: "https://",
			icon: "",
			bgColor: "rgba(255, 255, 255, 0)",
			iconPadding: "",
			tags: [],
		});
		setEditingIndex(-1);
		setIsModalOpen(true);
	};

	const openEditModal = (site: NavSite, index: number) => {
		setEditingSite({ ...site });
		setEditingIndex(index);
		setIsModalOpen(true);
	};

	const saveSite = async () => {
		if (!editingSite || !selectedCategory) return;
		if (!editingSite.title.trim()) {
			toast.warning("网站名称不能为空");
			return;
		}
		if (!editingSite.url.trim()) {
			toast.warning("网站地址不能为空");
			return;
		}
		if (editingIndex >= 0) {
			updateSites((sites) => {
				const copy = [...sites];
				copy[editingIndex] = editingSite;
				return copy;
			});
			toast.success(`网址"${editingSite.title}"已更新，记得点击保存`);
		} else {
			updateSites((sites) => [...sites, editingSite]);
			toast.success(`网址"${editingSite.title}"已添加，记得点击保存`);
		}
		setIsModalOpen(false);
		setEditingSite(null);
		setEditingIndex(-1);
	};

	const deleteSite = (index: number) => {
		const site = currentSites[index];
		updateSites((sites) => sites.filter((_, i) => i !== index));
		toast.success(`网址"${site?.title}"已删除，记得点击保存`);
		setDeleteTarget(null);
	};

	const moveSite = (siteId: string, direction: "up" | "down") => {
		updateSites((sites) => {
			const index = sites.findIndex((s) => `${s.url}-${s.title}` === siteId);
			if (index < 0) return sites;
			const newIndex = direction === "up" ? index - 1 : index + 1;
			if (newIndex < 0 || newIndex >= sites.length) return sites;
			const copy = sites.slice();
			const [moved] = copy.splice(index, 1);
			copy.splice(newIndex, 0, moved);
			return copy;
		});
	};

	const getCategoryPath = (catId: string): string => {
		const cat = flatCategories.find((c) => c.id === catId);
		if (!cat) return catId;
		const names: string[] = [];
		for (let i = 0; i < cat.path.length; i++) {
			const c = flatCategories.find((fc) => fc.id === cat.path[i]);
			if (c) names.push(c.name);
		}
		return names.join(" / ");
	};

	const handleSelectCategory = (catId: string) => {
		setSelectedCategory(catId);
		setSearch("");
		setDeleteTarget(null);
		mobileDrawerState.close();
	};

	const toggleExpand = (catId: string) => {
		setExpandedKeys((prev) => {
			const next = new Set(prev);
			if (next.has(catId)) {
				next.delete(catId);
			} else {
				next.add(catId);
			}
			return next;
		});
	};

	const renderIcon = (icon?: string) => {
		if (!icon) return <span className="h-5 w-5 shrink-0" aria-hidden />;
		const iconSrc = getIconImageSrc(icon);
		if (iconSrc) {
			// eslint-disable-next-line @next/next/no-img-element
			return <img src={iconSrc} alt="" className="h-5 w-5 rounded object-contain" />;
		}
		return <span className="w-5 text-center text-base">{icon}</span>;
	};

	const getResolvedIconPadding = (site?: NavSite | null) =>
		resolveConfiguredValue(site?.iconPadding, defaultIconPadding);

	const renderTreeItem = (cat: FlatCategory) => {
		const isExpanded = expandedKeys.has(cat.id);
		const isSelected = selectedCategory === cat.id;
		const isLeaf = !cat.hasChildren;

		const children = flatCategories.filter(
			(c) =>
				c.path.length === cat.path.length + 1 &&
				c.path[c.path.length - 2] === cat.id,
		);

		return (
			<div key={cat.id}>
				<button
					type="button"
					onClick={() => {
						if (cat.hasChildren) {
							toggleExpand(cat.id);
						}
						if (isLeaf) {
							handleSelectCategory(cat.id);
						}
					}}
					className={`flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-all ${
						isSelected
							? "bg-blue-50 font-medium text-blue-600 dark:bg-blue-950/40 dark:text-blue-300"
							: "hover:bg-default/50"
					}`}
				>
					<span className="inline-flex w-5 shrink-0 items-center justify-center">
						{cat.hasChildren ? (
							<BiChevronRight
								className={cn(
									"size-4 transition-transform duration-150",
									isExpanded ? "rotate-90" : "",
								)}
							/>
						) : (
							<div className="w-4" />
						)}
					</span>
					{renderIcon(cat.icon)}
					<span className="truncate flex-1">{cat.name}</span>
					{cat.siteCount > 0 && (
						<Chip
							size="sm"
							variant="secondary"
							className="h-5 min-w-5 px-1.5 text-xs!"
						>
							{cat.siteCount}
						</Chip>
					)}
				</button>
				{isExpanded && children.length > 0 && (
					<div>{children.map((child) => renderTreeItem(child))}</div>
				)}
			</div>
		);
	};

	const renderCategoryList = () => {
		const rootCategories = flatCategories.filter((c) => c.level === 0);

		if (rootCategories.length === 0) {
			return (
				<p className="py-8 text-center text-xs text-default-500">
					暂无可选分类
				</p>
			);
		}

		return (
			<div className="flex flex-col gap-0.5">
				{rootCategories.map((cat) => renderTreeItem(cat))}
			</div>
		);
	};

	return (
		<div className="flex h-[calc(100vh-106px)] flex-col gap-4">
			<div className="flex min-h-0 flex-1 gap-4">
				<div className="hidden w-64 shrink-0 flex-col overflow-hidden rounded-xl border border-gray-200 bg-white lg:flex dark:border-neutral-800 dark:bg-neutral-900">
					<div className="border-b border-gray-100 px-4 py-3 dark:border-neutral-800">
						<h3 className="text-sm font-semibold">选择分类</h3>
					</div>
					<div className="flex-1 overflow-y-auto p-2 overscroll-none">
						{renderCategoryList()}
					</div>
				</div>

				<div className="min-w-0 flex-1 overflow-visible">
					{!selectedCategory ? (
						<div className="flex h-full flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed border-gray-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
							<p className="text-sm text-default-500">请先选择一个分类</p>
							<Button
								variant="primary"
								size="sm"
								className="lg:hidden"
								onPress={mobileDrawerState.open}
							>
								选择分类
							</Button>
						</div>
					) : (
						<div className="flex h-full flex-col gap-4 overflow-y-scroll overscroll-none">
							<div className="flex flex-col gap-4 flex-wrap sm:flex-row sm:items-center sm:justify-between">
								<div className="flex items-center gap-2 pt-1">
									<span className="truncate font-medium text-lg!">
										{getCategoryPath(selectedCategory)}
									</span>
									<Chip
										variant="primary"
										color="accent"
										className="shrink-0 text-xs! font-medium"
									>
										{currentSites.length} 个网址
									</Chip>
								</div>
								<div className="flex items-center gap-2 flex-wrap">
									<Button
										variant="outline"
										size="sm"
										className="shrink-0 lg:hidden"
										isIconOnly
										onPress={mobileDrawerState.open}
									>
										<BiMenu className="size-4" />
									</Button>
									<TextField
										className="flex-1 sm:w-64"
										value={search}
										onChange={setSearch}
									>
										<Label className="sr-only">搜索</Label>
										<InputGroup>
											<InputGroup.Prefix>
												<BiSearch className="size-4 text-default-500" />
											</InputGroup.Prefix>
											<InputGroup.Input placeholder="搜索网站..." />
										</InputGroup>
									</TextField>
									<Button
										variant="primary"
										size="sm"
										className="shrink-0"
										onPress={openAddModal}
									>
										<BiPlus data-icon="inline-start" />
										<span className="hidden sm:inline">新增网址</span>
										<span className="sm:hidden">新增</span>
									</Button>
								</div>
							</div>

							<div>
								{filteredSites.length === 0 ? (
									<div className="flex h-64 items-center justify-center rounded-xl border-2 border-dashed border-gray-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
										<p className="text-sm text-default-500">
											{search
												? "没有匹配的网站"
												: "该分类下暂无网址，点击右上角新增"}
										</p>
									</div>
								) : (
									<Table variant="secondary" aria-label="网址列表">
										<Table.ScrollContainer>
											<Table.Content aria-label="网址列表">
												<Table.Header>
													<Table.Column className="w-12">图标</Table.Column>
													<Table.Column
														className="w-24 min-w-24 sm:w-40 sm:min-w-40"
														isRowHeader
													>
														名称
													</Table.Column>
													<Table.Column className="min-w-48">URL</Table.Column>
													<Table.Column className="min-w-40">描述</Table.Column>
													<Table.Column className="min-w-32">标签</Table.Column>
													<Table.Column className="w-24 min-w-24">
														操作
													</Table.Column>
												</Table.Header>
												<Table.Body
													renderEmptyState={() => (
														<div className="py-12 text-center text-sm text-default-500">
															暂无数据
														</div>
													)}
												>
													{filteredSites.map((site, listIndex) => {
														const realIndex = currentSites.indexOf(site);
														const uniqueKey = `${site.url}-${site.title}-${listIndex}`;
														const rowId = `${site.url}-${site.title}`;
														const siteIconSrc = getIconImageSrc(site.icon);
														return (
															<Table.Row
																key={uniqueKey}
																id={uniqueKey}
																textValue={site.title}
															>
																<Table.Cell>
																	<div
																		className="flex h-8 w-8 items-center justify-center rounded-lg"
																		style={{
																			backgroundColor: resolveSiteBackgroundColor(
																				site.bgColor,
																			),
																			padding:
																				toPx(getResolvedIconPadding(site)) ||
																				undefined,
																		}}
																	>
																		{site.icon ? (
																			siteIconSrc ? (
																				// eslint-disable-next-line @next/next/no-img-element
																				<img
																					src={siteIconSrc}
																					alt=""
																					className="h-5 w-5 rounded object-contain"
																				/>
																			) : (
																				<span className="text-center text-base">
																					{site.icon}
																				</span>
																			)
																		) : (
																			<span className="text-center text-xs font-bold text-default-500">
																				{site.title.charAt(0)}
																			</span>
																		)}
																	</div>
																</Table.Cell>
																<Table.Cell>
																	<div className="flex flex-col gap-0.5">
																		<span className="font-medium">
																			{site.title}
																		</span>
																	</div>
																</Table.Cell>
																<Table.Cell>
																	<Link
																		href={site.url}
																		target="_blank"
																		rel="noopener noreferrer"
																		className="inline-flex items-center gap-1 text-xs truncate transition no-underline hover:underline"
																	>
																		<span className="truncate">{site.url}</span>
																		<Link.Icon />
																	</Link>
																</Table.Cell>
																<Table.Cell>
																	<span className="line-clamp-2 text-default-500">
																		{site.description || "-"}
																	</span>
																</Table.Cell>
																<Table.Cell>
																	<div className="flex flex-wrap gap-1">
																		{(site.tags ?? []).map((t: string) => (
																			<Chip
																				key={t}
																				className="text-xs!"
																				variant="secondary"
																			>
																				{t}
																			</Chip>
																		))}
																		{!site.tags?.length && (
																			<span className="text-default-500">
																				-
																			</span>
																		)}
																	</div>
																</Table.Cell>
																<Table.Cell>
																	<div className="flex items-center gap-1">
																		<Button
																			isIconOnly
																			size="sm"
																			variant="outline"
																			aria-label="上移"
																			isDisabled={realIndex <= 0}
																			onPress={() => moveSite(rowId, "up")}
																		>
																			<BiChevronUp />
																		</Button>
																		<Button
																			isIconOnly
																			size="sm"
																			variant="outline"
																			aria-label="下移"
																			isDisabled={
																				realIndex >= currentSites.length - 1
																			}
																			onPress={() => moveSite(rowId, "down")}
																		>
																			<BiChevronDown />
																		</Button>
																		<Button
																			isIconOnly
																			size="sm"
																			variant="outline"
																			aria-label="编辑"
																			onPress={() =>
																				openEditModal(site, realIndex)
																			}
																		>
																			<BiPencil />
																		</Button>
																		<Button
																			isIconOnly
																			size="sm"
																			variant="outline"
																			className="text-danger"
																			aria-label="删除"
																			onPress={() => setDeleteTarget(realIndex)}
																		>
																			<BiTrash />
																		</Button>
																	</div>
																</Table.Cell>
															</Table.Row>
														);
													})}
												</Table.Body>
											</Table.Content>
										</Table.ScrollContainer>
									</Table>
								)}
							</div>
						</div>
					)}
				</div>
			</div>

			<Drawer>
				<Drawer.Backdrop
					isOpen={mobileDrawerState.isOpen}
					onOpenChange={mobileDrawerState.setOpen}
				>
					<Drawer.Content placement="left">
						<Drawer.Dialog className="w-dvw max-w-72 p-3 bg-white dark:bg-neutral-900">
							<Drawer.Header>
								<Drawer.Heading className="flex items-center justify-between p-3">
									<span>选择分类</span>
									<Button
										isIconOnly
										size="sm"
										variant="tertiary"
										onPress={mobileDrawerState.close}
									>
										<BiX className="size-4" />
									</Button>
								</Drawer.Heading>
							</Drawer.Header>
							<Drawer.Body className="overflow-y-auto">
								{renderCategoryList()}
							</Drawer.Body>
						</Drawer.Dialog>
					</Drawer.Content>
				</Drawer.Backdrop>
			</Drawer>

			<Modal>
				<Modal.Backdrop
					isOpen={isModalOpen}
					onOpenChange={(open) => !open && setIsModalOpen(false)}
				>
					<Modal.Container>
						<Modal.Dialog className="sm:max-w-125">
							<Modal.CloseTrigger />
							<Modal.Header>
								<Modal.Heading>
									{editingIndex >= 0 ? "编辑网址" : "新增网址"}
								</Modal.Heading>
							</Modal.Header>
							<Modal.Body>
								<div className="flex flex-col gap-4">
									<div className="flex flex-col gap-1">
										<span className="text-sm font-medium">分类</span>
										<span className="rounded-lg bg-default/40 px-3 py-2 text-sm border border-default">
											{selectedCategory
												? getCategoryPath(selectedCategory)
												: "-"}
										</span>
									</div>
									<TextField
										value={editingSite?.title ?? ""}
										onChange={(v) =>
											setEditingSite({ ...editingSite!, title: v })
										}
									>
										<Label>网站名称</Label>
										<Input placeholder="例如：GitHub" />
									</TextField>
									<TextField
										value={editingSite?.url ?? ""}
										onChange={(v) =>
											setEditingSite({ ...editingSite!, url: v })
										}
									>
										<Label>网站地址</Label>
										<Input placeholder="https://..." />
									</TextField>
									<TextField
										value={editingSite?.description ?? ""}
										onChange={(v) =>
											setEditingSite({ ...editingSite!, description: v })
										}
									>
										<Label>描述</Label>
										<Input placeholder="可选" />
									</TextField>
									<TextField
										value={(editingSite?.tags ?? []).join(", ")}
										onChange={(v) =>
											setEditingSite({
												...editingSite!,
												tags: v
													.split(/[,，]/)
													.map((s) => s.trim())
													.filter(Boolean),
											})
										}
									>
										<Label>标签（逗号分隔）</Label>
										<Input placeholder="工具, 开发, 代码" />
									</TextField>
									<div className="flex flex-col gap-1">
										<Label>图标</Label>
										<IconPicker
											value={editingSite?.icon ?? ""}
											onChange={(v) =>
												setEditingSite({ ...editingSite!, icon: v })
											}
											bgColor={editingSite?.bgColor}
											onBgColorChange={(v) =>
												setEditingSite({ ...editingSite!, bgColor: v })
											}
											iconPadding={editingSite?.iconPadding}
											defaultIconPadding={defaultIconPadding}
											onIconPaddingChange={(v) =>
												setEditingSite({ ...editingSite!, iconPadding: v })
											}
										/>
									</div>
								</div>
							</Modal.Body>
							<Modal.Footer>
								<Button
									variant="tertiary"
									onPress={() => setIsModalOpen(false)}
								>
									取消
								</Button>
								<Button variant="primary" onPress={saveSite}>
									{editingIndex >= 0 ? "保存" : "新增"}
								</Button>
							</Modal.Footer>
						</Modal.Dialog>
					</Modal.Container>
				</Modal.Backdrop>
			</Modal>

			<AlertDialog>
				<AlertDialog.Backdrop
					isOpen={deleteTarget !== null}
					onOpenChange={(open) => !open && setDeleteTarget(null)}
				>
					<AlertDialog.Container>
						<AlertDialog.Dialog className="sm:max-w-100">
							<AlertDialog.CloseTrigger />
							<AlertDialog.Header>
								<AlertDialog.Icon status="danger" />
								<AlertDialog.Heading>确认删除网址</AlertDialog.Heading>
							</AlertDialog.Header>
							<AlertDialog.Body>
								<p>
									删除 <strong>{currentSites[deleteTarget ?? 0]?.title}</strong>{" "}
									后，该网址数据将被永久删除，此操作不可撤销。
								</p>
							</AlertDialog.Body>
							<AlertDialog.Footer>
								<Button slot="close" variant="tertiary">
									取消
								</Button>
								<Button
									slot="close"
									variant="danger"
									onPress={() => {
										if (deleteTarget !== null) {
											deleteSite(deleteTarget);
										}
									}}
								>
									确认删除
								</Button>
							</AlertDialog.Footer>
						</AlertDialog.Dialog>
					</AlertDialog.Container>
				</AlertDialog.Backdrop>
			</AlertDialog>
		</div>
	);
}
