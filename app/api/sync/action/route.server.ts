import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/server/api-auth";
import {
	runDataSync,
	type SyncAction,
	type SyncProvider,
} from "@/lib/server/data-sync";

function isSyncProvider(value: unknown): value is SyncProvider {
	return value === "github" || value === "webdav";
}

function isSyncAction(value: unknown): value is SyncAction {
	return value === "push" || value === "pull";
}

export async function POST(req: Request) {
	if (!(await requireAdminAuth())) {
		return NextResponse.json({ error: "未登录" }, { status: 401 });
	}

	let body: { provider?: unknown; action?: unknown; target?: unknown };
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

	const result = await runDataSync(body.provider, body.action, {
		target: typeof body.target === "string" ? body.target : undefined,
	});
	if (result.ok && body.action === "pull") {
		revalidatePath("/");
	}
	return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
