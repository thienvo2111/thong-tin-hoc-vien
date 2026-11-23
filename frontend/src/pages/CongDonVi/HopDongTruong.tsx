import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Alert,
  Anchor,
  Badge,
  Button,
  Checkbox,
  Container,
  Group,
  Modal,
  Paper,
  Skeleton,
  Stack,
  Text,
  TextInput,
  Textarea,
  Title,
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import 'dayjs/locale/vi';
import { notifications } from '@mantine/notifications';
import { ApiError } from '@/api/client';
import { useHopDongTruong, useLuuNhapHopDong, useNopHopDong, type HopDongPhanHoi } from '@/api/hopDong';
import { NHAN_TRUONG_HOP_DONG, TRUONG_NHAP_HOP_DONG, type TruongNhapHopDong } from '@/lib/hopDong';
import { loiFieldsThanhMap, thongDiepLoiChung, thongDiepLoiXungDot } from '@/lib/loiApi';
import { dinhDangNgayGio } from '@/lib/ngay';
import { SDT_HO_TRO_CONG_DON_VI, laLoiHetHan, thongBaoChiXemHetHan } from '@/lib/hanNop';
import { chuoiSangNgay, dinhDangNgayLich, docNgayGo } from '@/lib/ngayLich';
import { formSangNhap, hopDongSchema, type HopDongForm } from '@/schemas/hopDong';
import { NHAN_CHUONG_TRINH_NGAN, TRANG_THAI_HOP_DONG } from './hopDongNhan';
import { HopChuyenKhoan } from './HoSoDonViChung';
import { DanhSachLyDoChan, SoLieuHopDong, ThongTinPhan34 } from './HopDongChung';

const XAC_NHAN_NOP = 'Sau khi nộp, danh sách và thông tin hợp đồng chỉ xem được. Cần sửa phải liên hệ HCMUE mở lại.';

function formTu(d: HopDongPhanHoi): HopDongForm {
  return {
    nguoi_nhan: d.phan_3.nguoi_nhan ?? '',
    sdt_nguoi_nhan: d.phan_3.sdt_nguoi_nhan ?? '',
    dia_chi_nhan: d.phan_3.dia_chi_nhan ?? '',
    ghi_chu: d.phan_3.ghi_chu ?? '',
    so_qd: d.phan_4.so_qd ?? '',
    ngay_qd: chuoiSangNgay(d.phan_4.ngay_qd),
    diem_hoc_truc_tiep: d.diem_hoc_truc_tiep,
  };
}

/** "Ngày QĐ từ dd/mm/yyyy đến dd/mm/yyyy" (S6) hoặc báo đợt chưa cấu hình. */
function goiYNgayQd(d: HopDongPhanHoi): string {
  const { ngay_qd_tu: tu, ngay_qd_den: den } = d.dot;
  if (!tu || !den) return 'Đợt chưa cấu hình khoảng ngày QĐ — chờ HCMUE';
  return `Ngày QĐ từ ${dinhDangNgayLich(tu)} đến ${dinhDangNgayLich(den)}`;
}

/** Màn "Thông tin hợp đồng" của trường (issue #64, ADR 0015 U1, X4, M5, S5, S6): số liệu, hồ sơ đơn vị,
 * Phần 3 (người nhận bản giấy), Phần 4 (QĐ chỉ định thầu, khi ≥ 50.000.000 đ), lưu nháp và Nộp hợp đồng.
 * Đã nộp → chỉ xem, số liệu + chuyển khoản lấy từ bản chụp lúc nộp. */
export default function HopDongTruong() {
  const { dotId = '' } = useParams();
  const { data, isLoading, isError, error, refetch, isFetching } = useHopDongTruong(dotId);
  const khongThay = error instanceof ApiError && error.status === 404;

  return (
    <Container size="sm" py="lg" px="md">
      <Stack gap="md">
        <Anchor component={Link} to="/trang-chu" size="sm">
          ← Trang chủ
        </Anchor>

        {isLoading && (
          <Stack gap="sm" aria-label="Đang tải">
            <Skeleton height={56} radius="md" />
            <Skeleton height={120} radius="md" />
            <Skeleton height={240} radius="md" />
          </Stack>
        )}

        {isError && khongThay && (
          <Paper withBorder radius="md" p="md">
            <Text>Không tìm thấy hợp đồng của trường cho đợt này</Text>
          </Paper>
        )}

        {isError && !khongThay && (
          <Alert color="red" title="Không tải được thông tin hợp đồng">
            <Stack gap="sm" align="flex-start">
              <Text size="sm">{thongDiepLoiChung(error)}</Text>
              <Button size="sm" variant="light" color="red" onClick={() => refetch()} loading={isFetching}>
                Thử lại
              </Button>
            </Stack>
          </Alert>
        )}

        {data && <NoiDung dotId={dotId} data={data} />}
      </Stack>
    </Container>
  );
}

