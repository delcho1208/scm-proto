import { createFileRoute } from "@tanstack/react-router";

type DmfSourceItem = {
  DMF_PERMIT_NO?: string;
  INGR_KOR_NAME?: string;
  ENTP_NAME?: string;
  MNFCTR_NAME?: string;
  MNFCTR_PLACE?: string;
  MANUF_COUNTRY_CODE_NM?: string;
  DMF_PERMIT_DATE?: string;
};

function normalizeItems(value: unknown): DmfSourceItem[] {
  if (Array.isArray(value)) return value as DmfSourceItem[];
  return value && typeof value === "object" ? [value as DmfSourceItem] : [];
}

export const Route = createFileRoute("/api/dmf")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const requestUrl = new URL(request.url);
        const ingredient = requestUrl.searchParams.get("ingredient")?.trim() || "세파졸린";
        const serviceKey = process.env.DATA_GO_KR_SERVICE_KEY?.trim();

        if (!serviceKey) {
          return Response.json({
            ingredient,
            available: false,
            totalCount: 0,
            items: [],
            error: "공공데이터포털 인증키가 설정되지 않았습니다.",
          });
        }

        const apiUrl = new URL(
          "https://apis.data.go.kr/1471000/MdcDmfInfoService01/getMdcDmfList01",
        );
        let decodedServiceKey = serviceKey;
        try {
          decodedServiceKey = decodeURIComponent(serviceKey);
        } catch {
          // The key may already be decoded.
        }
        apiUrl.searchParams.set("serviceKey", decodedServiceKey);
        apiUrl.searchParams.set("ingr_kor_name", ingredient);
        apiUrl.searchParams.set("pageNo", "1");
        apiUrl.searchParams.set("numOfRows", "10");
        apiUrl.searchParams.set("type", "json");

        try {
          const response = await fetch(apiUrl, { headers: { Accept: "application/json" } });
          const payload = (await response.json().catch(() => null)) as {
            header?: { resultCode?: string; resultMsg?: string };
            body?: { totalCount?: number; items?: { item?: unknown } | unknown[] };
          } | null;

          if (!response.ok || !payload) {
            return Response.json({
              ingredient,
              available: false,
              totalCount: 0,
              items: [],
              error: `식약처 DMF API 요청에 실패했습니다. (${response.status})`,
            });
          }

          const resultCode = payload.header?.resultCode;
          if (resultCode && resultCode !== "00") {
            return Response.json({
              ingredient,
              available: false,
              totalCount: 0,
              items: [],
              error: payload.header?.resultMsg || `DMF API 오류 (${resultCode})`,
            });
          }

          const rawItems = Array.isArray(payload.body?.items)
            ? payload.body.items
            : payload.body?.items && typeof payload.body.items === "object" && "item" in payload.body.items
              ? payload.body.items.item
              : [];
          const items = normalizeItems(rawItems).map((item) => ({
            permitNo: item.DMF_PERMIT_NO ?? "",
            ingredient: item.INGR_KOR_NAME ?? "",
            company: item.ENTP_NAME ?? "",
            manufacturer: item.MNFCTR_NAME ?? "",
            location: item.MNFCTR_PLACE ?? "",
            country: item.MANUF_COUNTRY_CODE_NM ?? "",
            permitDate: item.DMF_PERMIT_DATE ?? "",
          }));

          return Response.json({
            ingredient,
            available: true,
            totalCount: payload.body?.totalCount ?? items.length,
            items,
          });
        } catch {
          return Response.json({
            ingredient,
            available: false,
            totalCount: 0,
            items: [],
            error: "식약처 DMF API에 연결할 수 없습니다.",
          });
        }
      },
    },
  },
});
