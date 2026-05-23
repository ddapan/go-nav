"use client";

import { memo } from "react";
import type { LayoutConfig } from "@/types";
import type { SiteLinkMode } from "@/lib/client/site-link";
import { CompactSiteCard } from "./site-card-compact";
import { PreviewSiteCard } from "./site-card-preview";
import type { SiteCardData } from "./site-card.types";
import { useSiteCardNavigation } from "./use-site-card-navigation";

export const SiteCard = memo(function SiteCard({
	site,
	trackVisit = true,
	layout,
	siteLinkMode,
}: {
	site: SiteCardData;
	trackVisit?: boolean;
	layout?: Required<LayoutConfig>;
	siteLinkMode: SiteLinkMode;
}) {
	const navigation = useSiteCardNavigation({
		site,
		trackVisit,
		layout,
		siteLinkMode,
	});

	if (layout?.cardStyle === "preview") {
		return <PreviewSiteCard site={site} layout={layout} navigation={navigation} />;
	}

	return <CompactSiteCard site={site} layout={layout} navigation={navigation} />;
});