function NoiDung({ dotId, data }: { dotId: string; data: HopDongPhanHoi }) {
  const daNop = data.trang_thai_hop_dong === 'da_nop';
  // Issue #66 / T2: hết hạn (server da_het_han) → chỉ xem như đã nộp: không form, không Lưu nháp / Nộp.
  const hetHan = data.da_het_han && !daNop;
  const hd = TRANG_THAI_HOP_DONG[data.trang_thai_hop_dong];
  return (
    <>
      <Stack gap={4}>
        <Group gap="xs">
          <Badge variant="filled">{NHAN_CHUONG_TRINH_NGAN[data.dot.chuong_trinh]}</Badge>
          <Badge color={hd.mau} variant="light" aria-label={`Trạng thái hợp đồng: ${hd.nhan}`}>
            {hd.nhan}
          </Badge>
        </Group>
        <Title order={1} size="h3" style={{ overflowWrap: 'anywhere' }}>
          Thông tin hợp đồng — {data.dot.ten}
        </Title>
        <Text size="sm" c="dimmed">
          Hạn nộp: {dinhDangNgayLich(data.dot.han_nop_ngay)}
        </Text>
      </Stack>

      {daNop && data.nop_luc && (
        <Alert color="green" title={`Đã nộp lúc ${dinhDangNgayGio(data.nop_luc)}`}>
          Danh sách và thông tin hợp đồng chỉ xem được. Cần sửa phải liên hệ HCMUE mở lại.
        </Alert>
      )}

      {hetHan && (
        <Alert color="red" role="status">
          {thongBaoChiXemHetHan(data.han_hieu_luc_ngay, SDT_HO_TRO_CONG_DON_VI)}
        </Alert>
      )}

      <SoLieuHopDong data={data} />
      <HoSoVaChuyenKhoan data={data} />

      {daNop || hetHan ? (
        <ThongTinPhan34 data={data} />
      ) : (
        <FormHopDong key={data.nop_luc ?? 'nhap'} dotId={dotId} data={data} />
      )}
    </>
  );
}

function HoSoVaChuyenKhoan({ data }: { data: HopDongPhanHoi }) {
  const daNop = data.trang_thai_hop_dong === 'da_nop';
  const { du, so_thieu } = data.ho_so_tinh_trang;
  return (
    <Paper withBorder radius="md" p="md" component="section" aria-label="Hồ sơ đơn vị">
      <Stack gap="sm">
        <Group justify="space-between" wrap="nowrap" align="flex-start" gap="sm">
          <div>
            <Text fw={600}>Hồ sơ đơn vị</Text>
            {daNop && (
              <Text size="sm" c="dimmed">
                Bản chụp lúc nộp — sửa hồ sơ sau này không đổi hợp đồng đã nộp
              </Text>
            )}
          </div>
          <Badge color={du ? 'green' : 'orange'} variant="light" style={{ flexShrink: 0 }}>
            {du ? 'Đủ thông tin' : `Còn thiếu ${so_thieu} mục`}
          </Badge>
        </Group>
        <Button component={Link} to="/ho-so-don-vi" variant="light" fullWidth justify="space-between">
          Xem / sửa hồ sơ đơn vị
        </Button>
        <HopChuyenKhoan stk={data.chuyen_khoan?.stk ?? null} />
      </Stack>
    </Paper>
  );
}

