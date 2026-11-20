import { Badge, Paper, Stack, Text } from '@mantine/core';
import type { HoSoDonViPhanHoi } from '@/api/hoSoDonVi';
import { DON_VI_TIEP_NHAN, NGAN_HANG_TIEP_NHAN, NHAN_TRUONG_HO_SO, stkChuyenKhoan } from '@/lib/hoSoDonVi';

// Issue #63: phần dùng chung giữa form của trường, trang chủ trường và màn Quản trị xem hồ sơ.

/** Badge tình trạng: Chưa khai / Đủ thông tin / Còn thiếu N mục. */
export function nhanTinhTrang(d: HoSoDonViPhanHoi): { nhan: string; mau: string } {
  if (!d.ho_so) return { nhan: 'Chưa khai', mau: 'gray' };
  if (d.tinh_trang.du) return { nhan: 'Đủ thông tin', mau: 'green' };
  return { nhan: `Còn thiếu ${d.tinh_trang.so_thieu} mục`, mau: 'orange' };
}

export function BadgeHoSo({ data, size }: { data: HoSoDonViPhanHoi; size?: string }) {
  const { nhan, mau } = nhanTinhTrang(data);
  return (
    <Badge color={mau} variant="light" size={size} style={{ flexShrink: 0 }}>
      {nhan}
    </Badge>
  );
}

/** Tên các mục còn thiếu, theo thứ tự form. */
export function MucConThieu({ data }: { data: HoSoDonViPhanHoi }) {
  if (data.tinh_trang.du) return null;
  return (
    <Text size="sm" style={{ overflowWrap: 'anywhere' }}>
      Còn thiếu: {data.tinh_trang.thieu.map((t) => NHAN_TRUONG_HO_SO[t]).join(', ')}
    </Text>
  );
}

/** U2: STK chuyển khoản cho HCMUE ghép từ mã QHNS — suy ra ngay khi gõ, không lưu. */
export function ThongTinChuyenKhoan({ maQhns }: { maQhns: string | null | undefined }) {
  return <HopChuyenKhoan stk={stkChuyenKhoan(maQhns)} />;
}

/** Hộp thông tin chuyển khoản cho HCMUE từ STK đã có (issue #64: hợp đồng dùng STK của API / bản chụp). */
export function HopChuyenKhoan({ stk }: { stk: string | null }) {
  return (
    <Paper
      withBorder
      radius="md"
      p="sm"
      bg="var(--mantine-color-blue-0)"
      role="region"
      aria-label="Thông tin chuyển khoản cho HCMUE"
      aria-live="polite"
    >
      <Stack gap={4}>
        <Text fw={600} size="sm">
          Thông tin chuyển khoản cho HCMUE
        </Text>
        {stk ? (
          <>
            <Text size="sm">
              Số tài khoản:{' '}
              <Text span fw={700} ff="monospace" fz="md">
                {stk}
              </Text>
            </Text>
            <Text size="sm">Ngân hàng: {NGAN_HANG_TIEP_NHAN}</Text>
            <Text size="sm">Đơn vị tiếp nhận: {DON_VI_TIEP_NHAN}</Text>
            <Text size="xs" c="orange.9">
              Kiểm tra kỹ: sai mã QHNS là chuyển nhầm tài khoản
            </Text>
          </>
        ) : (
          <Text size="sm" c="dimmed">
            Nhập đủ 7 số mã QHNS để xem số tài khoản
          </Text>
        )}
      </Stack>
    </Paper>
  );
}
