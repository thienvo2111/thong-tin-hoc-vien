import { useMemo, useState } from 'react';
import { Badge, Button, Group, Paper, Stack, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { NHAN_TAI_KHOAN_GV, useGuiLinkKichHoatGv } from '@/api/congGiangVien';
import type { TrangLop } from '@/api/hoTroGv';
import { NHAN_NHAC, gopNhac, useDaGuiNhacGv, useTinNhanNhacGv } from '@/api/nhacLich';
import { ModalTinNhanNhac } from '@/components/ModalTinNhanNhac';
import { thongDiepLoiChung, thongDiepLoiXungDot } from '@/lib/loiApi';

/**
 * Giảng viên của đợt (ADR 0004 G8, G10, G11): tài khoản cổng giảng viên (gửi link kích hoạt) và tin nhắn
 * nhắc lịch (chưa nhắc / cần nhắc lại khi lịch đổi sau lần gửi).
 */
export function TaiKhoanGiangVienDot({ lopId, gdId, buoi }: { lopId: string; gdId: string; buoi: TrangLop['buoi'] }) {
  const gui = useGuiLinkKichHoatGv('ho_tro_gv');
  const [nhacGvId, setNhacGvId] = useState<string | null>(null);
  const giangVien = useMemo(() => {
    const m = new Map<string, { g: TrangLop['buoi'][number]['giang_vien'][number]; nhac: TrangLop['buoi'][number]['giang_vien'][number]['nhac'][] }>();
    for (const b of buoi)
      for (const g of b.giang_vien) {
        const x = m.get(g.id) ?? { g, nhac: [] };
        x.nhac.push(g.nhac ?? 'chua_nhac');
        m.set(g.id, x);
      }
    return [...m.values()].map(({ g, nhac }) => ({ ...g, nhacGop: gopNhac(nhac) }));
  }, [buoi]);
  if (giangVien.length === 0) return null;

  return (
    <Paper withBorder radius={12} p="sm">
      <Text fw={700} fz="sm" mb={6}>
        Giảng viên của đợt — tài khoản & nhắc lịch
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
                <Badge size="sm" variant="light" color={NHAN_NHAC[g.nhacGop].mau}>
                  {NHAN_NHAC[g.nhacGop].nhan}
                </Badge>
              </Group>
              <Group gap={6}>
                <Button size="compact-xs" variant="light" color="teal" onClick={() => setNhacGvId(g.id)}>
                  Tin nhắn nhắc
                </Button>
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
            </Group>
          );
        })}
      </Stack>
      <NhacGiangVien lopId={lopId} gdId={gdId} giangVienId={nhacGvId} onClose={() => setNhacGvId(null)} />
    </Paper>
  );
}

function NhacGiangVien({
  lopId,
  gdId,
  giangVienId,
  onClose,
}: {
  lopId: string;
  gdId: string;
  giangVienId: string | null;
  onClose: () => void;
}) {
  const tin = useTinNhanNhacGv(lopId, gdId, giangVienId);
  const daGui = useDaGuiNhacGv();
  const d = tin.data;

  return (
    <ModalTinNhanNhac
      opened={!!giangVienId}
      onClose={onClose}
      tieuDe={`Tin nhắn nhắc lịch — ${d?.giang_vien.ho_ten ?? ''}`}
      dangTai={tin.isLoading}
      loi={tin.isError ? thongDiepLoiChung(tin.error) : null}
      noiDung={d?.noi_dung}
      trangThai={d?.trang_thai_nhac}
      lanGuiCuoi={d?.lan_gui_cuoi}
      dangGui={daGui.isPending}
      onDaGui={() =>
        d &&
        daGui.mutate(
          { giang_vien_id: d.giang_vien.id, lich_hoc_ids: d.lich_hoc_ids, noi_dung: d.noi_dung },
          {
            onSuccess: () => {
              notifications.show({ color: 'green', message: `Đã ghi nhận nhắc ${d.giang_vien.ho_ten}` });
              onClose();
            },
            onError: (err) => notifications.show({ color: 'red', message: thongDiepLoiChung(err) }),
          },
        )
      }
    >
      {d?.giang_vien.so_dien_thoai && (
        <Text fz="sm">
          Gửi tới: {d.giang_vien.ho_ten} — {d.giang_vien.so_dien_thoai}
          {d.giang_vien.email ? ` · ${d.giang_vien.email}` : ''}
        </Text>
      )}
    </ModalTinNhanNhac>
  );
}
