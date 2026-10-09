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
import { EMAIL_HO_TRO } from '@/content/hoTro';
import { StatusBanner } from '@/components/StatusBanner';
import { trangChuTheoVaiTro } from '@/lib/trangChuTheoVaiTro';
import { docKieuDangNhapDaLuu, luuKieuDangNhap, nhapTheoKieu, type KieuDangNhap } from '@/lib/kieuDangNhap';
import { ChonKieuDangNhap } from '@/components/ChonKieuDangNhap';
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
  const [kieuBanDau] = useState(docKieuDangNhapDaLuu);

  const {
    register,
    handleSubmit,
    setValue,
    clearErrors,
    watch,
    formState: { errors },
  } = useForm<DangNhapForm>({
    resolver: zodResolver(dangNhapSchema),
    defaultValues: { kieu_dang_nhap: kieuBanDau, ten_dang_nhap: '', mat_khau: '' },
  });
  const kieu = watch('kieu_dang_nhap');

  const mutation = useMutation({
    mutationFn: ({ ten_dang_nhap, mat_khau, kieu_dang_nhap }: DangNhapForm) =>
      dangNhap(ten_dang_nhap, mat_khau, kieu_dang_nhap),
    onSuccess: ({ phaiDoiMatKhau, vaiTro }) => {
      navigate(phaiDoiMatKhau ? '/doi-mat-khau' : trangChuTheoVaiTro(vaiTro), { replace: true });
    },
  });

  function doiKieu(moi: KieuDangNhap) {
    setValue('kieu_dang_nhap', moi);
    luuKieuDangNhap(moi);
    clearErrors('ten_dang_nhap');
    mutation.reset();
  }

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
      : kieu === 'sdt'
        ? 'Số điện thoại hoặc mật khẩu không đúng'
        : 'Mã định danh hoặc mật khẩu không đúng'
    : null;
  // Học viên đã đổi mật khẩu thường gõ lại ngày sinh rồi bấm liên tục tới 429
  // (2026-10-07) — nhắc nguyên nhân thật cho sai mật khẩu và 429, không cho 423
  // (thông báo khóa đã có giờ mở khóa riêng).
  const hienGoiYMatKhau =
    mutation.isError && !(mutation.error instanceof ApiError && mutation.error.code === 'ACCOUNT_LOCKED');

  // Spec 2026-10-09 Q-C: sai thông tin (401) → gợi ý thử chế độ còn lại.
  const hienGoiYCheo = mutation.error instanceof ApiError && mutation.error.status === 401;

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

            <Anchor component={Link} to="/huong-dan#dang-nhap" size="sm">
              Lần đầu sử dụng? Xem hướng dẫn từng bước có hình minh họa
            </Anchor>

            {loiChung && (
              <StatusBanner loai="error">
                <Text size="sm">{loiChung}</Text>
                {hienGoiYMatKhau && (
                  <Text size="sm" mt={4}>
                    Nếu Thầy/Cô đã từng đổi mật khẩu, ngày sinh không còn dùng được. Bấm "Quên mật khẩu?" hoặc liên hệ
                    nhóm Zalo hỗ trợ của trường.
                  </Text>
                )}
                {hienGoiYCheo && (
                  <Text size="sm" mt={4}>
                    {kieu === 'sdt'
                      ? "Nếu số điện thoại dùng chung với người khác hoặc đã thay đổi, hãy chọn 'Mã định danh MOET'."
                      : "Thử chọn 'Số điện thoại' nếu Thầy/Cô không nhớ mã định danh."}
                  </Text>
                )}
              </StatusBanner>
            )}

            <form onSubmit={handleSubmit(onSubmit)} noValidate>
              <Stack gap="md">
                <ChonKieuDangNhap value={kieu} onChange={doiKieu} />

                <TextInput
                  {...nhapTheoKieu(kieu)}
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
                    Tài khoản được tạo sẵn từ danh sách học viên; chưa có tên trong danh sách thì chưa đăng nhập được.
                    Thầy/Cô liên hệ bộ phận phụ trách của nhà trường, hoặc gửi email tới{' '}
                    <Anchor href={`mailto:${EMAIL_HO_TRO}`} size="sm">
                      {EMAIL_HO_TRO}
                    </Anchor>
                  </StatusBanner>
                </Collapse>

                <Anchor component={Link} to="/huong-dan#phu-luc-zalo" size="sm" ta="center">
                  Tra cứu nhóm Zalo hỗ trợ theo trường
                </Anchor>
              </Stack>
            </form>
          </Stack>
        </Container>
      </Box>
    </Box>
  );
}
