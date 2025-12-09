import { cn } from "@/lib/utils";
import logoImage from "@assets/logo.png";

interface BCILogoProps {
  size?: "sm" | "md" | "lg" | "xl";
  variant?: "full" | "icon" | "text";
  className?: string;
}

const sizeClasses = {
  sm: {
    container: "gap-2",
    icon: "h-8",
    title: "text-lg",
    subtitle: "text-xs",
  },
  md: {
    container: "gap-3",
    icon: "h-12",
    title: "text-2xl",
    subtitle: "text-sm",
  },
  lg: {
    container: "gap-4",
    icon: "h-16",
    title: "text-3xl",
    subtitle: "text-base",
  },
  xl: {
    container: "gap-5",
    icon: "h-20",
    title: "text-4xl",
    subtitle: "text-lg",
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
          className={cn(sizes.icon, "w-auto object-contain")}
        />
      </div>
    );
  }

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
          ParkShare System
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
        className={cn(sizes.icon, "w-auto object-contain")}
      />
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
          ParkShare System
        </p>
      </div>
    </div>
  );
}

export function BCIHeroLogo({ className }: { className?: string }) {
  return (
    <div className={cn("text-center space-y-6", className)} data-testid="bci-hero-logo">
      <div className="flex justify-center">
        <img 
          src={logoImage} 
          alt="BCI ParkShare Logo" 
          className="h-24 w-auto object-contain"
        />
      </div>
      <div className="space-y-1">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          BCI ParkShare
        </h1>
        <p className="text-sm text-muted-foreground">
          Spot Sharing Application
        </p>
      </div>
    </div>
  );
}
