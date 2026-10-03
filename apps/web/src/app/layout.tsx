import type { Metadata } from "next";
import { StyledRegistry } from "@/components/StyledRegistry";
import "pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "공동 편집 시트",
  description: "여러 탭에서 함께 편집하고 AI로 편집을 제안받는 스프레드시트",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>
        <StyledRegistry>{children}</StyledRegistry>
      </body>
    </html>
  );
}
