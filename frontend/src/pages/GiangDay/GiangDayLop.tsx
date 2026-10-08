import { Link, useParams } from 'react-router-dom';
import { Alert, Anchor, Badge, Container, Paper, Skeleton, Stack, Table, Text, Title } from '@mantine/core';
import { useTrangLopGiangVien } from '@/api/congGiangVien';
import type { TrangLop } from '@/api/hoTroGv';
import { thongDiepLoiChung } from '@/lib/loiApi';
import { dinhDangGio, dinhDangNgay, dinhDangNgayGio } from '@/lib/ngay';
import { lienKetBanDo } from '@/lib/banDo';

const NHAN_MUC: Record<string, string> = { co_ban: 'Cơ bản', thanh_thao: 'Thành thạo', nang_cao: 'Nâng cao' };
const NHAN_DIEM_DANH: Record<string, string> = { co_mat: 'Có mặt', vang: 'Vắng', vang_co_phep: 'Vắng có phép' };

/** Trang lớp chỉ đọc của giảng viên (ADR 0004 G9 §3) — backend đã lọc trường theo vai trò. */
export default function GiangDayLop() {
  const { lopId = '', gdId = '' } = useParams();
  const { data, isLoading, isError, error } = useTrangLopGiangVien(lopId, gdId);

  return (
    <Container size="lg" py="lg" px="md">
      <Stack gap="md">
        <Anchor component={Link} to="/giang-day" fz="sm">
          ← Lịch dạy
        </Anchor>
        {isLoading && <Skeleton height={200} />}
        {isError && <Alert color="red">{thongDiepLoiChung(error)}</Alert>}
        {data && <NoiDung d={data} />}
      </Stack>
    </Container>
  );
}

function NoiDung({ d }: { d: TrangLop }) {
  const hauCan = d.hau_can[0];
  return (
    <>
      <div>
        <Title order={3}>{d.lop.ten_lop}</Title>
        <Text c="dimmed" fz="sm">
          {d.lop.khoa.ma_khoa} · GĐ{d.giai_doan.thu_tu} {d.giai_doan.ten_giai_doan} · {d.hoc_vien.length} học viên
        </Text>
      </div>

      <Paper withBorder radius={12} p="md">
        <Text fw={700} mb="xs">
          Lịch buổi
        </Text>
        <Stack gap="xs">
          {d.buoi.map((b) => (
            <div key={b.id}>
              <Text fz="sm" fw={600}>
                Buổi {b.buoi_so}: {dinhDangNgay(b.thoi_gian_bat_dau)} {dinhDangGio(b.thoi_gian_bat_dau)}–
                {dinhDangGio(b.thoi_gian_ket_thuc)}
              </Text>
              <Text fz="sm">
                {b.diem_hoc ? (
                  <>
                    {b.diem_hoc.ten}
                    {b.phong ? ` · phòng ${b.phong}` : ''} — {b.diem_hoc.dia_chi}{' '}
                    <Anchor href={lienKetBanDo(b.diem_hoc.dia_chi)} target="_blank" rel="noreferrer" fz="sm">
                      Bản đồ
                    </Anchor>
                  </>
                ) : (
                  b.dia_diem_hoac_link ?? 'Chưa có điểm học'
                )}
              </Text>
              <Text fz="xs" c="dimmed">
                Giảng viên: {b.giang_vien.map((g) => g.ho_ten).join(', ') || '—'}
              </Text>
            </div>
          ))}
        </Stack>
      </Paper>

      {(hauCan || d.thuc_dia.length > 0 || d.nhom_ho_tro_gv.length > 0) && (
        <Paper withBorder radius={12} p="md">
          <Text fw={700} mb="xs">
            Hậu cần & liên hệ
          </Text>
          {hauCan && (
            <Stack gap={2} mb="xs">
              {hauCan.noi_o_ten && (
                <Text fz="sm">
                  Nơi ở: {hauCan.noi_o_ten}
                  {hauCan.noi_o_dia_chi ? ` — ${hauCan.noi_o_dia_chi}` : ''}
                </Text>
              )}
              {hauCan.don_luc && (
                <Text fz="sm">
                  Đón lúc {dinhDangNgayGio(hauCan.don_luc)}
                  {hauCan.diem_don ? ` tại ${hauCan.diem_don}` : ''}
                </Text>
              )}
              {hauCan.phuong_tien && <Text fz="sm">Phương tiện: {hauCan.phuong_tien}</Text>}
            </Stack>
          )}
          {d.thuc_dia.map((t) => (
            <Text key={t.id} fz="sm">
              Thực địa: {t.ho_ten} —{' '}
              <Anchor href={`tel:${t.so_dien_thoai}`} fz="sm">
                {t.so_dien_thoai}
              </Anchor>
            </Text>
          ))}
          {d.nhom_ho_tro_gv.map((n) => (
            <Text key={n.ho_ten} fz="sm">
              Hỗ trợ GV: {n.ho_ten}
              {n.email ? ` — ${n.email}` : ''}
            </Text>
          ))}
        </Paper>
      )}

      <Paper withBorder radius={12} style={{ overflow: 'hidden' }}>
        <Table.ScrollContainer minWidth={560}>
          <Table verticalSpacing="xs" fz="sm">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Học viên</Table.Th>
                <Table.Th>Đơn vị</Table.Th>
                <Table.Th>Mức đầu vào</Table.Th>
                <Table.Th>Điểm danh / báo vắng</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {d.hoc_vien.map((h) => (
                <Table.Tr key={h.dang_ky_hoc_id}>
                  <Table.Td fw={600}>{h.ho_ten}</Table.Td>
                  <Table.Td>{h.don_vi}</Table.Td>
                  <Table.Td>
                    {h.muc_dau_vao ? NHAN_MUC[h.muc_dau_vao] ?? h.muc_dau_vao : '—'}
                    {h.muc_hoc_chon && <> (tự chọn: {NHAN_MUC[h.muc_hoc_chon] ?? h.muc_hoc_chon})</>}
                  </Table.Td>
                  <Table.Td>
                    {d.buoi.map((b) => {
                      const dd = h.diem_danh[b.id];
                      const bv = h.bao_vang?.[b.id];
                      if (!dd && !bv) return null;
                      return (
                        <Badge
                          key={b.id}
                          mr={4}
                          variant="light"
                          color={dd === 'co_mat' ? 'green' : bv ? 'orange' : 'red'}
                          title={bv}
                        >
                          B{b.buoi_so}: {dd ? NHAN_DIEM_DANH[dd] ?? dd : `báo vắng (${bv})`}
                        </Badge>
                      );
                    })}
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      </Paper>
    </>
  );
}
