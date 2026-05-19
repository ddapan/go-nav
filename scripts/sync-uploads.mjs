#!/usr/bin/env node
/**
 * 静态构建前的 uploads 同步脚本。
 *
 * 目的：静态模式（`next build` with output: 'export'）下没有 Node.js 运行时，
 * 无法通过 route handler 代理 `data/uploads/`，因此需要把 data/uploads/
 * 中的全部图片复制到 public/uploads/，让 Next.js 作为静态资源一起打包到 out/。
 *
 * 约定：
 *  - 所有上传文件在 nav.json / website.json 中形如 `/uploads/xxx.png`
 *  - server 模式：由 app/uploads/[...path]/route.server.ts 代理 data/uploads
 *  - static 模式：由 public/uploads/ 直接托管（本脚本生成）
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");

const DATA_DIR = process.env.DATA_DIR
	? path.resolve(process.env.DATA_DIR)
	: path.join(root, "data");
const SRC = path.join(DATA_DIR, "uploads");
const DEST = path.join(root, "public", "uploads");

function rmrf(target) {
	if (!fs.existsSync(target)) return;
	fs.rmSync(target, { recursive: true, force: true });
}

function copyDir(src, dest) {
	fs.mkdirSync(dest, { recursive: true });
	for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
		if (entry.name === ".gitkeep") continue;
		const s = path.join(src, entry.name);
		const d = path.join(dest, entry.name);
		if (entry.isDirectory()) {
			copyDir(s, d);
		} else if (entry.isFile()) {
			fs.copyFileSync(s, d);
		}
	}
}

// 清理旧目标，避免残留已删除的文件
rmrf(DEST);

if (!fs.existsSync(SRC)) {
	console.log(`[sync-uploads] 源目录不存在，跳过：${SRC}`);
	process.exit(0);
}

copyDir(SRC, DEST);

const count = countFiles(DEST);
console.log(`[sync-uploads] ✔ 已同步 ${count} 个文件：${SRC} -> ${DEST}`);

function countFiles(dir) {
	if (!fs.existsSync(dir)) return 0;
	let n = 0;
	for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
		const p = path.join(dir, entry.name);
		if (entry.isDirectory()) n += countFiles(p);
		else if (entry.isFile()) n += 1;
	}
	return n;
}
