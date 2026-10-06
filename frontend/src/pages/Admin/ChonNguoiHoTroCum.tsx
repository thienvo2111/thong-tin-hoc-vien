import { useMemo } from 'react';
import { Badge, MultiSelect, Stack } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useGanNguoiHoTroCum } from '@/api/khoaBoiDuong';
import { useDanhSachTaiKhoanHoTro } from '@/api/taiKhoanHoTro';
import type { CumHocVien } from '@/api/types';
import { thongDiepLoiChung } from '@/lib/loiApi';
import { locTiengViet } from '@/lib/timKiemTiengViet';

/** Phân công người hỗ trợ học viên cho 1 cụm (ADR 0003 H4) — chỉ quan_tri. Đổi lựa chọn là lưu ngay
 * (PUT thay toàn bộ). Cụm chưa có ai → nhãn cảnh báo: yêu cầu hỗ trợ của học viên cụm này chỉ tới Quản trị. */
export function ChonNguoiHoTroCum({ khoaId, cum }: { khoaId: string; cum: CumHocVien }) {
  const dsHoTro = useDanhSachTaiKhoanHoTro({ trang_thai: 'active', page_size: 200 });
  const gan = useGanNguoiHoTroCum(khoaId);
  const daChon = useMemo(() => (cum.nguoi_ho_tro ?? []).map((n) => n.id), [cum.nguoi_ho_tro]);

  // Giữ cả người đã phân công nhưng nay bị khóa (không có trong danh sách active) để không "mất" khỏi ô.
  const luaChon = useMemo(() => {
    const ds = (dsHoTro.data?.data ?? []).map((t) => ({ value: t.id, label: t.ho_ten }));
    for (const n of cum.nguoi_ho_tro ?? []) {
      if (!ds.some((d) => d.value === n.id)) ds.push({ value: n.id, label: n.ho_ten });
    }
    return ds;
  }, [dsHoTro.data, cum.nguoi_ho_tro]);

  function luu(ids: string[]) {
    gan.mutate(
      { cumId: cum.id, nguoiDungIds: ids },
      {
        onSuccess: () => notifications.show({ color: 'green', message: `Đã cập nhật người hỗ trợ "${cum.ten_cum}"` }),
        onError: (err) => notifications.show({ color: 'red', message: thongDiepLoiChung(err) }),
      },
    );
  }

  return (
    <Stack gap={4}>
      <MultiSelect
        aria-label={`Người hỗ trợ ${cum.ten_cum}`}
        placeholder={daChon.length === 0 ? 'Chọn người hỗ trợ' : undefined}
        data={luaChon}
        value={daChon}
        onChange={luu}
        searchable
        filter={locTiengViet}
        nothingFoundMessage={dsHoTro.isLoading ? 'Đang tải...' : 'Chưa có tài khoản người hỗ trợ'}
        disabled={gan.isPending}
        size="xs"
        miw={200}
      />
      {daChon.length === 0 && (
        <Badge color="red" variant="light" size="sm">
          Chưa có người hỗ trợ
        </Badge>
      )}
    </Stack>
  );
}
