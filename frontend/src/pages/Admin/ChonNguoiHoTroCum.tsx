import { useMemo } from 'react';
import { Badge, MultiSelect, Stack } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useGanNguoiHoTroCum, useGanNguoiHoTroLop } from '@/api/khoaBoiDuong';
import { useDanhSachTaiKhoanHoTro } from '@/api/taiKhoanHoTro';
import type { CumHocVien, LopHoc, NguoiHoTroRutGon } from '@/api/types';
import { thongDiepLoiChung } from '@/lib/loiApi';
import { locTiengViet } from '@/lib/timKiemTiengViet';

/** Phân công người hỗ trợ học viên cho 1 cụm (ADR 0003 H4) — chỉ quan_tri. Đổi lựa chọn là lưu ngay
 * (PUT thay toàn bộ). Cụm chưa có ai → nhãn cảnh báo: yêu cầu hỗ trợ của học viên cụm này chỉ tới Quản trị. */
export function ChonNguoiHoTroCum({ khoaId, cum }: { khoaId: string; cum: CumHocVien }) {
  const gan = useGanNguoiHoTroCum(khoaId);
  return (
    <ChonNguoiHoTro
      ten={cum.ten_cum}
      nhanO={`Người hỗ trợ ${cum.ten_cum}`}
      nguoiHoTro={cum.nguoi_ho_tro}
      dangLuu={gan.isPending}
      canhBaoKhiTrong="Chưa có người hỗ trợ"
      luu={(ids, cb) => gan.mutate({ cumId: cum.id, nguoiDungIds: ids }, cb)}
    />
  );
}

/** ADR 0008: người hỗ trợ học viên theo LỚP (cùng vai trò ho_tro_hoc_vien) — chỉ quan_tri, lưu ngay.
 * Lớp không có người hỗ trợ là bình thường nên không cảnh báo. */
export function ChonNguoiHoTroLop({ khoaId, lop }: { khoaId: string; lop: LopHoc }) {
  const gan = useGanNguoiHoTroLop(khoaId);
  return (
    <ChonNguoiHoTro
      ten={lop.ten_lop}
      nhanO={`Người hỗ trợ lớp ${lop.ten_lop}`}
      nguoiHoTro={lop.nguoi_ho_tro}
      dangLuu={gan.isPending}
      luu={(ids, cb) => gan.mutate({ lopId: lop.id, nguoiDungIds: ids }, cb)}
    />
  );
}

interface CallbackLuu {
  onSuccess: () => void;
  onError: (err: Error) => void;
}

function ChonNguoiHoTro({
  ten,
  nhanO,
  nguoiHoTro,
  dangLuu,
  canhBaoKhiTrong,
  luu,
}: {
  ten: string;
  nhanO: string;
  nguoiHoTro: NguoiHoTroRutGon[] | undefined;
  dangLuu: boolean;
  canhBaoKhiTrong?: string;
  luu: (ids: string[], cb: CallbackLuu) => void;
}) {
  const dsHoTro = useDanhSachTaiKhoanHoTro({ trang_thai: 'active', page_size: 200 });
  const daChon = useMemo(() => (nguoiHoTro ?? []).map((n) => n.id), [nguoiHoTro]);

  // Giữ cả người đã phân công nhưng nay bị khóa (không có trong danh sách active) để không "mất" khỏi ô.
  const luaChon = useMemo(() => {
    const ds = (dsHoTro.data?.data ?? []).map((t) => ({ value: t.id, label: t.ho_ten }));
    for (const n of nguoiHoTro ?? []) {
      if (!ds.some((d) => d.value === n.id)) ds.push({ value: n.id, label: n.ho_ten });
    }
    return ds;
  }, [dsHoTro.data, nguoiHoTro]);

  function doiChon(ids: string[]) {
    luu(ids, {
      onSuccess: () => notifications.show({ color: 'green', message: `Đã cập nhật người hỗ trợ "${ten}"` }),
      onError: (err) => notifications.show({ color: 'red', message: thongDiepLoiChung(err) }),
    });
  }

  return (
    <Stack gap={4}>
      <MultiSelect
        aria-label={nhanO}
        placeholder={daChon.length === 0 ? 'Chọn người hỗ trợ' : undefined}
        data={luaChon}
        value={daChon}
        onChange={doiChon}
        searchable
        filter={locTiengViet}
        nothingFoundMessage={dsHoTro.isLoading ? 'Đang tải...' : 'Chưa có tài khoản người hỗ trợ'}
        disabled={dangLuu}
        size="xs"
        miw={200}
      />
      {canhBaoKhiTrong && daChon.length === 0 && (
        <Badge color="red" variant="light" size="sm">
          {canhBaoKhiTrong}
        </Badge>
      )}
    </Stack>
  );
}
