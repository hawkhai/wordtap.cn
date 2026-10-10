export const staticSections: string[];
export function generateStaticSite(dataRoot?: string): Promise<void>;
export function renderStaticPage(pathname: string, dataRoot?: string): Promise<string | null | undefined>;
