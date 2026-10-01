import type { ComboboxItem, ComboboxParsedItem, OptionsFilter } from '@mantine/core';

/**
 * Chuẩn hóa chuỗi để so khớp tìm kiếm tiếng Việt không phân biệt dấu/hoa-thường: NFC rồi NFD để
 * tách dấu ra khỏi ký tự gốc, bỏ mọi dấu (\p{M}), đổi đ/Đ -> d/D (không phải tổ hợp dấu nên NFD
 * không tự tách), hạ chữ thường, gộp khoảng trắng liên tiếp.
 */
export function chuanHoaTimKiem(s: string): string {
  return s
    .normalize('NFC')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** true nếu MỌI từ trong tuKhoa là chuỗi con của nhan sau khi đã chuẩn hóa (tuKhoa rỗng -> true). */
export function khopTimKiem(nhan: string, tuKhoa: string): boolean {
  const nhanChuanHoa = chuanHoaTimKiem(nhan);
  const tuKhoaChuanHoa = chuanHoaTimKiem(tuKhoa);
  if (!tuKhoaChuanHoa) return true;
  return tuKhoaChuanHoa.split(' ').every((tu) => nhanChuanHoa.includes(tu));
}

function locDanhSach(items: ComboboxItem[], search: string, limit: number): ComboboxItem[] {
  const result: ComboboxItem[] = [];
  for (const item of items) {
    if (result.length === limit) return result;
    if (khopTimKiem(item.label, search)) result.push(item);
  }
  return result;
}

/** Prop `filter` cho Mantine Select/Autocomplete/MultiSelect — thay bộ lọc substring mặc định
 * (vốn không khớp khi gõ không dấu hoặc bộ gõ tiếng Việt sinh ra chuỗi NFD) bằng khopTimKiem. */
export const locTiengViet: OptionsFilter = ({ options, search, limit }) => {
  const result: ComboboxParsedItem[] = [];
  for (const item of options) {
    if (result.length === limit) return result;
    if ('group' in item) {
      result.push({
        group: item.group,
        items: locDanhSach(item.items, search, limit - result.length),
      });
    } else if (khopTimKiem(item.label, search)) {
      result.push(item);
    }
  }
  return result;
};
