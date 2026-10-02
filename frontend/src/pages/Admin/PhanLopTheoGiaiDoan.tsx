import { useState } from 'react';
import { Button, Group, Select, Stack } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useGanLopGiaiDoan } from '@/api/khoaBoiDuong';
import type { KhoaBoiDuongChiTiet, KhoaHocDangKy, LoaiLop } from '@/api/types';
import { thongDiepLoiChung } from '@/lib/loiApi';

const NHAN_LOAI_LOP: Record<LoaiLop, string> = { truc_tiep: 'Trực tiếp', zoom: 'Zoom', vle: 'VLE' };

/** Phân lớp theo giai đoạn (spec 2026-10-02 mục 5.3) — 1 dòng/giai đoạn active, lưu từng dòng qua
 * PUT /dang-ky-hoc/{id}/giai-doan/{giaiDoanId}/lop (lop_id null = gỡ). */
export function PhanLopTheoGiaiDoan({
  hocVienId,
  dangKy,
  khoa,
}: {
  hocVienId: string;
  dangKy: KhoaHocDangKy;
  khoa: KhoaBoiDuongChiTiet;
}) {
  const gan = useGanLopGiaiDoan(hocVienId);
  const giaiDoan = khoa.giai_doan.filter((g) => g.trang_thai === 'active').sort((a, b) => a.thu_tu - b.thu_tu);
  const [chon, setChon] = useState<Record<string, string>>(() =>
    Object.fromEntries(dangKy.giai_doan.map((g) => [g.id, g.lop?.id ?? ''])),
  );
  const tuyChonLop = [
    { value: '', label: '-- Bỏ gán --' },
    ...khoa.lop_hoc.map((l) => ({ value: l.id, label: `${l.ten_lop} (${NHAN_LOAI_LOP[l.loai_lop]})` })),
  ];

  function luu(giaiDoanId: string) {
    gan.mutate(
      { dangKyHocId: dangKy.id, giaiDoanId, lopId: chon[giaiDoanId] || null },
      {
        onSuccess: (res) =>
          notifications.show(
            res.canh_bao ? { color: 'yellow', message: res.canh_bao } : { color: 'green', message: 'Đã lưu phân lớp' },
          ),
        onError: (err) => notifications.show({ color: 'red', message: thongDiepLoiChung(err) }),
      },
    );
  }

  return (
    <Stack gap="sm">
      {giaiDoan.map((gd) => (
        <Group key={gd.id} gap="sm" wrap="wrap" align="flex-end">
          <Select
            label={`GĐ${gd.thu_tu} · ${gd.ten_giai_doan}`}
            data={tuyChonLop}
            value={chon[gd.id] ?? ''}
            onChange={(v) => setChon((c) => ({ ...c, [gd.id]: v ?? '' }))}
            allowDeselect={false}
            searchable
            w={320}
          />
          <Button size="xs" loading={gan.isPending && gan.variables?.giaiDoanId === gd.id} onClick={() => luu(gd.id)}>
            Lưu
          </Button>
        </Group>
      ))}
    </Stack>
  );
}
