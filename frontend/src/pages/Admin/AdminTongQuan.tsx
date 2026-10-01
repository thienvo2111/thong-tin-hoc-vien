import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Button,
  Container,
  Group,
  Paper,
  Select,
  Skeleton,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
} from '@mantine/core';
import { DonutChart, BarChart } from '@mantine/charts';
import { notifications } from '@mantine/notifications';
import { Link } from 'react-router-dom';
import { useBaoCaoTongHop, useDanhSachHocVien } from '@/api/admin';
import { useDanhSachYeuCauHoTroQuanTri } from '@/api/yeuCauHoTro';
import { taiBaoCaoTongQuanExcel, useBaoCaoTongQuanTrungTam, type BaoCaoTongQuanParams } from '@/api/baoCao';
import { useDanhSachKhoa } from '@/api/khoaBoiDuong';
import { layDonViCongTac } from '@/api/danhMuc';
import type { KhaoSatMucRow, KetQuaTheoHinhThucRow, LoaiLop } from '@/api/types';
import { SelectDonVi } from '@/components/SelectDonVi';
import { thongDiepLoiChung } from '@/lib/loiApi';
import { taiFileTuBlob } from '@/lib/taiFile';
import { locTiengViet } from '@/lib/timKiemTiengViet';
import { TrangThaiBadge } from '@/components/TrangThaiBadge';
import { AdminPageHeader } from './AdminPageHeader';

const SO_DONG_CHO_DUYET = 8;

const NHAN_LOAI_LOP: Record<LoaiLop, string> = { truc_tiep: 'Trực tiếp', zoom: 'Zoom', vle: 'VLE' };

function phanTram(tu: number, mau: number): string {
  if (mau <= 0) return '0%';
  return `${Math.round((tu / mau) * 100)}%`;
}

/** KPI card — số liệu THẬT lấy từ API, không bịa (yêu cầu phase 3 mục 3). testId để test scope đúng
 * đúng ô (trang có nhiều số trùng nhau — vd nhiều KPI cùng hiện "3" — không thể dò bằng text thô). */
function TheKpi({
  nhan,
  giaTri,
  ghiChu,
  dangTai,
  loi,
  testId,
}: {
  nhan: string;
  giaTri: string;
  ghiChu?: string;
  dangTai: boolean;
  loi: boolean;
  testId?: string;
}) {
  return (
    <Paper withBorder p="md" radius={14} data-testid={testId}>
      <Text fz={12.5} fw={600} c="dimmed" mb={10}>
        {nhan}
      </Text>
      {dangTai ? (
        <Skeleton height={26} width="60%" mb={6} />
      ) : loi ? (
        <Text fz={13} c="danger.6">
          Không tải được
        </Text>
      ) : (
        <>
          <Text fz={26} fw={800} mb={6}>
            {giaTri}
          </Text>
          {ghiChu && (
            <Text fz={12} c="dimmed" fw={600}>
              {ghiChu}
            </Text>
          )}
        </>
      )}
    </Paper>
  );
}

function chuCaiDauTen(ten: string): string {
  const phan = ten.trim().split(/\s+/);
  return (phan[phan.length - 1]?.charAt(0) ?? '?').toUpperCase();
}

/** Chấm màu + nhãn + số — chú thích thủ công cho DonutChart (DonutChart của @mantine/charts không có
 * legend dựng sẵn như BarChart). Màu truyền vào dạng "tên.bậc" của theme (vd "primary.5"). */
function ChuThichMau({ mau, nhan, giaTri }: { mau: string; nhan: string; giaTri: number }) {
  return (
    <Group gap={8} wrap="nowrap">
      <Box w={10} h={10} style={{ borderRadius: 3, background: `var(--mantine-color-${mau.replace('.', '-')})`, flexShrink: 0 }} />
      <Text fz={12.5}>{nhan}</Text>
      <Text fz={12.5} fw={700} ml="auto">
        {giaTri}
      </Text>
    </Group>
  );
}

