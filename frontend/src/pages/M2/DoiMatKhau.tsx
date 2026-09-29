import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Anchor, Box, Button, Container, Group, List, PasswordInput, Stack, Text, Title, ThemeIcon } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { doiMatKhau } from '@/api/auth';
import { useToi } from '@/auth/AuthContext';
import { useHoSoToi } from '@/api/hocVien';
import { dieuKienMatKhau, taoDoiMatKhauSchema, type DoiMatKhauForm } from '@/schemas/doiMatKhau';
import { thongDiepLoiChung, loiFieldsThanhMap } from '@/lib/loiApi';
import { trangChuTheoVaiTro } from '@/lib/trangChuTheoVaiTro';
import { StatusBanner } from '@/components/StatusBanner';

function ngaySinhDdmmyyyy(ngay?: number | null, thang?: number | null, nam?: number | null): string | undefined {
  if (!ngay || !thang || !nam) return undefined;
  return `${String(ngay).padStart(2, '0')}${String(thang).padStart(2, '0')}${nam}`;
}

function DongCheck({ dat, children }: { dat: boolean; children: string }) {
  return (
    <List.Item
      icon={
        <ThemeIcon color={dat ? 'green' : 'gray'} size={20} radius="xl" variant={dat ? 'filled' : 'light'}>
          {dat ? '✓' : '○'}
        </ThemeIcon>
      }
    >
      <Text size="sm" c={dat ? 'green.8' : 'dimmed'}>
        {children}
      </Text>
    </List.Item>
  );
}

/** M2 — buộc đổi mật khẩu lần đầu (dac-ta § M2). Không có TopBar (route ngoài ProtectedLayout) nên cần lối "Đăng xuất" riêng. */
export default function DoiMatKhau() {
  const { matKhauVuaDung, xacNhanDaDoiMatKhau, dangXuat, nguoiDung } = useToi();
  const { data: hoSo } = useHoSoToi();
  const navigate = useNavigate();
  const [dangDangXuat, setDangDangXuat] = useState(false);

  const coMatKhauCu = !!matKhauVuaDung;
  const ngaySinh = ngaySinhDdmmyyyy(hoSo?.ngay_sinh, hoSo?.thang_sinh, hoSo?.nam_sinh);

  const schema = useMemo(() => taoDoiMatKhauSchema(ngaySinh), [ngaySinh]);

  const {
    register,
    handleSubmit,
    watch,
    setError,
    formState: { errors },
  } = useForm<DoiMatKhauForm>({
    resolver: zodResolver(schema),
    defaultValues: { mat_khau_cu: matKhauVuaDung ?? '', mat_khau_moi: '', nhap_lai: '' },
  });

  const matKhauMoi = watch('mat_khau_moi');
  const matKhauCu = watch('mat_khau_cu');
  const nhapLai = watch('nhap_lai');
  const dieuKien = dieuKienMatKhau(matKhauMoi ?? '', matKhauCu ?? '', nhapLai ?? '', ngaySinh);

  const mutation = useMutation({
    mutationFn: ({ mat_khau_cu, mat_khau_moi }: DoiMatKhauForm) => doiMatKhau(mat_khau_cu, mat_khau_moi),
    onSuccess: () => {
      xacNhanDaDoiMatKhau();
      notifications.show({
        color: 'green',
        message: 'Đã đổi mật khẩu. Thầy/Cô ghi nhớ mật khẩu mới để đăng nhập lần sau.',
      });
      navigate(trangChuTheoVaiTro(nguoiDung?.vai_tro), { replace: true });
    },
    onError: (err) => {
      const fields = loiFieldsThanhMap(err);
      if (fields.mat_khau_cu) setError('mat_khau_cu', { message: fields.mat_khau_cu });
      if (fields.mat_khau_moi) setError('mat_khau_moi', { message: fields.mat_khau_moi });
    },
  });

  function onSubmit(values: DoiMatKhauForm) {
    mutation.mutate(values);
  }

  async function xuLyDangXuat() {
    setDangDangXuat(true);
    try {
      await dangXuat();
      navigate('/dang-nhap', { replace: true });
    } finally {
      setDangDangXuat(false);
    }
  }

  // Khi mat_khau_cu tự điền + ẩn (coMatKhauCu), không có ô để hiện lỗi field cho nó — đưa ra banner
  // chung thay vì để lỗi "biến mất" trong im lặng (vd. mật khẩu nhớ trong bộ nhớ đã lỗi thời).
  const fieldsLoi = mutation.isError ? loiFieldsThanhMap(mutation.error) : {};
  const loiChung = mutation.isError
    ? Object.keys(fieldsLoi).length === 0
      ? thongDiepLoiChung(mutation.error)
      : coMatKhauCu && fieldsLoi.mat_khau_cu
        ? fieldsLoi.mat_khau_cu
        : null
    : null;

  return (
    <Container size="xs" py="xl">
      <Stack gap="lg">
        <Group justify="space-between" align="flex-start">
          <Title order={1} size="h2">
            Đổi mật khẩu
          </Title>
          <Anchor component="button" type="button" size="sm" onClick={xuLyDangXuat} disabled={dangDangXuat}>
            Đăng xuất
          </Anchor>
        </Group>

        <Text c="dimmed" size="sm">
          Đây là lần đầu Thầy/Cô đăng nhập. Vui lòng đặt mật khẩu mới trước khi tiếp tục.
        </Text>

        {loiChung && <StatusBanner loai="error">{loiChung}</StatusBanner>}

        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <Stack gap="md">
            {!coMatKhauCu && (
              <PasswordInput
                label="Mật khẩu hiện tại"
                autoComplete="current-password"
                error={errors.mat_khau_cu?.message}
                {...register('mat_khau_cu')}
              />
            )}
            {coMatKhauCu && <input type="hidden" {...register('mat_khau_cu')} />}

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

            <Box>
              <List spacing={4} size="sm" center>
                <DongCheck dat={dieuKien.duDoDai}>Ít nhất 8 ký tự</DongCheck>
                <DongCheck dat={dieuKien.coChuVaSo}>Có chữ và số</DongCheck>
                <DongCheck dat={dieuKien.khacNgaySinh}>Khác ngày sinh</DongCheck>
                <DongCheck dat={dieuKien.haiOTrungNhau}>Hai ô mật khẩu mới trùng nhau</DongCheck>
              </List>
            </Box>

            <Button type="submit" size="lg" loading={mutation.isPending} fullWidth>
              Đổi mật khẩu
            </Button>
          </Stack>
        </form>
      </Stack>
    </Container>
  );
}
