"use client";

import type { Key } from "@heroui/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { SearchEngine } from "@/types";
import type { HeaderEngineState } from "../header.types";
import {
	buildSearchEngineOptions,
	resolveDefaultEngineId,
} from "./search-bar.utils";

export function useSearchEngineState({
	engines,
	defaultEngine,
	enableLocal,
	engineState,
}: {
	engines: SearchEngine[];
	defaultEngine: string;
	enableLocal: boolean;
	engineState?: HeaderEngineState;
}) {
	const engineOptions = useMemo(
		() => buildSearchEngineOptions(engines, enableLocal),
		[enableLocal, engines],
	);
	const resolvedDefaultEngine = useMemo(
		() => resolveDefaultEngineId(engineOptions, defaultEngine),
		[defaultEngine, engineOptions],
	);
	const [internalEngineId, setInternalEngineId] = useState<Key | null>(
		resolvedDefaultEngine,
	);
	const engineId = engineState?.value ?? internalEngineId;

	useEffect(() => {
		if (engineId !== null && engineOptions.some((item) => item.id === engineId)) {
			return;
		}

		if (engineState?.onChange) {
			engineState.onChange(resolvedDefaultEngine);
			return;
		}

		setInternalEngineId(resolvedDefaultEngine);
	}, [engineId, engineOptions, engineState, resolvedDefaultEngine]);

	const setEngineId = useCallback(
		(id: Key | null) => {
			if (engineState?.onChange) {
				if (id !== null) engineState.onChange(id);
				return;
			}

			setInternalEngineId(id);
		},
		[engineState],
	);

	return {
		engineId,
		engineOptions,
		isLocal: engineId === "local",
		setEngineId,
	};
}
