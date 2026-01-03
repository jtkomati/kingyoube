import { Badge } from "@/components/ui/badge";

interface PaymentStatusBadgeProps {
  status: string;
}

export const PaymentStatusBadge = ({ status }: PaymentStatusBadgeProps) => {
  const getStatusConfig = (status: string) => {
    switch (status?.toUpperCase()) {
      case "CREATED":
        return { label: "Criado", variant: "secondary" as const };
      case "PROCESSING":
        return { label: "Processando", variant: "secondary" as const };
      case "SENT":
        return { label: "Enviado", variant: "outline" as const };
      case "SCHEDULED":
        return { label: "Agendado", variant: "outline" as const };
      case "PAID":
        return { label: "Pago", variant: "default" as const, className: "bg-green-500 hover:bg-green-600" };
      case "REJECTED":
        return { label: "Rejeitado", variant: "destructive" as const };
      case "CANCELLED":
        return { label: "Cancelado", variant: "destructive" as const };
      case "DELETED":
        return { label: "Excluído", variant: "secondary" as const };
      case "REFUNDED":
        return { label: "Devolvido", variant: "outline" as const };
      default:
        return { label: status, variant: "secondary" as const };
    }
  };

  const config = getStatusConfig(status);

  return (
    <Badge variant={config.variant} className={config.className}>
      {config.label}
    </Badge>
  );
};
