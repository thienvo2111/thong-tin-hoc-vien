import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Controller, useForm, type FieldErrors, type Resolver } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useBlocker, useLocation, useNavigate } from 'react-router-dom';
import { useDebouncedValue } from '@mantine/hooks';
import {
  Anchor,
  Badge,
  Box,
  Button,
  Card,
  Center,
  Container,
  Group,
  Loader,
  Modal,
  Select,
  Stack,
  Text,
  TextInput,
  Title,
  TagsInput,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  guiLaiXacMinhEmail,
  kiemTraTrungCccd,
  suaHoSoToi,
  themChuyenMon,
  useDotXacNhan,
  useHoSoToi,
  useMucDoDayDu,
  xoaChuyenMon,
} from '@/api/hocVien';
import { goiYChuyenMon, layMonHoc } from '@/api/danhMuc';
import { ApiError } from '@/api/client';
import type { HocVien } from '@/api/types';
import {
  canhBaoChuaVietHoa,
  canhBaoDaoTen,
  canhBaoThieuDau,
  chuanHoaHoTen,
  goiYEmailDomain,
  guiYDaoTen,
  hoSoHocVienSchema,
  type HoSoHocVienForm,
} from '@/schemas/hoSoHocVien';
import { chuanHoaObjectNfc } from '@/lib/nfc';
import { loiFieldsThanhMap, thongDiepLoiChung } from '@/lib/loiApi';
import { dinhDangNgayGio } from '@/lib/ngay';
import { CAP_GIANG_DAY_OPTIONS, GIOI_TINH_OPTIONS, TRINH_DO_OPTIONS } from '@/lib/tuyChonHoSo';
import { StatusBanner } from '@/components/StatusBanner';
import { SelectDiaDanh } from '@/components/SelectDiaDanh';
import { SelectDonVi } from '@/components/SelectDonVi';

const NHOM_TRUONG = {
  ca_nhan: ['ho_ten', 'ngay_sinh', 'thang_sinh', 'nam_sinh', 'so_dinh_danh_ca_nhan'],
  // Nơi sinh và Cư trú KHÔNG nằm trong đối tượng này — cả 2 là trường tùy chọn
  // (T17/sửa 2026-09-30), không tính vào logic "cần bổ sung" (coThieu). Xem MUC_LUC bên dưới.
  cu_tru: ['cu_tru_tinh_id', 'cu_tru_phuong_xa_id'],
  cong_tac: ['don_vi_cong_tac_id', 'chuc_vu'],
  lien_he: ['so_dien_thoai_lien_he', 'email_lien_he'],
  chuyen_mon: ['trinh_do_chuyen_mon', 'trinh_do_chuyen_mon_khac', 'cap_giang_day', 'mon_giang_day_id', 'chuyen_mon'],
} as const;

const NHOM_NGAY_SINH = new Set(['ngay_sinh', 'thang_sinh', 'nam_sinh']);

const MUC_LUC = [
  { id: 'section-ca-nhan', nhan: 'Thông tin cá nhân', nhom: NHOM_TRUONG.ca_nhan },
  { id: 'section-noi-sinh', nhan: 'Nơi sinh', nhom: null },
  { id: 'section-cu-tru', nhan: 'Cư trú', nhom: null },
  { id: 'section-cong-tac', nhan: 'Công tác', nhom: NHOM_TRUONG.cong_tac },
  { id: 'section-lien-he', nhan: 'Liên hệ', nhom: NHOM_TRUONG.lien_he },
  { id: 'section-chuyen-mon', nhan: 'Trình độ & chuyên môn', nhom: NHOM_TRUONG.chuyen_mon },
] as const;

