import { useState } from 'react';
import { Box, Button, Group, Modal, Radio, Stack, Text } from '@mantine/core';
import { useChonMucHoc } from '@/api/hocVien';
import type { KhoaHocDangKy, MucNangLuc } from '@/api/types';
import { cacMucDuocChon, ghiChuXepLopTheoKhaoSat, mucHocHieuLuc, nhanMucNangLuc } from '@/lib/mucNangLuc';
import { thongDiepLoiChung } from '@/lib/loiApi';
import { dinhDangNgayGio } from '@/lib/ngay';
import { StatusBanner } from '@/components/StatusBanner';

/** Điều chỉnh mức lớp học (2026-10-08): học viên chọn mức BẰNG hoặc THẤP HƠN kết quả đánh giá đầu vào,
 * chỉ khi khóa mở điều chỉnh. Mốc = muc_danh_gia (mức chốt ?? quy đổi từ bài khảo sát, 2026-10-09). Khu chọn mở ngay trong thẻ; bấm Lưu -> hộp xác nhận trong trang rồi mới gọi API. */
export function ChonMucLopHoc({ dangKy }: { dangKy: KhoaHocDangKy }) {
  const { khoa, muc_danh_gia, muc_hoc_chon, muc_hoc_chon_luc } = dangKy;
  const [dangChon, setDangChon] = useState(false);
  const [xacNhan, setXacNhan] = useState(false);
  const [giaTri, setGiaTri] = useState<MucNangLuc | null>(null);
  const [daLuu, setDaLuu] = useState(false);
  const chonMuc = useChonMucHoc();

  if (!muc_danh_gia) return null;
  const mucHoc = mucHocHieuLuc(dangKy);
  // Kết quả khảo sát (vd M1 – Chưa đạt) giữ nguyên nhãn; ở đây chỉ nói mức LỚP được xếp.
  const ghiChuXepLop = ghiChuXepLopTheoKhaoSat(dangKy);
  const duocDieuChinh = khoa.mo_dieu_chinh_muc && muc_danh_gia !== 'co_ban';

  const moChon = () => {
    setGiaTri(mucHoc);
    setDaLuu(false);
    chonMuc.reset();
    setDangChon(true);
  };

  // Chọn đúng mức đang học -> không có gì để lưu, chỉ đóng khu chọn.
  const luu = () => {
    if (!giaTri) return;
    if (giaTri === mucHoc) {
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
      <Text size="sm">
        Mức lớp học: <b>{nhanMucNangLuc(mucHoc)}</b>
        {muc_hoc_chon && <> (đã điều chỉnh từ {nhanMucNangLuc(muc_danh_gia)})</>}
        {!muc_hoc_chon && ghiChuXepLop && <> ({ghiChuXepLop})</>}
      </Text>
      {muc_hoc_chon_luc && (
        <Text size="xs" c="dimmed">
          Đã điều chỉnh lúc {dinhDangNgayGio(muc_hoc_chon_luc)}
        </Text>
      )}

      {daLuu && (
        <Box mt="xs">
          <StatusBanner loai="success">Đã lưu mức lớp học. Lớp học sẽ được xếp theo mức đã chọn.</StatusBanner>
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
            Thầy/Cô chỉ có thể chọn học ở mức bằng hoặc thấp hơn kết quả đánh giá. Lớp học sẽ được xếp theo mức
            đã chọn.
          </Text>
          <Radio.Group
            label="Chọn mức lớp học"
            value={giaTri ?? ''}
            onChange={(v) => setGiaTri(v as MucNangLuc)}
          >
            <Stack gap="xs" mt="xs">
              {cacMucDuocChon(muc_danh_gia).map((m) => (
                <Radio
                  key={m}
                  value={m}
                  label={m === muc_danh_gia ? `${nhanMucNangLuc(m)} (theo kết quả đánh giá)` : nhanMucNangLuc(m)}
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
            Thầy/Cô xác nhận chuyển từ mức <b>{nhanMucNangLuc(mucHoc)}</b> sang mức <b>{nhanMucNangLuc(giaTri)}</b>?
            Lớp học sẽ được xếp theo mức đã chọn.
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
