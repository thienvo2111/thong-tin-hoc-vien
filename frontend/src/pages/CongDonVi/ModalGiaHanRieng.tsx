import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Alert, Button, Checkbox, Group, Modal, Stack, Text, Textarea } from '@mantine/core';
import { DateInput } from '@mantine/dates';
import 'dayjs/locale/vi';
import { notifications } from '@mantine/notifications';
import { useDatHanRieng } from '@/api/hopDong';
import type { DongTienDo } from '@/api/tienDoDot';
import { loiFieldsThanhMap, thongDiepLoiChung } from '@/lib/loiApi';
import { chuoiSangNgay, dinhDangNgayLich, docNgayGo, ngaySangChuoi } from '@/lib/ngayLich';
import { hanRiengSchema, type HanRiengForm } from '@/schemas/hanRieng';

interface Props {
  dotId: string;
  /** Trường đang gia hạn; null = đóng. */
  dong: DongTienDo | null;
  onClose: () => void;
}

function formTu(d: DongTienDo | null): HanRiengForm {
  return {
    bo_han_rieng: false,
    han_rieng: d?.han_rieng ? chuoiSangNgay(d.han_hieu_luc_ngay) : null,
    ly_do: '',
  };
}

/** Issue #66 / ADR 0015 T3: Quản trị gia hạn riêng 1 trường (lý do bắt buộc, nhật ký ở server); có hạn riêng thì
 * bỏ được ("Bỏ hạn riêng" → về hạn của đợt). Lỗi field của server gắn vào đúng ô. */
export function ModalGiaHanRieng({ dotId, dong, onClose }: Props) {
  const datHan = useDatHanRieng(dotId);
  const [loiChung, setLoiChung] = useState<string | null>(null);
  const {
    control,
    register,
    handleSubmit,
    reset,
    setError,
    watch,
    formState: { errors },
  } = useForm<HanRiengForm>({ resolver: zodResolver(hanRiengSchema), defaultValues: formTu(dong) });
  const boHanRieng = watch('bo_han_rieng');

  useEffect(() => {
    reset(formTu(dong));
    setLoiChung(null);
  }, [dong, reset]);

  function onSubmit(v: HanRiengForm) {
    if (!dong) return;
    setLoiChung(null);
    const han_rieng = v.bo_han_rieng || !v.han_rieng ? null : ngaySangChuoi(v.han_rieng);
    datHan.mutate(
      { donViId: dong.don_vi.id, han_rieng, ly_do: v.ly_do.normalize('NFC') },
      {
        onSuccess: (kq) => {
          notifications.show({
            color: 'green',
            message: han_rieng
              ? `Đã gia hạn riêng ${dong.don_vi.ten} đến ${dinhDangNgayLich(kq.han_hieu_luc_ngay)}`
              : `Đã bỏ hạn riêng của ${dong.don_vi.ten}`,
          });
          onClose();
        },
        onError: (err) => {
          const fields = loiFieldsThanhMap(err);
          let ganO = false;
          for (const k of ['han_rieng', 'ly_do'] as const) {
            if (fields[k]) {
              setError(k, { message: fields[k] });
              ganO = true;
            }
          }
          if (!ganO) setLoiChung(thongDiepLoiChung(err));
        },
      },
    );
  }

  return (
    <Modal opened={dong !== null} onClose={onClose} title="Gia hạn riêng" centered>
      {dong && (
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <Stack gap="sm">
            <div>
              <Text fw={600} style={{ overflowWrap: 'anywhere' }}>
                {dong.don_vi.ten}
              </Text>
              <Text size="sm" c="dimmed">
                Hạn hiện tại: {dinhDangNgayLich(dong.han_hieu_luc_ngay)}
                {dong.han_rieng ? ' (hạn riêng)' : ' (theo đợt)'}
              </Text>
            </div>
            {dong.han_rieng && <Checkbox {...register('bo_han_rieng')} label="Bỏ hạn riêng (trường về hạn của đợt)" />}
            {!boHanRieng && (
              <Controller
                control={control}
                name="han_rieng"
                render={({ field }) => (
                  <DateInput
                    label="Hạn riêng đến hết ngày"
                    withAsterisk
                    valueFormat="DD/MM/YYYY"
                    dateParser={docNgayGo}
                    placeholder="dd/mm/yyyy"
                    locale="vi"
                    minDate={new Date()}
                    popoverProps={{ withinPortal: true }}
                    value={field.value}
                    onChange={field.onChange}
                    error={errors.han_rieng?.message}
                  />
                )}
              />
            )}
            <Textarea
              {...register('ly_do')}
              label="Lý do"
              withAsterisk
              autosize
              minRows={2}
              maxLength={500}
              error={errors.ly_do?.message}
            />
            {loiChung && (
              <Alert color="red" role="alert">
                {loiChung}
              </Alert>
            )}
            <Group justify="flex-end" gap="sm">
              <Button variant="default" onClick={onClose}>
                Hủy
              </Button>
              <Button type="submit" loading={datHan.isPending}>
                Lưu
              </Button>
            </Group>
          </Stack>
        </form>
      )}
    </Modal>
  );
}
