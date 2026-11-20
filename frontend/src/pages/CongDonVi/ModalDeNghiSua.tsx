import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Alert, Button, Group, Modal, Radio, Select, Stack, Text, TextInput, Textarea } from '@mantine/core';
import { DateInput } from '@mantine/dates';
import 'dayjs/locale/vi';
import { notifications } from '@mantine/notifications';
import type { GiaiDoanThamGia } from '@/api/danhSachThamGia';
import { useGuiDeNghi, type DongDanhSachTruong, type GiaTriDeNghi, type GuiDeNghi } from '@/api/truongDanhSach';
import { loiFieldsThanhMap, thongDiepLoiXungDot } from '@/lib/loiApi';
import { chuoiSangNgay, docNgayGo, ngaySangChuoi } from '@/lib/ngayLich';
import { deNghiSuaSchema, type DeNghiSuaForm } from '@/schemas/deNghiSua';
import { NHAN_GIAI_DOAN } from './danhSachThamGiaNhan';

const propsNgay = {
  valueFormat: 'DD/MM/YYYY',
  dateParser: docNgayGo,
  placeholder: 'dd/mm/yyyy',
  locale: 'vi',
  popoverProps: { withinPortal: true },
};

const LUA_CHON_GIAI_DOAN = Object.entries(NHAN_GIAI_DOAN).map(([value, label]) => ({ value, label }));

function formTuDong(d: DongDanhSachTruong | null): DeNghiSuaForm {
  return {
    che_do: d ? 'sua' : 'them',
    ho_ten: d?.ho_ten ?? '',
    ngay_sinh: chuoiSangNgay(d?.ngay_sinh ?? null),
    gioi_tinh: d?.gioi_tinh ?? '',
    lop: d?.lop ?? '',
    giai_doan: d?.giai_doan ?? 'ca_hai',
    ly_do: '',
  };
}

const chuHoacNull = (s: string) => {
  const t = s.trim().normalize('NFC');
  return t === '' ? null : t;
};

/** Giá trị form → thông tin người như API (chuỗi trống = null, NFC). */
function giaTriTuForm(v: DeNghiSuaForm): Required<GiaTriDeNghi> {
  return {
    ho_ten: v.ho_ten.trim().normalize('NFC'),
    ngay_sinh: v.ngay_sinh ? ngaySangChuoi(v.ngay_sinh) : null,
    gioi_tinh: chuHoacNull(v.gioi_tinh),
    lop: chuHoacNull(v.lop),
    giai_doan: v.giai_doan as GiaiDoanThamGia,
  };
}

/** Chỉ các trường khác dòng hiện tại. */
function truongDaDoi(goc: DongDanhSachTruong, moi: Required<GiaTriDeNghi>): GiaTriDeNghi {
  return Object.fromEntries(
    (Object.keys(moi) as (keyof GiaTriDeNghi)[]).filter((k) => moi[k] !== goc[k]).map((k) => [k, moi[k]]),
  );
}

/** Thêm người: chỉ gửi ô có dữ liệu (+ giai đoạn). */
function boTrong(v: Required<GiaTriDeNghi>): GiaTriDeNghi {
  return Object.fromEntries(Object.entries(v).filter(([, x]) => x !== null));
}

interface Props {
  opened: boolean;
  onClose: () => void;
  dotId: string;
  /** null = đề nghị thêm người. */
  dong: DongDanhSachTruong | null;
}

/** Trường đề nghị sửa thông tin / bớt người (từ nút Không đồng ý) hoặc thêm người (issue #62, ADR 0015 X2).
 * Trường không sửa trực tiếp — HCMUE Áp dụng / Từ chối. Hủy = không gửi gì. */
