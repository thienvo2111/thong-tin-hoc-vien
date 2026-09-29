import { createTheme, type MantineColorsTuple } from '@mantine/core';

// Design tokens theo design/redesign-spec.md § 1. Bảng màu gốc (mã hex) — logo & bộ nhận diện HCMUE.
const primary: MantineColorsTuple = [
  '#f1f5f8',
  '#bad1e5',
  '#80b0d8',
  '#4592d1',
  '#2575b7',
  '#185a90',
  '#124874',
  '#0f3c61',
  '#0b304e',
  '#08243a',
];

const accent: MantineColorsTuple = [
  '#f8f1f2',
  '#ebcfd0',
  '#e1abad',
  '#da888c',
  '#d5676c',
  '#d24b50',
  '#CF373D',
  '#a0252a',
  '#6b181b',
  '#360c0d',
];

const success: MantineColorsTuple = [
  '#f1f8f6',
  '#bce6d8',
  '#83dabe',
  '#49d4a7',
  '#24c08d',
  '#189b70',
  '#12805C',
  '#0e694b',
  '#0b523b',
  '#083b2a',
];

// shade 0 = #FEF3E6 (nền badge "chờ duyệt" trong dac-ta), shade 6 = #B54708 (chữ/icon).
const warning: MantineColorsTuple = [
  '#FEF3E6',
  '#eacfc0',
  '#e4ab8b',
  '#e48853',
  '#e8671d',
  '#ce530d',
  '#B54708',
  '#8e3806',
  '#672804',
  '#401903',
];

// shade 0 = #FDEEEC (nền badge "từ chối/lỗi"), shade 6 = #CF373D (chữ/icon) — trùng accent.
const danger: MantineColorsTuple = [
  '#FDEEEC',
  '#ebcfd0',
  '#e1abad',
  '#da888c',
  '#d5676c',
  '#d24b50',
  '#CF373D',
  '#a0252a',
  '#6b181b',
  '#360c0d',
];

// Token dùng lại ở các phase sau cho nền trang/card/viền/chữ phụ (design/redesign-spec.md § 1).
export const tokenKhac = {
  bg: '#F5F7FA',
  surface: '#FFFFFF',
  border: '#E4E7EC',
  textSecondary: '#667085',
};

// Mobile-first: ô nhập lớn, dễ bấm bằng ngón tay (CLAUDE.md § Người dùng).
export const theme = createTheme({
  primaryColor: 'primary',
  colors: { primary, accent, success, warning, danger },
  fontFamily: "'Be Vietnam Pro', sans-serif",
  defaultRadius: 'md', // 8px — khớp token "Bo góc: 8px (input/button)"
  fontSizes: { md: '16px' },
  other: tokenKhac,
  components: {
    TextInput: { defaultProps: { size: 'md' } },
    PasswordInput: { defaultProps: { size: 'md' } },
    Select: { defaultProps: { size: 'md' } },
    Autocomplete: { defaultProps: { size: 'md' } },
    TagsInput: { defaultProps: { size: 'md' } },
    Button: { defaultProps: { size: 'md' } },
    Checkbox: { defaultProps: { size: 'md' } },
    Card: { defaultProps: { radius: 14 } }, // 12–14px theo token "Bo góc: card"
    Paper: { defaultProps: { radius: 14 } },
  },
});
