import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import {
  Anchor,
  Box,
  Button,
  Container,
  Group,
  Image,
  PasswordInput,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { ApiError } from '@/api/client';
import { useToi } from '@/auth/AuthContext';
import { StatusBanner } from '@/components/StatusBanner';
import { ThongBaoSaiCong } from '@/components/ThongBaoSaiCong';
import { congDonVi } from '@/content/congDonVi';
import { vaiTroDungCong } from '@/lib/congHienTai';
import { thongDiepLoiChung } from '@/lib/loiApi';
import { dangNhapCongDonViSchema, type DangNhapCongDonViForm } from '@/schemas/dangNhapCongDonVi';
import logoHcmue from '@/assets/logo-hcmue.png';
import { useTieuDeCongDonVi } from './useTieuDeCongDonVi';

const MA_LOI_CO_THONG_DIEP_RIENG = ['ACCOUNT_LOCKED', 'TOO_MANY_REQUESTS'];

/** Đăng nhập Cổng đơn vị (issue #55): tài khoản HCMUE cấp cho trường/Sở/Phòng và quản trị. */
export default function DangNhapCongDonVi() {
  useTieuDeCongDonVi();
  const { dangNhap, dangXuat } = useToi();
  const navigate = useNavigate();
  const [saiCong, setSaiCong] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<DangNhapCongDonViForm>({
    resolver: zodResolver(dangNhapCongDonViSchema),
    defaultValues: { ten_dang_nhap: '', mat_khau: '' },
  });

  const mutation = useMutation({
    mutationFn: ({ ten_dang_nhap, mat_khau }: DangNhapCongDonViForm) => dangNhap(ten_dang_nhap, mat_khau, 'ma'),
    onSuccess: ({ phaiDoiMatKhau, vaiTro }) => {
      // Đang đứng ở Cổng đơn vị nên coi như đã cấu hình; sai cổng → báo + link, không chuyển hướng (ADR 0015 P3).
      if (!vaiTroDungCong(vaiTro, 'don_vi', true)) {
        setSaiCong(true);
        void dangXuat().catch(() => undefined);
        return;
      }
      navigate(phaiDoiMatKhau ? '/doi-mat-khau' : '/trang-chu', { replace: true });
    },
  });

  function onSubmit(values: DangNhapCongDonViForm) {
    setSaiCong(false);
    mutation.mutate(values);
  }

  const loiChung = mutation.isError
    ? mutation.error instanceof ApiError && MA_LOI_CO_THONG_DIEP_RIENG.includes(mutation.error.code)
      ? thongDiepLoiChung(mutation.error)
      : 'Tên tài khoản hoặc mật khẩu không đúng'
    : null;

  return (
    <Box mih="100vh" bg="white" style={{ display: 'flex', alignItems: 'center' }}>
      <Container size="xs" py="xl" w="100%">
        <Stack gap="lg">
          <Group gap="sm" wrap="nowrap">
            <Image src={logoHcmue} alt="Trường Đại học Sư phạm Thành phố Hồ Chí Minh" h={40} w="auto" fit="contain" />
            <Title order={1} size="h3">
              {congDonVi.tenCong}
            </Title>
          </Group>

          <Text size="sm" c="dimmed">
            {congDonVi.thongDiep}
          </Text>

          <Anchor component={Link} to="/huong-dan" size="sm">
            Hướng dẫn sử dụng Cổng đơn vị
          </Anchor>

          {saiCong && <ThongBaoSaiCong congDung="nls" />}

          {loiChung && (
            <StatusBanner loai="error">
              <Text size="sm">{loiChung}</Text>
            </StatusBanner>
          )}

          <form onSubmit={handleSubmit(onSubmit)} noValidate>
            <Stack gap="md">
              <TextInput
                label="Tên tài khoản"
                size="md"
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                error={errors.ten_dang_nhap?.message}
                {...register('ten_dang_nhap')}
              />
              <PasswordInput
                label="Mật khẩu"
                size="md"
                autoComplete="current-password"
                error={errors.mat_khau?.message}
                {...register('mat_khau')}
              />
              <Button type="submit" size="lg" loading={mutation.isPending} fullWidth>
                Đăng nhập
              </Button>
              <Text size="sm" c="dimmed" ta="center">
                Quên mật khẩu? Liên hệ HCMUE: {congDonVi.soDienThoaiHoTro}
              </Text>
            </Stack>
          </form>
        </Stack>
      </Container>
    </Box>
  );
}
