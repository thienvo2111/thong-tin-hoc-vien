import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  Alert,
  Anchor,
  Badge,
  Button,
  Container,
  Group,
  Paper,
  Select,
  Skeleton,
  Stack,
  Table,
  Tabs,
  Text,
  Title,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useBuoiCuaLop, useHocVienCuaBuoi, useHocVienCuaLop, xuatDanhSachBuoiHoTro } from '@/api/hoTro';
import type {
  BuoiCuaLopHoTro,
  DiemDanhBuoiHoTro,
  HocVienCuaBuoi,
  HocVienCuaLop,
  MaDiemDanhBuoi,
  TongDiemDanhBuoi,
} from '@/api/types';
import { ApiError } from '@/api/client';
import { thongDiepLoiChung } from '@/lib/loiApi';
import { dinhDangGio, dinhDangNgay } from '@/lib/ngay';
import { taiFileTuBlob } from '@/lib/taiFile';
import { NHAN_LOAI_LOP, useXuatDanhSachLop } from './HoTroLop';

/** Danh sách học viên của 1 lớp được gắn (ADR 0008) — tab "Cả lớp" theo lớp gốc; tab "Theo buổi" tính đổi buổi (L7). */
export default function HoTroLopChiTiet() {
  const { lopId } = useParams<{ lopId: string }>();
  const { data, isLoading, isError, error } = useHocVienCuaLop(lopId);
  const { dangXuat, xuat } = useXuatDanhSachLop();
  const khongThay = error instanceof ApiError && error.status === 404;

  return (
    <Container size="xl" py="lg" px={{ base: 'md', md: 28 }}>
      <Stack gap="md">
        <Anchor component={Link} to="/ho-tro/lop" fz="sm">
          ← Lớp hỗ trợ
        </Anchor>
        {isLoading && <Skeleton height={160} />}
        {isError &&
          (khongThay ? (
            <Alert color="yellow" variant="light" title="Không tìm thấy lớp">
              Lớp không tồn tại hoặc Thầy/Cô không được gắn hỗ trợ lớp này.
            </Alert>
          ) : (
            <Alert color="red">{thongDiepLoiChung(error)}</Alert>
          ))}
        {data && (
          <>
            <Group justify="space-between" align="flex-end">
              <Stack gap={2}>
                <Text fz="sm" c="dimmed">
                  {data.lop.khoa.ma_khoa} · {data.lop.khoa.ten_khoa}
                </Text>
                <Title order={3}>
                  {NHAN_LOAI_LOP[data.lop.loai_lop]} · {data.lop.ten_lop}
                </Title>
                <Text fz="sm">{data.hoc_vien.length.toLocaleString('vi-VN')} học viên</Text>
              </Stack>
              <Button variant="default" onClick={() => xuat(data.lop.lop_id)} loading={dangXuat === data.lop.lop_id}>
                Xuất Excel lớp này
              </Button>
            </Group>
            <Tabs defaultValue="ca-lop" keepMounted={false}>
              <Tabs.List>
                <Tabs.Tab value="ca-lop">Cả lớp</Tabs.Tab>
                <Tabs.Tab value="theo-buoi">Theo buổi</Tabs.Tab>
              </Tabs.List>
              <Tabs.Panel value="ca-lop" pt="md">
                <BangCaLop hocVien={data.hoc_vien} />
              </Tabs.Panel>
              <Tabs.Panel value="theo-buoi" pt="md">
                <TheoBuoi lopId={data.lop.lop_id} />
              </Tabs.Panel>
            </Tabs>
          </>
        )}
      </Stack>
    </Container>
  );
}

