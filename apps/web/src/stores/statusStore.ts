import { create } from "zustand";

// 상태 표시줄에 잠깐 띄우는 안내 (엑셀처럼 하단에 짧게). 같은 안내가 연달아 와도 시간을 새로 센다.
const NOTICE_MS = 4_000;

type StatusState = { notice: string | null; show: (text: string) => void };

let timer: ReturnType<typeof setTimeout> | undefined;

export const useStatusStore = create<StatusState>()((set) => ({
  notice: null,
  show: (text) => {
    clearTimeout(timer);
    set({ notice: text });
    timer = setTimeout(() => set({ notice: null }), NOTICE_MS);
  },
}));
