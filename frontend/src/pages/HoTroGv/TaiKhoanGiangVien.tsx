import { Badge, Button, Group, Paper, Stack, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { NHAN_TAI_KHOAN_GV, useGuiLinkKichHoatGv, type TrangThaiTaiKhoanGv } from '@/api/congGiangVien';
import { thongDiepLoiXungDot } from '@/lib/loiApi';

/** Tài khoản cổng giảng viên của các giảng viên trong đợt (ADR 0004 G8) — hỗ trợ GV gửi link kích hoạt. */
export function TaiKhoanGiangVienDot({
  giangVien,
}: {
  giangVien: { id: string; ho_ten: string; email?: string | null; tai_khoan?: TrangThaiTaiKhoanGv }[];
}) {
  const gui = useGuiLinkKichHoatGv('ho_tro_gv');
  if (giangVien.length === 0) return null;

  return (
    <Paper withBorder radius={12} p="sm">
      <Text fw={700} fz="sm" mb={6}>
        Tài khoản cổng giảng viên
      </Text>
      <Stack gap={6}>
        {giangVien.map((g) => {
          const tt = g.tai_khoan ?? 'chua_co';
          const coTheGui = tt === 'chua_co' || tt === 'chua_kich_hoat';
          return (
            <Group key={g.id} justify="space-between" wrap="wrap" gap="xs">
              <Group gap="xs">
                <Text fz="sm">{g.ho_ten}</Text>
                <Badge size="sm" variant="light" color={NHAN_TAI_KHOAN_GV[tt].mau}>
                  {NHAN_TAI_KHOAN_GV[tt].nhan}
                </Badge>
              </Group>
              {coTheGui && (
                <Button
                  size="compact-xs"
                  variant="light"
                  disabled={!g.email}
                  title={g.email ? undefined : 'Giảng viên chưa có email'}
                  loading={gui.isPending && gui.variables === g.id}
                  onClick={() =>
                    gui.mutate(g.id, {
                      onSuccess: (kq) => notifications.show({ color: 'green', message: `Đã gửi link kích hoạt tới ${kq.email}` }),
                      onError: (err) => notifications.show({ color: 'red', message: thongDiepLoiXungDot(err) }),
                    })
                  }
                >
                  {tt === 'chua_co' ? 'Gửi link kích hoạt' : 'Gửi lại link'}
                </Button>
              )}
            </Group>
          );
        })}
      </Stack>
    </Paper>
  );
}
