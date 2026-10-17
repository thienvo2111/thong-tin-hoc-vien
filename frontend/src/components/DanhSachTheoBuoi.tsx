import { useState } from 'react';
import { Badge, NativeSelect, Paper, Stack, Table, Text } from '@mantine/core';
import type { TrangLop } from '@/api/hoTroGv';
import { dinhDangGio, dinhDangThuNgay } from '@/lib/ngay';

const NHAN_MUC: Record<string, string> = { co_ban: 'Cơ bản', thanh_thao: 'Thành thạo', nang_cao: 'Nâng cao' };
const NHAN_DIEM_DANH: Record<string, string> = { co_mat: 'Có mặt', vang: 'Vắng', vang_co_phep: 'Vắng có phép' };

type HocVien = TrangLop['hoc_vien'][number];
type Buoi = TrangLop['buoi'][number];

/**
 * Danh sách 1 buổi = học viên lớp gốc − người đổi ra + người đổi vào (spec đổi buổi §5).
 * Chỉ đổi buổi đã duyệt còn hiệu lực — backend đã tính sẵn ở doi_buoi.
 */
export function dsTheoBuoi(d: TrangLop, lichId: string) {
  const hocVien: (HocVien & { tuLop: string | null })[] = [];
  const doiRa: { ho_ten: string; lop: string }[] = [];
  for (const h of d.hoc_vien) {
    const n = h.doi_buoi?.[lichId];
    if (n?.loai === 'ra') doiRa.push({ ho_ten: h.ho_ten, lop: n.lop });
    else hocVien.push({ ...h, tuLop: null });
  }
  for (const h of d.hoc_vien_doi_vao ?? []) {
    const n = h.doi_buoi?.[lichId];
    if (n?.loai === 'vao') hocVien.push({ ...h, tuLop: n.lop });
  }
  return { hocVien, doiRa };
}

/** Buổi chưa kết thúc sớm nhất; đã qua hết thì buổi cuối. */
export function buoiMacDinh(ds: Buoi[], now: Date = new Date()): string | null {
  return (ds.find((b) => new Date(b.thoi_gian_ket_thuc) >= now) ?? ds[ds.length - 1])?.id ?? null;
}

function ODiemDanh({ h, lichId }: { h: HocVien; lichId: string }) {
  const dd = h.diem_danh[lichId];
  const bv = h.bao_vang?.[lichId];
  if (dd) {
    return (
      <Badge variant="light" color={dd === 'co_mat' ? 'green' : 'red'}>
        {NHAN_DIEM_DANH[dd] ?? dd}
      </Badge>
    );
  }
  if (bv) {
    return (
      <Badge variant="light" color="orange" title={bv}>
        Báo vắng: {bv}
      </Badge>
    );
  }
  return <>—</>;
}

/** Học viên của từng buổi — dùng ở cổng giảng viên và hồ sơ lớp của hỗ trợ GV (cột theo dữ liệu backend đã lọc vai trò). */
export function DanhSachTheoBuoi({ d }: { d: TrangLop }) {
  const [lichId, setLichId] = useState(() => buoiMacDinh(d.buoi));
  const buoi = d.buoi.find((b) => b.id === lichId);
  if (!buoi) {
    return (
      <Text c="dimmed" ta="center" py="md">
        Lớp chưa có buổi học trong giai đoạn này.
      </Text>
    );
  }
  const { hocVien, doiRa } = dsTheoBuoi(d, buoi.id);
  const coSdt = [...d.hoc_vien, ...(d.hoc_vien_doi_vao ?? [])].some((h) => h.so_dien_thoai);

  return (
    <Stack gap="sm">
      <NativeSelect
        label="Buổi"
        value={buoi.id}
        onChange={(e) => setLichId(e.currentTarget.value)}
        data={d.buoi.map((b) => ({
          value: b.id,
          label: `Buổi ${b.buoi_so} – ${dinhDangThuNgay(b.thoi_gian_bat_dau)}, ${dinhDangGio(b.thoi_gian_bat_dau)}–${dinhDangGio(b.thoi_gian_ket_thuc)}`,
        }))}
        w={{ base: '100%', sm: 380 }}
      />
      <Text fz="sm" fw={600}>
        {hocVien.length} học viên
      </Text>
      {doiRa.length > 0 && (
        <Stack gap={2}>
          {doiRa.map((r) => (
            <Text key={r.ho_ten} fz="sm" c="dimmed">
              {r.ho_ten} – đã chuyển sang {r.lop}, không học buổi này
            </Text>
          ))}
        </Stack>
      )}
      {hocVien.length === 0 ? (
        <Text c="dimmed" ta="center" py="md">
          Buổi này chưa có học viên.
        </Text>
      ) : (
        <Paper withBorder radius={12} style={{ overflow: 'hidden' }}>
          <Table.ScrollContainer minWidth={560}>
            <Table verticalSpacing="xs" fz="sm">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th w={40}>#</Table.Th>
                  <Table.Th>Họ tên</Table.Th>
                  <Table.Th>Đơn vị</Table.Th>
                  <Table.Th>Mức đầu vào</Table.Th>
                  {coSdt && <Table.Th>SĐT</Table.Th>}
                  <Table.Th>Điểm danh</Table.Th>
                  <Table.Th>Ghi chú</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {hocVien.map((h, i) => (
                  <Table.Tr key={h.dang_ky_hoc_id}>
                    <Table.Td>{i + 1}</Table.Td>
                    <Table.Td fw={600}>{h.ho_ten}</Table.Td>
                    <Table.Td>{h.don_vi}</Table.Td>
                    <Table.Td>
                      {h.muc_dau_vao ? NHAN_MUC[h.muc_dau_vao] ?? h.muc_dau_vao : '—'}
                      {h.muc_hoc_chon && <> (tự chọn: {NHAN_MUC[h.muc_hoc_chon] ?? h.muc_hoc_chon})</>}
                    </Table.Td>
                    {coSdt && <Table.Td>{h.so_dien_thoai ?? '—'}</Table.Td>}
                    <Table.Td>
                      <ODiemDanh h={h} lichId={buoi.id} />
                    </Table.Td>
                    <Table.Td>{h.tuLop ? `Đổi buổi – từ lớp ${h.tuLop}` : ''}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        </Paper>
      )}
    </Stack>
  );
}
