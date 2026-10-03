import { useMutation } from '@tanstack/react-query';
import { Alert, Box, Button, Group, Paper, Skeleton, Stack, Table, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useState } from 'react';
import {
  taiFileLoiImport,
  useImportChiTiet,
  useXacNhanImport,
  useXacNhanImportTaiKhoan,
} from '@/api/nhapDuLieu';
import type { LoaiDanhMucImport } from '@/api/types';
import { thongDiepLoiChung } from '@/lib/loiApi';
import { taiFileTuBlob } from '@/lib/taiFile';

// Dùng chung cho trang Nhập dữ liệu và modal import trong trang chi tiết khóa.
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
export function PanelXemTruocImport({
  importId,
  loai,
  onXongViec,
  onDaNap,
}: {
  importId: string;
  /** tai_khoan_don_vi: xác nhận nạp trả file mật khẩu tạm, panel giữ lại để tải lại trong phiên. */
  loai?: LoaiDanhMucImport;
  onXongViec: () => void;
  /** Gọi sau khi xác nhận nạp thành công (trước onXongViec) — để nơi gọi làm mới dữ liệu của mình. */
  onDaNap?: () => void;
}) {
  const ketQua = useImportChiTiet(importId);
  const xacNhan = useXacNhanImport();
  const xacNhanTaiKhoan = useXacNhanImportTaiKhoan();
  // Blob mật khẩu tạm chỉ giữ ở state cục bộ — mất khi panel đóng (ADR 0002).
  const [fileMatKhau, setFileMatKhau] = useState<Blob | null>(null);
  const laTaiKhoan = loai === 'tai_khoan_don_vi';
  const tenFileMatKhau = `mat-khau-tam-${importId}.xlsx`;
  const taiFileLoi = useMutation({
    mutationFn: () => taiFileLoiImport(importId),
    onSuccess: (blob) => taiFileTuBlob(blob, `loi-import-${importId}.xlsx`),
    onError: (err) => notifications.show({ color: 'red', message: thongDiepLoiChung(err) }),
  });

  function xuLyXacNhan() {
    if (laTaiKhoan) {
      xacNhanTaiKhoan.mutate(importId, {
        onSuccess: (blob) => {
          setFileMatKhau(blob);
          taiFileTuBlob(blob, tenFileMatKhau);
          onDaNap?.();
        },
        onError: (err) => notifications.show({ color: 'red', message: thongDiepLoiChung(err) }),
      });
      return;
    }
    xacNhan.mutate(importId, {
      onSuccess: () => {
        notifications.show({ color: 'green', message: 'Đã nạp dữ liệu chính thức vào hệ thống.' });
        onDaNap?.();
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

      {fileMatKhau && ketQua.data && (
        <Stack gap="md">
          <Alert color="green" variant="light">
            Đã tạo {ketQua.data.so_dong_thanh_cong} tài khoản. Tài khoản có email được gửi link kích hoạt; tài
            khoản không email có mật khẩu tạm trong file vừa tải về.
          </Alert>
          <Alert color="red" variant="light">
            File mật khẩu tạm chỉ tải được trong phiên màn hình này. Đóng lại sẽ không lấy lại được.
          </Alert>
          <Group gap={10}>
            <Button color="accent" onClick={() => taiFileTuBlob(fileMatKhau, tenFileMatKhau)}>
              Tải file mật khẩu tạm
            </Button>
            <Button variant="default" onClick={onXongViec}>
              Đã lưu, đóng
            </Button>
          </Group>
        </Stack>
      )}

      {ketQua.data && !fileMatKhau && (
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
                  loading={xacNhan.isPending || xacNhanTaiKhoan.isPending}
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
