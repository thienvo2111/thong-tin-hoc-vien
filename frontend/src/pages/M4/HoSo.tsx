import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Controller, useForm, type FieldErrors, type Resolver } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useBlocker, useLocation, useNavigate } from 'react-router-dom';
import { useDebouncedValue } from '@mantine/hooks';
import {
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
  chuanHoaHoTen,
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
  noi_sinh: ['noi_sinh_id', 'phuong_xa_id'],
  cong_tac: ['don_vi_cong_tac_id', 'chuc_vu', 'so_dien_thoai_lien_he'],
  lien_he: ['email_lien_he'],
  chuyen_mon: ['trinh_do_chuyen_mon', 'trinh_do_chuyen_mon_khac', 'cap_giang_day', 'mon_giang_day_id', 'chuyen_mon'],
} as const;

const NHOM_NGAY_SINH = new Set(['ngay_sinh', 'thang_sinh', 'nam_sinh']);

function toFormValues(hoSo: HocVien | undefined): HoSoHocVienForm {
  return {
    ho_ten: hoSo?.ho_ten ?? '',
    ngay_sinh: (hoSo?.ngay_sinh ?? undefined) as unknown as number,
    thang_sinh: (hoSo?.thang_sinh ?? undefined) as unknown as number,
    nam_sinh: (hoSo?.nam_sinh ?? undefined) as unknown as number,
    gioi_tinh: hoSo?.gioi_tinh ?? null,
    so_dinh_danh_ca_nhan: hoSo?.so_dinh_danh_ca_nhan ?? '',
    noi_sinh_id: hoSo?.noi_sinh_id ?? '',
    phuong_xa_id: hoSo?.phuong_xa_id ?? '',
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

  const coThieu = (truong: readonly string[]) => truong.some((f) => f in thieuMap);
  /** Lỗi validate (nếu có) được ưu tiên; nếu không, đánh dấu "Cần bổ sung" khi trường nằm trong muc-do-day-du.thieu. */
  function loiHoacThieu(truong: string, rhfMessage?: string): string | undefined {
    return rhfMessage ?? (thieuMap[truong] ? 'Cần bổ sung' : undefined);
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
    <Container size="sm" py="xl" pb={96}>
      <Stack gap="lg">
        <Title order={1} size="h2">
          Hồ sơ của tôi
        </Title>

        {chiXem && (
          <StatusBanner loai="info">Hiện không trong thời gian chỉnh sửa hồ sơ — mọi thông tin ở chế độ chỉ xem.</StatusBanner>
        )}

        <form
          onSubmit={handleSubmit(onSubmit)}
          noValidate
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.target as HTMLElement).tagName !== 'TEXTAREA') e.preventDefault();
          }}
        >
          <Stack gap="lg">
            <Card withBorder radius="md">
              <Stack gap="md">
                <Group gap={6}>
                  {coThieu(NHOM_TRUONG.ca_nhan) && <ChamThieu />}
                  <Text fw={600}>Thông tin cá nhân</Text>
                </Group>

                <TextInput label="Mã định danh" value={hoSo?.ma_dinh_danh_moet ?? ''} disabled readOnly />

                <TextInput
                  label="Họ và tên"
                  error={loiHoacThieu('ho_ten', errors.ho_ten?.message)}
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

                <Group grow>
                  <TextInput
                    label="Ngày sinh"
                    inputMode="numeric"
                    maxLength={2}
                    error={loiHoacThieu('ngay_sinh', errors.ngay_sinh?.message)}
                    disabled={chiXem}
                    {...register('ngay_sinh')}
                  />
                  <TextInput
                    label="Tháng sinh"
                    inputMode="numeric"
                    maxLength={2}
                    error={loiHoacThieu('thang_sinh', errors.thang_sinh?.message)}
                    disabled={chiXem}
                    {...register('thang_sinh')}
                  />
                  <TextInput
                    label="Năm sinh"
                    inputMode="numeric"
                    maxLength={4}
                    error={loiHoacThieu('nam_sinh', errors.nam_sinh?.message)}
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
                  error={loiHoacThieu('so_dinh_danh_ca_nhan', errors.so_dinh_danh_ca_nhan?.message)}
                  disabled={chiXem}
                  {...register('so_dinh_danh_ca_nhan', { onBlur: xuLyBlurCccd })}
                />

                <Text size="xs" c="dimmed">
                  Thông tin lấy từ danh sách của ngành. Nếu chưa đúng, Thầy/Cô sửa lại cho chính xác — thông tin này sẽ
                  in trên giấy chứng nhận.
                </Text>
              </Stack>
            </Card>

            <Card withBorder radius="md">
              <Stack gap="md">
                <Group gap={6}>
                  {coThieu(NHOM_TRUONG.noi_sinh) && <ChamThieu />}
                  <Text fw={600}>Nơi sinh &amp; cư trú</Text>
                </Group>

                <Controller
                  name="noi_sinh_id"
                  control={control}
                  render={({ field }) => (
                    <SelectDiaDanh
                      label="Nơi sinh (tỉnh/thành)"
                      cap="tinh_thanh"
                      value={field.value || null}
                      onChange={(id) => {
                        if (id !== field.value) setValue('phuong_xa_id', '', { shouldDirty: true });
                        field.onChange(id ?? '');
                      }}
                      error={loiHoacThieu('noi_sinh_id', errors.noi_sinh_id?.message)}
                      disabled={chiXem}
                      required
                    />
                  )}
                />

                <Controller
                  name="phuong_xa_id"
                  control={control}
                  render={({ field }) => (
                    <SelectDiaDanh
                      label="Phường/xã"
                      cap="phuong_xa_dac_khu"
                      parentId={watch('noi_sinh_id') || null}
                      value={field.value || null}
                      onChange={(id) => field.onChange(id ?? '')}
                      error={loiHoacThieu('phuong_xa_id', errors.phuong_xa_id?.message)}
                      disabled={chiXem}
                      required
                    />
                  )}
                />
              </Stack>
            </Card>

            <Card withBorder radius="md">
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
                      onChange={(id) => field.onChange(id ?? '')}
                      error={loiHoacThieu('don_vi_cong_tac_id', errors.don_vi_cong_tac_id?.message)}
                      disabled={chiXem}
                      required
                    />
                  )}
                />

                <TextInput label="Chức vụ" disabled={chiXem} {...register('chuc_vu')} />

                <TextInput
                  label="Số điện thoại"
                  inputMode="numeric"
                  maxLength={10}
                  error={loiHoacThieu('so_dien_thoai_lien_he', errors.so_dien_thoai_lien_he?.message)}
                  disabled={chiXem}
                  {...register('so_dien_thoai_lien_he')}
                />
              </Stack>
            </Card>

            <Card withBorder radius="md">
              <Stack gap="md">
                <Group gap={6}>
                  {coThieu(NHOM_TRUONG.lien_he) && <ChamThieu />}
                  <Text fw={600}>Liên hệ</Text>
                </Group>
                <TextInput
                  label="Email"
                  description="Hệ thống gửi bản sao hồ sơ và thông báo lớp học qua email này"
                  type="email"
                  error={loiHoacThieu('email_lien_he', errors.email_lien_he?.message)}
                  disabled={chiXem}
                  {...register('email_lien_he')}
                />
              </Stack>
            </Card>

            <Card withBorder radius="md">
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
                      error={loiHoacThieu('trinh_do_chuyen_mon', errors.trinh_do_chuyen_mon?.message)}
                      disabled={chiXem}
                      required
                    />
                  )}
                />
                {trinhDoHienTai === 'khac' && (
                  <TextInput
                    label="Mô tả trình độ"
                    error={loiHoacThieu('trinh_do_chuyen_mon_khac', errors.trinh_do_chuyen_mon_khac?.message)}
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
