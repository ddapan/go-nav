import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/server/auth";
import { WEBSITE_FILE } from "@/lib/server/paths";
import fs from "node:fs";

async function requireAuth(): Promise<boolean> {
	const store = await cookies();
	const token = store.get(SESSION_COOKIE)?.value;
	return !!verifySession(token);
}

export async function GET() {
	if (!(await requireAuth())) {
		return NextResponse.json({ error: "未登录" }, { status: 401 });
	}
	try {
		const content = fs.readFileSync(WEBSITE_FILE, "utf-8");
		return NextResponse.json({ content });
	} catch (e) {
		return NextResponse.json({ error: (e as Error).message }, { status: 500 });
	}
}

export async function PUT(req: Request) {
	if (!(await requireAuth())) {
		return NextResponse.json({ error: "未登录" }, { status: 401 });
	}
	let body: { content: string };
	try {
		body = await req.json();
	} catch {
		return NextResponse.json({ error: "invalid body" }, { status: 400 });
	}
	if (!body.content || typeof body.content !== "string") {
		return NextResponse.json({ error: "内容不能为空" }, { status: 400 });
	}
	try {
		JSON.parse(body.content);
	} catch {
		return NextResponse.json({ error: "JSON 格式错误，请检查后重试" }, { status: 400 });
	}
	try {
		fs.writeFileSync(WEBSITE_FILE, body.content, "utf-8");
		revalidatePath("/");
		return NextResponse.json({ ok: true });
	} catch (e) {
		return NextResponse.json({ error: (e as Error).message }, { status: 500 });
	}
}
