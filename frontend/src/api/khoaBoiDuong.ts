import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from './client';
import { layDonViCongTac } from './danhMuc';
import type {
  CumHocVien,
  GiaiDoanKhoa,
  HinhThucGiaiDoan,
  KhoaBoiDuong,
  KhoaBoiDuongChiTiet,
  KhoaHocDangKy,
  LichHocLop,
  LoaiLop,
  LopHoc,
  MucNangLuc,
  NhanSuLop,
  PaginatedResult,
  TaoKhoaBoiDuongDto,
  TrangThaiActive,
  TrangThaiKhoa,
  TrangThaiLichHoc,
  VaiTroNhanSuLop,
} from './types';

// don_vi_to_chuc_id của khóa có thể là đơn vị loại 'truong' hoặc 'khac' (T2, QĐ2 — vd. HCMUE không
// thuộc cây đơn vị An Giang). layDonViCongTac() mặc định chỉ lọc loai_don_vi='truong' (dùng cho màn
// học viên) nên ở đây gộp cả 2 loại để map id->tên không bị thiếu đơn vị 'khac'.
// page_size: 200 (tối đa backend cho phép, xem PaginationQueryDto) — hook này lấy TOÀN BỘ danh sách
// để xây dropdown/map id->tên, không phải search phân trang, nếu không đơn vị xếp sau trang 1 (vd.
// HCMUE) sẽ bị rớt khỏi danh sách mặc định 20 dòng/trang.
export function useDonViChoKhoa() {
  return useQuery({
    queryKey: ['danh-muc', 'don-vi-cong-tac', 'khoa-boi-duong'],
    queryFn: async () => {
      const [truong, khac] = await Promise.all([
        layDonViCongTac({ loai_don_vi: 'truong', page_size: 200 }),
        layDonViCongTac({ loai_don_vi: 'khac', page_size: 200 }),
      ]);
      return [...truong.data, ...khac.data];
    },
  });
}

export interface DanhSachKhoaParams {
  trang_thai?: TrangThaiKhoa | '';
  don_vi_to_chuc_id?: string;
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

export function layDanhSachKhoa(params: DanhSachKhoaParams) {
  return apiFetch<PaginatedResult<KhoaBoiDuong>>(`/khoa-boi-duong${xayQueryString(params)}`);
}

export function danhSachKhoaKey(params: DanhSachKhoaParams) {
  return ['admin', 'khoa-boi-duong', params] as const;
}

export function useDanhSachKhoa(params: DanhSachKhoaParams) {
  return useQuery({
    queryKey: danhSachKhoaKey(params),
    queryFn: () => layDanhSachKhoa(params),
    placeholderData: keepPreviousData,
  });
}

export function layChiTietKhoa(id: string) {
  return apiFetch<KhoaBoiDuongChiTiet>(`/khoa-boi-duong/${id}`);
}

export function chiTietKhoaKey(id: string) {
  return ['admin', 'khoa-boi-duong', 'chi-tiet', id] as const;
}

export function useChiTietKhoa(id: string | undefined) {
  return useQuery({
    queryKey: chiTietKhoaKey(id ?? ''),
    queryFn: () => layChiTietKhoa(id as string),
    enabled: !!id,
  });
}

export function taoKhoa(dto: TaoKhoaBoiDuongDto) {
  return apiFetch<KhoaBoiDuong>('/khoa-boi-duong', { method: 'POST', body: JSON.stringify(dto) });
}

export function useTaoKhoa() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: taoKhoa,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'khoa-boi-duong'] });
    },
  });
}

export function nopDuyetKhoa(id: string) {
  return apiFetch<KhoaBoiDuong>(`/khoa-boi-duong/${id}/nop-duyet`, { method: 'POST' });
}

export function useNopDuyetKhoa(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => nopDuyetKhoa(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: chiTietKhoaKey(id) });
      queryClient.invalidateQueries({ queryKey: ['admin', 'khoa-boi-duong'] });
    },
  });
}

export interface DuyetKhoaDto {
  ket_qua: 'da_duyet' | 'tu_choi';
  ly_do?: string;
}

export function duyetKhoa(id: string, dto: DuyetKhoaDto) {
  return apiFetch<KhoaBoiDuong>(`/khoa-boi-duong/${id}/duyet`, { method: 'POST', body: JSON.stringify(dto) });
}

