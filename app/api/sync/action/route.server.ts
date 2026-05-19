import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/server/api-auth";
import {
	runDataSync,
	type DataSyncProgressEvent,
	type SyncAction,
	type SyncProvider,
} from "@/lib/server/data-sync";

function isSyncProvider(value: unknown): value is SyncProvider {
	return value === "github" || value === "webdav";
}

function isSyncAction(value: unknown): value is SyncAction {
	return value === "push" || value === "pull";
}

interface SyncStreamLogMessage {
	type: "log";
	event: DataSyncProgressEvent;
}

interface SyncStreamResultMessage {
	type: "result";
	result: Awaited<ReturnType<typeof runDataSync>>;
}

type SyncStreamMessage = SyncStreamLogMessage | SyncStreamResultMessage;

function toNdjsonLine(payload: SyncStreamMessage): string {
	return `${JSON.stringify(payload)}\n`;
}

export async function POST(req: Request) {
	if (!(await requireAdminAuth())) {
		return NextResponse.json({ error: "未登录" }, { status: 401 });
	}

	let body: {
		provider?: unknown;
		action?: unknown;
		target?: unknown;
		stream?: unknown;
	};
	try {
		body = (await req.json()) as {
			provider?: unknown;
			action?: unknown;
			target?: unknown;
		};
	} catch {
		return NextResponse.json({ error: "invalid body" }, { status: 400 });
	}

	if (!isSyncProvider(body.provider) || !isSyncAction(body.action)) {
		return NextResponse.json(
			{ error: "provider/action 参数无效" },
			{ status: 400 },
		);
	}
	const provider = body.provider;
	const action = body.action;

	const streamEnabled = body.stream === true;
	if (streamEnabled) {
		const encoder = new TextEncoder();
		const stream = new ReadableStream<Uint8Array>({
			start: (controller) => {
				const push = (payload: SyncStreamMessage) => {
					controller.enqueue(encoder.encode(toNdjsonLine(payload)));
				};
				const closeWithResult = async () => {
					const result = await runDataSync(provider, action, {
						target: typeof body.target === "string" ? body.target : undefined,
						onProgress: async (event) => {
							push({ type: "log", event });
						},
					});
					if (result.ok && action === "pull") {
						revalidatePath("/");
					}
					push({ type: "result", result });
				};

				void closeWithResult()
					.catch((error) => {
						push({
							type: "result",
							result: {
								ok: false,
								provider,
								action,
								at: new Date().toISOString(),
								message: (error as Error).message || "同步失败",
							},
						});
					})
					.finally(() => controller.close());
			},
		});

		return new Response(stream, {
			headers: {
				"Content-Type": "application/x-ndjson; charset=utf-8",
				"Cache-Control": "no-cache, no-transform",
			},
		});
	}

	const result = await runDataSync(provider, action, {
		target: typeof body.target === "string" ? body.target : undefined,
	});
	if (result.ok && action === "pull") {
		revalidatePath("/");
	}
	return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
