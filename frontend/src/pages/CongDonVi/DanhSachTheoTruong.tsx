import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { Alert, Badge, Button, Group, Paper, Skeleton, Stack, Table, Text, Title } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useDanhSachThamGia, xuatExcelDanhSach, type DongDanhSach, type TongHopTruong } from '@/api/danhSachThamGia';
import { thongDiepLoiChung } from '@/lib/loiApi';
import { dinhDangNgayLich } from '@/lib/ngayLich';
import { taiFileTuBlob } from '@/lib/taiFile';
import { NHAN_GIAI_DOAN, NHAN_Y_KIEN, dinhDangSuat } from './danhSachThamGiaNhan';
import { TRANG_THAI_DANH_SACH, TRANG_THAI_HOP_DONG } from './hopDongNhan';
import { ModalDongDanhSach } from './ModalDongDanhSach';
import { ModalXoaDong } from './ModalXoaDong';

// Issue #64 / X5: trường đã nộp hợp đồng → Quản trị không sửa được danh sách tới khi Mở lại.
const GHI_CHU_DA_NOP = 'Đã nộp hợp đồng — mở lại để sửa';

/** Form sửa/thêm đang mở: dong null = thêm người (donViMacDinh = trường đang xem, nếu có). */
type MoForm = { dong: DongDanhSach | null; donViMacDinh: string | null } | null;

/** Danh sách tham gia của đợt: tổng hợp theo trường, chọn 1 trường để xem từng người (issue #58).
 * Issue #59: Quản trị sửa/xóa từng dòng, thêm người (đợt HSG), xuất Excel cả đợt hoặc 1 trường.
 * Issue #62: số đề nghị chờ theo trường + đánh dấu dòng có đề nghị chờ. */
