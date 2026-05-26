"use client";

import { useServerInsertedHTML } from "next/navigation";
import type { PluginConfig } from "@/types";

export function SiteHeadInsertions({
	plugins,
}: {
	plugins: PluginConfig[];
}) {
	useServerInsertedHTML(() => (
		<>
			{plugins.map((plugin) => {
				if (plugin.type === "css") {
					return (
						<style
							key={plugin.id}
							data-plugin-id={plugin.id}
							data-plugin-name={plugin.name}
							dangerouslySetInnerHTML={{ __html: plugin.code }}
						/>
					);
				}

				if (plugin.type === "resource-hint" && plugin.href?.trim()) {
					const rel = plugin.resourceHintRel ?? "preconnect";
					return (
						<link
							key={plugin.id}
							data-plugin-id={plugin.id}
							data-plugin-name={plugin.name}
							rel={rel}
							href={plugin.href.trim()}
							crossOrigin={
								rel === "preconnect" ? plugin.crossOrigin || undefined : undefined
							}
						/>
					);
				}

				return null;
			})}
		</>
	));

	return null;
}
