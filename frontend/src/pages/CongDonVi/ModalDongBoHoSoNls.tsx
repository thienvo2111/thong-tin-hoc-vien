import { Alert, Button, Group, Modal, Stack, Table, Text } from '@mantine/core';
import {
  NHAN_TRUONG_CA_NHAN,
  hienThiTruongCaNhan,
  type HoSoHocVienNls,
  type TruongKhacHoSo,
} from '@/lib/dongBoHoSoNls';

interface Props {
  opened: boolean;
  /** Hủy: không gửi gì. */
  onClose: () => void;
  /** Chỉ các trường cá nhân khác hồ sơ (truongKhacHoSo). */
  khac: TruongKhacHoSo[];
  hoSo: HoSoHocVienNls | null;
  /** true = cập nhật cả hồ sơ NLS; false = chỉ sửa danh sách. */
  onChon: (dongBo: boolean) => void;
  dangGui?: boolean;
  /** Lỗi server (vd. "Không cập nhật được hồ sơ học viên: …"). */
  loi?: string | null;
  /** Tên trường công tác theo id (giá trị mới) — giá trị cũ lấy từ hồ sơ. */
  tenTruong?: (id: string) => string | undefined;
  /** Mở chồng lên hộp sửa dòng. */
  zIndex?: number;
}

/** Issue #69 / ADR 0015 Y2: hỏi Quản trị có cập nhật luôn hồ sơ học viên NLS không, kèm xem trước cũ → mới. */
export function ModalDongBoHoSoNls({
  opened,
  onClose,
  khac,
  hoSo,
  onChon,
  dangGui = false,
  loi = null,
  tenTruong,
  zIndex,
}: Props) {
  const ten = (id: string) => (hoSo && id === hoSo.don_vi.id ? hoSo.don_vi.ten : tenTruong?.(id));
  return (
    <Modal opened={opened} onClose={onClose} title="Cập nhật luôn hồ sơ học viên NLS?" centered zIndex={zIndex}>
      <Stack gap="sm">
        {loi && (
          <Alert color="red" role="alert">
            {loi}
          </Alert>
        )}
        <Text size="sm">Thông tin cá nhân mới khác hồ sơ học viên NLS:</Text>
        <Table.ScrollContainer minWidth={360}>
          <Table withTableBorder fz="sm" aria-label="So sánh hồ sơ NLS">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Trường thông tin</Table.Th>
                <Table.Th>Hồ sơ NLS hiện tại</Table.Th>
                <Table.Th>Giá trị mới</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {khac.map((k) => (
                <Table.Tr key={k.truong}>
                  <Table.Td>{NHAN_TRUONG_CA_NHAN[k.truong]}</Table.Td>
                  <Table.Td>{hienThiTruongCaNhan(k.truong, k.cu, ten)}</Table.Td>
                  <Table.Td fw={600}>{hienThiTruongCaNhan(k.truong, k.moi, ten)}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
        <Text size="sm" c="dimmed">
          Giai đoạn, suất, lớp không đồng bộ.
        </Text>
        <Group justify="flex-end" gap="sm" wrap="wrap">
          <Button variant="default" onClick={onClose} disabled={dangGui}>
            Hủy
          </Button>
          <Button variant="light" onClick={() => onChon(false)} disabled={dangGui}>
            Chỉ sửa danh sách
          </Button>
          <Button onClick={() => onChon(true)} loading={dangGui}>
            Cập nhật cả hồ sơ NLS
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