function toFormValues(hoSo: HocVien | undefined): HoSoHocVienForm {
  return {
    ho_ten: hoSo?.ho_ten ?? '',
    ngay_sinh: (hoSo?.ngay_sinh ?? undefined) as unknown as number,
    thang_sinh: (hoSo?.thang_sinh ?? undefined) as unknown as number,
    nam_sinh: (hoSo?.nam_sinh ?? undefined) as unknown as number,
    gioi_tinh: hoSo?.gioi_tinh ?? null,
    so_dinh_danh_ca_nhan: hoSo?.so_dinh_danh_ca_nhan ?? '',
    noi_sinh_tinh: hoSo?.noi_sinh_tinh ?? '',
    noi_sinh_huyen: hoSo?.noi_sinh_huyen ?? '',
    noi_sinh_xa: hoSo?.noi_sinh_xa ?? '',
    cu_tru_tinh_id: hoSo?.cu_tru_tinh_id ?? null,
    cu_tru_phuong_xa_id: hoSo?.cu_tru_phuong_xa_id ?? null,
    don_vi_cong_tac_id: hoSo?.don_vi_cong_tac_id ?? '',
    chuc_vu: hoSo?.chuc_vu ?? '',
    so_dien_thoai_lien_he: hoSo?.so_dien_thoai_lien_he ?? '',
    email_lien_he: hoSo?.email_lien_he ?? '',
    trinh_do_chuyen_mon: (hoSo?.trinh_do_chuyen_mon ?? undefined) as HoSoHocVienForm['trinh_do_chuyen_mon'],
    trinh_do_chuyen_mon_khac: hoSo?.trinh_do_chuyen_mon_khac ?? '',
    chuyen_mon: hoSo?.chuyen_mon ?? [],
    cap_giang_day: hoSo?.cap_giang_day ?? null,
    mon_giang_day_id: hoSo?.mon_giang_day_id ?? null,
  };
}

function ChamThieu() {
  return <Box w={8} h={8} bg="red.6" style={{ borderRadius: '50%', flexShrink: 0 }} aria-hidden />;
}

