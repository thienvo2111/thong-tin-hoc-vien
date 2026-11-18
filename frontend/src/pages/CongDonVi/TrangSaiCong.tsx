import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Container, Stack, Title } from '@mantine/core';
import { useToi } from '@/auth/AuthContext';
import { ThongBaoSaiCong } from '@/components/ThongBaoSaiCong';
import { congHienTai } from '@/lib/congHienTai';

/** Đã đăng nhập nhưng vai trò không thuộc cổng hiện tại (ADR 0015 P3) — chỉ báo + link cổng đúng + Đăng xuất. */
export default function TrangSaiCong() {
  const { dangXuat } = useToi();
  const navigate = useNavigate();
  const [dangDangXuat, setDangDangXuat] = useState(false);
  const congDung = congHienTai() === 'don_vi' ? 'nls' : 'don_vi';

  async function xuLyDangXuat() {
    setDangDangXuat(true);
    try {
      await dangXuat();
    } finally {
      navigate('/dang-nhap', { replace: true });
    }
  }

  return (
    <Container size="xs" py="xl">
      <Stack gap="md">
        <Title order={1} size="h3">
          Không dùng được tài khoản ở trang này
        </Title>
        <ThongBaoSaiCong congDung={congDung} />
        <Button variant="default" onClick={xuLyDangXuat} loading={dangDangXuat}>
          Đăng xuất
        </Button>
      </Stack>
    </Container>
  );
}
