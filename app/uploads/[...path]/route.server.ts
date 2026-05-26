import fs from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { NextResponse } from "next/server";
import { UPLOADS_DIR } from "@/lib/server/paths";

const MIME: Record<string, string> = {
	".png": "image/png",
	".jpg": "image/jpeg",
	".jpeg": "image/jpeg",
	".gif": "image/gif",
	".webp": "image/webp",
	".svg": "image/svg+xml",
	".ico": "image/x-icon",
};

/**
 * 提供 data/uploads 下文件的访问能力：GET /uploads/xxx.png
 * (仅 server 模式下生效；静态模式下文件会被预构建脚本复制到 public/uploads)
 */
export async function GET(
	req: Request,
	{ params }: { params: Promise<{ path: string[] }> },
) {
	const { path: segs } = await params;
	const target = path.join(UPLOADS_DIR, ...segs);
	const rel = path.relative(UPLOADS_DIR, target);
	if (rel.startsWith("..") || path.isAbsolute(rel)) {
		return NextResponse.json({ error: "forbidden" }, { status: 403 });
	}
	if (!fs.existsSync(target) || !fs.statSync(target).isFile()) {
		return NextResponse.json({ error: "not found" }, { status: 404 });
	}
	const stat = fs.statSync(target);
	const ext = path.extname(target).toLowerCase();
	const etag = `"${stat.size.toString(16)}-${Math.floor(stat.mtimeMs).toString(16)}"`;
	const lastModified = stat.mtime.toUTCString();
	if (req.headers.get("if-none-match") === etag) {
		return new Response(null, { status: 304, headers: { ETag: etag } });
	}
	const ifModifiedSince = req.headers.get("if-modified-since");
	if (ifModifiedSince && Number.isFinite(Date.parse(ifModifiedSince))) {
		if (stat.mtime.getTime() <= Date.parse(ifModifiedSince)) {
			return new Response(null, { status: 304, headers: { ETag: etag } });
		}
	}
	const headers = new Headers({
		"Content-Type": MIME[ext] || "application/octet-stream",
		"Content-Length": String(stat.size),
		"Cache-Control": "public, max-age=31536000, immutable",
		ETag: etag,
		"Last-Modified": lastModified,
		"X-Content-Type-Options": "nosniff",
	});
	if (ext === ".svg") {
		headers.set("Content-Security-Policy", "script-src 'none'; sandbox");
	}
	const stream = Readable.toWeb(fs.createReadStream(target));
	return new Response(stream as ReadableStream<Uint8Array>, {
		headers,
	});
}

export async function HEAD(
	req: Request,
	ctx: { params: Promise<{ path: string[] }> },
) {
	const res = await GET(req, ctx);
	return new Response(null, {
		status: res.status,
		headers: res.headers,
	});
}
