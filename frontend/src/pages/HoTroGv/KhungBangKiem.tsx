import { useState } from 'react';
import { Alert, Badge, Button, Checkbox, Group, Paper, Skeleton, Stack, Text, TextInput } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useBangKiemDot, useDanhDauMuc, type MauDot, type MucDanhGia, type TrangThaiMuc } from '@/api/bangKiem';
import { thongDiepLoiChung, thongDiepLoiXungDot } from '@/lib/loiApi';
import { dinhDangNgay, dinhDangNgayGio } from '@/lib/ngay';

export const MAU_DOT: Record<MauDot, { mau: string; nhan: string }> = {
  xanh: { mau: 'green', nhan: 'Sẵn sàng' },
  vang: { mau: 'yellow', nhan: 'Còn việc' },
  do: { mau: 'red', nhan: 'Có mục quá hạn' },
};

const MAU_MUC: Record<TrangThaiMuc, { mau: string; nhan: string }> = {
  dat: { mau: 'green', nhan: 'Đạt' },
  chua_dat: { mau: 'yellow', nhan: 'Chưa đạt' },
  qua_han: { mau: 'red', nhan: 'Quá hạn' },
};

function DongThuCong({ lopId, gdId, m }: { lopId: string; gdId: string; m: MucDanhGia }) {
  const danhDau = useDanhDauMuc(lopId, gdId);
  const [ghiChu, setGhiChu] = useState(m.ghi_chu ?? '');

  function luu(daXong: boolean) {
    danhDau.mutate(
      { mucId: m.muc_id, da_xong: daXong, ghi_chu: ghiChu.trim() || null },
      { onError: (err) => notifications.show({ color: 'red', message: thongDiepLoiXungDot(err) }) },
    );
  }

  return (
    <Stack gap={4}>
      <Group gap="xs" wrap="nowrap" align="flex-end">
        <Checkbox
          label={m.ten}
          checked={m.trang_thai === 'dat'}
          disabled={danhDau.isPending}
          onChange={(e) => luu(e.currentTarget.checked)}
        />
      </Group>
      <Group gap="xs" wrap="nowrap" pl={30}>
        <TextInput
          size="xs"
          placeholder="Ghi chú"
          aria-label={`Ghi chú ${m.ten}`}
          value={ghiChu}
          onChange={(e) => setGhiChu(e.currentTarget.value)}
          style={{ flex: 1 }}
        />
        <Button size="compact-xs" variant="subtle" onClick={() => luu(m.trang_thai === 'dat')} loading={danhDau.isPending}>
          Lưu ghi chú
        </Button>
      </Group>
      {m.cap_nhat_boi && m.cap_nhat_luc && (
        <Text fz="xs" c="dimmed" pl={30}>
          {m.cap_nhat_boi} · {dinhDangNgayGio(m.cap_nhat_luc)}
        </Text>
      )}
    </Stack>
  );
}

/** Bảng kiểm "Sẵn sàng" của đợt (ADR 0004 G5b, issue #17): mục tự động hiện kết quả + lý do; mục thủ công
 * đánh dấu + ghi chú. */
export function KhungBangKiem({ lopId, gdId }: { lopId: string; gdId: string }) {
  const { data, isLoading, isError, error } = useBangKiemDot(lopId, gdId);
  if (isLoading) return <Skeleton height={140} />;
  if (isError || !data) return <Alert color="red">{thongDiepLoiChung(error)}</Alert>;

  return (
    <Paper withBorder radius={12} p="md">
      <Group justify="space-between" mb="sm">
        <Text fw={700}>Bảng kiểm chuẩn bị</Text>
        <Badge color={MAU_DOT[data.mau].mau} size="lg" data-testid="mau-dot">
          {MAU_DOT[data.mau].nhan}
        </Badge>
      </Group>
      <Stack gap="sm">
        {data.muc.map((m) => (
          <Group key={m.muc_id} justify="space-between" align="flex-start" wrap="nowrap">
            <div style={{ flex: 1 }}>
              {m.loai === 'thu_cong' ? (
                <DongThuCong lopId={lopId} gdId={gdId} m={m} />
              ) : (
                <>
                  <Text fz="sm">{m.ten}</Text>
                  {m.ly_do && (
                    <Text fz="xs" c="dimmed">
                      {m.ly_do}
                    </Text>
                  )}
                </>
              )}
            </div>
            <Stack gap={2} align="flex-end">
              <Badge size="sm" variant="light" color={MAU_MUC[m.trang_thai].mau}>
                {MAU_MUC[m.trang_thai].nhan}
              </Badge>
              {m.han && (
                <Text fz="xs" c="dimmed">
                  Hạn {dinhDangNgay(m.han)}
                </Text>
              )}
            </Stack>
          </Group>
        ))}
      </Stack>
    </Paper>
  );
}
