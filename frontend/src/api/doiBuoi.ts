import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from './client';
import type { LoaiLop, MucNangLuc } from './types';

export type TrangThaiDeNghi = 'cho_duyet' | 'da_duyet' | 'tu_choi' | 'da_huy';

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

export interface DeNghiHocVien {
  id: string;
  trang_thai: TrangThaiDeNghi;
  lich_nguon_id: string;
  lich_de_nghi_id: string;
  lich_chot_id: string | null;
  ly_do: string;
  tao_luc: string;
  ghi_chu_xu_ly: string | null;
  qua_han: boolean;
  thu_tu_hang: { k: number; n: number } | null;
  buoi_nguon: BuoiTomTat | null;
  buoi_de_nghi: BuoiTomTat | null;
  buoi_chot: BuoiTomTat | null;
}

export interface TongQuanDoiBuoi {
  so_buoi_doi_toi_da: number;
  so_luot_da_dung: number;
  buoi_sap_toi: { lich_nguon: LichTomTat; de_nghi: DeNghiHocVien | null }[];
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

/** Spec đổi buổi §5: lich_hoc_id → đổi ra (sang lớp chốt) / đổi vào (từ lớp nguồn). */
export type NhanDoiBuoi = Record<string, { loai: 'ra' | 'vao'; lop: string }>;

export function nhanDoiBuoi(n: { loai: 'ra' | 'vao'; lop: string }): string {
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
