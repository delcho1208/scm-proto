import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";

import { regions } from "@/data/scm";

export default defineTool({
  name: "get_region",
  title: "Get region detail",
  description:
    "Get the stock level, risk level and monitoring note for one SCM region (including the National rollup).",
  inputSchema: {
    region_id: z
      .string()
      .describe(
        "Region id: National, Seoul, Gyeonggi, Gangwon, Chungcheong, Daegu, Honam, Busan or Jeju.",
      ),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: ({ region_id }) => {
    const region = regions[region_id];
    if (!region) {
      throw new ToolError(
        `Unknown region "${region_id}". Valid ids: ${Object.keys(regions).join(", ")}`,
      );
    }

    const payload = {
      id: region.id,
      name: region.name,
      title: region.title,
      stock: region.stock,
      riskLevel: region.riskLevel,
      riskText: region.riskText,
      note: region.desc,
    };

    return {
      content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
      structuredContent: payload,
    };
  },
});
