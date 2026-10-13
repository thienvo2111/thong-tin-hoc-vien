import { useState } from 'react';
import { Box, Button, Group, Modal, Radio, Stack, Text } from '@mantine/core';
import { useChonMucHoc } from '@/api/hocVien';
import type { KhoaHocDangKy, MucNangLuc } from '@/api/types';
import { cacMucDuocChon, nhanMucNangLuc, nhuCauMucHoc } from '@/lib/mucNangLuc';
import { thongDiepLoiChung } from '@/lib/loiApi';
import { StatusBanner } from '@/components/StatusBanner';
import { CacNguonMucHoc } from '@/components/CacNguonMucHoc';

/** Mức đầu vào của 1 khóa (ADR 0006): hiện đủ 3 nguồn — kết quả hệ thống, nhu cầu đã chọn, mức chính thức (chốt).
 * Học viên chọn nhu cầu BẰNG hoặc THẤP HƠN 1 mức so với kết quả hệ thống, chỉ khi khóa mở điều chỉnh VÀ chưa chốt;
 * đã chốt thì khóa điều chỉnh. Bấm Lưu -> hộp xác nhận trong trang rồi mới gọi API. */
export function ChonMucLopHoc({ dangKy }: { dangKy: KhoaHocDangKy }) {
  const { khoa, muc_he_thong, muc_dau_vao } = dangKy;
  const [dangChon, setDangChon] = useState(false);
  const [xacNhan, setXacNhan] = useState(false);
  const [giaTri, setGiaTri] = useState<MucNangLuc | null>(null);
  const [daLuu, setDaLuu] = useState(false);
  const chonMuc = useChonMucHoc();

  const nhuCau = nhuCauMucHoc(dangKy);
  const duocDieuChinh = khoa.mo_dieu_chinh_muc && !muc_dau_vao && !!muc_he_thong && muc_he_thong !== 'co_ban';

  const moChon = () => {
    // Lựa chọn cũ thấp hơn 2 mức (trước quy tắc 1 mức) không còn trong danh sách -> chọn sẵn mốc.
    setGiaTri(nhuCau && cacMucDuocChon(muc_he_thong).includes(nhuCau) ? nhuCau : muc_he_thong);
    setDaLuu(false);
    chonMuc.reset();
    setDangChon(true);
  };

  // Chọn đúng mức đang học -> không có gì để lưu, chỉ đóng khu chọn.
  const luu = () => {
    if (!giaTri) return;
    if (giaTri === nhuCau) {
      setDangChon(false);
      return;
    }
    chonMuc.reset();
    setXacNhan(true);
  };

  const xacNhanLuu = () => {
    if (!giaTri) return;
    chonMuc.mutate(
      { khoaId: khoa.id, muc: giaTri },
      {
        onSuccess: () => {
          setXacNhan(false);
          setDangChon(false);
          setDaLuu(true);
        },
      },
    );
  };

  return (
    <Box>
      <CacNguonMucHoc dangKy={dangKy} />
      {muc_dau_vao && khoa.mo_dieu_chinh_muc && (
        <Text size="xs" c="dimmed">
          Mức đã được chốt
        </Text>
      )}

      {daLuu && (
        <Box mt="xs">
          <StatusBanner loai="success">Đã lưu nhu cầu mức lớp học.</StatusBanner>
        </Box>
      )}

      {duocDieuChinh && !dangChon && (
        <Button variant="light" size="sm" mt="xs" onClick={moChon}>
          Điều chỉnh mức lớp
        </Button>
      )}

      {duocDieuChinh && dangChon && (
        <Stack gap="sm" mt="xs" p="sm" style={{ borderRadius: 8, border: '1px solid var(--mantine-color-gray-3)' }}>
          <Text size="sm">
            Thầy/Cô chỉ có thể chọn học ở mức bằng kết quả đánh giá hoặc thấp hơn 1 mức. Lớp học được xếp theo
            mức chính thức do Ban tổ chức chốt.
          </Text>
          <Radio.Group
            label="Chọn mức lớp học"
            value={giaTri ?? ''}
            onChange={(v) => setGiaTri(v as MucNangLuc)}
          >
            <Stack gap="xs" mt="xs">
              {cacMucDuocChon(muc_he_thong).map((m) => (
                <Radio
                  key={m}
                  value={m}
                  label={m === muc_he_thong ? `${nhanMucNangLuc(m)} (theo kết quả đánh giá)` : nhanMucNangLuc(m)}
                />
              ))}
            </Stack>
          </Radio.Group>
          <Group gap="sm">
            <Button size="sm" onClick={luu} disabled={!giaTri}>
              Lưu
            </Button>
            <Button size="sm" variant="default" onClick={() => setDangChon(false)}>
              Hủy
            </Button>
          </Group>
        </Stack>
      )}

      <Modal
        opened={xacNhan}
        onClose={() => !chonMuc.isPending && setXacNhan(false)}
        title="Xác nhận điều chỉnh mức lớp học"
        centered
      >
        <Stack gap="md">
          <Text size="sm">
            Thầy/Cô xác nhận chuyển từ mức <b>{nhanMucNangLuc(nhuCau)}</b> sang mức <b>{nhanMucNangLuc(giaTri)}</b>?
            Lớp học được xếp theo mức chính thức do Ban tổ chức chốt.
          </Text>
          {chonMuc.isError && <StatusBanner loai="error">{thongDiepLoiChung(chonMuc.error)}</StatusBanner>}
          <Group gap="sm" justify="flex-end">
            <Button variant="default" onClick={() => setXacNhan(false)} disabled={chonMuc.isPending}>
              Quay lại
            </Button>
            <Button onClick={xacNhanLuu} loading={chonMuc.isPending}>
              Xác nhận
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Box>
  );
}