/** Khối 1 đợt khảo sát (đầu vào hoặc đầu ra) — DonutChart phân bố Cơ bản/Thành thạo/Nâng cao. Dùng 1
 * dải màu xanh đậm dần (primary.3 → primary.7) vì đây là 3 MỨC có thứ tự (thấp → cao), không phải 3
 * phạm trù độc lập — đúng khuyến nghị "sequential = 1 màu, nhạt→đậm" cho dữ liệu có thứ hạng. */
function KhoiKhaoSat({ nhan, duLieu, tongThamGia }: { nhan: string; duLieu: KhaoSatMucRow; tongThamGia: number }) {
  const segments = [
    { name: 'Cơ bản', value: duLieu.co_ban, color: 'primary.3' },
    { name: 'Thành thạo', value: duLieu.thanh_thao, color: 'primary.5' },
    { name: 'Nâng cao', value: duLieu.nang_cao, color: 'primary.7' },
  ];
  return (
    <Stack gap={10} align="center">
      <Text fz={13.5} fw={700}>
        {nhan}
      </Text>
      <Text fz={12.5} c="dimmed">
        Đã làm: <b>{duLieu.da_lam}</b>/{tongThamGia} học viên
      </Text>
      {duLieu.da_lam === 0 ? (
        <Text c="dimmed" fz="sm" py="xl">
          Chưa có dữ liệu
        </Text>
      ) : (
        <>
          <DonutChart data={segments} size={160} thickness={26} withLabelsLine={false} chartLabel={String(duLieu.da_lam)} />
          <Stack gap={6} w="100%" maw={220}>
            {segments.map((s) => (
              <ChuThichMau key={s.name} mau={s.color} nhan={s.name} giaTri={s.value} />
            ))}
          </Stack>
        </>
      )}
    </Stack>
  );
}

/** Kết quả học theo hình thức (Trực tiếp/Zoom/VLE) — BarChart nhóm. Màu theo Ý NGHĨA trạng thái, tái
 * dùng đúng token theme đã có: Đạt = success (tốt), Không đạt = danger (nghiêm trọng), Vắng = warning
 * (cảnh báo), Đang học = primary (trung tính/đang diễn ra) — không bịa thêm màu ngoài theme. */
function KhoiKetQuaTheoHinhThuc({ rows }: { rows: KetQuaTheoHinhThucRow[] }) {
  const coDuLieu = rows.some((r) => r.dang_hoc + r.dat + r.khong_dat + r.vang > 0);
  if (!coDuLieu) {
    return (
      <Text c="dimmed" fz="sm" ta="center" py="xl">
        Chưa có dữ liệu
      </Text>
    );
  }
  const data = rows.map((r) => ({
    hinh_thuc: NHAN_LOAI_LOP[r.loai_lop],
    'Đang học': r.dang_hoc,
    Đạt: r.dat,
    'Không đạt': r.khong_dat,
    Vắng: r.vang,
  }));
  return (
    <BarChart
      h={280}
      data={data}
      dataKey="hinh_thuc"
      withLegend
      series={[
        { name: 'Đang học', color: 'primary.5' },
        { name: 'Đạt', color: 'success.6' },
        { name: 'Không đạt', color: 'danger.6' },
        { name: 'Vắng', color: 'warning.6' },
      ]}
    />
  );
}

/** Thanh bộ lọc + số liệu tổng quan mở rộng (thêm 2026-09-30) — khoa/đơn vị/khoảng ngày CHỈ áp dụng
 * cho phần số liệu mới bên dưới (GET /bao-cao/tong-quan), KHÔNG ảnh hưởng 3 KPI/bảng "Hồ sơ chờ duyệt
 * gần nhất" phía trên (giữ nguyên hành vi cũ, tránh phá vỡ phase trước). */
