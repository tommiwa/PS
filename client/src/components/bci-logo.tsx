import { cn } from "@/lib/utils";
import logoImage from "@assets/logo.png";

interface BCILogoProps {
  size?: "sm" | "md" | "lg" | "xl";
  variant?: "full" | "icon" | "text";
  className?: string;
}

const sizeClasses = {
  sm: {
    container: "gap-1.5",
    icon: "h-6 w-6",
    title: "text-sm",
    subtitle: "text-[10px]",
  },
  md: {
    container: "gap-2",
    icon: "h-8 w-8",
    title: "text-base",
    subtitle: "text-xs",
  },
  lg: {
    container: "gap-2.5",
    icon: "h-10 w-10",
    title: "text-lg",
    subtitle: "text-sm",
  },
  xl: {
    container: "gap-3",
    icon: "h-12 w-12",
    title: "text-xl",
    subtitle: "text-sm",
  }
};

export default function BCILogo({ 
  size = "md", 
  variant = "full", 
  className 
}: BCILogoProps) {
  const sizes = sizeClasses[size];

  if (variant === "icon") {
    return (
      <div className={cn("relative", className)} data-testid="bci-logo-icon">
        <img 
          src={logoImage} 
          alt="BCI ParkShare Logo" 
          className={cn(sizes.icon, "object-contain rounded-md bg-white")}
        />
      </div>
    );
  }

  if (variant === "text") {
    return (
      <div className={cn("text-center", className)} data-testid="bci-logo-text">
        <h1 className={cn(
          "font-bold tracking-tight text-primary",
          sizes.title
        )}>
          BCI ParkShare
        </h1>
        <p className={cn(
          "text-muted-foreground font-medium",
          sizes.subtitle
        )}>
          Spot Sharing System
        </p>
      </div>
    );
  }

  return (
    <div 
      className={cn("flex items-center", sizes.container, className)} 
      data-testid="bci-logo-full"
    >
      <img 
        src={logoImage} 
        alt="BCI ParkShare Logo" 
        className={cn(sizes.icon, "object-contain rounded-md bg-white")}
      />
      <div className="text-left">
        <h1 className={cn(
          "font-semibold tracking-tight text-primary leading-none",
          sizes.title
        )}>
          BCI ParkShare
        </h1>
        <p className={cn(
          "text-muted-foreground font-medium leading-tight",
          sizes.subtitle
        )}>
          Spot Sharing
        </p>
      </div>
    </div>
  );
}

export function BCIHeroLogo({ className }: { className?: string }) {
  return (
    <div className={cn("text-center space-y-4", className)} data-testid="bci-hero-logo">
      <div className="flex justify-center">
        <img 
          src={logoImage} 
          alt="BCI ParkShare Logo" 
          className="h-16 w-16 object-contain rounded-lg bg-white shadow-sm"
        />
      </div>
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-primary">
          BCI ParkShare
        </h1>
        <p className="text-sm text-muted-foreground">
          Spot Sharing Application
        </p>
      </div>
    </div>
  );
}
