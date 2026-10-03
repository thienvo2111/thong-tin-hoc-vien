import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Anchor, Box, Button, Container, Stack, Text, TextInput, Title } from '@mantine/core';
import { quenMatKhau } from '@/api/auth';
import { quenMatKhauSchema, type QuenMatKhauForm } from '@/schemas/quenMatKhau';
import { thongDiepLoiChung } from '@/lib/loiApi';
import { StatusBanner } from '@/components/StatusBanner';

/**
 * M1 — Quên mật khẩu (dac-ta bổ sung 2026-09-30). Công khai, ngoài RequireAuth.
 * LUÔN hiện 1 thông báo thành công chung sau khi gửi — không phân biệt tài khoản có tồn tại, có phải
 * học viên, hay có email đã xác minh hay không (docs/api-contract.md § "Xác minh email liên hệ &
 * quên/đặt lại mật khẩu": không tiết lộ enumeration qua response).
 */
export default function QuenMatKhau() {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<QuenMatKhauForm>({
    resolver: zodResolver(quenMatKhauSchema),
    defaultValues: { ten_dang_nhap: '' },
  });

  const mutation = useMutation({
    mutationFn: ({ ten_dang_nhap }: QuenMatKhauForm) => quenMatKhau(ten_dang_nhap),
  });

  function onSubmit(values: QuenMatKhauForm) {
    mutation.mutate(values);
  }

  return (
    <Box style={{ display: 'flex', minHeight: '100vh', alignItems: 'center' }} bg="white">
      <Container size="xs" py="xl" w="100%">
        <Stack gap="lg">
          <Title order={1} size="h2">
            Quên mật khẩu
          </Title>
          <Text size="sm" c="dimmed">
            Nhập mã định danh hoặc số CCCD đã dùng để đăng nhập. Nếu tài khoản hợp lệ và đã có email liên
            hệ được xác minh, hệ thống sẽ gửi liên kết đặt lại mật khẩu qua email.
          </Text>

          {mutation.isSuccess ? (
            <StatusBanner loai="success">
              Nếu tài khoản hợp lệ và có email đã xác minh, Thầy/Cô sẽ nhận được email hướng dẫn đặt lại
              mật khẩu trong ít phút.
            </StatusBanner>
          ) : (
            <>
              {mutation.isError && <StatusBanner loai="error">{thongDiepLoiChung(mutation.error)}</StatusBanner>}
              <form onSubmit={handleSubmit(onSubmit)} noValidate>
                <Stack gap="md">
                  <TextInput
                    label="Tên đăng nhập, mã định danh hoặc số CCCD"
                    inputMode="numeric"
                    autoComplete="username"
                    error={errors.ten_dang_nhap?.message}
                    {...register('ten_dang_nhap')}
                  />
                  <Button type="submit" size="lg" loading={mutation.isPending} fullWidth>
                    Gửi yêu cầu
                  </Button>
                </Stack>
              </form>
            </>
          )}

          <Anchor component={Link} to="/dang-nhap" size="sm" ta="center">
            Quay lại đăng nhập
          </Anchor>
        </Stack>
      </Container>
    </Box>
  );
}
