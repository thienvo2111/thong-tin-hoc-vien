import { useEffect, useState } from 'react';
import {
  ActionIcon,
  Alert,
  Anchor,
  Button,
  Container,
  Group,
  Modal,
  Paper,
  Radio,
  Select,
  Skeleton,
  Stack,
  Switch,
  Text,
  Textarea,
  TextInput,
  Title,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  layCauHinhKhaoSat,
  layCauHinhKhoa,
  luuCauHinhKhaoSat,
  luuCauHinhKhoa,
  xoaCauHinhKhoa,
  type CauHinhKhaoSat,
  type KetQuaCauHinhKhaoSat,
} from '@/api/cauHinhKhaoSat';
import { useDanhSachKhoa } from '@/api/khoaBoiDuong';
import { SelectDiaDanh } from '@/components/SelectDiaDanh';
import { cauHinhMacDinh } from '@/content/trienKhai';
import { cauHinhKhaoSatSchema } from '@/schemas/cauHinhKhaoSat';
import { chuanHoaNfc } from '@/lib/nfc';
import { loiFieldsThanhMap, thongDiepLoiChung } from '@/lib/loiApi';
import { dinhDangNgayGio } from '@/lib/ngay';
import { AdminPageHeader } from './AdminPageHeader';
import { TheThuSso } from './TheThuSso';
import { TheThangMuc } from './TheThangMuc';

const queryKey = (khoaId: string | null) => ['admin', 'cau-hinh-khao-sat', khoaId ?? 'chung'] as const;

const MAC_DINH_API: CauHinhKhaoSat = {
  che_do_hoc_vien: cauHinhMacDinh.cheDoHocVien,
  danh_gia_dau_vao_trong_cong: cauHinhMacDinh.danhGiaDauVaoTrongCong,
  hien_khao_sat: cauHinhMacDinh.hienKhaoSat,
  kenh_danh_gia: 'vle',
  khao_sat_dau_ra_mo: cauHinhMacDinh.khaoSatDauRaMo,
  phieu: cauHinhMacDinh.phieu.map((p) => ({ ten: p.ten, mo_ta: p.moTa, lien_ket: p.lienKet })),
};

const PHIEU_MOI = { ten: '', mo_ta: '', lien_ket: [{ nhan: 'Mở phiếu', url: '' }] };

function chuanHoa(c: CauHinhKhaoSat): CauHinhKhaoSat {
  return {
    ...c,
    phieu: c.phieu.map((p) => ({
      ten: chuanHoaNfc(p.ten.trim()),
      mo_ta: chuanHoaNfc(p.mo_ta.trim()),
      lien_ket: p.lien_ket.map((lk) => ({ nhan: chuanHoaNfc(lk.nhan.trim()), url: lk.url.trim() })),
    })),
  };
}

/** Cấu hình khảo sát (quan_tri): cấu hình CHUNG làm mặc định + cấu hình RIÊNG tùy chọn theo từng khóa
 * (2026-10-02) khi tỉnh/khóa đó chọn phương án khác. Lưu xong có hiệu lực ngay. */
export default function AdminCauHinhKhaoSat() {
  const [phamVi, setPhamVi] = useState('');
  const khoa = useDanhSachKhoa({ trang_thai: 'da_duyet', page_size: 200 });
  const tuyChon = [
    { value: '', label: 'Cấu hình chung (mặc định cho mọi khóa)' },
    ...(khoa.data?.data ?? []).map((k) => ({ value: k.id, label: `${k.ma_khoa} — ${k.ten_khoa}` })),
  ];

  return (
    <>
      <AdminPageHeader
        title="Cấu hình khảo sát"
        actions={
          <Button component="a" href="/" target="_blank" rel="noopener noreferrer" variant="default">
            Xem trang chủ
          </Button>
        }
      />
      <Container size="md" py="lg">
        <Stack gap="lg">
          <Paper withBorder radius="md" p="lg">
            <Stack gap="xs">
              <Select
                label="Áp dụng cho"
                description="Khóa không có cấu hình riêng dùng cấu hình chung. Học viên nhận cấu hình theo khóa đã ghi danh; trang chủ theo tỉnh người xem chọn."
                data={tuyChon}
                value={phamVi}
                onChange={(v) => setPhamVi(v ?? '')}
                allowDeselect={false}
                searchable
              />
            </Stack>
          </Paper>

          <BieuMauCauHinh key={phamVi || 'chung'} khoaId={phamVi || null} />

          <TheThangMuc />

          <TheThuSso />
        </Stack>
      </Container>
    </>
  );
}

