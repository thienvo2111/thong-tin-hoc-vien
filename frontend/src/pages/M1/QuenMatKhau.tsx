import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Anchor, Box, Button, Container, Stack, Text, TextInput, Title } from '@mantine/core';
import { quenMatKhau } from '@/api/auth';
import { quenMatKhauSchema, type QuenMatKhauForm } from '@/schemas/quenMatKhau';
import { thongDiepLoiChung } from '@/lib/loiApi';
import { StatusBanner } from '@/components/StatusBanner';
import { ChonKieuDangNhap } from '@/components/ChonKieuDangNhap';
import { docKieuDangNhapDaLuu, luuKieuDangNhap, nhapTheoKieu, type KieuDangNhap } from '@/lib/kieuDangNhap';

/**
 * M1 — Quên mật khẩu (dac-ta bổ sung 2026-09-30). Công khai, ngoài RequireAuth.
 * LUÔN hiện 1 thông báo thành công chung sau khi gửi — không phân biệt tài khoản có tồn tại, có phải
 * học viên, hay có email đã xác minh hay không (docs/api-contract.md § "Xác minh email liên hệ &
 * quên/đặt lại mật khẩu": không tiết lộ enumeration qua response).
 */
export default function QuenMatKhau() {
  const [kieuBanDau] = useState(docKieuDangNhapDaLuu);
  const {
    register,
    handleSubmit,
    setValue,
    clearErrors,
    watch,
    formState: { errors },
  } = useForm<QuenMatKhauForm>({
    resolver: zodResolver(quenMatKhauSchema),
    defaultValues: { kieu_dang_nhap: kieuBanDau, ten_dang_nhap: '' },
  });
  const kieu = watch('kieu_dang_nhap');

  const mutation = useMutation({
    mutationFn: ({ ten_dang_nhap, kieu_dang_nhap }: QuenMatKhauForm) => quenMatKhau(ten_dang_nhap, kieu_dang_nhap),
  });

  function doiKieu(moi: KieuDangNhap) {
    setValue('kieu_dang_nhap', moi);
    luuKieuDangNhap(moi);
    clearErrors('ten_dang_nhap');
  }

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
            Nhập mã định danh MOET hoặc số điện thoại đã cung cấp cho nhà trường. Nếu tài khoản hợp lệ và đã có email liên
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
                  <ChonKieuDangNhap nhan="Tìm tài khoản bằng" value={kieu} onChange={doiKieu} />
                  <TextInput
                    {...nhapTheoKieu(kieu)}
                    error={errors.ten_dang_nhap?.message}
                    {...register('ten_dang_nhap')}
                  />
                  <Button type="submit" size="lg" loading={mutation.isPending} fullWidth>
                    Gửi yêu cầu
                  </Button>
                  <Text size="sm" c="dimmed">
                    Chưa xác minh email? Liên hệ nhóm Zalo hỗ trợ của trường để được cấp mật khẩu tạm.
                  </Text>
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
