import { describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/mocks/server';
import { db } from '@/test/mocks/db';
import { renderTrang } from '@/test/testUtils';
import { datToken } from '@/auth/tokenStore';
import type { HangDoiEmailDong, NhatKyThongBao, TrangThaiHangDoi } from '@/api/thongBao';
import { MENU_ADMIN } from './menu';
import AdminNhatKyEmail from './AdminNhatKyEmail';

const TINH_TRANG: TrangThaiHangDoi = {
  theo_trang_thai: { cho_gui: 12, thanh_cong: 3400, that_bai: 5 },
  da_gui_hom_nay: 150,
  han_muc_con_lai: 1850,
};

const NHAT_KY: NhatKyThongBao[] = [
  {
    id: 'nk-1',
    loai_su_kien: 'nhac_lich_giang_vien',
    hoc_vien_id: null,
    email_nguoi_nhan: 'gv@test.local',
    tieu_de: 'Lịch giảng dạy giai đoạn 1',
    gui_luc: '2026-10-17T02:00:00.000Z',
    trang_thai: 'that_bai',
    loi: 'Hộp thư không tồn tại',
  },
];

const HANG_DOI: HangDoiEmailDong[] = [
  {
    id: 'hd-1',
    loai_su_kien: 'hoc_vien_xac_nhan',
    hoc_vien_id: 'hv-1',
    email_nguoi_nhan: 'hv@test.local',
    tieu_de: 'Xác nhận hồ sơ',
    trang_thai: 'thanh_cong',
    so_lan_thu: 1,
    loi: null,
    created_at: '2026-10-17T01:00:00.000Z',
    gui_luc: '2026-10-17T01:01:00.000Z',
  },
];

const trang = <T,>(data: T[]) => ({ data, total: data.length, page: 1, page_size: 20 });

function render({
  nhatKy = NHAT_KY,
  hangDoi = HANG_DOI,
  loiLichSu = false,
}: { nhatKy?: NhatKyThongBao[]; hangDoi?: HangDoiEmailDong[]; loiLichSu?: boolean } = {}) {
  datToken('token-gia-lap');
  db.nguoiDung.vai_tro = 'quan_tri';
  const urlLichSu: URL[] = [];
  server.use(
    http.get('/thong-bao/hang-doi', () => HttpResponse.json(TINH_TRANG)),
    http.get('/thong-bao/lich-su', ({ request }) => {
      urlLichSu.push(new URL(request.url));
      if (loiLichSu) return HttpResponse.json({ error: { code: 'INTERNAL', message: 'Lỗi máy chủ' } }, { status: 500 });
      return HttpResponse.json(trang(nhatKy));
    }),
    http.get('/thong-bao/hang-doi/danh-sach', () => HttpResponse.json(trang(hangDoi))),
    http.get('/thong-bao/hang-doi/:id', ({ params }) =>
      HttpResponse.json({ ...HANG_DOI[0], id: params.id, noi_dung_html: '<p>Kính gửi Thầy/Cô</p>' }),
    ),
  );
  return { ...renderTrang(<AdminNhatKyEmail />), urlLichSu };
}

describe('Admin — Nhật ký email', () => {
  it('menu có mục "Nhật ký email" chỉ cho Quản trị', () => {
    expect(MENU_ADMIN.find((m) => m.to === '/admin/nhat-ky-email')).toMatchObject({
      nhan: 'Nhật ký email',
      chiQuanTri: true,
    });
  });

  it('thẻ số liệu hàng đợi + hạn mức', async () => {
    render();
    expect(await screen.findByLabelText('Chờ gửi: 12')).toBeInTheDocument();
    expect(screen.getByLabelText('Thất bại (hàng đợi): 5')).toBeInTheDocument();
    expect(screen.getByLabelText('Đã gửi hôm nay: 150')).toBeInTheDocument();
    expect(screen.getByLabelText('Hạn mức còn lại hôm nay: 1850')).toBeInTheDocument();
  });

  it('tab Nhật ký gửi: hiện loại tiếng Việt, người nhận, trạng thái, lỗi', async () => {
    render();
    const o = await screen.findByText('gv@test.local');
    const dong = o.closest('tr')!;
    expect(within(dong).getByText('Lịch giảng dạy (giảng viên)')).toBeInTheDocument();
    expect(within(dong).getByText('Thất bại')).toBeInTheDocument();
    expect(within(dong).getByText('Hộp thư không tồn tại')).toBeInTheDocument();
  });

  it('gõ tìm kiếm -> gửi q lên server, về trang 1', async () => {
    const { urlLichSu } = render();
    await screen.findByText('gv@test.local');
    await userEvent.type(screen.getByLabelText('Tìm theo email hoặc tiêu đề'), 'gv@');
    await waitFor(() => expect(urlLichSu.some((u) => u.searchParams.get('q') === 'gv@')).toBe(true));
    expect(urlLichSu[urlLichSu.length - 1].searchParams.get('page')).toBe('1');
  });

  it('danh sách rỗng -> thông báo không có email', async () => {
    render({ nhatKy: [] });
    expect(await screen.findByText('Không có email nào khớp bộ lọc.')).toBeInTheDocument();
  });

  it('API lỗi -> hiện Alert', async () => {
    render({ loiLichSu: true });
    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });

  it('tab Hàng đợi: bấm Xem mở nội dung email trong iframe sandbox', async () => {
    render();
    await userEvent.click(await screen.findByRole('tab', { name: 'Hàng đợi email' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Xem email gửi hv@test.local' }));
    const iframe = await screen.findByTitle('Nội dung email');
    expect(iframe).toHaveAttribute('sandbox', '');
    expect(iframe.getAttribute('srcdoc')).toContain('Kính gửi Thầy/Cô');
  });
});
