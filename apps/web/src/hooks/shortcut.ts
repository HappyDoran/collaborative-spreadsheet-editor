// 단축키 표기. Mac은 ⌘, 그 밖은 Ctrl (DESIGN.md 7절)
export const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);
export const shortcut = (key: string) => (isMac ? `⌘${key}` : `Ctrl+${key}`);
