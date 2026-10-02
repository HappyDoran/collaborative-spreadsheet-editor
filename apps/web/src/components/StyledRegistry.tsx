"use client";

import { useServerInsertedHTML } from "next/navigation";
import { useState, type ReactNode } from "react";
import { ServerStyleSheet, StyleSheetManager } from "styled-components";

// App Router SSR에서 styled-components 스타일을 HTML에 넣는다 (Next.js 공식 패턴).
export function StyledRegistry({ children }: { children: ReactNode }) {
  const [sheet] = useState(() => new ServerStyleSheet());
  useServerInsertedHTML(() => {
    const styles = sheet.getStyleElement();
    sheet.instance.clearTag();
    return <>{styles}</>;
  });
  if (typeof window !== "undefined") return <>{children}</>;
  return <StyleSheetManager sheet={sheet.instance}>{children}</StyleSheetManager>;
}
