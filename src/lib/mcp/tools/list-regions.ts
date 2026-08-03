import { defineTool } from "@lovable.dev/mcp-js";

import { markerOrder, regions } from "@/data/scm";

export default defineTool({
  name: "list_regions",
  title: "List regions",
  description:
    "List the eight Korean SCM regions with their current stock level, risk level and status note.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: () => {
    const rows = markerOrder.map((id) => {
      const r = regions[id];
      return {
        id: r.id,
        name: r.name,
        stock: r.stock,
        riskLevel: r.riskLevel,
        riskText: r.riskText,
        note: r.desc,
      };
    });

    return {
      content: [{ type: "text", text: JSON.stringify(rows, null, 2) }],
      structuredContent: { regions: rows },
    };
  },
});
