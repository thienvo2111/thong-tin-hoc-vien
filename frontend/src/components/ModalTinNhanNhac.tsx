import { useRef } from 'react';
import { Alert, Badge, Button, Group, Modal, Skeleton, Stack, Text, Textarea } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { NHAN_NHAC, type TrangThaiNhac } from '@/api/nhacLich';
import { dinhDangNgayGio } from '@/lib/ngay';

/**
 * Hộp thoại tin nhắn nhắc lịch (ADR 0004 G10): nội dung soạn sẵn + "Sao chép" + "Đã gửi".
 * Hệ thống KHÔNG tự gửi — cán bộ dán vào Zalo/SMS rồi bấm "Đã gửi" để ghi nhật ký.
 */
export function ModalTinNhanNhac({
  opened,
  onClose,
  tieuDe,
  dangTai,
  loi,
  noiDung,
  trangThai,
  lanGuiCuoi,
  dangGui,
  onDaGui,
  children,
}: {
  opened: boolean;
  onClose: () => void;
  tieuDe: string;
  dangTai: boolean;
  loi?: string | null;
  noiDung: string | null | undefined;
  trangThai: TrangThaiNhac | null | undefined;
  lanGuiCuoi?: { gui_luc: string; nguoi_gui: string | null } | null;
  dangGui: boolean;
  onDaGui: () => void;
  children?: React.ReactNode;
}) {
  const oNhap = useRef<HTMLTextAreaElement>(null);

  async function saoChep() {
    if (!noiDung) return;
    try {
      await navigator.clipboard.writeText(noiDung);
      notifications.show({ color: 'green', message: 'Đã sao chép tin nhắn' });
    } catch {
      oNhap.current?.select();
      notifications.show({ color: 'yellow', message: 'Không sao chép tự động được — hãy bôi đen nội dung và sao chép' });
    }
  }

  return (
    <Modal opened={opened} onClose={onClose} title={tieuDe} size="lg" centered>
      <Stack gap="sm">
        {children}
        {dangTai && <Skeleton height={160} />}
        {loi && <Alert color="red">{loi}</Alert>}
        {!dangTai && !loi && !noiDung && (
          <Text c="dimmed" fz="sm">
            Không có buổi học nào để nhắc.
          </Text>
        )}
        {noiDung && (
          <>
            <Group gap="xs">
              {trangThai && (
                <Badge variant="light" color={NHAN_NHAC[trangThai].mau}>
                  {NHAN_NHAC[trangThai].nhan}
                </Badge>
              )}
              {lanGuiCuoi && (
                <Text fz="xs" c="dimmed">
                  Lần gửi cuối {dinhDangNgayGio(lanGuiCuoi.gui_luc)}
                  {lanGuiCuoi.nguoi_gui ? ` · ${lanGuiCuoi.nguoi_gui}` : ''}
                </Text>
              )}
            </Group>
            <Textarea ref={oNhap} label="Nội dung tin nhắn" value={noiDung} readOnly autosize minRows={6} maxRows={16} />
            <Text fz="xs" c="dimmed">
              Sao chép, gửi qua Zalo/SMS, rồi bấm "Đã gửi" để hệ thống ghi nhận. Nếu lịch đổi sau đó, buổi sẽ hiện "Cần
              nhắc lại".
            </Text>
            <Group justify="flex-end">
              <Button variant="default" onClick={saoChep}>
                Sao chép
              </Button>
              <Button onClick={onDaGui} loading={dangGui}>
                Đã gửi
              </Button>
            </Group>
          </>
        )}
      </Stack>
    </Modal>
  );
}
