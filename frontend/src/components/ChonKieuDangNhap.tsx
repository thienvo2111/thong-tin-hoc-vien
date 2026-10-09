import { useId } from 'react';
import { Box, SegmentedControl, Text } from '@mantine/core';
import type { KieuDangNhap } from '@/lib/kieuDangNhap';

const LUA_CHON = [
  { value: 'ma', label: 'Mã định danh MOET' },
  { value: 'sdt', label: 'Số điện thoại' },
];

/** Thanh chọn chế độ đăng nhập/quên mật khẩu (spec 2026-10-09 Q-C) — không có lựa chọn CCCD. */
export function ChonKieuDangNhap({
  value,
  onChange,
  nhan = 'Đăng nhập bằng',
}: {
  value: KieuDangNhap;
  onChange: (kieu: KieuDangNhap) => void;
  nhan?: string;
}) {
  const idNhan = useId();
  return (
    <Box>
      <Text id={idNhan} size="sm" fw={500} mb={4}>
        {nhan}
      </Text>
      <SegmentedControl
        role="radiogroup"
        aria-labelledby={idNhan}
        fullWidth
        data={LUA_CHON}
        value={value}
        onChange={(v) => onChange(v === 'sdt' ? 'sdt' : 'ma')}
      />
    </Box>
  );
}