export function useDuyetKhoa(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: DuyetKhoaDto) => duyetKhoa(id, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: chiTietKhoaKey(id) });
      queryClient.invalidateQueries({ queryKey: ['admin', 'khoa-boi-duong'] });
    },
  });
}

// Thêm 2026-09-30 (QĐ10, docs/api-contract.md mục 3) — admin/Trường/Sở/Phòng xem lại và sửa tay
// khóa/lớp/cụm của 1 học viên cụ thể (AdminHocVienChiTiet). GET /hoc-vien/{id}/khoa-hoc trả ĐÚNG cấu
// trúc GET /hoc-vien/toi/khoa-hoc (xem KhoaHocDangKy trong types.ts) nhưng cho hocVienId qua param.
export function layKhoaHocCuaHocVien(hocVienId: string) {
  return apiFetch<KhoaHocDangKy[]>(`/hoc-vien/${hocVienId}/khoa-hoc`);
}

export function khoaHocCuaHocVienKey(hocVienId: string) {
  return ['admin', 'hoc-vien', 'khoa-hoc', hocVienId] as const;
}

export function useKhoaHocCuaHocVien(hocVienId: string | undefined) {
  return useQuery({
    queryKey: khoaHocCuaHocVienKey(hocVienId ?? ''),
    queryFn: () => layKhoaHocCuaHocVien(hocVienId as string),
    enabled: !!hocVienId,
  });
}

// Phân lớp theo giai đoạn (spec 2026-10-02 mục 5.3): gán/thay/gỡ lớp của 1 giai đoạn (lopId null = gỡ).
// canh_bao: lớp không có buổi trong giai đoạn / loại lớp lệch hình thức — không chặn.
export function ganLopGiaiDoan(dangKyHocId: string, giaiDoanId: string, lopId: string | null) {
  return apiFetch<{ phan_lop: unknown; canh_bao?: string }>(`/dang-ky-hoc/${dangKyHocId}/giai-doan/${giaiDoanId}/lop`, {
    method: 'PUT',
    body: JSON.stringify({ lop_id: lopId }),
  });
}

export function useGanLopGiaiDoan(hocVienId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ dangKyHocId, giaiDoanId, lopId }: { dangKyHocId: string; giaiDoanId: string; lopId: string | null }) =>
      ganLopGiaiDoan(dangKyHocId, giaiDoanId, lopId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: khoaHocCuaHocVienKey(hocVienId) });
    },
  });
}

export interface CapNhatCumDangKyDto {
  cum_id: string | null;
}

export function capNhatCumDangKy(dangKyHocId: string, dto: CapNhatCumDangKyDto) {
  return apiFetch<void>(`/dang-ky-hoc/${dangKyHocId}/cum`, { method: 'PATCH', body: JSON.stringify(dto) });
}

export function useCapNhatCumDangKy(hocVienId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ dangKyHocId, dto }: { dangKyHocId: string; dto: CapNhatCumDangKyDto }) =>
      capNhatCumDangKy(dangKyHocId, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: khoaHocCuaHocVienKey(hocVienId) });
    },
  });
}

// ---------------------------------------------------------------------------
// CRUD giai đoạn/lớp/cụm/lịch học/nhân sự (AdminKhoaChiTiet) — docs/api-contract.md mục 3.
// Mọi mutation ở đây invalidate chiTietKhoaKey(khoaId) để bảng chi tiết khóa tự làm mới.
// ---------------------------------------------------------------------------

export interface CreateGiaiDoanDto {
  thu_tu: number;
  ten_giai_doan: string;
  hinh_thuc: HinhThucGiaiDoan;
  thoi_gian_bat_dau: string;
  thoi_gian_ket_thuc: string;
  link_hoac_dia_diem?: string | null;
  huong_dan?: string | null;
}

export interface UpdateGiaiDoanDto {
  thu_tu?: number;
  ten_giai_doan?: string;
  hinh_thuc?: HinhThucGiaiDoan;
  thoi_gian_bat_dau?: string;
  thoi_gian_ket_thuc?: string;
  trang_thai?: TrangThaiActive;
  // null = xóa (chuỗi rỗng ở form gửi null).
  link_hoac_dia_diem?: string | null;
  huong_dan?: string | null;
}

