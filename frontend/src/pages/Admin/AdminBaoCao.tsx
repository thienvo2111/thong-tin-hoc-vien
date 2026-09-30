import { useState, type ReactNode } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Button,
  Container,
  Group,
  Modal,
  Paper,
  Select,
  SimpleGrid,
  Skeleton,
  Stack,
  Table,
  Text,
  TextInput,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  taiBaoCaoDieuKienDanhGiaExcel,
  taiBaoCaoSuaTruongMoetExcel,
  taiBaoCaoTongHopExcel,
  taiBaoCaoVanHanhExcel,
  taiBaoCaoXacNhanExcel,
  taiBaoCaoXuatChoVleExcel,
  useBaoCaoDieuKienDanhGia,
  useBaoCaoSuaTruongMoet,
  useBaoCaoTongHopTrungTam,
  useBaoCaoVanHanh,
  useBaoCaoXacNhan,
  useDanhSachDotXacNhan,
} from '@/api/baoCao';
import { useDanhSachKhoa } from '@/api/khoaBoiDuong';
import type { BaoCaoRow, BaoCaoTheo } from '@/api/types';
import { thongDiepLoiChung } from '@/lib/loiApi';
import { taiFileTuBlob } from '@/lib/taiFile';
import { AdminPageHeader } from './AdminPageHeader';

const TUY_CHON_THEO: { value: BaoCaoTheo; label: string }[] = [
  { value: 'don_vi', label: 'Đơn vị' },
  { value: 'dia_ban', label: 'Địa bàn' },
  { value: 'khoa', label: 'Khóa bồi dưỡng' },
];

const TUY_CHON_TRANG_THAI_XAC_NHAN = [
  { value: '', label: 'Tất cả trạng thái' },
  { value: 'chua_dang_nhap', label: 'Chưa đăng nhập' },
  { value: 'dang_bo_sung', label: 'Đang bổ sung' },
  { value: 'da_xac_nhan', label: 'Đã xác nhận' },
];

