import { useState } from 'react';
import {
  Badge,
  Button,
  Center,
  Container,
  Group,
  Loader,
  Select,
  Stack,
  Text,
  Textarea,
  Title,
} from '@mantine/core';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useLoaiVanDeHoTro } from '@/api/danhMuc';
import {
  useDanhGiaYeuCauHoTro,
  useDanhSachYeuCauHoTroCuaToi,
  useDongYeuCauHoTro,
  useTaoYeuCauHoTro,
} from '@/api/yeuCauHoTro';
import type { TrangThaiYeuCauHoTro } from '@/api/types';
import { taoYeuCauHoTroSchema, type TaoYeuCauHoTroForm } from '@/schemas/yeuCauHoTro';
import { StatusBanner } from '@/components/StatusBanner';
import { thongDiepLoiChung } from '@/lib/loiApi';

const MAU_TRANG_THAI: Record<TrangThaiYeuCauHoTro, string> = {
  cho_xu_ly: 'yellow',
  da_phan_hoi: 'blue',
  da_dong: 'gray',
};

const NHAN_TRANG_THAI: Record<TrangThaiYeuCauHoTro, string> = {
  cho_xu_ly: 'Đang chờ xử lý',
  da_phan_hoi: 'Đã có trả lời',
  da_dong: 'Đã đóng',
};

/** M8 — Yêu cầu hỗ trợ: gợi ý FAQ theo loại vấn đề, học viên gửi ticket nếu gợi ý chưa giải quyết được. */
export default function YeuCauHoTroPage() {
  return (
    <Container size="sm" py="xl">
      <Stack gap="lg">
        <Title order={1} size="h2">
          Yêu cầu hỗ trợ
        </Title>
        <FormTaoTicket />
        <DanhSachCuaToi />
      </Stack>
    </Container>
  );
}

function FormTaoTicket() {
  const { data: loaiVanDe, isLoading } = useLoaiVanDeHoTro();
  const taoTicket = useTaoYeuCauHoTro();
  const [hienFormGui, setHienFormGui] = useState(false);
  const {
    control,
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<TaoYeuCauHoTroForm>({
    resolver: zodResolver(taoYeuCauHoTroSchema),
    defaultValues: { loai_van_de_id: '', noi_dung_hoi: '' },
  });

  if (isLoading) return <Loader />;

  const loaiVanDeId = watch('loai_van_de_id');
  const loaiChon = loaiVanDe?.data.find((l) => l.id === loaiVanDeId);

  function guiTicket(values: TaoYeuCauHoTroForm) {
    taoTicket.mutate(values, {
      onSuccess: () => {
        reset();
        setHienFormGui(false);
      },
    });
  }

  return (
    <Stack gap="md">
      <Controller
        name="loai_van_de_id"
        control={control}
        render={({ field }) => (
          <Select
            label="Loại vấn đề"
            placeholder="Chọn loại vấn đề cần hỗ trợ"
            data={(loaiVanDe?.data ?? []).map((l) => ({ value: l.id, label: l.ten }))}
            value={field.value || null}
            onChange={(v) => {
              field.onChange(v ?? '');
              setHienFormGui(false);
            }}
            error={errors.loai_van_de_id?.message}
          />
        )}
      />

      {loaiChon && (
        <StatusBanner loai="info" tieuDe="Gợi ý">
          {loaiChon.noi_dung_goi_y}
        </StatusBanner>
      )}

      {loaiChon && !hienFormGui && (
        <Button variant="default" onClick={() => setHienFormGui(true)}>
          Vẫn cần hỗ trợ, gửi yêu cầu
        </Button>
      )}

      {loaiChon && hienFormGui && (
        <form onSubmit={handleSubmit(guiTicket)} noValidate>
          <Stack gap="sm">
            <Textarea
              label="Nội dung cần hỗ trợ"
              minRows={3}
              error={errors.noi_dung_hoi?.message}
              {...register('noi_dung_hoi')}
            />
            {taoTicket.isError && (
              <StatusBanner loai="error">{thongDiepLoiChung(taoTicket.error)}</StatusBanner>
            )}
            <Button type="submit" loading={taoTicket.isPending}>
              Gửi yêu cầu
            </Button>
          </Stack>
        </form>
      )}
    </Stack>
  );
}

function DanhSachCuaToi() {
  const { data, isLoading, isError, error } = useDanhSachYeuCauHoTroCuaToi();
  const dong = useDongYeuCauHoTro();
  const danhGia = useDanhGiaYeuCauHoTro();

  if (isLoading) {
    return (
      <Center py="lg">
        <Loader />
      </Center>
    );
  }
  if (isError) return <StatusBanner loai="error">{thongDiepLoiChung(error)}</StatusBanner>;
  if (!data || data.length === 0) return null;

  return (
    <Stack gap="sm">
      <Title order={2} size="h4">
        Yêu cầu của tôi
      </Title>
      {data.map((yc) => (
        <Stack
          key={yc.id}
          gap={6}
          p="sm"
          style={{ border: '1px solid var(--mantine-color-gray-3)', borderRadius: 8 }}
        >
          <Group justify="space-between">
            <Text fw={600}>{yc.loai_van_de_ten}</Text>
            <Badge color={MAU_TRANG_THAI[yc.trang_thai]}>{NHAN_TRANG_THAI[yc.trang_thai]}</Badge>
          </Group>
          <Text size="sm">{yc.noi_dung_hoi}</Text>
          {yc.noi_dung_tra_loi && (
            <Text size="sm" c="dimmed">
              <b>Trả lời:</b> {yc.noi_dung_tra_loi}
            </Text>
          )}
          {yc.trang_thai === 'da_phan_hoi' && (
            <Group gap="xs">
              <Button size="xs" variant="light" onClick={() => dong.mutate(yc.id)}>
                Đã giải quyết
              </Button>
              {!yc.danh_gia && (
                <>
                  <Button
                    size="xs"
                    variant="subtle"
                    onClick={() => danhGia.mutate({ id: yc.id, danh_gia: 'hai_long' })}
                  >
                    👍 Hài lòng
                  </Button>
                  <Button
                    size="xs"
                    variant="subtle"
                    onClick={() => danhGia.mutate({ id: yc.id, danh_gia: 'chua_hai_long' })}
                  >
                    👎 Chưa hài lòng
                  </Button>
                </>
              )}
            </Group>
          )}
        </Stack>
      ))}
    </Stack>
  );
}
