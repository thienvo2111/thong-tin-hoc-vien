import { beforeEach, describe, expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { notifications } from '@mantine/notifications';
import { server } from '@/test/mocks/server';
import { db } from '@/test/mocks/db';
import { renderTrang, renderVoiRouter } from '@/test/testUtils';
import { datToken } from '@/auth/tokenStore';
import { RequireAdmin } from '@/auth/RequireAdmin';
import { RequireGiangVien } from '@/auth/RequireGiangVien';
import { trangChuTheoVaiTro } from '@/lib/trangChuTheoVaiTro';
import type { BuoiDayCuaToi } from '@/api/congGiangVien';
import AdminGiangVien from '@/pages/Admin/AdminGiangVien';
import HoTroGvHoSoLop from '@/pages/HoTroGv/HoTroGvHoSoLop';
import GiangDayLayout from './GiangDayLayout';
import GiangDayLichDay from './GiangDayLichDay';
import GiangDayLop from './GiangDayLop';

// ADR 0004 L7 (issue #20): vai trò giang_vien chỉ đọc, cổng /giang-day.
beforeEach(() => notifications.clean());

const iso = (ngay: number) => new Date(Date.now() + ngay * 86400000).toISOString();

function buoiMau(id: string, ngay: number): BuoiDayCuaToi {
  return {
    id,
    buoi_so: 1,
    thoi_gian_bat_dau: iso(ngay),
    thoi_gian_ket_thuc: iso(ngay + 0.1),
    dia_diem_hoac_link: null,
    phong: 'A1',
    trang_thai: 'du_kien',
    vai_tro: 'giang_vien',
    lop: { id: 'lop-1', ten_lop: 'Lớp 01', loai_lop: 'truc_tiep', khoa: { id: 'khoa-1', ma_khoa: 'AG-1', ten_khoa: 'Khóa AG' } },
    giai_doan: { id: 'gd-2', thu_tu: 2, ten_giai_doan: 'Trực tiếp', hinh_thuc: 'truc_tiep' },
    diem_hoc: { ten: 'THPT Long Xuyên', dia_chi: '1 Trần Hưng Đạo', nguoi_lien_he: 'Cô Lan', sdt_lien_he: '0901000001' },
    giang_vien_khac: [{ ho_ten: 'Trần Thị Mai', vai_tro: 'ho_tro' }],
    hau_can: {
      noi_o_ten: 'KS Hoa Sen',
      noi_o_dia_chi: null,
      nhan_phong: null,
      tra_phong: null,
      phuong_tien: 'Xe 7 chỗ',
      don_luc: iso(ngay - 0.5),
      diem_don: 'Cổng HCMUE',
      lien_he_don: null,
      ghi_chu: null,
    },
    thuc_dia: [{ ho_ten: 'Lê Văn Đạt', so_dien_thoai: '0911222333', nhiem_vu: null }],
    nhom_ho_tro_gv: [{ ho_ten: 'Phạm Văn Giảng', email: 'pham.g@hcmue.edu.vn' }],
  };
}

function renderCong(initialEntries: string[]) {
  datToken('token-gia-lap');
  db.nguoiDung.vai_tro = 'giang_vien';
  server.use(
    http.get('/cong-giang-vien/lich-day', () => HttpResponse.json([buoiMau('b-1', 3), buoiMau('b-2', 10)])),
    http.get('/cong-giang-vien/lop/:lopId/giai-doan/:gdId', () => {
      // Backend đã lọc theo vai trò: bỏ SĐT/email/cụm học viên, liên hệ GV.
      const d = structuredClone(db.trangLopGv);
      d.hoc_vien = d.hoc_vien.map(({ so_dien_thoai: _s, email: _e, cum: _c, ...h }) => ({ ...h, bao_vang: {} }));
      d.hoc_vien_doi_vao = d.hoc_vien_doi_vao?.map(({ so_dien_thoai: _s, email: _e, cum: _c, ...h }) => h);
      d.hoc_vien[0].bao_vang = { [d.buoi[0].id]: 'Ốm' };
      d.buoi = d.buoi.map((b) => ({ ...b, giang_vien: b.giang_vien.map(({ id, ho_ten, vai_tro }) => ({ id, ho_ten, vai_tro })) }));
      return HttpResponse.json(d);
    }),
  );
  return renderVoiRouter(
    [
      { element: <RequireAdmin />, children: [{ path: '/admin/tong-quan', element: <div>Tổng quan admin</div> }] },
      {
        element: <RequireGiangVien />,
        children: [
          {
            element: <GiangDayLayout />,
            children: [
              { path: '/giang-day', element: <GiangDayLichDay /> },
              { path: '/giang-day/lop/:lopId/giai-doan/:gdId', element: <GiangDayLop /> },
            ],
          },
        ],
      },
      { path: '/ho-tro-gv', element: <div>Khu hỗ trợ GV</div> },
    ],
    { initialEntries },
  );
}

describe('Cổng giảng viên', () => {
  it('trang chủ của giang_vien là /giang-day; vào /admin → về /giang-day', async () => {
    expect(trangChuTheoVaiTro('giang_vien')).toBe('/giang-day');
    renderCong(['/admin/tong-quan']);
    expect(await screen.findByText('BUỔI GẦN NHẤT')).toBeInTheDocument();
    expect(screen.queryByText('Tổng quan admin')).not.toBeInTheDocument();
  });

  it('vai trò khác vào /giang-day → về trang chủ của mình', async () => {
    datToken('token-gia-lap');
    db.nguoiDung.vai_tro = 'ho_tro_giang_vien';
    const { unmount } = renderVoiRouter(
      [
        { element: <RequireGiangVien />, children: [{ path: '/giang-day', element: <div>Cổng GV</div> }] },
        { path: '/ho-tro-gv', element: <div>Khu hỗ trợ GV</div> },
      ],
      { initialEntries: ['/giang-day'] },
    );
    expect(await screen.findByText('Khu hỗ trợ GV')).toBeInTheDocument();
    unmount();
  });

  it('lịch dạy: buổi gần nhất có đón, nơi ở, thực địa, nhóm hỗ trợ, bản đồ; buổi sau chỉ tóm tắt', async () => {
    renderCong(['/giang-day']);
    expect(await screen.findByText('BUỔI GẦN NHẤT')).toBeInTheDocument();
    expect(screen.getByText(/Nơi ở: KS Hoa Sen/)).toBeInTheDocument();
    expect(screen.getByText(/tại Cổng HCMUE/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '0911222333' })).toHaveAttribute('href', 'tel:0911222333');
    expect(screen.getByText(/Hỗ trợ GV: Phạm Văn Giảng/)).toBeInTheDocument();
    const banDo = screen.getAllByRole('link', { name: 'Bản đồ' });
    expect(banDo[0].getAttribute('href')).toContain('google.com/maps');
    expect(screen.getAllByText(/Nơi ở:/)).toHaveLength(1);
    expect(screen.getAllByRole('link', { name: /Lớp 01 · Buổi 1/ })[0]).toHaveAttribute(
      'href',
      '/giang-day/lop/lop-1/giai-doan/gd-2',
    );
  });

  it('trang lớp chỉ đọc: học viên không có SĐT, có báo vắng; không có nút sửa', async () => {
    renderCong(['/giang-day/lop/lop-1/giai-doan/gd-2']);
    expect(await screen.findByText('Lớp 01 – Nhóm cơ bản A')).toBeInTheDocument();
    expect(screen.getByText(/báo vắng \(Ốm\)/)).toBeInTheDocument();
    expect(screen.queryByText('0909123456')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Sửa|Lưu|Phân công/ })).not.toBeInTheDocument();
  });

  // Spec đổi buổi §5: sĩ số buổi; người đổi vào hiện thêm với "Từ {lớp}", không cộng số học viên của lớp.
  it('trang lớp: đổi buổi vào/ra có nhãn, sĩ số buổi, số học viên lớp giữ lớp gốc', async () => {
    const hv0 = db.trangLopGv.hoc_vien[0];
    db.trangLopGv.buoi[0] = { ...db.trangLopGv.buoi[0], si_so: 1 };
    db.trangLopGv.hoc_vien = [{ ...hv0, doi_buoi: { 'lh-1': { loai: 'ra', lop: 'Lớp 05' } } }];
    db.trangLopGv.hoc_vien_doi_vao = [
      { ...hv0, dang_ky_hoc_id: 'dk-9', hoc_vien_id: 'hv-9', ho_ten: 'Phan Văn Đến', diem_danh: {}, doi_buoi: { 'lh-1': { loai: 'vao', lop: 'Lớp 07' } } },
    ];
    renderCong(['/giang-day/lop/lop-1/giai-doan/gd-2']);
    expect(await screen.findByText('Phan Văn Đến')).toBeInTheDocument();
    expect(screen.getByText(/· 1 học viên$/)).toBeInTheDocument();
    expect(screen.getByText(/Sĩ số buổi 1\/30/)).toBeInTheDocument();
    expect(screen.getByText('B1: Từ Lớp 07')).toBeInTheDocument();
    expect(screen.getByText('B1: Đổi sang Lớp 05')).toBeInTheDocument();
    expect(screen.getByText(/Thêm 1 học viên đổi buổi vào lớp/)).toBeInTheDocument();
  });

  it('trang lớp: tab Theo buổi — danh sách của buổi gồm người đổi vào, người đổi ra liệt kê riêng, không có SĐT', async () => {
    const hv0 = db.trangLopGv.hoc_vien[0];
    db.trangLopGv.hoc_vien = [{ ...hv0, doi_buoi: { 'lh-1': { loai: 'ra', lop: 'Lớp 05' } } }];
    db.trangLopGv.hoc_vien_doi_vao = [
      { ...hv0, dang_ky_hoc_id: 'dk-9', hoc_vien_id: 'hv-9', ho_ten: 'Phan Văn Đến', diem_danh: {}, doi_buoi: { 'lh-1': { loai: 'vao', lop: 'Lớp 07' } } },
    ];
    const user = userEvent.setup();
    renderCong(['/giang-day/lop/lop-1/giai-doan/gd-2']);
    await user.click(await screen.findByRole('tab', { name: 'Theo buổi' }));
    const panel = await screen.findByRole('tabpanel', { name: 'Theo buổi' });
    await user.selectOptions(within(panel).getByLabelText('Buổi'), 'lh-1');
    const bang = within(panel).getByRole('table');
    expect(within(bang).getByText('Phan Văn Đến')).toBeInTheDocument();
    expect(within(bang).getByText('Đổi buổi – từ lớp Lớp 07')).toBeInTheDocument();
    expect(within(bang).queryByText(hv0.ho_ten)).not.toBeInTheDocument();
    expect(within(panel).getByText(new RegExp(`${hv0.ho_ten} – đã chuyển sang Lớp 05`))).toBeInTheDocument();
    expect(within(panel).queryByRole('columnheader', { name: 'SĐT' })).not.toBeInTheDocument();
  });
});

