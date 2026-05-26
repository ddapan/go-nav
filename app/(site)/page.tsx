import { connection } from "next/server";

const BUILD_MODE = (process.env.BUILD_MODE || "server").toLowerCase();
const IS_STATIC_BUILD = BUILD_MODE === "static";

export default async function HomePage() {
	if (!IS_STATIC_BUILD) {
		// 仅 server 模式按请求渲染；static 构建保持可导出。
		await connection();
	}
	return null;
}
