import { useQuery } from '@tanstack/react-query';
import { apiFetch, apiFetchBlob } from './client';
import type { BaoCaoRowsResult, BaoCaoTheo, DotXacNhanDanhMuc } from './types';

// Trung tâm báo cáo (Phase 5 redesign) — 6 nhóm báo cáo THẬT đang có API (docs/api-contract.md mục 7
// + mục "Đợt xác nhận"). Mỗi nhóm = 1 hàm xem (GET, trả { rows }) + 1 hàm xuất Excel (GET blob).

function xayQueryString(params: object): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') qs.set(k, String(v));
  }
  const s = qs.toString();
  return s ? `?${s}` : '';
}

function layBaoCao(path: string, params: object) {
  return apiFetch<BaoCaoRowsResult>(`${path}${xayQueryString(params)}`);
}

function taiBaoCaoExcel(path: string, params: object) {
  return apiFetchBlob(`${path}${xayQueryString(params)}`);
}

function useBaoCaoView(khoa: string, path: string, params: object, enabled = true) {
  return useQuery({
    queryKey: ['admin', 'bao-cao', 'trung-tam', khoa, params],
    queryFn: () => layBaoCao(path, params),
    enabled,
  });
}

// --- 1. Báo cáo tổng hợp — GET /bao-cao/tong-hop + GET /bao-cao/xuat-excel (cùng query) ---
export interface BaoCaoTongHopParams {
  theo: BaoCaoTheo;
  tu_ngay?: string;
  den_ngay?: string;
}

export function useBaoCaoTongHopTrungTam(params: BaoCaoTongHopParams, enabled = true) {
  return useBaoCaoView('tong-hop', '/bao-cao/tong-hop', params, enabled);
}

export function taiBaoCaoTongHopExcel(params: BaoCaoTongHopParams) {
  return taiBaoCaoExcel('/bao-cao/xuat-excel', params);
}

// --- 2. Báo cáo xác nhận — dot_id bắt buộc ---
export interface BaoCaoXacNhanParams {
  dot_id: string;
  trang_thai?: string;
}

export function useBaoCaoXacNhan(params: BaoCaoXacNhanParams | undefined, enabled: boolean) {
  return useBaoCaoView('xac-nhan', '/bao-cao/xac-nhan', params ?? {}, enabled && !!params?.dot_id);
}

export function taiBaoCaoXacNhanExcel(params: BaoCaoXacNhanParams) {
  return taiBaoCaoExcel('/bao-cao/xac-nhan/xuat-excel', params);
}

export function layDanhSachDotXacNhan() {
  return apiFetch<{ data: DotXacNhanDanhMuc[] }>('/dot-xac-nhan');
}

export function useDanhSachDotXacNhan() {
  return useQuery({
    queryKey: ['admin', 'dot-xac-nhan', 'danh-sach'],
    queryFn: layDanhSachDotXacNhan,
  });
}

// --- 3. Sửa trường MOET — khoa_id bắt buộc ---
export interface BaoCaoKhoaIdParams {
  khoa_id: string;
}

export function useBaoCaoSuaTruongMoet(params: BaoCaoKhoaIdParams | undefined, enabled: boolean) {
  return useBaoCaoView('sua-truong-moet', '/bao-cao/sua-truong-moet', params ?? {}, enabled && !!params?.khoa_id);
}

export function taiBaoCaoSuaTruongMoetExcel(params: BaoCaoKhoaIdParams) {
  return taiBaoCaoExcel('/bao-cao/sua-truong-moet/xuat-excel', params);
}

// --- 4. Xuất cho VLE — khoa_id bắt buộc. "File Excel trực tiếp" (api-contract.md) — không có endpoint
// JSON để xem trước, chỉ có nút Xuất Excel. ---
export function taiBaoCaoXuatChoVleExcel(params: BaoCaoKhoaIdParams) {
  return taiBaoCaoExcel('/bao-cao/xuat-cho-vle', params);
}

// --- 5. Điều kiện đánh giá đầu vào — khoa_id bắt buộc ---
export function useBaoCaoDieuKienDanhGia(params: BaoCaoKhoaIdParams | undefined, enabled: boolean) {
  return useBaoCaoView('dieu-kien-danh-gia', '/bao-cao/dieu-kien-danh-gia', params ?? {}, enabled && !!params?.khoa_id);
}

export function taiBaoCaoDieuKienDanhGiaExcel(params: BaoCaoKhoaIdParams) {
  return taiBaoCaoExcel('/bao-cao/dieu-kien-danh-gia/xuat-excel', params);
}

// --- 6. Vận hành theo lớp — khoa_id tùy chọn (api-contract.md: "Cả 3 query đều tùy chọn") ---
export interface BaoCaoVanHanhParams {
  khoa_id?: string;
}

export function useBaoCaoVanHanh(params: BaoCaoVanHanhParams, enabled: boolean) {
  return useBaoCaoView('van-hanh', '/bao-cao/van-hanh', params, enabled);
}

export function taiBaoCaoVanHanhExcel(params: BaoCaoVanHanhParams) {
  return taiBaoCaoExcel('/bao-cao/van-hanh/xuat-excel', params);
}
