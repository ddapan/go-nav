import type { PluginConfig } from "@/types";

export function pluginHasRenderablePayload(plugin: PluginConfig): boolean {
	if (!plugin.enabled) return false;

	if (plugin.type === "css" || plugin.type === "js") {
		return typeof plugin.code === "string" && plugin.code.trim().length > 0;
	}

	if (plugin.type === "resource-hint") {
		return typeof plugin.href === "string" && plugin.href.trim().length > 0;
	}

	if (plugin.type === "external-script") {
		return (
			(typeof plugin.src === "string" && plugin.src.trim().length > 0) ||
			(typeof plugin.code === "string" && plugin.code.trim().length > 0)
		);
	}

	return false;
}

export function isExecutablePlugin(plugin: PluginConfig): boolean {
	return plugin.type === "js" || plugin.type === "external-script";
}
