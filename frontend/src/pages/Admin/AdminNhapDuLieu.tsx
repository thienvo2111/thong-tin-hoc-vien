import { useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import {
  Alert,
  Badge,
  Box,
  Button,
  Container,
  FileInput,
  Group,
  Paper,
  Select,
  Skeleton,
  Stack,
  Table,
  Text,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { taiFileLoiImport, taiMauExcel, useLichSuImport, useTaiLenImport } from '@/api/nhapDuLieu';
import { useDanhSachKhoa } from '@/api/khoaBoiDuong';
import type { LoaiDanhMucImport } from '@/api/types';
import { thongDiepLoiChung } from '@/lib/loiApi';
import { taiFileTuBlob } from '@/lib/taiFile';
import { dinhDangNgayGio } from '@/lib/ngay';
import { mauTrangThaiImport, nhanTrangThaiImport } from '@/lib/trangThaiImport';
import { PanelXemTruocImport } from '@/components/PanelXemTruocImport';
import { AdminPageHeader } from './AdminPageHeader';

// 11 loại import THẬT hỗ trợ qua loai_danh_muc_import (docs/api-contract.md mục 5) — không bịa
// thêm/bớt. Dùng Record<LoaiDanhMucImport, string> (thay vì mảng dò tìm) để TypeScript báo lỗi biên
// dịch nếu sau này enum LoaiDanhMucImport (src/api/types.ts) có thêm giá trị mà quên bổ sung nhãn ở
// đây — tránh tái diễn lỗi cột "Loại dữ liệu" bị bỏ trống do thiếu nhãn.
export const NHAN_LOAI_IMPORT: Record<LoaiDanhMucImport, string> = {
  ho_so_nhan_su_moet: 'Hồ sơ nhân sự (CSDL MOET)',
  phan_lop_hoc_vien: 'Phân lớp học viên (MOET)',
  lop_va_lich_hoc: 'Lớp và lịch học',
  ket_qua_danh_gia: 'Kết quả đánh giá (đầu vào/đầu ra)',
  tai_khoan_vle: 'Tài khoản VLE',
  don_vi_cong_tac: 'Danh mục đơn vị công tác',
  dia_danh: 'Danh mục địa danh',
  mon_hoc: 'Danh mục môn học',
  diem_danh: 'Điểm danh',
  ket_qua_giai_doan: 'Kết quả giai đoạn',
  nhan_su_lop: 'Nhân sự lớp (giảng viên/hỗ trợ)',
  tai_khoan_don_vi: 'Tài khoản đơn vị',
};

const TUY_CHON_LOAI_IMPORT: { value: LoaiDanhMucImport; label: string }[] = Object.entries(NHAN_LOAI_IMPORT).map(
  ([value, label]) => ({ value: value as LoaiDanhMucImport, label }),
);

// Fallback an toàn: giá trị enum chưa kịp cập nhật nhãn (vd. backend triển khai enum mới trước FE) hiện
// nguyên giá trị thô thay vì để trống ô — không bao giờ trả về chuỗi rỗng một cách âm thầm.
export function nhanLoaiImport(loai: string): string {
  return NHAN_LOAI_IMPORT[loai as LoaiDanhMucImport] ?? loai;
}

function BadgeTrangThaiImport({ trangThai, soDongLoi }: { trangThai: string; soDongLoi: number }) {
  const { bg, mau } = mauTrangThaiImport({ trang_thai: trangThai, so_dong_loi: soDongLoi });
  return (
    <Badge radius="xl" styles={{ root: { backgroundColor: bg, color: mau } }}>
      {nhanTrangThaiImport({ trang_thai: trangThai, so_dong_loi: soDongLoi })}
    </Badge>
  );
}

/** Nhập dữ liệu (Phase 5 redesign) — luồng 2 bước thật (docs/api-contract.md mục 5): tải file lên +
 * kiểm tra (POST /import/{loai}) rồi mới xác nhận nạp chính thức (POST /import/{id}/xac-nhan). */
export default function AdminNhapDuLieu() {
  // ?loai=... (vd. nút "Nhập từ Excel" ở trang Người dùng) chọn sẵn loại import.
  const [searchParams] = useSearchParams();
  const loaiTuUrl = searchParams.get('loai');
  const [loai, setLoai] = useState<LoaiDanhMucImport>(
    loaiTuUrl && loaiTuUrl in NHAN_LOAI_IMPORT ? (loaiTuUrl as LoaiDanhMucImport) : 'ho_so_nhan_su_moet',
  );
  const [file, setFile] = useState<File | null>(null);
  const [importId, setImportId] = useState<string | undefined>();
  // Loại của LƯỢT import đang xem/xác nhận (khác `loai` đang chọn khi mở lại job cũ từ Lịch sử).
  const [loaiDangXacNhan, setLoaiDangXacNhan] = useState<LoaiDanhMucImport | undefined>();
  // Phân lớp theo giai đoạn (spec 2026-10-02 mục 5.5): mẫu + file phân lớp sinh theo giai đoạn của
  // 1 khóa -> bắt buộc chọn khóa trước khi tải mẫu/tải lên.
  const [maKhoa, setMaKhoa] = useState<string | null>(null);
  const canKhoa = loai === 'phan_lop_hoc_vien';
  const thieuKhoa = canKhoa && !maKhoa;
  const danhSachKhoa = useDanhSachKhoa({ page_size: 100 });
  const panelRef = useRef<HTMLDivElement>(null);

  const upload = useTaiLenImport();
  const lichSu = useLichSuImport();
  const taiMau = useMutation({
    mutationFn: () => taiMauExcel(loai, canKhoa ? (maKhoa ?? undefined) : undefined),
    onSuccess: (blob) => taiFileTuBlob(blob, `mau-${loai}.xlsx`),
    onError: (err) => notifications.show({ color: 'red', message: thongDiepLoiChung(err) }),
  });
  const taiFileLoiTuLichSu = useMutation({
    mutationFn: (id: string) => taiFileLoiImport(id),
    onSuccess: (blob, id) => taiFileTuBlob(blob, `loi-import-${id}.xlsx`),
    onError: (err) => notifications.show({ color: 'red', message: thongDiepLoiChung(err) }),
  });

  function xuLyTaiLen() {
    if (!file) return;
    upload.mutate(
      { loai, file, maKhoa: canKhoa ? (maKhoa ?? undefined) : undefined },
      {
        onSuccess: (res) => {
          setImportId(res.import_id);
          setLoaiDangXacNhan(loai);
          notifications.show({ color: 'blue', message: 'Đã tải file lên, đang kiểm tra dữ liệu...' });
        },
        onError: (err) => notifications.show({ color: 'red', message: thongDiepLoiChung(err) }),
      },
    );
  }

  function dongXongViec() {
    setImportId(undefined);
    setFile(null);
    lichSu.refetch();
  }

  // Mở lại panel xác nhận cho 1 job đã validate xong (trang_thai='dang_xu_ly' + so_dong_thanh_cong>0)
  // từ bảng lịch sử — dùng thẳng id job cũ, không cần upload lại file (dữ liệu preview đã có sẵn ở
  // GET /import/{id}, xem PanelXemTruoc).
  function moLaiXacNhan(id: string, loaiJob: LoaiDanhMucImport) {
    setImportId(id);
    setLoaiDangXacNhan(loaiJob);
    requestAnimationFrame(() => panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }

  return (
    <>
      <AdminPageHeader title="Nhập dữ liệu" />
      <Container size="xl" py="lg" px={{ base: 'md', md: 28 }}>
        <Group align="flex-start" gap="lg" wrap="wrap">
          <Paper withBorder radius={14} p="lg" w={360} style={{ flexShrink: 0 }}>
            <Stack gap="md">
              <Text fz={14.5} fw={700}>
                Tải file lên hệ thống
              </Text>
              <Select
                label="Loại dữ liệu"
                data={TUY_CHON_LOAI_IMPORT}
                value={loai}
                onChange={(v) => setLoai((v as LoaiDanhMucImport) ?? loai)}
                allowDeselect={false}
              />
              {canKhoa && (
                <Select
                  label="Khóa bồi dưỡng"
                  placeholder="Chọn khóa"
                  required
                  searchable
                  data={(danhSachKhoa.data?.data ?? []).map((k) => ({ value: k.ma_khoa, label: `${k.ma_khoa} – ${k.ten_khoa}` }))}
                  value={maKhoa}
                  onChange={setMaKhoa}
                />
              )}
              <FileInput label="File Excel" placeholder="Chọn file .xlsx" accept=".xlsx" value={file} onChange={setFile} clearable />
              <Button
                variant="subtle"
                size="compact-sm"
                loading={taiMau.isPending}
                disabled={thieuKhoa}
                onClick={() => taiMau.mutate()}
                style={{ alignSelf: 'flex-start' }}
              >
                ⇩ Tải file mẫu Excel
              </Button>
              <Button color="danger" loading={upload.isPending} disabled={!file || thieuKhoa} onClick={xuLyTaiLen} fullWidth>
                Tải lên &amp; kiểm tra
              </Button>
            </Stack>
          </Paper>

          <Box style={{ flexGrow: 1, minWidth: 340 }}>
            <Text fz={14.5} fw={700} mb={14}>
              Lịch sử nhập dữ liệu
            </Text>
            <Paper withBorder radius={14} style={{ overflow: 'hidden' }}>
              {lichSu.isLoading && (
                <Stack p="md" gap="sm">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} height={32} />
                  ))}
                </Stack>
              )}
              {lichSu.isError && (
                <Alert color="red" m="md">
                  {thongDiepLoiChung(lichSu.error)}
                </Alert>
              )}
              {lichSu.data && (
                <Table.ScrollContainer minWidth={620}>
                  <Table highlightOnHover verticalSpacing="sm" horizontalSpacing="md">
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>Loại dữ liệu</Table.Th>
                        <Table.Th>Tổng dòng</Table.Th>
                        <Table.Th>Thành công</Table.Th>
                        <Table.Th>Lỗi</Table.Th>
                        <Table.Th>Thời gian</Table.Th>
                        <Table.Th>Kết quả</Table.Th>
                        <Table.Th />
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {lichSu.data.data.length === 0 && (
                        <Table.Tr>
                          <Table.Td colSpan={7}>
                            <Text c="dimmed" ta="center" py="lg">
                              Chưa có lần nhập dữ liệu nào.
                            </Text>
                          </Table.Td>
                        </Table.Tr>
                      )}
                      {lichSu.data.data.map((i) => (
                        <Table.Tr key={i.id}>
                          <Table.Td fw={600}>{nhanLoaiImport(i.loai_danh_muc)}</Table.Td>
                          <Table.Td>{i.tong_so_dong}</Table.Td>
                          <Table.Td>{i.so_dong_thanh_cong}</Table.Td>
                          <Table.Td>{i.so_dong_loi}</Table.Td>
                          <Table.Td style={{ whiteSpace: 'nowrap' }}>{dinhDangNgayGio(i.thoi_gian_import)}</Table.Td>
                          <Table.Td>
                            <BadgeTrangThaiImport trangThai={i.trang_thai} soDongLoi={i.so_dong_loi} />
                          </Table.Td>
                          <Table.Td ta="right">
                            <Group gap={12} justify="flex-end" wrap="nowrap">
                              {i.trang_thai === 'dang_xu_ly' && i.so_dong_thanh_cong > 0 && (
                                <Text
                                  component="button"
                                  fz={12.5}
                                  fw={700}
                                  c="danger.6"
                                  style={{ background: 'none', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap' }}
                                  onClick={() => moLaiXacNhan(i.id, i.loai_danh_muc)}
                                >
                                  Xác nhận →
                                </Text>
                              )}
                              {i.so_dong_loi > 0 && (
                                <Text
                                  component="button"
                                  fz={12.5}
                                  fw={700}
                                  c="accent.6"
                                  style={{ background: 'none', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap' }}
                                  onClick={() => taiFileLoiTuLichSu.mutate(i.id)}
                                >
                                  Xem file lỗi →
                                </Text>
                              )}
                            </Group>
                          </Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                </Table.ScrollContainer>
              )}
            </Paper>
          </Box>
        </Group>

        {importId && (
          <div ref={panelRef}>
            <PanelXemTruocImport importId={importId} loai={loaiDangXacNhan} onXongViec={dongXongViec} />
          </div>
        )}
      </Container>
    </>
  );
}
