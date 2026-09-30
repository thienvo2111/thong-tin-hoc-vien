import { useRef, useState } from 'react';
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
import {
  taiFileLoiImport,
  taiMauExcel,
  useImportChiTiet,
  useLichSuImport,
  useTaiLenImport,
  useXacNhanImport,
} from '@/api/nhapDuLieu';
import type { LoaiDanhMucImport } from '@/api/types';
import { thongDiepLoiChung } from '@/lib/loiApi';
import { taiFileTuBlob } from '@/lib/taiFile';
import { dinhDangNgayGio } from '@/lib/ngay';
import { mauTrangThaiImport, nhanTrangThaiImport } from '@/lib/trangThaiImport';
import { AdminPageHeader } from './AdminPageHeader';

// 8 loại import THẬT hỗ trợ qua loai_danh_muc_import (docs/api-contract.md mục 5) — không bịa thêm/bớt.
// Dùng Record<LoaiDanhMucImport, string> (thay vì mảng dò tìm) để TypeScript báo lỗi biên dịch nếu
// sau này enum LoaiDanhMucImport (src/api/types.ts) có thêm giá trị mà quên bổ sung nhãn ở đây —
// tránh tái diễn lỗi cột "Loại dữ liệu" bị bỏ trống do thiếu nhãn.
export const NHAN_LOAI_IMPORT: Record<LoaiDanhMucImport, string> = {
  ho_so_nhan_su_moet: 'Hồ sơ nhân sự (CSDL MOET)',
  phan_lop_hoc_vien: 'Phân lớp học viên (MOET)',
  lop_va_lich_hoc: 'Lớp và lịch học',
  ket_qua_danh_gia: 'Kết quả đánh giá (đầu vào/đầu ra)',
  tai_khoan_vle: 'Tài khoản VLE',
  don_vi_cong_tac: 'Danh mục đơn vị công tác',
  dia_danh: 'Danh mục địa danh',
  mon_hoc: 'Danh mục môn học',
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

function BangDong({ mau, danhSach }: { mau: 'loi' | 'canh_bao'; danhSach: { dong: number; ly_do: string }[] }) {
  if (danhSach.length === 0) return null;
  return (
    <Box>
      <Text fz={12.5} fw={700} c={mau === 'loi' ? 'danger.6' : 'yellow.8'} mb={6}>
        {mau === 'loi' ? `${danhSach.length} dòng lỗi` : `${danhSach.length} dòng cảnh báo`}
      </Text>
      <Table.ScrollContainer minWidth={360} mah={220} style={{ overflowY: 'auto' }}>
        <Table verticalSpacing={4} fz="xs">
          <Table.Thead>
            <Table.Tr>
              <Table.Th w={70}>Dòng</Table.Th>
              <Table.Th>Lý do</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {danhSach.map((d, i) => (
              <Table.Tr key={i}>
                <Table.Td>{d.dong}</Table.Td>
                <Table.Td>{d.ly_do}</Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>
    </Box>
  );
}

/** Panel xem trước kết quả 1 lần import (GET /import/{id}, poll khi còn dang_xu_ly) + nút xác nhận
 * nạp chính thức (POST /import/{id}/xac-nhan) — bước 2 của luồng 2 bước thật, KHÔNG gộp thành 1 bước. */
function PanelXemTruoc({ importId, onXongViec }: { importId: string; onXongViec: () => void }) {
  const ketQua = useImportChiTiet(importId);
  const xacNhan = useXacNhanImport();
  const taiFileLoi = useMutation({
    mutationFn: () => taiFileLoiImport(importId),
    onSuccess: (blob) => taiFileTuBlob(blob, `loi-import-${importId}.xlsx`),
    onError: (err) => notifications.show({ color: 'red', message: thongDiepLoiChung(err) }),
  });

  function xuLyXacNhan() {
    xacNhan.mutate(importId, {
      onSuccess: () => {
        notifications.show({ color: 'green', message: 'Đã nạp dữ liệu chính thức vào hệ thống.' });
        onXongViec();
      },
      onError: (err) => notifications.show({ color: 'red', message: thongDiepLoiChung(err) }),
    });
  }

  return (
    <Paper withBorder radius={14} p="lg" mt="lg">
      <Group justify="space-between" mb="md">
        <Text fz={14.5} fw={700}>
          Kết quả kiểm tra
        </Text>
        <Button variant="subtle" size="xs" color="gray" onClick={onXongViec}>
          Đóng
        </Button>
      </Group>

      {ketQua.isLoading && <Skeleton height={100} />}
      {ketQua.isError && <Alert color="red">{thongDiepLoiChung(ketQua.error)}</Alert>}

      {ketQua.data && (
        <Stack gap="md">
          {/* trang_thai='dang_xu_ly' bao gồm CẢ 2 pha: đang validate (chưa có kết quả) LẪN đã validate
           * xong nhưng chưa bấm "Xác nhận" (mở lại từ Lịch sử) — backend chỉ chuyển sang 'hoan_thanh'
           * SAU KHI xác nhận, không phải sau khi validate xong. Phân biệt 2 pha bằng tong_so_dong: còn
           * 0 nghĩa là chưa có kết quả để hiện (còn đang xử lý thật), khác 0 là đã có, hiện preview. */}
          {ketQua.data.trang_thai === 'dang_xu_ly' && ketQua.data.tong_so_dong === 0 ? (
            <Group gap={8}>
              <Text fz={13}>Đang xử lý file, vui lòng chờ...</Text>
            </Group>
          ) : (
            <>
              <Group gap="xl">
                <Text fz={13}>
                  Tổng số dòng: <b>{ketQua.data.tong_so_dong}</b>
                </Text>
                <Text fz={13} c="green.7">
                  Thành công: <b>{ketQua.data.so_dong_thanh_cong}</b>
                </Text>
                <Text fz={13} c="danger.6">
                  Lỗi: <b>{ketQua.data.so_dong_loi}</b>
                </Text>
                {ketQua.data.so_hoc_vien_chua_co_email > 0 && (
                  <Text fz={13} c="yellow.8">
                    Chưa có email (bỏ qua gửi thông báo): <b>{ketQua.data.so_hoc_vien_chua_co_email}</b>
                  </Text>
                )}
              </Group>

              <BangDong mau="loi" danhSach={ketQua.data.danh_sach_loi} />
              <BangDong mau="canh_bao" danhSach={ketQua.data.danh_sach_canh_bao} />

              <Group gap={10}>
                <Button
                  color="accent"
                  loading={xacNhan.isPending}
                  disabled={ketQua.data.so_dong_thanh_cong === 0}
                  onClick={xuLyXacNhan}
                >
                  Xác nhận nạp dữ liệu
                </Button>
                {ketQua.data.so_dong_loi > 0 && (
                  <Button variant="default" loading={taiFileLoi.isPending} onClick={() => taiFileLoi.mutate()}>
                    Tải file lỗi
                  </Button>
                )}
              </Group>
            </>
          )}
        </Stack>
      )}
    </Paper>
  );
}

/** Nhập dữ liệu (Phase 5 redesign) — luồng 2 bước thật (docs/api-contract.md mục 5): tải file lên +
 * kiểm tra (POST /import/{loai}) rồi mới xác nhận nạp chính thức (POST /import/{id}/xac-nhan). */
export default function AdminNhapDuLieu() {
  const [loai, setLoai] = useState<LoaiDanhMucImport>('ho_so_nhan_su_moet');
  const [file, setFile] = useState<File | null>(null);
  const [importId, setImportId] = useState<string | undefined>();
  const panelRef = useRef<HTMLDivElement>(null);

  const upload = useTaiLenImport();
  const lichSu = useLichSuImport();
  const taiMau = useMutation({
    mutationFn: () => taiMauExcel(loai),
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
      { loai, file },
      {
        onSuccess: (res) => {
          setImportId(res.import_id);
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
  function moLaiXacNhan(id: string) {
    setImportId(id);
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
              <FileInput label="File Excel" placeholder="Chọn file .xlsx" accept=".xlsx" value={file} onChange={setFile} clearable />
              <Button variant="subtle" size="compact-sm" loading={taiMau.isPending} onClick={() => taiMau.mutate()} style={{ alignSelf: 'flex-start' }}>
                ⇩ Tải file mẫu Excel
              </Button>
              <Button color="danger" loading={upload.isPending} disabled={!file} onClick={xuLyTaiLen} fullWidth>
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
                                  onClick={() => moLaiXacNhan(i.id)}
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
            <PanelXemTruoc importId={importId} onXongViec={dongXongViec} />
          </div>
        )}
      </Container>
    </>
  );
}
