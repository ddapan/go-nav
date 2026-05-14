import type { CSSProperties } from "react";
import { getIconImageSrc } from "@/lib/icon";
import type { LayoutConfig, NavSite } from "@/types";

const BASE_ICON_SIZE = 40;

type IconLayout = Pick<LayoutConfig, "defaultIconPadding" | "iconBorderRadius">;

/** 将数字自动补 px */
export function toPx(v: string | undefined): string | undefined {
	if (!v) return undefined;
	return /^\d+$/.test(v) ? `${v}px` : v;
}

/** 仅将 undefined / null / 空字符串 / 全空格视为未配置，"0" 仍算有效值 */
export function resolveConfiguredValue(
	value: string | undefined,
	fallback?: string,
): string | undefined {
	if (typeof value === "string" && value.trim().length > 0) {
		return value.trim();
	}
	if (typeof fallback === "string" && fallback.trim().length > 0) {
		return fallback.trim();
	}
	return undefined;
}

export function isTransparentColor(value: string | undefined): boolean {
	const color = value?.trim().toLowerCase();
	if (!color) return true;
	if (color === "transparent") return true;

	const functionalMatch = color.match(/^rgba?\((.*)\)$|^hsla?\((.*)\)$/);
	if (functionalMatch) {
		const rawChannels = functionalMatch[1] ?? functionalMatch[2] ?? "";
		const alpha = rawChannels.includes("/")
			? rawChannels.split("/").at(-1)?.trim()
			: rawChannels.split(",").at(-1)?.trim();
		if (!alpha || (!rawChannels.includes("/") && !rawChannels.includes(","))) {
			return false;
		}
		const numericAlpha = alpha.endsWith("%")
			? Number.parseFloat(alpha) / 100
			: Number.parseFloat(alpha);
		return Number.isFinite(numericAlpha) && numericAlpha <= 0;
	}

	if (/^#[0-9a-f]{4}$/i.test(color)) return color.at(-1) === "0";
	if (/^#[0-9a-f]{8}$/i.test(color)) return color.slice(-2) === "00";

	return false;
}

export function resolveSiteBackgroundColor(bgColor: string | undefined): string {
	return isTransparentColor(bgColor)
		? "var(--surface-secondary)"
		: bgColor!.trim();
}

function scalePx(value: string | undefined, scale: number) {
	const px = toPx(value);
	const match = px?.match(/^(-?\d+(?:\.\d+)?)px$/);
	if (!match) return px;
	const scaled = Number.parseFloat(match[1]) * scale;
	return `${Number(scaled.toFixed(3))}px`;
}

export function resolveSiteIconStyle({
	site,
	layout,
	size,
}: {
	site: Pick<NavSite, "bgColor" | "iconPadding">;
	layout?: IconLayout;
	size: number;
}): CSSProperties {
	const scale = size / BASE_ICON_SIZE;
	const iconPadding = resolveConfiguredValue(
		site.iconPadding,
		layout?.defaultIconPadding,
	);

	return {
		width: size,
		height: size,
		backgroundColor: resolveSiteBackgroundColor(site.bgColor),
		padding: scalePx(iconPadding, scale) || undefined,
		borderRadius:
			layout?.iconBorderRadius !== "full" && layout?.iconBorderRadius
				? scalePx(layout.iconBorderRadius, scale)
				: "9999px",
	};
}

export function SiteIcon({
	site,
	layout,
	size = BASE_ICON_SIZE,
	className = "",
	imageClassName = "",
	textClassName = "",
	initialClassName = "",
	loading = "lazy",
}: {
	site: Pick<NavSite, "title" | "icon" | "bgColor" | "iconPadding">;
	layout?: IconLayout;
	size?: number;
	className?: string;
	imageClassName?: string;
	textClassName?: string;
	initialClassName?: string;
	loading?: "eager" | "lazy";
}) {
	const iconSrc = getIconImageSrc(site.icon);
	const style = resolveSiteIconStyle({ site, layout, size });

	return (
		<span
			aria-hidden
			className={`flex shrink-0 items-center justify-center overflow-hidden text-center leading-none ${className}`.trim()}
			style={style}
		>
			{site.icon ? (
				iconSrc ? (
					// eslint-disable-next-line @next/next/no-img-element
					<img
						alt=""
						src={iconSrc}
						width={size}
						height={size}
						className={`h-full w-full object-contain ${imageClassName}`.trim()}
						loading={loading}
						decoding="async"
					/>
				) : (
					<span className={textClassName}>{site.icon}</span>
				)
			) : (
				<span className={`font-semibold text-muted ${initialClassName}`.trim()}>
					{site.title.charAt(0)}
				</span>
			)}
		</span>
	);
}
