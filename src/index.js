export default {
  async fetch(req) {
    const url = new URL(req.url)

    // 设置目标地址（支持多个源）
    let origin = "https://copilot.microsoft.com"
    if (url.pathname.startsWith("/bundle-cmc/")) {
      origin = "https://studiostaticassetsprod.azureedge.net"
    }

    const targetUrl = origin + url.pathname + url.search

    const newHeaders = new Headers(req.headers)

    // 修改请求头：设置正确的 Host/Origin/Referer
    newHeaders.set("Host", new URL(origin).host)
    newHeaders.set("Origin", origin)
    newHeaders.set("Referer", origin + "/")

    // ⚠️ 删除 Cloudflare 特有头，防止污染
    newHeaders.delete("cf-connecting-ip");
    newHeaders.delete("cf-ipcountry");
    newHeaders.delete("cf-ray");
    newHeaders.delete("cf-visitor");

    // 清理转发中的 Accept-Encoding，保留原始压缩数据（如 br）
    // 否则 Cloudflare Worker 会自动解压后再压，用 JS body 报错
    newHeaders.delete("Accept-Encoding");

    // 发起代理请求
    const fetchResponse = await fetch(targetUrl, {
      method: req.method,
      headers: newHeaders,
      body: req.method === "GET" || req.method === "HEAD" ? null : req.body,
      redirect: "manual",
    })

    // 响应头做必要修改
    const responseHeaders = new Headers(fetchResponse.headers)

    responseHeaders.set('Access-Control-Allow-Origin', '*')
    responseHeaders.set('Cross-Origin-Embedder-Policy', 'unsafe-none')
    responseHeaders.set('Cross-Origin-Opener-Policy', 'unsafe-none')
    responseHeaders.set('Content-Security-Policy', 'default-src * blob: data: filesystem: about: ws: wss:; script-src * blob: data: "unsafe-inline" "unsafe-eval"; connect-src * ws: wss:; img-src * data: blob: filesystem:; style-src * "unsafe-inline"; media-src * data: blob:; font-src * data:; frame-src *;')

    // 拦截 Set-Cookie，去掉不支持的 Domain 字段
    sanitizeSetCookieHeaders(responseHeaders)

    return new Response(fetchResponse.body, {
      status: fetchResponse.status,
      headers: responseHeaders,
    })
  }
}

/**
 * 移除 Set-Cookie 中的 Domain，以避免跨域失效
 */
function sanitizeSetCookieHeaders(headers) {
  if (typeof headers.getAll === "function") {
    const cookies = headers.getAll("Set-Cookie");
    headers.delete("Set-Cookie");
    cookies.forEach(cookie => {
      // 移除 Domain，防止失效
      headers.append("Set-Cookie", cookie.replace(/Domain=[^;]+;?/i, ""));
    });
  } else if (headers.has("Set-Cookie")) {
    const cookie = headers.get("Set-Cookie");
    headers.set("Set-Cookie", cookie.replace(/Domain=[^;]+;?/i, ""));
  }
}
