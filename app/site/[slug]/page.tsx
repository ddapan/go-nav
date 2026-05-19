import { notFound, redirect } from "next/navigation";
import { SiteShell } from "@/components/site-shell";
import { getNav, getWebsiteData } from "@/lib/config";
import { collectSiteDetailEntries, findSiteDetailEntryBySlug } from "@/lib/site-detail";

interface SiteDetailRouteProps {
	params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
	const nav = getNav();
	if (nav.layout?.enableSiteDetailPage !== true) return [];
	const websiteData = getWebsiteData();
	return collectSiteDetailEntries(websiteData.categories).map((item) => ({
		slug: item.slug,
	}));
}

export default async function SiteDetailRoute(props: SiteDetailRouteProps) {
	const { slug } = await props.params;
	const nav = getNav();
	const detailEnabled = nav.layout?.enableSiteDetailPage === true;
	if (!detailEnabled) {
		redirect("/");
	}

	const websiteData = getWebsiteData();
	const entries = collectSiteDetailEntries(websiteData.categories);
	const matched = findSiteDetailEntryBySlug(entries, slug);
	if (!matched) notFound();
	if (matched.slug !== slug) {
		redirect(matched.path);
	}

	return <SiteShell detailSlug={matched.slug} />;
}
