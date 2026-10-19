import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch, apiFetchBlob } from './client';
import type { LoaiLop, MucNangLuc } from './types';
import { taiFileTuBlob } from '@/lib/taiFile';

export type TrangThaiDeNghi = 'cho_duyet' | 'da_duyet' | 'tu_choi' | 'da_huy';

export const NHAN_TRANG_THAI_DE_NGHI: Record<TrangThaiDeNghi, string> = {
  cho_duyet: 'Chờ duyệt',
  da_duyet: 'Đã duyệt',
  tu_choi: 'Từ chối',
  da_huy: 'Đã hủy',
};

/** Nhãn trạng thái tab Đã xử lý / Thống kê — "Đã hủy" tách theo ai hủy để không bị hiểu nhầm là người duyệt hủy. */
export function nhanDaXuLy(d: { trang_thai: TrangThaiDeNghi; ly_do_huy: LyDoHuy | null; nguoi_xu_ly: string | null }): string {
  if (d.trang_thai !== 'da_huy') return NHAN_TRANG_THAI_DE_NGHI[d.trang_thai];
  if (d.ly_do_huy === 'hoc_vien_sua') return 'Học viên đã sửa (thay bằng đề nghị mới)';
  if (d.ly_do_huy === 'hoc_vien_huy') return 'Học viên tự hủy';
  if (d.ly_do_huy === 'thay_the') return 'Đã thay bằng đề nghị đổi lại';
  return d.nguoi_xu_ly ? `Hủy duyệt bởi ${d.nguoi_xu_ly}` : 'Hủy duyệt';
}

/** Tóm tắt 1 buổi học (khớp LichTomTat ở backend). */
export interface LichTomTat {
  id: string;
  lop_id: string;
  giai_doan_id: string;
  buoi_so: number;
  thoi_gian_bat_dau: string;
  lop: {
    khoa_id: string;
    loai_lop: LoaiLop;
    muc_nang_luc: MucNangLuc | null;
    trang_thai: string;
    si_so_toi_da: number | null;
    ten_lop: string;
  };
}

/** Tóm tắt buổi nhúng sẵn trong đề nghị — có cả buổi đã bắt đầu (để hiện nhãn lịch sử). */
export interface BuoiTomTat {
  id: string;
  buoi_so: number;
  thoi_gian_bat_dau: string;
  thoi_gian_ket_thuc: string | null;
  lop: { ten_lop: string };
}

/** Buổi trên lịch thực tế của học viên trùng giờ buổi đang xét (chỉ cảnh báo, không chặn). */
export interface LichTrung {
  id: string;
  buoi_so: number;
  thoi_gian_bat_dau: string;
  thoi_gian_ket_thuc: string;
  lop: { ten_lop: string };
}

export type LyDoHuy = 'hoc_vien_sua' | 'hoc_vien_huy' | 'huy_duyet' | 'thay_the';

export interface DeNghiHocVien {
  id: string;
  trang_thai: TrangThaiDeNghi;
  lich_nguon_id: string;
  lich_de_nghi_id: string;
  lich_chot_id: string | null;
  ly_do: string;
  tao_luc: string;
  ghi_chu_xu_ly: string | null;
  /** Chỉ khi trang_thai = da_huy: học viên sửa (bản cũ bị thay), học viên tự hủy, người duyệt hủy duyệt, hoặc bị thay bởi đề nghị đổi lại. */
  ly_do_huy: LyDoHuy | null;
  qua_han: boolean;
  thu_tu_hang: { k: number; n: number } | null;
  buoi_nguon: BuoiTomTat | null;
  buoi_de_nghi: BuoiTomTat | null;
  buoi_chot: BuoiTomTat | null;
  /** Đề nghị đổi lại (đang chờ): buổi đang học theo bản đã duyệt; còn lại null. */
  doi_lai_tu: BuoiTomTat | null;
  /** Chỉ đề nghị đang chờ: buổi trùng giờ buổi đề nghị; còn lại []. */
  trung_lich: LichTrung[];
}

