// Chuẩn hóa Unicode NFC + gọn khoảng trắng trước khi lưu tên danh mục
// (validation-checklist.md #41, áp dụng tương tự #3/#5 cho ho_ten).
export function normalizeNfcName(value: string): string {
  return value.normalize('NFC').trim().replace(/\s+/g, ' ');
}
