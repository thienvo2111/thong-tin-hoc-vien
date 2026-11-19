import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { Alert, Button, Group, Modal, NumberInput, Select, Stack, TextInput } from '@mantine/core';
import { DateInput } from '@mantine/dates';
import 'dayjs/locale/vi';
import { notifications } from '@mantine/notifications';
import { layDonViCongTac } from '@/api/danhMuc';
import { useSuaDotTrienKhai, useTaoDotTrienKhai, type DotTrienKhai } from '@/api/dotTrienKhai';
import { loiFieldsThanhMap, thongDiepLoiXungDot } from '@/lib/loiApi';
import { chuoiSangNgay, docNgayGo, ngaySangChuoi } from '@/lib/ngayLich';
import { dotTrienKhaiSchema, type DotTrienKhaiForm } from '@/schemas/dotTrienKhai';

export const NHAN_CHUONG_TRINH = { nls: 'NLS – Năng lực số', hsg: 'HSG – Bồi dưỡng học sinh giỏi' } as const;

const FORM_RONG: DotTrienKhaiForm = {
  chuong_trinh: 'hsg',
  ten: '',
  so_gddt_id: null,
  don_gia: null,
  ngay_qd_tu: null,
  ngay_qd_den: null,
  han_nop: null,
};

function giaTriTuDot(d: DotTrienKhai): DotTrienKhaiForm {
  return {
    chuong_trinh: d.chuong_trinh,
    ten: d.ten,
    so_gddt_id: d.so_gddt.id,
    don_gia: d.don_gia,
    ngay_qd_tu: chuoiSangNgay(d.ngay_qd_tu),
    ngay_qd_den: chuoiSangNgay(d.ngay_qd_den),
    han_nop: chuoiSangNgay(d.han_nop_ngay),
  };
}

// Tên field backend khác tên ô form.
const FIELD_FORM: Record<string, keyof DotTrienKhaiForm> = { han_nop_ngay: 'han_nop' };

const propsNgay = {
  valueFormat: 'DD/MM/YYYY',
  dateParser: docNgayGo,
  placeholder: 'dd/mm/yyyy',
  locale: 'vi',
  popoverProps: { withinPortal: true },
};

interface Props {
  opened: boolean;
  onClose: () => void;
  /** null = tạo mới. */
  dot: DotTrienKhai | null;
}