export interface TongQuanDoiBuoi {
  so_buoi_doi_toi_da: number;
  /** Số buổi nguồn khác nhau có đề nghị chờ/đã duyệt — đổi lại không tốn thêm lượt. */
  so_luot_da_dung: number;
  /** de_nghi: bản đã duyệt nếu có, ngược lại bản chờ; de_nghi_doi_lai: bản chờ đè lên bản đã duyệt. */
  buoi_sap_toi: {
    lich_nguon: LichTomTat;
    de_nghi: DeNghiHocVien | null;
    de_nghi_doi_lai?: DeNghiHocVien | null;
  }[];
  de_nghi: DeNghiHocVien[];
}

export interface LuaChonBuoi {
  lich: LichTomTat;
  thoi_gian_ket_thuc: string;
  diem_hoc: { ten: string; dia_chi: string } | null;
  phong: string | null;
  /** Zoom luôn null (backend không lộ link). */
  dia_diem_hoac_link: string | null;
  si_so: number;
  si_so_toi_da: number | null;
  so_cho_duyet: number;
  da_du: boolean;
  /** Buổi trên lịch thực tế trùng giờ buổi này (đã bỏ buổi nguồn / buổi đang học khi đổi lại). */
  trung_lich: LichTrung[];
}

export interface GuiDoiBuoiBody {
  lich_nguon_id: string;
  lich_de_nghi_id: string;
  ly_do: string;
}

export interface DeNghiDuyet extends DeNghiHocVien {
  hoc_vien: { id: string; ho_ten: string; don_vi: string; cum: string | null };
  si_so: number;
  si_so_toi_da: number | null;
  so_cho_duyet: number;
  nguoi_xu_ly: string | null;
}

export interface LuaChonDuyet extends LuaChonBuoi {
  so_truoc: number;
  duyet_duoc: boolean;
}

export interface LocDoiBuoi {
  trang_thai?: TrangThaiDeNghi;
  khoa_id?: string;
  /** true = mọi đề nghị đã xử lý (server sắp xu_ly_luc giảm, tối đa 500). */
  da_xu_ly?: boolean;
  /** Chỉ với trang_thai=cho_duyet: true = đề nghị quá hạn (100 mới nhất); mặc định chỉ còn hạn. */
  qua_han?: boolean;
}

/** Spec đổi buổi §5: lich_hoc_id → đổi ra (sang lớp chốt) / đổi vào (từ lớp nguồn). hoc_bu = học bù (ADR 0012). */
export type NhanDoiBuoi = Record<string, { loai: 'ra' | 'vao'; lop: string; hoc_bu?: boolean }>;

export function nhanDoiBuoi(n: { loai: 'ra' | 'vao'; lop: string; hoc_bu?: boolean }): string {
  if (n.hoc_bu) return n.loai === 'vao' ? `Học bù từ ${n.lop}` : `Học bù tại ${n.lop}`;
  return n.loai === 'vao' ? `Từ ${n.lop}` : `Đổi sang ${n.lop}`;
}

/** Sĩ số buổi dạng "12/40" (hoặc "12" khi lớp không giới hạn) — null khi backend không trả sĩ số buổi. */
export function siSoBuoi(siSo: number | null | undefined, toiDa: number | null | undefined): string | null {
  if (siSo === null || siSo === undefined) return null;
  return toiDa ? `${siSo}/${toiDa}` : `${siSo}`;
}

const KEY = 'doi-buoi';

function qs(q: Record<string, string | undefined>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(q)) if (v) p.set(k, v);
  const s = p.toString();
  return s ? `?${s}` : '';
}

// ---- Học viên (/hoc-vien/toi/doi-buoi) ----

export function useTongQuanDoiBuoi(khoaId: string | undefined) {
  return useQuery({
    queryKey: [KEY, 'tong-quan', khoaId],
    queryFn: () => apiFetch<TongQuanDoiBuoi>(`/hoc-vien/toi/doi-buoi${qs({ khoa_id: khoaId })}`),
    enabled: !!khoaId,
    retry: false,
  });
}

export function useLuaChonDoiBuoi(lichNguonId: string | undefined) {
  return useQuery({
    queryKey: [KEY, 'lua-chon', lichNguonId],
    queryFn: () => apiFetch<LuaChonBuoi[]>(`/hoc-vien/toi/doi-buoi/lua-chon/${lichNguonId}`),
    enabled: !!lichNguonId,
    retry: false,
  });
}

function useLamMoiHocVien() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: [KEY] });
}

