import { defineTool } from "@lovable.dev/mcp-js";

import { products } from "@/data/scm";

export default defineTool({
  name: "list_products",
  title: "List products",
  description:
    "List every tracked pharmaceutical product with its annual demand, YoY growth, stock, stockout rate, production CAPA, utilization and ROI.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: () => {
    const rows = products.map((p) => ({
      key: p.key,
      name: p.name,
      category: p.subtitle,
      annualDemand: p.annualDemand,
      yoyGrowth: p.yoyGrowth,
      stock: p.stock,
      stockoutRate: p.stockout,
      capa: p.capa,
      utilization: p.utilization,
      roi: p.roi,
    }));

    return {
      content: [{ type: "text", text: JSON.stringify(rows, null, 2) }],
      structuredContent: { products: rows },
    };
  },
});
