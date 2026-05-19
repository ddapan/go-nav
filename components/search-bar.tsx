"use client";

import type { Key } from "@heroui/react";
import { EmptyState, Label, ListBox, SearchField, Select } from "@heroui/react";
import {
	useCallback,
	useDeferredValue,
	useEffect,
	useMemo,
	useRef,
	useState,
	useTransition,
} from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import type { LayoutConfig, NavSite, SearchEngine } from "@/types";
import { recordVisit } from "@/hooks/use-recent-visits";
import { openSiteWithPreference } from "@/lib/client/site-link";
import { getIconImageSrc } from "@/lib/icon";
import { SiteIcon } from "./site-icon";
import fetchJsonp from "fetch-jsonp";

interface SuggestionItem {
	label: string;
	key: number;
}

interface BaiduSuggestionResponse {
	s?: unknown[];
}

const EMPTY_SUGGESTIONS: SuggestionItem[] = [];

export function SearchBar({
	engines,
	defaultEngine,
	enableLocal,
	enableSuggestion = false,
	enableTabFocus = true,
	placeholder,
	sites,
	onNavigate,
	engineId: externalEngineId,
	onEngineChange,
	showEngineSelector = true,
	layout,
}: {
	engines: SearchEngine[];
	defaultEngine: string;
	enableLocal: boolean;
	enableSuggestion?: boolean;
	enableTabFocus?: boolean;
	placeholder: string;
	sites: Array<NavSite & { categoryId: string; categoryName: string }>;
	onNavigate?: (categoryId: string) => void;
	engineId?: Key | null;
	onEngineChange?: (id: Key | null) => void;
	showEngineSelector?: boolean;
	layout?: Pick<
		LayoutConfig,
		"defaultIconPadding" | "iconBorderRadius" | "linkTarget" | "autoUseIntranet"
	>;
}) {
	const engineOptions = useMemo(() => {
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
	}, [engines, enableLocal]);

	const [internalEngineId, setInternalEngineId] = useState<Key | null>(
		engineOptions.find((e) => e.id === defaultEngine)?.id ??
			engineOptions[0]?.id ??
			null,
	);

	const engineId = externalEngineId ?? internalEngineId;

	const setEngineId = useCallback((id: Key | null) => {
		if (onEngineChange) {
			if (id !== null) onEngineChange(id);
		} else {
			setInternalEngineId(id);
		}
	}, [onEngineChange]);
	const [query, setQuery] = useState("");
	const [isOpen, setIsOpen] = useState(false);
	const [activeIndex, setActiveIndex] = useState(-1);
	const [suggestions, setSuggestions] = useState<SuggestionItem[]>(EMPTY_SUGGESTIONS);
	const [, startTransition] = useTransition();
	const containerRef = useRef<HTMLDivElement>(null);
	const inputWrapRef = useRef<HTMLDivElement>(null);
	const inputRef = useRef<HTMLInputElement>(null);
	const suggestionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const suggestionRequestRef = useRef(0);
	const [dropdownMaxH, setDropdownMaxH] = useState<string>("20rem");

	// 动态计算下拉面板可用高度（模拟 react-aria Popover 的行为）
	const lastMaxHRef = useRef<string>("20rem");
	const recalcMaxH = useCallback(() => {
		if (!containerRef.current) return;
		const rect = containerRef.current.getBoundingClientRect();
		const viewportH = window.innerHeight;
		// 面板顶部 = 输入框底部 + 6px 间距
		const available = viewportH - rect.bottom - 12; // 12px 底部安全边距
		const clamped = Math.max(120, Math.min(available, 320)); // 最小120px，最大320px
		const next = `${clamped}px`;
		// 值未变则跳过 setState，避免高频滚动时触发无效 render
		if (next === lastMaxHRef.current) return;
		lastMaxHRef.current = next;
		setDropdownMaxH(next);
	}, []);

	const isLocal = engineId === "local";

	// 预建小写索引，避免每次按键都对全量 sites 重复 toLowerCase / 多字段拼接。
	// 懒构建：仅在启用本地搜索时才构建；sites 引用稳定时只跑一次。
	const searchIndex = useMemo(() => {
		if (!enableLocal)
			return [] as Array<{
				site: (typeof sites)[number];
				hay: string;
			}>;
		const out = new Array<{ site: (typeof sites)[number]; hay: string }>(
			sites.length,
		);
		for (let i = 0; i < sites.length; i++) {
			const s = sites[i];
			out[i] = {
				site: s,
				hay: (
					(s.title ?? "") +
					"\u0001" +
					(s.description ?? "") +
					"\u0001" +
					(s.url ?? "") +
					"\u0001" +
					(s.tags ? s.tags.join(" ") : "") +
					"\u0001" +
					(s.categoryName ?? "")
				).toLowerCase(),
			};
		}
		return out;
	}, [enableLocal, sites]);

	// useDeferredValue 让高频输入不阻塞 UI，React 会用较低优先级重算 results
	const deferredQuery = useDeferredValue(query);

	const results = useMemo(() => {
		if (!isLocal) return [];
		const q = deferredQuery.trim().toLowerCase();
		if (!q) return [];
		const out: Array<(typeof sites)[number]> = [];
		for (let i = 0; i < searchIndex.length; i++) {
			if (searchIndex[i].hay.includes(q)) {
				out.push(searchIndex[i].site);
				if (out.length >= 10) break;
			}
		}
		return out;
	}, [isLocal, deferredQuery, searchIndex]);

	const showLocalResults = isLocal && isOpen && query.trim().length > 0;
	const showSuggestions =
		!isLocal &&
		enableSuggestion &&
		isOpen &&
		suggestions.length > 0 &&
		query.trim().length > 0;
	const keyboardItemCount = isLocal ? results.length : suggestions.length;

	useEffect(() => {
		if (!query.trim() || keyboardItemCount === 0) {
			setActiveIndex(-1);
			return;
		}
		setActiveIndex(0);
	}, [isLocal, keyboardItemCount, query]);

	useEffect(() => {
		if (activeIndex < 0 || (!showLocalResults && !showSuggestions)) return;
		const el = containerRef.current?.querySelector<HTMLElement>(
			`[data-keyboard-index="${activeIndex}"]`,
		);
		el?.scrollIntoView({ block: "nearest" });
	}, [activeIndex, showLocalResults, showSuggestions]);

	// 面板打开时计算可用高度，并监听 resize/scroll（rAF 节流）
	useEffect(() => {
		if (!isOpen) return;
		recalcMaxH();
		let ticking = false;
		const onScrollOrResize = () => {
			if (ticking) return;
			ticking = true;
			requestAnimationFrame(() => {
				recalcMaxH();
				ticking = false;
			});
		};
		window.addEventListener("resize", onScrollOrResize);
		window.addEventListener("scroll", onScrollOrResize, true);
		return () => {
			window.removeEventListener("resize", onScrollOrResize);
			window.removeEventListener("scroll", onScrollOrResize, true);
		};
	}, [isOpen, recalcMaxH]);

	// 百度联想词请求
	useEffect(() => {
		if (isLocal || !enableSuggestion || !query.trim()) {
			suggestionRequestRef.current += 1;
			setSuggestions((prev) =>
				prev.length === 0 ? prev : EMPTY_SUGGESTIONS,
			);
			return;
		}

		if (suggestionTimerRef.current) {
			clearTimeout(suggestionTimerRef.current);
		}

		const requestId = suggestionRequestRef.current + 1;
		suggestionRequestRef.current = requestId;
		suggestionTimerRef.current = setTimeout(() => {
			const content = query.trim();
			const api = `https://suggestion.baidu.com/su?wd=${encodeURIComponent(content)}&ie=utf-8&p=3`;
			fetchJsonp(api, { jsonpCallback: "cb" })
				.then((response) => response.json())
				.then((data: BaiduSuggestionResponse) => {
					if (suggestionRequestRef.current !== requestId) return;
					const suggestion = (data.s ?? [])
						.filter((item): item is string => typeof item === "string")
						.slice(0, 10)
						.map((item, index) => ({
							label: item,
							key: index,
						}));
					startTransition(() => {
						setSuggestions(
							suggestion.length === 0 ? EMPTY_SUGGESTIONS : suggestion,
						);
					});
				})
				.catch(() => {
					if (suggestionRequestRef.current !== requestId) return;
					// 请求失败时清空联想词
					startTransition(() => {
						setSuggestions((prev) =>
							prev.length === 0 ? prev : EMPTY_SUGGESTIONS,
						);
					});
				});
		}, 300);

		return () => {
			if (suggestionTimerRef.current) {
				clearTimeout(suggestionTimerRef.current);
			}
		};
	}, [query, isLocal, enableSuggestion]);

	useEffect(() => {
		const handleClickOutside = (e: MouseEvent) => {
			if (
				containerRef.current &&
				!containerRef.current.contains(e.target as Node)
			) {
				setIsOpen(false);
			}
		};
		document.addEventListener("mousedown", handleClickOutside);
		return () => document.removeEventListener("mousedown", handleClickOutside);
	}, []);

	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			// Cmd/Ctrl + K 快捷键：始终会聚焦到搜索框
			if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
				e.preventDefault();
				e.stopImmediatePropagation();
				inputRef.current?.focus();
				return;
			}

			if (e.key !== "Tab") return;

			const active = document.activeElement;
			const isSearchInput = active === inputRef.current;

			if (isSearchInput) {
				// 焦点在搜索框内：Tab 用于在搜索引擎之间循环切换
				e.preventDefault();
				e.stopImmediatePropagation();
				const currentIndex = engineOptions.findIndex(
					(opt) => opt.id === engineId,
				);
				const nextIndex = e.shiftKey
					? currentIndex > 0
						? currentIndex - 1
						: engineOptions.length - 1
					: (currentIndex + 1) % engineOptions.length;
				setEngineId(engineOptions[nextIndex]?.id ?? null);
				return;
			}

			// 焦点在搜索区域内部的其它元素（如引擎 Select）时，不争抢 Tab。
			const isSearchArea = inputWrapRef.current?.contains(active) ?? false;
			if (isSearchArea) return;

			// 全局 Tab 聚焦：仅在配置开启时生效
			if (!enableTabFocus) return;

			// stopImmediatePropagation 同时阻断 window 上其他 capture 监听器（如 react-aria 的
			// ListBox/Select 可能在 capture 阶段转移焦点），保证我们的 focus 不被覆盖。
			e.preventDefault();
			e.stopImmediatePropagation();
			inputRef.current?.focus();
			// 同一 keydown 中 react-aria 仍可能在其他路径上使用合成事件转移焦点，
			// 用 rAF 兑现一次充当兑现，干净且可靠。
			requestAnimationFrame(() => {
				if (document.activeElement !== inputRef.current) {
					inputRef.current?.focus();
				}
			});
		};
		window.addEventListener("keydown", onKey, true);
		return () => window.removeEventListener("keydown", onKey, true);
	}, [engineId, engineOptions, enableTabFocus, setEngineId]);

	const runExternalSearch = (q: string) => {
		const engine = engines.find((e) => e.id === engineId);
		if (!engine) return;
		const url = engine.url.replace("{query}", encodeURIComponent(q));
		if (layout?.linkTarget === "current") {
			window.location.href = url;
		} else {
			window.open(url, "_blank", "noopener,noreferrer");
		}
	};

	const openLocalResult = (r: (typeof results)[number]) => {
		onNavigate?.(r.categoryId);
		recordVisit(r);
		void openSiteWithPreference(r, {
			linkTarget: layout?.linkTarget,
			autoUseIntranet: layout?.autoUseIntranet,
		});
		setIsOpen(false);
	};

	const openSuggestion = (item: SuggestionItem) => {
		setQuery(item.label);
		runExternalSearch(item.label);
		setIsOpen(false);
	};

	const handleSelect = (id: Key) => {
		if (!isLocal) return;
		const r = results.find((item) => `${item.categoryId}-${item.url}` === id);
		if (r) openLocalResult(r);
	};

	const handleSuggestionSelect = (id: Key) => {
		const item = suggestions.find((s) => String(s.key) === String(id));
		if (item) openSuggestion(item);
	};

	const handleInputKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
		if (e.nativeEvent.isComposing) return;
		if (e.key !== "ArrowDown" && e.key !== "ArrowUp" && e.key !== "Enter") {
			return;
		}

		const hasQuery = query.trim().length > 0;
		if (!hasQuery) return;

		if (e.key === "ArrowDown" || e.key === "ArrowUp") {
			if (keyboardItemCount === 0) return;
			e.preventDefault();
			setIsOpen(true);
			setActiveIndex((current) => {
				if (current < 0) return e.key === "ArrowDown" ? 0 : keyboardItemCount - 1;
				return e.key === "ArrowDown"
					? (current + 1) % keyboardItemCount
					: (current - 1 + keyboardItemCount) % keyboardItemCount;
			});
			return;
		}

		if (activeIndex < 0) return;
		if (isLocal) {
			const selected = results[activeIndex];
			if (!selected) return;
			e.preventDefault();
			openLocalResult(selected);
			return;
		}
		if (showSuggestions) {
			const selected = suggestions[activeIndex];
			if (!selected) return;
			e.preventDefault();
			openSuggestion(selected);
		}
	};

	const handleSubmit = (val: string) => {
		const q = val.trim();
		if (!q) return;
		if (isLocal) {
			if (results.length > 0) {
				openLocalResult(results[Math.max(activeIndex, 0)] ?? results[0]);
			}
		} else {
			runExternalSearch(q);
		}
	};

	return (
		<div ref={inputWrapRef} className="flex w-full items-center gap-2">
			{showEngineSelector && (
				<div
					className="hidden w-30 shrink-0 min-[480px]:block"
					onKeyDown={(e) => {
						if (e.key === "Enter" || e.key === " ") {
							e.preventDefault();
							const trigger = e.currentTarget.querySelector(
								"[role=combobox]",
							) as HTMLElement | null;
							trigger?.click();
						}
					}}
				>
					<Select
						aria-label="选择搜索引擎"
						className="w-full h-9"
						value={engineId}
						onChange={(v) => setEngineId(v)}
					>
						<Label className="sr-only">搜索引擎</Label>
						<Select.Trigger className="overflow-hidden">
							<Select.Value className="truncate" />
							<Select.Indicator />
						</Select.Trigger>
						<Select.Popover>
							<ListBox>
								{engineOptions.map((e) => {
									const iconSrc = getIconImageSrc(e.icon);
									return (
										<ListBox.Item key={e.id} id={e.id} textValue={e.name}>
											<span
												className="flex items-center gap-2"
												style={{
													maxWidth: "calc(100% - 16px)",
												}}
											>
												{e.icon ? (
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
															{e.icon}
														</span>
													)
												) : null}
												<span className="truncate">{e.name}</span>
											</span>
											<ListBox.ItemIndicator />
										</ListBox.Item>
									);
								})}
							</ListBox>
						</Select.Popover>
					</Select>
				</div>
			)}

			<div ref={containerRef} className="relative flex-1">
				<SearchField
					className="w-full"
					value={query}
					onChange={setQuery}
					onSubmit={handleSubmit}
					onClear={() => {
						setQuery("");
						setSuggestions((prev) =>
							prev.length === 0 ? prev : EMPTY_SUGGESTIONS,
						);
					}}
					onFocus={() => setIsOpen(true)}
				>
					<Label className="sr-only">搜索</Label>
					<SearchField.Group>
						<SearchField.SearchIcon />
						<SearchField.Input
							className={"w-0"}
							ref={inputRef}
							placeholder={placeholder}
							onKeyDown={handleInputKeyDown}
						/>
						<SearchField.ClearButton />
					</SearchField.Group>
				</SearchField>

				{/* 本地搜索结果面板 */}
				{showLocalResults && (
					<div
						className="select__popover absolute left-0 right-0 top-full z-50 mt-1.5 bg-(var(--background))"
						style={{
							animation: "slideDown 0.15s ease-out",
							maxHeight: dropdownMaxH,
						}}
					>
						<ListBox
							aria-label="搜索结果"
							onAction={handleSelect}
							className="overflow-y-auto p-1.5 overscroll-none"
							style={{ maxHeight: dropdownMaxH }}
							renderEmptyState={() => <EmptyState>未找到匹配的网站</EmptyState>}
						>
							{results.map((r, index) => {
								return (
									<ListBox.Item
										key={`${r.categoryId}-${r.url}`}
										id={`${r.categoryId}-${r.url}`}
										textValue={r.title}
										data-keyboard-index={index}
										className={`px-2.5 py-1.5 min-h-12 shrink-0 ${
											activeIndex === index ? "bg-default/70 text-foreground" : ""
										}`}
									>
										<SiteIcon
											site={r}
											layout={layout}
											size={24}
											className="text-[11px]!"
											textClassName="text-[11px]!"
											initialClassName="text-[10px]!"
										/>
										<div className="min-w-0 flex-1">
											<div className="flex items-center gap-1.5">
												<span className="truncate text-sm font-medium">
													{r.title}
												</span>
												<span className="shrink-0 rounded bg-default/80 px-1 py-px text-[10px]! font-medium text-muted leading-tight">
													{r.categoryName}
												</span>
											</div>
											<div className="truncate text-xs text-muted">
												{r.description}
											</div>
										</div>
										<ListBox.ItemIndicator />
									</ListBox.Item>
								);
							})}
						</ListBox>
					</div>
				)}

				{/* 联想词面板 */}
				{showSuggestions && (
					<div
						className="select__popover absolute left-0 right-0 top-full z-50 mt-1.5 bg-(var(--background))"
						style={{
							animation: "slideDown 0.15s ease-out",
							maxHeight: dropdownMaxH,
						}}
					>
						<ListBox
							aria-label="搜索建议"
							onAction={handleSuggestionSelect}
							className="overflow-y-auto p-1.5 overscroll-none"
							style={{ maxHeight: dropdownMaxH }}
						>
							{suggestions.map((s, index) => (
								<ListBox.Item
									key={s.key}
									id={String(s.key)}
									textValue={s.label}
									data-keyboard-index={index}
									className={`px-2.5 py-1.5 ${
										activeIndex === index ? "bg-default/70 text-foreground" : ""
									}`}
								>
									<svg
										className="w-3.5 h-3.5 shrink-0 text-muted"
										viewBox="0 0 16 16"
										fill="none"
										stroke="currentColor"
										strokeWidth="1.5"
									>
										<circle cx="6.5" cy="6.5" r="4.5" />
										<path d="M10 10l4 4" strokeLinecap="round" />
									</svg>
									<span className="truncate text-sm">{s.label}</span>
									<ListBox.ItemIndicator />
								</ListBox.Item>
							))}
						</ListBox>
					</div>
				)}
			</div>
		</div>
	);
}
