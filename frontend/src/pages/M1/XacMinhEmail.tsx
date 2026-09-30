import { useEffect, useRef, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Anchor, Box, Container, Loader, Stack, Text, Title } from '@mantine/core';
import { useToi } from '@/auth/AuthContext';
import { xacMinhEmail } from '@/api/auth';
import { thongDiepLoiChung } from '@/lib/loiApi';
import { StatusBanner } from '@/components/StatusBanner';

const LIEN_KET_KHONG_HOP_LE = 'Liên kết không hợp lệ hoặc đã hết hạn';

type TrangThai = 'dang_xac_minh' | 'thanh_cong' | 'that_bai';

/**
 * M1 — Xác minh email (dac-ta bổ sung 2026-09-30). Công khai, ngoài RequireAuth. Đọc `token` từ query
 * string và tự động gọi POST /auth/xac-minh-email ngay khi vào trang (không cần bấm nút).
 */
export default function XacMinhEmail() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const { dangTai, daXacThuc } = useToi();

  const [trangThai, setTrangThai] = useState<TrangThai>('dang_xac_minh');
  const [loiChiTiet, setLoiChiTiet] = useState<string | null>(null);
  const daGoiRef = useRef(false);

  useEffect(() => {
    if (!token) {
      setTrangThai('that_bai');
      return;
    }
    if (daGoiRef.current) return;
    daGoiRef.current = true;

    xacMinhEmail(token)
      .then(() => setTrangThai('thanh_cong'))
      .catch((err) => {
        setLoiChiTiet(thongDiepLoiChung(err));
        setTrangThai('that_bai');
      });
  }, [token]);

  const dangDaXacThuc = !dangTai && daXacThuc;
  const dichThanhCong = dangDaXacThuc ? '/toi' : '/dang-nhap';
  const nhanThanhCong = dangDaXacThuc ? 'Về trang chủ' : 'Đăng nhập';
  const dichThatBai = dangDaXacThuc ? '/toi/ho-so' : '/dang-nhap';
  const nhanThatBai = dangDaXacThuc ? 'Về hồ sơ' : 'Đăng nhập';

  return (
    <Box style={{ display: 'flex', minHeight: '100vh', alignItems: 'center' }} bg="white">
      <Container size="xs" py="xl" w="100%">
        <Stack gap="lg">
          <Title order={1} size="h2">
            Xác minh email
          </Title>

          {trangThai === 'dang_xac_minh' && (
            <Stack align="center" gap="sm" py="xl">
              <Loader />
              <Text size="sm" c="dimmed">
                Đang xác minh email...
              </Text>
            </Stack>
          )}

          {trangThai === 'thanh_cong' && (
            <>
              <StatusBanner loai="success">Đã xác minh email thành công.</StatusBanner>
              <Anchor component={Link} to={dichThanhCong} size="sm">
                {nhanThanhCong}
              </Anchor>
            </>
          )}

          {trangThai === 'that_bai' && (
            <>
              <StatusBanner loai="error">{token ? loiChiTiet ?? LIEN_KET_KHONG_HOP_LE : LIEN_KET_KHONG_HOP_LE}</StatusBanner>
              <Text size="sm" c="dimmed">
                Link có thể đã hết hạn, vui lòng vào Hồ sơ và bấm "Gửi lại email xác minh".
              </Text>
              <Anchor component={Link} to={dichThatBai} size="sm">
                {nhanThatBai}
              </Anchor>
            </>
          )}
        </Stack>
      </Container>
    </Box>
  );
}
