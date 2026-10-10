import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Alert, Box, Button, Container, Group, Modal, Paper, Select, Skeleton, Stack, Text, TextInput, Textarea } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useHocVienTheoId, useSuaMaDinhDanhMoet } from '@/api/admin';
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
import { cacMucDuocChon, mucHocHieuLuc, nhanMucNangLuc } from '@/lib/mucNangLuc';
import { loiFieldsThanhMap, thongDiepLoiChung, thongDiepLoiXungDot } from '@/lib/loiApi';
import { chuanHoaNfc } from '@/lib/nfc';
import { dinhDangNgayGio } from '@/lib/ngay';
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

// 2026-10-08: mức lớp học hiệu lực (tự chọn ?? đánh giá). Quản trị sửa hộ — bỏ qua công tắc khóa nhưng
// chỉ chọn được mức đánh giá làm mốc hoặc thấp hơn 1 mức (chốt ?? khảo sát, 2026-10-09; backend kiểm lại).
function MucHocDangKy({ hocVienId, dangKy }: { hocVienId: string; dangKy: KhoaHocDangKy }) {
  const { nguoiDung } = useToi();
  const capNhatMuc = useCapNhatMucHoc(hocVienId);
  const mucHoc = mucHocHieuLuc(dangKy);
  const cacMuc = cacMucDuocChon(dangKy.muc_danh_gia);
  // Lựa chọn cũ thấp hơn 2 mức không còn trong danh sách -> chọn sẵn mốc.
  const [chonMuc, setChonMuc] = useState<string>(
    mucHoc && cacMuc.includes(mucHoc) ? mucHoc : (dangKy.muc_danh_gia ?? ''),
  );

  const mucDanhGia = dangKy.muc_danh_gia;
  if (!mucDanhGia) {
    return (
      <Text fz="sm" c="dimmed">
        Mức lớp học: chưa có kết quả đánh giá đầu vào
      </Text>
    );
  }

  function luuMuc() {
    capNhatMuc.mutate(
      { dangKyHocId: dangKy.id, muc: chonMuc as MucNangLuc },
      {
        onSuccess: () => notifications.show({ color: 'green', message: 'Đã lưu mức lớp học' }),
        onError: (err) => notifications.show({ color: 'red', message: thongDiepLoiChung(err) }),
      },
    );
  }

  return (
    <Stack gap={4} data-testid="dong-muc-hoc">
      <Text fz="sm">
        Mức lớp học: <b>{nhanMucNangLuc(mucHoc)}</b>
        {dangKy.muc_hoc_chon && <> (học viên tự điều chỉnh từ {nhanMucNangLuc(mucDanhGia)})</>}
      </Text>
      {dangKy.nguon_muc_danh_gia === 'khao_sat' && (
        <Text fz="xs" c="dimmed">
          Kết quả: {dangKy.nhan_muc_goc_danh_gia ?? nhanMucNangLuc(mucDanhGia)} (khảo sát, chưa chốt) → xếp lớp{' '}
          {nhanMucNangLuc(mucDanhGia)}
        </Text>
      )}
      {dangKy.muc_hoc_chon_luc && (
        <Text fz="xs" c="dimmed">
          Đã điều chỉnh lúc {dinhDangNgayGio(dangKy.muc_hoc_chon_luc)}
        </Text>
      )}
      {nguoiDung?.vai_tro === 'quan_tri' && (
        <Group gap="sm" wrap="wrap" align="flex-end">
          <Select
            label="Sửa mức lớp học"
            data={cacMuc.map((m) => ({
              value: m,
              label: m === mucDanhGia ? `${nhanMucNangLuc(m)} (theo kết quả đánh giá)` : nhanMucNangLuc(m),
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
