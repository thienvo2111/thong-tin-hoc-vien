import { useState } from 'react';
import { Button, Group, MultiSelect, Paper, Radio, Stack, Text, Title } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useBoLocThongKe, xuatDanhSachHocVien, type LocThongKe } from '@/api/thongKe';
import { thongDiepLoiChung } from '@/lib/loiApi';
import { locTiengViet } from '@/lib/timKiemTiengViet';

// Khớp TOI_DA_DON_VI_LOC ở backend (giới hạn độ dài URL).
const TOI_DA_TRUONG = 100;

type CheDo = 'tat_ca' | 'chon';

/** Xuất danh sách từng học viên (có PII) theo khóa/đối tượng của bộ lọc: tất cả trường hoặc chọn nhiều trường. */
export function KhoiXuatDanhSachHocVien({ loc }: { loc: LocThongKe }) {
  const boLoc = useBoLocThongKe();
  const [cheDo, setCheDo] = useState<CheDo>('tat_ca');
  const [truong, setTruong] = useState<string[]>([]);
  const [dangXuat, setDangXuat] = useState(false);

  // Vai trò trường / người hỗ trợ không có danh sách đơn vị -> chỉ xuất theo phạm vi tài khoản.
  const dsTruong = (boLoc.data?.don_vi ?? []).filter((d) => d.loai_don_vi === 'truong');
  const choChon = dsTruong.length > 0;
  const thieuTruong = cheDo === 'chon' && truong.length === 0;

  async function xuat() {
    setDangXuat(true);
    try {
      await xuatDanhSachHocVien(loc, cheDo === 'chon' ? truong : []);
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
        {choChon && (
          <Radio.Group
            value={cheDo}
            onChange={(v) => setCheDo(v as CheDo)}
            label="Phạm vi trường"
          >
            <Group gap="lg" mt={4}>
              <Radio value="tat_ca" label="Tất cả trường (theo bộ lọc)" />
              <Radio value="chon" label="Chọn một hoặc nhiều trường" />
            </Group>
          </Radio.Group>
        )}
        {choChon && cheDo === 'chon' && (
          <MultiSelect
            label="Trường"
            placeholder={truong.length ? undefined : 'Gõ tên trường để tìm'}
            searchable
            clearable
            filter={locTiengViet}
            limit={50}
            maxValues={TOI_DA_TRUONG}
            hidePickedOptions
            nothingFoundMessage="Không tìm thấy trường"
            data={dsTruong.map((d) => ({ value: d.id, label: d.ten_don_vi }))}
            value={truong}
            onChange={setTruong}
            description={`Đã chọn ${truong.length}/${TOI_DA_TRUONG} trường`}
            comboboxProps={{ withinPortal: true }}
          />
        )}
        <Group>
          <Button loading={dangXuat} disabled={thieuTruong} onClick={() => void xuat()}>
            Xuất Excel danh sách học viên
          </Button>
          {thieuTruong && (
            <Text size="sm" c="dimmed">
              Chọn ít nhất một trường
            </Text>
          )}
        </Group>
      </Stack>
    </Paper>
  );
}
