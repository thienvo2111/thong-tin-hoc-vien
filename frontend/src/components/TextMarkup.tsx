import { Fragment, type ReactNode } from 'react';
import { Code } from '@mantine/core';

const QUY_TAC = /\*\*(.+?)\*\*|\*(.+?)\*|\[\[(.+?)\]\]/g;

/** Hiển thị markup nội tuyến nhẹ dùng trong nội dung hướng dẫn: **đậm**, *nghiêng*, [[Nhãn UI]]
 * (hiện như 1 chip giống phím/nút). Không dùng dangerouslySetInnerHTML. */
export function TextMarkup({ text }: { text: string }): ReactNode {
  const parts: ReactNode[] = [];
  let lastIndex = 0;
  let key = 0;
  let match: RegExpExecArray | null;

  QUY_TAC.lastIndex = 0;
  while ((match = QUY_TAC.exec(text))) {
    if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index));
    const [, dam, nghieng, nhanUi] = match;
    if (dam !== undefined) {
      parts.push(<strong key={key++}>{dam}</strong>);
    } else if (nghieng !== undefined) {
      parts.push(<em key={key++}>{nghieng}</em>);
    } else if (nhanUi !== undefined) {
      parts.push(
        <Code key={key++} fw={600}>
          {nhanUi}
        </Code>,
      );
    }
    lastIndex = QUY_TAC.lastIndex;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));

  return <Fragment>{parts}</Fragment>;
}
