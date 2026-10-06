import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/mocks/server';
import { db } from '@/test/mocks/db';
import { renderTrang } from '@/test/testUtils';
import { datToken } from '@/auth/tokenStore';
import type { VanHanh } from '@/api/vanHanh';
import { MENU_ADMIN } from './menu';
import AdminVanHanh from './AdminVanHanh';

// ADR 0004 L9 (issue #22): màn giám sát vận hành của Quản trị.
const RONG: VanHanh = {
  dot_do: [],
  de_nghi_cho_lau: [],
  thay_doi_lich: [],
  khoa_chua_nhom_gv: [],
  cum_chua_ho_tro: [],
  danh_muc_moi: { diem_hoc: [], giang_vien: [] },
};

function render(data: VanHanh) {
  datToken('token-gia-lap');
  db.nguoiDung.vai_tro = 'quan_tri';
  server.use(http.get('/van-hanh', () => HttpResponse.json(data)));
  return renderTrang(<AdminVanHanh />);
}

describe('Admin — Vận hành', () => {
  it('menu có mục "Vận hành" chỉ cho Quản trị', () => {
    expect(MENU_ADMIN.find((m) => m.to === '/admin/van-hanh')).toMatchObject({ nhan: 'Vận hành', chiQuanTri: true });
  });

  it('mỗi khối hiện đúng dữ liệu + link sang màn xử lý', async () => {
    render({
      dot_do: [
        {
          lop: { id: 'lop-1', ten_lop: 'Lớp 01', khoa: { id: 'khoa-1', ma_khoa: 'AG-1', ten_khoa: 'Khóa AG' } },
          giai_doan: { id: 'gd-2', thu_tu: 2, ten_giai_doan: 'Trực tiếp' },
          buoi_dau: '2026-11-10T01:00:00.000Z',
          so_qua_han: 1,
          muc_qua_han: ['Mọi buổi đã phân công giảng viên'],
          nhom_ho_tro_gv: ['Phạm Văn Giảng'],
        },
      ],
      de_nghi_cho_lau: [
        {
          id: 'dn-1',
          tao_luc: '2026-10-01T01:00:00.000Z',
          ly_do: 'Gần nhà',
          hoc_vien: { id: 'hv-1', ho_ten: 'Nguyễn Thị Lan' },
          tu_lop: 'Lớp 01',
          den_lop: 'Lớp 02',
          khoa: { id: 'khoa-1', ma_khoa: 'AG-1' },
          nguoi_tao: 'Hỗ trợ HV 1',
        },
      ],
      thay_doi_lich: [
        {
          id: 'nk-1',
          thoi_gian: '2026-10-06T01:00:00.000Z',
          nguoi: 'Phạm Văn Giảng',
          vai_tro: 'ho_tro_giang_vien',
          mo_ta: 'Sửa buổi 1',
          ly_do: 'Điểm học mất điện',
          truoc: { phong: 'A1' },
          sau: { phong: 'B2' },
          lop: { id: 'lop-1', ten_lop: 'Lớp 01', khoa: { id: 'khoa-1', ma_khoa: 'AG-1' } },
          giai_doan_id: 'gd-2',
        },
      ],
      khoa_chua_nhom_gv: [{ id: 'khoa-9', ma_khoa: 'AG-9', ten_khoa: 'Khóa chín', thoi_gian_bat_dau: '2026-11-01' }],
      cum_chua_ho_tro: [{ id: 'cum-9', ten_cum: 'Cụm Châu Đốc', khoa: { id: 'khoa-1', ma_khoa: 'AG-1' }, so_hoc_vien: 42 }],
      danh_muc_moi: {
        diem_hoc: [{ id: 'dh-9', ma_diem_hoc: 'DH-9', ten: 'THCS Mới', dia_chi: 'x', created_at: '2026-10-06T01:00:00.000Z', nguoi_tao: 'Phạm Văn Giảng' }],
        giang_vien: [],
      },
    });
    expect(await screen.findByRole('link', { name: 'AG-1 · Lớp 01 · GĐ2' })).toHaveAttribute('href', '/admin/khoa-boi-duong/khoa-1');
    expect(screen.getByText(/Quá hạn: Mọi buổi đã phân công giảng viên/)).toBeInTheDocument();
    expect(screen.getByText('Nguyễn Thị Lan: Lớp 01 → Lớp 02')).toBeInTheDocument();
    expect(screen.getByText('Lý do: Điểm học mất điện')).toBeInTheDocument();
    expect(screen.getByText('Phòng: A1 → B2')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /AG-9 — Khóa chín/ })).toHaveAttribute('href', '/admin/khoa-boi-duong/khoa-9');
    expect(screen.getByText(/Cụm Châu Đốc · AG-1 · 42 học viên/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'THCS Mới' })).toHaveAttribute('href', '/admin/diem-hoc');
  });

  it('không có việc tồn đọng → mỗi khối báo "Không có."', async () => {
    render(RONG);
    expect(await screen.findAllByText('Không có.')).toHaveLength(6);
  });
});