function BangCaLop({ hocVien }: { hocVien: HocVienCuaLop[] }) {
  return (
    <Paper withBorder radius={14} style={{ overflow: 'hidden' }}>
      <Table.ScrollContainer minWidth={1100}>
        <Table verticalSpacing="sm" horizontalSpacing="md">
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Họ tên</Table.Th>
              <Table.Th>Mã MOET</Table.Th>
              <Table.Th>Ngày sinh</Table.Th>
              <Table.Th>Đơn vị</Table.Th>
              <Table.Th>Số điện thoại</Table.Th>
              <Table.Th>Email</Table.Th>
              <Table.Th>Cụm</Table.Th>
              <Table.Th>Giai đoạn</Table.Th>
              <Table.Th>Có mặt / đã diễn ra</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {hocVien.length === 0 && (
              <Table.Tr>
                <Table.Td colSpan={9}>
                  <Text c="dimmed" ta="center" py="lg">
                    Lớp chưa có học viên nào.
                  </Text>
                </Table.Td>
              </Table.Tr>
            )}
            {hocVien.map((h) => (
              <Table.Tr key={h.hoc_vien_id}>
                <Table.Td>
                  <Anchor component={Link} to={`/ho-tro/hoc-vien/${h.hoc_vien_id}`} fw={600} fz="sm">
                    {h.ho_ten}
                  </Anchor>
                </Table.Td>
                <Table.Td>{h.ma_dinh_danh_moet ?? '—'}</Table.Td>
                <Table.Td>{h.ngay_sinh}</Table.Td>
                <Table.Td>{h.don_vi_cong_tac_ten}</Table.Td>
                <Table.Td>{h.so_dien_thoai_lien_he ?? '—'}</Table.Td>
                <Table.Td>{h.email_lien_he ?? '—'}</Table.Td>
                <Table.Td>{h.cum ?? '—'}</Table.Td>
                <Table.Td>{h.giai_doan.join(', ') || '—'}</Table.Td>
                <Table.Td>
                  {h.chuyen_can.co_mat}/{h.chuyen_can.da_dien_ra}
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>
    </Paper>
  );
}

/** "GĐ1 – Buổi 2 · 20/10 19:00 · 30 HV" */
function nhanBuoi(b: BuoiCuaLopHoTro): string {
  const ngay = dinhDangNgay(b.thoi_gian_bat_dau).slice(0, 5);
  return `GĐ${b.giai_doan.thu_tu} – Buổi ${b.buoi_so} · ${ngay} ${dinhDangGio(b.thoi_gian_bat_dau)} · ${b.si_so} HV`;
}

function useXuatDanhSachBuoi(lopId: string) {
  const [dangXuat, setDangXuat] = useState<string | null>(null);
  async function xuat(lichId?: string) {
    setDangXuat(lichId ?? 'tat-ca');
    try {
      const blob = await xuatDanhSachBuoiHoTro(lopId, lichId);
      const ngay = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      taiFileTuBlob(blob, `ds-buoi-${ngay}.xlsx`);
    } catch (err) {
      notifications.show({ color: 'red', message: thongDiepLoiChung(err) });
    } finally {
      setDangXuat(null);
    }
  }
  return { dangXuat, xuat };
}

/** Buổi mặc định: buổi gần nhất chưa kết thúc, hết thì buổi cuối. */
function buoiMacDinh(ds: BuoiCuaLopHoTro[]): string | null {
  const now = Date.now();
  return (ds.find((b) => new Date(b.thoi_gian_ket_thuc).getTime() >= now) ?? ds[ds.length - 1])?.lich_id ?? null;
}

function TheoBuoi({ lopId }: { lopId: string }) {
  const dsBuoi = useBuoiCuaLop(lopId);
  const [chon, setChon] = useState<string | null>(null);
  const lichId = chon ?? (dsBuoi.data ? buoiMacDinh(dsBuoi.data) : null);
  const ds = useHocVienCuaBuoi(lopId, lichId);
  const { dangXuat, xuat } = useXuatDanhSachBuoi(lopId);
  const buoi = dsBuoi.data?.find((b) => b.lich_id === lichId);

  if (dsBuoi.isLoading) return <Skeleton height={120} />;
  if (dsBuoi.isError) return <Alert color="red">{thongDiepLoiChung(dsBuoi.error)}</Alert>;
  if (!dsBuoi.data || dsBuoi.data.length === 0) {
    return (
      <Alert color="yellow" variant="light">
        Lớp chưa có lịch học.
      </Alert>
    );
  }
  return (
    <Stack gap="md">
      <Text fz="sm" c="dimmed">
        Danh sách từng buổi đã tính đổi buổi được duyệt: có người đổi vào từ lớp khác, không có người đã chuyển sang lớp
        khác.
      </Text>
      <Group justify="space-between" align="flex-end">
        <Group align="flex-end" gap="sm">
          <Select
            label="Buổi học"
            w={340}
            data={dsBuoi.data.map((b) => ({ value: b.lich_id, label: nhanBuoi(b) }))}
            value={lichId}
            onChange={setChon}
            allowDeselect={false}
          />
          {buoi && buoi.so_doi_vao > 0 && (
            <Badge color="teal" variant="light" size="lg">
              {buoi.so_doi_vao} đổi vào
            </Badge>
          )}
          {buoi && buoi.so_doi_ra > 0 && (
            <Badge color="orange" variant="light" size="lg">
              {buoi.so_doi_ra} đổi ra
            </Badge>
          )}
        </Group>
        <Group gap="sm">
          <Button
            variant="default"
            onClick={() => lichId && xuat(lichId)}
            loading={!!lichId && dangXuat === lichId}
            disabled={!lichId}
          >
            Xuất buổi này
          </Button>
          <Button variant="default" onClick={() => xuat()} loading={dangXuat === 'tat-ca'}>
            Xuất tất cả buổi
          </Button>
        </Group>
      </Group>
      {ds.isLoading && <Skeleton height={120} />}
      {ds.isError && <Alert color="red">{thongDiepLoiChung(ds.error)}</Alert>}
      {ds.data && (
        <>
          <Text fz="sm" fw={600}>
            {moTaTongDiemDanh(ds.data.buoi.tong_diem_danh)}
          </Text>
          <BangBuoi hocVien={ds.data.hoc_vien} trong="Buổi này chưa có học viên nào." />
          {ds.data.doi_ra.length > 0 && (
            <Stack gap="xs">
              <Title order={5}>Đã chuyển sang lớp khác (không học buổi này)</Title>
              <BangBuoi hocVien={ds.data.doi_ra} trong="" />
            </Stack>
          )}
        </>
      )}
    </Stack>
  );
}

const MAU_DIEM_DANH: Record<MaDiemDanhBuoi, string> = {
  co_mat: 'green',
  vang: 'red',
  vang_co_phep: 'orange',
  da_bao_vang: 'orange',
  chua_diem_danh: 'gray',
  chua_den_gio: 'gray',
};

/** ADR 0008 L8 — cùng câu với dòng tổng hợp trong file Excel buổi. */
function moTaTongDiemDanh(t: TongDiemDanhBuoi): string {
  return `Có mặt ${t.co_mat} · Vắng ${t.vang} · Có phép ${t.vang_co_phep} · Báo vắng ${t.da_bao_vang} · Chưa điểm danh ${t.chua_diem_danh}`;
}

function BadgeDiemDanh({ diemDanh }: { diemDanh: DiemDanhBuoiHoTro }) {
  return (
    <Badge
      color={MAU_DIEM_DANH[diemDanh.ma]}
      variant="light"
      size="sm"
      tt="none"
      style={{ whiteSpace: 'normal', height: 'auto' }}
    >
      {diemDanh.nhan}
    </Badge>
  );
}

function BangBuoi({ hocVien, trong }: { hocVien: HocVienCuaBuoi[]; trong: string }) {
  return (
    <Paper withBorder radius={14} style={{ overflow: 'hidden' }}>
      <Table.ScrollContainer minWidth={1100}>
        <Table verticalSpacing="sm" horizontalSpacing="md">
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Họ tên</Table.Th>
              <Table.Th>Mã MOET</Table.Th>
              <Table.Th>Ngày sinh</Table.Th>
              <Table.Th>Đơn vị</Table.Th>
              <Table.Th>Số điện thoại</Table.Th>
              <Table.Th>Email</Table.Th>
              <Table.Th>Cụm</Table.Th>
              <Table.Th>Điểm danh</Table.Th>
              <Table.Th>Ghi chú</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {hocVien.length === 0 && (
              <Table.Tr>
                <Table.Td colSpan={9}>
                  <Text c="dimmed" ta="center" py="lg">
                    {trong}
                  </Text>
                </Table.Td>
              </Table.Tr>
            )}
            {hocVien.map((h) => (
              <Table.Tr key={h.hoc_vien_id} bg={h.doi_buoi === 'vao' ? 'var(--mantine-color-teal-light)' : undefined}>
                <Table.Td>
                  {/* Đổi vào / đổi ra: ngoài phạm vi sửa của lớp (ADR 0008 L2) → không dẫn tới chi tiết. */}
                  {h.doi_buoi === null ? (
                    <Anchor component={Link} to={`/ho-tro/hoc-vien/${h.hoc_vien_id}`} fw={600} fz="sm">
                      {h.ho_ten}
                    </Anchor>
                  ) : (
                    <Group gap={6} wrap="nowrap">
                      <Text fw={600} fz="sm">
                        {h.ho_ten}
                      </Text>
                      {h.doi_buoi === 'vao' && (
                        <Badge color="teal" variant="light" size="sm">
                          Đổi vào
                        </Badge>
                      )}
                    </Group>
                  )}
                </Table.Td>
                <Table.Td>{h.ma_dinh_danh_moet ?? '—'}</Table.Td>
                <Table.Td>{h.ngay_sinh}</Table.Td>
                <Table.Td>{h.don_vi_cong_tac_ten}</Table.Td>
                <Table.Td>{h.so_dien_thoai_lien_he ?? '—'}</Table.Td>
                <Table.Td>{h.email_lien_he ?? '—'}</Table.Td>
                <Table.Td>{h.cum ?? '—'}</Table.Td>
                <Table.Td>{h.diem_danh ? <BadgeDiemDanh diemDanh={h.diem_danh} /> : '—'}</Table.Td>
                <Table.Td>{h.ghi_chu ?? ''}</Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>
    </Paper>
  );
}
