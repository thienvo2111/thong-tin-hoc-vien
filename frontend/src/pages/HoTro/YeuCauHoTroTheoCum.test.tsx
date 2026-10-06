import { describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/mocks/server';
import { db } from '@/test/mocks/db';
import { renderVoiRouter } from '@/test/testUtils';
import { datToken } from '@/auth/tokenStore';
import type { YeuCauHoTro } from '@/api/types';
import HoTroYeuCauHoTro from './HoTroYeuCauHoTro';
import HoTroLayout from './HoTroLayout';
import AdminYeuCauHoTroPage from '@/pages/Admin/AdminYeuCauHoTro';
import YeuCauHoTroPage from '@/pages/M8/YeuCauHoTro';
import TrangChinh from '@/pages/M3/TrangChinh';

// ADR 0003 Lát 4 — yêu cầu hỗ trợ theo cụm (frontend).
function ticket(ghiDe: Partial<YeuCauHoTro> = {}): YeuCauHoTro {
  return {
    id: 'yc-1',
    hoc_vien_id: 'hv-ht-1',
    loai_van_de_id: null,
    tinh_huong: 'Khác',
    chu_de: 'Khác',
    noi_dung_hoi: 'Em chưa thấy link Zoom',
    noi_dung_tra_loi: null,
    trang_thai: 'cho_xu_ly',
    danh_gia: null,
    da_dong_hieu_luc: false,
    thoi_gian_tao: '2026-10-06T01:00:00.000Z',
    thoi_gian_phan_hoi: null,
    thoi_gian_dong: null,
    thoi_gian_sua_tra_loi: null,
    ...ghiDe,
  };
}

// 409 như backend khi người khác đã trả lời trước: ticket đổi trạng thái + có câu trả lời.
function giaLapNguoiKhacDaTraLoi(duong: string) {
  server.use(
    http.patch(duong, () => {
      Object.assign(db.danhSachYeuCauHoTro[0], {
        trang_thai: 'da_phan_hoi',
        noi_dung_tra_loi: 'Link ở mục Lớp học',
        nguoi_tra_loi_ten: 'Cán bộ khác',
      });
      return HttpResponse.json(
        { error: { code: 'CONFLICT', message: 'Yêu cầu này đã có người trả lời', fields: [] } },
        { status: 409 },
      );
    }),
  );
}

describe('Người hỗ trợ — Yêu cầu hỗ trợ của cụm', () => {
  function render() {
    datToken('token-gia-lap');
    db.nguoiDung.vai_tro = 'ho_tro_hoc_vien';
    return renderVoiRouter(
      [{ element: <HoTroLayout />, children: [{ path: '/ho-tro/yeu-cau-ho-tro', element: <HoTroYeuCauHoTro /> }] }],
      { initialEntries: ['/ho-tro/yeu-cau-ho-tro'] },
    );
  }

  it('menu hiện số yêu cầu chờ xử lý; thẻ ticket có tên học viên (link), cụm, nội dung', async () => {
    db.danhSachYeuCauHoTro = [ticket()];
    render();
    expect(await screen.findByLabelText('1 yêu cầu chờ xử lý')).toBeInTheDocument();
    const link = await screen.findByRole('link', { name: 'Học viên mẫu' });
    expect(link).toHaveAttribute('href', '/ho-tro/hoc-vien/hv-ht-1');
    const the = link.closest('.mantine-Paper-root') as HTMLElement;
    expect(within(the).getByText(/Em chưa thấy link Zoom/)).toBeInTheDocument();
    expect(within(the).getByText(/Cụm Long Xuyên · /)).toBeInTheDocument();
  });

  it('trả lời thành công -> gửi đúng nội dung, ticket rời hàng chờ', async () => {
    db.danhSachYeuCauHoTro = [ticket()];
    let body: unknown = null;
    server.use(
      http.patch('/ho-tro/yeu-cau-ho-tro/:id/tra-loi', async ({ request }) => {
        body = await request.json();
        Object.assign(db.danhSachYeuCauHoTro[0], { trang_thai: 'da_phan_hoi', noi_dung_tra_loi: 'Link ở mục Lớp học' });
        return HttpResponse.json(db.danhSachYeuCauHoTro[0]);
      }),
    );
    render();
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Trả lời' }));
    await user.type(screen.getByRole('textbox', { name: 'Nội dung trả lời' }), 'Link ở mục Lớp học');
    await user.click(screen.getByRole('button', { name: 'Gửi trả lời' }));
    await waitFor(() => expect(body).toEqual({ noi_dung_tra_loi: 'Link ở mục Lớp học' }));
    expect(await screen.findByText('Không có yêu cầu nào đang chờ xử lý.')).toBeInTheDocument();
  });

  it('T12 (giao diện): người khác đã trả lời -> 409 giữ nguyên nội dung đang soạn + hiện câu trả lời đã có', async () => {
    db.danhSachYeuCauHoTro = [ticket()];
    giaLapNguoiKhacDaTraLoi('/ho-tro/yeu-cau-ho-tro/:id/tra-loi');
    render();
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Trả lời' }));
    const o = screen.getByRole('textbox', { name: 'Nội dung trả lời' });
    await user.type(o, 'Bản nháp của tôi');
    await user.click(screen.getByRole('button', { name: 'Gửi trả lời' }));
    expect(await screen.findByText('Yêu cầu này đã có người trả lời')).toBeInTheDocument();
    expect(screen.getByText('Link ở mục Lớp học')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Nội dung trả lời' })).toHaveValue('Bản nháp của tôi');
    expect(screen.getByRole('button', { name: 'Sao chép nội dung của tôi' })).toBeEnabled();
  });
});

describe('Quản trị — Yêu cầu hỗ trợ (ADR 0003)', () => {
  function render() {
    datToken('token-gia-lap');
    db.nguoiDung.vai_tro = 'quan_tri';
    return renderVoiRouter([{ path: '/admin/yeu-cau-ho-tro', element: <AdminYeuCauHoTroPage /> }], {
      initialEntries: ['/admin/yeu-cau-ho-tro'],
    });
  }

  it('bật "Chỉ học viên chưa có cụm" -> gửi chua_co_cum=true; cột Cụm hiện tên cụm', async () => {
    db.danhSachYeuCauHoTro = [ticket()];
    const queries: string[] = [];
    server.use(
      http.get('/yeu-cau-ho-tro', ({ request }) => {
        queries.push(new URL(request.url).search);
        return HttpResponse.json({
          data: [{ ...ticket(), hoc_vien_ho_ten: 'Học viên mẫu', nguoi_tra_loi_ten: null, ten_cum: ['Cụm Long Xuyên'], da_sua_boi_quan_tri: false, hoi_lai: false }],
          total: 1,
          page: 1,
          page_size: 20,
        });
      }),
    );
    render();
    const user = userEvent.setup();
    const bang = await screen.findByRole('table');
    expect(within(bang).getByText('Cụm Long Xuyên')).toBeInTheDocument();
    await user.click(screen.getByRole('switch', { name: /Chỉ học viên chưa có cụm/ }));
    await waitFor(() => expect(queries.some((q) => q.includes('chua_co_cum=true'))).toBe(true));
  });

  it('Sửa câu trả lời -> PATCH sua-tra-loi với nội dung mới, báo học viên nhận email', async () => {
    db.danhSachYeuCauHoTro = [ticket({ trang_thai: 'da_phan_hoi', noi_dung_tra_loi: 'Trả lời sai', thoi_gian_phan_hoi: '2026-10-06T02:00:00.000Z' })];
    let body: unknown = null;
    server.use(
      http.patch('/yeu-cau-ho-tro/:id/sua-tra-loi', async ({ request }) => {
        body = await request.json();
        return HttpResponse.json(db.danhSachYeuCauHoTro[0]);
      }),
    );
    render();
    const user = userEvent.setup();
    await user.click(await screen.findByRole('radio', { name: 'Đã phản hồi' }));
    await user.click(await screen.findByRole('button', { name: 'Sửa câu trả lời' }));
    const o = screen.getByRole('textbox', { name: 'Câu trả lời đã sửa' });
    expect(o).toHaveValue('Trả lời sai');
    await user.clear(o);
    await user.type(o, 'Trả lời đúng');
    await user.click(screen.getByRole('button', { name: 'Lưu câu trả lời' }));
    await waitFor(() => expect(body).toEqual({ noi_dung_tra_loi: 'Trả lời đúng' }));
    expect(await screen.findByText(/học viên sẽ nhận email cập nhật/)).toBeInTheDocument();
  });

  it('Quản trị trả lời nhưng người hỗ trợ đã trả lời trước -> 409 giữ bản nháp', async () => {
    db.danhSachYeuCauHoTro = [ticket()];
    giaLapNguoiKhacDaTraLoi('/yeu-cau-ho-tro/:id/tra-loi');
    render();
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Trả lời' }));
    await user.type(screen.getByRole('textbox', { name: 'Nội dung trả lời' }), 'Nháp quản trị');
    await user.click(screen.getByRole('button', { name: 'Gửi trả lời' }));
    expect(await screen.findByText('Yêu cầu này đã có người trả lời')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Nội dung trả lời' })).toHaveValue('Nháp quản trị');
  });
});

describe('Học viên — ký tên cụm và cụm hỗ trợ', () => {
  it('T15: câu trả lời ký tên cụm; câu trả lời đã sửa có nhãn cập nhật', async () => {
    datToken('token-gia-lap');
    db.danhSachYeuCauHoTro = [
      ticket({
        trang_thai: 'da_phan_hoi',
        noi_dung_tra_loi: 'Link ở mục Lớp học',
        nguoi_tra_loi_hien_thi: 'Cụm hỗ trợ 3',
        thoi_gian_sua_tra_loi: '2026-10-06T03:30:00.000Z',
      }),
    ];
    renderVoiRouter([{ path: '/toi/yeu-cau-ho-tro', element: <YeuCauHoTroPage /> }], {
      initialEntries: ['/toi/yeu-cau-ho-tro'],
    });
    expect(await screen.findByText('Trả lời · Cụm hỗ trợ 3:')).toBeInTheDocument();
    expect(screen.getByText('Câu trả lời đã được cập nhật lúc 06/10/2026 10:30')).toBeInTheDocument();
  });

  it('trang chủ học viên có thẻ cụm hỗ trợ + nút Vào nhóm Zalo (từ DB)', async () => {
    datToken('token-gia-lap');
    renderVoiRouter([{ path: '/toi', element: <TrangChinh /> }], { initialEntries: ['/toi'] });
    expect(await screen.findByText('Cụm hỗ trợ của Thầy/Cô')).toBeInTheDocument();
    const the = screen.getByText('Cụm hỗ trợ của Thầy/Cô').closest('.mantine-Card-root') as HTMLElement;
    expect(within(the).getByText('Cụm Long Xuyên')).toBeInTheDocument();
    expect(within(the).getByRole('link', { name: 'Vào nhóm Zalo' })).toHaveAttribute('href', 'https://zalo.me/g/cum-long-xuyen');
  });
});
