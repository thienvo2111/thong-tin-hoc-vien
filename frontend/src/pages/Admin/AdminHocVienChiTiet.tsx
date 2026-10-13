import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Alert, Box, Button, Container, Group, Modal, Paper, Select, Skeleton, Stack, Table, Text, TextInput, Textarea } from '@mantine/core';
import { useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import {
  anhHuongXoaKey,
  useAnhHuongXoaHocVien,
  useHocVienTheoId,
  useSuaMaDinhDanhMoet,
  useXoaHocVien,
  type AnhHuongXoaHocVien,
} from '@/api/admin';
import { useNhatKyHocVien } from '@/api/taiKhoanHocVien';
import { useToi } from '@/auth/AuthContext';
import { DongThoiGianNhatKy } from '@/components/DongThoiGianNhatKy';
import {
  useCapNhatCumDangKy,
  useCapNhatMucHoc,
  useChiTietKhoa,
  useGhiDanhLe,
  useKhoaHocCuaHocVien,
} from '@/api/khoaBoiDuong';
import type { KhoaHocDangKy, MucNangLuc } from '@/api/types';
import { cacMucDuocChon, nhanMucNangLuc, nhuCauMucHoc } from '@/lib/mucNangLuc';
import { CacNguonMucHoc } from '@/components/CacNguonMucHoc';
import { loiFieldsThanhMap, thongDiepLoiChung, thongDiepLoiXungDot } from '@/lib/loiApi';
import { chuanHoaNfc } from '@/lib/nfc';
import { nhanCuaTruong } from '@/lib/nhanTruong';
import { TrangThaiBadge } from '@/components/TrangThaiBadge';
import { AdminPageHeader } from './AdminPageHeader';
import { PhanLopTheoGiaiDoan } from './PhanLopTheoGiaiDoan';
import { ChonKhoaVaCum } from './ChonKhoaVaCum';

// Placeholder tối thiểu cho phase này (yêu cầu phase 3 mục 4: "chưa cần đẹp, sẽ hoàn thiện ở phase
// sau") — hiện vài field chính từ GET /hoc-vien/{id}, không phải màn chi tiết đầy đủ.
const TRUONG_HIEN_THI = [
  'ma_dinh_danh_moet',
  'so_dinh_danh_ca_nhan',
  'ngay_sinh',
  'thang_sinh',
  'nam_sinh',
  'gioi_tinh',
  'chuc_vu',
  'doi_tuong',
  'so_dien_thoai_lien_he',
  'email_lien_he',
  'trinh_do_chuyen_mon',
  'cap_giang_day',
] as const;

export default function AdminHocVienChiTiet() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading, isError, error } = useHocVienTheoId(id);
  const { nguoiDung } = useToi();

  return (
    <>
      <AdminPageHeader title="Chi tiết hồ sơ học viên" />
      <Container size="sm" py="lg" px={{ base: 'md', md: 28 }}>
        {isLoading && (
          <Stack gap="sm">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} height={20} />
            ))}
          </Stack>
        )}

        {isError && <Alert color="red">{thongDiepLoiChung(error)}</Alert>}

        {data && (
          <Paper withBorder radius={14} p="lg">
            <Group justify="space-between" mb="md">
              <Text fz={18} fw={700}>
                {data.ho_ten ?? '(Chưa có tên)'}
              </Text>
              <TrangThaiBadge trangThai={data.trang_thai} />
            </Group>
            <Text fz={13} c="dimmed" mb="lg">
              {data.don_vi_cong_tac_ten ?? data.don_vi_cong_tac_id ?? '—'}
            </Text>

            <Stack gap="xs">
              {TRUONG_HIEN_THI.map((truong) => (
                <Group key={truong} justify="space-between" py={6} style={{ borderBottom: '1px solid #F1F3F6' }}>
                  <Text fz={13} c="dimmed">
                    {nhanCuaTruong(truong)}
                  </Text>
                  <Text fz={13} fw={600}>
                    {String(data[truong] ?? '—')}
                  </Text>
                </Group>
              ))}
            </Stack>

            {nguoiDung?.vai_tro === 'quan_tri' && (
              <SuaMaMoet hocVienId={data.id} maHienTai={data.ma_dinh_danh_moet} />
            )}
          </Paper>
        )}

        {id && (
          <Paper withBorder radius={14} p="lg" mt="lg">
            <Text fz={16} fw={700} mb="md">
              Khóa & lớp
            </Text>
            <KhoaVaLopCuaHocVien
              hocVienId={id}
              choGhiDanh={nguoiDung?.vai_tro === 'quan_tri' && data?.trang_thai === 'da_duyet'}
            />
          </Paper>
        )}

        {/* Chỉ quản trị: API trả 403 cho tài khoản đơn vị (có IP/thiết bị). */}
        {id && nguoiDung?.vai_tro === 'quan_tri' && (
          <Paper withBorder radius={14} p="lg" mt="lg">
            <Text fz={16} fw={700} mb={4}>
              Nhật ký hoạt động
            </Text>
            <Text fz={13} c="dimmed" mb="md">
              Đăng nhập, sửa hồ sơ, xác nhận, khảo sát, kết quả, phân lớp, email, hỗ trợ — dùng để đối chiếu khi học
              viên phản ánh.
            </Text>
            <NhatKyCuaHocVien hocVienId={id} />
          </Paper>
        )}

        {data && nguoiDung?.vai_tro === 'quan_tri' && (
          <XoaHocVien hocVienId={data.id} hoTen={data.ho_ten ?? ''} maMoet={data.ma_dinh_danh_moet} />
        )}
      </Container>
    </>
  );
}