describe('Cấp tài khoản giảng viên', () => {
  it('hỗ trợ GV: tab Giảng viên hiện trạng thái tài khoản + gửi link kích hoạt', async () => {
    datToken('token-gia-lap');
    db.nguoiDung.vai_tro = 'ho_tro_giang_vien';
    db.trangLopGv.buoi[0].giang_vien[0].tai_khoan = 'chua_co';
    let goi = '';
    server.use(
      http.post('/ho-tro-giang-vien/giang-vien/:id/gui-link-kich-hoat', ({ params }) => {
        goi = params.id as string;
        return HttpResponse.json({ da_gui: true, tao_moi: true, email: 'long@hcmue.edu.vn' });
      }),
    );
    const user = userEvent.setup();
    renderVoiRouter([{ path: '/ho-tro-gv/lop/:lopId/giai-doan/:gdId', element: <HoTroGvHoSoLop /> }], {
      initialEntries: ['/ho-tro-gv/lop/lop-1/giai-doan/gd-2'],
    });
    await user.click(await screen.findByRole('tab', { name: 'Giảng viên' }));
    const panel = await screen.findByRole('tabpanel', { name: 'Giảng viên' });
    expect(within(panel).getByText('Chưa có tài khoản')).toBeInTheDocument();
    await user.click(within(panel).getByRole('button', { name: 'Gửi link kích hoạt' }));
    expect(await screen.findByText('Đã gửi link kích hoạt tới long@hcmue.edu.vn')).toBeInTheDocument();
    expect(goi).toBe('gv-1');
  });

  it('Quản trị: danh mục giảng viên hiện trạng thái tài khoản; khóa tài khoản', async () => {
    datToken('token-gia-lap');
    db.nguoiDung.vai_tro = 'quan_tri';
    db.giangVien[0].tai_khoan = { ten_dang_nhap: 'long', trang_thai: 'active', phai_doi_mat_khau: false, dang_nhap_lan_cuoi: null };
    let body: unknown;
    server.use(
      http.patch('/giang-vien/:id/tai-khoan', async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ trang_thai: 'ngung' });
      }),
    );
    const user = userEvent.setup();
    renderTrang(<AdminGiangVien />);
    expect(await screen.findByText('Tài khoản hoạt động')).toBeInTheDocument();
    expect(screen.getAllByText('Chưa có tài khoản').length).toBeGreaterThan(0);
    await user.click(screen.getByRole('button', { name: 'Khóa TK' }));
    expect(await screen.findByText('Đã khóa tài khoản')).toBeInTheDocument();
    expect(body).toEqual({ trang_thai: 'ngung' });
  });
});