function BieuMauCauHinh({ khoaId }: { khoaId: string | null }) {
  const queryClient = useQueryClient();
  const { data, isLoading, isError, error } = useQuery({
    queryKey: queryKey(khoaId),
    queryFn: () => (khoaId ? layCauHinhKhoa(khoaId) : layCauHinhKhaoSat()),
  });
  const [form, setForm] = useState<CauHinhKhaoSat | null>(null);
  const [tinhId, setTinhId] = useState<string | null>(null);
  const [loi, setLoi] = useState<Record<string, string>>({});
  const [hoiXoa, setHoiXoa] = useState(false);
  const phamVi = data?.pham_vi;

  useEffect(() => {
    if (!data || form) return;
    // Khóa chưa có cấu hình riêng: chờ quản trị bấm "Tạo cấu hình riêng".
    if (khoaId && !data.cau_hinh) return;
    // Cấu hình lưu trước khi có lựa chọn kênh -> 'vle' (đúng hành vi đang chạy).
    setForm({ kenh_danh_gia: 'vle', ...structuredClone(data.cau_hinh ?? MAC_DINH_API) });
    if (data.pham_vi?.loai === 'khoa') setTinhId(data.pham_vi.tinh_id);
  }, [data, form, khoaId]);

  const taoRieng = useMutation({
    mutationFn: () => layCauHinhKhaoSat(),
    onSuccess: (chung) => setForm({ kenh_danh_gia: 'vle', ...structuredClone(chung.cau_hinh ?? MAC_DINH_API) }),
    onError: (err) => notifications.show({ color: 'red', message: thongDiepLoiChung(err) }),
  });

  const xoa = useMutation({
    mutationFn: () => xoaCauHinhKhoa(khoaId!),
    onSuccess: () => {
      // Xóa ngay cấu hình trong cache — nếu chỉ invalidate, effect khởi tạo form sẽ dựng lại form từ dữ
      // liệu cũ trước khi tải lại xong.
      queryClient.setQueryData<KetQuaCauHinhKhaoSat>(queryKey(khoaId), (cu) =>
        cu ? { ...cu, cau_hinh: null, cap_nhat_luc: null } : cu,
      );
      setHoiXoa(false);
      setForm(null);
      setTinhId(null);
      queryClient.invalidateQueries({ queryKey: queryKey(khoaId) });
      notifications.show({ color: 'green', message: 'Khóa đã quay về dùng cấu hình chung' });
    },
    onError: (err) => notifications.show({ color: 'red', message: thongDiepLoiChung(err) }),
  });

  const luu = useMutation({
    mutationFn: (c: CauHinhKhaoSat) => (khoaId ? luuCauHinhKhoa(khoaId, c, tinhId) : luuCauHinhKhaoSat(c)),
    onSuccess: (kq) => {
      queryClient.setQueryData(queryKey(khoaId), kq);
      notifications.show({ color: 'green', message: 'Đã lưu cấu hình khảo sát' });
    },
    onError: (err) => {
      const fields = loiFieldsThanhMap(err);
      setLoi(fields);
      notifications.show({ color: 'red', message: thongDiepLoiChung(err) });
    },
  });

  function xuLyLuu() {
    if (!form) return;
    const kq = cauHinhKhaoSatSchema.safeParse(form);
    if (!kq.success) {
      const map: Record<string, string> = {};
      for (const issue of kq.error.issues) map[issue.path.join('.')] ??= issue.message;
      setLoi(map);
      notifications.show({ color: 'red', message: 'Cấu hình chưa hợp lệ, kiểm tra các ô báo lỗi' });
      return;
    }
    setLoi({});
    luu.mutate(chuanHoa(form));
  }

  function suaPhieu(i: number, sua: (p: CauHinhKhaoSat['phieu'][number]) => CauHinhKhaoSat['phieu'][number]) {
    setForm((f) => f && { ...f, phieu: f.phieu.map((p, j) => (j === i ? sua(p) : p)) });
  }

  function doiCho(i: number, j: number) {
    setForm((f) => {
      if (!f || j < 0 || j >= f.phieu.length) return f;
      const phieu = [...f.phieu];
      [phieu[i], phieu[j]] = [phieu[j], phieu[i]];
      return { ...f, phieu };
    });
  }

  if (isLoading) return <Skeleton h={320} radius="md" />;
  if (isError) return <Alert color="red">{thongDiepLoiChung(error)}</Alert>;
  if (!data) return null;

  if (khoaId && !form) {
    return (
      <Alert color="blue" title={`Khóa ${phamVi?.loai === 'khoa' ? phamVi.ma_khoa : ''} đang dùng cấu hình chung`}>
        <Stack gap="sm">
          <Text fz="sm">Chỉ cần tạo cấu hình riêng khi khóa/tỉnh này chọn phương án khác với cấu hình chung.</Text>
          <Button w="fit-content" onClick={() => taoRieng.mutate()} loading={taoRieng.isPending}>
            Tạo cấu hình riêng (sao chép từ cấu hình chung)
          </Button>
        </Stack>
      </Alert>
    );
  }
  if (!form) return null;

  return (
    <>
          <Stack gap="lg">
            <Group justify="space-between" align="center">
              {data.cau_hinh ? (
                <Text fz="sm" c="dimmed">
                  {data.cap_nhat_luc ? `Cập nhật lần cuối: ${dinhDangNgayGio(data.cap_nhat_luc)}` : ''}
                </Text>
              ) : (
                <Text fz="sm" c="dimmed">
                  {khoaId ? 'Cấu hình riêng chưa lưu' : ''}
                </Text>
              )}
              <Group gap="sm">
                {khoaId && data.cau_hinh && (
                  <Button variant="default" color="red" onClick={() => setHoiXoa(true)}>
                    Dùng lại cấu hình chung
                  </Button>
                )}
                <Button onClick={xuLyLuu} loading={luu.isPending}>
                  Lưu cấu hình
                </Button>
              </Group>
            </Group>

            {!khoaId && !data.cau_hinh && (
              <Alert color="yellow" title="Chưa lưu cấu hình">
                Hệ thống đang dùng giá trị mặc định trong mã nguồn. Nhập đường dẫn rồi bấm "Lưu cấu hình" để áp dụng.
              </Alert>
            )}

            {khoaId && (
              <Paper withBorder radius="md" p="lg">
                <Stack gap="xs">
                  <Title order={2} fz={16}>
                    Hiển thị ở trang chủ
                  </Title>
                  <SelectDiaDanh
                    label="Tỉnh/thành của khóa"
                    placeholder="Không hiện ở trang chủ"
                    cap="tinh_thanh"
                    value={tinhId}
                    onChange={(v) => setTinhId(v)}
                    error={loi.tinh_id}
                    phienBan="hien_tai"
                  />
                  <Text fz="sm" c="dimmed">
                    Người xem trang chủ chọn đúng tỉnh này sẽ thấy cấu hình của khóa. Để trống thì cấu hình chỉ áp dụng
                    cho học viên đã ghi danh khóa. Mỗi tỉnh chỉ gắn một khóa.
                  </Text>
                </Stack>
              </Paper>
            )}

            <Paper withBorder radius="md" p="lg">
              <Stack gap="md">
                <Title order={2} fz={16}>
                  Chế độ cho học viên
                </Title>
                <Radio.Group
                  value={form.che_do_hoc_vien}
                  onChange={(v) => setForm({ ...form, che_do_hoc_vien: v as CauHinhKhaoSat['che_do_hoc_vien'] })}
                  label="Học viên vào hệ thống bằng cách nào?"
                >
                  <Stack gap="sm" mt="xs">
                    <Radio
                      value="khao_sat"
                      label="Khảo sát (chưa mở đăng nhập)"
                      description="Trang chủ mời học viên làm lần lượt các phiếu bên dưới. Trang đăng nhập vẫn mở bình thường."
                    />
                    <Radio
                      value="dang_nhap"
                      label="Đăng nhập cổng học viên"
                      description="Trang chủ mời đăng nhập. Học viên chỉ sửa được hồ sơ khi có Đợt xác nhận đang mở."
                    />
                  </Stack>
                </Radio.Group>
                <Radio.Group
                  value={form.kenh_danh_gia ?? 'vle'}
                  onChange={(v) => setForm({ ...form, kenh_danh_gia: v as CauHinhKhaoSat['kenh_danh_gia'] })}
                  label="Kênh làm bài đánh giá đầu vào (mục Đánh giá đầu vào của học viên)"
                >
                  <Stack gap="sm" mt="xs">
                    <Radio
                      value="sso"
                      label="Trang khảo sát (đăng nhập một lần)"
                      description="Hồ sơ đầy đủ là làm được. Học viên bấm nút, hệ thống chuyển sang trang khảo sát kèm mã dùng một lần — không cần đợt xác nhận hay tài khoản VLE."
                    />
                    <Radio
                      value="vle"
                      label="Tài khoản VLE"
                      description="Cần đã xác nhận hồ sơ ở đợt xác nhận trước đánh giá và có tài khoản VLE (nhập qua Nhập dữ liệu)."
                    />
                  </Stack>
                </Radio.Group>
                <Switch
                  checked={form.danh_gia_dau_vao_trong_cong}
                  onChange={(e) => setForm({ ...form, danh_gia_dau_vao_trong_cong: e.currentTarget.checked })}
                  label='Hiện mục "Đánh giá đầu vào" trong cổng học viên'
                  description="Tắt khi đánh giá đầu vào làm qua phiếu khảo sát bên ngoài."
                />
                <Switch
                  checked={form.khao_sat_dau_ra_mo ?? false}
                  onChange={(e) => setForm({ ...form, khao_sat_dau_ra_mo: e.currentTarget.checked })}
                  label="Mở khảo sát đầu ra"
                  description="Trang chủ học viên hiện mục Khảo sát đầu ra. Hồ sơ đầy đủ là bấm sang trang khảo sát được (đăng nhập một lần)."
                />
              </Stack>
            </Paper>

            <Paper withBorder radius="md" p="lg">
              <Stack gap="md">
                <Title order={2} fz={16}>
                  Phiếu khảo sát trên trang chủ
                </Title>
                <Switch
                  checked={form.hien_khao_sat}
                  onChange={(e) => setForm({ ...form, hien_khao_sat: e.currentTarget.checked })}
                  label="Hiện khối khảo sát trên trang chủ"
                  error={loi.hien_khao_sat}
                />
                <Text fz="sm" c="dimmed">
                  Học viên làm theo đúng thứ tự dưới đây. Đường dẫn để trống sẽ hiện nút bị khóa "Đường dẫn đang được
                  cập nhật". Tách phiếu theo đối tượng: thêm nhiều đường dẫn, mỗi đường dẫn một nhãn (vd "Dành cho giáo
                  viên", "Dành cho cán bộ quản lý").
                </Text>
                {loi.phieu && (
                  <Text c="red" fz="sm">
                    {loi.phieu}
                  </Text>
                )}

                {form.phieu.map((p, i) => (
                  <Paper key={i} withBorder radius="md" p="md" bg="gray.0">
                    <Stack gap="sm">
                      <Group justify="space-between">
                        <Text fw={700}>Phiếu {i + 1}</Text>
                        <Group gap={4}>
                          <ActionIcon variant="subtle" onClick={() => doiCho(i, i - 1)} disabled={i === 0} aria-label={`Đưa phiếu ${i + 1} lên trước`}>
                            ↑
                          </ActionIcon>
                          <ActionIcon
                            variant="subtle"
                            onClick={() => doiCho(i, i + 1)}
                            disabled={i === form.phieu.length - 1}
                            aria-label={`Đưa phiếu ${i + 1} xuống sau`}
                          >
                            ↓
                          </ActionIcon>
                          <ActionIcon
                            variant="subtle"
                            color="red"
                            onClick={() => setForm({ ...form, phieu: form.phieu.filter((_, j) => j !== i) })}
                            aria-label={`Xóa phiếu ${i + 1}`}
                          >
                            ✕
                          </ActionIcon>
                        </Group>
                      </Group>
                      <TextInput
                        label="Tên phiếu"
                        value={p.ten}
                        onChange={(e) => {
                          const ten = e.currentTarget.value;
                          suaPhieu(i, (x) => ({ ...x, ten }));
                        }}
                        error={loi[`phieu.${i}.ten`]}
                      />
                      <Textarea
                        label="Mô tả ngắn"
                        autosize
                        minRows={2}
                        value={p.mo_ta}
                        onChange={(e) => {
                          const mo_ta = e.currentTarget.value;
                          suaPhieu(i, (x) => ({ ...x, mo_ta }));
                        }}
                        error={loi[`phieu.${i}.mo_ta`]}
                      />
                      {p.lien_ket.map((lk, k) => (
                        <Group key={k} align="flex-start" gap="sm" wrap="nowrap">
                          <TextInput
                            label={`Nhãn nút ${k + 1}`}
                            value={lk.nhan}
                            w={200}
                            onChange={(e) => {
                              const nhan = e.currentTarget.value;
                              suaPhieu(i, (x) => ({
                                ...x,
                                lien_ket: x.lien_ket.map((y, m) => (m === k ? { ...y, nhan } : y)),
                              }));
                            }}
                            error={loi[`phieu.${i}.lien_ket.${k}.nhan`]}
                          />
                          <TextInput
                            label={`Đường dẫn ${k + 1}`}
                            placeholder="https://forms.gle/..."
                            value={lk.url}
                            style={{ flex: 1 }}
                            onChange={(e) => {
                              const url = e.currentTarget.value;
                              suaPhieu(i, (x) => ({
                                ...x,
                                lien_ket: x.lien_ket.map((y, m) => (m === k ? { ...y, url } : y)),
                              }));
                            }}
                            error={loi[`phieu.${i}.lien_ket.${k}.url`]}
                          />
                          <ActionIcon
                            mt={26}
                            variant="subtle"
                            color="red"
                            disabled={p.lien_ket.length === 1}
                            onClick={() => suaPhieu(i, (x) => ({ ...x, lien_ket: x.lien_ket.filter((_, m) => m !== k) }))}
                            aria-label={`Xóa đường dẫn ${k + 1} của phiếu ${i + 1}`}
                          >
                            ✕
                          </ActionIcon>
                        </Group>
                      ))}
                      {loi[`phieu.${i}.lien_ket`] && (
                        <Text c="red" fz="sm">
                          {loi[`phieu.${i}.lien_ket`]}
                        </Text>
                      )}
                      <Anchor
                        component="button"
                        type="button"
                        fz="sm"
                        ta="left"
                        disabled={p.lien_ket.length >= 5}
                        onClick={() => suaPhieu(i, (x) => ({ ...x, lien_ket: [...x.lien_ket, { nhan: '', url: '' }] }))}
                      >
                        + Thêm đường dẫn
                      </Anchor>
                    </Stack>
                  </Paper>
                ))}

                <Button
                  variant="light"
                  onClick={() => setForm({ ...form, phieu: [...form.phieu, structuredClone(PHIEU_MOI)] })}
                  disabled={form.phieu.length >= 10}
                >
                  + Thêm phiếu
                </Button>
              </Stack>
            </Paper>
          </Stack>

      <Modal opened={hoiXoa} onClose={() => setHoiXoa(false)} title="Dùng lại cấu hình chung?" centered>
        <Stack gap="md">
          <Text fz="sm">
            Cấu hình riêng của khóa này sẽ bị xóa. Học viên của khóa và người xem trang chủ chọn tỉnh này sẽ nhận cấu
            hình chung.
          </Text>
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setHoiXoa(false)}>
              Hủy
            </Button>
            <Button color="red" onClick={() => xoa.mutate()} loading={xoa.isPending}>
              Xóa cấu hình riêng
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}
