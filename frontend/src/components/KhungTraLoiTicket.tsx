import { useState } from 'react';
import { Alert, Button, Group, Stack, Text, Textarea } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { ApiError } from '@/api/client';
import { thongDiepLoiXungDot } from '@/lib/loiApi';

export interface TraLoiDaCo {
  noi_dung_tra_loi: string | null;
  nguoi_tra_loi_ten: string | null;
}

/** Ô trả lời 1 yêu cầu hỗ trợ — dùng chung cho Quản trị và người hỗ trợ học viên (ADR 0003 H11).
 * Backend chỉ ghi khi ticket còn "chờ xử lý"; người gửi sau nhận 409 → KHÔNG làm mới danh sách ngay (dòng
 * sẽ rời bộ lọc và mất nội dung đang soạn), mà tải câu trả lời đã có về hiện tại chỗ, giữ nguyên bản nháp. */
export function KhungTraLoiTicket({
  guiTraLoi,
  layTraLoiHienTai,
  onXong,
  onHuy,
}: {
  guiTraLoi: (noiDung: string) => Promise<unknown>;
  layTraLoiHienTai: () => Promise<TraLoiDaCo>;
  /** Gọi sau khi gửi thành công hoặc khi đóng khung báo trùng — nơi gọi làm mới danh sách. */
  onXong: () => void;
  onHuy: () => void;
}) {
  const [noiDung, setNoiDung] = useState('');
  const [dangGui, setDangGui] = useState(false);
  const [traLoiDaCo, setTraLoiDaCo] = useState<TraLoiDaCo | null>(null);

  async function gui() {
    setDangGui(true);
    try {
      await guiTraLoi(noiDung.trim().normalize('NFC'));
      notifications.show({ color: 'green', message: 'Đã gửi trả lời' });
      onXong();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        try {
          setTraLoiDaCo(await layTraLoiHienTai());
        } catch {
          setTraLoiDaCo({ noi_dung_tra_loi: null, nguoi_tra_loi_ten: null });
        }
      } else {
        notifications.show({ color: 'red', message: thongDiepLoiXungDot(err) });
      }
    } finally {
      setDangGui(false);
    }
  }

  async function saoChep() {
    try {
      await navigator.clipboard.writeText(noiDung);
      notifications.show({ color: 'green', message: 'Đã sao chép nội dung của bạn' });
    } catch {
      notifications.show({ color: 'red', message: 'Không sao chép được, hãy chép thủ công.' });
    }
  }

  return (
    <Stack gap={6}>
      {traLoiDaCo && (
        <Alert color="yellow" variant="light" title="Yêu cầu này đã có người trả lời">
          <Stack gap={4}>
            {traLoiDaCo.noi_dung_tra_loi && (
              <Text size="sm">
                <b>{traLoiDaCo.nguoi_tra_loi_ten ?? 'Câu trả lời đã gửi'}:</b> {traLoiDaCo.noi_dung_tra_loi}
              </Text>
            )}
            <Text size="xs" c="dimmed">
              Nội dung bạn đang soạn vẫn còn bên dưới — có thể sao chép để nhắn bổ sung qua Zalo.
            </Text>
          </Stack>
        </Alert>
      )}
      <Textarea
        aria-label="Nội dung trả lời"
        minRows={3}
        autosize
        value={noiDung}
        onChange={(e) => setNoiDung(e.currentTarget.value)}
        readOnly={!!traLoiDaCo}
      />
      <Group gap="xs">
        {traLoiDaCo ? (
          <>
            <Button size="xs" variant="light" onClick={saoChep} disabled={!noiDung.trim()}>
              Sao chép nội dung của tôi
            </Button>
            <Button size="xs" variant="subtle" onClick={onXong}>
              Đóng
            </Button>
          </>
        ) : (
          <>
            <Button size="xs" onClick={gui} loading={dangGui} disabled={!noiDung.trim()}>
              Gửi trả lời
            </Button>
            <Button size="xs" variant="subtle" onClick={onHuy} disabled={dangGui}>
              Hủy
            </Button>
          </>
        )}
      </Group>
    </Stack>
  );
}
