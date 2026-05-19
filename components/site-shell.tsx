import type { PluginConfig } from "@/types";
import { AppLayout } from "@/components/app-layout";
import { SiteStoreProvider } from "@/lib/store/hydrate";
import { getNav, getWebsiteData } from "@/lib/config";

export function SiteShell({ detailSlug }: { detailSlug?: string }) {
	const websiteData = getWebsiteData();
	const nav = getNav();
	const plugins = (nav.plugins ?? [])
		.filter(
			(p) =>
				p.enabled && typeof p.code === "string" && p.code.trim().length > 0,
		)
		.sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0));
	const cssPlugins = plugins.filter((p) => p.type === "css");
	const jsPlugins = plugins.filter((p) => p.type === "js");

	return (
		<SiteStoreProvider initial={{ websiteData, nav }}>
			{cssPlugins.map((p) => (
				<style
					key={p.id}
					data-plugin-id={p.id}
					data-plugin-name={p.name}
					dangerouslySetInnerHTML={{ __html: p.code }}
				/>
			))}
			<AppLayout detailSlug={detailSlug} />
			{jsPlugins.map((p) => (
				<PluginScript key={p.id} plugin={p} />
			))}
		</SiteStoreProvider>
	);
}

function PluginScript({ plugin }: { plugin: PluginConfig }) {
	const mode = plugin.loading ?? "sync";
	const commonProps = {
		"data-plugin-id": plugin.id,
		"data-plugin-name": plugin.name,
		dangerouslySetInnerHTML: { __html: plugin.code },
	};
	if (mode === "defer") {
		return <script defer {...commonProps} />;
	}
	if (mode === "async") {
		return <script async {...commonProps} />;
	}
	return <script {...commonProps} />;
}
