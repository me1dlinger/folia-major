import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

// serve-web.mjs
// Folia 的轻量 Web 服务：把 `npm run build` 产出的 dist/ 当静态站点发出去，SPA 路由回落到 index.html。
// 零依赖、单进程，内存占用小，适合长期挂在局域网里给别的设备用。
// 用法：node serve-web.mjs [--port 8088] [--host 0.0.0.0] [--dir dist]
// 环境变量：PORT / HOST / DIST_DIR 等价。

const args = process.argv.slice(2);
const readArg = (name) => {
    const index = args.indexOf(`--${name}`);
    return index >= 0 ? args[index + 1] : undefined;
};

const rootDir = resolve(readArg('dir') ?? process.env.DIST_DIR ?? 'dist');
const port = Number(readArg('port') ?? process.env.PORT ?? 8088);
const host = readArg('host') ?? process.env.HOST ?? '0.0.0.0';

if (!existsSync(join(rootDir, 'index.html'))) {
    console.error(`[serve-web] 没找到 ${join(rootDir, 'index.html')}，先在项目根跑一次 \`npm run build\`。`);
    process.exit(1);
}

const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.avif': 'image/avif',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.otf': 'font/otf',
    '.mp3': 'audio/mpeg',
    '.wasm': 'application/wasm',
    '.map': 'application/json; charset=utf-8',
    '.txt': 'text/plain; charset=utf-8',
    '.webmanifest': 'application/manifest+json',
};

const sendFile = (res, filePath) => {
    const ext = extname(filePath).toLowerCase();
    // 带哈希的构建产物可以长缓存；index.html 与 runtime-config.js 每次都校验。
    const immutable = filePath.includes(`${sep}assets${sep}`);
    const stream = createReadStream(filePath);
    // 构建产物被替换的瞬间文件可能不在：不要把进程打挂，回一个 404。
    stream.on('error', (error) => {
        if (!res.headersSent) {
            res.writeHead(error.code === 'ENOENT' ? 404 : 500, { 'Content-Type': 'text/plain; charset=utf-8' });
        }
        res.end();
        console.warn('[serve-web] failed to read', filePath, '-', error.code);
    });
    res.setHeader('Content-Type', MIME[ext] ?? 'application/octet-stream');
    res.setHeader('Cache-Control', immutable ? 'public, max-age=31536000, immutable' : 'no-cache');
    stream.pipe(res);
};

const server = createServer((req, res) => {
    try {
        const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
        const decoded = decodeURIComponent(url.pathname);
        // 归一化后必须仍然落在 dist 内，避免路径穿越。
        const target = normalize(join(rootDir, decoded));
        if (!target.startsWith(rootDir)) {
            res.writeHead(403).end('Forbidden');
            return;
        }

        if (existsSync(target) && statSync(target).isFile()) {
            sendFile(res, target);
            return;
        }

        // SPA 回落：非文件请求一律给 index.html，前端自己按路由渲染。
        sendFile(res, join(rootDir, 'index.html'));
    } catch (error) {
        console.error('[serve-web] request failed:', error);
        res.writeHead(500).end('Internal Server Error');
    }
});

server.on('error', (error) => {
    console.error('[serve-web] server error:', error);
});
server.listen(port, host, () => {
    const shown = host === '0.0.0.0' ? 'localhost' : host;
    console.log(`[serve-web] Folia 前端已启动: http://${shown}:${port}/  (监听 ${host}:${port}, 站点目录 ${rootDir})`);
    console.log('[serve-web] 局域网 / 远程设备用本机 IP 访问同一端口即可；Navidrome 服务端需允许这个来源的跨域请求。');
});