import { useState } from 'react';
import { Box, Button, Group, Radio, Stack, Text } from '@mantine/core';
import { useChonMucHoc } from '@/api/hocVien';
import type { KhoaHocDangKy, MucNangLuc } from '@/api/types';
import { cacMucDuocChon, mucHocHieuLuc, nhanMucNangLuc } from '@/lib/mucNangLuc';
import { thongDiepLoiChung } from '@/lib/loiApi';
import { StatusBanner } from '@/components/StatusBanner';

/** Điều chỉnh mức lớp học (2026-10-08): học viên chọn mức BẰNG hoặc THẤP HƠN kết quả đánh giá đầu vào,
 * chỉ khi khóa mở điều chỉnh. Khu chọn mở ngay trong thẻ (không popup). */
export function ChonMucLopHoc({ dangKy }: { dangKy: KhoaHocDangKy }) {
  const { khoa, muc_dau_vao, muc_hoc_chon } = dangKy;
  const [dangChon, setDangChon] = useState(false);
  const [giaTri, setGiaTri] = useState<MucNangLuc | null>(null);
  const [daLuu, setDaLuu] = useState(false);
  const chonMuc = useChonMucHoc();

  if (!muc_dau_vao) return null;
  const mucHoc = mucHocHieuLuc(dangKy);
  const duocDieuChinh = khoa.mo_dieu_chinh_muc && muc_dau_vao !== 'co_ban';

  const moChon = () => {
    setGiaTri(mucHoc);
    setDaLuu(false);
    chonMuc.reset();
    setDangChon(true);
  };

  const luu = () => {
    if (!giaTri) return;
    chonMuc.mutate(
      { khoaId: khoa.id, muc: giaTri },
      {
        onSuccess: () => {
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
        {muc_hoc_chon && <> (đã điều chỉnh từ {nhanMucNangLuc(muc_dau_vao)})</>}
      </Text>

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
              {cacMucDuocChon(muc_dau_vao).map((m) => (
                <Radio
                  key={m}
                  value={m}
                  label={m === muc_dau_vao ? `${nhanMucNangLuc(m)} (theo kết quả đánh giá)` : nhanMucNangLuc(m)}
                />
              ))}
            </Stack>
          </Radio.Group>
          {chonMuc.isError && <StatusBanner loai="error">{thongDiepLoiChung(chonMuc.error)}</StatusBanner>}
          <Group gap="sm">
            <Button size="sm" onClick={luu} loading={chonMuc.isPending} disabled={!giaTri}>
              Lưu
            </Button>
            <Button size="sm" variant="default" onClick={() => setDangChon(false)} disabled={chonMuc.isPending}>
              Hủy
            </Button>
          </Group>
        </Stack>
      )}
    </Box>
  );
}