export function DanhSachTheoTruong({ dotId, choThem }: { dotId: string; choThem: boolean }) {
  const { data, isLoading, isError, error } = useDanhSachThamGia(dotId);
  const [truong, setTruong] = useState<TongHopTruong | null>(null);
  const [moForm, setMoForm] = useState<MoForm>(null);
  const [dongXoa, setDongXoa] = useState<DongDanhSach | null>(null);
  const xuat = useMutation({
    mutationFn: async (t: TongHopTruong | null) => {
      const blob = await xuatExcelDanhSach(dotId, t?.don_vi_id);
      taiFileTuBlob(blob, t ? `danh-sach-tham-gia-${t.ma_don_vi ?? t.don_vi_id}.xlsx` : 'danh-sach-tham-gia.xlsx');
    },
    onError: (err) => notifications.show({ color: 'red', message: thongDiepLoiChung(err) }),
  });
  const dongCuaTruong = truong ? (data?.dong ?? []).filter((d) => d.don_vi_id === truong.don_vi_id) : [];
  // Lấy trạng thái mới nhất từ tong_hop (sau Mở lại / nộp), không từ bản ghi lúc bấm "Xem".
  const truongDaNop =
    !!truong && data?.tong_hop.find((t) => t.don_vi_id === truong.don_vi_id)?.trang_thai_hop_dong === 'da_nop';
  const tongNguoi = data?.tong_hop.reduce((t, x) => t + x.so_nguoi, 0) ?? 0;
  const tongSuat = data?.tong_hop.reduce((t, x) => t + x.tong_suat, 0) ?? 0;

  return (
    <Paper withBorder radius="md" p="md">
      <Stack gap="sm">
        <Group justify="space-between" gap="sm">
          <Title order={2} size="h4">
            Danh sách theo trường
          </Title>
          <Group gap="xs">
            {choThem && (
              <Button size="xs" variant="default" onClick={() => setMoForm({ dong: null, donViMacDinh: null })}>
                Thêm người
              </Button>
            )}
            {data && data.tong_hop.length > 0 && (
              <Button
                size="xs"
                variant="default"
                loading={xuat.isPending && xuat.variables === null}
                onClick={() => xuat.mutate(null)}
              >
                Xuất Excel
              </Button>
            )}
          </Group>
        </Group>
        {isLoading && <Skeleton height={80} radius="md" />}
        {isError && <Alert color="red">{thongDiepLoiChung(error)}</Alert>}
        {data && data.tong_hop.length === 0 && <Text c="dimmed">Chưa có danh sách cho đợt này.</Text>}
        {data && data.tong_hop.length > 0 && (
          <>
            <Text fz="sm">
              {data.tong_hop.length} trường, {tongNguoi} người, tổng {dinhDangSuat(tongSuat)} suất.
            </Text>
            <Table.ScrollContainer minWidth={560}>
              <Table striped withTableBorder fz="sm" aria-label="Tổng hợp theo trường">
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Trường</Table.Th>
                    <Table.Th>Mã</Table.Th>
                    <Table.Th ta="right">Số người</Table.Th>
                    <Table.Th ta="right">Tổng suất</Table.Th>
                    <Table.Th>Trạng thái</Table.Th>
                    <Table.Th />
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {data.tong_hop.map((t) => (
                    <Table.Tr key={t.don_vi_id}>
                      <Table.Td>{t.ten_don_vi}</Table.Td>
                      <Table.Td>{t.ma_don_vi}</Table.Td>
                      <Table.Td ta="right">{t.so_nguoi}</Table.Td>
                      <Table.Td ta="right">{dinhDangSuat(t.tong_suat)}</Table.Td>
                      <Table.Td>
                        <Group gap={4}>
                          {t.trang_thai_danh_sach && (
                            <Badge color={TRANG_THAI_DANH_SACH[t.trang_thai_danh_sach].mau} variant="light">
                              {TRANG_THAI_DANH_SACH[t.trang_thai_danh_sach].nhan}
                            </Badge>
                          )}
                          {!!t.so_de_nghi_cho && (
                            <Badge color="yellow" variant="light">
                              {t.so_de_nghi_cho} đề nghị chờ
                            </Badge>
                          )}
                          {t.trang_thai_hop_dong && (
                            <Badge color={TRANG_THAI_HOP_DONG[t.trang_thai_hop_dong].mau} variant="light">
                              HĐ: {TRANG_THAI_HOP_DONG[t.trang_thai_hop_dong].nhan}
                            </Badge>
                          )}
                        </Group>
                      </Table.Td>
                      <Table.Td>
                        <Group gap={4} wrap="nowrap">
                          <Button
                            size="xs"
                            variant={truong?.don_vi_id === t.don_vi_id ? 'filled' : 'default'}
                            aria-label={`Xem danh sách ${t.ten_don_vi}`}
                            onClick={() => setTruong(t)}
                          >
                            Xem
                          </Button>
                          {/* Issue #63: Quản trị xem hồ sơ đơn vị (chỉ đọc) của trường. */}
                          <Button
                            component={Link}
                            to={`/quan-tri/ho-so-don-vi/${t.don_vi_id}`}
                            size="xs"
                            variant="subtle"
                            aria-label={`Hồ sơ đơn vị ${t.ten_don_vi}`}
                          >
                            Hồ sơ đơn vị
                          </Button>
                          {/* Issue #64: Quản trị xem hợp đồng (bản chụp hồ sơ) + Mở lại. */}
                          <Button
                            component={Link}
                            to={`/quan-tri/hop-dong/${dotId}/${t.don_vi_id}`}
                            size="xs"
                            variant="subtle"
                            aria-label={`Hợp đồng ${t.ten_don_vi}`}
                          >
                            Hợp đồng
                          </Button>
                        </Group>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>
          </>
        )}
        {truong && (
          <Stack gap="xs">
            <Group justify="space-between" gap="sm">
              <div>
                <Title order={3} size="h5">
                  {truong.ten_don_vi}
                </Title>
                {truongDaNop && (
                  <Text size="sm" c="orange.8">
                    {GHI_CHU_DA_NOP}
                  </Text>
                )}
              </div>
              <Group gap="xs">
                {choThem && (
                  <Button
                    size="xs"
                    variant="default"
                    disabled={truongDaNop}
                    title={truongDaNop ? GHI_CHU_DA_NOP : undefined}
                    aria-label={`Thêm người vào ${truong.ten_don_vi}`}
                    onClick={() => setMoForm({ dong: null, donViMacDinh: truong.don_vi_id })}
                  >
                    Thêm người
                  </Button>
                )}
                <Button
                  size="xs"
                  variant="default"
                  aria-label={`Xuất Excel ${truong.ten_don_vi}`}
                  loading={xuat.isPending && xuat.variables !== null}
                  onClick={() => xuat.mutate(truong)}
                >
                  Xuất Excel trường này
                </Button>
              </Group>
            </Group>
            <Table.ScrollContainer minWidth={920}>
              <Table striped withTableBorder fz="sm" aria-label={`Danh sách ${truong.ten_don_vi}`}>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Họ tên</Table.Th>
                    <Table.Th>Ngày sinh</Table.Th>
                    <Table.Th>Giới tính</Table.Th>
                    <Table.Th>Lớp</Table.Th>
                    <Table.Th>Giai đoạn</Table.Th>
                    <Table.Th ta="right">Suất</Table.Th>
                    <Table.Th>Ghi chú</Table.Th>
                    <Table.Th>Ý kiến trường</Table.Th>
                    <Table.Th />
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {dongCuaTruong.map((d) => (
                    <Table.Tr key={d.id}>
                      <Table.Td>{d.ho_ten}</Table.Td>
                      <Table.Td>{d.ngay_sinh ? dinhDangNgayLich(d.ngay_sinh) : ''}</Table.Td>
                      <Table.Td>{d.gioi_tinh}</Table.Td>
                      <Table.Td>{d.lop}</Table.Td>
                      <Table.Td>{NHAN_GIAI_DOAN[d.giai_doan]}</Table.Td>
                      <Table.Td ta="right">{dinhDangSuat(d.ty_le_suat)}</Table.Td>
                      <Table.Td>{d.ghi_chu}</Table.Td>
                      <Table.Td>
                        <Group gap={4} wrap="nowrap">
                          <Badge color={NHAN_Y_KIEN[d.y_kien_truong ?? 'chua_co'].mau} variant="light">
                            {NHAN_Y_KIEN[d.y_kien_truong ?? 'chua_co'].nhan}
                          </Badge>
                          {d.co_de_nghi_cho && (
                            <Badge color="yellow" variant="light">
                              Có đề nghị chờ
                            </Badge>
                          )}
                        </Group>
                      </Table.Td>
                      <Table.Td>
                        <Group gap={4} wrap="nowrap">
                          <Button
                            size="xs"
                            variant="subtle"
                            disabled={truongDaNop}
                            title={truongDaNop ? GHI_CHU_DA_NOP : undefined}
                            aria-label={`Sửa ${d.ho_ten}`}
                            onClick={() => setMoForm({ dong: d, donViMacDinh: null })}
                          >
                            Sửa
                          </Button>
                          <Button
                            size="xs"
                            variant="subtle"
                            color="red"
                            disabled={truongDaNop}
                            title={truongDaNop ? GHI_CHU_DA_NOP : undefined}
                            aria-label={`Xóa ${d.ho_ten}`}
                            onClick={() => setDongXoa(d)}
                          >
                            Xóa
                          </Button>
                        </Group>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>
          </Stack>
        )}
      </Stack>
      <ModalDongDanhSach
        opened={moForm !== null}
        onClose={() => setMoForm(null)}
        dotId={dotId}
        dong={moForm?.dong ?? null}
        donViMacDinh={moForm?.donViMacDinh ?? null}
        tenDonViHienTai={truong?.ten_don_vi}
      />
      <ModalXoaDong dotId={dotId} dong={dongXoa} onClose={() => setDongXoa(null)} />
    </Paper>
  );
}
