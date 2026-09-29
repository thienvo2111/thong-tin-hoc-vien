import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Anchor, Box, Button, Collapse, Container, Group, Image, PasswordInput, Stack, Text, TextInput, Title } from '@mantine/core';
import { ApiError } from '@/api/client';
import { useToi } from '@/auth/AuthContext';
import { dangNhapSchema, type DangNhapForm } from '@/schemas/dangNhap';
import { thongDiepLoiChung } from '@/lib/loiApi';
import { gioiThieu } from '@/content/gioiThieu';
import { StatusBanner } from '@/components/StatusBanner';
import logoHcmue from '@/assets/logo-hcmue.png';

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
    onSuccess: ({ phaiDoiMatKhau }) => {
      navigate(phaiDoiMatKhau ? '/doi-mat-khau' : '/toi', { replace: true });
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
    <Container size="xs" py="xl">
      <Stack gap="lg">
        <Group justify="center" gap="sm" wrap="nowrap">
          <Image src={logoHcmue} alt="Trường Đại học Sư phạm Thành phố Hồ Chí Minh" h={40} w="auto" fit="contain" />
          <Title order={1} ta="center" size="h2">
            {gioiThieu.moDau.tenChuongTrinh}
          </Title>
        </Group>

        {loiChung && <StatusBanner loai="error">{loiChung}</StatusBanner>}

        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <Stack gap="md">
            <TextInput
              label="Mã định danh"
              description="Mã định danh trên CSDL ngành do nhà trường cung cấp"
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
  );
}
