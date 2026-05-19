import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/server/auth";
import {
	createBackupFileName,
	createDataBackupZip,
	MAX_BACKUP_SIZE,
	restoreDataBackupZip,
} from "@/lib/server/backup";

async function requireAuth(): Promise<boolean> {
	const store = await cookies();
	const token = store.get(SESSION_COOKIE)?.value;
	return !!verifySession(token);
}

/**
 * GET：导出完整备份为 ZIP 压缩包，包含
 *   - website.yaml / website.json
 *   - nav.yaml / nav.json
 *   - uploads/<filename>...
 */
export async function GET() {
	if (!(await requireAuth())) {
		return NextResponse.json({ error: "未登录" }, { status: 401 });
	}
	try {
		const zipBuf = createDataBackupZip();
		// Buffer 是 Uint8Array 的子类，可直接作为 Response Body
		return new NextResponse(new Uint8Array(zipBuf), {
			status: 200,
			headers: {
				"Content-Type": "application/zip",
				"Content-Disposition": `attachment; filename="${createBackupFileName()}"`,
				"Cache-Control": "no-store",
			},
		});
	} catch (e) {
		return NextResponse.json({ error: (e as Error).message }, { status: 500 });
	}
}

/**
 * POST：导入 ZIP 备份并覆盖写入。
 * 接受 application/zip（或 octet-stream）原始字节，body 即 zip 文件内容。
 */
export async function POST(req: Request) {
	if (!(await requireAuth())) {
		return NextResponse.json({ error: "未登录" }, { status: 401 });
	}

	let buf: Buffer;
	try {
		const ab = await req.arrayBuffer();
		if (!ab || ab.byteLength === 0) {
			return NextResponse.json(
				{ error: "请上传备份 zip 文件" },
				{ status: 400 },
			);
		}
		if (ab.byteLength > MAX_BACKUP_SIZE) {
			return NextResponse.json(
				{ error: "备份文件过大 (最大 20MB)" },
				{ status: 413 },
			);
		}
		buf = Buffer.from(ab);
	} catch {
		return NextResponse.json({ error: "读取请求体失败" }, { status: 400 });
	}

	try {
		const restored = restoreDataBackupZip(buf);
		revalidatePath("/");
		return NextResponse.json({
			ok: true,
			restored,
		});
	} catch (e) {
		return NextResponse.json({ error: (e as Error).message }, { status: 400 });
	}
}
