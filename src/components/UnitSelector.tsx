import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2 } from "lucide-react";
import { getMyUnits } from "@/lib/units.functions";
import { getActiveUnitId, setActiveUnitId, useActiveUnitId } from "@/lib/active-unit";

export function useMyUnits(enabled: boolean) {
  return useQuery({ queryKey: ["my-units"], queryFn: () => getMyUnits(), enabled, staleTime: 60_000 });
}

export function UnitSelector({ enabled, tone = "sidebar" }: { enabled: boolean; tone?: "sidebar" | "header" }) {
  const qc = useQueryClient();
  const { data } = useMyUnits(enabled);
  const active = useActiveUnitId();

  useEffect(() => {
    if (!data) return;
    const ids = data.units.map((u) => u.id);
    const cur = getActiveUnitId();
    if (!cur || !ids.includes(cur)) {
      const next = data.defaultUnitId && ids.includes(data.defaultUnitId) ? data.defaultUnitId : ids[0] ?? null;
      if (next !== cur) {
        setActiveUnitId(next);
        qc.resetQueries({ predicate: (q) => q.queryKey[0] !== "my-units" && q.queryKey[0] !== "my-roles" });
      }
    }
  }, [data, qc]);

  if (!data || data.units.length === 0) return null;
  const cls = tone === "header" ? "text-primary-foreground" : "text-sidebar-foreground";

  if (data.units.length === 1) {
    return (
      <div className={`flex items-center gap-2 text-xs font-medium ${cls}`}>
        <Building2 className="h-4 w-4 shrink-0" />
        <span className="truncate">{data.units[0].name}</span>
      </div>
    );
  }

  return (
    <label className={`flex items-center gap-2 text-xs ${cls}`}>
      <Building2 className="h-4 w-4 shrink-0" />
      <span className="sr-only">Unidade</span>
      <select
        aria-label="Unidade"
        value={active ?? ""}
        onChange={(e) => {
          setActiveUnitId(e.target.value);
          qc.resetQueries({ predicate: (q) => q.queryKey[0] !== "my-units" && q.queryKey[0] !== "my-roles" });
        }}
        className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs text-foreground"
      >
        {data.units.map((u) => (
          <option key={u.id} value={u.id}>
            {u.name}{u.status === "EM_CONFIGURACAO" ? " (em configuração)" : ""}
          </option>
        ))}
      </select>
    </label>
  );
}
