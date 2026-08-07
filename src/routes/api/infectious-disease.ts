import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { getInfectiousRegionNames, getInfectiousRiskLevel } from "@/data/infectious-region-map";

type Row = {
  date: string;
  year: number;
  month: number;
  region_code: number;
  region_name: string;
  outpatient_patients: number;
  inpatient_patients: number;
  total_patients: number;
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

export const Route = createFileRoute("/api/infectious-disease")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const regionNameParam = url.searchParams.get("region_name");
        const regionParam = url.searchParams.get("region");
        const yearParam = url.searchParams.get("year");
        const monthParam = url.searchParams.get("month");
        const limitParam = url.searchParams.get("limit");
        const mode = url.searchParams.get("mode");

        const supabaseUrl = process.env["SUPABASE_URL"];
        const supabaseKey = process.env["SUPABASE_PUBLISHABLE_KEY"];
        if (!supabaseUrl || !supabaseKey) {
          return json({ error: "Database is not configured" }, 500);
        }
        const supabase = createClient(supabaseUrl, supabaseKey, {
          auth: { persistSession: false, autoRefreshToken: false },
          global: {
            fetch: (input, init) => {
              const headers = new Headers(init?.headers);
              if (
                supabaseKey.startsWith("sb_") &&
                headers.get("Authorization") === `Bearer ${supabaseKey}`
              ) {
                headers.delete("Authorization");
              }
              headers.set("apikey", supabaseKey);
              return fetch(input, { ...init, headers });
            },
          },
        });

        const regionNames = regionNameParam
          ? regionNameParam
              .split(",")
              .map((name) => name.trim())
              .filter(Boolean)
          : regionParam
            ? getInfectiousRegionNames(regionParam)
            : [];

        // ---- summary mode: aggregated values for the dashboard card ----
        if (mode === "summary") {
          const latest = await supabase
            .from("infectious_disease")
            .select("date")
            .order("date", { ascending: false })
            .limit(1)
            .maybeSingle();
          if (latest.error) return json({ error: latest.error.message }, 500);
          if (!latest.data) return json({ error: "No data available" }, 404);

          const latestDate = latest.data.date as string;
          const [ly, lm] = latestDate.split("-").map(Number);
          const prevYear = lm === 1 ? ly - 1 : ly;
          const prevMonth = lm === 1 ? 12 : lm - 1;
          const rangeStart = `${prevYear}-${String(prevMonth).padStart(2, "0")}-01`;

          const { data, error } = await supabase
            .from("infectious_disease")
            .select("date, year, month, region_name, total_patients")
            .gte("date", rangeStart)
            .lte("date", latestDate)
            .limit(20000);
          if (error) return json({ error: error.message }, 500);

          const rows = (data ?? []) as Pick<
            Row,
            "date" | "year" | "month" | "region_name" | "total_patients"
          >[];
          const inRegion = (name: string) =>
            regionNames.length === 0 || regionNames.includes(name);

          let regionCurrent = 0;
          let regionPrevious = 0;
          let nationwideCurrent = 0;
          for (const row of rows) {
            const isCurrent = row.year === ly && row.month === lm;
            const value = Number(row.total_patients) || 0;
            if (isCurrent) nationwideCurrent += value;
            if (!inRegion(row.region_name)) continue;
            if (isCurrent) regionCurrent += value;
            else regionPrevious += value;
          }

          const momChange =
            regionPrevious > 0
              ? ((regionCurrent - regionPrevious) / regionPrevious) * 100
              : 0;

          return json({
            selected_region: regionParam ?? (regionNameParam || "National"),
            region_names: regionNames,
            latest_date: latestDate,
            selected_region_total_patients: Math.round(regionCurrent),
            nationwide_total_patients: Math.round(nationwideCurrent),
            mom_change: Math.round(momChange * 10) / 10,
            risk_level: getInfectiousRiskLevel(momChange),
            source: "infectious_disease API",
          });
        }

        // ---- row mode ----
        const hasFilter = Boolean(regionNames.length || yearParam || monthParam || limitParam);
        const limit = Math.min(Math.max(Number(limitParam) || 100, 1), 5000);

        let query = supabase.from("infectious_disease").select("*");
        if (regionNames.length === 1) query = query.eq("region_name", regionNames[0]);
        else if (regionNames.length > 1) query = query.in("region_name", regionNames);
        if (yearParam) query = query.eq("year", Number(yearParam));
        if (monthParam) query = query.eq("month", Number(monthParam));

        const { data, error } = await query
          .order("date", { ascending: !hasFilter ? false : true })
          .limit(limit);
        if (error) return json({ error: error.message }, 500);

        const rows = ((data ?? []) as Row[]).slice().sort((a, b) => a.date.localeCompare(b.date));
        return json({ count: rows.length, data: rows });
      },
    },
  },
});