function KhoiTongQuanMoRong() {
  const [khoaId, setKhoaId] = useState('');
  const [donViId, setDonViId] = useState<string | null>(null);
  const [donViNhan, setDonViNhan] = useState<string | null>(null);
  const [tuNgay, setTuNgay] = useState('');
  const [denNgay, setDenNgay] = useState('');

  const khoa = useDanhSachKhoa({ page_size: 100 });
  const tuyChonKhoa = (khoa.data?.data ?? []).map((k) => ({ value: k.id, label: `${k.ma_khoa} — ${k.ten_khoa}` }));

  const params: BaoCaoTongQuanParams = {
    khoa_id: khoaId || undefined,
    don_vi_cong_tac_id: donViId || undefined,
    tu_ngay: tuNgay || undefined,
    den_ngay: denNgay || undefined,
  };
  const tongQuan = useBaoCaoTongQuanTrungTam(params);

  const excel = useMutation({
    mutationFn: async () => taiFileTuBlob(await taiBaoCaoTongQuanExcel(params), 'bao-cao-tong-quan.xlsx'),
    onError: (err) => notifications.show({ color: 'red', message: thongDiepLoiChung(err) }),
  });

  const tongThamGia = tongQuan.data?.tong_hoc_vien_tham_gia ?? 0;

  return (
    <Stack gap="md" data-testid="khoi-tong-quan-mo-rong">
      <Paper withBorder radius={14} p="lg">
        <Group justify="space-between" align="flex-end" wrap="wrap" gap="md">
          <Group align="flex-end" wrap="wrap" gap="md" style={{ flex: 1 }}>
            <Select
              label="Khóa bồi dưỡng"
              placeholder="Tất cả khóa"
              size="xs"
              searchable
              filter={locTiengViet}
              clearable
              w={240}
              data={tuyChonKhoa}
              value={khoaId || null}
              onChange={(v) => setKhoaId(v ?? '')}
              disabled={khoa.isLoading}
            />
            <TextInput type="date" label="Từ ngày" size="xs" value={tuNgay} onChange={(e) => setTuNgay(e.currentTarget.value)} />
            <TextInput type="date" label="Đến ngày" size="xs" value={denNgay} onChange={(e) => setDenNgay(e.currentTarget.value)} />
          </Group>
          <Button
            color="accent"
            size="xs"
            loading={excel.isPending}
            onClick={() => excel.mutate()}
            data-testid="nut-xuat-excel-tong-quan"
          >
            ⇩ Xuất Excel
          </Button>
        </Group>
        <Box maw={420} mt="md">
          <SelectDonVi
            label="Đơn vị công tác"
            onChange={(id, nhan) => {
              setDonViId(id);
              setDonViNhan(nhan);
            }}
          />
          {donViNhan && (
            <Text fz={12} c="dimmed" mt={4}>
              Đang lọc theo: {donViNhan}
            </Text>
          )}
        </Box>
      </Paper>

      {tongQuan.isError && <Alert color="red">{thongDiepLoiChung(tongQuan.error)}</Alert>}

      <SimpleGrid cols={{ base: 1, xs: 2, md: 3 }} spacing="md">
        <TheKpi
          testId="kpi-hoc-vien-tham-gia"
          nhan="Học viên tham gia"
          giaTri={tongThamGia.toLocaleString('vi-VN')}
          ghiChu="Khớp bộ lọc hiện tại"
          dangTai={tongQuan.isLoading}
          loi={tongQuan.isError}
        />
        <TheKpi
          testId="kpi-da-dang-nhap"
          nhan="Đã đăng nhập"
          giaTri={(tongQuan.data?.da_dang_nhap ?? 0).toLocaleString('vi-VN')}
          ghiChu={`${phanTram(tongQuan.data?.da_dang_nhap ?? 0, tongThamGia)} trên tổng tham gia`}
          dangTai={tongQuan.isLoading}
          loi={tongQuan.isError}
        />
        <TheKpi
          testId="kpi-da-chinh-sua-ho-so"
          nhan="Đã chỉnh sửa hồ sơ"
          giaTri={(tongQuan.data?.da_chinh_sua_ho_so ?? 0).toLocaleString('vi-VN')}
          ghiChu={`${phanTram(tongQuan.data?.da_chinh_sua_ho_so ?? 0, tongThamGia)} trên tổng tham gia`}
          dangTai={tongQuan.isLoading}
          loi={tongQuan.isError}
        />
      </SimpleGrid>

      <Paper withBorder radius={14} p="lg">
        <Text fz={14.5} fw={700} mb="md">
          Khảo sát đầu vào / đầu ra
        </Text>
        {tongQuan.isLoading ? (
          <Skeleton height={220} />
        ) : (
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="xl">
            <KhoiKhaoSat nhan="Đầu vào" duLieu={tongQuan.data?.khao_sat.dau_vao ?? { da_lam: 0, co_ban: 0, thanh_thao: 0, nang_cao: 0 }} tongThamGia={tongThamGia} />
            <KhoiKhaoSat nhan="Đầu ra" duLieu={tongQuan.data?.khao_sat.dau_ra ?? { da_lam: 0, co_ban: 0, thanh_thao: 0, nang_cao: 0 }} tongThamGia={tongThamGia} />
          </SimpleGrid>
        )}
      </Paper>

      <Paper withBorder radius={14} p="lg">
        <Text fz={14.5} fw={700} mb="md">
          Kết quả học theo hình thức
        </Text>
        {tongQuan.isLoading ? <Skeleton height={280} /> : <KhoiKetQuaTheoHinhThuc rows={tongQuan.data?.ket_qua_theo_hinh_thuc ?? []} />}
      </Paper>
    </Stack>
  );
}

