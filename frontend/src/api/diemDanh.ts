import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { NhanDoiBuoi } from './doiBuoi';
import { apiFetch } from './client';
import type { LoaiLop } from './types';

// ADR 0005 Z7 (issue #26): bảng điểm danh lớp + sửa nhanh 1 ô — Quản trị (mọi lúc) và hỗ trợ GV
// (buổi đã diễn ra ≤ 3 ngày). Backend tính sẵn cờ sua_duoc theo người xem.
export type TrangThaiDiemDanh = 'co_mat' | 'vang' | 'vang_co_phep';
export type NguonDiemDanh = 'zoom' | 'ky_ten' | 'qr' | 'thu_cong';
export type LyDoKhongSuaDiemDanh = 'chua_dien_ra' | 'qua_han' | 'khong_co_quyen';

export interface ODiemDanh {
  trang_thai: TrangThaiDiemDanh;
  nguon: NguonDiemDanh;
  ghi_chu: string | null;
  tu_diem_danh_luc: string | null;
  /** null ở ô lớp khác (ADR 0014). */
  cap_nhat_luc: string | null;
  nguoi_sua: string | null;
  /**
   * ADR 0014: ô không có điểm danh tại buổi này nhưng được công nhận từ lớp khác (lớp cũ / học bù) theo chế độ
   * chuyên cần của khóa — chỉ đọc, nhan = "Có mặt – ở lớp X"…
   */
  nguon_tinh?: 'lop_khac';
  lop_tinh?: { id: string; ten_lop: string };
  sua_duoc?: false;
  nhan?: string;
}

export interface BangDiemDanh {
  lop: { id: string; ten_lop: string; loai_lop: LoaiLop; khoa: { id: string; ma_khoa: string; ten_khoa: string } };
  giai_doan: { id: string; thu_tu: number; ten_giai_doan: string; hinh_thuc: string }[];
  giai_doan_id: string | null;
  buoi: {
    id: string;
    buoi_so: number;
    thoi_gian_bat_dau: string;
    thoi_gian_ket_thuc: string;
    sua_duoc: boolean;
    ly_do: LyDoKhongSuaDiemDanh | null;
    /** Spec đổi buổi §5: sĩ số theo buổi khi backend trả. */
    si_so?: number | null;
    si_so_toi_da?: number | null;
  }[];
  hoc_vien: HocVienDiemDanh[];
  /** Người đổi buổi vào lớp — chỉ có ô của buổi chốt; không tính vào sĩ số lớp. */
  hoc_vien_doi_vao?: HocVienDiemDanh[];
}

export interface HocVienDiemDanh {
  dang_ky_hoc_id: string;
  ho_ten: string;
  don_vi: string;
  diem_danh: Record<string, ODiemDanh>;
  bao_vang: Record<string, string>;
  /** lich_hoc_id → đổi ra (sang lớp chốt) / đổi vào (từ lớp nguồn). */
  doi_buoi?: NhanDoiBuoi;
}

export interface SuaDiemDanhDto {
  dang_ky_hoc_id: string;
  lich_hoc_id: string;
  trang_thai: TrangThaiDiemDanh;
  ghi_chu?: string;
}

export function useBangDiemDanh(lopId: string, giaiDoanId: string | null) {
  return useQuery({
    queryKey: ['diem-danh', lopId, giaiDoanId],
    queryFn: () =>
      apiFetch<BangDiemDanh>(
        `/lop/${lopId}/diem-danh${giaiDoanId ? `?giai_doan_id=${encodeURIComponent(giaiDoanId)}` : ''}`,
      ),
  });
}

export function useSuaDiemDanh(lopId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: SuaDiemDanhDto) =>
      apiFetch<ODiemDanh & { dang_ky_hoc_id: string; lich_hoc_id: string }>(`/lop/${lopId}/diem-danh`, {
        method: 'PUT',
        body: JSON.stringify(dto),
      }),
    onSettled: () => qc.invalidateQueries({ queryKey: ['diem-danh', lopId] }),
  });
}