export function taoGiaiDoan(khoaId: string, dto: CreateGiaiDoanDto) {
  return apiFetch<GiaiDoanKhoa>(`/khoa-boi-duong/${khoaId}/giai-doan`, { method: 'POST', body: JSON.stringify(dto) });
}

export function useTaoGiaiDoan(khoaId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateGiaiDoanDto) => taoGiaiDoan(khoaId, dto),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: chiTietKhoaKey(khoaId) }),
  });
}

export function capNhatGiaiDoan(khoaId: string, giaiDoanId: string, dto: UpdateGiaiDoanDto) {
  return apiFetch<GiaiDoanKhoa>(`/khoa-boi-duong/${khoaId}/giai-doan/${giaiDoanId}`, {
    method: 'PATCH',
    body: JSON.stringify(dto),
  });
}

export function useCapNhatGiaiDoan(khoaId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ giaiDoanId, dto }: { giaiDoanId: string; dto: UpdateGiaiDoanDto }) =>
      capNhatGiaiDoan(khoaId, giaiDoanId, dto),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: chiTietKhoaKey(khoaId) }),
  });
}

// loai_lop bắt buộc (QĐ10) — 3 loại lớp độc lập nhau. nhom_hoc_vien/muc_nang_luc KHÔNG có trong
// CreateLopHocDto thật của backend (chỉ có ở UpdateLopHocDto) — chỉ sửa được sau khi tạo, qua PATCH.
export interface CreateLopDto {
  loai_lop: LoaiLop;
  ten_lop: string;
  si_so_toi_da?: number;
}

export interface UpdateLopDto {
  loai_lop?: LoaiLop;
  ten_lop?: string;
  si_so_toi_da?: number;
  nhom_hoc_vien?: number;
  muc_nang_luc?: MucNangLuc;
  trang_thai?: TrangThaiActive;
}

export function taoLop(khoaId: string, dto: CreateLopDto) {
  return apiFetch<LopHoc>(`/khoa-boi-duong/${khoaId}/lop`, { method: 'POST', body: JSON.stringify(dto) });
}

export function useTaoLop(khoaId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateLopDto) => taoLop(khoaId, dto),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: chiTietKhoaKey(khoaId) }),
  });
}

// Response có thể kèm canh_bao (vd đổi loai_lop khi lớp đang có đăng ký) — xem
// KhoaBoiDuongService.capNhatLop.
export function capNhatLop(khoaId: string, lopId: string, dto: UpdateLopDto) {
  return apiFetch<LopHoc & { canh_bao?: string }>(`/khoa-boi-duong/${khoaId}/lop/${lopId}`, {
    method: 'PATCH',
    body: JSON.stringify(dto),
  });
}

export function useCapNhatLop(khoaId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ lopId, dto }: { lopId: string; dto: UpdateLopDto }) => capNhatLop(khoaId, lopId, dto),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: chiTietKhoaKey(khoaId) }),
  });
}

export interface CreateCumDto {
  ten_cum: string;
  link_zalo?: string;
  ghi_chu?: string;
}

export interface UpdateCumDto {
  ten_cum?: string;
  link_zalo?: string;
  ghi_chu?: string;
  trang_thai?: TrangThaiActive;
}

export function taoCum(khoaId: string, dto: CreateCumDto) {
  return apiFetch<CumHocVien>(`/khoa-boi-duong/${khoaId}/cum`, { method: 'POST', body: JSON.stringify(dto) });
}

export function useTaoCum(khoaId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateCumDto) => taoCum(khoaId, dto),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: chiTietKhoaKey(khoaId) }),
  });
}

export function capNhatCum(khoaId: string, cumId: string, dto: UpdateCumDto) {
  return apiFetch<CumHocVien>(`/khoa-boi-duong/${khoaId}/cum/${cumId}`, { method: 'PATCH', body: JSON.stringify(dto) });
}

export function useCapNhatCum(khoaId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ cumId, dto }: { cumId: string; dto: UpdateCumDto }) => capNhatCum(khoaId, cumId, dto),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: chiTietKhoaKey(khoaId) }),
  });
}

