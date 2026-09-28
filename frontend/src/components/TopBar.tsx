import { Group, Text, Button, Container } from '@mantine/core';
import { useNavigate } from 'react-router-dom';
import { useToi } from '@/auth/AuthContext';
import { useHoSoToi } from '@/api/hocVien';

/** Thanh trên mọi màn hình sau đăng nhập — tên học viên, Đăng xuất, liên hệ hỗ trợ (dac-ta § "Route"). */
export function TopBar() {
  const { dangXuat } = useToi();
  const navigate = useNavigate();
  const { data: hoSo } = useHoSoToi();
  const hoTro = import.meta.env.VITE_HOTRO_LIEN_HE;

  async function xuLyDangXuat() {
    await dangXuat();
    navigate('/dang-nhap', { replace: true });
  }

  return (
    <Container size="sm" py="xs" component="header">
      <Group justify="space-between" wrap="nowrap">
        <Text fw={600} truncate>
          {hoSo?.ho_ten ?? 'Thầy/Cô'}
        </Text>
        <Group gap="xs" wrap="nowrap">
          {hoTro && (
            <Text size="sm" c="dimmed" visibleFrom="xs">
              Hỗ trợ: {hoTro}
            </Text>
          )}
          <Button variant="subtle" size="xs" onClick={xuLyDangXuat}>
            Đăng xuất
          </Button>
        </Group>
      </Group>
    </Container>
  );
}
