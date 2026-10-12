import { cache } from "react";
import { getSettings } from "@/lib/data";
import { DESIGN_CONTENT_KEY, parseDesignContent } from "@/lib/design-content";

export const getDesignContent = cache(async () => {
  const settings = await getSettings();
  return parseDesignContent(settings[DESIGN_CONTENT_KEY]);
});
