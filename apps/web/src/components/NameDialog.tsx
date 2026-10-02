"use client";

import { NAME_MAX_LENGTH, normalizeName } from "@sheet/core";
import { useEffect, useRef, useState } from "react";
import styled from "styled-components";

// 처음 접속했을 때 이름을 정한다. 이름 없이 시트를 쓸 수 없으므로 Esc로 닫히지 않는다.
export function NameDialog({ onSubmit }: { onSubmit: (name: string) => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [value, setValue] = useState("");
  const [error, setError] = useState(false);

  useEffect(() => {
    ref.current?.showModal();
  }, []);

  return (
    <Dialog ref={ref} aria-labelledby="name-dialog-title" onCancel={(e) => e.preventDefault()}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const name = normalizeName(value);
          if (name) onSubmit(name);
          else setError(true);
        }}
      >
        <Heading id="name-dialog-title">함께 편집할 이름</Heading>
        <Help>다른 참여자에게 이 이름과 색으로 보여요. 오른쪽 위에서 언제든 바꿀 수 있어요.</Help>
        <Input
          autoFocus
          aria-label="이름"
          aria-invalid={error}
          aria-describedby={error ? "name-dialog-error" : undefined}
          maxLength={NAME_MAX_LENGTH}
          placeholder="예: 김서연"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setError(false);
          }}
        />
        {error && <Error id="name-dialog-error">이름을 한 글자 이상 입력하세요.</Error>}
        <Submit type="submit">시작하기</Submit>
      </form>
    </Dialog>
  );
}

const Dialog = styled.dialog`
  width: min(360px, calc(100vw - 32px));
  padding: 24px;
  border: 1px solid var(--rule);
  border-radius: 8px;
  background: var(--paper);
  color: var(--ink);

  &::backdrop {
    background: rgb(30 35 40 / 0.32);
  }
`;

const Heading = styled.h2`
  margin: 0 0 6px;
  font-size: 17px;
  font-weight: 650;
`;

const Help = styled.p`
  margin: 0 0 16px;
  color: var(--ink-muted);
  line-height: 1.5;
`;

const Input = styled.input`
  display: block;
  width: 100%;
  height: 36px;
  padding: 0 10px;
  border: 1px solid var(--rule);
  border-radius: 4px;
  background: #fff;
  color: var(--ink);
  font: inherit;
  font-size: 14px;

  &:focus {
    outline: 2px solid var(--ink);
    outline-offset: -1px;
  }
  &[aria-invalid="true"] {
    border-color: #b42318;
  }
`;

const Error = styled.p`
  margin: 6px 0 0;
  color: #b42318;
  font-size: 12px;
`;

const Submit = styled.button`
  width: 100%;
  height: 36px;
  margin-top: 16px;
  border: 0;
  border-radius: 4px;
  background: var(--ink);
  color: #fff;
  font: inherit;
  font-weight: 600;
  cursor: pointer;

  &:focus-visible {
    outline: 2px solid var(--ink);
    outline-offset: 2px;
  }
`;
