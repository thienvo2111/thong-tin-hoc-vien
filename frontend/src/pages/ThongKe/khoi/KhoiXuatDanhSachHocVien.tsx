import { useState } from 'react';
import { Button, Group, Paper, Stack, Text, Title } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { xuatDanhSachHocVien, type LocThongKe } from '@/api/thongKe';
import { thongDiepLoiChung } from '@/lib/loiApi';
import { CHON_TRUONG_MAC_DINH, ChonTruongXuat, donViIdsXuat, thieuTruong } from '../ChonTruongXuat';

/** Xuất danh sách từng học viên (có PII) theo khóa/đối tượng của bộ lọc: tất cả trường hoặc chọn nhiều trường. */
export function KhoiXuatDanhSachHocVien({ loc }: { loc: LocThongKe }) {
  const [chon, setChon] = useState(CHON_TRUONG_MAC_DINH);
  const [dangXuat, setDangXuat] = useState(false);
  const chuaChonTruong = thieuTruong(chon);

  async function xuat() {
    setDangXuat(true);
    try {
      await xuatDanhSachHocVien(loc, donViIdsXuat(chon));
    } catch (e) {
      notifications.show({ color: 'red', message: thongDiepLoiChung(e) });
    } finally {
      setDangXuat(false);
    }
  }

  return (
    <Paper withBorder p="md" radius="md" component="section" aria-label="Xuất danh sách học viên">
      <Stack gap="sm">
        <Title order={3} size="h4">
          Xuất danh sách học viên
        </Title>
        <Text size="sm" c="dimmed">
          Mỗi học viên một dòng: họ tên, ngày sinh, đơn vị công tác, đối tượng, SĐT, email, khóa, tình trạng truy cập,
          khảo sát kĩ năng số, đánh giá NLS đầu vào và kết quả. Nhân viên ghi “Không áp dụng” (tạm thời chưa khảo sát
          – đánh giá). Áp dụng khóa và đối tượng đang chọn ở bộ lọc.
        </Text>
        <ChonTruongXuat value={chon} onChange={setChon} />
        <Group>
          <Button loading={dangXuat} disabled={chuaChonTruong} onClick={() => void xuat()}>
            Xuất Excel danh sách học viên
          </Button>
          {chuaChonTruong && (
            <Text size="sm" c="dimmed">
              Chọn ít nhất một trường
            </Text>
          )}
        </Group>
      </Stack>
    </Paper>
  );
}
