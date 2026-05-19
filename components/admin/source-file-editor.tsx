"use client";

import { useCallback, useEffect, useState } from "react";
import { Button, TextArea, toast } from "@heroui/react";
import { useSetAtom } from "jotai";
import { BiSave } from "react-icons/bi";
import { syncDataWithoutDirtyAtom } from "@/lib/store/admin";
import type { WebsiteData } from "@/types";

export function SourceFileEditor() {
	const [content, setContent] = useState("");
	const [originalContent, setOriginalContent] = useState("");
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const syncData = useSetAtom(syncDataWithoutDirtyAtom);

	const loadContent = useCallback(async () => {
		setLoading(true);
		try {
			const res = await fetch("/api/source-file");
			if (!res.ok) {
				const data = await res.json().catch(() => ({}));
				toast.danger(data.error || "加载失败");
				return;
			}
			const data = await res.json();
			const formatted = JSON.stringify(JSON.parse(data.content), null, 2);
			setContent(formatted);
			setOriginalContent(formatted);
		} catch {
			toast.danger("加载文件失败");
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		loadContent();
	}, [loadContent]);

	const isDirty = content !== originalContent;

	const handleSave = useCallback(async () => {
		let parsed: WebsiteData;
		try {
			parsed = JSON.parse(content);
		} catch (e) {
			toast.danger(`JSON 格式错误：${(e as Error).message}`);
			return;
		}
		setSaving(true);
		try {
			const res = await fetch("/api/source-file", {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ content }),
			});
			const data = await res.json();
			if (!res.ok) {
				toast.danger(data.error || "保存失败");
				return;
			}
			setOriginalContent(content);
			syncData({ websiteData: parsed });
			toast.success("已保存");
		} catch {
			toast.danger("保存失败");
		} finally {
			setSaving(false);
		}
	}, [content, syncData]);

	useEffect(() => {
		const handler = async (e: KeyboardEvent) => {
			if ((!e.ctrlKey && !e.metaKey) || e.key.toLowerCase() !== "s") return;
			e.preventDefault();
			e.stopPropagation();
			if (e.repeat || saving || !isDirty) return;
			await handleSave();
		};
		window.addEventListener("keydown", handler, true);
		return () => window.removeEventListener("keydown", handler, true);
	}, [handleSave, isDirty, saving]);

	if (loading) {
		return (
			<div className="flex items-center justify-center py-8 h-148">
				<span className="text-sm text-gray-500">加载中...</span>
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-4">
			<div className="flex items-center justify-between">
				<div>
					<h3 className="text-sm font-semibold text-gray-900 dark:text-neutral-100">
						编辑 website.json
					</h3>
					<p className="mt-1 text-xs text-gray-500 dark:text-neutral-400">
						直接编辑源文件内容，保存时会验证 JSON 格式
					</p>
				</div>
				<Button
					variant="primary"
					className="h-8 shrink-0"
					isDisabled={!isDirty || saving}
					isPending={saving}
					onPress={handleSave}
				>
					<BiSave className="size-4" />
					<span className="hidden sm:inline">
						{saving ? "保存中..." : isDirty ? "保存" : "已保存"}
					</span>
				</Button>
			</div>

			<TextArea
				value={content}
				onChange={(e) => setContent(e.target.value)}
				spellCheck={false}
				variant="secondary"
				className={"min-h-125"}
			/>
		</div>
	);
}
