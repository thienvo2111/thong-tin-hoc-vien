import { useState } from 'react';
import { Badge, Button, Group, Select, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { NHAN_NHAC, useDaGuiNhacCum, useTinNhanNhacCum, type TrangThaiNhac } from '@/api/nhacLich';
import { ModalTinNhanNhac } from '@/components/ModalTinNhanNhac';
import { thongDiepLoiChung } from '@/lib/loiApi';

/** Cờ nhắc của từng cụm cho 1 buổi (ADR 0004 G11). */
export function CoNhacCum({
  nhac,
  tenCum,
}: {
  nhac: { cum_id: string; trang_thai: TrangThaiNhac }[];
  tenCum: Map<string, string>;
}) {
  if (nhac.length === 0) return null;
  return (
    <Group gap={4} mt={4}>
      {nhac.map((n) => (
        <Badge key={n.cum_id} size="sm" variant="light" color={NHAN_NHAC[n.trang_thai].mau}>
          {tenCum.get(n.cum_id) ?? 'Cụm'}: {NHAN_NHAC[n.trang_thai].nhan}
        </Badge>
      ))}
    </Group>
  );
}

/** Nút "Tin nhắn nhắc cụm" của 1 ngày (ADR 0004 G10) — chọn cụm nếu có nhiều cụm học trong ngày. */
export function NhacCumNgay({
  ngay,
  nhanNgay,
  cumIds,
  tenCum,
}: {
  ngay: string;
  nhanNgay: string;
  cumIds: string[];
  tenCum: Map<string, string>;
}) {
  const [mo, setMo] = useState(false);
  const [cumId, setCumId] = useState<string | null>(cumIds[0] ?? null);
  const tin = useTinNhanNhacCum(mo ? cumId : null, ngay);
  const daGui = useDaGuiNhacCum();
  const d = tin.data;
  if (cumIds.length === 0) return null;

  return (
    <>
      <Button size="compact-xs" variant="light" color="teal" onClick={() => setMo(true)}>
        Tin nhắn nhắc cụm
      </Button>
      <ModalTinNhanNhac
        opened={mo}
        onClose={() => setMo(false)}
        tieuDe={`Tin nhắn nhắc cụm — ${nhanNgay}`}
        dangTai={tin.isLoading}
        loi={tin.isError ? thongDiepLoiChung(tin.error) : null}
        noiDung={d?.noi_dung}
        trangThai={d?.trang_thai_nhac}
        dangGui={daGui.isPending}
        onDaGui={() =>
          d?.noi_dung &&
          daGui.mutate(
            { cum_id: d.cum.id, lich_hoc_ids: d.lich_hoc_ids, noi_dung: d.noi_dung },
            {
              onSuccess: () => {
                notifications.show({ color: 'green', message: `Đã ghi nhận nhắc ${d.cum.ten_cum}` });
                setMo(false);
              },
              onError: (err) => notifications.show({ color: 'red', message: thongDiepLoiChung(err) }),
            },
          )
        }
      >
        {cumIds.length > 1 ? (
          <Select
            label="Cụm"
            data={cumIds.map((id) => ({ value: id, label: tenCum.get(id) ?? id }))}
            value={cumId}
            onChange={setCumId}
            allowDeselect={false}
            comboboxProps={{ withinPortal: false }}
          />
        ) : (
          <Text fz="sm">Cụm: {tenCum.get(cumIds[0]) ?? ''}</Text>
        )}
      </ModalTinNhanNhac>
    </>
  );
}
