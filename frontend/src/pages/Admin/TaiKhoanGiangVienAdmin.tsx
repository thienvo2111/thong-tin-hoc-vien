import { Badge, Button, Group } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  NHAN_TAI_KHOAN_GV,
  trangThaiTaiKhoan,
  useDatTrangThaiTaiKhoanGv,
  useGuiLinkKichHoatGv,
} from '@/api/congGiangVien';
import type { GiangVien } from '@/api/types';
import { thongDiepLoiXungDot } from '@/lib/loiApi';

/** Quản trị: trạng thái tài khoản cổng giảng viên + gửi link / khóa / mở (ADR 0004 G8, issue #20). */
export function TaiKhoanGiangVienAdmin({ gv }: { gv: GiangVien }) {
  const gui = useGuiLinkKichHoatGv('quan_tri');
  const dat = useDatTrangThaiTaiKhoanGv();
  const tt = trangThaiTaiKhoan(gv.tai_khoan);
  const loi = (err: unknown) => notifications.show({ color: 'red', message: thongDiepLoiXungDot(err) });

  return (
    <Group gap={6} wrap="nowrap">
      <Badge size="xs" variant="light" color={NHAN_TAI_KHOAN_GV[tt].mau}>
        {NHAN_TAI_KHOAN_GV[tt].nhan}
      </Badge>
      {(tt === 'chua_co' || tt === 'chua_kich_hoat') && gv.trang_thai === 'active' && (
        <Button
          size="compact-xs"
          variant="subtle"
          disabled={!gv.email}
          title={gv.email ? undefined : 'Giảng viên chưa có email'}
          loading={gui.isPending}
          onClick={() =>
            gui.mutate(gv.id, {
              onSuccess: (kq) => notifications.show({ color: 'green', message: `Đã gửi link kích hoạt tới ${kq.email}` }),
              onError: loi,
            })
          }
        >
          {tt === 'chua_co' ? 'Cấp tài khoản' : 'Gửi lại link'}
        </Button>
      )}
      {tt !== 'chua_co' && (
        <Button
          size="compact-xs"
          variant="subtle"
          color={tt === 'bi_khoa' ? 'blue' : 'red'}
          loading={dat.isPending}
          onClick={() =>
            dat.mutate(
              { giangVienId: gv.id, trang_thai: tt === 'bi_khoa' ? 'active' : 'ngung' },
              {
                onSuccess: () =>
                  notifications.show({ color: 'green', message: tt === 'bi_khoa' ? 'Đã mở khóa tài khoản' : 'Đã khóa tài khoản' }),
                onError: loi,
              },
            )
          }
        >
          {tt === 'bi_khoa' ? 'Mở khóa TK' : 'Khóa TK'}
        </Button>
      )}
    </Group>
  );
}
