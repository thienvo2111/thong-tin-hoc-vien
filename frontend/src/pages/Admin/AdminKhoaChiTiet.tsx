import { Fragment, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  Alert,
  Anchor,
  Badge,
  Box,
  Breadcrumbs,
  Button,
  Container,
  Group,
  Modal,
  NumberInput,
  Paper,
  Select,
  Skeleton,
  Stack,
  Switch,
  Table,
  Tabs,
  Text,
  Textarea,
  TextInput,
  Title,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { ApiError } from '@/api/client';
import {
  useCapNhatCum,
  useCapNhatGiaiDoan,
  useCapNhatKhoa,
  useCapNhatLichHoc,
  useCapNhatLop,
  useChiTietKhoa,
  useDonViChoKhoa,
  useTaoCum,
  useTaoGiaiDoan,
  useTaoLop,
  useThemLichHoc,
  useThemNhanSu,
  useXoaNhanSu,
  xuatDanhSachChiaLop,
} from '@/api/khoaBoiDuong';
import type {
  CumHocVien,
  GiaiDoanKhoa,
  HinhThucGiaiDoan,
  LichHocLop,
  LopHoc,
  LoaiLop,
  MucNangLuc,
  TrangThaiActive,
  TrangThaiLichHoc,
  VaiTroNhanSuLop,
} from '@/api/types';
import { useToi } from '@/auth/AuthContext';
import { chuanHoaLienKet } from '@/lib/lienKet';
import { thongDiepLoiChung, loiFieldsThanhMap } from '@/lib/loiApi';
import { dinhDangNgay, dinhDangNgayGio } from '@/lib/ngay';
import { locTiengViet } from '@/lib/timKiemTiengViet';
import { KhoaTrangThaiBadge } from '@/components/KhoaTrangThaiBadge';
import { AdminPageHeader } from './AdminPageHeader';
import { ModalImportLopHoc } from './ModalImportLopHoc';
import { ChonNguoiHoTroCum } from './ChonNguoiHoTroCum';
import { SelectDiemHoc } from '@/components/SelectDiemHoc';
import { ModalPhanCongBuoi } from './ModalPhanCongBuoi';
import { ChonNhomHoTroGv } from './ChonNhomHoTroGv';
import { BangKiemEditor } from './BangKiemEditor';

const NHAN_LOAI_LOP: Record<LoaiLop, string> = { truc_tiep: 'Trực tiếp', zoom: 'Zoom', vle: 'VLE' };
const MAU_LOAI_LOP: Record<LoaiLop, string> = { truc_tiep: 'blue', zoom: 'grape', vle: 'teal' };
const TUY_CHON_LOAI_LOP = (Object.keys(NHAN_LOAI_LOP) as LoaiLop[]).map((v) => ({ value: v, label: NHAN_LOAI_LOP[v] }));

const NHAN_MUC_NANG_LUC: Record<MucNangLuc, string> = { co_ban: 'Cơ bản', thanh_thao: 'Thành thạo', nang_cao: 'Nâng cao' };
const TUY_CHON_MUC_NANG_LUC = (Object.keys(NHAN_MUC_NANG_LUC) as MucNangLuc[]).map((v) => ({
  value: v,
  label: NHAN_MUC_NANG_LUC[v],
}));

const NHAN_HINH_THUC_GIAI_DOAN: Record<HinhThucGiaiDoan, string> = {
  truc_tiep: 'Trực tiếp',
  truc_tuyen: 'Trực tuyến',
  danh_gia: 'Đánh giá',
  khac: 'Khác',
};
const TUY_CHON_HINH_THUC_GIAI_DOAN = (Object.keys(NHAN_HINH_THUC_GIAI_DOAN) as HinhThucGiaiDoan[]).map((v) => ({
  value: v,
  label: NHAN_HINH_THUC_GIAI_DOAN[v],
}));

const NHAN_VAI_TRO_NHAN_SU: Record<VaiTroNhanSuLop, string> = { giang_vien: 'Giảng viên', ho_tro: 'Hỗ trợ' };
const TUY_CHON_VAI_TRO_NHAN_SU = (Object.keys(NHAN_VAI_TRO_NHAN_SU) as VaiTroNhanSuLop[]).map((v) => ({
  value: v,
  label: NHAN_VAI_TRO_NHAN_SU[v],
}));

const NHAN_TRANG_THAI_LICH_HOC: Record<TrangThaiLichHoc, string> = {
  chua_dien_ra: 'Chưa diễn ra',
  dang_dien_ra: 'Đang diễn ra',
  ket_thuc: 'Kết thúc',
};
const TUY_CHON_TRANG_THAI_LICH_HOC = (Object.keys(NHAN_TRANG_THAI_LICH_HOC) as TrangThaiLichHoc[]).map((v) => ({
  value: v,
  label: NHAN_TRANG_THAI_LICH_HOC[v],
}));

function BadgeHoatDong({ trangThai }: { trangThai: TrangThaiActive }) {
  return (
    <Badge color={trangThai === 'active' ? 'green' : 'gray'} radius="xl">
      {trangThai === 'active' ? 'Đang hoạt động' : 'Đã vô hiệu hóa'}
    </Badge>
  );
}

/** thongDiepLoiChung() hard-code case 'CONFLICT' thành thông báo trùng CCCD (ngữ cảnh hồ sơ học
 * viên) — không đúng cho lỗi trùng tên lớp/giai đoạn/cụm/đơn vị theo dõi ở màn này (ConflictAppException
 * từ mapUniqueViolation()). Dùng thẳng message thật từ backend khi là ApiError, giống thongDiepLoiDot()
 * trong AdminDotXacNhan.tsx (cùng vấn đề, đã xử lý trước đó). */
function thongDiepLoiKhoa(err: unknown): string {
  return err instanceof ApiError ? err.message : thongDiepLoiChung(err);
}

interface FormTaoLop {
  ten_lop: string;
  loai_lop: LoaiLop | '';
  si_so_toi_da: string;
}
const FORM_TAO_LOP_RONG: FormTaoLop = { ten_lop: '', loai_lop: '', si_so_toi_da: '' };

interface FormSuaLop {
  ten_lop: string;
  loai_lop: LoaiLop | '';
  si_so_toi_da: string;
  nhom_hoc_vien: string;
  muc_nang_luc: MucNangLuc | '';
}

interface FormBuoiHoc {
  giai_doan_id: string;
  buoi_so: string;
  thoi_gian_bat_dau: string;
  thoi_gian_ket_thuc: string;
  dia_diem_hoac_link: string;
  // T10 (issue #2): bắt buộc khi giai đoạn hình thức trực tiếp.
  diem_hoc_id: string | null;
  phong: string;
}
const FORM_BUOI_RONG: FormBuoiHoc = {
  giai_doan_id: '',
  buoi_so: '1',
  thoi_gian_bat_dau: '',
  thoi_gian_ket_thuc: '',
  dia_diem_hoac_link: '',
  diem_hoc_id: null,
  phong: '',
};

interface FormSuaBuoiHoc extends FormBuoiHoc {
  trang_thai: TrangThaiLichHoc;
  ly_do: string;
}

/** Cảnh báo 🟡 từ API (vd vượt số phòng của điểm học) — không chặn, chỉ báo cho quản trị biết. */
function baoCanhBao(canhBao: string[] | undefined) {
  for (const cb of canhBao ?? []) notifications.show({ color: 'yellow', message: cb, autoClose: 8000 });
}

interface FormNhanSu {
  ho_ten: string;
  vai_tro: VaiTroNhanSuLop | '';
  so_dien_thoai: string;
}
const FORM_NHAN_SU_RONG: FormNhanSu = { ho_ten: '', vai_tro: '', so_dien_thoai: '' };

interface FormGiaiDoan {
  thu_tu: string;
  ten_giai_doan: string;
  hinh_thuc: HinhThucGiaiDoan | '';
  thoi_gian_bat_dau: string;
  thoi_gian_ket_thuc: string;
  // Phân lớp theo giai đoạn (spec 2026-10-02): thông tin chung cho giai đoạn không gán lớp.
  link_hoac_dia_diem: string;
  huong_dan: string;
}
const FORM_GIAI_DOAN_RONG: FormGiaiDoan = {
  thu_tu: '',
  ten_giai_doan: '',
  hinh_thuc: '',
  thoi_gian_bat_dau: '',
  thoi_gian_ket_thuc: '',
  link_hoac_dia_diem: '',
  huong_dan: '',
};

interface FormCum {
  ten_cum: string;
  link_zalo: string;
  ghi_chu: string;
}
const FORM_CUM_RONG: FormCum = { ten_cum: '', link_zalo: '', ghi_chu: '' };

type XacNhanToggle =
  | { loai: 'lop'; id: string; ten: string; dangHoatDong: boolean }
  | { loai: 'giai-doan'; id: string; ten: string; dangHoatDong: boolean }
  | { loai: 'cum'; id: string; ten: string; dangHoatDong: boolean };

type XacNhanXoa = { loai: 'nhan-su'; lopId: string; nhanSuId: string; ten: string };

interface FormSuaKhoa {
  ma_khoa: string;
  ten_khoa: string;
  dia_diem: string;
  thoi_gian_bat_dau: string;
  thoi_gian_ket_thuc: string;
  don_vi_dat_hang_id: string;
}

/** Chi tiết khóa bồi dưỡng. Mọi endpoint ghi (giai đoạn/lớp/cụm/buổi học/nhân sự/sửa khóa, import)
 * chỉ `quan_tri` gọi được (2026-10-03-don-vi-dat-hang, xem khoa-boi-duong.controller.ts) — đã bỏ
 * luồng nộp duyệt/duyệt và "Đơn vị theo dõi" (khóa chỉ còn 1 đơn vị đặt hàng, không còn danh sách
 * đơn vị theo dõi riêng). FE chỉ lọc theo vai_tro — quyền phạm vi thật (scope cây đơn vị) do backend
 * chặn (403) nếu tài khoản không đúng đơn vị, không tự đoán ở FE.
 */
export default function AdminKhoaChiTiet() {
  const { id } = useParams<{ id: string }>();
  const khoaId = id ?? '';
  const { nguoiDung } = useToi();
  const vaiTro = nguoiDung?.vai_tro ?? '';
  const laQuanTri = vaiTro === 'quan_tri';
  const { data: khoa, isLoading, isError, error } = useChiTietKhoa(id);
  const donVi = useDonViChoKhoa();
  const donViMap = new Map((donVi.data ?? []).map((d) => [d.id, d.ten_don_vi]));

  // Select "Đơn vị đặt hàng" (form sửa khóa) — cùng cách nhóm với form tạo khóa ở AdminKhoaBoiDuong.
  const nhomDonViDatHang = useMemo(() => {
    const list = donVi.data ?? [];
    const nhom = (loai: string, group: string) => ({
      group,
      items: list.filter((d) => d.loai_don_vi === loai).map((d) => ({ value: d.id, label: d.ten_don_vi })),
    });
    return [nhom('so_gddt', 'Sở GD&ĐT'), nhom('khac', 'Đơn vị khác'), nhom('truong', 'Trường')].filter(
      (n) => n.items.length > 0,
    );
  }, [donVi.data]);

  // --- Sửa khóa (chỉ quan_tri) ------------------------------------------
  const capNhatKhoa = useCapNhatKhoa(khoaId);
  // 2026-10-08: công tắc cho học viên tự điều chỉnh mức lớp học — mutation riêng để không lẫn trạng thái
  // với form sửa khóa.
  const batTatDieuChinhMuc = useCapNhatKhoa(khoaId);
  const [modalSuaKhoa, setModalSuaKhoa] = useState(false);
  const [formSuaKhoa, setFormSuaKhoa] = useState<FormSuaKhoa | null>(null);
  const [loiSuaKhoa, setLoiSuaKhoa] = useState<Record<string, string>>({});

  function moModalSuaKhoa() {
    if (!khoa) return;
    setFormSuaKhoa({
      ma_khoa: khoa.ma_khoa,
      ten_khoa: khoa.ten_khoa,
      dia_diem: khoa.dia_diem ?? '',
      thoi_gian_bat_dau: khoa.thoi_gian_bat_dau.slice(0, 10),
      thoi_gian_ket_thuc: khoa.thoi_gian_ket_thuc.slice(0, 10),
      don_vi_dat_hang_id: khoa.don_vi_dat_hang_id,
    });
    setLoiSuaKhoa({});
    setModalSuaKhoa(true);
  }

  function xuLySuaKhoa() {
    if (!formSuaKhoa) return;
    setLoiSuaKhoa({});
    capNhatKhoa.mutate(
      {
        ma_khoa: formSuaKhoa.ma_khoa.trim(),
        ten_khoa: formSuaKhoa.ten_khoa.trim(),
        dia_diem: formSuaKhoa.dia_diem.trim() || undefined,
        thoi_gian_bat_dau: formSuaKhoa.thoi_gian_bat_dau,
        thoi_gian_ket_thuc: formSuaKhoa.thoi_gian_ket_thuc,
        don_vi_dat_hang_id: formSuaKhoa.don_vi_dat_hang_id,
      },
      {
        onSuccess: (khoaMoi) => {
          notifications.show({ color: 'green', message: `Đã lưu thay đổi khóa "${khoaMoi.ten_khoa}"` });
          setModalSuaKhoa(false);
          setFormSuaKhoa(null);
        },
        onError: (err) => {
          const fields = loiFieldsThanhMap(err);
          if (Object.keys(fields).length > 0) setLoiSuaKhoa(fields);
          else notifications.show({ color: 'red', message: thongDiepLoiKhoa(err) });
        },
      },
    );
  }

  const formSuaKhoaHopLe =
    !!formSuaKhoa &&
    formSuaKhoa.ma_khoa.trim() !== '' &&
    formSuaKhoa.ten_khoa.trim() !== '' &&
    formSuaKhoa.thoi_gian_bat_dau !== '' &&
    formSuaKhoa.thoi_gian_ket_thuc !== '' &&
    formSuaKhoa.don_vi_dat_hang_id !== '';

  // --- Lớp học -------------------------------------------------------------
  const taoLop = useTaoLop(khoaId);
  const capNhatLop = useCapNhatLop(khoaId);
  const [modalTaoLop, setModalTaoLop] = useState(false);
  const [formTaoLop, setFormTaoLop] = useState<FormTaoLop>(FORM_TAO_LOP_RONG);
  const [loiTaoLop, setLoiTaoLop] = useState<Record<string, string>>({});

  const [lopDangSua, setLopDangSua] = useState<LopHoc | null>(null);
  const [formSuaLop, setFormSuaLop] = useState<FormSuaLop | null>(null);
  const [loiSuaLop, setLoiSuaLop] = useState<Record<string, string>>({});

  const [lopMoRong, setLopMoRong] = useState<Set<string>>(new Set());
  const [modalImport, setModalImport] = useState(false);
  const [dangXuatChiaLop, setDangXuatChiaLop] = useState(false);

  async function xuLyXuatDanhSachChiaLop() {
    if (!khoa) return;
    setDangXuatChiaLop(true);
    try {
      await xuatDanhSachChiaLop(khoa.id, khoa.ma_khoa);
    } catch (err) {
      notifications.show({ color: 'red', message: thongDiepLoiChung(err) });
    } finally {
      setDangXuatChiaLop(false);
    }
  }

  function moModalTaoLop() {
    setFormTaoLop(FORM_TAO_LOP_RONG);
    setLoiTaoLop({});
    setModalTaoLop(true);
  }

  function xuLyTaoLop() {
    setLoiTaoLop({});
    taoLop.mutate(
      {
        ten_lop: formTaoLop.ten_lop.trim(),
        loai_lop: formTaoLop.loai_lop as LoaiLop,
        si_so_toi_da: formTaoLop.si_so_toi_da ? Number(formTaoLop.si_so_toi_da) : undefined,
      },
      {
        onSuccess: (lop) => {
          notifications.show({ color: 'green', message: `Đã tạo lớp "${lop.ten_lop}"` });
          setModalTaoLop(false);
        },
        onError: (err) => {
          const fields = loiFieldsThanhMap(err);
          if (Object.keys(fields).length > 0) setLoiTaoLop(fields);
          else notifications.show({ color: 'red', message: thongDiepLoiKhoa(err) });
        },
      },
    );
  }

  function moModalSuaLop(lop: LopHoc) {
    setLopDangSua(lop);
    setFormSuaLop({
      ten_lop: lop.ten_lop,
      loai_lop: lop.loai_lop,
      si_so_toi_da: lop.si_so_toi_da != null ? String(lop.si_so_toi_da) : '',
      nhom_hoc_vien: lop.nhom_hoc_vien != null ? String(lop.nhom_hoc_vien) : '',
      muc_nang_luc: lop.muc_nang_luc ?? '',
    });
    setLoiSuaLop({});
  }

  function xuLySuaLop() {
    if (!lopDangSua || !formSuaLop) return;
    setLoiSuaLop({});
    capNhatLop.mutate(
      {
        lopId: lopDangSua.id,
        dto: {
          ten_lop: formSuaLop.ten_lop.trim(),
          loai_lop: formSuaLop.loai_lop as LoaiLop,
          si_so_toi_da: formSuaLop.si_so_toi_da ? Number(formSuaLop.si_so_toi_da) : undefined,
          nhom_hoc_vien: formSuaLop.nhom_hoc_vien ? Number(formSuaLop.nhom_hoc_vien) : undefined,
          muc_nang_luc: formSuaLop.muc_nang_luc || undefined,
        },
      },
      {
        onSuccess: (lop) => {
          notifications.show({ color: 'green', message: `Đã lưu thay đổi lớp "${lop.ten_lop}"` });
          if (lop.canh_bao) notifications.show({ color: 'yellow', message: lop.canh_bao, autoClose: false });
          setLopDangSua(null);
          setFormSuaLop(null);
        },
        onError: (err) => {
          const fields = loiFieldsThanhMap(err);
          if (Object.keys(fields).length > 0) setLoiSuaLop(fields);
          else notifications.show({ color: 'red', message: thongDiepLoiKhoa(err) });
        },
      },
    );
  }

  function toggleMoRongLop(lopId: string) {
    setLopMoRong((cu) => {
      const moi = new Set(cu);
      if (moi.has(lopId)) moi.delete(lopId);
      else moi.add(lopId);
      return moi;
    });
  }

  // --- Buổi học (lịch học) ---------------------------------------------------
  const themLichHoc = useThemLichHoc(khoaId);
  const capNhatLichHoc = useCapNhatLichHoc(khoaId);
  const [modalThemBuoi, setModalThemBuoi] = useState<LopHoc | null>(null);
  const [formBuoi, setFormBuoi] = useState<FormBuoiHoc>(FORM_BUOI_RONG);
  const [loiBuoi, setLoiBuoi] = useState<Record<string, string>>({});

  const [buoiDangSua, setBuoiDangSua] = useState<{ lop: LopHoc; lich: LichHocLop } | null>(null);
  // T11 (issue #3): phân công giảng viên vào buổi.
  const [buoiPhanCong, setBuoiPhanCong] = useState<{ lop: LopHoc; lich: LichHocLop } | null>(null);
  const [formSuaBuoi, setFormSuaBuoi] = useState<FormSuaBuoiHoc | null>(null);
  const [loiSuaBuoi, setLoiSuaBuoi] = useState<Record<string, string>>({});

  function moModalThemBuoi(lop: LopHoc) {
    setFormBuoi(FORM_BUOI_RONG);
    setLoiBuoi({});
    setModalThemBuoi(lop);
  }

  function xuLyThemBuoi() {
    if (!modalThemBuoi) return;
    setLoiBuoi({});
    themLichHoc.mutate(
      {
        lopId: modalThemBuoi.id,
        dto: {
          giai_doan_id: formBuoi.giai_doan_id,
          buoi_so: formBuoi.buoi_so ? Number(formBuoi.buoi_so) : undefined,
          thoi_gian_bat_dau: new Date(formBuoi.thoi_gian_bat_dau).toISOString(),
          thoi_gian_ket_thuc: new Date(formBuoi.thoi_gian_ket_thuc).toISOString(),
          dia_diem_hoac_link: formBuoi.dia_diem_hoac_link.trim() || undefined,
          diem_hoc_id: formBuoi.diem_hoc_id ?? undefined,
          phong: formBuoi.phong.trim() || undefined,
        },
      },
      {
        onSuccess: (lich) => {
          notifications.show({ color: 'green', message: 'Đã thêm buổi học' });
          baoCanhBao(lich.canh_bao);
          setModalThemBuoi(null);
        },
        onError: (err) => {
          const fields = loiFieldsThanhMap(err);
          if (Object.keys(fields).length > 0) setLoiBuoi(fields);
          else notifications.show({ color: 'red', message: thongDiepLoiKhoa(err) });
        },
      },
    );
  }

  function moModalSuaBuoi(lop: LopHoc, lich: LichHocLop) {
    setBuoiDangSua({ lop, lich });
    setFormSuaBuoi({
      giai_doan_id: lich.giai_doan_id,
      buoi_so: String(lich.buoi_so),
      thoi_gian_bat_dau: isoThanhInputDiaPhuong(lich.thoi_gian_bat_dau),
      thoi_gian_ket_thuc: isoThanhInputDiaPhuong(lich.thoi_gian_ket_thuc),
      dia_diem_hoac_link: lich.dia_diem_hoac_link ?? '',
      trang_thai: lich.trang_thai,
      diem_hoc_id: lich.diem_hoc_id ?? null,
      phong: lich.phong ?? '',
      ly_do: '',
    });
    setLoiSuaBuoi({});
  }

  function xuLySuaBuoi() {
    if (!buoiDangSua || !formSuaBuoi) return;
    setLoiSuaBuoi({});
    capNhatLichHoc.mutate(
      {
        lopId: buoiDangSua.lop.id,
        lichHocId: buoiDangSua.lich.id,
        dto: {
          buoi_so: formSuaBuoi.buoi_so ? Number(formSuaBuoi.buoi_so) : undefined,
          thoi_gian_bat_dau: new Date(formSuaBuoi.thoi_gian_bat_dau).toISOString(),
          thoi_gian_ket_thuc: new Date(formSuaBuoi.thoi_gian_ket_thuc).toISOString(),
          dia_diem_hoac_link: formSuaBuoi.dia_diem_hoac_link.trim() || undefined,
          trang_thai: formSuaBuoi.trang_thai,
          diem_hoc_id: formSuaBuoi.diem_hoc_id,
          phong: formSuaBuoi.phong.trim() || null,
          ly_do: formSuaBuoi.ly_do.trim() || undefined,
        },
      },
      {
        onSuccess: (lich) => {
          notifications.show({ color: 'green', message: 'Đã lưu thay đổi buổi học' });
          baoCanhBao(lich.canh_bao);
          setBuoiDangSua(null);
          setFormSuaBuoi(null);
        },
        onError: (err) => {
          const fields = loiFieldsThanhMap(err);
          if (Object.keys(fields).length > 0) setLoiSuaBuoi(fields);
          else notifications.show({ color: 'red', message: thongDiepLoiKhoa(err) });
        },
      },
    );
  }

  // --- Nhân sự lớp -----------------------------------------------------------
  const themNhanSu = useThemNhanSu(khoaId);
  const xoaNhanSu = useXoaNhanSu(khoaId);
  const [modalThemNhanSu, setModalThemNhanSu] = useState<LopHoc | null>(null);
  const [formNhanSu, setFormNhanSu] = useState<FormNhanSu>(FORM_NHAN_SU_RONG);
  const [loiNhanSu, setLoiNhanSu] = useState<Record<string, string>>({});

  function moModalThemNhanSu(lop: LopHoc) {
    setFormNhanSu(FORM_NHAN_SU_RONG);
    setLoiNhanSu({});
    setModalThemNhanSu(lop);
  }

  function xuLyThemNhanSu() {
    if (!modalThemNhanSu) return;
    setLoiNhanSu({});
    themNhanSu.mutate(
      {
        lopId: modalThemNhanSu.id,
        dto: {
          ho_ten: formNhanSu.ho_ten.trim(),
          vai_tro: formNhanSu.vai_tro as VaiTroNhanSuLop,
          so_dien_thoai: formNhanSu.so_dien_thoai.trim() || undefined,
        },
      },
      {
        onSuccess: () => {
          notifications.show({ color: 'green', message: 'Đã thêm nhân sự' });
          setModalThemNhanSu(null);
        },
        onError: (err) => {
          const fields = loiFieldsThanhMap(err);
          if (Object.keys(fields).length > 0) setLoiNhanSu(fields);
          else notifications.show({ color: 'red', message: thongDiepLoiKhoa(err) });
        },
      },
    );
  }

  // --- Giai đoạn ---------------------------------------------------------
  const taoGiaiDoan = useTaoGiaiDoan(khoaId);
  const capNhatGiaiDoan = useCapNhatGiaiDoan(khoaId);
  const [modalTaoGiaiDoan, setModalTaoGiaiDoan] = useState(false);
  const [formTaoGiaiDoan, setFormTaoGiaiDoan] = useState<FormGiaiDoan>(FORM_GIAI_DOAN_RONG);
  const [loiTaoGiaiDoan, setLoiTaoGiaiDoan] = useState<Record<string, string>>({});

  const [giaiDoanDangSua, setGiaiDoanDangSua] = useState<GiaiDoanKhoa | null>(null);
  const [formSuaGiaiDoan, setFormSuaGiaiDoan] = useState<FormGiaiDoan | null>(null);
  const [loiSuaGiaiDoan, setLoiSuaGiaiDoan] = useState<Record<string, string>>({});

  function moModalTaoGiaiDoan() {
    setFormTaoGiaiDoan(FORM_GIAI_DOAN_RONG);
    setLoiTaoGiaiDoan({});
    setModalTaoGiaiDoan(true);
  }

  function xuLyTaoGiaiDoan() {
    setLoiTaoGiaiDoan({});
    taoGiaiDoan.mutate(
      {
        thu_tu: Number(formTaoGiaiDoan.thu_tu),
        ten_giai_doan: formTaoGiaiDoan.ten_giai_doan.trim(),
        hinh_thuc: formTaoGiaiDoan.hinh_thuc as HinhThucGiaiDoan,
        thoi_gian_bat_dau: formTaoGiaiDoan.thoi_gian_bat_dau,
        thoi_gian_ket_thuc: formTaoGiaiDoan.thoi_gian_ket_thuc,
        link_hoac_dia_diem: formTaoGiaiDoan.link_hoac_dia_diem.trim() || undefined,
        huong_dan: formTaoGiaiDoan.huong_dan.trim() || undefined,
      },
      {
        onSuccess: (gd) => {
          notifications.show({ color: 'green', message: `Đã tạo giai đoạn "${gd.ten_giai_doan}"` });
          setModalTaoGiaiDoan(false);
        },
        onError: (err) => {
          const fields = loiFieldsThanhMap(err);
          if (Object.keys(fields).length > 0) setLoiTaoGiaiDoan(fields);
          else notifications.show({ color: 'red', message: thongDiepLoiKhoa(err) });
        },
      },
    );
  }

  function moModalSuaGiaiDoan(gd: GiaiDoanKhoa) {
    setGiaiDoanDangSua(gd);
    setFormSuaGiaiDoan({
      thu_tu: String(gd.thu_tu),
      ten_giai_doan: gd.ten_giai_doan,
      hinh_thuc: gd.hinh_thuc,
      thoi_gian_bat_dau: gd.thoi_gian_bat_dau.slice(0, 10),
      thoi_gian_ket_thuc: gd.thoi_gian_ket_thuc.slice(0, 10),
      link_hoac_dia_diem: gd.link_hoac_dia_diem ?? '',
      huong_dan: gd.huong_dan ?? '',
    });
    setLoiSuaGiaiDoan({});
  }

  function xuLySuaGiaiDoan() {
    if (!giaiDoanDangSua || !formSuaGiaiDoan) return;
    setLoiSuaGiaiDoan({});
    capNhatGiaiDoan.mutate(
      {
        giaiDoanId: giaiDoanDangSua.id,
        dto: {
          thu_tu: Number(formSuaGiaiDoan.thu_tu),
          ten_giai_doan: formSuaGiaiDoan.ten_giai_doan.trim(),
          hinh_thuc: formSuaGiaiDoan.hinh_thuc as HinhThucGiaiDoan,
          thoi_gian_bat_dau: formSuaGiaiDoan.thoi_gian_bat_dau,
          thoi_gian_ket_thuc: formSuaGiaiDoan.thoi_gian_ket_thuc,
          link_hoac_dia_diem: formSuaGiaiDoan.link_hoac_dia_diem.trim() || null,
          huong_dan: formSuaGiaiDoan.huong_dan.trim() || null,
        },
      },
      {
        onSuccess: (gd) => {
          notifications.show({ color: 'green', message: `Đã lưu thay đổi giai đoạn "${gd.ten_giai_doan}"` });
          setGiaiDoanDangSua(null);
          setFormSuaGiaiDoan(null);
        },
        onError: (err) => {
          const fields = loiFieldsThanhMap(err);
          if (Object.keys(fields).length > 0) setLoiSuaGiaiDoan(fields);
          else notifications.show({ color: 'red', message: thongDiepLoiKhoa(err) });
        },
      },
    );
  }

  // --- Cụm hỗ trợ Zalo -----------------------------------------------------
  const taoCum = useTaoCum(khoaId);
  const capNhatCum = useCapNhatCum(khoaId);
  const [modalTaoCum, setModalTaoCum] = useState(false);
  const [formTaoCum, setFormTaoCum] = useState<FormCum>(FORM_CUM_RONG);
  const [loiTaoCum, setLoiTaoCum] = useState<Record<string, string>>({});

  const [cumDangSua, setCumDangSua] = useState<CumHocVien | null>(null);
  const [formSuaCum, setFormSuaCum] = useState<FormCum | null>(null);
  const [loiSuaCum, setLoiSuaCum] = useState<Record<string, string>>({});

  function moModalTaoCum() {
    setFormTaoCum(FORM_CUM_RONG);
    setLoiTaoCum({});
    setModalTaoCum(true);
  }

  function xuLyTaoCum() {
    setLoiTaoCum({});
    taoCum.mutate(
      {
        ten_cum: formTaoCum.ten_cum.trim(),
        link_zalo: formTaoCum.link_zalo.trim() || undefined,
        ghi_chu: formTaoCum.ghi_chu.trim() || undefined,
      },
      {
        onSuccess: (cum) => {
          notifications.show({ color: 'green', message: `Đã tạo cụm "${cum.ten_cum}"` });
          setModalTaoCum(false);
        },
        onError: (err) => {
          const fields = loiFieldsThanhMap(err);
          if (Object.keys(fields).length > 0) setLoiTaoCum(fields);
          else notifications.show({ color: 'red', message: thongDiepLoiKhoa(err) });
        },
      },
    );
  }

  function moModalSuaCum(cum: CumHocVien) {
    setCumDangSua(cum);
    setFormSuaCum({ ten_cum: cum.ten_cum, link_zalo: cum.link_zalo ?? '', ghi_chu: cum.ghi_chu ?? '' });
    setLoiSuaCum({});
  }

  function xuLySuaCum() {
    if (!cumDangSua || !formSuaCum) return;
    setLoiSuaCum({});
    capNhatCum.mutate(
      {
        cumId: cumDangSua.id,
        dto: {
          ten_cum: formSuaCum.ten_cum.trim(),
          link_zalo: formSuaCum.link_zalo.trim() || undefined,
          ghi_chu: formSuaCum.ghi_chu.trim() || undefined,
        },
      },
      {
        onSuccess: (cum) => {
          notifications.show({ color: 'green', message: `Đã lưu thay đổi cụm "${cum.ten_cum}"` });
          setCumDangSua(null);
          setFormSuaCum(null);
        },
        onError: (err) => {
          const fields = loiFieldsThanhMap(err);
          if (Object.keys(fields).length > 0) setLoiSuaCum(fields);
          else notifications.show({ color: 'red', message: thongDiepLoiKhoa(err) });
        },
      },
    );
  }

  // --- Vô hiệu hóa / kích hoạt lại (lớp, giai đoạn, cụm dùng chung 1 modal xác nhận) --------
  const [xacNhanToggle, setXacNhanToggle] = useState<XacNhanToggle | null>(null);

  function xuLyXacNhanToggle() {
    if (!xacNhanToggle) return;
    const trangThaiMoi: TrangThaiActive = xacNhanToggle.dangHoatDong ? 'ngung' : 'active';
    const onSuccess = () => {
      notifications.show({
        color: 'green',
        message: xacNhanToggle.dangHoatDong ? `Đã vô hiệu hóa "${xacNhanToggle.ten}"` : `Đã kích hoạt lại "${xacNhanToggle.ten}"`,
      });
      setXacNhanToggle(null);
    };
    const onError = (err: unknown) => notifications.show({ color: 'red', message: thongDiepLoiKhoa(err) });

    if (xacNhanToggle.loai === 'lop') {
      capNhatLop.mutate({ lopId: xacNhanToggle.id, dto: { trang_thai: trangThaiMoi } }, { onSuccess, onError });
    } else if (xacNhanToggle.loai === 'giai-doan') {
      capNhatGiaiDoan.mutate({ giaiDoanId: xacNhanToggle.id, dto: { trang_thai: trangThaiMoi } }, { onSuccess, onError });
    } else {
      capNhatCum.mutate({ cumId: xacNhanToggle.id, dto: { trang_thai: trangThaiMoi } }, { onSuccess, onError });
    }
  }

  const dangXuLyToggle = capNhatLop.isPending || capNhatGiaiDoan.isPending || capNhatCum.isPending;

  // --- Xóa nhân sự lớp -------------------------------------------------------
  const [xacNhanXoa, setXacNhanXoa] = useState<XacNhanXoa | null>(null);

  function xuLyXacNhanXoa() {
    if (!xacNhanXoa) return;
    xoaNhanSu.mutate(
      { lopId: xacNhanXoa.lopId, nhanSuId: xacNhanXoa.nhanSuId },
      {
        onSuccess: () => {
          notifications.show({ color: 'green', message: `Đã gỡ "${xacNhanXoa.ten}"` });
          setXacNhanXoa(null);
        },
        onError: (err) => notifications.show({ color: 'red', message: thongDiepLoiKhoa(err) }),
      },
    );
  }

  // --- Form hợp lệ (validate tối thiểu client-side) -------------------------
  const formTaoLopHopLe = formTaoLop.ten_lop.trim() !== '' && formTaoLop.loai_lop !== '';
  const formSuaLopHopLe = !!formSuaLop && formSuaLop.ten_lop.trim() !== '' && formSuaLop.loai_lop !== '';
  // T10 (issue #2): buổi thuộc giai đoạn hình thức trực tiếp phải có điểm học.
  const laGiaiDoanTrucTiep = (giaiDoanId: string) =>
    khoa?.giai_doan?.find((g) => g.id === giaiDoanId)?.hinh_thuc === 'truc_tiep';
  const buoiMoiCanDiemHoc = laGiaiDoanTrucTiep(formBuoi.giai_doan_id);
  const buoiSuaCanDiemHoc = !!formSuaBuoi && laGiaiDoanTrucTiep(formSuaBuoi.giai_doan_id);
  const formBuoiHopLe =
    formBuoi.giai_doan_id !== '' &&
    formBuoi.thoi_gian_bat_dau !== '' &&
    formBuoi.thoi_gian_ket_thuc !== '' &&
    new Date(formBuoi.thoi_gian_ket_thuc) > new Date(formBuoi.thoi_gian_bat_dau) &&
    (!buoiMoiCanDiemHoc || !!formBuoi.diem_hoc_id);
  const formSuaBuoiHopLe =
    !!formSuaBuoi &&
    formSuaBuoi.thoi_gian_bat_dau !== '' &&
    formSuaBuoi.thoi_gian_ket_thuc !== '' &&
    new Date(formSuaBuoi.thoi_gian_ket_thuc) > new Date(formSuaBuoi.thoi_gian_bat_dau) &&
    (!buoiSuaCanDiemHoc || !!formSuaBuoi.diem_hoc_id);
  const formNhanSuHopLe = formNhanSu.ho_ten.trim() !== '' && formNhanSu.vai_tro !== '';
  const formTaoGiaiDoanHopLe =
    formTaoGiaiDoan.thu_tu !== '' &&
    formTaoGiaiDoan.ten_giai_doan.trim() !== '' &&
    formTaoGiaiDoan.hinh_thuc !== '' &&
    formTaoGiaiDoan.thoi_gian_bat_dau !== '' &&
    formTaoGiaiDoan.thoi_gian_ket_thuc !== '' &&
    formTaoGiaiDoan.thoi_gian_ket_thuc >= formTaoGiaiDoan.thoi_gian_bat_dau;
  const formSuaGiaiDoanHopLe =
    !!formSuaGiaiDoan &&
    formSuaGiaiDoan.thu_tu !== '' &&
    formSuaGiaiDoan.ten_giai_doan.trim() !== '' &&
    formSuaGiaiDoan.hinh_thuc !== '' &&
    formSuaGiaiDoan.thoi_gian_bat_dau !== '' &&
    formSuaGiaiDoan.thoi_gian_ket_thuc !== '' &&
    formSuaGiaiDoan.thoi_gian_ket_thuc >= formSuaGiaiDoan.thoi_gian_bat_dau;
  const formTaoCumHopLe = formTaoCum.ten_cum.trim() !== '';
  const formSuaCumHopLe = !!formSuaCum && formSuaCum.ten_cum.trim() !== '';

  const tuyChonGiaiDoan = (khoa?.giai_doan ?? []).map((g) => ({ value: g.id, label: `GĐ ${g.thu_tu} — ${g.ten_giai_doan}` }));

  return (
    <>
      <AdminPageHeader title="Chi tiết khóa bồi dưỡng" />
      <Container size="xl" py="lg" px={{ base: 'md', md: 28 }}>
        {isLoading && (
          <Stack gap="sm">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} height={24} />
            ))}
          </Stack>
        )}

        {isError && <Alert color="red">{thongDiepLoiChung(error)}</Alert>}

        {khoa && (
          <Stack gap="lg">
            <Breadcrumbs fz={12.5}>
              <Anchor component={Link} to="/admin/khoa-boi-duong" fz={12.5} c="dimmed">
                Khóa bồi dưỡng
              </Anchor>
              <Text fz={12.5} c="dimmed">
                {khoa.ma_khoa}
              </Text>
            </Breadcrumbs>

            <Group justify="space-between" align="flex-start" wrap="wrap">
              <Box>
                <Group gap="sm" mb={6}>
                  <Title order={1} size="h3">
                    {khoa.ten_khoa}
                  </Title>
                  <KhoaTrangThaiBadge trangThai={khoa.trang_thai} />
                </Group>
                <Text fz={13} c="dimmed">
                  Mã khóa <b>{khoa.ma_khoa}</b> · {dinhDangNgay(khoa.thoi_gian_bat_dau)} –{' '}
                  {dinhDangNgay(khoa.thoi_gian_ket_thuc)} · {khoa.lop_hoc.length} lớp học
                </Text>
                <Text fz={13} c="dimmed">
                  Đặt hàng: {donViMap.get(khoa.don_vi_dat_hang_id) ?? '—'} · Tổ chức: Trường ĐHSP TP.HCM
                </Text>
              </Box>

              <Group gap="sm">
                {laQuanTri && (
                  <Button variant="default" onClick={moModalSuaKhoa}>
                    Sửa khóa
                  </Button>
                )}
              </Group>
            </Group>

            {laQuanTri && (
              <Paper withBorder radius={14} p="md">
                <Switch
                  label="Cho học viên điều chỉnh mức lớp học"
                  description="Học viên chỉ được chọn mức bằng hoặc thấp hơn kết quả đánh giá đầu vào; có hiệu lực ngay."
                  checked={khoa.mo_dieu_chinh_muc}
                  disabled={batTatDieuChinhMuc.isPending}
                  onChange={(e) =>
                    batTatDieuChinhMuc.mutate(
                      { mo_dieu_chinh_muc: e.currentTarget.checked },
                      {
                        onSuccess: (k) =>
                          notifications.show({
                            color: 'green',
                            message: k.mo_dieu_chinh_muc
                              ? 'Đã mở cho học viên điều chỉnh mức lớp học'
                              : 'Đã đóng điều chỉnh mức lớp học',
                          }),
                        onError: (err) => notifications.show({ color: 'red', message: thongDiepLoiChung(err) }),
                      },
                    )
                  }
                />
              </Paper>
            )}

            {khoa.pham_vi_hoc_vien === 'don_vi' && (
              <Alert color="blue" variant="light">
                Bạn đang xem các học viên thuộc đơn vị của mình trong khóa này.
              </Alert>
            )}

            <Tabs defaultValue="lop-hoc">
              <Tabs.List>
                <Tabs.Tab value="lop-hoc">Lớp học</Tabs.Tab>
                <Tabs.Tab value="giai-doan">Giai đoạn</Tabs.Tab>
                <Tabs.Tab value="cum">Cụm hỗ trợ Zalo</Tabs.Tab>
                {laQuanTri && <Tabs.Tab value="ho-tro-gv">Hỗ trợ giảng viên</Tabs.Tab>}
                {laQuanTri && <Tabs.Tab value="bang-kiem">Bảng kiểm chuẩn bị</Tabs.Tab>}
              </Tabs.List>

              {/* ---------------- Tab Lớp học ---------------- */}
              <Tabs.Panel value="lop-hoc" pt="md">
                <Stack gap="sm">
                  {laQuanTri && (
                    <>
                      <Group justify="flex-end">
                        {/* /import chỉ QuảnTrị gọi được — Trường không thấy nút này. */}
                        {vaiTro === 'quan_tri' && (
                          <>
                            <Button variant="default" onClick={() => setModalImport(true)}>
                              ⇪ Import Excel
                            </Button>
                            <Button
                              variant="light"
                              size="xs"
                              loading={dangXuatChiaLop}
                              onClick={() => void xuLyXuatDanhSachChiaLop()}
                            >
                              Xuất danh sách chia lớp
                            </Button>
                          </>
                        )}
                        <Button color="accent" onClick={moModalTaoLop}>
                          + Tạo lớp mới
                        </Button>
                      </Group>
                      {vaiTro === 'quan_tri' && (
                        <Text size="xs" c="dimmed" ta="right">
                          Mỗi học viên 1 dòng kèm kết quả đánh giá, mức học viên chọn và lớp hiện tại. Điền cột GĐ rồi
                          nhập lại qua Nhập dữ liệu → Phân lớp học viên.
                        </Text>
                      )}
                    </>
                  )}
                  <Paper withBorder radius={14} style={{ overflow: 'hidden' }}>
                    <Table highlightOnHover verticalSpacing="sm" horizontalSpacing="md">
                      <Table.Thead>
                        <Table.Tr>
                          <Table.Th>Tên lớp</Table.Th>
                          <Table.Th>Loại lớp</Table.Th>
                          <Table.Th>Sĩ số tối đa</Table.Th>
                          <Table.Th>Sĩ số hiện tại</Table.Th>
                          <Table.Th>Giảng viên / nhân sự</Table.Th>
                          <Table.Th>Trạng thái</Table.Th>
                          <Table.Th>Số buổi đã lên lịch</Table.Th>
                          <Table.Th />
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        {khoa.lop_hoc.length === 0 && (
                          <Table.Tr>
                            <Table.Td colSpan={7}>
                              <Text c="dimmed" ta="center" py="lg">
                                Khóa chưa có lớp học nào.
                              </Text>
                            </Table.Td>
                          </Table.Tr>
                        )}
                        {khoa.lop_hoc.map((lop) => {
                          const moRong = lopMoRong.has(lop.id);
                          return (
                            <Fragment key={lop.id}>
                              <Table.Tr>
                                <Table.Td fw={600}>{lop.ten_lop}</Table.Td>
                                <Table.Td>
                                  <Badge color={MAU_LOAI_LOP[lop.loai_lop]} radius="xl">
                                    {NHAN_LOAI_LOP[lop.loai_lop]}
                                  </Badge>
                                </Table.Td>
                                <Table.Td>{lop.si_so_toi_da ?? '—'}</Table.Td>
                                <Table.Td>{lop.si_so_hien_tai ?? 0}</Table.Td>
                                <Table.Td>
                                  {lop.nhan_su && lop.nhan_su.length > 0
                                    ? lop.nhan_su.map((n) => n.ho_ten).join(', ')
                                    : '—'}
                                </Table.Td>
                                <Table.Td>
                                  <BadgeHoatDong trangThai={lop.trang_thai} />
                                </Table.Td>
                                <Table.Td>{lop.lich_hoc?.length ?? 0}</Table.Td>
                                <Table.Td>
                                  <Group gap={6} justify="flex-end" wrap="nowrap">
                                    <Button variant="subtle" size="xs" onClick={() => toggleMoRongLop(lop.id)}>
                                      {moRong ? 'Thu gọn ▴' : 'Xem chi tiết ▾'}
                                    </Button>
                                    {laQuanTri && (
                                      <>
                                        <Button variant="subtle" size="xs" onClick={() => moModalSuaLop(lop)}>
                                          Sửa
                                        </Button>
                                        <Button
                                          variant="subtle"
                                          size="xs"
                                          color={lop.trang_thai === 'active' ? 'red' : 'green'}
                                          onClick={() =>
                                            setXacNhanToggle({
                                              loai: 'lop',
                                              id: lop.id,
                                              ten: lop.ten_lop,
                                              dangHoatDong: lop.trang_thai === 'active',
                                            })
                                          }
                                        >
                                          {lop.trang_thai === 'active' ? 'Vô hiệu hóa' : 'Kích hoạt lại'}
                                        </Button>
                                      </>
                                    )}
                                  </Group>
                                </Table.Td>
                              </Table.Tr>
                              {moRong && (
                                <Table.Tr key={`${lop.id}-mo-rong`}>
                                  <Table.Td colSpan={7} style={{ backgroundColor: 'var(--mantine-color-gray-0)' }}>
                                    <Stack gap="md" py="xs">
                                      <Box>
                                        <Group justify="space-between" mb={6}>
                                          <Text fw={600} fz={13.5}>
                                            Buổi học
                                          </Text>
                                          {laQuanTri && (
                                            <Button variant="light" size="xs" onClick={() => moModalThemBuoi(lop)}>
                                              + Thêm buổi học
                                            </Button>
                                          )}
                                        </Group>
                                        {(lop.lich_hoc ?? []).length === 0 && (
                                          <Text c="dimmed" fz={13}>
                                            Lớp chưa có buổi học nào.
                                          </Text>
                                        )}
                                        {(lop.lich_hoc ?? []).length > 0 && (
                                          <Table verticalSpacing={6} horizontalSpacing="sm">
                                            <Table.Thead>
                                              <Table.Tr>
                                                <Table.Th>Giai đoạn</Table.Th>
                                                <Table.Th>Buổi</Table.Th>
                                                <Table.Th>Thời gian</Table.Th>
                                                <Table.Th>Địa điểm/link</Table.Th>
                                                <Table.Th>Điểm học</Table.Th>
                                                <Table.Th>Giảng viên</Table.Th>
                                                <Table.Th>Trạng thái</Table.Th>
                                                <Table.Th />
                                              </Table.Tr>
                                            </Table.Thead>
                                            <Table.Tbody>
                                              {(lop.lich_hoc ?? []).map((lich) => (
                                                <Table.Tr key={lich.id}>
                                                  <Table.Td>{lich.giai_doan?.ten_giai_doan ?? '—'}</Table.Td>
                                                  <Table.Td>{lich.buoi_so}</Table.Td>
                                                  <Table.Td style={{ whiteSpace: 'nowrap' }}>
                                                    {dinhDangNgayGio(lich.thoi_gian_bat_dau)} – {dinhDangNgayGio(lich.thoi_gian_ket_thuc)}
                                                  </Table.Td>
                                                  <Table.Td>{lich.dia_diem_hoac_link ?? '—'}</Table.Td>
                                                  <Table.Td>
                                                    {lich.diem_hoc ? (
                                                      <>
                                                        <Text fz={13}>{lich.diem_hoc.ten}</Text>
                                                        {lich.phong && (
                                                          <Text fz={12} c="dimmed">
                                                            Phòng {lich.phong}
                                                          </Text>
                                                        )}
                                                      </>
                                                    ) : lich.giai_doan?.hinh_thuc === 'truc_tiep' ? (
                                                      <Text fz={12.5} c="red">
                                                        Chưa có
                                                      </Text>
                                                    ) : (
                                                      '—'
                                                    )}
                                                  </Table.Td>
                                                  <Table.Td>
                                                    {(lich.phan_cong ?? []).length === 0
                                                      ? '—'
                                                      : (lich.phan_cong ?? []).map((p) => (
                                                          <Text key={p.id} fz={13}>
                                                            {p.giang_vien.ho_ten}
                                                            {p.vai_tro === 'ho_tro' ? ' (hỗ trợ)' : ''}
                                                            {p.da_xac_nhan_gio ? ' ✓' : ''}
                                                          </Text>
                                                        ))}
                                                  </Table.Td>
                                                  <Table.Td>{NHAN_TRANG_THAI_LICH_HOC[lich.trang_thai]}</Table.Td>
                                                  <Table.Td ta="right" style={{ whiteSpace: 'nowrap' }}>
                                                    {laQuanTri && (
                                                      <>
                                                        <Button variant="subtle" size="xs" onClick={() => setBuoiPhanCong({ lop, lich })}>
                                                          Giảng viên
                                                        </Button>
                                                        <Button variant="subtle" size="xs" onClick={() => moModalSuaBuoi(lop, lich)}>
                                                          Sửa
                                                        </Button>
                                                      </>
                                                    )}
                                                  </Table.Td>
                                                </Table.Tr>
                                              ))}
                                            </Table.Tbody>
                                          </Table>
                                        )}
                                      </Box>

                                      <Box>
                                        <Group justify="space-between" mb={6}>
                                          <Text fw={600} fz={13.5}>
                                            Nhân sự
                                          </Text>
                                          {laQuanTri && (
                                            <Button variant="light" size="xs" onClick={() => moModalThemNhanSu(lop)}>
                                              + Thêm nhân sự
                                            </Button>
                                          )}
                                        </Group>
                                        {(lop.nhan_su ?? []).length === 0 && (
                                          <Text c="dimmed" fz={13}>
                                            Lớp chưa có nhân sự nào.
                                          </Text>
                                        )}
                                        {(lop.nhan_su ?? []).length > 0 && (
                                          <Stack gap={4}>
                                            {(lop.nhan_su ?? []).map((ns) => (
                                              <Group key={ns.id} justify="space-between" wrap="nowrap">
                                                <Text fz={13.5}>
                                                  {ns.ho_ten} — {NHAN_VAI_TRO_NHAN_SU[ns.vai_tro]}
                                                  {ns.so_dien_thoai ? ` · ${ns.so_dien_thoai}` : ''}
                                                </Text>
                                                {laQuanTri && (
                                                  <Button
                                                    variant="subtle"
                                                    size="xs"
                                                    color="red"
                                                    onClick={() =>
                                                      setXacNhanXoa({ loai: 'nhan-su', lopId: lop.id, nhanSuId: ns.id, ten: ns.ho_ten })
                                                    }
                                                  >
                                                    Xóa
                                                  </Button>
                                                )}
                                              </Group>
                                            ))}
                                          </Stack>
                                        )}
                                      </Box>
                                    </Stack>
                                  </Table.Td>
                                </Table.Tr>
                              )}
                            </Fragment>
                          );
                        })}
                      </Table.Tbody>
                    </Table>
                  </Paper>
                </Stack>
              </Tabs.Panel>

              {/* ---------------- Tab Giai đoạn ---------------- */}
              <Tabs.Panel value="giai-doan" pt="md">
                <Stack gap="sm">
                  {laQuanTri && (
                    <Group justify="flex-end">
                      <Button color="accent" onClick={moModalTaoGiaiDoan}>
                        + Tạo giai đoạn
                      </Button>
                    </Group>
                  )}
                  <Paper withBorder radius={14} style={{ overflow: 'hidden' }}>
                    <Table highlightOnHover verticalSpacing="sm" horizontalSpacing="md">
                      <Table.Thead>
                        <Table.Tr>
                          <Table.Th>Thứ tự</Table.Th>
                          <Table.Th>Tên giai đoạn</Table.Th>
                          <Table.Th>Hình thức</Table.Th>
                          <Table.Th>Thời gian</Table.Th>
                          <Table.Th>Trạng thái</Table.Th>
                          <Table.Th />
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        {khoa.giai_doan.length === 0 && (
                          <Table.Tr>
                            <Table.Td colSpan={6}>
                              <Text c="dimmed" ta="center" py="lg">
                                Khóa chưa có giai đoạn nào.
                              </Text>
                            </Table.Td>
                          </Table.Tr>
                        )}
                        {khoa.giai_doan.map((gd) => (
                          <Table.Tr key={gd.id}>
                            <Table.Td>{gd.thu_tu}</Table.Td>
                            <Table.Td fw={600}>{gd.ten_giai_doan}</Table.Td>
                            <Table.Td>{NHAN_HINH_THUC_GIAI_DOAN[gd.hinh_thuc]}</Table.Td>
                            <Table.Td style={{ whiteSpace: 'nowrap' }}>
                              {dinhDangNgay(gd.thoi_gian_bat_dau)} – {dinhDangNgay(gd.thoi_gian_ket_thuc)}
                            </Table.Td>
                            <Table.Td>
                              <BadgeHoatDong trangThai={gd.trang_thai} />
                            </Table.Td>
                            <Table.Td>
                              {laQuanTri && (
                                <Group gap={6} justify="flex-end" wrap="nowrap">
                                  <Button variant="subtle" size="xs" onClick={() => moModalSuaGiaiDoan(gd)}>
                                    Sửa
                                  </Button>
                                  <Button
                                    variant="subtle"
                                    size="xs"
                                    color={gd.trang_thai === 'active' ? 'red' : 'green'}
                                    onClick={() =>
                                      setXacNhanToggle({
                                        loai: 'giai-doan',
                                        id: gd.id,
                                        ten: gd.ten_giai_doan,
                                        dangHoatDong: gd.trang_thai === 'active',
                                      })
                                    }
                                  >
                                    {gd.trang_thai === 'active' ? 'Vô hiệu hóa' : 'Kích hoạt lại'}
                                  </Button>
                                </Group>
                              )}
                            </Table.Td>
                          </Table.Tr>
                        ))}
                      </Table.Tbody>
                    </Table>
                  </Paper>
                </Stack>
              </Tabs.Panel>

              {/* ---------------- Tab Cụm hỗ trợ Zalo ---------------- */}
              <Tabs.Panel value="cum" pt="md">
                <Stack gap="sm">
                  {laQuanTri && (
                    <Group justify="flex-end">
                      <Button color="accent" onClick={moModalTaoCum}>
                        + Tạo cụm
                      </Button>
                    </Group>
                  )}
                  <Paper withBorder radius={14} style={{ overflow: 'hidden' }}>
                    <Table highlightOnHover verticalSpacing="sm" horizontalSpacing="md">
                      <Table.Thead>
                        <Table.Tr>
                          <Table.Th>Tên cụm</Table.Th>
                          <Table.Th>Link Zalo</Table.Th>
                          <Table.Th>Ghi chú</Table.Th>
                          {laQuanTri && <Table.Th>Người hỗ trợ</Table.Th>}
                          <Table.Th>Trạng thái</Table.Th>
                          <Table.Th />
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        {khoa.cum_hoc_vien.length === 0 && (
                          <Table.Tr>
                            <Table.Td colSpan={laQuanTri ? 6 : 5}>
                              <Text c="dimmed" ta="center" py="lg">
                                Khóa chưa có cụm hỗ trợ Zalo nào.
                              </Text>
                            </Table.Td>
                          </Table.Tr>
                        )}
                        {khoa.cum_hoc_vien.map((cum) => {
                          const hrefZalo = cum.link_zalo ? chuanHoaLienKet(cum.link_zalo) : null;
                          return (
                            <Table.Tr key={cum.id}>
                              <Table.Td fw={600}>{cum.ten_cum}</Table.Td>
                              <Table.Td>
                                {cum.link_zalo ? (
                                  hrefZalo ? (
                                    <Anchor href={hrefZalo} target="_blank" rel="noreferrer" fz={13.5}>
                                      {cum.link_zalo}
                                    </Anchor>
                                  ) : (
                                    <Text c="dimmed" fz={13.5}>
                                      {cum.link_zalo}
                                    </Text>
                                  )
                                ) : (
                                  '—'
                                )}
                              </Table.Td>
                              <Table.Td>{cum.ghi_chu ?? '—'}</Table.Td>
                              {laQuanTri && (
                                <Table.Td>
                                  <ChonNguoiHoTroCum khoaId={khoa.id} cum={cum} />
                                </Table.Td>
                              )}
                              <Table.Td>
                                <BadgeHoatDong trangThai={cum.trang_thai} />
                              </Table.Td>
                              <Table.Td>
                                {laQuanTri && (
                                  <Group gap={6} justify="flex-end" wrap="nowrap">
                                    <Button variant="subtle" size="xs" onClick={() => moModalSuaCum(cum)}>
                                      Sửa
                                    </Button>
                                    <Button
                                      variant="subtle"
                                      size="xs"
                                      color={cum.trang_thai === 'active' ? 'red' : 'green'}
                                      onClick={() =>
                                        setXacNhanToggle({
                                          loai: 'cum',
                                          id: cum.id,
                                          ten: cum.ten_cum,
                                          dangHoatDong: cum.trang_thai === 'active',
                                        })
                                      }
                                    >
                                      {cum.trang_thai === 'active' ? 'Vô hiệu hóa' : 'Kích hoạt lại'}
                                    </Button>
                                  </Group>
                                )}
                              </Table.Td>
                            </Table.Tr>
                          );
                        })}
                      </Table.Tbody>
                    </Table>
                  </Paper>
                </Stack>
              </Tabs.Panel>

              {laQuanTri && (
                <Tabs.Panel value="ho-tro-gv" pt="md">
                  <ChonNhomHoTroGv khoa={khoa} />
                </Tabs.Panel>
              )}
              {laQuanTri && (
                <Tabs.Panel value="bang-kiem" pt="md">
                  <BangKiemEditor khoaId={khoa.id} />
                </Tabs.Panel>
              )}
            </Tabs>
          </Stack>
        )}
      </Container>

      {/* ================= Modal: Sửa khóa (chỉ quan_tri) ================= */}
      <Modal opened={modalSuaKhoa} onClose={() => setModalSuaKhoa(false)} title="Sửa khóa bồi dưỡng" centered>
        {formSuaKhoa && (
          <Stack gap="sm">
            <TextInput
              label="Mã khóa"
              required
              value={formSuaKhoa.ma_khoa}
              error={loiSuaKhoa.ma_khoa}
              onChange={(e) => { const v = e.currentTarget.value; setFormSuaKhoa((f) => (f ? { ...f, ma_khoa: v } : f)); }}
            />
            <TextInput
              label="Tên khóa"
              required
              value={formSuaKhoa.ten_khoa}
              error={loiSuaKhoa.ten_khoa}
              onChange={(e) => { const v = e.currentTarget.value; setFormSuaKhoa((f) => (f ? { ...f, ten_khoa: v } : f)); }}
            />
            <TextInput
              label="Địa điểm"
              value={formSuaKhoa.dia_diem}
              error={loiSuaKhoa.dia_diem}
              onChange={(e) => { const v = e.currentTarget.value; setFormSuaKhoa((f) => (f ? { ...f, dia_diem: v } : f)); }}
            />
            <Group grow>
              <TextInput
                type="date"
                label="Ngày bắt đầu"
                required
                value={formSuaKhoa.thoi_gian_bat_dau}
                error={loiSuaKhoa.thoi_gian_bat_dau}
                onChange={(e) => { const v = e.currentTarget.value; setFormSuaKhoa((f) => (f ? { ...f, thoi_gian_bat_dau: v } : f)); }}
              />
              <TextInput
                type="date"
                label="Ngày kết thúc"
                required
                value={formSuaKhoa.thoi_gian_ket_thuc}
                error={loiSuaKhoa.thoi_gian_ket_thuc}
                onChange={(e) => { const v = e.currentTarget.value; setFormSuaKhoa((f) => (f ? { ...f, thoi_gian_ket_thuc: v } : f)); }}
              />
            </Group>
            <Select
              label="Đơn vị đặt hàng"
              required
              searchable
              filter={locTiengViet}
              data={nhomDonViDatHang}
              value={formSuaKhoa.don_vi_dat_hang_id || null}
              error={loiSuaKhoa.don_vi_dat_hang_id}
              onChange={(v) => setFormSuaKhoa((f) => (f ? { ...f, don_vi_dat_hang_id: v ?? '' } : f))}
            />
            <Button mt="sm" loading={capNhatKhoa.isPending} disabled={!formSuaKhoaHopLe} onClick={xuLySuaKhoa} fullWidth>
              Lưu thay đổi
            </Button>
          </Stack>
        )}
      </Modal>

      {khoa && (
        <ModalImportLopHoc
          opened={modalImport}
          onClose={() => setModalImport(false)}
          khoaId={khoaId}
          maKhoa={khoa.ma_khoa}
        />
      )}

      {/* ================= Modal: Tạo lớp ================= */}
      <Modal opened={modalTaoLop} onClose={() => setModalTaoLop(false)} title="Tạo lớp mới" centered>
        <Stack gap="sm">
          <TextInput
            label="Tên lớp"
            required
            value={formTaoLop.ten_lop}
            error={loiTaoLop.ten_lop}
            onChange={(e) => { const v = e.currentTarget.value; setFormTaoLop((f) => ({ ...f, ten_lop: v })); }}
          />
          <Select
            label="Loại lớp"
            required
            data={TUY_CHON_LOAI_LOP}
            value={formTaoLop.loai_lop || null}
            error={loiTaoLop.loai_lop}
            onChange={(v) => setFormTaoLop((f) => ({ ...f, loai_lop: (v as LoaiLop) || '' }))}
          />
          <NumberInput
            label="Sĩ số tối đa"
            min={1}
            value={formTaoLop.si_so_toi_da}
            error={loiTaoLop.si_so_toi_da}
            onChange={(v) => setFormTaoLop((f) => ({ ...f, si_so_toi_da: v === '' ? '' : String(v) }))}
          />
          <Text fz={12} c="dimmed">
            Nhóm học viên và mức năng lực chỉ có thể đặt sau khi tạo lớp, qua nút "Sửa".
          </Text>
          <Button mt="sm" loading={taoLop.isPending} disabled={!formTaoLopHopLe} onClick={xuLyTaoLop} fullWidth>
            Tạo lớp
          </Button>
        </Stack>
      </Modal>

      {/* ================= Modal: Sửa lớp ================= */}
      <Modal opened={!!lopDangSua} onClose={() => setLopDangSua(null)} title="Sửa lớp học" centered>
        {formSuaLop && (
          <Stack gap="sm">
            <TextInput
              label="Tên lớp"
              required
              value={formSuaLop.ten_lop}
              error={loiSuaLop.ten_lop}
              onChange={(e) => { const v = e.currentTarget.value; setFormSuaLop((f) => (f ? { ...f, ten_lop: v } : f)); }}
            />
            <Select
              label="Loại lớp"
              required
              data={TUY_CHON_LOAI_LOP}
              value={formSuaLop.loai_lop || null}
              error={loiSuaLop.loai_lop}
              onChange={(v) => setFormSuaLop((f) => (f ? { ...f, loai_lop: (v as LoaiLop) || '' } : f))}
            />
            <NumberInput
              label="Sĩ số tối đa"
              min={1}
              value={formSuaLop.si_so_toi_da}
              error={loiSuaLop.si_so_toi_da}
              onChange={(v) => setFormSuaLop((f) => (f ? { ...f, si_so_toi_da: v === '' ? '' : String(v) } : f))}
            />
            <NumberInput
              label="Nhóm học viên"
              description="1–20"
              min={1}
              max={20}
              value={formSuaLop.nhom_hoc_vien}
              error={loiSuaLop.nhom_hoc_vien}
              onChange={(v) => setFormSuaLop((f) => (f ? { ...f, nhom_hoc_vien: v === '' ? '' : String(v) } : f))}
            />
            <Select
              label="Mức năng lực"
              data={TUY_CHON_MUC_NANG_LUC}
              value={formSuaLop.muc_nang_luc || null}
              error={loiSuaLop.muc_nang_luc}
              onChange={(v) => setFormSuaLop((f) => (f ? { ...f, muc_nang_luc: (v as MucNangLuc) || '' } : f))}
              clearable
            />
            <Button mt="sm" loading={capNhatLop.isPending} disabled={!formSuaLopHopLe} onClick={xuLySuaLop} fullWidth>
              Lưu thay đổi
            </Button>
          </Stack>
        )}
      </Modal>

      {/* ================= Modal: Thêm buổi học ================= */}
      <Modal opened={!!modalThemBuoi} onClose={() => setModalThemBuoi(null)} title={`Thêm buổi học — ${modalThemBuoi?.ten_lop ?? ''}`} centered>
        <Stack gap="sm">
          <Select
            label="Giai đoạn"
            required
            data={tuyChonGiaiDoan}
            value={formBuoi.giai_doan_id || null}
            error={loiBuoi.giai_doan_id}
            onChange={(v) => setFormBuoi((f) => ({ ...f, giai_doan_id: v ?? '' }))}
          />
          {tuyChonGiaiDoan.length === 0 && (
            <Text fz={12} c="dimmed">
              Khóa chưa có giai đoạn nào — tạo giai đoạn trước ở tab "Giai đoạn".
            </Text>
          )}
          <NumberInput
            label="Buổi số"
            min={1}
            value={formBuoi.buoi_so}
            error={loiBuoi.buoi_so}
            onChange={(v) => setFormBuoi((f) => ({ ...f, buoi_so: v === '' ? '' : String(v) }))}
          />
          <Group grow>
            <TextInput
              type="datetime-local"
              label="Bắt đầu"
              required
              value={formBuoi.thoi_gian_bat_dau}
              error={loiBuoi.thoi_gian_bat_dau}
              onChange={(e) => { const v = e.currentTarget.value; setFormBuoi((f) => ({ ...f, thoi_gian_bat_dau: v })); }}
            />
            <TextInput
              type="datetime-local"
              label="Kết thúc"
              required
              value={formBuoi.thoi_gian_ket_thuc}
              error={loiBuoi.thoi_gian_ket_thuc}
              onChange={(e) => { const v = e.currentTarget.value; setFormBuoi((f) => ({ ...f, thoi_gian_ket_thuc: v })); }}
            />
          </Group>
          <TextInput
            label="Địa điểm / link"
            value={formBuoi.dia_diem_hoac_link}
            error={loiBuoi.dia_diem_hoac_link}
            onChange={(e) => { const v = e.currentTarget.value; setFormBuoi((f) => ({ ...f, dia_diem_hoac_link: v })); }}
          />
          <Group grow align="flex-start">
            <SelectDiemHoc
              value={formBuoi.diem_hoc_id}
              onChange={(v) => setFormBuoi((f) => ({ ...f, diem_hoc_id: v }))}
              required={buoiMoiCanDiemHoc}
              error={loiBuoi.diem_hoc_id}
              description={buoiMoiCanDiemHoc ? 'Bắt buộc với giai đoạn trực tiếp' : undefined}
            />
            <TextInput
              label="Phòng"
              value={formBuoi.phong}
              error={loiBuoi.phong}
              onChange={(e) => { const v = e.currentTarget.value; setFormBuoi((f) => ({ ...f, phong: v })); }}
            />
          </Group>
          <Button mt="sm" loading={themLichHoc.isPending} disabled={!formBuoiHopLe} onClick={xuLyThemBuoi} fullWidth>
            Thêm buổi học
          </Button>
        </Stack>
      </Modal>

      <ModalPhanCongBuoi khoaId={khoaId} buoi={buoiPhanCong} onClose={() => setBuoiPhanCong(null)} />

      {/* ================= Modal: Sửa buổi học ================= */}
      <Modal opened={!!buoiDangSua} onClose={() => setBuoiDangSua(null)} title="Sửa buổi học" centered>
        {formSuaBuoi && (
          <Stack gap="sm">
            <NumberInput
              label="Buổi số"
              min={1}
              value={formSuaBuoi.buoi_so}
              error={loiSuaBuoi.buoi_so}
              onChange={(v) => setFormSuaBuoi((f) => (f ? { ...f, buoi_so: v === '' ? '' : String(v) } : f))}
            />
            <Group grow>
              <TextInput
                type="datetime-local"
                label="Bắt đầu"
                required
                value={formSuaBuoi.thoi_gian_bat_dau}
                error={loiSuaBuoi.thoi_gian_bat_dau}
                onChange={(e) => { const v = e.currentTarget.value; setFormSuaBuoi((f) => (f ? { ...f, thoi_gian_bat_dau: v } : f)); }}
              />
              <TextInput
                type="datetime-local"
                label="Kết thúc"
                required
                value={formSuaBuoi.thoi_gian_ket_thuc}
                error={loiSuaBuoi.thoi_gian_ket_thuc}
                onChange={(e) => { const v = e.currentTarget.value; setFormSuaBuoi((f) => (f ? { ...f, thoi_gian_ket_thuc: v } : f)); }}
              />
            </Group>
            <TextInput
              label="Địa điểm / link"
              value={formSuaBuoi.dia_diem_hoac_link}
              error={loiSuaBuoi.dia_diem_hoac_link}
              onChange={(e) => { const v = e.currentTarget.value; setFormSuaBuoi((f) => (f ? { ...f, dia_diem_hoac_link: v } : f)); }}
            />
            <Group grow align="flex-start">
              <SelectDiemHoc
                value={formSuaBuoi.diem_hoc_id}
                onChange={(v) => setFormSuaBuoi((f) => (f ? { ...f, diem_hoc_id: v } : f))}
                required={buoiSuaCanDiemHoc}
                error={loiSuaBuoi.diem_hoc_id}
                description={buoiSuaCanDiemHoc ? 'Bắt buộc với giai đoạn trực tiếp' : undefined}
              />
              <TextInput
                label="Phòng"
                value={formSuaBuoi.phong}
                error={loiSuaBuoi.phong}
                onChange={(e) => { const v = e.currentTarget.value; setFormSuaBuoi((f) => (f ? { ...f, phong: v } : f)); }}
              />
            </Group>
            <TextInput
              label="Lý do thay đổi"
              description="Ghi vào nhật ký khi đổi giờ/điểm học/phòng (để báo lại học viên, giảng viên)"
              value={formSuaBuoi.ly_do}
              error={loiSuaBuoi.ly_do}
              onChange={(e) => { const v = e.currentTarget.value; setFormSuaBuoi((f) => (f ? { ...f, ly_do: v } : f)); }}
            />
            <Select
              label="Trạng thái diễn ra"
              data={TUY_CHON_TRANG_THAI_LICH_HOC}
              value={formSuaBuoi.trang_thai}
              onChange={(v) => setFormSuaBuoi((f) => (f ? { ...f, trang_thai: v as TrangThaiLichHoc } : f))}
              allowDeselect={false}
            />
            <Button mt="sm" loading={capNhatLichHoc.isPending} disabled={!formSuaBuoiHopLe} onClick={xuLySuaBuoi} fullWidth>
              Lưu thay đổi
            </Button>
          </Stack>
        )}
      </Modal>

      {/* ================= Modal: Thêm nhân sự ================= */}
      <Modal opened={!!modalThemNhanSu} onClose={() => setModalThemNhanSu(null)} title={`Thêm nhân sự — ${modalThemNhanSu?.ten_lop ?? ''}`} centered>
        <Stack gap="sm">
          <TextInput
            label="Họ tên"
            required
            value={formNhanSu.ho_ten}
            error={loiNhanSu.ho_ten}
            onChange={(e) => { const v = e.currentTarget.value; setFormNhanSu((f) => ({ ...f, ho_ten: v })); }}
          />
          <Select
            label="Vai trò"
            required
            data={TUY_CHON_VAI_TRO_NHAN_SU}
            value={formNhanSu.vai_tro || null}
            error={loiNhanSu.vai_tro}
            onChange={(v) => setFormNhanSu((f) => ({ ...f, vai_tro: (v as VaiTroNhanSuLop) || '' }))}
          />
          <TextInput
            label="Số điện thoại"
            value={formNhanSu.so_dien_thoai}
            error={loiNhanSu.so_dien_thoai}
            onChange={(e) => { const v = e.currentTarget.value; setFormNhanSu((f) => ({ ...f, so_dien_thoai: v })); }}
          />
          <Button mt="sm" loading={themNhanSu.isPending} disabled={!formNhanSuHopLe} onClick={xuLyThemNhanSu} fullWidth>
            Thêm nhân sự
          </Button>
        </Stack>
      </Modal>

      {/* ================= Modal: Tạo giai đoạn ================= */}
      <Modal opened={modalTaoGiaiDoan} onClose={() => setModalTaoGiaiDoan(false)} title="Tạo giai đoạn" centered>
        <Stack gap="sm">
          <NumberInput
            label="Thứ tự"
            required
            min={1}
            value={formTaoGiaiDoan.thu_tu}
            error={loiTaoGiaiDoan.thu_tu}
            onChange={(v) => setFormTaoGiaiDoan((f) => ({ ...f, thu_tu: v === '' ? '' : String(v) }))}
          />
          <TextInput
            label="Tên giai đoạn"
            required
            value={formTaoGiaiDoan.ten_giai_doan}
            error={loiTaoGiaiDoan.ten_giai_doan}
            onChange={(e) => { const v = e.currentTarget.value; setFormTaoGiaiDoan((f) => ({ ...f, ten_giai_doan: v })); }}
          />
          <Select
            label="Hình thức"
            required
            data={TUY_CHON_HINH_THUC_GIAI_DOAN}
            value={formTaoGiaiDoan.hinh_thuc || null}
            error={loiTaoGiaiDoan.hinh_thuc}
            onChange={(v) => setFormTaoGiaiDoan((f) => ({ ...f, hinh_thuc: (v as HinhThucGiaiDoan) || '' }))}
          />
          <Group grow>
            <TextInput
              type="date"
              label="Ngày bắt đầu"
              required
              value={formTaoGiaiDoan.thoi_gian_bat_dau}
              error={loiTaoGiaiDoan.thoi_gian_bat_dau}
              onChange={(e) => { const v = e.currentTarget.value; setFormTaoGiaiDoan((f) => ({ ...f, thoi_gian_bat_dau: v })); }}
            />
            <TextInput
              type="date"
              label="Ngày kết thúc"
              required
              value={formTaoGiaiDoan.thoi_gian_ket_thuc}
              error={loiTaoGiaiDoan.thoi_gian_ket_thuc}
              onChange={(e) => { const v = e.currentTarget.value; setFormTaoGiaiDoan((f) => ({ ...f, thoi_gian_ket_thuc: v })); }}
            />
          </Group>
          <TextInput
            label="Link hoặc địa điểm"
            description="Hiện cho học viên không được gán lớp ở giai đoạn này (vd link bài đánh giá)"
            value={formTaoGiaiDoan.link_hoac_dia_diem}
            error={loiTaoGiaiDoan.link_hoac_dia_diem}
            onChange={(e) => { const v = e.currentTarget.value; setFormTaoGiaiDoan((f) => ({ ...f, link_hoac_dia_diem: v })); }}
          />
          <Textarea
            label="Hướng dẫn"
            autosize
            minRows={2}
            value={formTaoGiaiDoan.huong_dan}
            onChange={(e) => { const v = e.currentTarget.value; setFormTaoGiaiDoan((f) => ({ ...f, huong_dan: v })); }}
          />
          <Button mt="sm" loading={taoGiaiDoan.isPending} disabled={!formTaoGiaiDoanHopLe} onClick={xuLyTaoGiaiDoan} fullWidth>
            Tạo giai đoạn
          </Button>
        </Stack>
      </Modal>

      {/* ================= Modal: Sửa giai đoạn ================= */}
      <Modal opened={!!giaiDoanDangSua} onClose={() => setGiaiDoanDangSua(null)} title="Sửa giai đoạn" centered>
        {formSuaGiaiDoan && (
          <Stack gap="sm">
            <NumberInput
              label="Thứ tự"
              required
              min={1}
              value={formSuaGiaiDoan.thu_tu}
              error={loiSuaGiaiDoan.thu_tu}
              onChange={(v) => setFormSuaGiaiDoan((f) => (f ? { ...f, thu_tu: v === '' ? '' : String(v) } : f))}
            />
            <TextInput
              label="Tên giai đoạn"
              required
              value={formSuaGiaiDoan.ten_giai_doan}
              error={loiSuaGiaiDoan.ten_giai_doan}
              onChange={(e) => { const v = e.currentTarget.value; setFormSuaGiaiDoan((f) => (f ? { ...f, ten_giai_doan: v } : f)); }}
            />
            <Select
              label="Hình thức"
              required
              data={TUY_CHON_HINH_THUC_GIAI_DOAN}
              value={formSuaGiaiDoan.hinh_thuc || null}
              error={loiSuaGiaiDoan.hinh_thuc}
              onChange={(v) => setFormSuaGiaiDoan((f) => (f ? { ...f, hinh_thuc: (v as HinhThucGiaiDoan) || '' } : f))}
            />
            <Group grow>
              <TextInput
                type="date"
                label="Ngày bắt đầu"
                required
                value={formSuaGiaiDoan.thoi_gian_bat_dau}
                error={loiSuaGiaiDoan.thoi_gian_bat_dau}
                onChange={(e) => { const v = e.currentTarget.value; setFormSuaGiaiDoan((f) => (f ? { ...f, thoi_gian_bat_dau: v } : f)); }}
              />
              <TextInput
                type="date"
                label="Ngày kết thúc"
                required
                value={formSuaGiaiDoan.thoi_gian_ket_thuc}
                error={loiSuaGiaiDoan.thoi_gian_ket_thuc}
                onChange={(e) => { const v = e.currentTarget.value; setFormSuaGiaiDoan((f) => (f ? { ...f, thoi_gian_ket_thuc: v } : f)); }}
              />
            </Group>
            <TextInput
              label="Link hoặc địa điểm"
              description="Hiện cho học viên không được gán lớp ở giai đoạn này (vd link bài đánh giá)"
              value={formSuaGiaiDoan.link_hoac_dia_diem}
              error={loiSuaGiaiDoan.link_hoac_dia_diem}
              onChange={(e) => { const v = e.currentTarget.value; setFormSuaGiaiDoan((f) => (f ? { ...f, link_hoac_dia_diem: v } : f)); }}
            />
            <Textarea
              label="Hướng dẫn"
              autosize
              minRows={2}
              value={formSuaGiaiDoan.huong_dan}
              onChange={(e) => { const v = e.currentTarget.value; setFormSuaGiaiDoan((f) => (f ? { ...f, huong_dan: v } : f)); }}
            />
            <Button mt="sm" loading={capNhatGiaiDoan.isPending} disabled={!formSuaGiaiDoanHopLe} onClick={xuLySuaGiaiDoan} fullWidth>
              Lưu thay đổi
            </Button>
          </Stack>
        )}
      </Modal>

      {/* ================= Modal: Tạo cụm ================= */}
      <Modal opened={modalTaoCum} onClose={() => setModalTaoCum(false)} title="Tạo cụm hỗ trợ Zalo" centered>
        <Stack gap="sm">
          <TextInput
            label="Tên cụm"
            required
            value={formTaoCum.ten_cum}
            error={loiTaoCum.ten_cum}
            onChange={(e) => { const v = e.currentTarget.value; setFormTaoCum((f) => ({ ...f, ten_cum: v })); }}
          />
          <TextInput
            label="Link Zalo"
            value={formTaoCum.link_zalo}
            error={loiTaoCum.link_zalo}
            onChange={(e) => { const v = e.currentTarget.value; setFormTaoCum((f) => ({ ...f, link_zalo: v })); }}
          />
          <Textarea
            label="Ghi chú"
            value={formTaoCum.ghi_chu}
            error={loiTaoCum.ghi_chu}
            onChange={(e) => { const v = e.currentTarget.value; setFormTaoCum((f) => ({ ...f, ghi_chu: v })); }}
            minRows={2}
          />
          <Button mt="sm" loading={taoCum.isPending} disabled={!formTaoCumHopLe} onClick={xuLyTaoCum} fullWidth>
            Tạo cụm
          </Button>
        </Stack>
      </Modal>

      {/* ================= Modal: Sửa cụm ================= */}
      <Modal opened={!!cumDangSua} onClose={() => setCumDangSua(null)} title="Sửa cụm hỗ trợ Zalo" centered>
        {formSuaCum && (
          <Stack gap="sm">
            <TextInput
              label="Tên cụm"
              required
              value={formSuaCum.ten_cum}
              error={loiSuaCum.ten_cum}
              onChange={(e) => { const v = e.currentTarget.value; setFormSuaCum((f) => (f ? { ...f, ten_cum: v } : f)); }}
            />
            <TextInput
              label="Link Zalo"
              value={formSuaCum.link_zalo}
              error={loiSuaCum.link_zalo}
              onChange={(e) => { const v = e.currentTarget.value; setFormSuaCum((f) => (f ? { ...f, link_zalo: v } : f)); }}
            />
            <Textarea
              label="Ghi chú"
              value={formSuaCum.ghi_chu}
              error={loiSuaCum.ghi_chu}
              onChange={(e) => { const v = e.currentTarget.value; setFormSuaCum((f) => (f ? { ...f, ghi_chu: v } : f)); }}
              minRows={2}
            />
            <Button mt="sm" loading={capNhatCum.isPending} disabled={!formSuaCumHopLe} onClick={xuLySuaCum} fullWidth>
              Lưu thay đổi
            </Button>
          </Stack>
        )}
      </Modal>

      {/* ================= Modal xác nhận: vô hiệu hóa / kích hoạt lại ================= */}
      <Modal
        opened={!!xacNhanToggle}
        onClose={() => setXacNhanToggle(null)}
        title={xacNhanToggle?.dangHoatDong ? 'Vô hiệu hóa' : 'Kích hoạt lại'}
        centered
      >
        {xacNhanToggle && (
          <Stack gap="sm">
            <Text fz={14}>
              {xacNhanToggle.dangHoatDong
                ? `Vô hiệu hóa "${xacNhanToggle.ten}"? Các học viên đang gắn với mục này sẽ không bị ảnh hưởng ngay lập tức, nhưng cần rà soát lại.`
                : `Kích hoạt lại "${xacNhanToggle.ten}"?`}
            </Text>
            <Button
              color={xacNhanToggle.dangHoatDong ? 'red' : 'green'}
              loading={dangXuLyToggle}
              onClick={xuLyXacNhanToggle}
              fullWidth
            >
              Xác nhận
            </Button>
          </Stack>
        )}
      </Modal>

      {/* ================= Modal xác nhận: xóa nhân sự ================= */}
      <Modal opened={!!xacNhanXoa} onClose={() => setXacNhanXoa(null)} title="Xác nhận" centered>
        {xacNhanXoa && (
          <Stack gap="sm">
            <Text fz={14}>Xóa nhân sự "{xacNhanXoa.ten}" khỏi lớp? Thao tác này xóa cứng, không thể hoàn tác.</Text>
            <Button color="red" loading={xoaNhanSu.isPending} onClick={xuLyXacNhanXoa} fullWidth>
              Xác nhận
            </Button>
          </Stack>
        )}
      </Modal>
    </>
  );
}

/** Chuyển ISO UTC thành giá trị cho <input type="datetime-local"> theo giờ LOCAL của máy — khớp với
 * cách form tạo mới đang gửi lên (`new Date(value).toISOString()`, xem AdminDotXacNhan.tsx cùng quy
 * ước): dùng getter local (getHours...) thay vì getUTCHours để phép chuyển đổi luôn nghịch đảo đúng
 * `toISOString()` bất kể máy/CI đang chạy ở múi giờ nào (không hard-code +7 vì có thể sai trên CI). */
function isoThanhInputDiaPhuong(isoUtc: string): string {
  const d = new Date(isoUtc);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
