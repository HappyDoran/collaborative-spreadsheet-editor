import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

// 이름: localStorage — 이 브라우저 사용자의 반영구 이름. 모든 탭이 공유한다.
// 색: sessionStorage — 탭마다 다른 참여자를 구분한다. 새로고침해도 유지된다 (DESIGN.md 12절).
// skipHydration: 서버 렌더와 첫 클라이언트 렌더를 맞추고, 마운트 후 hooks/useIdentity가 읽어 온다.

const NAME_KEY = "sheet:participant-name";

type NameState = { name: string | null; setName: (name: string) => void; clearName: () => void };
export const useNameStore = create<NameState>()(
  persist(
    (set) => ({
      name: null,
      setName: (name) => set({ name }),
      clearName: () => set({ name: null }),
    }),
    { name: NAME_KEY, storage: createJSONStorage(() => localStorage), skipHydration: true },
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

// 다른 탭에서 이름을 바꾸거나 지우면 이 탭도 따라간다.
export function syncNameAcrossTabs(): () => void {
  const onStorage = (e: StorageEvent) => {
    if (e.key === NAME_KEY) void useNameStore.persist.rehydrate();
  };
  window.addEventListener("storage", onStorage);
  return () => window.removeEventListener("storage", onStorage);
}
