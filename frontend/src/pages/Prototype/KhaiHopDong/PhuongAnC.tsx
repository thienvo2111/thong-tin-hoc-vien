// PROTOTYPE — Phương án C: Bảng việc cần làm theo chương trình (NLS + HSG) — hồ sơ dùng chung một chỗ,
// mỗi việc mở trong Drawer toàn màn hình.
import { Badge, Button, Card, Drawer, Group, Progress, Stack, Text, TextInput, Title } from '@mantine/core';
import { useState } from 'react';
import { ChonDiemTrucTiep, DongDs, O, ThongTinChuyenKhoan, TrangThaiJson } from './chung';
import { dot, NHOM_HO_SO, NHOM_HOP_DONG, tien, truong } from './duLieu';
import type { KhaiHopDong } from './trangThai';

export const tenC = 'Việc cần làm theo chương trình';

type Viec = null | 'hoSo' | 'ds' | 'hd';

export default function PhuongAnC({ k }: { k: KhaiHopDong }) {
  const [mo, setMo] = useState<Viec>(null);
  const [hienLoi, setHienLoi] = useState(false);
  const loiHs = Object.keys(k.loiHoSo).length;
  const xong = [k.daXacNhanDs, loiHs === 0, Object.keys(k.loiHd).length === 0].filter(Boolean).length;

  return (
    <Stack maw={720} mx="auto" p="md">
      <Title order={3}>{truong.ten}</Title>

      <Card withBorder>
        <Group justify="space-between">
          <div>
            <Text fw={600}>Hồ sơ đơn vị</Text>
            <Text size="sm" c="dimmed">Khai một lần, dùng cho mọi chương trình</Text>
          </div>
          <Badge color={loiHs ? 'orange' : 'green'}>{loiHs ? `Thiếu ${loiHs} ô` : 'Đủ'}</Badge>
        </Group>
        <Button mt="sm" variant="light" onClick={() => setMo('hoSo')}>Xem / sửa hồ sơ</Button>
      </Card>

      <Card withBorder>
        <Group justify="space-between">
          <Text fw={600}>{dot.ten}</Text>
          <Badge>{k.daNop ? 'Đã nộp' : `${xong}/3 việc`}</Badge>
        </Group>
        <Progress value={(xong / 3) * 100} mt="xs" />
        <Stack gap="xs" mt="sm">
          <HangViec ten={`Xác nhận danh sách (${k.ds.length} GV)`} xong={k.daXacNhanDs} onMo={() => setMo('ds')} />
          <HangViec ten="Thông tin hợp đồng" xong={!Object.keys(k.loiHd).length} onMo={() => setMo('hd')} phu={`${k.suat} suất · ${tien(k.giaTri)}`} />
        </Stack>
        <Button mt="sm" disabled={!k.coTheNop} onClick={k.nop}>{k.daNop ? 'Đã nộp' : 'Nộp hợp đồng'}</Button>
      </Card>

      <Card withBorder opacity={0.6}>
        <Group justify="space-between">
          <Text fw={600}>NLS An Giang 2026</Text>
          <Badge color="gray">Chưa mở</Badge>
        </Group>
        <Text size="sm" c="dimmed">Khi mở, hồ sơ đơn vị ở trên được dùng lại.</Text>
      </Card>
      <TrangThaiJson k={k} />

      <Drawer opened={mo !== null} onClose={() => setMo(null)} position="bottom" size="100%" title={mo === 'hoSo' ? 'Hồ sơ đơn vị' : mo === 'ds' ? 'Danh sách giáo viên' : 'Thông tin hợp đồng'}>
        {mo === 'hoSo' && (
          <Stack>
            <ChonDiemTrucTiep k={k} />
            {NHOM_HO_SO.filter((_, i) => i < 3 || k.diemTrucTiep).map((n) => (
              <Stack key={n.ten} gap="xs">
                <Text fw={600}>{n.ten}</Text>
                {n.truong.map((t) => <O key={t.key} t={t} gt={k.hoSo[t.key] ?? ''} loi={k.loiHoSo[t.key]} onChange={(v) => k.setHoSo(t.key, v)} hienLoi />)}
              </Stack>
            ))}
            <Button onClick={() => setMo(null)}>Lưu</Button>
          </Stack>
        )}
        {mo === 'ds' && (
          <Stack gap="xs">
            <Button variant="light" onClick={k.dongYTatCa}>Đồng ý tất cả dòng còn lại</Button>
            {k.ds.map((d) => <DongDs key={d.id} d={d} k={k} />)}
            <Button disabled={!k.dsSanSang || k.daXacNhanDs} onClick={() => { k.xacNhanDs(); setMo(null); }}>Xác nhận danh sách</Button>
          </Stack>
        )}
        {mo === 'hd' && (
          <Stack gap="xs">
            <Text>Giá trị: <b>{tien(k.giaTri)}</b> ({k.suat} suất)</Text>
            <ThongTinChuyenKhoan qhns={k.hoSo.qhns} />
            {NHOM_HOP_DONG.map((t) => <O key={t.key} t={t} gt={k.hd[t.key] ?? ''} loi={k.loiHd[t.key]} onChange={(v) => k.setHd(t.key, v)} hienLoi={hienLoi} />)}
            {k.canQd && (
              <>
                <TextInput size="md" label="Số QĐ chỉ định thầu" value={k.hd.soQd ?? ''} onChange={(e) => k.setHd('soQd', e.currentTarget.value)} error={hienLoi && k.loiHd.soQd} />
                <TextInput size="md" label="Ngày QĐ" description={`Từ ${dot.qdTu} đến ${dot.qdDen}`} placeholder="dd/mm/2026" value={k.hd.ngayQd ?? ''} onChange={(e) => k.setHd('ngayQd', e.currentTarget.value)} error={hienLoi && k.loiHd.ngayQd} />
              </>
            )}
            <Button onClick={() => { setHienLoi(true); if (!Object.keys(k.loiHd).length) setMo(null); }}>Lưu</Button>
          </Stack>
        )}
      </Drawer>
    </Stack>
  );
}

function HangViec({ ten, xong, onMo, phu }: { ten: string; xong: boolean; onMo: () => void; phu?: string }) {
  return (
    <Group justify="space-between" wrap="nowrap">
      <div>
        <Text>{xong ? '✔' : '○'} {ten}</Text>
        {phu && <Text size="xs" c="dimmed">{phu}</Text>}
      </div>
      <Button size="xs" variant="light" onClick={onMo}>{xong ? 'Xem' : 'Làm'}</Button>
    </Group>
  );
}
