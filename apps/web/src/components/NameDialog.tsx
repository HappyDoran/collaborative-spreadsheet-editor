"use client";

import { NAME_MAX_LENGTH, normalizeName } from "@sheet/core";
import { useEffect, useRef, useState } from "react";
import styled from "styled-components";

// 탭이 처음 시트에 들어올 때 이름을 정한다 (탭 = 참여자). 마지막에 쓴 이름을 미리 채워 Enter 한 번이면 된다.
// 이름 없이 시트를 쓸 수 없으므로 Esc로 닫히지 않는다.
export function NameDialog({ defaultName, onSubmit }: { defaultName: string; onSubmit: (name: string) => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [value, setValue] = useState(defaultName);
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
        <Help>
          이 탭에서 다른 참여자에게 보일 이름이에요. 오른쪽 위에서 언제든 바꿀 수 있어요. 같은 브라우저에서 이 주소를 새
          탭으로 열면 그 탭은 다른 참여자가 되어 함께 편집해요.
        </Help>
        <Input
          autoFocus
          onFocus={(e) => e.currentTarget.select()}
          aria-label="이름"
          aria-invalid={error}
          aria-describedby={error ? "name-dialog-error" : undefined}
          maxLength={NAME_MAX_LENGTH}
          placeholder="예: Anonymous"
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
    border-color: var(--danger);
  }
`;

const Error = styled.p`
  margin: 6px 0 0;
  color: var(--danger);
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
