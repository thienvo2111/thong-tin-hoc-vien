import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Anchor, Box, Button, Container, PasswordInput, Stack, Text, Title } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { datLaiMatKhau } from '@/api/auth';
import { datLaiMatKhauSchema, type DatLaiMatKhauForm } from '@/schemas/datLaiMatKhau';
import { thongDiepLoiChung, loiFieldsThanhMap } from '@/lib/loiApi';
import { StatusBanner } from '@/components/StatusBanner';

const LIEN_KET_KHONG_HOP_LE = 'Liên kết không hợp lệ hoặc đã hết hạn';

/** M1 — Đặt lại mật khẩu (dac-ta bổ sung 2026-09-30). Công khai, ngoài RequireAuth. Đọc `token` từ query string. */
export default function DatLaiMatKhau() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();
  const [loiToken, setLoiToken] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<DatLaiMatKhauForm>({
    resolver: zodResolver(datLaiMatKhauSchema),
    defaultValues: { mat_khau_moi: '', nhap_lai: '' },
  });

  const mutation = useMutation({
    mutationFn: ({ mat_khau_moi }: DatLaiMatKhauForm) => datLaiMatKhau(token ?? '', mat_khau_moi),
    onSuccess: () => {
      notifications.show({ color: 'green', message: 'Đã đặt lại mật khẩu. Thầy/Cô đăng nhập lại bằng mật khẩu mới.' });
      navigate('/dang-nhap', { replace: true });
    },
    onError: (err) => {
      const fields = loiFieldsThanhMap(err);
      if (Object.keys(fields).length > 0) {
        if (fields.mat_khau_moi) setError('mat_khau_moi', { message: fields.mat_khau_moi });
      } else {
        setLoiToken(thongDiepLoiChung(err));
      }
    },
  });

  function onSubmit(values: DatLaiMatKhauForm) {
    setLoiToken(null);
    mutation.mutate(values);
  }

  const khongCoToken = !token;

  return (
    <Box style={{ display: 'flex', minHeight: '100vh', alignItems: 'center' }} bg="white">
      <Container size="xs" py="xl" w="100%">
        <Stack gap="lg">
          <Title order={1} size="h2">
            Đặt lại mật khẩu
          </Title>

          {(khongCoToken || loiToken) && (
            <StatusBanner loai="error">{khongCoToken ? LIEN_KET_KHONG_HOP_LE : loiToken}</StatusBanner>
          )}

          {khongCoToken ? (
            <Anchor component={Link} to="/quen-mat-khau" size="sm">
              Yêu cầu liên kết mới
            </Anchor>
          ) : (
            <>
              <Text size="sm" c="dimmed">
                Nhập mật khẩu mới cho tài khoản của Thầy/Cô.
              </Text>
              <form onSubmit={handleSubmit(onSubmit)} noValidate>
                <Stack gap="md">
                  <PasswordInput
                    label="Mật khẩu mới"
                    autoComplete="new-password"
                    error={errors.mat_khau_moi?.message}
                    {...register('mat_khau_moi')}
                  />
                  <PasswordInput
                    label="Nhập lại mật khẩu mới"
                    autoComplete="new-password"
                    error={errors.nhap_lai?.message}
                    {...register('nhap_lai')}
                  />
                  <Button type="submit" size="lg" loading={mutation.isPending} fullWidth>
                    Đặt lại mật khẩu
                  </Button>
                </Stack>
              </form>
              {loiToken && (
                <Anchor component={Link} to="/quen-mat-khau" size="sm">
                  Yêu cầu liên kết mới
                </Anchor>
              )}
            </>
          )}
        </Stack>
      </Container>
    </Box>
  );
}
