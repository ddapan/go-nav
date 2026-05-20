"use client";

import {
	Button,
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
	Spinner,
	toast,
	cn,
} from "@heroui/react";
import {
	DndContext,
	DragOverlay,
	KeyboardSensor,
	PointerSensor,
	TouchSensor,
	closestCenter,
	pointerWithin,
	useDroppable,
	useSensor,
	useSensors,
} from "@dnd-kit/core";
import type {
	CollisionDetection,
	DragOverEvent,
	DragEndEvent,
	DragStartEvent,
} from "@dnd-kit/core";
import {
	SortableContext,
	arrayMove,
	sortableKeyboardCoordinates,
	useSortable,
	verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { memo, useEffect, useState, useMemo } from "react";
import type React from "react";
import { createPortal } from "react-dom";
import {
	BiPlus,
	BiEdit,
	BiTrash,
	BiChevronUp,
	BiChevronDown,
	BiDotsVerticalRounded,
} from "react-icons/bi";
import type { NavCategory } from "@/types";
import { useAtom } from "jotai";
import { categoriesAtom } from "@/lib/store/admin";
import { getIconImageSrc } from "@/lib/icon";
import { IconPicker } from "./icon-picker";

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

interface CategoryDragData {
	type: "category";
	categoryId: string;
	parentId: string | null;
	canHostChildren: boolean;
}

interface CategoryContainerData {
	type: "category-container";
	parentId: string | null;
}

const getCategorySortableId = (categoryId: string) => `category:${categoryId}`;

const getCategoryContainerId = (parentId: string | null) =>
	parentId ? `category-container:${parentId}` : "category-container:root";

const parentRowGridCols = "minmax(0,15rem) 12rem minmax(0,1fr) 12.5rem";
const childRowGridCols = "minmax(0,12rem) 12rem minmax(0,1fr) 12.5rem";

const pointerWithinOrClosestCenter: CollisionDetection = (args) => {
	const pointerCollisions = pointerWithin(args);
	const rowCollisions = pointerCollisions.filter(({ id }) =>
		String(id).startsWith("category:"),
	);
	if (rowCollisions.length > 0) return rowCollisions;
	return pointerCollisions.length > 0 ? pointerCollisions : closestCenter(args);
};

function CategoryDropContainer({
	parentId,
	isRoot = false,
	isCrossParentDrag = false,
	isDragOver = false,
	children,
}: {
	parentId: string | null;
	isRoot?: boolean;
	isCrossParentDrag?: boolean;
	isDragOver?: boolean;
	children: React.ReactNode;
}) {
	const { setNodeRef, isOver } = useDroppable({
		id: getCategoryContainerId(parentId),
		disabled: !isCrossParentDrag,
		data: {
			type: "category-container",
			parentId,
		} satisfies CategoryContainerData,
	});

	return (
		<div
			ref={setNodeRef}
			className={cn(
				"flex flex-col gap-2 transition-colors",
				isRoot
					? "p-2"
					: "ml-8 border-l border-dashed border-default-300 pl-4 pt-2 pb-3",
				isCrossParentDrag && (isOver || isDragOver)
					? "bg-blue-50/70 dark:bg-blue-950/30"
					: "",
			)}
		>
			{children}
		</div>
	);
}

function CategoryDragPreview({
	rowHtml,
	rowWidth,
}: {
	rowHtml: string;
	rowWidth: number;
}) {
	return (
		<div className="pointer-events-none" style={{ width: rowWidth }}>
			{/*
				Sortable row itself is a div-based grid, so direct HTML clone keeps
				column sizing and spacing identical to source row.
			*/}
			<div dangerouslySetInnerHTML={{ __html: rowHtml }} />
		</div>
	);
}

const SortableCategoryRow = memo(function SortableCategoryRow({
	category,
	siblings,
	parentId,
	path,
	depth,
	onMove,
	onEdit,
	onAddChild,
	onDelete,
	registerRowElement,
	children,
}: {
	category: NavCategory;
	siblings: NavCategory[];
	parentId: string | null;
	path: string[];
	depth: number;
	onMove: (categoryId: string, direction: "up" | "down") => void;
	onEdit: (category: NavCategory, path: string[]) => void;
	onAddChild: (parentId: string) => void;
	onDelete: (categoryId: string) => void;
	registerRowElement: (id: string, el: HTMLElement | null) => void;
	children?: React.ReactNode;
}) {
	const siteCount = category.sites?.length ?? 0;
	const canAddChild = siteCount === 0;
	const sortableId = getCategorySortableId(category.id);
	const siblingIdx = siblings.findIndex((c) => c.id === category.id);
	const siblingCount = siblings.length;
	const isFirst = siblingIdx <= 0;
	const isLast = siblingIdx >= siblingCount - 1;
	const { attributes, listeners, setNodeRef, transform, isDragging } =
		useSortable({
			id: sortableId,
			data: {
				type: "category",
				categoryId: category.id,
				parentId,
				canHostChildren: canAddChild,
			} satisfies CategoryDragData,
		});

	const style: React.CSSProperties = {
		transform: CSS.Transform.toString(transform),
		transition: undefined,
		opacity: isDragging ? 0 : 1,
		position: "relative",
		zIndex: isDragging ? 1 : undefined,
	};

	const renderIcon = () => {
		const icon = category.icon;
		if (!icon) return <span className="h-5 w-5" aria-hidden />;
		const iconSrc = getIconImageSrc(icon);
		if (iconSrc) {
			return (
				// eslint-disable-next-line @next/next/no-img-element
				<img
					src={iconSrc}
					alt=""
					className="h-5 w-5 rounded object-contain"
					loading="lazy"
				/>
			);
		}
		return <span className="w-5 text-center text-lg">{icon}</span>;
	};

	return (
		<div
			ref={(node) => {
				setNodeRef(node);
				registerRowElement(sortableId, node);
			}}
			style={style}
			className="flex flex-col gap-2"
		>
			<div
				className="grid w-full min-w-0 items-center gap-3 rounded-xl border border-default bg-background px-5 py-2.5 text-sm"
				style={{
					gridTemplateColumns: depth > 0 ? childRowGridCols : parentRowGridCols,
				}}
			>
				<div className="flex min-w-0 items-center gap-2">
					<span
						{...attributes}
						{...listeners}
						className="inline-flex size-6 shrink-0 cursor-grab touch-none items-center justify-center rounded text-default-400 transition hover:bg-default/40 hover:text-default-700 active:cursor-grabbing"
						aria-label="拖拽排序"
						style={{ touchAction: "none" }}
					>
						<BiDotsVerticalRounded className="size-4" />
					</span>
					{renderIcon()}
					<span className="truncate font-medium">{category.name}</span>
				</div>
				<div className="min-w-0">
					<code className="rounded bg-default/20 px-1.5 py-0.5 text-xs font-mono">
						{category.id}
					</code>
				</div>
				<div className="min-w-0 truncate text-default-500">
					{category.description || "-"}
				</div>
				<div className="min-w-0 overflow-hidden">
					<div className="flex items-center justify-start gap-1">
						<Button
							isIconOnly
							size="sm"
							variant="outline"
							className="h-9 w-9"
							aria-label="上移"
							isDisabled={isFirst}
							onPress={() => onMove(category.id, "up")}
						>
							<BiChevronUp />
						</Button>
						<Button
							isIconOnly
							size="sm"
							variant="outline"
							className="h-9 w-9"
							aria-label="下移"
							isDisabled={isLast}
							onPress={() => onMove(category.id, "down")}
						>
							<BiChevronDown />
						</Button>
						<Button
							isIconOnly
							size="sm"
							variant="outline"
							className="h-9 w-9"
							aria-label="编辑"
							onPress={() => onEdit(category, path)}
						>
							<BiEdit />
						</Button>
						{canAddChild && (
							<Button
								isIconOnly
								size="sm"
								variant="outline"
								className="h-9 w-9"
								aria-label="添加子分类"
								onPress={() => onAddChild(category.id)}
							>
								<BiPlus />
							</Button>
						)}
						<Button
							isIconOnly
							size="sm"
							variant="outline"
							className="h-9 w-9 text-danger"
							aria-label="删除"
							onPress={() => onDelete(category.id)}
						>
							<BiTrash />
						</Button>
					</div>
				</div>
			</div>
			{children}
		</div>
	);
});

export function CategoriesEditor() {
	const [categories, setCategories] = useAtom(categoriesAtom);
	const value = { categories };
	const onChange = (v: { categories: NavCategory[] }) =>
		setCategories(v.categories);
	const [isClientReady, setIsClientReady] = useState(false);
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
	const [activeRowSnapshot, setActiveRowSnapshot] = useState<{
		html: string;
		width: number;
	} | null>(null);
	const [activeDragParentId, setActiveDragParentId] = useState<string | null>(
		null,
	);
	const [activeDragIsChild, setActiveDragIsChild] = useState(false);
	const [dragOverParentId, setDragOverParentId] = useState<string | null>(null);
	const rowElementMapRef = useState(() => new Map<string, HTMLElement>())[0];
	const registerRowElement = (id: string, el: HTMLElement | null) => {
		if (!el) {
			rowElementMapRef.delete(id);
			return;
		}
		rowElementMapRef.set(id, el);
	};
	const sensors = useSensors(
		useSensor(TouchSensor, {
			activationConstraint: { delay: 180, tolerance: 8 },
		}),
		useSensor(PointerSensor, {
			activationConstraint: { distance: 6 },
		}),
		useSensor(KeyboardSensor, {
			coordinateGetter: sortableKeyboardCoordinates,
		}),
	);

	useEffect(() => {
		setIsClientReady(true);
	}, []);

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

	const categoryPathMap = useMemo(() => {
		const map = new Map<string, string[]>();
		for (const item of flatCategories) {
			map.set(item.category.id, item.path);
		}
		return map;
	}, [flatCategories]);

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

	if (!isClientReady) {
		return (
			<div
				className="flex flex-col items-center justify-center gap-2"
				style={{
					height: `calc(100dvh - 106px)`,
				}}
			>
				<Spinner size="sm" />
				<span className="text-xs text-default-500">加载中...</span>
			</div>
		);
	}

	const findCategoryPath = (
		targetId: string,
	): { category: NavCategory; path: string[] } | null => {
		const indexedPath = categoryPathMap.get(targetId);
		if (indexedPath) {
			const category = indexedPath.reduce<NavCategory | null>(
				(current, id, idx) => {
					if (idx === 0) {
						return value.categories.find((c) => c.id === id) ?? null;
					}
					return current?.children?.find((c) => c.id === id) ?? null;
				},
				null,
			);
			if (category) return { category, path: indexedPath };
		}
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

	const getChildrenByParentId = (
		cats: NavCategory[],
		parentId: string | null,
	): NavCategory[] => {
		if (parentId === null) return cats;
		const findById = (items: NavCategory[]): NavCategory | null => {
			for (const item of items) {
				if (item.id === parentId) return item;
				if (item.children?.length) {
					const found = findById(item.children);
					if (found) return found;
				}
			}
			return null;
		};
		return findById(cats)?.children ?? [];
	};

	const canCategoryHostChildren = (categoryId: string) => {
		const category = findCategoryPath(categoryId)?.category;
		return (category?.sites?.length ?? 0) === 0;
	};

	const getInsertionIndexInParent = (
		parentId: string | null,
		event: DragEndEvent,
		activeCategoryId?: string,
	) => {
		const siblings = getChildrenByParentId(value.categories, parentId).filter(
			(item) => item.id !== activeCategoryId,
		);
		if (siblings.length === 0) return 0;
		const activeRect = event.active.rect.current.translated;
		if (!activeRect) return siblings.length;
		const activeCenterY = activeRect.top + activeRect.height / 2;
		for (let index = 0; index < siblings.length; index++) {
			const sibling = siblings[index];
			const rowEl = rowElementMapRef.get(getCategorySortableId(sibling.id));
			if (!rowEl) continue;
			const rect = rowEl.getBoundingClientRect();
			if (activeCenterY < rect.top + rect.height / 2) {
				return index;
			}
		}
		return siblings.length;
	};

	const updateChildrenByParentId = (
		cats: NavCategory[],
		parentId: string | null,
		updater: (children: NavCategory[]) => NavCategory[],
	): NavCategory[] => {
		if (parentId === null) return updater(cats);
		let didUpdate = false;
		const next = cats.map((cat) => {
			if (cat.id === parentId) {
				didUpdate = true;
				return { ...cat, children: updater(cat.children ?? []) };
			}
			if (cat.children?.length) {
				const nextChildren = updateChildrenByParentId(
					cat.children,
					parentId,
					updater,
				);
				if (nextChildren !== cat.children) {
					didUpdate = true;
					return { ...cat, children: nextChildren };
				}
			}
			return cat;
		});
		return didUpdate ? next : cats;
	};

	const isDescendantCategory = (ancestorId: string, targetId: string) => {
		const ancestor = findCategoryPath(ancestorId)?.category;
		if (!ancestor?.children?.length) return false;
		const walk = (cats: NavCategory[]): boolean => {
			for (const cat of cats) {
				if (cat.id === targetId) return true;
				if (cat.children?.length && walk(cat.children)) return true;
			}
			return false;
		};
		return walk(ancestor.children);
	};

	const moveCategory = (categoryId: string, direction: "up" | "down") => {
		const target = findCategoryPath(categoryId);
		if (!target) return;
		const parentId =
			target.path.length > 1 ? target.path[target.path.length - 2] : null;
		const siblings = getChildrenByParentId(value.categories, parentId);
		const index = siblings.findIndex((c) => c.id === categoryId);
		const newIndex = direction === "up" ? index - 1 : index + 1;
		if (index < 0 || newIndex < 0 || newIndex >= siblings.length) return;
		const newCategories = updateChildrenByParentId(
			value.categories,
			parentId,
			(children) => arrayMove(children, index, newIndex),
		);
		onChange({ ...value, categories: newCategories });
	};

	const handleCategoryDragStart = (event: DragStartEvent) => {
		const data = event.active.data.current as CategoryDragData | undefined;
		setActiveDragParentId(data?.type === "category" ? data.parentId : null);
		setActiveDragIsChild(
			data?.type === "category" ? data.parentId !== null : false,
		);
		setDragOverParentId(null);
		const rowElement = rowElementMapRef.get(String(event.active.id));
		if (!rowElement) {
			setActiveRowSnapshot(null);
			return;
		}
		const rect = rowElement.getBoundingClientRect();
		const clone = rowElement.cloneNode(true) as HTMLElement;
		clone.style.opacity = "1";
		clone.style.transform = "none";
		clone.style.transition = "none";
		setActiveRowSnapshot({
			html: clone.outerHTML,
			width: rect.width,
		});
	};

	const handleCategoryDragOver = (event: DragOverEvent) => {
		const activeData = event.active.data.current as
			| CategoryDragData
			| undefined;
		const overData = event.over?.data.current as
			| CategoryDragData
			| CategoryContainerData
			| undefined;
		if (!activeData || activeData.type !== "category" || !overData) {
			setDragOverParentId(null);
			return;
		}
		if (overData.type === "category-container") {
			setDragOverParentId(overData.parentId);
			return;
		}
		const overPath = findCategoryPath(overData.categoryId)?.path;
		if (!overPath) {
			setDragOverParentId(null);
			return;
		}
		const overParentId =
			overPath.length > 1 ? overPath[overPath.length - 2] : null;
		if (
			activeData.parentId !== null &&
			overPath.length === 1 &&
			overData.canHostChildren &&
			overData.categoryId !== activeData.categoryId &&
			overParentId !== activeData.parentId
		) {
			setDragOverParentId(overData.categoryId);
			return;
		}
		setDragOverParentId(overParentId);
	};

	const handleCategoryDragEnd = (event: DragEndEvent) => {
		setActiveRowSnapshot(null);
		setActiveDragParentId(null);
		setActiveDragIsChild(false);
		setDragOverParentId(null);
		const activeData = event.active.data.current as
			| CategoryDragData
			| undefined;
		const overData = event.over?.data.current as
			| CategoryDragData
			| CategoryContainerData
			| undefined;
		if (!activeData || activeData.type !== "category" || !overData) return;
		const activePath = findCategoryPath(activeData.categoryId)?.path;
		if (!activePath) return;
		const sourceParentId =
			activePath.length > 1 ? activePath[activePath.length - 2] : null;
		const sourceSiblings = getChildrenByParentId(
			value.categories,
			sourceParentId,
		);
		const sourceIndex = sourceSiblings.findIndex(
			(c) => c.id === activeData.categoryId,
		);
		if (sourceIndex < 0) return;

		let targetParentId: string | null | undefined;
		let targetIndex: number | undefined;

		if (overData.type === "category") {
			if (overData.categoryId === activeData.categoryId) return;
			const overPath = findCategoryPath(overData.categoryId)?.path;
			if (!overPath) return;
			const overParentId =
				overPath.length > 1 ? overPath[overPath.length - 2] : null;
			if (sourceParentId !== overParentId) {
				// Cross-parent move:
				// 1) Allow dropping on a top-level parent row (target becomes that parent)
				// 2) Allow dropping on a child row under another parent
				if (
					sourceParentId !== null &&
					overPath.length === 1 &&
					overData.canHostChildren
				) {
					targetParentId = overData.categoryId;
					targetIndex = getInsertionIndexInParent(targetParentId, event);
				} else if (sourceParentId !== null && overParentId !== null) {
					targetParentId = overParentId;
					targetIndex = getInsertionIndexInParent(targetParentId, event);
				} else {
					return;
				}
			} else {
				const siblings = getChildrenByParentId(
					value.categories,
					sourceParentId,
				);
				const fromIndex = siblings.findIndex(
					(c) => c.id === activeData.categoryId,
				);
				const toIndex = siblings.findIndex((c) => c.id === overData.categoryId);
				if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return;
				const nextCategories = updateChildrenByParentId(
					value.categories,
					sourceParentId,
					(children) => arrayMove(children, fromIndex, toIndex),
				);
				onChange({ ...value, categories: nextCategories });
				return;
			}
		}

		if (overData.type === "category-container") {
			targetParentId = overData.parentId;
			if (targetParentId === sourceParentId) {
				return;
			}
			targetIndex = getInsertionIndexInParent(
				targetParentId,
				event,
				sourceParentId === targetParentId ? activeData.categoryId : undefined,
			);
		}

		if (targetParentId === undefined || targetIndex === undefined) return;

		if (sourceParentId === targetParentId) {
			const sourceItem = sourceSiblings[sourceIndex];
			const siblingsWithoutSource = sourceSiblings.filter(
				(c) => c.id !== activeData.categoryId,
			);
			const insertionIndex = Math.max(
				0,
				Math.min(targetIndex, siblingsWithoutSource.length),
			);
			const nextSiblings = [
				...siblingsWithoutSource.slice(0, insertionIndex),
				sourceItem,
				...siblingsWithoutSource.slice(insertionIndex),
			];
			const changed = nextSiblings.some(
				(item, idx) => item.id !== sourceSiblings[idx]?.id,
			);
			if (!changed) return;
			const newCategories = updateChildrenByParentId(
				value.categories,
				sourceParentId,
				() => nextSiblings,
			);
			onChange({ ...value, categories: newCategories });
			return;
		}

		if (sourceParentId === null && targetParentId !== null) {
			toast.warning("父级分类只能在父级分类之间排序");
			return;
		}
		if (sourceParentId !== null && targetParentId === null) {
			toast.warning("子分类不能拖成父级分类");
			return;
		}
		if (
			targetParentId === activeData.categoryId ||
			(targetParentId !== null &&
				isDescendantCategory(activeData.categoryId, targetParentId))
		) {
			toast.warning("不能把分类移动到自己的下级分类中");
			return;
		}
		if (targetParentId !== null && !canCategoryHostChildren(targetParentId)) {
			toast.warning("目标分类下已有网址，不能再作为父级分类");
			return;
		}

		if (sourceSiblings.length <= 1) {
			toast.warning("无法移动", {
				description: "每个父级分类至少需要保留一个子分类",
			});
			return;
		}

		const movingCategory = sourceSiblings[sourceIndex];
		let nextCategories = updateChildrenByParentId(
			value.categories,
			sourceParentId,
			(children) => children.filter((c) => c.id !== activeData.categoryId),
		);
		nextCategories = updateChildrenByParentId(
			nextCategories,
			targetParentId,
			(children) => {
				const safeTargetIndex = Math.min(targetIndex, children.length);
				return [
					...children.slice(0, safeTargetIndex),
					movingCategory,
					...children.slice(safeTargetIndex),
				];
			},
		);
		onChange({ ...value, categories: nextCategories });
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

	const renderCategoryList = (
		items: NavCategory[],
		parentId: string | null,
		depth: number,
	) => {
		const sortableIds = items.map((category) =>
			getCategorySortableId(category.id),
		);
		return (
			<SortableContext
				items={sortableIds}
				strategy={verticalListSortingStrategy}
			>
				<CategoryDropContainer
					parentId={parentId}
					isRoot={parentId === null}
					isCrossParentDrag={
						activeDragParentId !== null &&
						activeDragParentId !== parentId &&
						!(activeDragIsChild && parentId === null)
					}
					isDragOver={dragOverParentId === parentId}
				>
					{items.map((category) => {
						const categoryPath = findCategoryPath(category.id);
						const currentPath = categoryPath?.path ?? [category.id];
						return (
							<SortableCategoryRow
								key={category.id}
								category={category}
								siblings={items}
								parentId={parentId}
								path={currentPath}
								depth={depth}
								onMove={moveCategory}
								onEdit={handleOpenEdit}
								onAddChild={handleOpenAdd}
								onDelete={(categoryId) => {
									const target = findCategoryPath(categoryId);
									if (target) setDeleteTarget(target);
								}}
								registerRowElement={registerRowElement}
							>
								{(category.children?.length ?? 0) > 0
									? renderCategoryList(
											category.children ?? [],
											category.id,
											depth + 1,
										)
									: null}
							</SortableCategoryRow>
						);
					})}
				</CategoryDropContainer>
			</SortableContext>
		);
	};

	return (
		<div
			className="flex flex-col gap-4"
			style={{
				minHeight: `calc(100dvh - 106px)`,
			}}
		>
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
				<Button
					variant="primary"
					size="sm"
					onPress={() => handleOpenAdd(null)}
					className={"h-9"}
				>
					<BiPlus data-icon="inline-start" />
					新增分类
				</Button>
			</div>

			<DndContext
				sensors={sensors}
				collisionDetection={pointerWithinOrClosestCenter}
				onDragStart={handleCategoryDragStart}
				onDragOver={handleCategoryDragOver}
				onDragEnd={handleCategoryDragEnd}
				onDragCancel={() => {
					setActiveRowSnapshot(null);
					setActiveDragParentId(null);
					setActiveDragIsChild(false);
					setDragOverParentId(null);
				}}
			>
				<div className="overflow-x-auto rounded-xl border border-default bg-default/10">
					<div className="min-w-280">
						<div
							className="grid min-w-280 items-center gap-4 border-b border-default px-5 py-3 text-xs font-medium text-default-500"
							style={{ gridTemplateColumns: parentRowGridCols }}
						>
							<div>分类名称</div>
							<div>ID</div>
							<div>描述</div>
							<div className="text-left">操作</div>
						</div>
						{value.categories.length === 0 ? (
							<div className="py-12 text-center text-sm">
								暂无分类，点击右上角新增
							</div>
						) : (
							renderCategoryList(value.categories, null, 0)
						)}
					</div>
				</div>
				{createPortal(
					<DragOverlay dropAnimation={null}>
						{activeRowSnapshot ? (
							<CategoryDragPreview
								rowHtml={activeRowSnapshot.html}
								rowWidth={activeRowSnapshot.width}
							/>
						) : null}
					</DragOverlay>,
					document.body,
				)}
			</DndContext>

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
