import type { CellAddress, CellRange } from "../address";

// 서버 라우트와 브라우저가 함께 쓰는 AI 편집 계약 (DESIGN.md 13절).

// AI가 바꿀 수 있는 곳. null = 시트 전체.
export type AiScope = CellRange | null;

// 모델 출력 배열의 항목 하나. reply는 설명, edit는 셀 하나의 새 값.
export type AiItem = { kind: "reply" | "edit"; cell: string; text: string };

export type AiErrorCode =
  | "network" // 브라우저 ↔ 서버 연결 끊김
  | "timeout" // 일정 시간 아무것도 오지 않음
  | "invalid" // 모델이 형식에 맞지 않게 답함
  | "rate" // 요청이 몰림
  | "too_large" // 요청 크기 상한 초과
  | "quota" // 사용 한도(선불 크레딧) 소진
  | "config" // 키 없음·권한 부족
  | "upstream"; // 그 밖의 AI 서비스 오류

// 서버 → 브라우저 NDJSON 한 줄
export type AiStreamEvent =
  | { type: "reply"; text: string }
  | { type: "edit"; cell: string; value: string }
  | { type: "done" }
  | { type: "error"; code: AiErrorCode };

export type AiRequestBody = {
  instruction: string;
  scope: AiScope;
  context: string; // sheetContext() 결과
  mock?: boolean; // 가짜 응답 모드 (디버깅·자동 테스트)
};

export type ProposedEdit = { addr: CellAddress; before: string; after: string };
