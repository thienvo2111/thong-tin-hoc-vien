import { useMemo } from 'react';
import { Alert, Badge, MultiSelect, Stack, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useGanNhomHoTroGv } from '@/api/khoaBoiDuong';
import { useDanhSachTaiKhoanHoTro } from '@/api/taiKhoanHoTro';
import type { KhoaBoiDuongChiTiet } from '@/api/types';
import { thongDiepLoiXungDot } from '@/lib/loiApi';
import { locTiengViet } from '@/lib/timKiemTiengViet';

/** Nhóm người hỗ trợ giảng viên của khóa (ADR 0004 G3, issue #14) — chỉ quan_tri; đổi lựa chọn là lưu
 * ngay (PUT thay toàn bộ). Cả nhóm thấy mọi lớp của khóa. */
export function ChonNhomHoTroGv({ khoa }: { khoa: KhoaBoiDuongChiTiet }) {
  const ds = useDanhSachTaiKhoanHoTro({ vai_tro: 'ho_tro_giang_vien', trang_thai: 'active', page_size: 200 });
  const gan = useGanNhomHoTroGv(khoa.id);
  const nhom = useMemo(() => khoa.nhom_ho_tro_gv ?? [], [khoa.nhom_ho_tro_gv]);
  const daChon = useMemo(() => nhom.map((n) => n.id), [nhom]);
  const coTrucTiep = khoa.giai_doan.some((g) => g.hinh_thuc === 'truc_tiep');

  const luaChon = useMemo(() => {
    const kq = (ds.data?.data ?? []).map((t) => ({ value: t.id, label: t.ho_ten }));
    for (const n of nhom) if (!kq.some((d) => d.value === n.id)) kq.push({ value: n.id, label: n.ho_ten });
    return kq;
  }, [ds.data, nhom]);

  function luu(ids: string[]) {
    gan.mutate(ids, {
      onSuccess: () => notifications.show({ color: 'green', message: 'Đã cập nhật nhóm hỗ trợ giảng viên' }),
      onError: (err) => notifications.show({ color: 'red', message: thongDiepLoiXungDot(err) }),
    });
  }

  return (
    <Stack gap="sm" maw={640}>
      <Text fz="sm" c="dimmed">
        Người trong nhóm thấy mọi lớp của khóa này ở khu "Hỗ trợ giảng viên". Tạo tài khoản ở mục Người hỗ trợ → Hỗ trợ giảng viên.
      </Text>
      <MultiSelect
        label="Nhóm hỗ trợ giảng viên"
        placeholder={daChon.length === 0 ? 'Chọn người hỗ trợ giảng viên' : undefined}
        data={luaChon}
        value={daChon}
        onChange={luu}
        searchable
        filter={locTiengViet}
        nothingFoundMessage={ds.isLoading ? 'Đang tải...' : 'Chưa có tài khoản người hỗ trợ giảng viên'}
        disabled={gan.isPending}
      />
      {daChon.length === 0 && coTrucTiep && (
        <Alert color="red" variant="light">
          Khóa có giai đoạn học trực tiếp nhưng chưa có người hỗ trợ giảng viên.
        </Alert>
      )}
      {daChon.length === 0 && !coTrucTiep && (
        <Badge color="yellow" variant="light" w="fit-content">
          Chưa phân công
        </Badge>
      )}
    </Stack>
  );
}
