import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Alert, Button, Group, Modal, Select, Stack, TextInput, Textarea } from '@mantine/core';
import { DateInput } from '@mantine/dates';
import 'dayjs/locale/vi';
import { notifications } from '@mantine/notifications';
import {
  useSuaDongDanhSach,
  useThemDongDanhSach,
  useTruongTrongPhamVi,
  type DongDanhSach,
  type GiaiDoanThamGia,
  type TruongDongDanhSach,
} from '@/api/danhSachThamGia';
import { loiFieldsThanhMap, thongDiepLoiChung } from '@/lib/loiApi';
import { chuoiSangNgay, docNgayGo, ngaySangChuoi } from '@/lib/ngayLich';
import { dongDanhSachSchema, type DongDanhSachForm } from '@/schemas/dongDanhSachThamGia';
import { NHAN_GIAI_DOAN } from './danhSachThamGiaNhan';

const SUAT_THEO_GIAI_DOAN: Record<GiaiDoanThamGia, '1' | '0.5'> = { ca_hai: '1', chi_gd1: '0.5', chi_gd2: '0.5' };

const propsNgay = {
  valueFormat: 'DD/MM/YYYY',
  dateParser: docNgayGo,
  placeholder: 'dd/mm/yyyy',
  locale: 'vi',
  popoverProps: { withinPortal: true },
};

function formTuDong(d: DongDanhSach | null, donViMacDinh: string | null): DongDanhSachForm {
  return {
    don_vi_id: d?.don_vi_id ?? donViMacDinh,
    ho_ten: d?.ho_ten ?? '',
    ngay_sinh: chuoiSangNgay(d?.ngay_sinh ?? null),
    gioi_tinh: d?.gioi_tinh ?? '',
    ma_goc: d?.ma_goc ?? '',
    lop: d?.lop ?? '',
    giai_doan: d?.giai_doan ?? 'ca_hai',
    ty_le_suat: d?.ty_le_suat === 0.5 ? '0.5' : '1',
    ghi_chu: d?.ghi_chu ?? '',
    ly_do: '',
  };
}

const chuHoacNull = (s: string) => {
  const t = s.trim().normalize('NFC');
  return t === '' ? null : t;
};

/** Giá trị form → dữ liệu dòng như API (chuỗi trống = null, NFC). */
function dongTuForm(v: DongDanhSachForm): TruongDongDanhSach {
  return {
    don_vi_id: v.don_vi_id as string,
    ho_ten: v.ho_ten.trim().normalize('NFC'),
    ngay_sinh: v.ngay_sinh ? ngaySangChuoi(v.ngay_sinh) : null,
    gioi_tinh: chuHoacNull(v.gioi_tinh),
    ma_goc: chuHoacNull(v.ma_goc),
    lop: chuHoacNull(v.lop),
    giai_doan: v.giai_doan,
    ty_le_suat: v.ty_le_suat === '0.5' ? 0.5 : 1,
    ghi_chu: chuHoacNull(v.ghi_chu),
  };
}

/** Chỉ các trường khác dòng gốc. */
function truongDaDoi(goc: DongDanhSach, moi: TruongDongDanhSach): Partial<TruongDongDanhSach> {
  return Object.fromEntries(
    (Object.keys(moi) as (keyof TruongDongDanhSach)[]).filter((k) => moi[k] !== goc[k]).map((k) => [k, moi[k]]),
  );
}

interface Props {
  opened: boolean;
  onClose: () => void;
  dotId: string;
  /** null = thêm người. */
  dong: DongDanhSach | null;
  /** Trường chọn sẵn khi thêm người từ danh sách 1 trường. */
  donViMacDinh?: string | null;
  /** Tên trường hiện tại của dòng — dùng khi trường không còn trong phạm vi (đã ngưng). */
  tenDonViHienTai?: string;
}