export function useGuiDoiBuoi() {
  const lamMoi = useLamMoiHocVien();
  return useMutation({
    mutationFn: (body: GuiDoiBuoiBody) =>
      apiFetch<{ id: string }>('/hoc-vien/toi/doi-buoi', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: lamMoi,
  });
}

export function useSuaDoiBuoi() {
  const lamMoi = useLamMoiHocVien();
  return useMutation({
    mutationFn: ({ id, ...body }: GuiDoiBuoiBody & { id: string }) =>
      apiFetch<{ id: string }>(`/hoc-vien/toi/doi-buoi/${id}`, {
        method: 'PUT',
        body: JSON.stringify(body),
      }),
    onSuccess: lamMoi,
  });
}

export function useHuyDoiBuoi() {
  const lamMoi = useLamMoiHocVien();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ trang_thai: 'da_huy' }>(`/hoc-vien/toi/doi-buoi/${id}/huy`, {
        method: 'POST',
      }),
    onSuccess: lamMoi,
  });
}

// ---- Người duyệt (/doi-buoi-hoc) — giao diện ở Task 9 ----

export function useDsDoiBuoi(q: LocDoiBuoi = {}) {
  return useQuery({
    queryKey: [KEY, 'ds', q],
    queryFn: () =>
      apiFetch<DeNghiDuyet[]>(
        `/doi-buoi-hoc${qs({
          ...q,
          da_xu_ly: q.da_xu_ly ? 'true' : undefined,
          qua_han: q.qua_han ? 'true' : undefined,
        })}`,
      ),
  });
}

export function useDemDoiBuoi() {
  return useQuery({
    queryKey: [KEY, 'dem'],
    queryFn: async () => (await apiFetch<{ cho_duyet: number }>('/doi-buoi-hoc/dem-cho-duyet')).cho_duyet,
  });
}

export function useLuaChonDuyet(id: string | undefined) {
  return useQuery({
    queryKey: [KEY, 'lua-chon-duyet', id],
    queryFn: () => apiFetch<LuaChonDuyet[]>(`/doi-buoi-hoc/${id}/lua-chon`),
    enabled: !!id,
  });
}

export function useDuyetDoiBuoi() {
  const lamMoi = useLamMoiHocVien();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; lich_chot_id?: string; ghi_chu?: string }) =>
      apiFetch<{ trang_thai: 'da_duyet'; canh_bao: string[] }>(`/doi-buoi-hoc/${id}/duyet`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: lamMoi,
  });
}

export function useTuChoiDoiBuoi() {
  const lamMoi = useLamMoiHocVien();
  return useMutation({
    mutationFn: ({ id, ghi_chu }: { id: string; ghi_chu: string }) =>
      apiFetch<{ trang_thai: 'tu_choi' }>(`/doi-buoi-hoc/${id}/tu-choi`, {
        method: 'POST',
        body: JSON.stringify({ ghi_chu }),
      }),
    onSuccess: lamMoi,
  });
}

export function useHuyDuyetDoiBuoi() {
  const lamMoi = useLamMoiHocVien();
  return useMutation({
    mutationFn: ({ id, ghi_chu }: { id: string; ghi_chu: string }) =>
      apiFetch<{ trang_thai: 'da_huy'; canh_bao: string[] }>(`/doi-buoi-hoc/${id}/huy-duyet`, {
        method: 'POST',
        body: JSON.stringify({ ghi_chu }),
      }),
    onSuccess: lamMoi,
  });
}

// ---- Thống kê theo buổi (/doi-buoi-hoc/thong-ke) ----

export interface LocThongKeDoiBuoi {
  khoa_id?: string;
  giai_doan_id?: string;
  lop_id?: string[];
  muc_nang_luc?: MucNangLuc[];
  loai_lop?: LoaiLop[];
  cum_id?: string[];
  /** YYYY-MM-DD giờ Việt Nam. */
  tu_ngay?: string;
  den_ngay?: string;
  chi_co_cho?: boolean;
}

