import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from './client';
import { layDonViCongTac } from './danhMuc';
import type {
  CumHocVien,
  NguoiHoTroRutGon,
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

// don_vi_dat_hang_id của khóa có thể là đơn vị loại 'so_gddt', 'truong' hoặc 'khac' (QĐ2 — vd. HCMUE
// không thuộc cây đơn vị An Giang, không được là 'phong_vhxh' — xem validateDonViDatHang() ở backend).
// layDonViCongTac() mặc định chỉ lọc loai_don_vi='truong' (dùng cho màn học viên) nên ở đây gộp đủ 3
// loại để map id->tên không bị thiếu, và để Select "Đơn vị đặt hàng" (form tạo khóa) nhóm theo loại.
// page_size: 200 (tối đa backend cho phép, xem PaginationQueryDto) — hook này lấy TOÀN BỘ danh sách
// để xây dropdown/map id->tên, không phải search phân trang, nếu không đơn vị xếp sau trang 1 (vd.
// HCMUE) sẽ bị rớt khỏi danh sách mặc định 20 dòng/trang.
export function useDonViChoKhoa() {
  return useQuery({
    queryKey: ['danh-muc', 'don-vi-cong-tac', 'khoa-boi-duong'],
    queryFn: async () => {
      const [soGddt, khac, truong] = await Promise.all([
        layDonViCongTac({ loai_don_vi: 'so_gddt', page_size: 200 }),
        layDonViCongTac({ loai_don_vi: 'khac', page_size: 200 }),
        layDonViCongTac({ loai_don_vi: 'truong', page_size: 200 }),
      ]);
      return [...soGddt.data, ...khac.data, ...truong.data];
    },
  });
}

export interface DanhSachKhoaParams {
  trang_thai?: TrangThaiKhoa | '';
  don_vi_dat_hang_id?: string;
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

// PATCH /khoa-boi-duong/{id} (2026-10-03, chỉ quan_tri) — sửa được ở mọi trạng thái; mọi field tùy
// chọn, không gửi = giữ nguyên (xem UpdateKhoaBoiDuongDto ở backend).
export interface CapNhatKhoaDto {
  ma_khoa?: string;
  ten_khoa?: string;
  dia_diem?: string;
  thoi_gian_bat_dau?: string;
  thoi_gian_ket_thuc?: string;
  don_vi_dat_hang_id?: string;
  // 2026-10-08: công tắc cho học viên tự điều chỉnh mức lớp học.
  mo_dieu_chinh_muc?: boolean;
}

export function capNhatKhoa(id: string, dto: CapNhatKhoaDto) {
  return apiFetch<KhoaBoiDuong>(`/khoa-boi-duong/${id}`, { method: 'PATCH', body: JSON.stringify(dto) });
}

export function useCapNhatKhoa(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: CapNhatKhoaDto) => capNhatKhoa(id, dto),
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

// 2026-10-08: Quản trị sửa hộ mức lớp học (bỏ qua công tắc khóa, vẫn chỉ ≤ mức đánh giá).
export function capNhatMucHoc(dangKyHocId: string, muc: MucNangLuc | null) {
  return apiFetch<{
    muc_dau_vao: MucNangLuc;
    muc_hoc_chon: MucNangLuc | null;
    muc_hoc: MucNangLuc;
    muc_hoc_chon_luc: string | null;
  }>(
    `/dang-ky-hoc/${dangKyHocId}/muc-hoc`,
    { method: 'PATCH', body: JSON.stringify({ muc }) },
  );
}

export function useCapNhatMucHoc(hocVienId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ dangKyHocId, muc }: { dangKyHocId: string; muc: MucNangLuc | null }) =>
      capNhatMucHoc(dangKyHocId, muc),
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

// ADR 0003: PUT thay toàn bộ người hỗ trợ của cụm (rỗng = gỡ hết).
export function ganNguoiHoTroCum(khoaId: string, cumId: string, nguoiDungIds: string[]) {
  return apiFetch<{ cum_id: string; nguoi_ho_tro: NguoiHoTroRutGon[] }>(
    `/khoa-boi-duong/${khoaId}/cum/${cumId}/nguoi-ho-tro`,
    { method: 'PUT', body: JSON.stringify({ nguoi_dung_ids: nguoiDungIds }) },
  );
}

export function useGanNguoiHoTroCum(khoaId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ cumId, nguoiDungIds }: { cumId: string; nguoiDungIds: string[] }) =>
      ganNguoiHoTroCum(khoaId, cumId, nguoiDungIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: chiTietKhoaKey(khoaId) });
      queryClient.invalidateQueries({ queryKey: ['nguoi-dung', 'ho-tro'] });
    },
  });
}

// ADR 0004 G3 (issue #14): PUT thay toàn bộ nhóm người hỗ trợ giảng viên của khóa.
export function useGanNhomHoTroGv(khoaId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (nguoiDungIds: string[]) =>
      apiFetch(`/khoa-boi-duong/${khoaId}/nhom-ho-tro-gv`, {
        method: 'PUT',
        body: JSON.stringify({ nguoi_dung_ids: nguoiDungIds }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: chiTietKhoaKey(khoaId) });
      queryClient.invalidateQueries({ queryKey: ['nguoi-dung', 'ho-tro'] });
    },
  });
}

export interface CreateLichHocDto {
  giai_doan_id: string;
  buoi_so?: number;
  thoi_gian_bat_dau: string;
  thoi_gian_ket_thuc: string;
  dia_diem_hoac_link?: string;
  diem_hoc_id?: string;
  phong?: string;
}

export interface UpdateLichHocDto {
  thoi_gian_bat_dau?: string;
  thoi_gian_ket_thuc?: string;
  dia_diem_hoac_link?: string;
  buoi_so?: number;
  trang_thai?: TrangThaiLichHoc;
  diem_hoc_id?: string | null;
  phong?: string | null;
  ly_do?: string;
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
