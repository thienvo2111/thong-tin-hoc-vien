// PROTOTYPE — Phương án A: Từng bước (Stepper) — mỗi màn một việc, nút Tiếp ở cuối.
import { Alert, Button, Group, Paper, Stack, Stepper, Text, TextInput, Title } from '@mantine/core';
import { useState } from 'react';
import { ChonDiemTrucTiep, DongDs, O, ThongTinChuyenKhoan, TrangThaiJson } from './chung';
import { dot, NHOM_HO_SO, NHOM_HOP_DONG, tien, truong } from './duLieu';
import type { KhaiHopDong } from './trangThai';

export const tenA = 'Từng bước';

export default function PhuongAnA({ k }: { k: KhaiHopDong }) {
  const [buoc, setBuoc] = useState(0);
  const [daThuTiep, setDaThuTiep] = useState(false);
  const nhomHoSo = NHOM_HO_SO.filter((_, i) => i < 3 || k.diemTrucTiep);

  return (
    <Stack maw={560} mx="auto" p="md">
      <Title order={3}>{dot.ten}</Title>
      <Text c="dimmed" size="sm">{truong.ten}</Text>
      <Stepper active={buoc} onStepClick={setBuoc} size="xs" orientation="horizontal">
        <Stepper.Step label="Danh sách" />
        <Stepper.Step label="Hồ sơ đơn vị" />
        <Stepper.Step label="Hợp đồng" />
        <Stepper.Step label="Nộp" />
      </Stepper>

      {buoc === 0 && (
        <Stack gap="xs">
          <Text>Thầy/Cô kiểm tra từng giáo viên. Sai thông tin nào thì bấm "Không đồng ý" và ghi đúng.</Text>
          <Button variant="light" onClick={k.dongYTatCa}>Đồng ý tất cả dòng còn lại</Button>
          {k.ds.map((d) => <DongDs key={d.id} d={d} k={k} />)}
          <Text fw={600}>Tổng {k.suat} suất · tạm tính {tien(k.giaTri)}</Text>
          <Button disabled={!k.dsSanSang || k.daXacNhanDs} onClick={() => { k.xacNhanDs(); setBuoc(1); }}>
            {k.daXacNhanDs ? 'Đã xác nhận danh sách' : 'Xác nhận danh sách'}
          </Button>
          {!k.dsSanSang && <Text size="xs" c="dimmed">Còn dòng chưa đồng ý hoặc đề nghị đang chờ HCMUE duyệt.</Text>}
        </Stack>
      )}

      {buoc === 1 && (
        <Stack>
          {truong.daKhaiChoNls && <Alert color="blue">Đã điền sẵn từ thông tin trường khai cho chương trình NLS. Thầy/Cô chỉ rà lại.</Alert>}
          <ChonDiemTrucTiep k={k} />
          {nhomHoSo.map((n) => (
            <Paper key={n.ten} withBorder p="sm">
              <Text fw={600} mb="xs">{n.ten}</Text>
              <Stack gap="xs">
                {n.truong.map((t) => <O key={t.key} t={t} gt={k.hoSo[t.key] ?? ''} loi={k.loiHoSo[t.key]} onChange={(v) => k.setHoSo(t.key, v)} hienLoi={daThuTiep} />)}
              </Stack>
            </Paper>
          ))}
          <Button onClick={() => { setDaThuTiep(true); if (!Object.keys(k.loiHoSo).length) setBuoc(2); }}>Tiếp</Button>
        </Stack>
      )}

      {buoc === 2 && (
        <Stack>
          <Paper withBorder p="sm" bg="gray.0">
            <Text>Số lượng: <b>{k.suat} suất</b> (theo danh sách)</Text>
            <Text>Giá trị hợp đồng: <b>{tien(k.giaTri)}</b></Text>
          </Paper>
          <ThongTinChuyenKhoan qhns={k.hoSo.qhns} />
          {NHOM_HOP_DONG.map((t) => <O key={t.key} t={t} gt={k.hd[t.key] ?? ''} loi={k.loiHd[t.key]} onChange={(v) => k.setHd(t.key, v)} hienLoi={daThuTiep} />)}
          {k.canQd && (
            <Paper withBorder p="sm">
              <Text fw={600}>Quyết định chỉ định thầu (hợp đồng từ 50 triệu)</Text>
              <TextInput size="md" label="Số quyết định" value={k.hd.soQd ?? ''} onChange={(e) => k.setHd('soQd', e.currentTarget.value)} error={daThuTiep && k.loiHd.soQd} />
              <TextInput size="md" label="Ngày quyết định" description={`Từ ${dot.qdTu} đến ${dot.qdDen}`} placeholder="dd/mm/2026" value={k.hd.ngayQd ?? ''} onChange={(e) => k.setHd('ngayQd', e.currentTarget.value)} error={daThuTiep && k.loiHd.ngayQd} />
            </Paper>
          )}
          <Button onClick={() => setBuoc(3)}>Tiếp</Button>
        </Stack>
      )}

      {buoc === 3 && (
        <Stack>
          <Text>Danh sách: {k.daXacNhanDs ? '✔ đã xác nhận' : '✘ chưa xác nhận'}</Text>
          <Text>Hồ sơ đơn vị: {Object.keys(k.loiHoSo).length ? `✘ còn ${Object.keys(k.loiHoSo).length} ô` : '✔ đủ'}</Text>
          <Text>Hợp đồng: {Object.keys(k.loiHd).length ? `✘ còn ${Object.keys(k.loiHd).length} ô` : '✔ đủ'}</Text>
          <Group>
            <Button disabled={!k.coTheNop} onClick={k.nop}>{k.daNop ? 'Đã nộp' : 'Nộp hợp đồng'}</Button>
          </Group>
        </Stack>
      )}
      <TrangThaiJson k={k} />
    </Stack>
  );
}
