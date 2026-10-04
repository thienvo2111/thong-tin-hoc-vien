import { Fragment, type ReactNode } from 'react';
import { Anchor, Code } from '@mantine/core';
import { Link } from 'react-router-dom';

const QUY_TAC = /\*\*(.+?)\*\*|\*(.+?)\*|\[\[(.+?)\]\]/g;
const RE_PHAN = /\bPhần (\d+)\b/g;

export interface TextMarkupProps {
  text: string;
  /** Khi có, biến các cụm "Phần N" (nguyên từ, kể cả khi nằm trong **đậm**) thành liên kết — trả
   * về href ("#id" để cuộn trong trang, hoặc "/duong-dan#id" để điều hướng sang trang khác qua
   * react-router). Trả về undefined thì giữ nguyên văn bản (không có phần đó). */
  lienKetPhan?: (so: number) => string | undefined;
}

/** Hiển thị markup nội tuyến nhẹ dùng trong nội dung hướng dẫn: **đậm**, *nghiêng*, [[Nhãn UI]]
 * (hiện như 1 chip giống phím/nút), và tuỳ chọn biến "Phần N" thành liên kết qua lienKetPhan.
 * Không dùng dangerouslySetInnerHTML. */
export function TextMarkup({ text, lienKetPhan }: TextMarkupProps): ReactNode {
  const parts: ReactNode[] = [];
  let lastIndex = 0;
  let key = 0;
  const idTiep = () => key++;
  let match: RegExpExecArray | null;

  QUY_TAC.lastIndex = 0;
  while ((match = QUY_TAC.exec(text))) {
    if (match.index > lastIndex) parts.push(...tachLienKetPhan(text.slice(lastIndex, match.index), lienKetPhan, idTiep));
    const [, dam, nghieng, nhanUi] = match;
    if (dam !== undefined) {
      parts.push(<strong key={idTiep()}>{tachLienKetPhan(dam, lienKetPhan, idTiep)}</strong>);
    } else if (nghieng !== undefined) {
      parts.push(<em key={idTiep()}>{tachLienKetPhan(nghieng, lienKetPhan, idTiep)}</em>);
    } else if (nhanUi !== undefined) {
      parts.push(
        <Code key={idTiep()} fw={600}>
          {nhanUi}
        </Code>,
      );
    }
    lastIndex = QUY_TAC.lastIndex;
  }
  if (lastIndex < text.length) parts.push(...tachLienKetPhan(text.slice(lastIndex), lienKetPhan, idTiep));

  return <Fragment>{parts}</Fragment>;
}

/** Thay mỗi "Phần N" trong đoạn bằng <LienKetPhan> nếu lienKetPhan trả về href; số không có phần
 * tương ứng thì giữ nguyên văn bản gốc. Không có lienKetPhan thì trả nguyên đoạn (không đổi hành vi). */
function tachLienKetPhan(
  doan: string,
  lienKetPhan: ((so: number) => string | undefined) | undefined,
  idTiep: () => number,
): ReactNode[] {
  if (!lienKetPhan) return [doan];

  const ketQua: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  RE_PHAN.lastIndex = 0;
  while ((match = RE_PHAN.exec(doan))) {
    const href = lienKetPhan(Number(match[1]));
    if (href === undefined) continue;
    if (match.index > lastIndex) ketQua.push(doan.slice(lastIndex, match.index));
    ketQua.push(<LienKetPhan key={idTiep()} href={href} nhan={match[0]} />);
    lastIndex = RE_PHAN.lastIndex;
  }
  if (lastIndex === 0) return [doan];
  if (lastIndex < doan.length) ketQua.push(doan.slice(lastIndex));
  return ketQua;
}

/** href bắt đầu bằng "#" là neo trong trang hiện tại (thẻ a thường, trình duyệt tự cuộn); còn lại
 * là route nội bộ khác trang, dùng Link để điều hướng trong ứng dụng, không tải lại trang. */
function LienKetPhan({ href, nhan }: { href: string; nhan: string }) {
  return href.startsWith('#') ? (
    <Anchor href={href} fw={600}>
      {nhan}
    </Anchor>
  ) : (
    <Anchor component={Link} to={href} fw={600}>
      {nhan}
    </Anchor>
  );
}