export function ModalDeNghiSua({ opened, onClose, dotId, dong }: Props) {
  const gui = useGuiDeNghi(dotId);
  const [loiChung, setLoiChung] = useState<string | null>(null);
  const {
    register,
    control,
    handleSubmit,
    reset,
    watch,
    setError,
    formState: { errors },
  } = useForm<DeNghiSuaForm>({ resolver: zodResolver(deNghiSuaSchema), defaultValues: formTuDong(dong) });
  const cheDo = watch('che_do');

  useEffect(() => {
    if (!opened) return;
    reset(formTuDong(dong));
    setLoiChung(null);
  }, [opened, dong, reset]);

  function baoLoi(err: unknown) {
    setLoiChung(thongDiepLoiXungDot(err));
    const fields = loiFieldsThanhMap(err);
    if (fields.ly_do) setError('ly_do', { message: fields.ly_do });
  }

  function onSubmit(v: DeNghiSuaForm) {
    setLoiChung(null);
    const ly_do = chuHoacNull(v.ly_do) ?? undefined;
    let body: GuiDeNghi;
    if (v.che_do === 'them') {
      body = { loai: 'them', gia_tri: boTrong(giaTriTuForm(v)), ly_do };
    } else if (!dong) {
      return;
    } else if (v.che_do === 'bot') {
      body = { loai: 'bot', dong_id: dong.id, ly_do };
    } else {
      const doi = truongDaDoi(dong, giaTriTuForm(v));
      if (Object.keys(doi).length === 0) {
        setLoiChung('Chưa thay đổi thông tin nào');
        return;
      }
      body = { loai: 'sua', dong_id: dong.id, gia_tri: doi, ly_do };
    }
    gui.mutate(body, {
      onSuccess: () => {
        notifications.show({ color: 'green', message: 'Đã gửi đề nghị — chờ HCMUE xử lý' });
        onClose();
      },
      onError: baoLoi,
    });
  }

  const tieuDe = dong ? `Không đồng ý — ${dong.ho_ten}` : 'Đề nghị thêm người';

  return (
    <Modal opened={opened} onClose={onClose} title={tieuDe} centered>
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <Stack gap="sm">
          {loiChung && (
            <Alert color="red" role="alert">
              {loiChung}
            </Alert>
          )}
          {dong && (
            <Controller
              control={control}
              name="che_do"
              render={({ field }) => (
                <Radio.Group label="Thầy/Cô muốn đề nghị" value={field.value} onChange={field.onChange}>
                  <Stack gap="xs" mt={4}>
                    <Radio value="sua" label="Sửa thông tin" />
                    <Radio value="bot" label="Bớt người này (không tham gia học)" />
                  </Stack>
                </Radio.Group>
              )}
            />
          )}
          {cheDo === 'bot' ? (
            <Textarea
              label="Lý do"
              required
              autosize
              minRows={2}
              {...register('ly_do')}
              error={errors.ly_do?.message}
            />
          ) : (
            <>
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
              <TextInput label="Giới tính" {...register('gioi_tinh')} error={errors.gioi_tinh?.message} />
              <TextInput label="Lớp/môn" {...register('lop')} error={errors.lop?.message} />
              <Controller
                control={control}
                name="giai_doan"
                render={({ field }) => (
                  <Select
                    label="Giai đoạn tham gia"
                    allowDeselect={false}
                    data={LUA_CHON_GIAI_DOAN}
                    value={field.value}
                    onChange={(v) => v && field.onChange(v)}
                    comboboxProps={{ withinPortal: true }}
                  />
                )}
              />
              <Textarea
                label="Ghi chú cho HCMUE"
                autosize
                minRows={2}
                {...register('ly_do')}
                error={errors.ly_do?.message}
              />
            </>
          )}
          <Text size="xs" c="dimmed">
            HCMUE xem và áp dụng hoặc từ chối đề nghị; danh sách chỉ đổi khi được áp dụng.
          </Text>
          <Group justify="flex-end" gap="sm">
            <Button variant="default" onClick={onClose}>
              Hủy
            </Button>
            <Button type="submit" loading={gui.isPending}>
              Gửi đề nghị
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
