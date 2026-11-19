import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Alert, Button, Modal, Stack, TextInput } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useTaoTruong } from '@/api/danhMuc';
import { SelectDiaDanh } from '@/components/SelectDiaDanh';
import { SelectDonViTimKiem } from '@/components/SelectDonViTimKiem';
import { loiFieldsThanhMap, thongDiepLoiXungDot } from '@/lib/loiApi';
import { themTruongSchema, type ThemTruongForm } from '@/schemas/themTruong';

const FORM_RONG: ThemTruongForm = {
  ten_don_vi: '',
  ma_don_vi: '',
  tinh_id: null,
  dia_ban_id: null,
  don_vi_cha_id: null,
};

/** Thêm trường còn thiếu trong danh mục (issue #57, ADR 0015 T7) — chỉ quan_tri (nơi gọi tự ẩn nút). */
export function ModalThemTruong({ opened, onClose }: { opened: boolean; onClose: () => void }) {
  const tao = useTaoTruong();
  const [loiChung, setLoiChung] = useState<string | null>(null);
  const {
    register,
    control,
    handleSubmit,
    reset,
    setError,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ThemTruongForm>({ resolver: zodResolver(themTruongSchema), defaultValues: FORM_RONG });
  const tinhId = watch('tinh_id');

  useEffect(() => {
    if (!opened) return;
    reset(FORM_RONG);
    setLoiChung(null);
  }, [opened, reset]);

  function onSubmit(v: ThemTruongForm) {
    setLoiChung(null);
    tao.mutate(
      {
        ten_don_vi: v.ten_don_vi,
        ...(v.ma_don_vi ? { ma_don_vi: v.ma_don_vi } : {}),
        dia_ban_id: v.dia_ban_id as string,
        don_vi_cha_id: v.don_vi_cha_id as string,
      },
      {
        onSuccess: () => {
          notifications.show({ color: 'green', message: `Đã thêm trường "${v.ten_don_vi}"` });
          onClose();
        },
        onError: (err) => {
          setLoiChung(thongDiepLoiXungDot(err));
          for (const [field, message] of Object.entries(loiFieldsThanhMap(err))) {
            if (field in FORM_RONG) setError(field as keyof ThemTruongForm, { message });
          }
        },
      },
    );
  }

  return (
    <Modal opened={opened} onClose={onClose} title="Thêm trường" centered>
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <Stack gap="sm">
          {loiChung && (
            <Alert color="red" role="alert">
              {loiChung}
            </Alert>
          )}
          <TextInput label="Tên trường" required {...register('ten_don_vi')} error={errors.ten_don_vi?.message} />
          <TextInput
            label="Mã đơn vị"
            description="Không bắt buộc. Mã trường theo CSDL ngành, không trùng mã đã có."
            {...register('ma_don_vi')}
            error={errors.ma_don_vi?.message}
          />
          <Controller
            control={control}
            name="tinh_id"
            render={({ field }) => (
              <SelectDiaDanh
                label="Tỉnh/thành"
                cap="tinh_thanh"
                phienBan="hien_tai"
                value={field.value}
                onChange={(id) => {
                  field.onChange(id);
                  setValue('dia_ban_id', null);
                }}
                error={errors.tinh_id?.message}
                required
              />
            )}
          />
          <Controller
            control={control}
            name="dia_ban_id"
            render={({ field }) => (
              <SelectDiaDanh
                label="Phường/xã"
                cap="phuong_xa_dac_khu"
                phienBan="hien_tai"
                parentId={tinhId}
                value={field.value}
                onChange={field.onChange}
                error={errors.dia_ban_id?.message}
                required
              />
            )}
          />
          <Controller
            control={control}
            name="don_vi_cha_id"
            render={({ field }) => (
              <SelectDonViTimKiem
                label="Đơn vị quản lý (Sở/Phòng)"
                placeholder="Gõ tên Sở GD&ĐT hoặc Phòng VHXH"
                loaiDonVi={['so_gddt', 'phong_vhxh']}
                value={field.value}
                onChange={(id) => field.onChange(id)}
                error={errors.don_vi_cha_id?.message}
                required
              />
            )}
          />
          <Button type="submit" mt="sm" loading={tao.isPending} fullWidth>
            Thêm trường
          </Button>
        </Stack>
      </form>
    </Modal>
  );
}
