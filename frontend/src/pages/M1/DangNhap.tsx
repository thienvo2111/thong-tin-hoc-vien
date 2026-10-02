import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { Anchor, Box, Button, Collapse, Container, Group, Image, PasswordInput, Stack, Text, TextInput, Title } from '@mantine/core';
import { ApiError } from '@/api/client';
import { useToi } from '@/auth/AuthContext';
import { dangNhapSchema, type DangNhapForm } from '@/schemas/dangNhap';
import { thongDiepLoiChung } from '@/lib/loiApi';
import { gioiThieu } from '@/content/gioiThieu';
import { StatusBanner } from '@/components/StatusBanner';
import { trangChuTheoVaiTro } from '@/lib/trangChuTheoVaiTro';
import logoHcmue from '@/assets/logo-hcmue.png';

/** Panel giới thiệu — chỉ hiện ở màn hình rộng (>= sm); mobile chỉ hiện form đăng nhập. */
function PanelGioiThieu() {
  return (
    <Box
      visibleFrom="sm"
      w={{ sm: 320, md: 420 }}
      style={{
        flexShrink: 0,
        background: 'linear-gradient(160deg, var(--mantine-color-primary-6) 0%, var(--mantine-color-primary-8) 100%)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
      }}
      p={{ sm: 'xl', md: 48 }}
    >
      <Image src={logoHcmue} alt="Trường Đại học Sư phạm Thành phố Hồ Chí Minh" h={48} w="auto" fit="contain" />

      <Stack gap="md">
        <Text fw={700} fz="xs" c="accent.3" tt="uppercase" style={{ letterSpacing: '.14em' }}>
          Trường Đại học Sư phạm TP. Hồ Chí Minh
        </Text>
        <Title order={1} c="white" fz={{ sm: 28, md: 34 }} lh={1.25}>
          {gioiThieu.moDau.tenChuongTrinh}
        </Title>
        <Text c="gray.4" fz="sm" lh={1.6} maw={380}>
          {gioiThieu.moDau.thongDiep}
        </Text>
      </Stack>

      <Text fz="xs" c="gray.5">
        © {new Date().getFullYear()} HCMUE
      </Text>
    </Box>
  );
}

export default function DangNhap() {
  const { dangNhap } = useToi();
  const navigate = useNavigate();
  const [hienHuongDan, setHienHuongDan] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<DangNhapForm>({
    resolver: zodResolver(dangNhapSchema),
    defaultValues: { ten_dang_nhap: '', mat_khau: '' },
  });

  const mutation = useMutation({
    mutationFn: ({ ten_dang_nhap, mat_khau }: DangNhapForm) => dangNhap(ten_dang_nhap, mat_khau),
    onSuccess: ({ phaiDoiMatKhau, vaiTro }) => {
      navigate(phaiDoiMatKhau ? '/doi-mat-khau' : trangChuTheoVaiTro(vaiTro), { replace: true });
    },
  });

  function onSubmit(values: DangNhapForm) {
    mutation.mutate(values);
  }

  function xuLyDan(e: React.ClipboardEvent<HTMLInputElement>) {
    const text = e.clipboardData.getData('text');
    if (/\s/.test(text)) {
      e.preventDefault();
      setValue('ten_dang_nhap', text.replace(/\s+/g, ''), { shouldValidate: true });
    }
  }

  const maLoiCoThongDiepRieng = ['ACCOUNT_LOCKED', 'TOO_MANY_REQUESTS'];
  const loiChung = mutation.isError
    ? mutation.error instanceof ApiError && maLoiCoThongDiepRieng.includes(mutation.error.code)
      ? thongDiepLoiChung(mutation.error)
      : 'Mã định danh hoặc mật khẩu không đúng'
    : null;

  return (
    <Box style={{ display: 'flex', minHeight: '100vh' }} bg="white">
      <PanelGioiThieu />

      <Box style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
        <Container size="xs" py="xl" w="100%">
          <Stack gap="lg">
            <Group justify="center" gap="sm" wrap="nowrap" hiddenFrom="sm">
              <Image src={logoHcmue} alt="Trường Đại học Sư phạm Thành phố Hồ Chí Minh" h={40} w="auto" fit="contain" />
              <Title order={1} ta="center" size="h2">
                {gioiThieu.moDau.tenChuongTrinh}
              </Title>
            </Group>

            <Box visibleFrom="sm">
              <Title order={1} size="h2">
                Đăng nhập
              </Title>
              <Text size="sm" c="dimmed" mt={4}>
                Sử dụng mã định danh được cấp để truy cập hệ thống.
              </Text>
            </Box>

            {loiChung && <StatusBanner loai="error">{loiChung}</StatusBanner>}

            <form onSubmit={handleSubmit(onSubmit)} noValidate>
              <Stack gap="md">
                <TextInput
                  label="Mã định danh hoặc số CCCD"
                  description="Mã định danh CSDL ngành do nhà trường cung cấp, hoặc số CCCD nếu Thầy/Cô đã bổ sung vào hồ sơ"
                  inputMode="numeric"
                  autoComplete="username"
                  onPaste={xuLyDan}
                  error={errors.ten_dang_nhap?.message}
                  {...register('ten_dang_nhap')}
                />

                <Box>
                  <PasswordInput
                    label="Mật khẩu"
                    autoComplete="current-password"
                    error={errors.mat_khau?.message}
                    {...register('mat_khau')}
                  />
                  <Text size="xs" c="dimmed" mt={4}>
                    Lần đầu đăng nhập: mật khẩu là ngày sinh dạng ngày-tháng-năm viết liền, ví dụ 08121983.
                  </Text>
                </Box>

                <Anchor component={Link} to="/quen-mat-khau" size="sm" ta="right">
                  Quên mật khẩu?
                </Anchor>

                <Button type="submit" size="lg" loading={mutation.isPending} fullWidth>
                  Đăng nhập
                </Button>

                <Anchor component="button" type="button" size="sm" ta="center" onClick={() => setHienHuongDan((v) => !v)}>
                  Không biết mã định danh?
                </Anchor>
                <Collapse in={hienHuongDan}>
                  <StatusBanner loai="info">
                    Thầy/Cô liên hệ bộ phận phụ trách của nhà trường, hoặc số hỗ trợ:{' '}
                    {import.meta.env.VITE_HOTRO_LIEN_HE}
                  </StatusBanner>
                </Collapse>
              </Stack>
            </form>
          </Stack>
        </Container>
      </Box>
    </Box>
  );
}
