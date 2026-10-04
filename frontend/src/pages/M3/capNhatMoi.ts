// Thông báo "kết quả đánh giá / danh sách chia lớp đã được cập nhật" trên trang chủ học viên.
// API không có thời điểm cập nhật -> so dấu vết hiện tại (mức đầu vào, id lớp) với dấu vết lần
// cuối học viên bấm xem, lưu localStorage theo học viên. Mất localStorage (đổi máy, ẩn danh) thì
// chỉ hiện lại thông báo một lần — chấp nhận được, không cần backend.
import { useState } from 'react';
import type { KhoaHocDangKy } from '@/api/types';
import { nhanMucNangLuc } from '@/lib/mucNangLuc';

interface DauVet {
  ketQua: string;
  phanLop: string;
}

export interface CapNhatMoi {
  /** Mỗi dòng: "<tên khóa>: Mức <x>" — rỗng = không có gì mới. */
  ketQua: string[];
  /** Mỗi dòng: "<tên khóa>: <tên lớp>, ..." — rỗng = không có gì mới. */
  phanLop: string[];
  danhDauDaXem: () => void;
}

function lopCua(dk: KhoaHocDangKy) {
  return dk.giai_doan.flatMap((gd) => (gd.lop ? [gd.lop] : []));
}

export function tinhDauVet(ds: KhoaHocDangKy[]): DauVet {
  const ketQua = ds
    .filter((dk) => dk.muc_dau_vao)
    .map((dk) => `${dk.khoa_id}:${dk.muc_dau_vao}`)
    .sort()
    .join('|');
  const phanLop = ds
    .map((dk) => ({ khoa: dk.khoa_id, lop: lopCua(dk).map((l) => l.id).sort() }))
    .filter((x) => x.lop.length > 0)
    .map((x) => `${x.khoa}:${x.lop.join(',')}`)
    .sort()
    .join('|');
  return { ketQua, phanLop };
}

function khoaLuu(ds: KhoaHocDangKy[]) {
  return ds[0] ? `toi_da_xem:${ds[0].hoc_vien_id}` : null;
}

function docDaXem(khoa: string): DauVet | null {
  try {
    const raw = localStorage.getItem(khoa);
    return raw ? (JSON.parse(raw) as DauVet) : null;
  } catch {
    return null;
  }
}

function ghiDaXem(khoa: string, dauVet: DauVet) {
  try {
    localStorage.setItem(khoa, JSON.stringify(dauVet));
  } catch {
    // Trình duyệt chặn storage: thông báo sẽ hiện lại lần sau, không ảnh hưởng chức năng.
  }
}

export function useCapNhatMoi(ds: KhoaHocDangKy[] | undefined): CapNhatMoi {
  const [, lamMoi] = useState(0);
  const danhSach = ds ?? [];
  const khoa = khoaLuu(danhSach);
  const hienTai = tinhDauVet(danhSach);
  const daXem = khoa ? docDaXem(khoa) : null;

  const ketQuaMoi = hienTai.ketQua !== '' && hienTai.ketQua !== daXem?.ketQua;
  const phanLopMoi = hienTai.phanLop !== '' && hienTai.phanLop !== daXem?.phanLop;

  return {
    ketQua: ketQuaMoi
      ? danhSach
          .filter((dk) => dk.muc_dau_vao)
          .map((dk) => `${dk.khoa.ten_khoa}: Mức ${nhanMucNangLuc(dk.muc_dau_vao)}`)
      : [],
    phanLop: phanLopMoi
      ? danhSach
          .filter((dk) => lopCua(dk).length > 0)
          .map((dk) => `${dk.khoa.ten_khoa}: ${[...new Set(lopCua(dk).map((l) => l.ten_lop))].join(', ')}`)
      : [],
    danhDauDaXem: () => {
      if (!khoa) return;
      ghiDaXem(khoa, hienTai);
      lamMoi((n) => n + 1);
    },
  };
}
