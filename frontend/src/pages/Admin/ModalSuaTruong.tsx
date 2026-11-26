import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Alert, Button, Modal, Stack, Text, TextInput } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useSuaThongTinDonViCongTac, type SuaThongTinTruongDto } from '@/api/danhMuc';
import type { DonViCongTac } from '@/api/types';
import { loiFieldsThanhMap, thongDiepLoiXungDot } from '@/lib/loiApi';
import { chuanHoaNfc } from '@/lib/nfc';
import { suaTruongSchema, type SuaTruongForm } from '@/schemas/suaTruong';

const chuanHoa = (s: string | null | undefined) => chuanHoaNfc(s ?? '').trim();

/** Chỉ giữ field khác giá trị gốc (so sau NFC + trim) — PATCH không đụng field không đổi. */
function layThayDoi(goc: DonViCongTac, v: SuaTruongForm): SuaThongTinTruongDto {
  const ra: SuaThongTinTruongDto = {};
  if (chuanHoa(v.ma_don_vi) !== chuanHoa(goc.ma_don_vi)) ra.ma_don_vi = chuanHoa(v.ma_don_vi);
  if (chuanHoa(v.ten_don_vi) !== chuanHoa(goc.ten_don_vi)) ra.ten_don_vi = chuanHoa(v.ten_don_vi);
  return ra;
}

/** Bổ sung/sửa mã và tên trường — chỉ quan_tri (PATCH @Roles quan_tri; nơi gọi tự ẩn nút). */
export function ModalSuaTruong({ truong, onClose }: { truong: DonViCongTac | null; onClose: () => void }) {
  const sua = useSuaThongTinDonViCongTac();
  const [loiChung, setLoiChung] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    setError,
    watch,
    formState: { errors },
  } = useForm<SuaTruongForm>({
    resolver: zodResolver(suaTruongSchema),
    defaultValues: { ma_don_vi: '', ten_don_vi: '' },
  });

  useEffect(() => {
    if (!truong) return;
    reset({ ma_don_vi: truong.ma_don_vi ?? '', ten_don_vi: truong.ten_don_vi });
    setLoiChung(null);
  }, [truong, reset]);

  const giaTri = watch();
  const coThayDoi = !!truong && Object.keys(layThayDoi(truong, giaTri)).length > 0;

  function onSubmit(v: SuaTruongForm) {
    if (!truong) return;
    const thayDoi = layThayDoi(truong, v);
    if (Object.keys(thayDoi).length === 0) return;
    setLoiChung(null);
    sua.mutate(
      { id: truong.id, thayDoi },
      {
        onSuccess: () => {
          notifications.show({ color: 'green', message: 'Đã cập nhật trường' });
          onClose();
        },
        onError: (err) => {
          setLoiChung(thongDiepLoiXungDot(err));
          for (const [field, message] of Object.entries(loiFieldsThanhMap(err))) {
            if (field === 'ma_don_vi' || field === 'ten_don_vi') setError(field, { message });
          }
        },
      },
    );
  }

  return (
    <Modal opened={truong !== null} onClose={onClose} title="Sửa trường" centered>
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <Stack gap="sm">
          {loiChung && (
            <Alert color="red" role="alert">
              {loiChung}
            </Alert>
          )}
          <TextInput
            label="Mã đơn vị"
            description="Dùng làm tên đăng nhập của tài khoản trường (viết thường)"
            required
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            {...register('ma_don_vi')}
            error={errors.ma_don_vi?.message}
          />
          <TextInput label="Tên trường" required {...register('ten_don_vi')} error={errors.ten_don_vi?.message} />
          <Text fz={13} c="dimmed">
            Đổi mã không đổi tên đăng nhập của tài khoản trường đã cấp — sửa tên đăng nhập ở Đơn vị &amp; tài khoản nếu
            cần.
          </Text>
          <Button type="submit" mt="sm" loading={sua.isPending} disabled={!coThayDoi} fullWidth>
            Lưu
          </Button>
        </Stack>
      </form>
    </Modal>
  );
}
