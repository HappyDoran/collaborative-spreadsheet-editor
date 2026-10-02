"use client";

import { useEffect, useState } from "react";
import { syncNameAcrossTabs, useColorStore, useNameStore } from "@/stores/identityStore";

// 저장된 이름·색을 마운트 후에 읽어 온다. 읽기 전(hydrated=false)에는 이름 입력 화면을 띄우지 않는다.
export function useIdentity() {
  const [hydrated, setHydrated] = useState(false);
  const name = useNameStore((s) => s.name);
  const color = useColorStore((s) => s.color);

  useEffect(() => {
    void Promise.all([useNameStore.persist.rehydrate(), useColorStore.persist.rehydrate()]).then(() =>
      setHydrated(true),
    );
    return syncNameAcrossTabs();
  }, []);

  return { hydrated, name, color };
}
