import { createFileRoute } from "@tanstack/react-router";

type NaverNewsItem = {
  title: string;
  originallink: string;
  link: string;
  pubDate: string;
};

function stripHtml(value: string) {
  return value
    .replace(/<[^>]*>/g, "")
    .replaceAll("&quot;", '"')
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">");
}

export const Route = createFileRoute("/api/news")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const requestUrl = new URL(request.url);
        const query = requestUrl.searchParams.get("query")?.trim();
        if (!query) {
          return Response.json({ error: "검색어가 필요합니다." }, { status: 400 });
        }

        const clientId = process.env.NAVER_API_HUB_CLIENT_ID;
        const clientSecret = process.env.NAVER_API_HUB_CLIENT_SECRET;
        if (!clientId || !clientSecret) {
          return Response.json(
            { error: "네이버 Open API 인증 정보가 설정되지 않았습니다." },
            { status: 503 },
          );
        }

        const naverUrl = new URL("https://naverapihub.apigw.ntruss.com/search/v1/news");
        naverUrl.searchParams.set("query", query);
        naverUrl.searchParams.set("display", "5");
        naverUrl.searchParams.set("start", "1");
        naverUrl.searchParams.set("sort", "date");

        try {
          const response = await fetch(naverUrl, {
            headers: {
              "X-NCP-APIGW-API-KEY-ID": clientId,
              "X-NCP-APIGW-API-KEY": clientSecret,
            },
          });
          if (!response.ok) {
            const errorBody = (await response.json().catch(() => null)) as
              | { errorCode?: string; errorMessage?: string }
              | null;
            const detail = [errorBody?.errorCode, errorBody?.errorMessage]
              .filter(Boolean)
              .join(" · ");
            return Response.json(
              {
                error: `네이버 뉴스 API 요청에 실패했습니다. (${response.status})${detail ? ` · ${detail}` : ""}`,
              },
              { status: response.status },
            );
          }

          const data = (await response.json()) as { items?: NaverNewsItem[] };
          const items = (data.items ?? []).map((item) => ({
            title: stripHtml(item.title),
            url: item.originallink || item.link,
            publishedAt: item.pubDate,
          }));
          return Response.json({ query, items });
        } catch {
          return Response.json({ error: "네이버 뉴스 API에 연결할 수 없습니다." }, { status: 502 });
        }
      },
    },
  },
});
