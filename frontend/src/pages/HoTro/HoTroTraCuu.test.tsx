import { describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/mocks/server';
import { db } from '@/test/mocks/db';
import { renderVoiRouter } from '@/test/testUtils';
import { datToken } from '@/auth/tokenStore';
import HoTroTrangChu from './HoTroTrangChu';
import HoTroDanhSachHocVien from './HoTroDanhSachHocVien';
import HoTroHocVienChiTiet from './HoTroHocVienChiTiet';
import HoTroLichHoc from './HoTroLichHoc';

// ADR 0003 Lát 2 — tra cứu của người hỗ trợ học viên (phạm vi cụm do backend lọc).
function render(initialEntries: string[]) {
  datToken('token-gia-lap');
  db.nguoiDung.vai_tro = 'ho_tro_hoc_vien';
  return renderVoiRouter(
    [
      { path: '/ho-tro', element: <HoTroTrangChu /> },
      { path: '/ho-tro/hoc-vien', element: <HoTroDanhSachHocVien /> },
      { path: '/ho-tro/hoc-vien/:id', element: <HoTroHocVienChiTiet /> },
      { path: '/ho-tro/lich-hoc', element: <HoTroLichHoc /> },
    ],
    { initialEntries },
  );
}

describe('Người hỗ trợ — Cụm của tôi', () => {
  it('thẻ cụm: tên, khóa, số học viên, link Zalo, nút xem học viên lọc đúng cụm', async () => {
    render(['/ho-tro']);
    expect(await screen.findByText('Cụm Long Xuyên')).toBeInTheDocument();
    expect(screen.getByText('KBD-AG-01 · Khóa An Giang')).toBeInTheDocument();
    expect(screen.getByText('120 học viên')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Nhóm Zalo của cụm' })).toHaveAttribute('href', 'https://zalo.me/g/cum-long-xuyen');
    expect(screen.getByRole('link', { name: 'Xem học viên' })).toHaveAttribute('href', '/ho-tro/hoc-vien?cum_id=cum-1');
  });

  it('chưa được phân công -> hướng dẫn liên hệ Quản trị', async () => {
    db.hoTroCum = [];
    render(['/ho-tro']);
    expect(await screen.findByText(/chưa được phân công cụm nào/)).toBeInTheDocument();
  });
});

describe('Người hỗ trợ — Danh sách học viên', () => {
  it('hiện học viên, trạng thái đăng nhập/hồ sơ/khảo sát; tên dẫn tới chi tiết', async () => {
    render(['/ho-tro/hoc-vien']);
    const bang = await screen.findByRole('table');
    const link = await within(bang).findByRole('link', { name: 'Nguyễn Văn Một' });
    expect(link).toHaveAttribute('href', '/ho-tro/hoc-vien/hv-ht-1');
    const dong = link.closest('tr')!;
    expect(within(dong).getByText('Chưa')).toBeInTheDocument();
    expect(within(dong).getByText('Chưa đủ')).toBeInTheDocument();
    expect(within(dong).getByText('Phiếu đánh giá năng lực số: xong')).toBeInTheDocument();
  });

  it('?cum_id trên URL và từ khóa tìm kiếm được gửi lên API', async () => {
    const queries: string[] = [];
    server.use(
      http.get('/ho-tro-hoc-vien/hoc-vien', ({ request }) => {
        queries.push(new URL(request.url).search);
        return HttpResponse.json({ data: [], total: 0, page: 1, page_size: 20 });
      }),
    );
    render(['/ho-tro/hoc-vien?cum_id=cum-1']);
    await waitFor(() => expect(queries.some((q) => q.includes('cum_id=cum-1'))).toBe(true));
    const user = userEvent.setup();
    await user.type(screen.getByRole('textbox', { name: 'Tìm kiếm' }), 'nguyen van');
    await waitFor(() => expect(queries.some((q) => q.includes('q=nguyen+van'))).toBe(true), { timeout: 2000 });
    expect(await screen.findByText('Không có học viên nào khớp bộ lọc.')).toBeInTheDocument();
  });

  it('Xuất Excel gửi đúng bộ lọc (không phân trang) và tải file', async () => {
    let query = '';
    server.use(
      http.get('/ho-tro-hoc-vien/hoc-vien/xuat', ({ request }) => {
        query = new URL(request.url).search;
        return new HttpResponse(new Blob(['xlsx']));
      }),
    );
    render(['/ho-tro/hoc-vien?cum_id=cum-1']);
    const user = userEvent.setup();
    await screen.findByRole('link', { name: 'Nguyễn Văn Một' });
    await user.click(screen.getByRole('button', { name: 'Xuất Excel' }));
    await waitFor(() => expect(URL.createObjectURL).toHaveBeenCalled());
    expect(query).toContain('cum_id=cum-1');
    expect(query).not.toContain('page');
  });
});

describe('Người hỗ trợ — Chi tiết học viên', () => {
  it('hiện hồ sơ, phần còn thiếu, tài khoản, khảo sát', async () => {
    render(['/ho-tro/hoc-vien/hv-ht-1']);
    expect(await screen.findByRole('heading', { name: 'Nguyễn Văn Một' })).toBeInTheDocument();
    expect(screen.getByText('Hồ sơ chưa đủ')).toBeInTheDocument();
    expect(screen.getByText(/Chưa chọn đối tượng/)).toBeInTheDocument();
    expect(screen.getByText('Chưa đổi mật khẩu lần đầu')).toBeInTheDocument();
    expect(screen.getByText('Chưa xác minh')).toBeInTheDocument();
    expect(screen.getByText(/Phiếu đánh giá năng lực số: Đã hoàn thành · Thành thạo/)).toBeInTheDocument();
    expect(screen.getByText('Chưa ghi danh khóa nào.')).toBeInTheDocument();
  });

  it('học viên ngoài cụm (404) -> báo không tìm thấy', async () => {
    render(['/ho-tro/hoc-vien/khac']);
    expect(await screen.findByText(/Không tìm thấy hồ sơ học viên/)).toBeInTheDocument();
  });
});

describe('Người hỗ trợ — Lịch học', () => {
  it('nhóm theo ngày: giờ, lớp, link Zoom, giảng viên, số học viên của cụm', async () => {
    render(['/ho-tro/lich-hoc']);
    expect(await screen.findByText('10/10/2026')).toBeInTheDocument();
    expect(screen.getByText('08:00–11:00')).toBeInTheDocument();
    expect(screen.getByText('Lớp Zoom 01 · Buổi 1')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'https://zoom.us/j/123' })).toHaveAttribute('href', 'https://zoom.us/j/123');
    expect(screen.getByText(/GV: TS. Giảng Viên \(0900000000\)/)).toBeInTheDocument();
    expect(screen.getByText(/35 học viên của cụm/)).toBeInTheDocument();
  });

  // ADR 0004 G9 (issue #15): liên thông — điểm học, phòng, nhóm hỗ trợ giảng viên.
  it('buổi trực tiếp: hiện điểm học + phòng + liên hệ, nhóm hỗ trợ giảng viên', async () => {
    db.hoTroLichHoc = [
      {
        ...db.hoTroLichHoc[0],
        dia_diem_hoac_link: null,
        phong: 'P.7',
        diem_hoc: { id: 'dh-1', ten: 'THPT Long Xuyên', dia_chi: '1 Trần Hưng Đạo', nguoi_lien_he: 'Cô Lan', sdt_lien_he: '0901000001' },
        nhom_ho_tro_gv: [{ ho_ten: 'Phạm Văn Giảng', email: 'pham.g@hcmue.edu.vn' }],
      },
    ];
    render(['/ho-tro/lich-hoc']);
    expect(await screen.findByText(/Điểm học: THPT Long Xuyên — phòng P.7 · 1 Trần Hưng Đạo · Liên hệ: Cô Lan \(0901000001\)/)).toBeInTheDocument();
    expect(screen.getByText(/Hỗ trợ giảng viên: Phạm Văn Giảng \(pham.g@hcmue.edu.vn\)/)).toBeInTheDocument();
  });

  it('không có buổi -> thông báo rỗng', async () => {
    db.hoTroLichHoc = [];
    render(['/ho-tro/lich-hoc']);
    expect(await screen.findByText(/Không có buổi học nào/)).toBeInTheDocument();
  });
});
