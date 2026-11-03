import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/_authenticated/auditorias-processo/nova")({
  head: () => ({
    meta: [
      { title: "Nova Auditoria de Processo — AuditLog 5S" },
      { name: "description", content: "Criação de auditoria de processo." },
      { property: "og:title", content: "Nova Auditoria de Processo — AuditLog 5S" },
      { property: "og:description", content: "Criação de auditoria de processo." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: NovaAuditoriaProcesso,
});

function NovaAuditoriaProcesso() {
  return (
    <div className="p-4 md:p-8 space-y-6 max-w-3xl mx-auto">
      <Button asChild variant="ghost" size="sm">
        <Link to="/auditorias-processo">
          <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
        </Link>
      </Button>
      <Card>
        <CardContent className="py-12 text-center space-y-2">
          <h1 className="text-xl font-bold text-primary">Nova auditoria de processo</h1>
          <p className="text-sm text-muted-foreground">
            A tela de execução da auditoria de processo será disponibilizada na próxima etapa.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