// Spec 2026-10-09 Q-E: Quản trị sửa mã định danh MOET (vd mã bị mất số 0 / sai từ Sở). Trang không có dữ
// liệu khảo sát của học viên nên không khóa trước nút Lưu — backend trả 409 "đã vào hệ thống khảo sát".
function SuaMaMoet({ hocVienId, maHienTai }: { hocVienId: string; maHienTai: string | null }) {
  const [mo, setMo] = useState(false);
  const [ma, setMa] = useState('');
  const [lyDo, setLyDo] = useState('');
  const [loi, setLoi] = useState<{ ma?: string; lyDo?: string }>({});
  const suaMa = useSuaMaDinhDanhMoet(hocVienId);

  function moModal() {
    setMa(maHienTai ?? '');
    setLyDo('');
    setLoi({});
    suaMa.reset();
    setMo(true);
  }

  function luu() {
    const maSach = ma.trim();
    const lyDoSach = chuanHoaNfc(lyDo.trim());
    const loiMoi: { ma?: string; lyDo?: string } = {};
    if (!maSach) loiMoi.ma = 'Vui lòng nhập mã định danh MOET';
    else if (!/^\d+$/.test(maSach)) loiMoi.ma = 'Mã định danh MOET chỉ gồm chữ số';
    else if (maSach.length > 20) loiMoi.ma = 'Mã định danh MOET tối đa 20 chữ số';
    if (!lyDoSach) loiMoi.lyDo = 'Bắt buộc nhập lý do';
    setLoi(loiMoi);
    if (loiMoi.ma || loiMoi.lyDo) return;

    suaMa.mutate(
      { ma_dinh_danh_moet: maSach, ly_do: lyDoSach },
      {
        onSuccess: (kq) => {
          notifications.show({
            color: 'green',
            message: kq.da_doi_ten_dang_nhap
              ? 'Đã sửa mã định danh MOET, tên đăng nhập đổi theo mã mới'
              : 'Đã sửa mã định danh MOET',
          });
          setMo(false);
        },
        onError: (err) => {
          const f = loiFieldsThanhMap(err);
          setLoi({ ma: f.ma_dinh_danh_moet, lyDo: f.ly_do });
        },
      },
    );
  }

  const maSach = ma.trim();
  const canhBaoDoDai =
    /^\d+$/.test(maSach) && maSach.length !== 11 && maSach.length !== 12
      ? `Mã có ${maSach.length} chữ số — mã MOET thường có 11 hoặc 12 chữ số. Kiểm tra lại trước khi lưu.`
      : null;

  return (
    <>
      <Group justify="flex-end" mt="md">
        <Button size="xs" variant="light" onClick={moModal}>
          Sửa mã MOET
        </Button>
      </Group>
      <Modal opened={mo} onClose={() => setMo(false)} title="Sửa mã định danh MOET" centered>
        <Stack gap="md">
          <Text fz="sm" c="dimmed">
            Mã hiện tại: <b>{maHienTai ?? '—'}</b>. Nếu tên đăng nhập đang là mã cũ thì sẽ đổi theo mã mới; mật khẩu
            không đổi. Không sửa được khi học viên đã vào hệ thống khảo sát.
          </Text>
          {suaMa.isError && <Alert color="red">{thongDiepLoiXungDot(suaMa.error)}</Alert>}
          <Box>
            <TextInput
              label="Mã định danh MOET mới"
              inputMode="numeric"
              autoComplete="off"
              value={ma}
              onChange={(e) => setMa(e.currentTarget.value)}
              error={loi.ma}
              required
            />
            {canhBaoDoDai && (
              <Text fz="xs" c="orange.8" mt={4}>
                {canhBaoDoDai}
              </Text>
            )}
          </Box>
          <Textarea
            label="Lý do"
            placeholder="Ví dụ: mã bị mất số 0 đầu theo danh sách của Sở"
            autosize
            minRows={2}
            maxLength={500}
            value={lyDo}
            onChange={(e) => setLyDo(e.currentTarget.value)}
            error={loi.lyDo}
            required
          />
          <Group justify="flex-end" gap="sm">
            <Button variant="default" onClick={() => setMo(false)}>
              Hủy
            </Button>
            <Button loading={suaMa.isPending} onClick={luu}>
              Lưu mã mới
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}

// Issue #30: xóa cứng học viên — "xóa là văng hết". Gõ lại mã MOET (hoặc họ tên khi không có mã) để
// xác nhận; so khớp giống backend (trim, họ tên không phân biệt hoa/thường).
function khopXacNhanXoa(nhap: string, hoTen: string, maMoet: string | null) {
  const sach = chuanHoaNfc(nhap.trim());
  if (maMoet) return sach === maMoet.trim();
  return sach !== '' && sach.toLocaleLowerCase('vi') === chuanHoaNfc(hoTen.trim()).toLocaleLowerCase('vi');
}

function XoaHocVien(props: { hocVienId: string; hoTen: string; maMoet: string | null }) {
  const { hocVienId } = props;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const xoa = useXoaHocVien(hocVienId);
  const [mo, setMo] = useState(false);
  const [lyDo, setLyDo] = useState('');
  const [xacNhan, setXacNhan] = useState('');
  // Issue #31: mức ảnh hưởng chỉ tải khi modal mở; họ tên/mã MOET server trả kèm được ưu tiên (mới nhất).
  const anhHuong = useAnhHuongXoaHocVien(hocVienId, mo);
  const hoTen = anhHuong.data?.ho_ten ?? props.hoTen;
  const maMoet = anhHuong.data ? anhHuong.data.ma_dinh_danh_moet : props.maMoet;

  const giaTriXacNhan = maMoet ?? hoTen;
  const nhanXacNhan = maMoet
    ? `Gõ lại mã MOET ${maMoet} để xác nhận`
    : `Gõ lại họ tên "${hoTen}" để xác nhận`;
  const lyDoSach = chuanHoaNfc(lyDo.trim());
  const duocXoa = lyDoSach !== '' && khopXacNhanXoa(xacNhan, hoTen, maMoet);

  function moModal() {
    setLyDo('');
    setXacNhan('');
    xoa.reset();
    // Bỏ số đếm cũ để mỗi lần mở modal đều thấy trạng thái đang tải + số mới đếm.
    queryClient.removeQueries({ queryKey: anhHuongXoaKey(hocVienId) });
    setMo(true);
  }

  function xacNhanXoa() {
    if (!duocXoa) return;
    xoa.mutate(
      { ly_do: lyDoSach, xac_nhan: chuanHoaNfc(xacNhan.trim()) },
      {
        onSuccess: () => {
          notifications.show({ color: 'green', message: `Đã xóa học viên ${hoTen || giaTriXacNhan}` });
          setMo(false);
          navigate('/admin/hoc-vien', { replace: true });
        },
      },
    );
  }

  return (
    <Paper withBorder radius={14} p="lg" mt="lg" style={{ borderColor: 'var(--mantine-color-red-6)' }}>
      <Text component="h2" fz={16} fw={700} c="red.7" mb={4}>
        Thao tác nguy hiểm
      </Text>
      <Text fz={13} c="dimmed" mb="md">
        Xóa vĩnh viễn hồ sơ học viên cùng toàn bộ dữ liệu liên quan. Không thể hoàn tác.
      </Text>
      <Button color="red" variant="outline" onClick={moModal}>
        Xóa học viên
      </Button>

      <Modal opened={mo} onClose={() => setMo(false)} title="Xóa học viên" centered>
        <Stack gap="md">
          <Alert color="red" title="Không thể hoàn tác">
            Hồ sơ <b>{hoTen || giaTriXacNhan}</b> sẽ bị xóa vĩnh viễn cùng toàn bộ dữ liệu liên quan (tài khoản đăng
            nhập, ghi danh, phân lớp, điểm danh, kết quả, khảo sát, yêu cầu hỗ trợ…). Học viên sẽ biến mất khỏi mọi
            báo cáo, thống kê.
          </Alert>
          <MucAnhHuongXoa data={anhHuong.data} loi={anhHuong.isError ? thongDiepLoiChung(anhHuong.error) : null} />
          {xoa.isError && <Alert color="red">{thongDiepLoiXungDot(xoa.error)}</Alert>}
          <Textarea
            label="Lý do xóa"
            placeholder="Ví dụ: hồ sơ trùng, nhập nhầm người"
            autosize
            minRows={2}
            maxLength={1000}
            value={lyDo}
            onChange={(e) => setLyDo(e.currentTarget.value)}
            required
          />
          <TextInput
            label={nhanXacNhan}
            autoComplete="off"
            value={xacNhan}
            onChange={(e) => setXacNhan(e.currentTarget.value)}
            required
          />
          <Group justify="flex-end" gap="sm">
            <Button variant="default" onClick={() => setMo(false)}>
              Hủy
            </Button>
            <Button color="red" disabled={!duocXoa} loading={xoa.isPending} onClick={xacNhanXoa}>
              Xóa
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Paper>
  );
}

// Issue #31: dữ liệu sẽ mất nếu xóa (server đếm lúc mở modal). Nhật ký hoạt động được giữ nên không liệt kê.
function MucAnhHuongXoa({ data, loi }: { data: AnhHuongXoaHocVien | undefined; loi: string | null }) {
  if (loi) return <Alert color="orange">Không tải được mức ảnh hưởng: {loi}</Alert>;
  if (!data) return <Skeleton height={150} data-testid="anh-huong-xoa-dang-tai" />;
  const dong: [string, string][] = [
    ['Khóa đã ghi danh', String(data.so_dang_ky)],
    ['Buổi điểm danh', String(data.so_buoi_diem_danh)],
    ['Kết quả khảo sát', String(data.so_ket_qua_khao_sat)],
    ['Yêu cầu hỗ trợ', String(data.so_yeu_cau_ho_tro)],
    ['Tài khoản đăng nhập', data.co_tai_khoan ? 'Có' : 'Không'],
    ['Tài khoản VLE', data.ten_dang_nhap_vle ?? 'Không có'],
  ];
  return (
    <Box>
      <Text fz={13} fw={600} mb={4}>
        Dữ liệu sẽ bị xóa
      </Text>
      <Table withTableBorder verticalSpacing={4} fz={13} aria-label="Mức ảnh hưởng khi xóa">
        <Table.Tbody>
          {dong.map(([nhan, giaTri]) => (
            <Table.Tr key={nhan}>
              <Table.Th fw={500} w="60%">
                {nhan}
              </Table.Th>
              <Table.Td fw={700}>{giaTri}</Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Box>
  );
}

function NhatKyCuaHocVien({ hocVienId }: { hocVienId: string }) {
  const { data, isLoading, isError, error } = useNhatKyHocVien(hocVienId);
  if (isLoading) return <Skeleton height={80} />;
  if (isError) return <Alert color="red">{thongDiepLoiChung(error)}</Alert>;
  return data ? <DongThoiGianNhatKy muc={data.muc} /> : null;
}

// Thêm 2026-09-30 (QĐ10, docs/api-contract.md mục 3) — sửa tay phân lớp theo giai đoạn (spec
// 2026-10-02, xem PhanLopTheoGiaiDoan) và cụm hỗ trợ Zalo cho từng khóa mà học viên đã ghi danh.
// Thao tác sửa tay ít dùng — giao diện đơn giản (Select + nút Lưu), không cần đẹp phức tạp, đúng tính
// chất "placeholder, hoàn thiện sau" của trang này.
function KhoaVaLopCuaHocVien({ hocVienId, choGhiDanh }: { hocVienId: string; choGhiDanh: boolean }) {
  const { data, isLoading, isError, error } = useKhoaHocCuaHocVien(hocVienId);

  if (isLoading) {
    return (
      <Stack gap="sm">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} height={20} />
        ))}
      </Stack>
    );
  }
  if (isError) return <Alert color="red">{thongDiepLoiChung(error)}</Alert>;

  return (
    <Stack gap="xl">
      {(!data || data.length === 0) && <Text c="dimmed">Chưa ghi danh khóa nào.</Text>}
      {data?.map((dangKy) => (
        <KhoiDangKy key={dangKy.id} hocVienId={hocVienId} dangKy={dangKy} />
      ))}
      {choGhiDanh && <GhiDanhVaoKhoa hocVienId={hocVienId} daGhiDanh={(data ?? []).map((d) => d.khoa_id)} />}
    </Stack>
  );
}

