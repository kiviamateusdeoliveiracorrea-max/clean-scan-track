import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function UserPickerField({
  label,
  value,
  onChange,
  users,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  users: Array<{ id: string; nome: string | null; cargo?: string | null; areas?: { nome: string | null } | null }>;
}) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <Select value={value || "__none__"} onValueChange={(v) => onChange(v === "__none__" ? "" : v)}>
        <SelectTrigger>
          <SelectValue placeholder="Selecione..." />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__none__">— Sem responsável —</SelectItem>
          {users.map((u) => (
            <SelectItem key={u.id} value={u.id}>
              <div className="flex flex-col text-left">
                <span className="font-medium">{u.nome ?? "Sem nome"}</span>
                <span className="text-[11px] text-muted-foreground">
                  {[u.cargo, u.areas?.nome].filter(Boolean).join(" · ") || "—"}
                </span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
