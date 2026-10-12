export default {
  // 仅对页面导航回退首页，缺失资源和非读取请求保留原响应。
  async fetch(request, env) {
    const response = await env.ASSETS.fetch(request)
    const acceptsHtml = request.headers.get("accept")?.includes("text/html")

    if (response.status !== 404 || !acceptsHtml || !["GET", "HEAD"].includes(request.method)) {
      return response
    }

    const indexUrl = new URL(request.url)
    indexUrl.pathname = "/index.html"
    indexUrl.search = ""
    return env.ASSETS.fetch(new Request(indexUrl, request))
  },
}