// Quản trị ghi danh lẻ (POST /dang-ky-hoc) — chỉ hồ sơ đã duyệt; phân lớp làm tiếp ở khối khóa vừa thêm.
function GhiDanhVaoKhoa({ hocVienId, daGhiDanh }: { hocVienId: string; daGhiDanh: string[] }) {
  const ghiDanh = useGhiDanhLe(hocVienId);
  const [khoaId, setKhoaId] = useState('');
  const [cumId, setCumId] = useState('');
  const [loi, setLoi] = useState<Record<string, string>>({});

  function luu() {
    setLoi({});
    ghiDanh.mutate(
      { hoc_vien_id: hocVienId, khoa_id: khoaId, cum_id: cumId || undefined },
      {
        onSuccess: () => {
          notifications.show({ color: 'green', message: 'Đã ghi danh vào khóa' });
          setKhoaId('');
          setCumId('');
        },
        onError: (err) => {
          const f = loiFieldsThanhMap(err);
          if (f.khoa_id || f.cum_id) setLoi(f);
          else notifications.show({ color: 'red', message: thongDiepLoiXungDot(err) });
        },
      },
    );
  }

  return (
    <Box data-testid="ghi-danh-vao-khoa" pt="md" style={{ borderTop: '1px solid #F1F3F6' }}>
      <Text fw={600} mb="xs">
        Ghi danh vào khóa
      </Text>
      <ChonKhoaVaCum
        khoaId={khoaId}
        cumId={cumId}
        onChange={(k, c) => {
          setKhoaId(k);
          setCumId(c);
        }}
        boQuaKhoaIds={daGhiDanh}
        loiKhoa={loi.khoa_id}
        loiCum={loi.cum_id}
        khoaBatBuoc
      />
      <Group justify="flex-end" mt="sm">
        <Button size="xs" loading={ghiDanh.isPending} disabled={!khoaId} onClick={luu}>
          Ghi danh
        </Button>
      </Group>
    </Box>
  );
}