export interface DongThongKeDoiBuoi {
  lich: {
    id: string;
    buoi_so: number;
    thoi_gian_bat_dau: string;
    thoi_gian_ket_thuc: string | null;
    lop: { id: string; ten_lop: string; muc_nang_luc: MucNangLuc | null; loai_lop: LoaiLop };
    giai_doan: { id: string; thu_tu: number; ten_giai_doan: string };
    khoa: { id: string; ma_khoa: string; ten_khoa: string };
  };
  si_so_phan_lop: number;
  /** Sĩ số sau đổi (chỉ tính đổi buổi còn hiệu lực). */
  si_so: number;
  si_so_toi_da: number | null;
  day: boolean;
  /** *_da_duyet là số bản ghi đã duyệt thô — có thể lệch si_so nếu phân lớp đổi sau khi duyệt. */
  ra_da_duyet: number;
  ra_cho: number;
  ra_qua_han: number;
  ra_tu_choi: number;
  ra_huy: number;
  vao_da_duyet: number;
  vao_cho: number;
  vao_qua_han: number;
  vao_tu_choi: number;
  vao_huy: number;
}

export interface ThongKeDoiBuoi {
  tong: {
    de_nghi: number;
    cho_duyet: number;
    qua_han: number;
    da_duyet: number;
    tu_choi: number;
    da_huy: number;
    so_buoi_day: number;
  };
  dong: DongThongKeDoiBuoi[];
  bo_loc: {
    khoa: { id: string; ma_khoa: string; ten_khoa: string }[];
    giai_doan: { id: string; khoa_id: string; thu_tu: number; ten_giai_doan: string }[];
    lop: { id: string; khoa_id: string; ten_lop: string; muc_nang_luc: MucNangLuc | null; loai_lop: LoaiLop }[];
    cum: { id: string; ten_cum: string }[];
  };
  gioi_han: boolean;
}

export interface HocVienDongThongKe {
  de_nghi_id: string;
  ho_ten: string;
  don_vi: string;
  cum: string | null;
  trang_thai: TrangThaiDeNghi;
  ly_do_huy: LyDoHuy | null;
  qua_han: boolean;
  /** Đổi ra: buổi đích (chốt ?? đề nghị); đổi vào: buổi gốc. */
  buoi_kia: BuoiTomTat | null;
  tao_luc: string;
  xu_ly_luc: string | null;
  nguoi_xu_ly: string | null;
}

/** Query string bộ lọc thống kê — mảng gửi dạng CSV. */
export function qsThongKe(loc: LocThongKeDoiBuoi): string {
  const csv = (a?: string[]) => (a?.length ? a.join(',') : undefined);
  return qs({
    khoa_id: loc.khoa_id,
    giai_doan_id: loc.giai_doan_id,
    lop_id: csv(loc.lop_id),
    muc_nang_luc: csv(loc.muc_nang_luc),
    loai_lop: csv(loc.loai_lop),
    cum_id: csv(loc.cum_id),
    tu_ngay: loc.tu_ngay,
    den_ngay: loc.den_ngay,
    chi_co_cho: loc.chi_co_cho ? 'true' : undefined,
  });
}

export function useThongKeDoiBuoi(loc: LocThongKeDoiBuoi) {
  return useQuery({
    queryKey: [KEY, 'thong-ke', loc],
    queryFn: () => apiFetch<ThongKeDoiBuoi>(`/doi-buoi-hoc/thong-ke${qsThongKe(loc)}`),
    placeholderData: keepPreviousData,
  });
}

export function useChiTietBuoiThongKe(lichId: string | undefined, loc: LocThongKeDoiBuoi) {
  return useQuery({
    queryKey: [KEY, 'thong-ke-buoi', lichId, loc.cum_id],
    queryFn: () =>
      apiFetch<{ ra: HocVienDongThongKe[]; vao: HocVienDongThongKe[] }>(
        `/doi-buoi-hoc/thong-ke/buoi/${lichId}${qsThongKe({ cum_id: loc.cum_id })}`,
      ),
    enabled: !!lichId,
  });
}

/** GET /doi-buoi-hoc/thong-ke/xuat-excel — cùng bộ lọc; tên file theo giờ Việt Nam. */
export async function xuatThongKeDoiBuoi(loc: LocThongKeDoiBuoi): Promise<void> {
  const blob = await apiFetchBlob(`/doi-buoi-hoc/thong-ke/xuat-excel${qsThongKe(loc)}`);
  const p = new Date(Date.now() + 7 * 3600 * 1000).toISOString();
  taiFileTuBlob(blob, `thong-ke-doi-buoi-${p.slice(0, 10).replace(/-/g, '')}-${p.slice(11, 16).replace(':', '')}.xlsx`);
}
