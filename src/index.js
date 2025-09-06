export default {
  async fetch(request) {
    const url = new URL(request.url);

    // 目标域
    const targetHost = 'copilot.microsoft.com';

    // 将请求的路径、参数拼接成新请求
    const targetUrl = new URL(url.pathname + url.search, `https://${targetHost}`);

    // 构造新请求（转发原始方法、头部、body 等等）
    const newRequest = new Request(targetUrl.href, {
      method: request.method,
      headers: modifyRequestHeaders(request.headers),
      body: ['GET', 'HEAD'].includes(request.method) ? null : request.body,
      redirect: 'manual'
    });

    let response = await fetch(newRequest);

    // 处理响应：修改 CSP、cookies、headers 等以实现正常加载
    response = new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: modifyResponseHeaders(response.headers),
    });

    return response;
  }
}

function modifyRequestHeaders(headers) {
  const newHeaders = new Headers(headers);

  newHeaders.set('Host', 'copilot.microsoft.com');
  newHeaders.set('Referer', 'https://copilot.microsoft.com/');
  newHeaders.set('Origin', 'https://copilot.microsoft.com/');

  // 可删除不必要或敏感信息
  newHeaders.delete('cf-connecting-ip');
  newHeaders.delete('x-forwarded-for');

  return newHeaders;
}

function modifyResponseHeaders(headers) {
  const newHeaders = new Headers(headers);

  // 很关键：放宽 CSP 限制，防止资源被阻止加载
  newHeaders.set('Content-Security-Policy', "");

  // Optional: CORS
  newHeaders.set('Access-Control-Allow-Origin', '*');
  newHeaders.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
  newHeaders.set('Access-Control-Allow-Headers', '*');

  // 拦截并重写某些 Set-Cookie 的 Domain
  const setCookieHeaders = headers.getAll ? headers.getAll('Set-Cookie') : [];
  const newCookieHeaders = [];
  for (const cookie of setCookieHeaders) {
    newCookieHeaders.push(cookie.replace(/Domain=[^;]+;/i, ''));
  }
  if (newCookieHeaders.length > 0) {
    newHeaders.delete('Set-Cookie');
    newCookieHeaders.forEach(cookie => newHeaders.append('Set-Cookie', cookie));
  }

  return newHeaders;
}