import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

// 탭 = 참여자 (DESIGN.md 12절). 이름·색은 탭 단위 sessionStorage — 새로고침해도 유지되고 다른 탭과 섞이지 않는다.
// localStorage에는 마지막에 쓴 이름만 둔다. 새 탭의 이름 입력 화면에 기본값으로 채울 뿐, 참여자 이름 자체는 아니다.
// skipHydration: 서버 렌더와 첫 클라이언트 렌더를 맞추고, 마운트 후 hooks/useIdentity가 읽어 온다.

const LAST_NAME_KEY = "sheet:last-name";

export function readLastName(): string {
  try {
    return localStorage.getItem(LAST_NAME_KEY) ?? "";
  } catch {
    return ""; // 저장소 접근이 막힌 환경 — 기본값 없이 시작
  }
}

function writeLastName(name: string | null) {
  try {
    if (name) localStorage.setItem(LAST_NAME_KEY, name);
    else localStorage.removeItem(LAST_NAME_KEY);
  } catch {
    // 기본값 저장 실패는 이름 사용에 영향이 없다
  }
}

type NameState = { name: string | null; setName: (name: string) => void; clearName: () => void };
export const useNameStore = create<NameState>()(
  persist(
    (set) => ({
      name: null,
      setName: (name) => {
        set({ name });
        writeLastName(name);
      },
      clearName: () => {
        set({ name: null });
        writeLastName(null);
      },
    }),
    { name: "sheet:participant-name", storage: createJSONStorage(() => sessionStorage), skipHydration: true },
  ),
);

type ColorState = { color: string | null; setColor: (color: string) => void };
export const useColorStore = create<ColorState>()(
  persist((set) => ({ color: null, setColor: (color) => set({ color }) }), {
    name: "sheet:participant-color",
    storage: createJSONStorage(() => sessionStorage),
    skipHydration: true,
  }),
);
