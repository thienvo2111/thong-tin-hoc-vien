// PROTOTYPE — ticket #48. Mảnh nhỏ dùng chung (ô nhập, dòng danh sách) — KHÔNG dùng chung bố cục.
import { Badge, Button, Group, Radio, Stack, Text, Textarea, TextInput } from '@mantine/core';
import { useState } from 'react';
import { NHAN_GIAI_DOAN, type DongDanhSach, type TruongTT } from './duLieu';
import type { KhaiHopDong } from './trangThai';

export function O({ t, gt, loi, onChange, hienLoi }: { t: TruongTT; gt: string; loi?: string; onChange: (v: string) => void; hienLoi: boolean }) {
  const Comp = t.kieu === 'textarea' ? Textarea : TextInput;
  return (
    <Comp
      size="md"
      label={t.nhan}
      description={t.goiY}
      value={gt}
      onChange={(e) => onChange(e.currentTarget.value)}
      error={hienLoi ? loi : undefined}
      autosize={t.kieu === 'textarea' ? true : undefined}
    />
  );
}

export function DongDs({ d, k }: { d: DongDanhSach; k: KhaiHopDong }) {
  const [moSua, setMoSua] = useState(false);
  const [deNghi, setDeNghi] = useState(d.deNghi ?? '');
  return (
    <Stack gap={4} py="xs" style={{ borderBottom: '1px solid var(--mantine-color-gray-3)' }}>
      <Group justify="space-between" wrap="nowrap">
        <div>
          <Text fw={600}>{d.hoTen}</Text>
          <Text size="sm" c="dimmed">
            {d.ngaySinh} · {d.lop} · {NHAN_GIAI_DOAN[d.giaiDoan]} · {d.tyLeSuat} suất
          </Text>
          {d.ghiChu && <Text size="xs" c="orange">{d.ghiChu}</Text>}
        </div>
        {d.yKien === 'dong_y' && <Badge color="green">Đồng ý</Badge>}
        {d.yKien === 'khong_dong_y' && <Badge color="red">Đề nghị sửa</Badge>}
      </Group>
      {!d.yKien && !moSua && (
        <Group gap="xs">
          <Button size="xs" color="green" variant="light" onClick={() => k.datYKien(d.id, 'dong_y')}>Đồng ý</Button>
          <Button size="xs" color="red" variant="light" onClick={() => setMoSua(true)}>Không đồng ý</Button>
        </Group>
      )}
      {moSua && (
        <Stack gap={4}>
          <Textarea size="sm" placeholder="Ghi đúng thông tin: vd. ngày sinh 12/3/1980; chỉ học GĐ1; không còn công tác…" value={deNghi} onChange={(e) => setDeNghi(e.currentTarget.value)} autosize />
          <Group gap="xs">
            <Button size="xs" disabled={!deNghi.trim()} onClick={() => { k.datYKien(d.id, 'khong_dong_y', deNghi); setMoSua(false); }}>Gửi đề nghị sửa</Button>
            <Button size="xs" variant="subtle" onClick={() => setMoSua(false)}>Hủy</Button>
          </Group>
        </Stack>
      )}
      {d.yKien === 'khong_dong_y' && <Text size="xs">Đề nghị: {d.deNghi} — chờ HCMUE duyệt</Text>}
    </Stack>
  );
}

export function ChonDiemTrucTiep({ k }: { k: KhaiHopDong }) {
  return (
    <Radio.Group
      label="Trường có phải điểm tổ chức bồi dưỡng trực tiếp không?"
      value={k.diemTrucTiep ? 'co' : 'khong'}
      onChange={(v) => k.setDiemTrucTiep(v === 'co')}
    >
      <Stack gap={4} mt={4}>
        <Radio value="khong" label="Không phải điểm học trực tiếp" />
        <Radio value="co" label="Là điểm học trực tiếp" />
      </Stack>
    </Radio.Group>
  );
}

// Thông tin trường chuyển khoản cho HCMUE — suy ra từ mã QHNS của trường (tài khoản định danh theo đơn vị).
export function ThongTinChuyenKhoan({ qhns }: { qhns?: string }) {
  const hopLe = /^\d{7}$/.test((qhns ?? '').trim());
  return (
    <Stack gap={2} p="sm" style={{ border: '1px dashed var(--mantine-color-blue-5)', borderRadius: 8 }}>
      <Text fw={600}>Thông tin chuyển khoản</Text>
      <Text size="sm">Đơn vị tiếp nhận: Trường Đại học Sư phạm Thành phố Hồ Chí Minh</Text>
      <Text size="sm">
        Số tài khoản: <b>{hopLe ? `HCMUE${qhns!.trim()}` : 'HCMUE + 7 số mã QHNS (chưa có mã QHNS hợp lệ)'}</b>
      </Text>
      <Text size="sm">Ngân hàng TMCP Đại Chúng Việt Nam (PVcomBank)</Text>
      {hopLe && <Text size="xs" c="orange">Số tài khoản lấy từ mã QHNS Thầy/Cô đã khai — sai mã QHNS sẽ chuyển nhầm tài khoản.</Text>}
    </Stack>
  );
}

export function TrangThaiJson({ k }: { k: KhaiHopDong }) {
  const { ds, ...rest } = k;
  const tom = {
    dongY: ds.filter((d) => d.yKien === 'dong_y').length,
    deNghi: ds.filter((d) => d.yKien === 'khong_dong_y').length,
    chuaYKien: ds.filter((d) => !d.yKien).length,
    suat: rest.suat, giaTri: rest.giaTri, canQd: rest.canQd, diemTrucTiep: rest.diemTrucTiep,
    daXacNhanDs: rest.daXacNhanDs, coTheNop: rest.coTheNop, daNop: rest.daNop,
    soLoiHoSo: Object.keys(rest.loiHoSo).length, loiHd: rest.loiHd,
  };
  return (
    <details style={{ margin: '24px 0 96px', fontSize: 12 }}>
      <summary>Trạng thái (prototype)</summary>
      <pre style={{ whiteSpace: 'pre-wrap' }}>{JSON.stringify(tom, null, 2)}</pre>
    </details>
  );
}