/** Quản trị sửa/thêm 1 dòng danh sách tham gia, bắt buộc lý do (issue #59, ADR 0015 S2/S3/X3). */
export function ModalDongDanhSach({ opened, onClose, dotId, dong, donViMacDinh = null, tenDonViHienTai }: Props) {
  const sua = useSuaDongDanhSach(dotId);
  const them = useThemDongDanhSach(dotId);
  const { data: dsTruong } = useTruongTrongPhamVi(opened ? dotId : null);
  const [loiChung, setLoiChung] = useState<string | null>(null);

  const luaChonTruong = (dsTruong ?? []).map((t) => ({
    value: t.id,
    label: t.ma_don_vi ? `${t.ten_don_vi} (${t.ma_don_vi})` : t.ten_don_vi,
  }));
  if (dong && !luaChonTruong.some((o) => o.value === dong.don_vi_id)) {
    luaChonTruong.push({ value: dong.don_vi_id, label: tenDonViHienTai ?? 'Trường hiện tại' });
  }

  const {
    register,
    control,
    handleSubmit,
    reset,
    setValue,
    setError,
    formState: { errors },
  } = useForm<DongDanhSachForm>({
    resolver: zodResolver(dongDanhSachSchema),
    defaultValues: formTuDong(dong, donViMacDinh),
  });

  useEffect(() => {
    if (!opened) return;
    reset(formTuDong(dong, donViMacDinh));
    setLoiChung(null);
  }, [opened, dong, donViMacDinh, reset]);

  function baoLoi(err: unknown) {
    setLoiChung(thongDiepLoiChung(err));
    for (const [field, message] of Object.entries(loiFieldsThanhMap(err))) {
      if (field in dongDanhSachSchema.shape) setError(field as keyof DongDanhSachForm, { message });
    }
  }

  function onSubmit(v: DongDanhSachForm) {
    setLoiChung(null);
    const moi = dongTuForm(v);
    const ly_do = v.ly_do.trim().normalize('NFC');
    const xong = (thongDiep: string) => () => {
      notifications.show({ color: 'green', message: thongDiep });
      onClose();
    };
    if (!dong) {
      them.mutate({ ...moi, ly_do }, { onSuccess: xong('Đã thêm người vào danh sách'), onError: baoLoi });
      return;
    }
    const doi = truongDaDoi(dong, moi);
    if (Object.keys(doi).length === 0) {
      setLoiChung('Chưa có thay đổi nào để lưu');
      return;
    }
    sua.mutate({ dongId: dong.id, body: { ...doi, ly_do } }, { onSuccess: xong('Đã lưu thay đổi'), onError: baoLoi });
  }

  return (
    <Modal opened={opened} onClose={onClose} title={dong ? 'Sửa thông tin' : 'Thêm người'} centered>
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <Stack gap="sm">
          {loiChung && (
            <Alert color="red" role="alert">
              {loiChung}
            </Alert>
          )}
          <Controller
            control={control}
            name="don_vi_id"
            render={({ field }) => (
              <Select
                label="Trường"
                required
                searchable
                placeholder="Chọn trường"
                data={luaChonTruong}
                value={field.value}
                onChange={(v) => field.onChange(v)}
                error={errors.don_vi_id?.message}
                nothingFoundMessage="Không tìm thấy trường"
                comboboxProps={{ withinPortal: true }}
              />
            )}
          />
          <TextInput label="Họ và tên" required {...register('ho_ten')} error={errors.ho_ten?.message} />
          <Controller
            control={control}
            name="ngay_sinh"
            render={({ field }) => (
              <DateInput
                {...propsNgay}
                label="Ngày sinh"
                clearable
                value={field.value}
                onChange={field.onChange}
                error={errors.ngay_sinh?.message}
              />
            )}
          />
          <Group grow align="flex-start" wrap="wrap" gap="sm">
            <TextInput label="Giới tính" miw={120} {...register('gioi_tinh')} error={errors.gioi_tinh?.message} />
            <TextInput label="Mã gốc" miw={120} {...register('ma_goc')} error={errors.ma_goc?.message} />
          </Group>
          <TextInput label="Lớp" {...register('lop')} error={errors.lop?.message} />
          <Group grow align="flex-start" wrap="wrap" gap="sm">
            <Controller
              control={control}
              name="giai_doan"
              render={({ field }) => (
                <Select
                  label="Giai đoạn tham gia"
                  required
                  allowDeselect={false}
                  miw={140}
                  data={Object.entries(NHAN_GIAI_DOAN).map(([value, label]) => ({ value, label }))}
                  value={field.value}
                  onChange={(v) => {
                    if (!v) return;
                    const gd = v as GiaiDoanThamGia;
                    field.onChange(gd);
                    setValue('ty_le_suat', SUAT_THEO_GIAI_DOAN[gd]);
                  }}
                  comboboxProps={{ withinPortal: true }}
                />
              )}
            />
            <Controller
              control={control}
              name="ty_le_suat"
              render={({ field }) => (
                <Select
                  label="Tỷ lệ suất"
                  required
                  allowDeselect={false}
                  miw={140}
                  description="Thay giữa chừng: mỗi người 0,5"
                  data={[
                    { value: '1', label: '1' },
                    { value: '0.5', label: '0,5' },
                  ]}
                  value={field.value}
                  onChange={(v) => v && field.onChange(v)}
                  comboboxProps={{ withinPortal: true }}
                />
              )}
            />
          </Group>
          <TextInput label="Ghi chú" {...register('ghi_chu')} error={errors.ghi_chu?.message} />
          <Textarea label="Lý do" required autosize minRows={2} {...register('ly_do')} error={errors.ly_do?.message} />
          <Button type="submit" loading={sua.isPending || them.isPending} fullWidth>
            {dong ? 'Lưu thay đổi' : 'Thêm người'}
          </Button>
        </Stack>
      </form>
    </Modal>
  );
}
