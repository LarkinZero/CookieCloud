# CookieCloud

[Chinese](./README_cn.md) | [English](./README.md)

Forked From [CookieCloud](https://github.com/easychen/CookieCloud)

The API section has been re-implemented using the Hono framework to be compatible with Cloudflare Workers + KV environment.

Before deployment, you need to install the wrangler tool:

```bash
npm install -g wrangler
```

Then create a KV namespace:

```bash
npx wrangler kv namespace create COOKIE_DATA
```

Write the generated ID to the `kv_namespaces` field in `wrangler.toml`:

```toml
[[kv_namespaces]]
binding = "COOKIE_DATA"
id = "YOUR_KV_ID"
preview_id = "YOUR_KV_ID"
```

To run locally, execute the following command to start the service:

```bash
npm run dev
```

To deploy to Cloudflare Workers, execute the following command:

```bash
npm run deploy
```