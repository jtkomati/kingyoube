import { Badge } from "@/components/ui/badge";
import { RefreshCw } from "lucide-react";

interface InvoiceStatusBadgeProps {
  status: string;
  showIcon?: boolean;
}

const statusConfig: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string; className?: string }> = {
  pending: { variant: "outline", label: "Pendente", className: "border-warning text-warning" },
  processing: { variant: "secondary", label: "Processando", className: "bg-blue-500/10 text-blue-500 border-blue-500/20" },
  issued: { variant: "default", label: "Emitida", className: "bg-success/10 text-success border-success/20" },
  cancelled: { variant: "destructive", label: "Cancelada" },
  rejected: { variant: "destructive", label: "Rejeitada" },
};

export const InvoiceStatusBadge = ({ status, showIcon = false }: InvoiceStatusBadgeProps) => {
  const config = statusConfig[status] || { variant: "outline" as const, label: status };
  
  return (
    <Badge variant={config.variant} className={config.className}>
      {showIcon && status === "processing" && (
        <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
      )}
      {config.label}
    </Badge>
  );
};