function KhoiDangKy({ hocVienId, dangKy }: { hocVienId: string; dangKy: KhoaHocDangKy }) {
  const { data: khoa } = useChiTietKhoa(dangKy.khoa_id);
  const capNhatCum = useCapNhatCumDangKy(hocVienId);

  const [chonCum, setChonCum] = useState(dangKy.cum?.id ?? '');

  function luuCum() {
    capNhatCum.mutate(
      { dangKyHocId: dangKy.id, dto: { cum_id: chonCum || null } },
      {
        onSuccess: () => notifications.show({ color: 'green', message: 'Đã lưu cụm' }),
        onError: (err) => notifications.show({ color: 'red', message: thongDiepLoiChung(err) }),
      },
    );
  }

  return (
    <Box>
      <Text fw={600} mb="xs">
        {dangKy.khoa.ten_khoa}
      </Text>

      {!khoa && <Skeleton height={20} />}

      {khoa && (
        <Stack gap="sm">
          <PhanLopTheoGiaiDoan hocVienId={hocVienId} dangKy={dangKy} khoa={khoa} />

          <MucHocDangKy hocVienId={hocVienId} dangKy={dangKy} />

          <Group gap="sm" wrap="wrap" data-testid="dong-cum">
            <Select
              label="Cụm hỗ trợ Zalo"
              data={[
                { value: '', label: '-- Bỏ gán --' },
                ...khoa.cum_hoc_vien.map((c) => ({ value: c.id, label: c.ten_cum })),
              ]}
              value={chonCum}
              onChange={(v) => setChonCum(v ?? '')}
              allowDeselect={false}
              w={260}
            />
            <Button size="xs" loading={capNhatCum.isPending} onClick={luuCum}>
              Lưu
            </Button>
          </Group>
        </Stack>
      )}
    </Box>
  );
}

