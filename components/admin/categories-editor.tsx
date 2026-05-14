"use client";

import {
	Button,
	Table,
	Modal,
	Form,
	Input,
	Label,
	TextField,
	Description,
	AlertDialog,
	Chip,
	Select,
	ListBox,
	toast,
	cn,
} from "@heroui/react";
import { useState, useMemo } from "react";
import {
	BiPlus,
	BiEdit,
	BiTrash,
	BiChevronUp,
	BiChevronDown,
} from "react-icons/bi";
import type { NavCategory } from "@/types";
import { useAtom } from "jotai";
import { categoriesAtom } from "@/lib/store/admin";
import { getIconImageSrc } from "@/lib/icon";
import { IconPicker } from "./icon-picker";
import { Icon } from "@iconify/react";

interface CategoryFormState {
	id: string;
	name: string;
	icon: string;
	description: string;
	parentId: string | null;
}

const emptyForm: CategoryFormState = {
	id: "",
	name: "",
	icon: "",
	description: "",
	parentId: null,
};

export function CategoriesEditor() {
	const [categories, setCategories] = useAtom(categoriesAtom);
	const value = { categories };
	const onChange = (v: { categories: NavCategory[] }) =>
		setCategories(v.categories);
	const [isModalOpen, setIsModalOpen] = useState(false);
	const [editingCategory, setEditingCategory] = useState<{
		category: NavCategory;
		path: string[];
	} | null>(null);
	const [formState, setFormState] = useState<CategoryFormState>(emptyForm);
	const [deleteTarget, setDeleteTarget] = useState<{
		category: NavCategory;
		path: string[];
	} | null>(null);

	const flatCategories = useMemo(() => {
		const result: Array<{
			category: NavCategory;
			path: string[];
			level: number;
			hasChildren: boolean;
		}> = [];
		const traverse = (cats: NavCategory[], level: number, path: string[]) => {
			for (const cat of cats) {
				const currentPath = [...path, cat.id];
				const hasChildren = (cat.children?.length ?? 0) > 0;
				result.push({ category: cat, path: currentPath, level, hasChildren });
				if (cat.children && cat.children.length > 0) {
					traverse(cat.children, level + 1, currentPath);
				}
			}
		};
		traverse(value.categories, 0, []);
		return result;
	}, [value.categories]);

	const parentOptions = useMemo(() => {
		const result: Array<{ id: string; name: string; level: number }> = [];
		const traverse = (cats: NavCategory[], level: number, path: string[]) => {
			for (const cat of cats) {
				const siteCount = cat.sites?.length ?? 0;
				if (siteCount === 0) {
					result.push({ id: cat.id, name: cat.name, level });
				}
				if (cat.children?.length) {
					traverse(cat.children, level + 1, [...path, cat.id]);
				}
			}
		};
		traverse(value.categories, 0, []);
		return result;
	}, [value.categories]);

	const findCategoryPath = (
		targetId: string,
	): { category: NavCategory; path: string[] } | null => {
		const find = (
			cats: NavCategory[],
			path: string[],
		): { category: NavCategory; path: string[] } | null => {
			for (const cat of cats) {
				const currentPath = [...path, cat.id];
				if (cat.id === targetId) {
					return { category: cat, path: currentPath };
				}
				if (cat.children?.length) {
					const found = find(cat.children, currentPath);
					if (found) return found;
				}
			}
			return null;
		};
		return find(value.categories, []);
	};

	const addCategoryToTree = (
		cats: NavCategory[],
		newCat: NavCategory,
		parentId: string | null,
	): NavCategory[] => {
		if (!parentId) {
			return [...cats, newCat];
		}
		return cats.map((cat) => {
			if (cat.id === parentId) {
				return { ...cat, children: [...(cat.children ?? []), newCat] };
			}
			if (cat.children?.length) {
				return {
					...cat,
					children: addCategoryToTree(cat.children, newCat, parentId),
				};
			}
			return cat;
		});
	};

	const updateCategoryInTree = (
		cats: NavCategory[],
		path: string[],
		updated: NavCategory,
	): NavCategory[] => {
		return cats.map((cat) => {
			if (cat.id === path[0]) {
				if (path.length === 1) {
					return { ...cat, ...updated, id: cat.id, children: cat.children };
				}
				return {
					...cat,
					children: updateCategoryInTree(
						cat.children ?? [],
						path.slice(1),
						updated,
					),
				};
			}
			if (cat.children?.length) {
				return {
					...cat,
					children: updateCategoryInTree(cat.children, path, updated),
				};
			}
			return cat;
		});
	};

	const deleteCategoryFromTree = (
		cats: NavCategory[],
		path: string[],
	): NavCategory[] => {
		if (path.length === 1) {
			return cats.filter((c) => c.id !== path[0]);
		}
		return cats.map((cat) => {
			if (cat.id === path[0]) {
				return {
					...cat,
					children: deleteCategoryFromTree(cat.children ?? [], path.slice(1)),
				};
			}
			if (cat.children?.length) {
				return { ...cat, children: deleteCategoryFromTree(cat.children, path) };
			}
			return cat;
		});
	};

	const moveCategory = (path: string[], direction: "up" | "down") => {
		const moveInArray = (
			arr: NavCategory[],
			index: number,
			dir: "up" | "down",
		): NavCategory[] => {
			const newIndex = dir === "up" ? index - 1 : index + 1;
			if (newIndex < 0 || newIndex >= arr.length) return arr;
			const copy = [...arr];
			[copy[index], copy[newIndex]] = [copy[newIndex], copy[index]];
			return copy;
		};

		const moveInTree = (
			cats: NavCategory[],
			p: string[],
			dir: "up" | "down",
		): NavCategory[] => {
			if (p.length === 1) {
				const idx = cats.findIndex((c) => c.id === p[0]);
				if (idx === -1) return cats;
				return moveInArray(cats, idx, dir);
			}
			return cats.map((cat) => {
				if (cat.id === p[0]) {
					return {
						...cat,
						children: moveInTree(cat.children ?? [], p.slice(1), dir),
					};
				}
				if (cat.children?.length) {
					return { ...cat, children: moveInTree(cat.children, p, dir) };
				}
				return cat;
			});
		};

		const newData = {
			...value,
			categories: moveInTree(value.categories, path, direction),
		};
		onChange(newData);
	};

	const handleOpenAdd = (parentId: string | null = null) => {
		setEditingCategory(null);
		const shortId = Math.random().toString(36).slice(2, 8);
		setFormState({ ...emptyForm, parentId, id: shortId });
		setIsModalOpen(true);
	};

	const handleOpenEdit = (category: NavCategory, path: string[]) => {
		setEditingCategory({ category, path });
		setFormState({
			id: category.id,
			name: category.name,
			icon: category.icon ?? "",
			description: category.description || "",
			parentId: path.length > 1 ? path[path.length - 2] : null,
		});
		setIsModalOpen(true);
	};

	const handleSave = () => {
		if (!formState.name.trim()) return;

		const updatedCategory: NavCategory = {
			id: formState.id,
			name: formState.name.trim(),
			icon: formState.icon.trim() || undefined,
			description: formState.description.trim() || undefined,
			sites: editingCategory?.category.sites,
			children: editingCategory?.category.children,
		};

		if (editingCategory) {
			const newData = {
				...value,
				categories: updateCategoryInTree(
					value.categories,
					editingCategory.path,
					updatedCategory,
				),
			};
			onChange(newData);
			toast.success(`分类"${formState.name}"已更新，记得点击保存`);
		} else {
			const categoryToAdd = formState.parentId
				? updatedCategory
				: {
						...updatedCategory,
						children: [
							{
								id: `${formState.id}-default`,
								name: "默认分类",
								sites: [],
							},
						],
					};
			const newData = {
				...value,
				categories: addCategoryToTree(
					value.categories,
					categoryToAdd,
					formState.parentId,
				),
			};
			onChange(newData);
			toast.success(`分类"${formState.name}"已添加，记得点击保存`);
		}
		setIsModalOpen(false);
		setFormState(emptyForm);
		setEditingCategory(null);
	};

	const handleDelete = () => {
		if (!deleteTarget) return;

		const isChildCategory = deleteTarget.path.length > 1;
		if (isChildCategory) {
			const parentPath = deleteTarget.path.slice(0, -1);
			const getParent = (
				cats: NavCategory[],
				path: string[],
			): NavCategory | undefined => {
				if (path.length === 0) return undefined;
				let current = cats.find((c) => c.id === path[0]);
				for (let i = 1; i < path.length; i++) {
					if (!current?.children) return undefined;
					current = current.children.find((c) => c.id === path[i]);
				}
				return current;
			};
			const parent = getParent(value.categories, parentPath);
			const siblingCount = parent?.children?.length ?? 0;
			if (siblingCount <= 1) {
				toast.warning("无法删除", {
					description: "每个父级分类至少需要保留一个子分类",
				});
				setDeleteTarget(null);
				return;
			}
		}

		const newData = {
			...value,
			categories: deleteCategoryFromTree(value.categories, deleteTarget.path),
		};
		onChange(newData);
		toast.success(`分类"${deleteTarget.category.name}"已删除，记得点击保存`);
		setDeleteTarget(null);
	};

	const renderExpandableRow = (category: NavCategory) => {
		const siteCount = category.sites?.length ?? 0;
		const canAddChild = siteCount === 0;

		const categoryPath = findCategoryPath(category.id);
		const currentPath = categoryPath?.path ?? [category.id];
		const isParent = currentPath.length === 1;

		// 计算同级兄弟中的索引与总数，用于上/下移按钮禁用
		const getSiblings = (): NavCategory[] => {
			if (currentPath.length === 1) return value.categories;
			const parentPath = currentPath.slice(0, -1);
			let current: NavCategory | undefined = value.categories.find(
				(c) => c.id === parentPath[0],
			);
			for (let i = 1; i < parentPath.length; i++) {
				if (!current?.children) return [];
				current = current.children.find((c) => c.id === parentPath[i]);
			}
			return current?.children ?? [];
		};
		const siblings = getSiblings();
		const siblingIdx = siblings.findIndex((c) => c.id === category.id);
		const isFirst = siblingIdx <= 0;
		const isLast = siblingIdx >= siblings.length - 1;

		const renderIcon = () => {
			const icon = category.icon;
			if (!icon) return <span className="h-5 w-5" aria-hidden />;
			const iconSrc = getIconImageSrc(icon);
			if (iconSrc) {
				return (
					// eslint-disable-next-line @next/next/no-img-element
					<img src={iconSrc} alt="" className="h-5 w-5 rounded object-contain" />
				);
			}
			return <span className="w-5 text-center text-lg">{icon}</span>;
		};

		return (
			<Table.Row key={category.id} id={category.id} textValue={category.name}>
				<Table.Cell textValue={category.name}>
					{({ hasChildItems, isExpanded, isTreeColumn }) => (
						<span className="flex items-center gap-2">
							{hasChildItems && isTreeColumn && (
								<Button
									isIconOnly
									aria-label="Toggle row"
									size="sm"
									slot="chevron"
									variant="ghost"
								>
									<Icon
										aria-hidden
										icon="gravity-ui:chevron-right"
										className={cn(
											"size-4 text-muted transition-transform duration-150",
											isExpanded ? "rotate-90" : "",
										)}
									/>
								</Button>
							)}
							{!hasChildItems && <div className={isParent ? "w-9" : "w-5"} />}
							{renderIcon()}
							<span className="font-medium">{category.name}</span>
						</span>
					)}
				</Table.Cell>
				<Table.Cell>
					<code className="rounded bg-default/20 px-1.5 py-0.5 text-xs font-mono">
						{category.id}
					</code>
				</Table.Cell>
				<Table.Cell className="max-w-60 truncate text-default-500">
					{category.description || "-"}
				</Table.Cell>
				<Table.Cell>
					<div className="flex items-center gap-1">
						<Button
							isIconOnly
							size="sm"
							variant="outline"
							aria-label="上移"
							isDisabled={isFirst}
							onPress={() => moveCategory(currentPath, "up")}
						>
							<BiChevronUp />
						</Button>
						<Button
							isIconOnly
							size="sm"
							variant="outline"
							aria-label="下移"
							isDisabled={isLast}
							onPress={() => moveCategory(currentPath, "down")}
						>
							<BiChevronDown />
						</Button>
						<Button
							isIconOnly
							size="sm"
							variant="outline"
							aria-label="编辑"
							onPress={() => handleOpenEdit(category, currentPath)}
						>
							<BiEdit />
						</Button>
						{canAddChild && (
							<Button
								isIconOnly
								size="sm"
								variant="outline"
								aria-label="添加子分类"
								onPress={() => handleOpenAdd(category.id)}
							>
								<BiPlus />
							</Button>
						)}
						<Button
							isIconOnly
							size="sm"
							variant="outline"
							className="text-danger"
							aria-label="删除"
							onPress={() => {
								const target = findCategoryPath(category.id);
								if (target) setDeleteTarget(target);
							}}
						>
							<BiTrash />
						</Button>
					</div>
				</Table.Cell>
				<Table.Collection items={category.children ?? []}>
					{renderExpandableRow}
				</Table.Collection>
			</Table.Row>
		);
	};

	return (
		<div className="flex flex-col gap-4">
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-3">
					<Chip
						variant="primary"
						color="accent"
						className="text-xs! font-medium"
					>
						{flatCategories.length} 个分类
					</Chip>
				</div>
				<Button variant="primary" size="sm" onPress={() => handleOpenAdd(null)}>
					<BiPlus data-icon="inline-start" />
					新增分类
				</Button>
			</div>

			<Table variant="secondary" aria-label="分类列表">
				<Table.ScrollContainer>
					<Table.Content aria-label="分类列表" treeColumn="name">
						<Table.Header>
							<Table.Column isRowHeader id="name" className="min-w-48">
								分类名称
							</Table.Column>
							<Table.Column id="id" className="min-w-48">
								ID
							</Table.Column>
							<Table.Column id="description" className="min-w-60">
								描述
							</Table.Column>
							<Table.Column id="actions" className="min-w-32">
								操作
							</Table.Column>
						</Table.Header>
						<Table.Body
							items={value.categories}
							renderEmptyState={() => (
								<div className="py-12 text-center text-sm">
									暂无分类，点击右上角新增
								</div>
							)}
						>
							{(category) => renderExpandableRow(category)}
						</Table.Body>
					</Table.Content>
				</Table.ScrollContainer>
			</Table>

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
									{editingCategory ? "编辑分类" : "新增分类"}
								</Modal.Heading>
							</Modal.Header>
							<Modal.Body>
								<Form
									className="flex flex-col gap-4"
									onSubmit={(e) => {
										e.preventDefault();
										handleSave();
									}}
								>
									<TextField
										isRequired
										name="name"
										value={formState.name}
										onChange={(v) => setFormState({ ...formState, name: v })}
									>
										<Label>分类名称</Label>
										<Input placeholder="请输入分类名称" />
									</TextField>

									<TextField
										isRequired
										name="id"
										value={formState.id}
										onChange={(v) => setFormState({ ...formState, id: v })}
										isReadOnly={!!editingCategory}
									>
										<Label>分类 ID</Label>
										<Input placeholder="唯一标识，如：tech" />
										<Description>唯一标识，创建后不可修改</Description>
									</TextField>

									<div className="flex flex-col gap-2">
										<Label>图标</Label>
										<IconPicker
											value={formState.icon}
											onChange={(v) => setFormState({ ...formState, icon: v })}
										/>
									</div>

									<TextField
										name="description"
										value={formState.description}
										onChange={(v) =>
											setFormState({ ...formState, description: v })
										}
									>
										<Label>描述（可选）</Label>
										<Input placeholder="分类描述" />
									</TextField>

									{!editingCategory && (
										<Select
											selectedKey={formState.parentId ?? ""}
											onSelectionChange={(key) => {
												setFormState({
													...formState,
													parentId: key ? String(key) : null,
												});
											}}
										>
											<Label>父级分类（可选）</Label>
											<Select.Trigger>
												<Select.Value />
												<Select.Indicator />
											</Select.Trigger>
											<Select.Popover>
												<ListBox>
													<ListBox.Item id="">
														无（顶级分类）
														<ListBox.ItemIndicator />
													</ListBox.Item>
													{parentOptions.map((opt) => (
														<ListBox.Item key={opt.id} id={opt.id}>
															{"　".repeat(opt.level)}
															{opt.name}
															<ListBox.ItemIndicator />
														</ListBox.Item>
													))}
												</ListBox>
											</Select.Popover>
										</Select>
									)}

									<div className="flex gap-2 justify-end">
										<Button
											type="button"
											variant="tertiary"
											onPress={() => {
												setIsModalOpen(false);
												setFormState(emptyForm);
												setEditingCategory(null);
											}}
										>
											取消
										</Button>
										<Button type="submit" variant="primary">
											{editingCategory ? "保存" : "新增"}
										</Button>
									</div>
								</Form>
							</Modal.Body>
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
								<AlertDialog.Heading>确认删除分类</AlertDialog.Heading>
							</AlertDialog.Header>
							<AlertDialog.Body>
								<p>
									删除 <strong>{deleteTarget?.category.name}</strong>{" "}
									后，其下的所有子分类和网站数据都将被永久删除，此操作不可撤销。
								</p>
							</AlertDialog.Body>
							<AlertDialog.Footer>
								<Button slot="close" variant="tertiary">
									取消
								</Button>
								<Button slot="close" variant="danger" onPress={handleDelete}>
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
