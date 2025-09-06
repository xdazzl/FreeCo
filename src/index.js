export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);

    // 处理不同路径跳转
    let targetOrigin = "https://copilot.microsoft.com";
    if (url.pathname.startsWith("/bundle-cmc/")) {
      targetOrigin = "https://studiostaticassetsprod.azureedge.net";
    }

    const targetUrl = new URL(url.pathname + url.search, targetOrigin);

    const newRequest = new Request(targetUrl.href, {
      method: req.method,
      headers: modifyRequestHeaders(req.headers, targetOrigin),
      body: ['GET', 'HEAD'].includes(req.method) ? null : req.body,
      redirect: 'manual',
    });

    let res = await fetch(newRequest);

    // 构建响应
    res = new Response(res.body, {
      status: res.status,
      statusText: res.statusText,
      headers: modifyResponseHeaders(res.headers),
    });

    return res;
  }
}

function modifyRequestHeaders(headers, origin) {
  const newHeaders = new Headers(headers);
  const host = new URL(origin).host;

  newHeaders.set('Host', host);
  newHeaders.set('Referer', origin + '/');
  newHeaders.set('Origin', origin);

  // 删除敏感头
  newHeaders.delete('cf-connecting-ip');
  newHeaders.delete('x-forwarded-for');
  return newHeaders;
}

function modifyResponseHeaders(headers) {
  const newHeaders = new Headers(headers);

  // 移除/修改 CSP 限制（防止跨域或脚本执行失败）
  newHeaders.set('Content-Security-Policy', "");
  newHeaders.set('Access-Control-Allow-Origin', '*'); // Optional

  // 修复 Set-Cookie 不允许的问题
  const cookies = headers.getAll ? headers.getAll('Set-Cookie') : [];
  if (cookies.length > 0) {
    newHeaders.delete('Set-Cookie');
    cookies.forEach(cookie => {
      newHeaders.append('Set-Cookie', cookie.replace(/Domain=[^;]+/i, ''));
    });
  }

  return newHeaders;
}