// Đơn vị theo dõi (T2, QĐ2) — chỉ quan_tri gọi được. KHÔNG có GET để lấy danh sách hiện có (chỉ
// POST/DELETE trong api-contract.md mục 3, GET /khoa-boi-duong/{id} KHÔNG include khoa_don_vi_theo_doi
// — xem khoa-boi-duong.service.ts#findOne) — FE chỉ theo dõi được các đơn vị vừa thêm trong phiên làm
// việc hiện tại, không phục hồi được danh sách đã lưu từ trước khi tải lại trang. Flag: giới hạn do
// backend chưa có endpoint đọc, không tự bịa thêm.
export function themDonViTheoDoi(khoaId: string, donViId: string) {
  return apiFetch<{ id: string; khoa_id: string; don_vi_id: string }>(`/khoa-boi-duong/${khoaId}/don-vi-theo-doi`, {
    method: 'POST',
    body: JSON.stringify({ don_vi_id: donViId }),
  });
}

export function useThemDonViTheoDoi(khoaId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (donViId: string) => themDonViTheoDoi(khoaId, donViId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: chiTietKhoaKey(khoaId) }),
  });
}

export function xoaDonViTheoDoi(khoaId: string, donViId: string) {
  return apiFetch<{ da_xoa: true }>(`/khoa-boi-duong/${khoaId}/don-vi-theo-doi/${donViId}`, { method: 'DELETE' });
}

export function useXoaDonViTheoDoi(khoaId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (donViId: string) => xoaDonViTheoDoi(khoaId, donViId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: chiTietKhoaKey(khoaId) }),
  });
}

export interface CreateLichHocDto {
  giai_doan_id: string;
  buoi_so?: number;
  thoi_gian_bat_dau: string;
  thoi_gian_ket_thuc: string;
  dia_diem_hoac_link?: string;
}

export interface UpdateLichHocDto {
  thoi_gian_bat_dau?: string;
  thoi_gian_ket_thuc?: string;
  dia_diem_hoac_link?: string;
  buoi_so?: number;
  trang_thai?: TrangThaiLichHoc;
}

// Route riêng /lop/{id}/lich-hoc (không dưới /khoa-boi-duong). Hook nhận khoaId cố định (chỉ để
// invalidate cache) nhưng lopId truyền lúc mutate() — 1 trang chi tiết khóa có NHIỀU lớp, không thể
// gọi hook riêng theo từng lớp trong vòng lặp (vi phạm rules of hooks).
export function themLichHoc(lopId: string, dto: CreateLichHocDto) {
  return apiFetch<LichHocLop>(`/lop/${lopId}/lich-hoc`, { method: 'POST', body: JSON.stringify(dto) });
}

export function useThemLichHoc(khoaId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ lopId, dto }: { lopId: string; dto: CreateLichHocDto }) => themLichHoc(lopId, dto),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: chiTietKhoaKey(khoaId) }),
  });
}

export function capNhatLichHoc(lopId: string, lichHocId: string, dto: UpdateLichHocDto) {
  return apiFetch<LichHocLop>(`/lop/${lopId}/lich-hoc/${lichHocId}`, { method: 'PATCH', body: JSON.stringify(dto) });
}

export function useCapNhatLichHoc(khoaId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ lopId, lichHocId, dto }: { lopId: string; lichHocId: string; dto: UpdateLichHocDto }) =>
      capNhatLichHoc(lopId, lichHocId, dto),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: chiTietKhoaKey(khoaId) }),
  });
}

export interface CreateNhanSuDto {
  ho_ten: string;
  vai_tro: VaiTroNhanSuLop;
  so_dien_thoai?: string;
}

export function themNhanSu(lopId: string, dto: CreateNhanSuDto) {
  return apiFetch<NhanSuLop>(`/lop/${lopId}/nhan-su`, { method: 'POST', body: JSON.stringify(dto) });
}

export function useThemNhanSu(khoaId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ lopId, dto }: { lopId: string; dto: CreateNhanSuDto }) => themNhanSu(lopId, dto),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: chiTietKhoaKey(khoaId) }),
  });
}

export function xoaNhanSu(lopId: string, nhanSuId: string) {
  return apiFetch<void>(`/lop/${lopId}/nhan-su/${nhanSuId}`, { method: 'DELETE' });
}

export function useXoaNhanSu(khoaId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ lopId, nhanSuId }: { lopId: string; nhanSuId: string }) => xoaNhanSu(lopId, nhanSuId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: chiTietKhoaKey(khoaId) }),
  });
}
