import path from "node:path";

/**
 * 数据目录（便于 Docker 映射）。
 * 通过环境变量 DATA_DIR 自定义，默认项目根目录下的 `data/`。
 */
export const DATA_DIR = process.env.DATA_DIR
	? path.resolve(process.env.DATA_DIR)
	: path.join(process.cwd(), "data");

/** 网站基础配置文件路径 */
export const WEBSITE_FILE = path.join(DATA_DIR, "website.json");

/** 导航数据（分类/网站/搜索引擎）文件路径 */
export const NAV_FILE = path.join(DATA_DIR, "nav.json");

/** 上传图片目录（后台上传的文件落在这里） */
export const UPLOADS_DIR = path.join(DATA_DIR, "uploads");

/** 远端同步配置（包含凭据，只保存在本机 data 目录，不打包进远端备份） */
export const SYNC_FILE = path.join(DATA_DIR, "sync.json");
