# CookieCloud

[中文](./README_cn.md) | [English](./README.md)

Fork From [CookieCloud](https://github.com/easychen/CookieCloud)

API 部分改为使用 Hono 框架实现，以兼容 Cloudflare Workers + KV 环境

部署前，需要先安装 wrangler 工具：

```bash
npm install -g wrangler
```

然后创建 KV 命名空间：

```bash
npx wrangler kv namespace create COOKIE_DATA
```

将生成的id，写入到 wrangler.toml 中的kv_namespaces字段下：

```toml
[[kv_namespaces]]
binding = "COOKIE_DATA"
id = "YOUR_KV_ID"
preview_id = "YOUR_KV_ID"
```

本地运行时，执行以下命令启动服务：

```bash
npm run dev
```

部署到 Cloudflare Workers 时，执行以下命令：

```bash
npm run deploy
```