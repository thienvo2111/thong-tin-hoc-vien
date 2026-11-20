import { useEffect, useState } from 'react';
import { Alert, Button, Group, Modal, Stack, Text, Textarea } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useXoaDongDanhSach, type DongDanhSach } from '@/api/danhSachThamGia';
import { thongDiepLoiXungDot } from '@/lib/loiApi';

interface Props {
  dotId: string;
  /** null = đóng. */
  dong: DongDanhSach | null;
  onClose: () => void;
}

/** Xác nhận xóa 1 dòng danh sách tham gia, bắt buộc lý do (issue #59, ADR 0015 X3). */
export function ModalXoaDong({ dotId, dong, onClose }: Props) {
  const xoa = useXoaDongDanhSach(dotId);
  const [lyDo, setLyDo] = useState('');
  const [loiLyDo, setLoiLyDo] = useState<string | null>(null);
  const [loiChung, setLoiChung] = useState<string | null>(null);

  useEffect(() => {
    setLyDo('');
    setLoiLyDo(null);
    setLoiChung(null);
  }, [dong]);

  function xacNhan() {
    if (!dong) return;
    const ly_do = lyDo.trim().normalize('NFC');
    if (!ly_do) {
      setLoiLyDo('Nhập lý do');
      return;
    }
    setLoiChung(null);
    xoa.mutate(
      { dongId: dong.id, ly_do },
      {
        onSuccess: () => {
          notifications.show({ color: 'green', message: 'Đã xóa khỏi danh sách' });
          onClose();
        },
        onError: (err) => setLoiChung(thongDiepLoiXungDot(err)),
      },
    );
  }

  return (
    <Modal opened={!!dong} onClose={onClose} title="Xóa khỏi danh sách" centered>
      <Stack gap="sm">
        {loiChung && (
          <Alert color="red" role="alert">
            {loiChung}
          </Alert>
        )}
        <Text fz="sm">
          Xóa <b>{dong?.ho_ten}</b> khỏi danh sách của đợt? Thao tác không hoàn tác được (nhật ký vẫn lưu thông tin
          dòng).
        </Text>
        <Textarea
          label="Lý do"
          required
          autosize
          minRows={2}
          value={lyDo}
          onChange={(e) => {
            setLyDo(e.currentTarget.value);
            setLoiLyDo(null);
          }}
          error={loiLyDo}
        />
        <Group justify="flex-end" gap="sm">
          <Button variant="default" onClick={onClose}>
            Hủy
          </Button>
          <Button color="red" loading={xoa.isPending} onClick={xacNhan}>
            Xóa
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
