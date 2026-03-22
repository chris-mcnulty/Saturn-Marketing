import React from "react";
import { useMarket } from "@/lib/market-context";
import { ChevronDown, MapPin } from "lucide-react";

export function MarketPicker() {
  const { markets, activeMarket, setActiveMarketId } = useMarket();
  const [isOpen, setIsOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (markets.length <= 1) {
    return (
      <div className="px-3 py-2 rounded-xl bg-sidebar-accent/30 flex items-center gap-2">
        <MapPin className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
        <span className="text-xs font-medium truncate text-sidebar-foreground/80">
          {activeMarket?.name || "No market"}
        </span>
      </div>
    );
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-3 py-2 rounded-xl bg-sidebar-accent/30 hover:bg-sidebar-accent/50 flex items-center gap-2 transition-colors"
      >
        <MapPin className="w-3.5 h-3.5 text-primary flex-shrink-0" />
        <span className="text-xs font-medium truncate flex-1 text-left text-sidebar-foreground/80">
          {activeMarket?.name || "Select market"}
        </span>
        <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-popover border border-border rounded-xl shadow-lg overflow-hidden">
          {markets.map((market) => (
            <button
              key={market.id}
              onClick={() => {
                setActiveMarketId(market.id);
                setIsOpen(false);
              }}
              className={`w-full px-3 py-2 text-left text-xs font-medium transition-colors flex items-center gap-2 ${
                market.id === activeMarket?.id
                  ? "bg-primary/10 text-primary"
                  : "text-foreground hover:bg-accent"
              }`}
            >
              <MapPin className="w-3 h-3 flex-shrink-0" />
              <span className="truncate">{market.name}</span>
              {market.isDefault && (
                <span className="ml-auto text-[10px] text-muted-foreground">default</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
