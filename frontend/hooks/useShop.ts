"use client";

import { useState, useCallback } from "react";

interface UseShopResult {
  shopDomain: string;
  setShopDomain: (domain: string) => void;
}

export function useShop(): UseShopResult {
  const [shopDomain, setShopDomainState] = useState<string>(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      return params.get("shop") || localStorage.getItem("shopDomain") || "";
    }
    return "";
  });

  const setShopDomain = useCallback((domain: string) => {
    setShopDomainState(domain);
    if (typeof window !== "undefined") {
      localStorage.setItem("shopDomain", domain);
    }
  }, []);

  return { shopDomain, setShopDomain };
}
