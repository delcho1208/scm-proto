import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";

import { getIntegrationRecords, products, regions } from "@/data/scm";

export default defineTool({
  name: "get_integration_records",
  title: "Get ERP/MES/WMS records",
  description:
    "Get the ERP, MES and WMS integration records (document number, sync status, quantity, last sync time, note) for one region and product.",
  inputSchema: {
    region_id: z
      .string()
      .describe("Region id, e.g. Seoul, Gyeonggi, Gangwon, Chungcheong, Daegu, Honam, Busan, Jeju."),
    product: z.string().describe("Product name or key, e.g. 리피로우, 타미비어, 세파졸린."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: ({ region_id, product }) => {
    if (!regions[region_id]) {
      throw new ToolError(
        `Unknown region "${region_id}". Valid ids: ${Object.keys(regions).join(", ")}`,
      );
    }
    const match = products.find((p) => p.key === product || p.name === product);
    if (!match) {
      throw new ToolError(
        `Unknown product "${product}". Valid products: ${products.map((p) => p.key).join(", ")}`,
      );
    }

    const records = getIntegrationRecords(region_id, match.key);
    const payload = { region: regions[region_id].name, product: match.name, records };

    return {
      content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
      structuredContent: payload,
    };
  },
});