/** M4 — Hồ sơ: xem & sửa (dac-ta-cong-hoc-vien.md § M4). */
export default function HoSo() {
  const { data: hoSo, isLoading, isError, error } = useHoSoToi();
  const { data: dotXacNhan } = useDotXacNhan();
  const { data: mucDoDayDu } = useMucDoDayDu();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();

  const chiXem = !dotXacNhan?.dot;
  const dongLuc = dotXacNhan?.dot?.dong_luc;

  const [modalXacNhanLai, setModalXacNhanLai] = useState(false);
  const [donViNhanBanDau, setDonViNhanBanDau] = useState<string | null>(null);

  const thieuMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const t of mucDoDayDu?.thieu ?? []) map[t.field] = t.message;
    return map;
  }, [mucDoDayDu]);

  const coThieu = (truong: readonly string[] | null) => !!truong && truong.some((f) => f in thieuMap);
  // Sửa 2026-09-30: trước đây chỉ dùng thieuMap (dữ liệu server lúc TẢI TRANG,
  // không phản ánh giá trị hiện tại trong form) khiến dù đã chọn giá trị vẫn
  // hiện "Cần bổ sung" cho tới khi bấm Lưu. Giờ CHỈ hiện nhãn đó khi giá trị
  // HIỆN TẠI trong form (giaTriHienTai) thật sự rỗng.
  function loiHoacThieu(truong: string, rhfMessage: string | undefined, giaTriHienTai: unknown): string | undefined {
    if (rhfMessage) return rhfMessage;
    if (!(truong in thieuMap)) return undefined;
    const rong =
      giaTriHienTai === null ||
      giaTriHienTai === undefined ||
      giaTriHienTai === '' ||
      (Array.isArray(giaTriHienTai) && giaTriHienTai.length === 0);
    return rong ? 'Cần bổ sung' : undefined;
  }

  // Hồ sơ import_moet thường thiếu nhiều trường cùng lúc (CCCD, nơi sinh...). Nếu validate & chặn Lưu
  // theo TOÀN BỘ schema, học viên sẽ không lưu được dù chỉ sửa 1 trường (vd. chức vụ) khi các trường
  // khác còn thiếu từ trước — trái với "bổ sung dần" (dac-ta § M4 "Lưu": chỉ gửi trường đã đổi). Resolver
  // dưới đây validate toàn bộ (để bắt đúng lỗi liên trường như tổ hợp ngày sinh) nhưng chỉ CHẶN submit
  // với lỗi rơi vào (các) trường mà học viên vừa sửa trong phiên này — lỗi ở trường khác chưa đụng tới
  // vẫn hiện qua nhãn "Cần bổ sung" (muc-do-day-du) chứ không chặn lưu phần đã sửa.
  const dirtyFieldsRef = useRef<Record<string, unknown>>({});
  const resolver: Resolver<HoSoHocVienForm> = useCallback((values) => {
    const ketQua = hoSoHocVienSchema.safeParse(values);
    if (ketQua.success) return { values: ketQua.data, errors: {} };
    const dirty = dirtyFieldsRef.current;
    const daDoi = (truong: string) =>
      NHOM_NGAY_SINH.has(truong) ? !!(dirty.ngay_sinh || dirty.thang_sinh || dirty.nam_sinh) : !!dirty[truong];
    const errors: Record<string, { type: string; message: string }> = {};
    for (const issue of ketQua.error.issues) {
      const truong = String(issue.path[0]);
      if (daDoi(truong) && !errors[truong]) {
        errors[truong] = { type: issue.code, message: issue.message };
      }
    }
    return { values: {}, errors: errors as FieldErrors<HoSoHocVienForm> };
  }, []);

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    setError,
    setFocus,
    reset,
    getValues,
    formState: { errors, isDirty, dirtyFields, isSubmitting },
  } = useForm<HoSoHocVienForm>({
    resolver,
    values: toFormValues(hoSo),
    resetOptions: { keepDirtyValues: true },
    mode: 'onBlur',
    reValidateMode: 'onChange',
  });
  dirtyFieldsRef.current = dirtyFields as Record<string, unknown>;

  // Đến từ M5 với nút "Sửa" ở 1 lỗi cụ thể — cuộn/focus ngay vào ô đó (dac-ta § M5).
  useEffect(() => {
    const truongCanSua = (location.state as { focusField?: string } | null)?.focusField;
    if (!isLoading && truongCanSua) {
      setFocus(truongCanSua as keyof HoSoHocVienForm);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading]);

  // Đồng bộ nhãn ban đầu của Autocomplete đơn vị công tác khi hồ sơ tải xong (chỉ 1 lần, tránh ghi đè lúc đang gõ).
  useMemo(() => {
    if (hoSo?.don_vi_cong_tac_ten) setDonViNhanBanDau(hoSo.don_vi_cong_tac_ten);
  }, [hoSo?.don_vi_cong_tac_ten]);

  const hoTenHienTai = watch('ho_ten');
  const capGiangDayHienTai = watch('cap_giang_day');
  const trinhDoHienTai = watch('trinh_do_chuyen_mon');
  const emailHienTai = watch('email_lien_he');
  // Chỉ gợi ý khi email đã hợp lệ về cú pháp (không còn lỗi đỏ từ zod) — tránh chồng cảnh báo.
  const goiYDomainEmail = !errors.email_lien_he && emailHienTai ? goiYEmailDomain(emailHienTai) : null;

  const monHocQuery = useQuery({
    queryKey: ['danh-muc', 'mon-hoc', capGiangDayHienTai],
    queryFn: () => layMonHoc(capGiangDayHienTai as string),
    enabled: !!capGiangDayHienTai,
  });

  // Chặn rời trang khi còn thay đổi chưa lưu (dac-ta § M4 "Lưu"): điều hướng trong ứng dụng.
  useBlocker(({ currentLocation, nextLocation }) => isDirty && currentLocation.pathname !== nextLocation.pathname);
  // ... và đóng tab/tải lại trang.
  useEffect(() => {
    function xuLy(e: BeforeUnloadEvent) {
      if (!isDirty) return;
      e.preventDefault();
    }
    window.addEventListener('beforeunload', xuLy);
    return () => window.removeEventListener('beforeunload', xuLy);
  }, [isDirty]);

  const luuMutation = useMutation({
    mutationFn: (patch: Partial<HocVien>) => suaHoSoToi(chuanHoaObjectNfc(patch)),
    onSuccess: (res) => {
      reset(getValues());
      queryClient.invalidateQueries({ queryKey: ['hoc-vien'] });
      notifications.show({ color: 'green', message: 'Đã lưu' });
      if (res.xac_nhan_bi_huy) setModalXacNhanLai(true);
    },
    onError: (err) => {
      const fields = loiFieldsThanhMap(err);
      for (const [truong, message] of Object.entries(fields)) {
        setError(truong as keyof HoSoHocVienForm, { message });
      }
      if (err instanceof ApiError && err.code === 'CONFLICT') {
        setError('so_dinh_danh_ca_nhan', { message: thongDiepLoiChung(err) });
      }
    },
  });

  // 2026-09-30: badge trạng thái email + nút gửi lại xác minh (dac-ta § M4 mục Liên hệ).
  const guiLaiXacMinhMutation = useMutation({
    mutationFn: guiLaiXacMinhEmail,
    onSuccess: () => {
      notifications.show({ color: 'green', message: 'Đã gửi lại email xác minh, vui lòng kiểm tra hộp thư.' });
    },
    onError: (err) => {
      notifications.show({ color: 'red', message: thongDiepLoiChung(err) });
    },
  });

  async function xuLyBlurCccd(e: React.FocusEvent<HTMLInputElement>) {
    const giaTri = e.target.value;
    if (!/^\d{12}$/.test(giaTri) || giaTri === hoSo?.so_dinh_danh_ca_nhan) return;
    try {
      const res = await kiemTraTrungCccd(giaTri);
      if (res.trung) {
        setError('so_dinh_danh_ca_nhan', { message: 'Số CCCD này đã được dùng cho một hồ sơ khác. Liên hệ hỗ trợ.' });
      }
    } catch {
      // Bỏ qua lỗi mạng ở lần kiểm tra tức thời — nếu thật sự trùng, backend vẫn chặn khi bấm Lưu (CONFLICT).
    }
  }

  function onSubmit(values: HoSoHocVienForm) {
    const patch: Partial<HocVien> = {};
    for (const truong of Object.keys(dirtyFields) as (keyof HoSoHocVienForm)[]) {
      if (truong === 'chuyen_mon') continue; // chuyên môn gửi ngay lúc thêm/xóa thẻ, không qua PATCH này
      (patch as Record<string, unknown>)[truong] = values[truong];
    }
    if (Object.keys(patch).length === 0) return;
    luuMutation.mutate(patch);
  }

  // Chuyên môn: mỗi thẻ gọi ngay POST/DELETE, không nằm trong PATCH tổng (dac-ta § M4 mục 5).
  const [chuyenMon, setChuyenMonState] = useState<string[]>([]);
  useMemo(() => setChuyenMonState(hoSo?.chuyen_mon ?? []), [hoSo?.chuyen_mon]);
  const [qGoiY, setQGoiY] = useState('');
  const [qGoiYDebounced] = useDebouncedValue(qGoiY, 300);
  const goiYQuery = useQuery({
    queryKey: ['danh-muc', 'chuyen-mon-goi-y', qGoiYDebounced],
    queryFn: () => goiYChuyenMon(qGoiYDebounced),
    enabled: qGoiYDebounced.trim().length >= 2,
  });

  const themChuyenMonMutation = useMutation({
    mutationFn: (gt: string) => themChuyenMon(gt),
    onError: (_err, gt) => {
      setChuyenMonState((prev) => prev.filter((t) => t !== gt));
      notifications.show({ color: 'red', message: 'Không thêm được chuyên môn, vui lòng thử lại.' });
    },
  });
  const xoaChuyenMonMutation = useMutation({
    mutationFn: (gt: string) => xoaChuyenMon(gt),
    onError: (_err, gt) => {
      setChuyenMonState((prev) => (prev.includes(gt) ? prev : [...prev, gt]));
      notifications.show({ color: 'red', message: 'Không xóa được chuyên môn, vui lòng thử lại.' });
    },
  });

  function xuLyDoiChuyenMon(giaTriMoi: string[]) {
    const themMoi = giaTriMoi.filter((t) => !chuyenMon.includes(t));
    setChuyenMonState(giaTriMoi);
    themMoi.forEach((t) => themChuyenMonMutation.mutate(t));
  }
  function xuLyXoaChuyenMon(giaTriBiXoa: string) {
    setChuyenMonState((prev) => prev.filter((t) => t !== giaTriBiXoa));
    xoaChuyenMonMutation.mutate(giaTriBiXoa);
  }

  if (isLoading) {
    return (
      <Center py="xl" mih="60vh">
        <Loader />
      </Center>
    );
  }

  if (isError) {
    return (
      <Container size="sm" py="xl">
        <StatusBanner loai="error">{thongDiepLoiChung(error)}</StatusBanner>
      </Container>
    );
  }

  return (
    <Container size="lg" py="xl" pb={96}>
      <Stack gap="lg">
        <Title order={1} size="h2">
          Hồ sơ của tôi
        </Title>

        {chiXem && (
          <StatusBanner loai="info">Hiện không trong thời gian chỉnh sửa hồ sơ — mọi thông tin ở chế độ chỉ xem.</StatusBanner>
        )}

        <Box style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
          <Box visibleFrom="sm" w={220} style={{ flexShrink: 0, position: 'sticky', top: 24 }}>
            <Stack gap={4}>
              {MUC_LUC.map((m) => (
                <Anchor
                  key={m.id}
                  href={`#${m.id}`}
                  underline="never"
                  fz="sm"
                  fw={600}
                  c={coThieu(m.nhom) ? 'red.7' : 'dark'}
                  px="sm"
                  py={8}
                  style={{ borderRadius: 8 }}
                >
                  <Group gap={6} wrap="nowrap">
                    {coThieu(m.nhom) && <ChamThieu />}
                    {m.nhan}
                  </Group>
                </Anchor>
              ))}
            </Stack>
          </Box>

          <Box style={{ flex: 1, minWidth: 0 }}>
            <form
              onSubmit={handleSubmit(onSubmit)}
              noValidate
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.target as HTMLElement).tagName !== 'TEXTAREA') e.preventDefault();
              }}
            >
              <Stack gap="lg">
                <Card id="section-ca-nhan" withBorder radius="md">
                  <Stack gap="md">
                    <Group gap={6}>
                      {coThieu(NHOM_TRUONG.ca_nhan) && <ChamThieu />}
                      <Text fw={600}>Thông tin cá nhân</Text>
                    </Group>

                <TextInput label="Mã định danh" value={hoSo?.ma_dinh_danh_moet ?? ''} disabled readOnly />

                <TextInput
                  label="Họ và tên"
                  error={loiHoacThieu('ho_ten', errors.ho_ten?.message, hoTenHienTai)}
                  disabled={chiXem}
                  {...register('ho_ten')}
                />
                {!chiXem && hoTenHienTai && canhBaoChuaVietHoa(hoTenHienTai) && (
                  <Group gap="xs" wrap="wrap">
                    <Text size="sm" c="yellow.8">
                      🟡 Họ tên chưa viết hoa chữ đầu mỗi từ.
                    </Text>
                    <Button
                      variant="subtle"
                      size="xs"
                      onClick={() => setValue('ho_ten', chuanHoaHoTen(hoTenHienTai), { shouldDirty: true, shouldValidate: true })}
                    >
                      Dùng dạng chuẩn: {chuanHoaHoTen(hoTenHienTai)}
                    </Button>
                  </Group>
                )}
                {!chiXem && hoTenHienTai && canhBaoThieuDau(hoTenHienTai) && (
                  <Text size="sm" c="yellow.8">
                    🟡 Họ tên có thể đang thiếu dấu tiếng Việt — kiểm tra lại nếu đây không phải tên nước ngoài.
                  </Text>
                )}
                {!chiXem && hoTenHienTai && canhBaoDaoTen(hoTenHienTai) && (
                  <Group gap="xs" wrap="wrap">
                    <Text size="sm" c="yellow.8">
                      🟡 Họ tên có thể bị đảo ngược thứ tự Họ và Tên — kiểm tra lại nếu chưa đúng.
                    </Text>
                    <Button
                      variant="subtle"
                      size="xs"
                      onClick={() => setValue('ho_ten', guiYDaoTen(hoTenHienTai), { shouldDirty: true, shouldValidate: true })}
                    >
                      Dùng dạng gợi ý: {guiYDaoTen(hoTenHienTai)}
                    </Button>
                  </Group>
                )}

                <Group grow>
                  <TextInput
                    label="Ngày sinh"
                    inputMode="numeric"
                    maxLength={2}
                    error={loiHoacThieu('ngay_sinh', errors.ngay_sinh?.message, watch('ngay_sinh'))}
                    disabled={chiXem}
                    {...register('ngay_sinh')}
                  />
                  <TextInput
                    label="Tháng sinh"
                    inputMode="numeric"
                    maxLength={2}
                    error={loiHoacThieu('thang_sinh', errors.thang_sinh?.message, watch('thang_sinh'))}
                    disabled={chiXem}
                    {...register('thang_sinh')}
                  />
                  <TextInput
                    label="Năm sinh"
                    inputMode="numeric"
                    maxLength={4}
                    error={loiHoacThieu('nam_sinh', errors.nam_sinh?.message, watch('nam_sinh'))}
                    disabled={chiXem}
                    {...register('nam_sinh')}
                  />
                </Group>

                <Controller
                  name="gioi_tinh"
                  control={control}
                  render={({ field }) => (
                    <Select
                      label="Giới tính"
                      data={GIOI_TINH_OPTIONS}
                      value={field.value ?? null}
                      onChange={field.onChange}
                      disabled={chiXem}
                      clearable
                    />
                  )}
                />

                <TextInput
                  label="Số CCCD"
                  inputMode="numeric"
                  maxLength={12}
                  error={loiHoacThieu('so_dinh_danh_ca_nhan', errors.so_dinh_danh_ca_nhan?.message, watch('so_dinh_danh_ca_nhan'))}
                  disabled={chiXem}
                  {...register('so_dinh_danh_ca_nhan', { onBlur: xuLyBlurCccd })}
                />

                <Text size="xs" c="dimmed">
                  Thông tin lấy từ danh sách của ngành. Nếu chưa đúng, Thầy/Cô sửa lại cho chính xác — thông tin này sẽ
                  in trên giấy chứng nhận.
                </Text>
              </Stack>
            </Card>

            <Card id="section-noi-sinh" withBorder radius="md">
              <Stack gap="md">
                <Text fw={600}>Nơi sinh</Text>
                <Text size="xs" c="dimmed">
                  Ghi theo giấy khai sinh.
                </Text>

                <TextInput
                  label="Tỉnh/Thành nơi sinh"
                  placeholder="VD: Hà Tây (cũ)"
                  disabled={chiXem}
                  {...register('noi_sinh_tinh')}
                />
                <TextInput
                  label="Quận/Huyện nơi sinh"
                  placeholder="VD: Ba Vì"
                  disabled={chiXem}
                  {...register('noi_sinh_huyen')}
                />
                <TextInput
                  label="Phường/Xã nơi sinh"
                  placeholder="VD: Xã Sơn Đà"
                  disabled={chiXem}
                  {...register('noi_sinh_xa')}
                />
              </Stack>
            </Card>

            <Card id="section-cu-tru" withBorder radius="md">
              <Stack gap="md">
                <Text fw={600}>Cư trú</Text>
                <Text size="xs" c="dimmed">
                  Tùy chọn — dùng địa giới hành chính hiện tại, không bắt buộc.
                </Text>

                <Controller
                  name="cu_tru_tinh_id"
                  control={control}
                  render={({ field }) => (
                    <SelectDiaDanh
                      label="Cư trú (tỉnh/thành)"
                      cap="tinh_thanh"
                      phienBan="hien_tai"
                      value={field.value || null}
                      onChange={(id) => {
                        if (id !== field.value) setValue('cu_tru_phuong_xa_id', null, { shouldDirty: true });
                        field.onChange(id ?? null);
                      }}
                      error={loiHoacThieu('cu_tru_tinh_id', errors.cu_tru_tinh_id?.message, field.value)}
                      disabled={chiXem}
                    />
                  )}
                />

                <Controller
                  name="cu_tru_phuong_xa_id"
                  control={control}
                  render={({ field }) => (
                    <SelectDiaDanh
                      label="Cư trú (phường/xã)"
                      cap="phuong_xa_dac_khu"
                      phienBan="hien_tai"
                      parentId={watch('cu_tru_tinh_id') || null}
                      value={field.value || null}
                      onChange={(id) => field.onChange(id ?? null)}
                      error={loiHoacThieu('cu_tru_phuong_xa_id', errors.cu_tru_phuong_xa_id?.message, field.value)}
                      disabled={chiXem}
                    />
                  )}
                />
              </Stack>
            </Card>

            <Card id="section-cong-tac" withBorder radius="md">
              <Stack gap="md">
                <Group gap={6}>
                  {coThieu(NHOM_TRUONG.cong_tac) && <ChamThieu />}
                  <Text fw={600}>Công tác</Text>
                </Group>

                <Controller
                  name="don_vi_cong_tac_id"
                  control={control}
                  render={({ field }) => (
                    <SelectDonVi
                      label="Đơn vị công tác"
                      nhanBanDau={donViNhanBanDau}
                      idBanDau={hoSo?.don_vi_cong_tac_id ?? null}
                      onChange={(id) => field.onChange(id ?? '')}
                      error={loiHoacThieu('don_vi_cong_tac_id', errors.don_vi_cong_tac_id?.message, field.value)}
                      disabled={chiXem}
                      required
                    />
                  )}
                />

                <TextInput label="Chức vụ" disabled={chiXem} {...register('chuc_vu')} />
              </Stack>
            </Card>

            <Card id="section-lien-he" withBorder radius="md">
              <Stack gap="md">
                <Group gap={6}>
                  {coThieu(NHOM_TRUONG.lien_he) && <ChamThieu />}
                  <Text fw={600}>Liên hệ</Text>
                </Group>

                <TextInput
                  label="Số điện thoại"
                  inputMode="numeric"
                  maxLength={10}
                  description="10 chữ số, bắt đầu bằng 0 — ví dụ: 0912345678"
                  error={loiHoacThieu('so_dien_thoai_lien_he', errors.so_dien_thoai_lien_he?.message, watch('so_dien_thoai_lien_he'))}
                  disabled={chiXem}
                  {...register('so_dien_thoai_lien_he')}
                />

                <TextInput
                  label="Email"
                  description="Hệ thống gửi bản sao hồ sơ và thông báo lớp học qua email này"
                  type="email"
                  error={loiHoacThieu('email_lien_he', errors.email_lien_he?.message, watch('email_lien_he'))}
                  disabled={chiXem}
                  {...register('email_lien_he')}
                />
                {!chiXem && goiYDomainEmail && (
                  <Group gap="xs" wrap="wrap">
                    <Text size="sm" c="yellow.8">
                      🟡 Có phải Thầy/Cô muốn nhập "{emailHienTai.slice(0, emailHienTai.lastIndexOf('@'))}@{goiYDomainEmail}"?
                    </Text>
                    <Button
                      variant="subtle"
                      size="xs"
                      onClick={() =>
                        setValue(
                          'email_lien_he',
                          `${emailHienTai.slice(0, emailHienTai.lastIndexOf('@'))}@${goiYDomainEmail}`,
                          { shouldDirty: true, shouldValidate: true },
                        )
                      }
                    >
                      Dùng gợi ý này
                    </Button>
                  </Group>
                )}
                {hoSo?.email_lien_he && (
                  <Group gap="sm" wrap="wrap">
                    <Badge color={hoSo.email_da_xac_minh ? 'green' : 'yellow'} variant="light">
                      {hoSo.email_da_xac_minh ? 'Đã xác minh' : 'Chưa xác minh'}
                    </Badge>
                    {!hoSo.email_da_xac_minh && (
                      <Button
                        variant="subtle"
                        size="xs"
                        onClick={() => guiLaiXacMinhMutation.mutate()}
                        loading={guiLaiXacMinhMutation.isPending}
                        disabled={guiLaiXacMinhMutation.isSuccess}
                      >
                        Gửi lại email xác minh
                      </Button>
                    )}
                  </Group>
                )}
              </Stack>
            </Card>

            <Card id="section-chuyen-mon" withBorder radius="md">
              <Stack gap="md">
                <Group gap={6}>
                  {coThieu(NHOM_TRUONG.chuyen_mon) && <ChamThieu />}
                  <Text fw={600}>Trình độ &amp; chuyên môn</Text>
                </Group>

                <Controller
                  name="trinh_do_chuyen_mon"
                  control={control}
                  render={({ field }) => (
                    <Select
                      label="Trình độ chuyên môn"
                      data={TRINH_DO_OPTIONS}
                      value={field.value ?? null}
                      onChange={field.onChange}
                      error={loiHoacThieu('trinh_do_chuyen_mon', errors.trinh_do_chuyen_mon?.message, field.value)}
                      disabled={chiXem}
                      required
                    />
                  )}
                />
                {trinhDoHienTai === 'khac' && (
                  <TextInput
                    label="Mô tả trình độ"
                    error={loiHoacThieu('trinh_do_chuyen_mon_khac', errors.trinh_do_chuyen_mon_khac?.message, watch('trinh_do_chuyen_mon_khac'))}
                    disabled={chiXem}
                    {...register('trinh_do_chuyen_mon_khac')}
                  />
                )}

                <TagsInput
                  label="Chuyên môn"
                  data={(goiYQuery.data?.data ?? []).map((t) => ({ value: t, label: t }))}
                  value={chuyenMon}
                  onChange={xuLyDoiChuyenMon}
                  onRemove={xuLyXoaChuyenMon}
                  searchValue={qGoiY}
                  onSearchChange={setQGoiY}
                  disabled={chiXem}
                  required
                />
                {'chuyen_mon' in thieuMap && (
                  <Text size="sm" c="red.7">
                    Cần ít nhất 1 chuyên môn.
                  </Text>
                )}

                <Controller
                  name="cap_giang_day"
                  control={control}
                  render={({ field }) => (
                    <Select
                      label="Cấp giảng dạy"
                      data={CAP_GIANG_DAY_OPTIONS}
                      value={field.value ?? null}
                      onChange={(v) => {
                        field.onChange(v);
                        if (!v) setValue('mon_giang_day_id', null, { shouldDirty: true });
                      }}
                      disabled={chiXem}
                      clearable
                    />
                  )}
                />

                {capGiangDayHienTai && (
                  <Controller
                    name="mon_giang_day_id"
                    control={control}
                    render={({ field }) => (
                      <Select
                        label="Môn giảng dạy"
                        data={(monHocQuery.data?.data ?? []).map((m) => ({ value: m.id, label: m.ten_mon }))}
                        value={field.value ?? null}
                        onChange={field.onChange}
                        nothingFoundMessage={monHocQuery.isLoading ? 'Đang tải…' : 'Không có dữ liệu'}
                        disabled={chiXem}
                      />
                    )}
                  />
                )}
              </Stack>
            </Card>
          </Stack>

          {!chiXem && (
            <Box
              pos="fixed"
              left={0}
              right={0}
              bottom={0}
              p="sm"
              style={{ background: 'var(--mantine-color-body)', borderTop: '1px solid var(--mantine-color-gray-3)', zIndex: 100 }}
            >
              <Container size="sm">
                <Button type="submit" size="lg" fullWidth loading={isSubmitting || luuMutation.isPending} disabled={!isDirty}>
                  Lưu
                </Button>
              </Container>
            </Box>
          )}
            </form>
          </Box>
        </Box>
      </Stack>

      <Modal opened={modalXacNhanLai} onClose={() => setModalXacNhanLai(false)} title="Cần xác nhận lại" centered>
        <Stack gap="md">
          <Text>
            Thầy/Cô đã sửa hồ sơ sau khi xác nhận. Vui lòng xác nhận lại
            {dongLuc ? ` trước ${dinhDangNgayGio(dongLuc)}` : ''}.
          </Text>
          <Button onClick={() => navigate('/toi/xac-nhan')}>Xác nhận lại</Button>
        </Stack>
      </Modal>
    </Container>
  );
}