// ADR 0006: hiện 3 nguồn mức (hệ thống / nhu cầu / chốt); xếp lớp chỉ theo mức chốt. Quản trị sửa hộ NHU CẦU
// (bỏ qua công tắc khóa) chỉ khi chưa chốt, trong phạm vi mốc hệ thống hoặc thấp hơn 1 mức (backend kiểm lại).
function MucHocDangKy({ hocVienId, dangKy }: { hocVienId: string; dangKy: KhoaHocDangKy }) {
  const { nguoiDung } = useToi();
  const capNhatMuc = useCapNhatMucHoc(hocVienId);
  const moc = dangKy.muc_he_thong;
  const nhuCau = nhuCauMucHoc(dangKy);
  const cacMuc = cacMucDuocChon(moc);
  // Lựa chọn cũ thấp hơn 2 mức không còn trong danh sách -> chọn sẵn mốc.
  const [chonMuc, setChonMuc] = useState<string>(nhuCau && cacMuc.includes(nhuCau) ? nhuCau : (moc ?? ''));

  function luuMuc() {
    capNhatMuc.mutate(
      { dangKyHocId: dangKy.id, muc: chonMuc as MucNangLuc },
      {
        onSuccess: () => notifications.show({ color: 'green', message: 'Đã lưu nhu cầu mức lớp học' }),
        onError: (err) => notifications.show({ color: 'red', message: thongDiepLoiChung(err) }),
      },
    );
  }

  return (
    <Stack gap={4} data-testid="dong-muc-hoc">
      <CacNguonMucHoc dangKy={dangKy} />
      {dangKy.muc_dau_vao && (
        <Text fz="xs" c="dimmed">
          Mức đã được chốt
        </Text>
      )}
      {nguoiDung?.vai_tro === 'quan_tri' && !dangKy.muc_dau_vao && moc && (
        <Group gap="sm" wrap="wrap" align="flex-end">
          <Select
            label="Sửa nhu cầu mức lớp học"
            data={cacMuc.map((m) => ({
              value: m,
              label: m === moc ? `${nhanMucNangLuc(m)} (theo kết quả đánh giá)` : nhanMucNangLuc(m),
            }))}
            value={chonMuc}
            onChange={(v) => setChonMuc(v ?? '')}
            allowDeselect={false}
            w={260}
          />
          <Button size="xs" loading={capNhatMuc.isPending} onClick={luuMuc} disabled={!chonMuc}>
            Lưu mức
          </Button>
        </Group>
      )}
    </Stack>
  );
}
