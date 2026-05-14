"use client";

import {
	Button,
	ColorArea,
	ColorPicker,
	ColorSlider,
	ColorSwatch,
	ColorField,
	Input,
	Label,
	NumberField,
	parseColor,
	TextField,
} from "@heroui/react";
import { useRef, useState } from "react";
import { getIconImageSrc } from "@/lib/icon";
import { resolveConfiguredValue, toPx } from "../site-icon";

const TRANSPARENT_BG_COLOR = "rgba(255, 255, 255, 0)";
const WHITE_BG_COLOR = "#ffffff";
const DEFAULT_BG_COLOR = TRANSPARENT_BG_COLOR;

function parseSafeColor(value: string | undefined) {
	try {
		return parseColor(value?.trim() || DEFAULT_BG_COLOR);
	} catch {
		return parseColor(DEFAULT_BG_COLOR);
	}
}

/**
 * 图标输入框：支持直接输入 URL / emoji，或点击按钮上传图片。
 * 上传成功后自动填入 URL 到字段。
 */
export function IconPicker({
	value,
	onChange,
	bgColor,
	onBgColorChange,
	iconPadding,
	defaultIconPadding,
	onIconPaddingChange,
	placeholder = "URL / emoji / 留空",
}: {
	value: string | undefined;
	onChange: (v: string) => void;
	bgColor?: string;
	onBgColorChange?: (v: string) => void;
	iconPadding?: string;
	defaultIconPadding?: string;
	onIconPaddingChange?: (v: string) => void;
	placeholder?: string;
}) {
	const fileRef = useRef<HTMLInputElement>(null);
	const [uploading, setUploading] = useState(false);
	const [err, setErr] = useState<string | null>(null);
	const resolvedIconPadding = resolveConfiguredValue(
		iconPadding,
		defaultIconPadding,
	);
	const parsedIconPadding =
		resolvedIconPadding ? Number.parseFloat(resolvedIconPadding) : undefined;
	const pickerColor = parseSafeColor(bgColor);

	const onFileChosen = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const f = e.target.files?.[0];
		e.target.value = ""; // reset so same file can be reselected
		if (!f) return;
		setUploading(true);
		setErr(null);
		try {
			const fd = new FormData();
			fd.append("file", f);
			const res = await fetch("/api/upload", { method: "POST", body: fd });
			if (!res.ok) {
				const d = (await res.json().catch(() => ({}))) as { error?: string };
				throw new Error(d.error || `上传失败 (${res.status})`);
			}
			const d = (await res.json()) as { url: string };
			onChange(d.url);
		} catch (e) {
			setErr((e as Error).message);
		} finally {
			setUploading(false);
		}
	};

	const preview = (() => {
		if (!value) return null;
		const imageSrc = getIconImageSrc(value);
		if (!imageSrc)
			return <span className="text-xl leading-none text-center">{value}</span>;
		// eslint-disable-next-line @next/next/no-img-element
		return <img src={imageSrc} alt="" className="h-6 w-6 rounded object-contain" />;
	})();

	return (
		<div className="flex flex-col gap-1">
			<div className="flex items-center gap-2">
				<div
					className="flex h-9 w-9 shrink-0 items-center justify-center rounded border"
					style={{
						backgroundColor: bgColor || undefined,
						padding: toPx(resolvedIconPadding) || undefined,
					}}
				>
					{preview ?? <span className="text-xs text-muted">空</span>}
				</div>
				<TextField className="flex-1" value={value ?? ""} onChange={onChange}>
					<Label className="sr-only">图标</Label>
					<Input placeholder={placeholder} />
				</TextField>
				<Button
					type="button"
					variant="outline"
					size="sm"
					isDisabled={uploading}
					onPress={() => fileRef.current?.click()}
				>
					{uploading ? "上传中..." : "上传"}
				</Button>
				{onIconPaddingChange && (
					<NumberField
						value={parsedIconPadding}
						onChange={(v) => onIconPaddingChange(v == null ? "" : String(v))}
						minValue={0}
						maxValue={20}
					>
						<Label className="sr-only">图标内边距</Label>
						<NumberField.Group>
							<NumberField.DecrementButton />
							<NumberField.Input className="w-10" />
							<NumberField.IncrementButton />
						</NumberField.Group>
					</NumberField>
				)}
				{onBgColorChange && (
					<ColorPicker
						value={pickerColor}
						onChange={(c) => onBgColorChange(c.toString("css"))}
					>
						<ColorPicker.Trigger>
							<ColorSwatch color={pickerColor} size="sm" />
						</ColorPicker.Trigger>
						<ColorPicker.Popover className="gap-2">
							<div className="grid grid-cols-2 gap-2 px-1 *:w-full!">
								<Button
									type="button"
									size="sm"
									variant="secondary"
									onPress={() => onBgColorChange(TRANSPARENT_BG_COLOR)}
								>
									透明
								</Button>
								<Button
									type="button"
									size="sm"
									variant="secondary"
									onPress={() => onBgColorChange(WHITE_BG_COLOR)}
								>
									白色
								</Button>
							</div>
							<ColorArea
								aria-label="Color area"
								className="max-w-full"
								colorSpace="hsb"
								xChannel="saturation"
								yChannel="brightness"
							>
								<ColorArea.Thumb />
							</ColorArea>
							<ColorSlider
								channel="hue"
								className="gap-1 px-1"
								colorSpace="hsb"
							>
								<ColorSlider.Track>
									<ColorSlider.Thumb />
								</ColorSlider.Track>
							</ColorSlider>
							<ColorSlider
								aria-label="透明度"
								channel="alpha"
								className="gap-1 px-1"
							>
								<Label className="text-xs text-muted">透明度</Label>
								<ColorSlider.Track>
									<ColorSlider.Thumb />
								</ColorSlider.Track>
							</ColorSlider>
							<ColorField aria-label="背景色">
								<ColorField.Group variant="secondary">
									<ColorField.Prefix>
										<ColorSwatch color={pickerColor} size="xs" />
									</ColorField.Prefix>
									<ColorField.Input />
								</ColorField.Group>
							</ColorField>
						</ColorPicker.Popover>
					</ColorPicker>
				)}
				<input
					ref={fileRef}
					type="file"
					accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml,image/x-icon,.ico,.svg"
					className="hidden"
					onChange={onFileChosen}
				/>
			</div>
			{err ? <span className="text-xs text-danger">{err}</span> : null}
		</div>
	);
}
