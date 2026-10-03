"use client";

import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import styled from "styled-components";

export type MenuItem = {
  label: string;
  hint?: string; // 단축키 표기
  checked?: boolean; // 켜고 끄는 항목(서식)이면 현재 상태
  separatorBefore?: boolean;
  onSelect: () => void;
};

type Props = { x: number; y: number; items: MenuItem[]; onClose: () => void };

// 엑셀식 우클릭 메뉴 (DESIGN.md 14절). 방향키로 이동, Enter로 실행, Esc·바깥 클릭·사용자 스크롤로 닫힌다.
export function ContextMenu({ x, y, items, onClose }: Props) {
  const ref = useRef<HTMLUListElement>(null);
  const [pos, setPos] = useState({ left: x, top: y });

  // 화면 밖으로 나가면 반대쪽으로 펼치고, 첫 항목에 포커스
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    setPos({
      left: x + width > window.innerWidth - 4 ? Math.max(4, x - width) : x,
      top: y + height > window.innerHeight - 4 ? Math.max(4, y - height) : y,
    });
    el.querySelector<HTMLElement>("[role^='menuitem']")?.focus();
  }, [x, y]);

  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    // scroll 이벤트가 아니라 휠·터치로 닫는다 — 우클릭한 셀로 그리드가 스스로 스크롤할 때 메뉴가 바로 닫히지 않게
    const userMoves = ["wheel", "touchmove", "resize"] as const;
    window.addEventListener("pointerdown", onPointerDown, true);
    for (const type of userMoves) window.addEventListener(type, onClose, true);
    // 창이 포커스를 잃을 때만. 캡처로 걸면 메뉴 항목 사이의 포커스 이동까지 잡혀 클릭 전에 닫힌다.
    window.addEventListener("blur", onClose);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown, true);
      for (const type of userMoves) window.removeEventListener(type, onClose, true);
      window.removeEventListener("blur", onClose);
    };
  }, [onClose]);

  const onKeyDown = (e: KeyboardEvent) => {
    const buttons = [...(ref.current?.querySelectorAll<HTMLElement>("[role^='menuitem']") ?? [])];
    const i = buttons.indexOf(document.activeElement as HTMLElement);
    const focus = (n: number) => buttons[(n + buttons.length) % buttons.length]?.focus();
    if (e.key === "ArrowDown") focus(i + 1);
    else if (e.key === "ArrowUp") focus(i - 1);
    else if (e.key === "Home") focus(0);
    else if (e.key === "End") focus(buttons.length - 1);
    else if (e.key === "Escape" || e.key === "Tab") onClose();
    else return;
    e.preventDefault();
  };

  return (
    <Menu ref={ref} role="menu" aria-label="셀 메뉴" style={pos} onKeyDown={onKeyDown} onContextMenu={(e) => e.preventDefault()}>
      {items.map((item) => (
        <li key={item.label} role="none">
          {item.separatorBefore && <Separator />}
          <Item
            type="button"
            role={item.checked === undefined ? "menuitem" : "menuitemcheckbox"}
            aria-checked={item.checked}
            tabIndex={-1}
            onClick={() => {
              onClose();
              item.onSelect();
            }}
          >
            <Check aria-hidden>{item.checked ? "✓" : ""}</Check>
            <span>{item.label}</span>
            {item.hint && <Hint>{item.hint}</Hint>}
          </Item>
        </li>
      ))}
    </Menu>
  );
}

const Menu = styled.ul`
  position: fixed;
  z-index: 20;
  min-width: 200px;
  margin: 0;
  padding: 4px;
  list-style: none;
  border: 1px solid var(--rule);
  border-radius: 6px;
  background: var(--paper);
  box-shadow: 0 8px 24px rgb(30 35 40 / 0.16);
`;

const Separator = styled.div`
  height: 1px;
  margin: 4px 6px;
  background: var(--rule);
`;

const Item = styled.button`
  display: flex;
  align-items: center;
  width: 100%;
  height: 28px;
  padding: 0 10px 0 4px;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: var(--ink);
  font: inherit;
  text-align: left;
  cursor: pointer;

  &:hover,
  &:focus-visible {
    background: var(--header);
    outline: none;
  }
`;

const Check = styled.span`
  width: 20px;
  color: var(--ink);
  text-align: center;
`;

const Hint = styled.span`
  margin-left: auto;
  padding-left: 16px;
  color: var(--ink-muted);
  font-size: 12px;
`;
