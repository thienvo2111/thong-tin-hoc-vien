import { useEffect, useMemo, useState } from 'react';
import { ActionIcon, Badge, Button, Group, Modal, NumberInput, Select, Stack, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { GIANG_VIEN_HO_TRO_GV, GIANG_VIEN_QUAN_TRI, useGiangVien, usePhanCongBuoi } from '@/api/giangVien';
import type { LichHocLop, LopHoc, VaiTroNhanSuLop } from '@/api/types';
import { thongDiepLoiXungDot } from '@/lib/loiApi';
import { dinhDangNgayGio } from '@/lib/ngay';
import { locTiengViet } from '@/lib/timKiemTiengViet';

interface Dong {
  giang_vien_id: string | null;
  vai_tro: VaiTroNhanSuLop;
  so_gio: string;
  /** Đã xác nhận giờ — không gỡ/đổi số giờ được (backend trả 409). */
  khoa: boolean;
}

const TUY_CHON_VAI_TRO = [
  { value: 'giang_vien', label: 'Giảng viên' },
  { value: 'ho_tro', label: 'Hỗ trợ' },
];

/** Phân công giảng viên vào 1 buổi (T11, issue #3) — PUT thay toàn bộ; luật trùng giờ kiểm ở backend. */
export function ModalPhanCongBuoi({
  khoaId,
  buoi,
  onClose,
  khu = 'quan_tri',
}: {
  khoaId: string;
  buoi: { lop: Pick<LopHoc, 'id' | 'ten_lop'>; lich: Pick<LichHocLop, 'id' | 'buoi_so' | 'thoi_gian_bat_dau' | 'thoi_gian_ket_thuc' | 'phan_cong'> } | null;
  onClose: () => void;
  /** ADR 0004 G12: người hỗ trợ GV phân công qua /ho-tro-giang-vien. */
  khu?: 'quan_tri' | 'ho_tro_gv';
}) {
  const { data: dsGiangVien } = useGiangVien(
    { trang_thai: 'active', page_size: 200 },
    !!buoi,
    khu === 'quan_tri' ? GIANG_VIEN_QUAN_TRI : GIANG_VIEN_HO_TRO_GV,
  );
  const luu = usePhanCongBuoi(khoaId, khu);
  const [dong, setDong] = useState<Dong[]>([]);

  useEffect(() => {
    if (!buoi) return;
    setDong(
      (buoi.lich.phan_cong ?? []).map((p) => ({
        giang_vien_id: p.giang_vien.id,
        vai_tro: p.vai_tro,
        so_gio: p.so_gio == null ? '' : String(Number(p.so_gio)),
        khoa: p.da_xac_nhan_gio,
      })),
    );
  }, [buoi]);

  const tuyChonGiangVien = useMemo(() => {
    const ds = (dsGiangVien?.data ?? []).map((g) => ({ value: g.id, label: `${g.ho_ten} — ${g.so_dien_thoai}` }));
    // Giảng viên đã phân công nhưng đã ngưng vẫn phải hiện tên.
    for (const p of buoi?.lich.phan_cong ?? []) {
      if (!ds.some((o) => o.value === p.giang_vien.id)) ds.push({ value: p.giang_vien.id, label: p.giang_vien.ho_ten });
    }
    return ds;
  }, [dsGiangVien, buoi]);

  function sua(i: number, thayDoi: Partial<Dong>) {
    setDong((d) => d.map((x, j) => (j === i ? { ...x, ...thayDoi } : x)));
  }

  function xuLyLuu() {
    if (!buoi) return;
    luu.mutate(
      {
        lopId: buoi.lop.id,
        lichHocId: buoi.lich.id,
        phan_cong: dong
          .filter((d) => d.giang_vien_id)
          .map((d) => ({
            giang_vien_id: d.giang_vien_id!,
            vai_tro: d.vai_tro,
            so_gio: d.so_gio === '' ? undefined : Number(d.so_gio),
          })),
      },
      {
        onSuccess: () => {
          notifications.show({ color: 'green', message: 'Đã lưu phân công giảng viên' });
          onClose();
        },
        onError: (err) => notifications.show({ color: 'red', message: thongDiepLoiXungDot(err), autoClose: 8000 }),
      },
    );
  }

  return (
    <Modal opened={!!buoi} onClose={onClose} title={`Giảng viên — ${buoi?.lop.ten_lop ?? ''}, buổi ${buoi?.lich.buoi_so ?? ''}`} centered size="lg">
      {buoi && (
        <Stack gap="sm">
          <Text fz={13} c="dimmed">
            {dinhDangNgayGio(buoi.lich.thoi_gian_bat_dau)} – {dinhDangNgayGio(buoi.lich.thoi_gian_ket_thuc)}. Một giảng viên không được dạy 2 buổi trùng giờ.
          </Text>
          {dong.length === 0 && (
            <Text fz={13} c="dimmed">
              Chưa phân công ai.
            </Text>
          )}
          {dong.map((d, i) => (
            <Group key={i} gap="xs" align="flex-end" wrap="nowrap">
              <Select
                label={i === 0 ? 'Giảng viên' : undefined}
                aria-label="Giảng viên"
                placeholder="Chọn giảng viên"
                data={tuyChonGiangVien}
                value={d.giang_vien_id}
                onChange={(v) => sua(i, { giang_vien_id: v })}
                searchable
                filter={locTiengViet}
                disabled={d.khoa}
                style={{ flex: 1 }}
                comboboxProps={{ withinPortal: true }}
              />
              <Select
                label={i === 0 ? 'Vai trò' : undefined}
                aria-label="Vai trò"
                data={TUY_CHON_VAI_TRO}
                value={d.vai_tro}
                onChange={(v) => sua(i, { vai_tro: (v ?? 'giang_vien') as VaiTroNhanSuLop })}
                allowDeselect={false}
                w={120}
              />
              <NumberInput
                label={i === 0 ? 'Số giờ' : undefined}
                aria-label="Số giờ"
                min={0.1}
                step={0.5}
                decimalScale={1}
                value={d.so_gio}
                onChange={(v) => sua(i, { so_gio: v === '' ? '' : String(v) })}
                disabled={d.khoa}
                w={90}
              />
              {d.khoa ? (
                <Badge color="green" size="sm" mb={8}>
                  Đã xác nhận giờ
                </Badge>
              ) : (
                <ActionIcon variant="subtle" color="red" mb={4} aria-label="Gỡ" onClick={() => setDong((x) => x.filter((_, j) => j !== i))}>
                  ✕
                </ActionIcon>
              )}
            </Group>
          ))}
          <Button
            variant="light"
            size="xs"
            onClick={() => setDong((x) => [...x, { giang_vien_id: null, vai_tro: 'giang_vien', so_gio: '', khoa: false }])}
          >
            + Thêm giảng viên
          </Button>
          <Button mt="sm" loading={luu.isPending} onClick={xuLyLuu} fullWidth>
            Lưu phân công
          </Button>
        </Stack>
      )}
    </Modal>
  );
}
