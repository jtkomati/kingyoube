import * as React from "react";
import { Eye, EyeOff, CheckCircle2, XCircle, Circle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface PasswordRequirement {
  label: string;
  test: (password: string) => boolean;
}

const requirements: PasswordRequirement[] = [
  { label: "Mínimo 8 caracteres", test: (p) => p.length >= 8 },
  { label: "Uma letra maiúscula", test: (p) => /[A-Z]/.test(p) },
  { label: "Uma letra minúscula", test: (p) => /[a-z]/.test(p) },
  { label: "Um número", test: (p) => /[0-9]/.test(p) },
  { label: "Um caractere especial", test: (p) => /[^A-Za-z0-9]/.test(p) },
];

export interface PasswordInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  showStrength?: boolean;
  onStrengthChange?: (strength: number) => void;
}

const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ className, showStrength = false, onStrengthChange, ...props }, ref) => {
    const [showPassword, setShowPassword] = React.useState(false);
    const [password, setPassword] = React.useState("");
    const [strength, setStrength] = React.useState(0);

    React.useEffect(() => {
      if (!showStrength) return;
      
      const passedRequirements = requirements.filter((req) =>
        req.test(password)
      ).length;
      
      const newStrength = (passedRequirements / requirements.length) * 100;
      setStrength(newStrength);
      onStrengthChange?.(newStrength);
    }, [password, showStrength, onStrengthChange]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      setPassword(e.target.value);
      props.onChange?.(e);
    };

    const getStrengthColor = () => {
      if (strength < 40) return "bg-destructive";
      if (strength < 80) return "bg-warning";
      return "bg-success";
    };

    const getStrengthLabel = () => {
      if (strength < 40) return "Fraca";
      if (strength < 80) return "Média";
      return "Forte";
    };

    return (
      <div className="space-y-2">
        <div className="relative">
          <Input
            type={showPassword ? "text" : "password"}
            className={cn("pr-10", className)}
            ref={ref}
            {...props}
            onChange={handleChange}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            tabIndex={-1}
          >
            {showPassword ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </button>
        </div>

        {showStrength && password && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className={cn(
                    "h-full transition-all duration-300",
                    getStrengthColor()
                  )}
                  style={{ width: `${strength}%` }}
                />
              </div>
              <span className="text-xs font-medium text-muted-foreground min-w-[50px]">
                {getStrengthLabel()}
              </span>
            </div>

            <div className="space-y-1">
              {requirements.map((req, index) => {
                const passed = req.test(password);
                return (
                  <div
                    key={index}
                    className="flex items-center gap-2 text-xs"
                  >
                    {passed ? (
                      <CheckCircle2 className="h-3 w-3 text-success" />
                    ) : password ? (
                      <XCircle className="h-3 w-3 text-destructive" />
                    ) : (
                      <Circle className="h-3 w-3 text-muted-foreground" />
                    )}
                    <span
                      className={cn(
                        "transition-colors",
                        passed
                          ? "text-success"
                          : password
                          ? "text-destructive"
                          : "text-muted-foreground"
                      )}
                    >
                      {req.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  }
);
PasswordInput.displayName = "PasswordInput";

export { PasswordInput };
