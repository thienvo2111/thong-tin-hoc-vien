// PROTOTYPE — Phương án B: Một trang, hồ sơ dạng "thẻ đã khai" (chỉ mở sửa khi cần) + thanh tổng cố định đáy.
import { Accordion, Badge, Button, Group, Paper, Stack, Text, TextInput, Title } from '@mantine/core';
import { useState } from 'react';
import { ChonDiemTrucTiep, DongDs, O, ThongTinChuyenKhoan, TrangThaiJson } from './chung';
import { dot, NHOM_HO_SO, NHOM_HOP_DONG, tien, truong } from './duLieu';
import type { KhaiHopDong } from './trangThai';

export const tenB = 'Một trang, thẻ thu gọn';

export default function PhuongAnB({ k }: { k: KhaiHopDong }) {
  const [hienLoi, setHienLoi] = useState(false);
  const nhomHoSo = NHOM_HO_SO.filter((_, i) => i < 3 || k.diemTrucTiep);
  const soLoi = (keys: string[]) => keys.filter((x) => k.loiHoSo[x]).length;

  return (
    <Stack maw={640} mx="auto" p="md" pb={140}>
      <Title order={3}>{truong.ten}</Title>
      <Text c="dimmed" size="sm">{dot.ten}</Text>

      <Accordion multiple defaultValue={['ds']} variant="separated">
        <Accordion.Item value="ds">
          <Accordion.Control>
            <Group justify="space-between">
              <Text fw={600}>1. Danh sách giáo viên ({k.ds.length})</Text>
              <Badge color={k.daXacNhanDs ? 'green' : 'gray'}>{k.daXacNhanDs ? 'Đã xác nhận' : 'Chưa xác nhận'}</Badge>
            </Group>
          </Accordion.Control>
          <Accordion.Panel>
            <Button size="xs" variant="light" onClick={k.dongYTatCa}>Đồng ý tất cả dòng còn lại</Button>
            {k.ds.map((d) => <DongDs key={d.id} d={d} k={k} />)}
            <Button mt="sm" disabled={!k.dsSanSang || k.daXacNhanDs} onClick={k.xacNhanDs}>Xác nhận danh sách</Button>
          </Accordion.Panel>
        </Accordion.Item>

        <Accordion.Item value="hs">
          <Accordion.Control>
            <Group justify="space-between">
              <Text fw={600}>2. Hồ sơ đơn vị (dùng chung mọi chương trình)</Text>
              <Badge color={Object.keys(k.loiHoSo).length ? 'orange' : 'green'}>
                {Object.keys(k.loiHoSo).length ? `Thiếu ${Object.keys(k.loiHoSo).length}` : 'Đủ'}
              </Badge>
            </Group>
          </Accordion.Control>
          <Accordion.Panel>
            <ChonDiemTrucTiep k={k} />
            {nhomHoSo.map((n) => (
              <TheHoSo key={n.ten} ten={n.ten} soLoi={soLoi(n.truong.map((t) => t.key))}>
                {n.truong.map((t) => <O key={t.key} t={t} gt={k.hoSo[t.key] ?? ''} loi={k.loiHoSo[t.key]} onChange={(v) => k.setHoSo(t.key, v)} hienLoi={hienLoi} />)}
              </TheHoSo>
            ))}
          </Accordion.Panel>
        </Accordion.Item>

        <Accordion.Item value="hd">
          <Accordion.Control><Text fw={600}>3. Thông tin hợp đồng</Text></Accordion.Control>
          <Accordion.Panel>
            <Stack gap="xs">
              <ThongTinChuyenKhoan qhns={k.hoSo.qhns} />
              {NHOM_HOP_DONG.map((t) => <O key={t.key} t={t} gt={k.hd[t.key] ?? ''} loi={k.loiHd[t.key]} onChange={(v) => k.setHd(t.key, v)} hienLoi={hienLoi} />)}
              {k.canQd && (
                <>
                  <TextInput size="md" label="Số QĐ chỉ định thầu" value={k.hd.soQd ?? ''} onChange={(e) => k.setHd('soQd', e.currentTarget.value)} error={hienLoi && k.loiHd.soQd} />
                  <TextInput size="md" label="Ngày QĐ" description={`Từ ${dot.qdTu} đến ${dot.qdDen}`} placeholder="dd/mm/2026" value={k.hd.ngayQd ?? ''} onChange={(e) => k.setHd('ngayQd', e.currentTarget.value)} error={hienLoi && k.loiHd.ngayQd} />
                </>
              )}
            </Stack>
          </Accordion.Panel>
        </Accordion.Item>
      </Accordion>
      <TrangThaiJson k={k} />

      <Paper shadow="md" p="sm" withBorder style={{ position: 'fixed', left: 0, right: 0, bottom: 56, zIndex: 50 }}>
        <Group justify="space-between" maw={640} mx="auto">
          <div>
            <Text size="sm">{k.suat} suất × {tien(dot.donGia)}</Text>
            <Text fw={700}>{tien(k.giaTri)}</Text>
          </div>
          <Button disabled={k.daNop} onClick={() => { setHienLoi(true); k.nop(); }}>{k.daNop ? 'Đã nộp' : 'Nộp hợp đồng'}</Button>
        </Group>
      </Paper>
    </Stack>
  );
}

function TheHoSo({ ten, soLoi, children }: { ten: string; soLoi: number; children: React.ReactNode }) {
  const [mo, setMo] = useState(soLoi > 0);
  return (
    <Paper withBorder p="sm" mt="sm">
      <Group justify="space-between">
        <Text fw={600}>{ten}</Text>
        <Button size="xs" variant="subtle" onClick={() => setMo(!mo)}>{mo ? 'Thu gọn' : soLoi ? `Bổ sung (${soLoi})` : 'Đã khai · Sửa'}</Button>
      </Group>
      {mo && <Stack gap="xs" mt="xs">{children}</Stack>}
    </Paper>
  );
}
