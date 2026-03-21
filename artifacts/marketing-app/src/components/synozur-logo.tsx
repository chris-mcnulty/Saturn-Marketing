import synozurLogoColor from "@/assets/logos/SynozurLogo-color.png";
import synozurLogoWhite from "@/assets/logos/SynozurLogo-white.png";
import synozurHorizontalColor from "@/assets/logos/SA-Logo-Horizontal-color.png";
import synozurHorizontalWhite from "@/assets/logos/SA-Logo-Horizontal-white.png";
import { useTheme } from "@/lib/theme-context";

export function SynozurLogo({
  className = "w-10 h-10",
  variant,
}: {
  className?: string;
  variant?: "color" | "white";
}) {
  const { resolvedTheme } = useTheme();
  const resolved = variant ?? (resolvedTheme === "dark" ? "white" : "color");

  return (
    <img
      src={resolved === "white" ? synozurLogoWhite : synozurLogoColor}
      alt="Synozur Logo"
      className={className}
    />
  );
}

export function SynozurTextLogo({
  className = "",
  variant,
}: {
  className?: string;
  variant?: "color" | "white";
}) {
  const { resolvedTheme } = useTheme();
  const resolved = variant ?? (resolvedTheme === "dark" ? "white" : "color");

  return (
    <img
      src={resolved === "white" ? synozurHorizontalWhite : synozurHorizontalColor}
      alt="Synozur Alliance"
      className={`h-8 ${className}`}
    />
  );
}
