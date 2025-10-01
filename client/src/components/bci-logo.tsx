import { Building2, Car } from "lucide-react";
import { cn } from "@/lib/utils";

interface BCILogoProps {
  size?: "sm" | "md" | "lg" | "xl";
  variant?: "full" | "icon" | "text";
  className?: string;
}

const sizeClasses = {
  sm: {
    container: "gap-2",
    icon: "h-8 w-8",
    iconInner: "h-4 w-4",
    title: "text-lg",
    subtitle: "text-xs",
    iconBg: "p-2"
  },
  md: {
    container: "gap-3",
    icon: "h-12 w-12",
    iconInner: "h-6 w-6",
    title: "text-2xl",
    subtitle: "text-sm",
    iconBg: "p-3"
  },
  lg: {
    container: "gap-4",
    icon: "h-16 w-16",
    iconInner: "h-8 w-8",
    title: "text-3xl",
    subtitle: "text-base",
    iconBg: "p-4"
  },
  xl: {
    container: "gap-5",
    icon: "h-20 w-20",
    iconInner: "h-10 w-10",
    title: "text-4xl",
    subtitle: "text-lg",
    iconBg: "p-5"
  }
};

export default function BCILogo({ 
  size = "md", 
  variant = "full", 
  className 
}: BCILogoProps) {
  const sizes = sizeClasses[size];

  // Icon only variant
  if (variant === "icon") {
    return (
      <div className={cn("relative", className)} data-testid="bci-logo-icon">
        <div className={cn(
          "rounded-xl bg-gradient-to-br from-primary to-primary/80 shadow-lg flex items-center justify-center",
          sizes.icon,
          sizes.iconBg
        )}>
          <div className="relative">
            <Building2 className={cn("text-primary-foreground", sizes.iconInner)} />
            <Car className={cn(
              "absolute -bottom-1 -right-1 text-primary-foreground/90",
              size === "sm" ? "h-2 w-2" : size === "md" ? "h-3 w-3" : size === "lg" ? "h-4 w-4" : "h-5 w-5"
            )} />
          </div>
        </div>
      </div>
    );
  }

  // Text only variant
  if (variant === "text") {
    return (
      <div className={cn("text-center", className)} data-testid="bci-logo-text">
        <h1 className={cn(
          "font-bold tracking-tight text-foreground",
          sizes.title
        )}>
          BCI
        </h1>
        <p className={cn(
          "text-muted-foreground font-medium",
          sizes.subtitle
        )}>
          Parking Management System
        </p>
      </div>
    );
  }

  // Full logo with icon and text
  return (
    <div 
      className={cn("flex items-center", sizes.container, className)} 
      data-testid="bci-logo-full"
    >
      {/* Icon */}
      <div className="relative">
        <div className={cn(
          "rounded-xl bg-gradient-to-br from-primary to-primary/80 shadow-lg flex items-center justify-center",
          sizes.icon,
          sizes.iconBg
        )}>
          <div className="relative">
            <Building2 className={cn("text-primary-foreground", sizes.iconInner)} />
            <Car className={cn(
              "absolute -bottom-1 -right-1 text-primary-foreground/90",
              size === "sm" ? "h-2 w-2" : size === "md" ? "h-3 w-3" : size === "lg" ? "h-4 w-4" : "h-5 w-5"
            )} />
          </div>
        </div>
      </div>

      {/* Text */}
      <div className="text-left">
        <h1 className={cn(
          "font-bold tracking-tight text-foreground leading-none",
          sizes.title
        )}>
          BCI
        </h1>
        <p className={cn(
          "text-muted-foreground font-medium leading-tight",
          sizes.subtitle
        )}>
          Parking Management System
        </p>
      </div>
    </div>
  );
}

// Corporate BCI Hero Logo for large displays
export function BCIHeroLogo({ className }: { className?: string }) {
  return (
    <div className={cn("text-center space-y-6", className)} data-testid="bci-hero-logo">
      {/* Simple Professional Logo */}
      <div className="flex justify-center">
        <div className="h-16 w-16 rounded-lg bg-primary flex items-center justify-center">
          <Car className="h-8 w-8 text-primary-foreground" />
        </div>
      </div>

      {/* Clean Typography */}
      <div className="space-y-1">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          BCI Parking
        </h1>
        <p className="text-sm text-muted-foreground">
          Spot Sharing Application
        </p>
      </div>
    </div>
  );
}