function FormHopDong({ dotId, data }: { dotId: string; data: HopDongPhanHoi }) {
  const luu = useLuuNhapHopDong(dotId);
  const nop = useNopHopDong(dotId);
  const [loiChung, setLoiChung] = useState<string | null>(null);
  const [moNop, setMoNop] = useState(false);
  const {
    register,
    control,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isDirty },
  } = useForm<HopDongForm>({ resolver: zodResolver(hopDongSchema), defaultValues: formTu(data) });

  function onSubmit(v: HopDongForm) {
    setLoiChung(null);
    luu.mutate(formSangNhap(v), {
      onSuccess: (kq) => {
        reset(formTu(kq));
        notifications.show({ color: 'green', message: 'Đã lưu nháp thông tin hợp đồng' });
      },
      onError: (err) => {
        // Issue #66: hết hạn → form sẽ được thay bằng chế độ chỉ xem (tải lại) — báo bằng thông báo nổi.
        if (laLoiHetHan(err)) notifications.show({ color: 'red', message: thongDiepLoiXungDot(err) });
        setLoiChung(thongDiepLoiXungDot(err));
        for (const [field, message] of Object.entries(loiFieldsThanhMap(err))) {
          if ((TRUONG_NHAP_HOP_DONG as readonly string[]).includes(field)) {
            setError(field as TruongNhapHopDong, { message });
          }
        }
      },
    });
  }

  function guiNop() {
    nop.mutate(undefined, {
      onSuccess: () => {
        setMoNop(false);
        notifications.show({ color: 'green', message: 'Đã nộp hợp đồng' });
      },
      onError: (err) => {
        if (laLoiHetHan(err)) notifications.show({ color: 'red', message: thongDiepLoiXungDot(err) });
      },
    });
  }

  const o = (k: TruongNhapHopDong) => ({ ...register(k), label: NHAN_TRUONG_HOP_DONG[k], error: errors[k]?.message });
  const coLyDo = data.ly_do_chan.length > 0;

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <Stack gap="md">
        <Paper withBorder radius="md" p="md">
          <Checkbox
            {...register('diem_hoc_truc_tiep')}
            label="Trường là điểm học trực tiếp"
            description="Khi chọn, cần khai đủ mục Hậu cần cơ sở trong Hồ sơ đơn vị trước khi nộp"
          />
        </Paper>

        <Paper withBorder radius="md" p="md" component="section" aria-labelledby="phan-3">
          <Stack gap="sm">
            <Title order={2} size="h4" id="phan-3">
              Phần 3 — Người nhận bản giấy hợp đồng
            </Title>
            <TextInput {...o('nguoi_nhan')} withAsterisk autoComplete="off" />
            <TextInput {...o('sdt_nguoi_nhan')} withAsterisk inputMode="numeric" autoComplete="off" />
            <Textarea {...o('dia_chi_nhan')} withAsterisk autosize minRows={2} />
            <Textarea {...o('ghi_chu')} autosize minRows={2} />
          </Stack>
        </Paper>

        {data.can_phan_4 && (
          <Paper withBorder radius="md" p="md" component="section" aria-labelledby="phan-4">
            <Stack gap="sm">
              <div>
                <Title order={2} size="h4" id="phan-4">
                  Phần 4 — Quyết định chỉ định thầu
                </Title>
                <Text size="sm" c="dimmed">
                  Bắt buộc với hợp đồng từ 50.000.000 đ
                </Text>
              </div>
              <TextInput {...o('so_qd')} withAsterisk autoComplete="off" />
              <Controller
                control={control}
                name="ngay_qd"
                render={({ field }) => (
                  <DateInput
                    label={NHAN_TRUONG_HOP_DONG.ngay_qd}
                    withAsterisk
                    description={goiYNgayQd(data)}
                    valueFormat="DD/MM/YYYY"
                    dateParser={docNgayGo}
                    placeholder="dd/mm/yyyy"
                    locale="vi"
                    clearable
                    popoverProps={{ withinPortal: true }}
                    value={field.value}
                    onChange={field.onChange}
                    error={errors.ngay_qd?.message}
                  />
                )}
              />
            </Stack>
          </Paper>
        )}

        {loiChung && <Alert color="red">{loiChung}</Alert>}
        <Button type="submit" variant="default" loading={luu.isPending} fullWidth>
          Lưu nháp
        </Button>

        <Paper withBorder radius="md" p="md" component="section" aria-label="Nộp hợp đồng">
          <Stack gap="sm">
            {coLyDo && <DanhSachLyDoChan id="ly-do-chan" lyDo={data.ly_do_chan} />}
            {!coLyDo && isDirty && (
              <Text size="sm" c="dimmed">
                Có thay đổi chưa lưu — bấm "Lưu nháp" trước khi nộp.
              </Text>
            )}
            <Button
              fullWidth
              disabled={!data.co_the_nop || isDirty}
              aria-describedby={coLyDo ? 'ly-do-chan' : undefined}
              onClick={() => {
                nop.reset();
                setMoNop(true);
              }}
            >
              Nộp hợp đồng
            </Button>
          </Stack>
        </Paper>
      </Stack>

      <Modal opened={moNop} onClose={() => setMoNop(false)} title="Nộp hợp đồng" centered>
        <Stack gap="sm">
          {nop.isError && <LoiNop err={nop.error} />}
          <Text size="sm">{XAC_NHAN_NOP}</Text>
          <Group justify="flex-end" gap="sm">
            <Button variant="default" onClick={() => setMoNop(false)}>
              Hủy
            </Button>
            <Button loading={nop.isPending} onClick={guiNop}>
              Nộp
            </Button>
          </Group>
        </Stack>
      </Modal>
    </form>
  );
}

/** 400 → danh sách lý do chặn do server tính lại; 409/khác → thông điệp server. */
function LoiNop({ err }: { err: unknown }) {
  const lyDo = err instanceof ApiError && err.status === 400 ? err.fields : [];
  return (
    <Alert color="red" role="alert" title={lyDo.length ? 'Chưa nộp được hợp đồng' : undefined}>
      {lyDo.length ? (
        <Stack component="ul" gap={2} m={0} pl="md">
          {lyDo.map((l) => (
            <Text component="li" key={l.field} size="sm">
              {l.message}
            </Text>
          ))}
        </Stack>
      ) : (
        thongDiepLoiXungDot(err)
      )}
    </Alert>
  );
}
