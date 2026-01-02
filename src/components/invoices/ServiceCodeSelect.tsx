import { useState } from "react";
import { Check, ChevronsUpDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { 
  SERVICE_CODES_BY_CATEGORY, 
  SERVICE_CATEGORIES,
  type ServiceCode 
} from "@/lib/service-codes-osasco";

interface ServiceCodeSelectProps {
  value?: string;
  onSelect: (service: ServiceCode) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function ServiceCodeSelect({ 
  value, 
  onSelect, 
  placeholder = "Selecione o serviço...",
  disabled = false 
}: ServiceCodeSelectProps) {
  const [open, setOpen] = useState(false);

  // Find selected service
  const selectedService = value 
    ? Object.values(SERVICE_CODES_BY_CATEGORY)
        .flat()
        .find(s => s.code === value)
    : undefined;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between text-left font-normal h-auto min-h-10"
          disabled={disabled}
        >
          {selectedService ? (
            <div className="flex flex-col items-start gap-0.5 py-1">
              <span className="font-medium">
                {selectedService.code} - {selectedService.category}
              </span>
              <span className="text-xs text-muted-foreground line-clamp-1">
                {selectedService.description}
              </span>
            </div>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[500px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Buscar por código, descrição ou CNAE..." />
          <CommandList>
            <CommandEmpty>Nenhum serviço encontrado.</CommandEmpty>
            {SERVICE_CATEGORIES.map((category) => (
              <CommandGroup key={category} heading={category}>
                {SERVICE_CODES_BY_CATEGORY[category].map((service) => (
                  <CommandItem
                    key={`${service.code}-${service.cnae}`}
                    value={`${service.code} ${service.description} ${service.cnae}`}
                    onSelect={() => {
                      onSelect(service);
                      setOpen(false);
                    }}
                    className="flex flex-col items-start gap-1 py-3"
                  >
                    <div className="flex w-full items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Check
                          className={cn(
                            "h-4 w-4",
                            value === service.code ? "opacity-100" : "opacity-0"
                          )}
                        />
                        <span className="font-medium">{service.code}</span>
                        <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                          CNAE {service.cnae}
                        </span>
                      </div>
                      <span className="text-xs font-medium text-primary">
                        ISS {service.aliquota}%
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground pl-6 line-clamp-2">
                      {service.description}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
