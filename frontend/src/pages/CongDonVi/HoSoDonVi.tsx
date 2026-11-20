import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Alert,
  Button,
  Container,
  Group,
  Paper,
  Skeleton,
  Stack,
  Text,
  TextInput,
  Textarea,
  Title,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useHoSoDonVi, useLuuHoSoDonVi, type HoSoDonViPhanHoi } from '@/api/hoSoDonVi';
import { NHOM_HO_SO, TEN_TRUONG_HO_SO, TRUONG_HO_SO, chuanHoaHoSo, type TruongHoSo } from '@/lib/hoSoDonVi';
import { loiFieldsThanhMap, thongDiepLoiChung } from '@/lib/loiApi';
import { hoSoDonViSchema, hoSoFormTrong, type HoSoDonViForm } from '@/schemas/hoSoDonVi';
import { BadgeHoSo, MucConThieu, ThongTinChuyenKhoan } from './HoSoDonViChung';

// Ô chỉ có chữ số → bàn phím số trên điện thoại. MST để bàn phím thường vì dạng 13 số có dấu gạch nối.
const NHAP_SO = new Set<TruongHoSo>([
  'ma_qhns',
  'sdt_dai_dien',
  'kt_sdt',
  'so_tai_khoan',
  'ht_so_tai_khoan',
  'kt_so_tai_khoan',
]);

function formTuPhanHoi(d: HoSoDonViPhanHoi): HoSoDonViForm {
  const form = hoSoFormTrong();
  for (const t of TEN_TRUONG_HO_SO) form[t] = d.ho_so?.[t] ?? '';
  // Gợi ý tên trường theo danh mục đơn vị khi chưa khai.
  if (!form.ten_truong) form.ten_truong = d.goi_y.ten_truong;
  return form;
}

/** Hồ sơ đơn vị của trường (issue #63, ADR 0015 M4, U2, X4, T2): khai một lần, dùng mọi chương trình,
 * sửa bất cứ lúc nào; lưu nháp được khi chưa đủ (chỉ chặn sai định dạng). */
export default function HoSoDonVi() {
  const { data, isLoading, isError, error, refetch, isFetching } = useHoSoDonVi();

  return (
    <Container size="sm" py="lg" px="md">
      <Stack gap="md">
        <div>
          <Button component={Link} to="/trang-chu" variant="subtle" size="compact-sm" px={0}>
            ← Trang chủ
          </Button>
          <Title order={1} size="h3">
            Hồ sơ đơn vị
          </Title>
          <Text size="sm" c="dimmed">
            Khai một lần, dùng cho mọi chương trình. Sửa được bất cứ lúc nào.
          </Text>
        </div>

        {isLoading && (
          <Stack gap="md" aria-label="Đang tải">
            <Skeleton height={240} radius="md" />
            <Skeleton height={240} radius="md" />
          </Stack>
        )}

        {isError && (
          <Alert color="red" title="Không tải được hồ sơ đơn vị">
            <Stack gap="sm" align="flex-start">
              <Text size="sm">{thongDiepLoiChung(error)}</Text>
              <Button size="sm" variant="light" color="red" onClick={() => refetch()} loading={isFetching}>
                Thử lại
              </Button>
            </Stack>
          </Alert>
        )}

        {data && <FormHoSo data={data} />}
      </Stack>
    </Container>
  );
}

function FormHoSo({ data }: { data: HoSoDonViPhanHoi }) {
  const luu = useLuuHoSoDonVi();
  const [loiChung, setLoiChung] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    setError,
    watch,
    formState: { errors },
  } = useForm<HoSoDonViForm>({ resolver: zodResolver(hoSoDonViSchema), defaultValues: formTuPhanHoi(data) });
  const maQhns = watch('ma_qhns');

  function baoLoi(err: unknown) {
    setLoiChung(thongDiepLoiChung(err));
    for (const [field, message] of Object.entries(loiFieldsThanhMap(err))) {
      if ((TEN_TRUONG_HO_SO as readonly string[]).includes(field)) setError(field as TruongHoSo, { message });
    }
  }

  function onSubmit(v: HoSoDonViForm) {
    setLoiChung(null);
    luu.mutate(chuanHoaHoSo(v), {
      onSuccess: (kq) => {
        reset(formTuPhanHoi(kq));
        notifications.show({ color: 'green', message: 'Đã lưu hồ sơ đơn vị' });
      },
      onError: baoLoi,
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <Stack gap="md">
        <Paper withBorder radius="md" p="md" role="status" aria-label="Tình trạng hồ sơ">
          <Stack gap={4}>
            <Group gap="xs">
              <Text fw={600}>Tình trạng:</Text>
              <BadgeHoSo data={data} />
            </Group>
            {data.ho_so && <MucConThieu data={data} />}
          </Stack>
        </Paper>

        {NHOM_HO_SO.map((nhom) => (
          <Paper key={nhom.ma} withBorder radius="md" p="md" component="section" aria-labelledby={`nhom-${nhom.ma}`}>
            <Stack gap="sm">
              <Title order={2} size="h4" id={`nhom-${nhom.ma}`}>
                {nhom.ten}
              </Title>
              {TRUONG_HO_SO.filter((t) => t.nhom === nhom.ma).map((t) => {
                const chung = {
                  ...register(t.ma),
                  label: t.nhan,
                  description: t.goi_y,
                  withAsterisk: t.bat_buoc,
                  error: errors[t.ma]?.message,
                };
                return (
                  <Stack key={t.ma} gap="xs">
                    {t.kieu === 'textarea' ? (
                      <Textarea {...chung} autosize minRows={2} />
                    ) : (
                      <TextInput
                        {...chung}
                        inputMode={NHAP_SO.has(t.ma) ? 'numeric' : t.dinh_dang === 'email' ? 'email' : undefined}
                        autoComplete="off"
                      />
                    )}
                    {t.ma === 'ma_qhns' && <ThongTinChuyenKhoan maQhns={maQhns} />}
                  </Stack>
                );
              })}
            </Stack>
          </Paper>
        ))}

        {loiChung && <Alert color="red">{loiChung}</Alert>}
        <Text size="xs" c="dimmed">
          Lưu được khi chưa điền đủ; ô có dấu * cần điền để hồ sơ "Đủ thông tin".
        </Text>
        <Button type="submit" loading={luu.isPending} fullWidth>
          Lưu hồ sơ
        </Button>
      </Stack>
    </form>
  );
}