/** Form tạo/sửa đợt triển khai (issue #56). Sửa hạn nộp = gia hạn cả đợt (ADR 0015 T3). */
export function ModalDotTrienKhai({ opened, onClose, dot }: Props) {
  const tao = useTaoDotTrienKhai();
  const sua = useSuaDotTrienKhai();
  const [loiChung, setLoiChung] = useState<string | null>(null);

  // Sở GD&ĐT: vài chục đơn vị — tải trọn như useDonViChoKhoa.
  const { data: dsSo } = useQuery({
    queryKey: ['danh-muc', 'don-vi-cong-tac', 'so-gddt'],
    queryFn: () => layDonViCongTac({ loai_don_vi: 'so_gddt', page_size: 200 }),
    enabled: opened,
  });
  const luaChonSo = (dsSo?.data ?? [])
    .filter((d) => d.trang_thai === 'active' || d.id === dot?.so_gddt.id)
    .map((d) => ({ value: d.id, label: d.ten_don_vi }));
  if (dot && !luaChonSo.some((o) => o.value === dot.so_gddt.id)) {
    luaChonSo.push({ value: dot.so_gddt.id, label: dot.so_gddt.ten_don_vi });
  }

  const {
    register,
    control,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<DotTrienKhaiForm>({ resolver: zodResolver(dotTrienKhaiSchema), defaultValues: FORM_RONG });

  useEffect(() => {
    if (!opened) return;
    reset(dot ? giaTriTuDot(dot) : FORM_RONG);
    setLoiChung(null);
  }, [opened, dot, reset]);

  function onSubmit(v: DotTrienKhaiForm) {
    setLoiChung(null);
    const dto = {
      ten: v.ten.normalize('NFC'),
      so_gddt_id: v.so_gddt_id as string,
      don_gia: v.don_gia,
      ngay_qd_tu: v.ngay_qd_tu ? ngaySangChuoi(v.ngay_qd_tu) : null,
      ngay_qd_den: v.ngay_qd_den ? ngaySangChuoi(v.ngay_qd_den) : null,
      han_nop_ngay: ngaySangChuoi(v.han_nop as Date),
    };
    const opts = {
      onSuccess: () => {
        notifications.show({ color: 'green', message: dot ? 'Đã cập nhật đợt' : 'Đã tạo đợt' });
        onClose();
      },
      onError: (err: unknown) => {
        setLoiChung(thongDiepLoiXungDot(err));
        for (const [field, message] of Object.entries(loiFieldsThanhMap(err))) {
          const ten = FIELD_FORM[field] ?? field;
          if (ten in FORM_RONG) setError(ten as keyof DotTrienKhaiForm, { message });
        }
      },
    };
    if (dot) sua.mutate({ id: dot.id, ...dto }, opts);
    else tao.mutate({ chuong_trinh: v.chuong_trinh, ...dto }, opts);
  }

  return (
    <Modal opened={opened} onClose={onClose} title={dot ? 'Sửa đợt triển khai' : 'Tạo đợt triển khai'} centered>
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <Stack gap="sm">
          {loiChung && (
            <Alert color="red" role="alert">
              {loiChung}
            </Alert>
          )}
          <Controller
            control={control}
            name="chuong_trinh"
            render={({ field }) => (
              <Select
                label="Chương trình"
                required
                allowDeselect={false}
                disabled={!!dot}
                data={Object.entries(NHAN_CHUONG_TRINH).map(([value, label]) => ({ value, label }))}
                value={field.value}
                onChange={(v) => field.onChange(v)}
                error={errors.chuong_trinh?.message}
                comboboxProps={{ withinPortal: true }}
              />
            )}
          />
          <TextInput label="Tên đợt" required {...register('ten')} error={errors.ten?.message} />
          <Controller
            control={control}
            name="so_gddt_id"
            render={({ field }) => (
              <Select
                label="Sở GD&ĐT"
                required
                searchable
                placeholder="Chọn Sở"
                data={luaChonSo}
                value={field.value}
                onChange={(v) => field.onChange(v)}
                error={errors.so_gddt_id?.message}
                nothingFoundMessage="Không tìm thấy Sở"
                comboboxProps={{ withinPortal: true }}
              />
            )}
          />
          <Controller
            control={control}
            name="don_gia"
            render={({ field }) => (
              <NumberInput
                label="Đơn giá (VNĐ)"
                description="Để trống nếu chưa có"
                thousandSeparator="."
                decimalSeparator=","
                allowDecimal={false}
                hideControls
                value={field.value ?? ''}
                onChange={(v) => field.onChange(typeof v === 'number' ? v : null)}
                error={errors.don_gia?.message}
              />
            )}
          />
          <Group grow align="flex-start" wrap="wrap" gap="sm">
            <Controller
              control={control}
              name="ngay_qd_tu"
              render={({ field }) => (
                <DateInput
                  {...propsNgay}
                  label="Ngày QĐ chỉ định thầu – từ"
                  clearable
                  miw={140}
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.ngay_qd_tu?.message}
                />
              )}
            />
            <Controller
              control={control}
              name="ngay_qd_den"
              render={({ field }) => (
                <DateInput
                  {...propsNgay}
                  label="Ngày QĐ chỉ định thầu – đến"
                  clearable
                  miw={140}
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.ngay_qd_den?.message}
                />
              )}
            />
          </Group>
          <Controller
            control={control}
            name="han_nop"
            render={({ field }) => (
              <DateInput
                {...propsNgay}
                label="Hạn nộp"
                required
                description={
                  dot
                    ? 'Tính đến 23:59 ngày này (giờ Việt Nam). Đổi hạn = gia hạn cả đợt.'
                    : 'Tính đến 23:59 ngày này (giờ Việt Nam)'
                }
                value={field.value}
                onChange={field.onChange}
                error={errors.han_nop?.message}
              />
            )}
          />
          <Button type="submit" loading={tao.isPending || sua.isPending} fullWidth>
            {dot ? 'Lưu thay đổi' : 'Tạo đợt'}
          </Button>
        </Stack>
      </form>
    </Modal>
  );
}
