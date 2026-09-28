import { Text } from '@mantine/core';

/** Hiển thị 1 lỗi field độc lập với input (vd. lỗi API gắn ngoài react-hook-form, hoặc trong bảng lỗi M5). */
export function FieldError({ children }: { children: string | null | undefined }) {
  if (!children) return null;
  return (
    <Text c="red.7" size="sm" role="alert">
      {children}
    </Text>
  );
}
