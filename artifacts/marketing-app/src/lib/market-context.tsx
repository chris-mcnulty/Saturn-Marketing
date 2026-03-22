import React, { createContext, useContext, useState, useEffect } from "react";
import { useAuth } from "./auth-context";
import type { Market } from "@workspace/api-client-react";

interface MarketContextType {
  markets: Market[];
  activeMarket: Market | null;
  setActiveMarketId: (id: number) => void;
}

const MarketContext = createContext<MarketContextType>({
  markets: [],
  activeMarket: null,
  setActiveMarketId: () => {},
});

const STORAGE_KEY = "saturn_active_market_id";

export const MarketProvider = ({ children }: { children: React.ReactNode }) => {
  const { markets: authMarkets } = useAuth();
  const [activeMarketId, setActiveMarketId] = useState<number | null>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? parseInt(stored, 10) : null;
  });

  const activeMarkets = (authMarkets || []).filter(m => m.status === "active");

  useEffect(() => {
    if (activeMarkets.length === 0) return;

    const storedValid = activeMarketId && activeMarkets.some(m => m.id === activeMarketId);
    if (!storedValid) {
      const defaultMarket = activeMarkets.find(m => m.isDefault) || activeMarkets[0];
      if (defaultMarket) {
        setActiveMarketId(defaultMarket.id);
        localStorage.setItem(STORAGE_KEY, String(defaultMarket.id));
      }
    }
  }, [activeMarkets, activeMarketId]);

  const handleSetActiveMarketId = (id: number) => {
    setActiveMarketId(id);
    localStorage.setItem(STORAGE_KEY, String(id));
  };

  const activeMarket = activeMarkets.find(m => m.id === activeMarketId) || null;

  return (
    <MarketContext.Provider
      value={{
        markets: activeMarkets,
        activeMarket,
        setActiveMarketId: handleSetActiveMarketId,
      }}
    >
      {children}
    </MarketContext.Provider>
  );
};

export const useMarket = () => useContext(MarketContext);