/** Tổng quan quản trị — 3 KPI thật (Tổng học viên, Hồ sơ chờ duyệt, Đơn vị tham gia) + bảng hồ sơ
 * chờ duyệt gần nhất (không đổi từ phase 3), cộng thêm khối số liệu mở rộng có bộ lọc + biểu đồ (thêm
 * 2026-09-30, xem KhoiTongQuanMoRong). Bỏ KPI "tỉ lệ xác nhận" vì cần chọn đợt cụ thể (dot_id) — chưa
 * có UI chọn đợt trong phase này, thà bỏ bớt còn hơn bịa số (yêu cầu phase 3 mục 3). */
export default function AdminTongQuan() {
  const tongHocVien = useDanhSachHocVien({ page_size: 1 });
  const choDuyet = useDanhSachHocVien({ trang_thai: 'cho_duyet', page_size: SO_DONG_CHO_DUYET });
  const ticketChoXuLy = useDanhSachYeuCauHoTroQuanTri({ trang_thai: 'cho_xu_ly' });
  const tongHopDonVi = useBaoCaoTongHop('don_vi');
  // Danh mục đơn vị (không scope theo quyền) — chỉ dùng để tra tên hiển thị trong bảng chờ duyệt,
  // KHÔNG dùng để tính KPI (KPI "Đơn vị tham gia" dùng bao-cao/tong-hop vì có scope theo quyền caller).
  const donViDanhMuc = useQuery({
    queryKey: ['danh-muc', 'don-vi-cong-tac', 'all'],
    queryFn: () => layDonViCongTac({ page_size: 200 }),
  });

  const donViMap = new Map((donViDanhMuc.data?.data ?? []).map((d) => [d.id, d.ten_don_vi]));

  return (
    <>
      <AdminPageHeader title="Tổng quan hệ thống" />
      <Container size="xl" py="lg" px={{ base: 'md', md: 28 }}>
        <Stack gap="lg">
          <SimpleGrid cols={{ base: 1, xs: 2, md: 3 }} spacing="md">
            <TheKpi
              testId="kpi-tong-hoc-vien"
              nhan="Tổng học viên"
              giaTri={(tongHocVien.data?.total ?? 0).toLocaleString('vi-VN')}
              ghiChu="Trong phạm vi quyền"
              dangTai={tongHocVien.isLoading}
              loi={tongHocVien.isError}
            />
            <TheKpi
              testId="kpi-cho-duyet"
              nhan="Hồ sơ chờ duyệt"
              giaTri={(choDuyet.data?.total ?? 0).toLocaleString('vi-VN')}
              ghiChu="Cần xử lý"
              dangTai={choDuyet.isLoading}
              loi={choDuyet.isError}
            />
            <TheKpi
              testId="kpi-don-vi-tham-gia"
              nhan="Đơn vị tham gia"
              giaTri={(tongHopDonVi.data?.rows.length ?? 0).toLocaleString('vi-VN')}
              ghiChu="Trong phạm vi quyền"
              dangTai={tongHopDonVi.isLoading}
              loi={tongHopDonVi.isError}
            />
          </SimpleGrid>

          <Paper withBorder radius={14} p="lg">
            <Group justify="space-between" mb="md">
              <Text fz={14.5} fw={700}>
                Hồ sơ chờ duyệt gần nhất
              </Text>
              <Text component={Link} to="/admin/hoc-vien?trang_thai=cho_duyet" fz={12.5} fw={600}>
                Xem tất cả →
              </Text>
            </Group>

            {choDuyet.isLoading && (
              <Stack gap="sm">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} height={44} />
                ))}
              </Stack>
            )}

            {choDuyet.isError && <Alert color="red">{thongDiepLoiChung(choDuyet.error)}</Alert>}

            {choDuyet.data && choDuyet.data.data.length === 0 && (
              <Text c="dimmed" fz="sm">
                Không có hồ sơ nào đang chờ duyệt.
              </Text>
            )}

            {choDuyet.data && choDuyet.data.data.length > 0 && (
              <Stack gap={0}>
                {choDuyet.data.data.map((hv) => (
                  <Group
                    key={hv.id}
                    justify="space-between"
                    py={12}
                    style={{ borderBottom: '1px solid #F1F3F6' }}
                  >
                    <Group gap={12}>
                      <Box
                        w={32}
                        h={32}
                        style={{
                          borderRadius: '50%',
                          background: '#EAF0F7',
                          color: '#124874',
                          fontWeight: 700,
                          fontSize: 12,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        {chuCaiDauTen(hv.ho_ten ?? '?')}
                      </Box>
                      <Box>
                        <Text fz={13.5} fw={600}>
                          {hv.ho_ten ?? '(Chưa có tên)'}
                        </Text>
                        <Text fz={12} c="dimmed">
                          {hv.don_vi_cong_tac_id ? (donViMap.get(hv.don_vi_cong_tac_id) ?? '—') : '—'}
                        </Text>
                      </Box>
                    </Group>
                    <Group gap={16}>
                      <TrangThaiBadge trangThai={hv.trang_thai} />
                      <Button component={Link} to={`/admin/hoc-vien/${hv.id}`} variant="default" size="xs">
                        Xem hồ sơ
                      </Button>
                    </Group>
                  </Group>
                ))}
              </Stack>
            )}
          </Paper>

          <Paper withBorder radius={14} p="md">
            <Group justify="space-between">
              <Text fz={14.5} fw={700}>
                Yêu cầu hỗ trợ chờ xử lý
              </Text>
              <Text component={Link} to="/admin/yeu-cau-ho-tro" fz={12.5} fw={600}>
                Xem danh sách →
              </Text>
            </Group>
            {ticketChoXuLy.isLoading ? (
              <Skeleton height={26} width={60} mt={6} />
            ) : (
              <Text fz={26} fw={800} mt={6}>
                {(ticketChoXuLy.data?.total ?? 0).toLocaleString('vi-VN')}
              </Text>
            )}
          </Paper>

          <KhoiTongQuanMoRong />
        </Stack>
      </Container>
    </>
  );
}
