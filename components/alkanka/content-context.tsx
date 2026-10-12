"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { defaultDesignContent, type DesignContent } from "@/lib/design-content";

const ContentContext = createContext<DesignContent | null>(null);

export function DesignContentProvider({ value, children }: { value: DesignContent; children: ReactNode }) {
  return <ContentContext.Provider value={value}>{children}</ContentContext.Provider>;
}

export function useDesignContent() {
  const value = useContext(ContentContext);
  const fallback = useMemo(() => defaultDesignContent(), []);
  return value ?? fallback;
}
