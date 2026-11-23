import { useState } from 'react';
import { Alert, Button, Divider, Group, MultiSelect, Stack, Text, Title } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useGanKhoaDot, useKhoaCoTheGan, type DotTrienKhai } from '@/api/dotTrienKhai';
import { thongDiepLoiXungDot } from '@/lib/loiApi';
import { locTiengViet } from '@/lib/timKiemTiengViet';

/** Issue #68 / ADR 0015 M1: gắn khóa NLS vào đợt (thay trọn tập). Khóa đang gắn đợt khác hiện mờ, không chọn được —
 * gỡ ở đợt đó trước. Gỡ khóa không đổi danh sách tham gia đã chụp. */
export function KhoaNlsCuaDot({ dot }: { dot: DotTrienKhai }) {
  const ds = useKhoaCoTheGan(dot.id);
  const gan = useGanKhoaDot();
  const [chon, setChon] = useState<string[]>(dot.khoa.map((k) => k.id));
  const [loi, setLoi] = useState<string | null>(null);

  const luaChon = (ds.data ?? []).map((k) => {
    const dotKhac = k.dot_trien_khai_id !== null && k.dot_trien_khai_id !== dot.id;
    return {
      value: k.id,
      label: `${k.ma_khoa} – ${k.ten_khoa}${dotKhac ? ` (đã gắn đợt ${k.dot_trien_khai_ten ?? ''})` : ''}`,
      disabled: dotKhac,
    };
  });

  function luu() {
    setLoi(null);
    gan.mutate(
      { dotId: dot.id, khoaIds: chon },
      {
        onSuccess: (moi) => {
          setChon(moi.khoa.map((k) => k.id));
          notifications.show({ color: 'green', message: `Đã lưu ${moi.khoa.length} khóa NLS của đợt` });
        },
        onError: (err) => setLoi(thongDiepLoiXungDot(err)),
      },
    );
  }

  return (
    <Stack gap="sm">
      <Divider />
      <Title order={2} size="h5">
        Khóa NLS của đợt
      </Title>
      <Text fz="sm" c="dimmed">
        Khóa do Sở của đợt (hoặc đơn vị trực thuộc) đặt hàng. Danh sách tham gia lấy từ ghi danh các khóa này ở màn Danh
        sách tham gia.
      </Text>
      {ds.isError && <Alert color="red">{thongDiepLoiXungDot(ds.error)}</Alert>}
      {loi && (
        <Alert color="red" role="alert">
          {loi}
        </Alert>
      )}
      <MultiSelect
        label="Khóa NLS"
        placeholder={chon.length === 0 ? 'Chọn khóa' : undefined}
        data={luaChon}
        value={chon}
        onChange={setChon}
        searchable
        filter={locTiengViet}
        nothingFoundMessage={ds.isLoading ? 'Đang tải...' : 'Không có khóa trong phạm vi Sở'}
        comboboxProps={{ withinPortal: true }}
      />
      <Group justify="flex-end">
        <Button variant="light" onClick={luu} loading={gan.isPending} disabled={ds.isLoading}>
          Lưu khóa của đợt
        </Button>
      </Group>
    </Stack>
  );
}
