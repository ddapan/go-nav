import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/server/auth";
import fs from "node:fs";
import path from "node:path";
import {
	getStructuredFileFormat,
	resolveWebsiteFilePathForRead,
	resolveWebsiteFilePathForWrite,
} from "@/lib/server/paths";
import {
	parseStructuredContent,
	readWebsiteData,
	stringifyStructuredContent,
	writeWebsiteData,
} from "@/lib/server/store";
import type { WebsiteData } from "@/types";

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
		const sourceFile = resolveWebsiteFilePathForRead();
		let content = "";
		if (fs.existsSync(sourceFile)) {
			content = fs.readFileSync(sourceFile, "utf-8");
		} else {
			content = stringifyStructuredContent(
				readWebsiteData(),
				resolveWebsiteFilePathForWrite(),
			);
		}
		return NextResponse.json({
			content,
			fileName: path.basename(sourceFile),
			format: getStructuredFileFormat(sourceFile),
		});
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
	let websiteData: WebsiteData;
	try {
		websiteData = parseStructuredContent<WebsiteData>(body.content);
	} catch {
		return NextResponse.json(
			{ error: "格式错误，请检查 JSON / YAML 语法后重试" },
			{ status: 400 },
		);
	}
	try {
		if (!websiteData || typeof websiteData !== "object" || Array.isArray(websiteData)) {
			return NextResponse.json({ error: "配置内容无效" }, { status: 400 });
		}
		writeWebsiteData(websiteData);
		const sourceFile = resolveWebsiteFilePathForRead();
		const content = fs.existsSync(sourceFile)
			? fs.readFileSync(sourceFile, "utf-8")
			: stringifyStructuredContent(websiteData, resolveWebsiteFilePathForWrite());
		revalidatePath("/");
		return NextResponse.json({
			ok: true,
			websiteData,
			content,
			fileName: path.basename(sourceFile),
			format: getStructuredFileFormat(sourceFile),
		});
	} catch (e) {
		return NextResponse.json({ error: (e as Error).message }, { status: 500 });
	}
}
