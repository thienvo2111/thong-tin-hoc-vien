import { Alert, Button, Code, Group, Modal, Stack, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';

/** Hiện mật khẩu tạm đúng 1 lần (ADR 0002). Mật khẩu chỉ nằm trong prop do trang cha giữ ở state cục
 * bộ — đóng modal thì trang cha xóa state, không còn trong DOM/bộ nhớ. */
export function ModalMatKhauTam({
  thongTin,
  onDong,
}: {
  thongTin: { ten_dang_nhap: string; mat_khau_tam: string } | null;
  onDong: () => void;
}) {
  async function saoChep(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      notifications.show({ color: 'green', message: 'Đã sao chép' });
    } catch {
      notifications.show({ color: 'red', message: 'Không sao chép được, hãy chép thủ công.' });
    }
  }

  return (
    <Modal opened={thongTin !== null} onClose={onDong} title="Mật khẩu tạm" centered closeOnClickOutside={false}>
      {thongTin && (
        <Stack gap="sm">
          <Alert color="red" variant="light">
            Mật khẩu chỉ hiện một lần. Đóng cửa sổ này sẽ không xem lại được.
          </Alert>
          <Group justify="space-between" wrap="nowrap">
            <Text fz="sm">
              Tên đăng nhập: <Code fz="sm">{thongTin.ten_dang_nhap}</Code>
            </Text>
            <Button size="xs" variant="light" onClick={() => saoChep(thongTin.ten_dang_nhap)}>
              Sao chép
            </Button>
          </Group>
          <Group justify="space-between" wrap="nowrap">
            <Text fz="sm">
              Mật khẩu tạm: <Code fz="md">{thongTin.mat_khau_tam}</Code>
            </Text>
            <Button size="xs" variant="light" onClick={() => saoChep(thongTin.mat_khau_tam)}>
              Sao chép
            </Button>
          </Group>
          <Text fz="xs" c="dimmed">
            Người dùng sẽ được yêu cầu đổi mật khẩu ở lần đăng nhập đầu tiên.
          </Text>
          <Group justify="flex-end" mt="xs">
            <Button
              variant="light"
              onClick={() =>
                saoChep(`Tài khoản: ${thongTin.ten_dang_nhap} / Mật khẩu: ${thongTin.mat_khau_tam}`)
              }
            >
              Sao chép cả hai
            </Button>
            <Button onClick={onDong}>Đã lưu, đóng</Button>
          </Group>
        </Stack>
      )}
    </Modal>
  );
}
