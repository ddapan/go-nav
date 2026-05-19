import { AppLayout } from "@/components/app-layout";
import { SiteStoreProvider } from "@/lib/store/hydrate";
import { getNav, getWebsiteData } from "@/lib/config";
import type { PluginConfig } from "@/types";

export default function Home() {
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
			{/* 自定义 CSS 插件注入 */}
			{cssPlugins.map((p) => (
				<style
					key={p.id}
					data-plugin-id={p.id}
					data-plugin-name={p.name}
					dangerouslySetInnerHTML={{ __html: p.code }}
				/>
			))}
			<AppLayout />
			{/* 自定义 JS 插件注入（body 末尾） */}
			{jsPlugins.map((p) => (
				<PluginScript key={p.id} plugin={p} />
			))}
		</SiteStoreProvider>
	);
}

/** 根据 loading 模式输出对应 <script> （服务端渲染） */
function PluginScript({ plugin }: { plugin: PluginConfig }) {
	const mode = plugin.loading ?? "sync";
	const commonProps = {
		"data-plugin-id": plugin.id,
		"data-plugin-name": plugin.name,
		dangerouslySetInnerHTML: { __html: plugin.code },
	};
	if (mode === "defer") {
		// defer 对 inline script 在大多数浏览器上无效，但保留标记以防将来扩展为外部脚本
		return <script defer {...commonProps} />;
	}
	if (mode === "async") {
		return <script async {...commonProps} />;
	}
	return <script {...commonProps} />;
}
