import { useMutation, useQueries, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from './client';
import type { DiaDanh, DonViCongTac, MonHoc, PaginatedResult } from './types';

// Backend phân trang server-side (mặc định page_size=20, tối đa 200 — PaginationQueryDto @Max(200)),
// trong khi SelectDiaDanh cần TOÀN BỘ danh sách để tự lọc phía client (searchable Select). Một số
// tỉnh/thành có > 200 xã nên 1 trang page_size=200 không đủ (bug: chỉ lấy 20 dòng đầu A-Z trước khi
// sửa) — gọi lặp page=1,2,... cho đến khi gộp đủ `total`, có giới hạn an toàn MAX_PAGES tránh lặp vô
// hạn nếu backend trả total sai. Giữ nguyên chữ ký trả về { data } như cũ để không vỡ chỗ gọi.
const DIA_DANH_PAGE_SIZE = 200;
const DIA_DANH_MAX_PAGES = 50;

export async function layDiaDanh(params: { cap: string; parent_id?: string; q?: string; trang_thai?: string; phien_ban?: string }) {
  let all: DiaDanh[] = [];
  let total = Infinity;
  for (let page = 1; page <= DIA_DANH_MAX_PAGES && all.length < total; page++) {
    const qs = new URLSearchParams();
    qs.set('cap', params.cap);
    if (params.parent_id) qs.set('parent_id', params.parent_id);
    if (params.q) qs.set('q', params.q);
    qs.set('trang_thai', params.trang_thai ?? 'active');
    if (params.phien_ban) qs.set('phien_ban', params.phien_ban);
    qs.set('page', String(page));
    qs.set('page_size', String(DIA_DANH_PAGE_SIZE));
    const ket_qua = await apiFetch<{ data: DiaDanh[]; total?: number }>(`/danh-muc/dia-danh?${qs.toString()}`);
    all = all.concat(ket_qua.data);
    // Mock/response không kèm `total` (vd test cũ trả thẳng { data }) -> không có cơ sở lặp tiếp, dừng sau trang đầu.
    if (typeof ket_qua.total !== 'number') break;
    total = ket_qua.total;
  }
  return { data: all };
}

export function layDonViCongTac(params: { q?: string; loai_don_vi?: string; dia_ban_id?: string; page_size?: number }) {
  const qs = new URLSearchParams();
  qs.set('loai_don_vi', params.loai_don_vi ?? 'truong');
  if (params.q) qs.set('q', params.q);
  if (params.dia_ban_id) qs.set('dia_ban_id', params.dia_ban_id);
  if (params.page_size) qs.set('page_size', String(params.page_size));
  return apiFetch<{ data: DonViCongTac[] }>(`/danh-muc/don-vi-cong-tac?${qs.toString()}`);
}

// Thêm (SelectDonVi B) — tra 1 đơn vị công tác theo id để tự động điền sẵn Tỉnh/thành + Phường/xã
// của hồ sơ đã có sẵn don_vi_cong_tac_id (vd khi sửa hồ sơ), tránh bắt người dùng chọn lại từ đầu.
export async function layDonViCongTacTheoId(id: string): Promise<DonViCongTac | null> {
  const ket_qua = await apiFetch<{ data: DonViCongTac[] }>(
    `/danh-muc/don-vi-cong-tac?id=${encodeURIComponent(id)}&page_size=1`,
  );
  return ket_qua.data[0] ?? null;
}

// Tra tên nhiều đơn vị theo id khi danh sách đã tải sẵn (daBiet, vd nhóm so_gddt/khac nhỏ load
// trọn) không có đủ — fetch RIÊNG từng id còn thiếu qua layDonViCongTacTheoId (id đơn, không phân
// trang backend chỉ nhận @IsUUID đơn, không có batch). Dùng cho bảng danh sách (học viên/khóa) và
// các dòng hiển thị tên đơn vị khi đơn vị liên quan có thể nằm ngoài danh sách đã tải sẵn (bug: đơn
// vị xếp sau trang page_size=200 không tìm được tên, vd "Trường THPT Châu Thị Tế").
export function useTenDonViTheoId(
  ids: (string | null | undefined)[],
  daBiet: Map<string, string>,
): Map<string, string> {
  const canTra = Array.from(new Set(ids.filter((id): id is string => !!id && !daBiet.has(id))));
  const ketQua = useQueries({
    queries: canTra.map((id) => ({
      queryKey: ['danh-muc', 'don-vi-cong-tac', 'theo-id', id],
      queryFn: () => layDonViCongTacTheoId(id),
    })),
  });
  const ra = new Map(daBiet);
  canTra.forEach((id, i) => {
    const ten = ketQua[i]?.data?.ten_don_vi;
    if (ten) ra.set(id, ten);
  });
  return ra;
}

export interface DonViCongTacPhanTrangParams {
  loai_don_vi?: string;
  dia_ban_id?: string;
  tinh_id?: string;
  q?: string;
  page?: number;
  page_size?: number;
}

function xayQueryString(params: object): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') qs.set(k, String(v));
  }
  const s = qs.toString();
  return s ? `?${s}` : '';
}

// Thêm 2026-10-01 — trang quản trị "Danh mục trường" (sửa tay dia_ban_id sau khi remap T19): phân
// trang server-side thật qua GET /danh-muc/don-vi-cong-tac (đã có page/page_size từ PaginationQueryDto),
// khác layDonViCongTac() ở trên (dùng cho autocomplete, không phân trang, luôn trả thẳng { data }).
export function layDonViCongTacPhanTrang(params: DonViCongTacPhanTrangParams) {
  return apiFetch<PaginatedResult<DonViCongTac>>(`/danh-muc/don-vi-cong-tac${xayQueryString(params)}`);
}

// PATCH /danh-muc/don-vi-cong-tac/{id} — sửa tay dia_ban_id (quan_tri), UpdateDonViCongTacDto đã nhận
// sẵn field này, không cần sửa backend thêm cho thao tác này (chỉ sửa 1 field, không đụng field khác).
export function suaDiaBanDonViCongTac(id: string, diaBanId: string) {
  return apiFetch<DonViCongTac>(`/danh-muc/don-vi-cong-tac/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ dia_ban_id: diaBanId }),
  });
}

export function useSuaDiaBanDonViCongTac() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, diaBanId }: { id: string; diaBanId: string }) => suaDiaBanDonViCongTac(id, diaBanId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['danh-muc', 'don-vi-cong-tac'] });
    },
  });
}

export function layMonHoc(cap_hoc: string) {
  const qs = new URLSearchParams({ cap_hoc });
  return apiFetch<{ data: MonHoc[] }>(`/danh-muc/mon-hoc?${qs.toString()}`);
}

export function goiYChuyenMon(q: string) {
  const qs = new URLSearchParams({ q });
  return apiFetch<{ data: string[] }>(`/danh-muc/chuyen-mon-dao-tao/goi-y?${qs.toString()}`);
}