function dinhDangO(v: unknown): string {
  if (v === null || v === undefined || v === '') return '—';
  if (typeof v === 'boolean') return v ? 'Có' : 'Không';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

/** Bảng kết quả chung cho mọi báo cáo — cột dựng động từ đúng key thật của hàng dữ liệu trả về (không
 * bịa thêm cột), vì phần lớn báo cáo trong docs/api-contract.md mục 7 không công bố shape hàng cụ thể
 * (chỉ tong-hop có TongHopDonViRow). Ưu tiên đúng dữ liệu hơn trình bày đẹp (yêu cầu phase 5 mục 1). */
function BangKetQuaBaoCao({ rows }: { rows: BaoCaoRow[] }) {
  if (rows.length === 0) {
    return (
      <Text c="dimmed" ta="center" py="lg">
        Không có dữ liệu khớp bộ lọc.
      </Text>
    );
  }
  const cot = Object.keys(rows[0]);
  return (
    <Table.ScrollContainer minWidth={Math.max(480, cot.length * 140)}>
      <Table striped highlightOnHover verticalSpacing="xs" fz="sm">
        <Table.Thead>
          <Table.Tr>
            {cot.map((c) => (
              <Table.Th key={c}>{c}</Table.Th>
            ))}
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {rows.map((r, i) => (
            <Table.Tr key={i}>
              {cot.map((c) => (
                <Table.Td key={c}>{dinhDangO(r[c])}</Table.Td>
              ))}
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Table.ScrollContainer>
  );
}

function KhungTheBaoCao({
  testId,
  icon,
  iconBg,
  title,
  desc,
  children,
}: {
  testId: string;
  icon: string;
  iconBg: string;
  title: string;
  desc: string;
  children: ReactNode;
}) {
  return (
    <Paper withBorder radius={14} p="lg" data-testid={testId}>
      <Stack gap={10} h="100%">
        <Box
          w={40}
          h={40}
          style={{ borderRadius: 10, background: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}
        >
          {icon}
        </Box>
        <Text fz={14.5} fw={700}>
          {title}
        </Text>
        <Text fz={12.5} c="dimmed" style={{ flexGrow: 1 }}>
          {desc}
        </Text>
        {children}
      </Stack>
    </Paper>
  );
}

function useTaiExcel() {
  return useMutation({
    mutationFn: async ({ taiFn, tenFile }: { taiFn: () => Promise<Blob>; tenFile: string }) => {
      taiFileTuBlob(await taiFn(), tenFile);
    },
    onError: (err) => notifications.show({ color: 'red', message: thongDiepLoiChung(err) }),
  });
}

function NoiDungXem({
  isLoading,
  isError,
  error,
  rows,
}: {
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  rows: BaoCaoRow[] | undefined;
}) {
  if (isLoading) return <Skeleton height={160} />;
  if (isError)
    return (
      <Alert color="red" mt="sm">
        {thongDiepLoiChung(error)}
      </Alert>
    );
  return <BangKetQuaBaoCao rows={rows ?? []} />;
}

// --- 1. Báo cáo tổng hợp ---
function TheBaoCaoTongHop() {
  const [theo, setTheo] = useState<BaoCaoTheo>('don_vi');
  const [tuNgay, setTuNgay] = useState('');
  const [denNgay, setDenNgay] = useState('');
  const [modalMo, setModalMo] = useState(false);
  const params = { theo, tu_ngay: tuNgay || undefined, den_ngay: denNgay || undefined };
  const ketQua = useBaoCaoTongHopTrungTam(params, modalMo);
  const excel = useTaiExcel();

  return (
    <KhungTheBaoCao testId="the-bao-cao-tong-hop" icon="📋" iconBg="#EAF0F7" title="Báo cáo tổng hợp" desc="Tổng hợp số liệu học viên, hồ sơ theo đơn vị, địa bàn hoặc khóa bồi dưỡng.">
      <Select
        label="Thống kê theo"
        size="xs"
        data={TUY_CHON_THEO}
        value={theo}
        onChange={(v) => setTheo((v as BaoCaoTheo) ?? 'don_vi')}
        allowDeselect={false}
      />
      <Group grow gap={6}>
        <TextInput type="date" label="Từ ngày" size="xs" value={tuNgay} onChange={(e) => setTuNgay(e.currentTarget.value)} />
        <TextInput type="date" label="Đến ngày" size="xs" value={denNgay} onChange={(e) => setDenNgay(e.currentTarget.value)} />
      </Group>
      <Group gap={8} mt={4}>
        <Button variant="default" size="xs" style={{ flex: 1 }} onClick={() => setModalMo(true)}>
          Xem
        </Button>
        <Button
          color="accent"
          size="xs"
          style={{ flex: 1 }}
          loading={excel.isPending}
          onClick={() => excel.mutate({ taiFn: () => taiBaoCaoTongHopExcel(params), tenFile: `bao-cao-tong-hop-${theo}.xlsx` })}
        >
          ⇩ Xuất Excel
        </Button>
      </Group>
      <Modal opened={modalMo} onClose={() => setModalMo(false)} title="Báo cáo tổng hợp" size="xl">
        <NoiDungXem isLoading={ketQua.isLoading} isError={ketQua.isError} error={ketQua.error} rows={ketQua.data?.rows} />
      </Modal>
    </KhungTheBaoCao>
  );
}

// --- 2. Báo cáo xác nhận — dot_id bắt buộc ---
function TheBaoCaoXacNhan() {
  const [dotId, setDotId] = useState('');
  const [trangThai, setTrangThai] = useState('');
  const [modalMo, setModalMo] = useState(false);
  const dot = useDanhSachDotXacNhan();
  const params = dotId ? { dot_id: dotId, trang_thai: trangThai || undefined } : undefined;
  const ketQua = useBaoCaoXacNhan(params, modalMo);
  const excel = useTaiExcel();

  const tuyChonDot = (dot.data ?? []).map((d) => ({ value: d.id, label: d.ten }));

  return (
    <KhungTheBaoCao testId="the-bao-cao-xac-nhan" icon="✅" iconBg="#EAF6F0" title="Báo cáo xác nhận" desc="Danh sách học viên đã/chưa xác nhận thông tin theo từng đợt.">
      <Select
        label="Đợt xác nhận"
        placeholder="Chọn đợt"
        required
        size="xs"
        data={tuyChonDot}
        value={dotId || null}
        onChange={(v) => setDotId(v ?? '')}
        disabled={dot.isLoading}
      />
      <Select
        label="Trạng thái"
        size="xs"
        data={TUY_CHON_TRANG_THAI_XAC_NHAN}
        value={trangThai}
        onChange={(v) => setTrangThai(v ?? '')}
        allowDeselect={false}
      />
      <Group gap={8} mt={4}>
        <Button variant="default" size="xs" style={{ flex: 1 }} disabled={!dotId} onClick={() => setModalMo(true)}>
          Xem
        </Button>
        <Button
          color="accent"
          size="xs"
          style={{ flex: 1 }}
          disabled={!dotId}
          loading={excel.isPending}
          onClick={() => params && excel.mutate({ taiFn: () => taiBaoCaoXacNhanExcel(params), tenFile: `bao-cao-xac-nhan-${dotId}.xlsx` })}
        >
          ⇩ Xuất Excel
        </Button>
      </Group>
      <Modal opened={modalMo} onClose={() => setModalMo(false)} title="Báo cáo xác nhận" size="xl">
        <NoiDungXem isLoading={ketQua.isLoading} isError={ketQua.isError} error={ketQua.error} rows={ketQua.data?.rows} />
      </Modal>
    </KhungTheBaoCao>
  );
}

// --- 3 + 5 + 6 dùng chung control "chọn khóa bồi dưỡng" ---
function useTuyChonKhoa() {
  const khoa = useDanhSachKhoa({ page_size: 100 });
  return { dangTai: khoa.isLoading, tuyChon: (khoa.data?.data ?? []).map((k) => ({ value: k.id, label: `${k.ma_khoa} — ${k.ten_khoa}` })) };
}

// --- 3. Sửa trường MOET — khoa_id bắt buộc ---
function TheBaoCaoSuaTruongMoet() {
  const [khoaId, setKhoaId] = useState('');
  const [modalMo, setModalMo] = useState(false);
  const { dangTai, tuyChon } = useTuyChonKhoa();
  const params = khoaId ? { khoa_id: khoaId } : undefined;
  const ketQua = useBaoCaoSuaTruongMoet(params, modalMo);
  const excel = useTaiExcel();

  return (
    <KhungTheBaoCao testId="the-bao-cao-sua-truong-moet" icon="✏️" iconBg="#FEF3E6" title="Sửa trường MOET" desc="Các trường hợp cần hiệu chỉnh mã định danh MOET trước khi đồng bộ.">
      <Select
        label="Khóa bồi dưỡng"
        placeholder="Chọn khóa"
        required
        size="xs"
        searchable
        data={tuyChon}
        value={khoaId || null}
        onChange={(v) => setKhoaId(v ?? '')}
        disabled={dangTai}
      />
      <Group gap={8} mt={4}>
        <Button variant="default" size="xs" style={{ flex: 1 }} disabled={!khoaId} onClick={() => setModalMo(true)}>
          Xem
        </Button>
        <Button
          color="accent"
          size="xs"
          style={{ flex: 1 }}
          disabled={!khoaId}
          loading={excel.isPending}
          onClick={() =>
            params && excel.mutate({ taiFn: () => taiBaoCaoSuaTruongMoetExcel(params), tenFile: `bao-cao-sua-truong-moet-${khoaId}.xlsx` })
          }
        >
          ⇩ Xuất Excel
        </Button>
      </Group>
      <Modal opened={modalMo} onClose={() => setModalMo(false)} title="Sửa trường MOET" size="xl">
        <NoiDungXem isLoading={ketQua.isLoading} isError={ketQua.isError} error={ketQua.error} rows={ketQua.data?.rows} />
      </Modal>
    </KhungTheBaoCao>
  );
}

// --- 4. Xuất cho VLE — khoa_id bắt buộc, chỉ có Excel (không có endpoint JSON để xem trước) ---
function TheBaoCaoXuatChoVle() {
  const [khoaId, setKhoaId] = useState('');
  const { dangTai, tuyChon } = useTuyChonKhoa();
  const excel = useTaiExcel();

  return (
    <KhungTheBaoCao
      testId="the-bao-cao-xuat-cho-vle"
      icon="📤"
      iconBg="#F3ECFB"
      title="Xuất cho VLE"
      desc="Danh sách tài khoản và kết quả đợt 1 để chuyển Phòng CNTT tạo tài khoản VLE. Chỉ xuất Excel trực tiếp, không có màn xem trước."
    >
      <Select
        label="Khóa bồi dưỡng"
        placeholder="Chọn khóa"
        required
        size="xs"
        searchable
        data={tuyChon}
        value={khoaId || null}
        onChange={(v) => setKhoaId(v ?? '')}
        disabled={dangTai}
      />
      <Button
        color="accent"
        size="xs"
        mt={4}
        disabled={!khoaId}
        loading={excel.isPending}
        onClick={() => excel.mutate({ taiFn: () => taiBaoCaoXuatChoVleExcel({ khoa_id: khoaId }), tenFile: `bao-cao-xuat-cho-vle-${khoaId}.xlsx` })}
      >
        ⇩ Xuất Excel
      </Button>
    </KhungTheBaoCao>
  );
}

// --- 5. Điều kiện đánh giá đầu vào — khoa_id bắt buộc ---
function TheBaoCaoDieuKienDanhGia() {
  const [khoaId, setKhoaId] = useState('');
  const [modalMo, setModalMo] = useState(false);
  const { dangTai, tuyChon } = useTuyChonKhoa();
  const params = khoaId ? { khoa_id: khoaId } : undefined;
  const ketQua = useBaoCaoDieuKienDanhGia(params, modalMo);
  const excel = useTaiExcel();

  return (
    <KhungTheBaoCao
      testId="the-bao-cao-dieu-kien-danh-gia"
      icon="🎯"
      iconBg="#FDEEEC"
      title="Điều kiện đánh giá đầu vào"
      desc="Học viên đủ/thiếu điều kiện tham gia đánh giá đầu vào."
    >
      <Select
        label="Khóa bồi dưỡng"
        placeholder="Chọn khóa"
        required
        size="xs"
        searchable
        data={tuyChon}
        value={khoaId || null}
        onChange={(v) => setKhoaId(v ?? '')}
        disabled={dangTai}
      />
      <Group gap={8} mt={4}>
        <Button variant="default" size="xs" style={{ flex: 1 }} disabled={!khoaId} onClick={() => setModalMo(true)}>
          Xem
        </Button>
        <Button
          color="accent"
          size="xs"
          style={{ flex: 1 }}
          disabled={!khoaId}
          loading={excel.isPending}
          onClick={() =>
            params &&
            excel.mutate({ taiFn: () => taiBaoCaoDieuKienDanhGiaExcel(params), tenFile: `bao-cao-dieu-kien-danh-gia-${khoaId}.xlsx` })
          }
        >
          ⇩ Xuất Excel
        </Button>
      </Group>
      <Modal opened={modalMo} onClose={() => setModalMo(false)} title="Điều kiện đánh giá đầu vào" size="xl">
        <NoiDungXem isLoading={ketQua.isLoading} isError={ketQua.isError} error={ketQua.error} rows={ketQua.data?.rows} />
      </Modal>
    </KhungTheBaoCao>
  );
}

// --- 6. Vận hành theo lớp — khoa_id tùy chọn ---
function TheBaoCaoVanHanh() {
  const [khoaId, setKhoaId] = useState('');
  const [modalMo, setModalMo] = useState(false);
  const { dangTai, tuyChon } = useTuyChonKhoa();
  const params = { khoa_id: khoaId || undefined };
  const ketQua = useBaoCaoVanHanh(params, modalMo);
  const excel = useTaiExcel();

  return (
    <KhungTheBaoCao
      testId="the-bao-cao-van-hanh"
      icon="🏫"
      iconBg="#EAF0F7"
      title="Vận hành theo lớp"
      desc="Sĩ số, hồ sơ đầy đủ và mức đầu vào theo từng lớp học. Bỏ trống khóa để xem mọi khóa trong phạm vi quyền."
    >
      <Select
        label="Khóa bồi dưỡng"
        placeholder="Tất cả khóa"
        size="xs"
        searchable
        clearable
        data={tuyChon}
        value={khoaId || null}
        onChange={(v) => setKhoaId(v ?? '')}
        disabled={dangTai}
      />
      <Group gap={8} mt={4}>
        <Button variant="default" size="xs" style={{ flex: 1 }} onClick={() => setModalMo(true)}>
          Xem
        </Button>
        <Button
          color="accent"
          size="xs"
          style={{ flex: 1 }}
          loading={excel.isPending}
          onClick={() =>
            excel.mutate({ taiFn: () => taiBaoCaoVanHanhExcel(params), tenFile: `bao-cao-van-hanh${khoaId ? `-${khoaId}` : ''}.xlsx` })
          }
        >
          ⇩ Xuất Excel
        </Button>
      </Group>
      <Modal opened={modalMo} onClose={() => setModalMo(false)} title="Vận hành theo lớp" size="xl">
        <NoiDungXem isLoading={ketQua.isLoading} isError={ketQua.isError} error={ketQua.error} rows={ketQua.data?.rows} />
      </Modal>
    </KhungTheBaoCao>
  );
}

/** Trung tâm báo cáo (Phase 5 redesign) — 6 thẻ, mỗi thẻ khớp đúng 1 nhóm báo cáo thật đang có API
 * (docs/api-contract.md mục 7 + mục "Đợt xác nhận" mục 2): tổng hợp, xác nhận, sửa trường MOET, xuất
 * cho VLE, điều kiện đánh giá đầu vào, vận hành theo lớp. Không bịa thêm báo cáo không có endpoint. */
export default function AdminBaoCao() {
  return (
    <>
      <AdminPageHeader title="Trung tâm báo cáo" />
      <Container size="xl" py="lg" px={{ base: 'md', md: 28 }}>
        <Stack gap="md">
          <Text fz={13.5} c="dimmed" maw={760}>
            Chọn loại báo cáo để xem trực tuyến hoặc xuất Excel. Một số báo cáo cần chọn khóa bồi dưỡng/đợt xác nhận trước khi xem hoặc xuất.
          </Text>
          <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
            <TheBaoCaoTongHop />
            <TheBaoCaoXacNhan />
            <TheBaoCaoSuaTruongMoet />
            <TheBaoCaoXuatChoVle />
            <TheBaoCaoDieuKienDanhGia />
            <TheBaoCaoVanHanh />
          </SimpleGrid>
        </Stack>
      </Container>
    </>
  );
}
