import { describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/mocks/server';
import { db } from '@/test/mocks/db';
import { renderVoiRouter } from '@/test/testUtils';
import { datToken } from '@/auth/tokenStore';
import HoTroLop from './HoTroLop';
import HoTroLopChiTiet from './HoTroLopChiTiet';

// ADR 0008 — người hỗ trợ học viên theo lớp: danh sách lớp được gắn, danh sách học viên lớp, xuất Excel.
function render(initialEntries: string[]) {
  datToken('token-gia-lap');
  db.nguoiDung.vai_tro = 'ho_tro_hoc_vien';
  return renderVoiRouter(
    [
      { path: '/ho-tro/lop', element: <HoTroLop /> },
      { path: '/ho-tro/lop/:lopId', element: <HoTroLopChiTiet /> },
      {
        path: '/ho-tro/hoc-vien/:id',
        element: <div>Màn hình chi tiết học viên</div>,
      },
    ],
    { initialEntries },
  );
}

function ghiQueryXuat() {
  const queries: string[] = [];
  server.use(
    http.get('/ho-tro-hoc-vien/lop/xuat', ({ request }) => {
      queries.push(new URL(request.url).search);
      return new HttpResponse(new Blob(['xlsx']));
    }),
  );
  return queries;
}

function dongChua(el: HTMLElement): HTMLElement {
  const tr = el.closest('tr');
  if (!tr) throw new Error('Không thấy dòng bảng');
  return tr;
}

describe('Người hỗ trợ — Lớp hỗ trợ', () => {
  it('bảng lớp: khóa, loại, tên, mức, sĩ số; nút Xem danh sách dẫn tới lớp', async () => {
    render(['/ho-tro/lop']);
    const bang = await screen.findByRole('table');
    for (const cot of ['Khóa', 'Loại lớp', 'Tên lớp', 'Mức', 'Sĩ số']) {
      expect(within(bang).getByRole('columnheader', { name: cot })).toBeInTheDocument();
    }
    const dong = dongChua(within(bang).getByText('Zoom 01'));
    expect(within(dong).getByText('KBD-AG-01')).toBeInTheDocument();
    expect(within(dong).getByText('Zoom')).toBeInTheDocument();
    expect(within(dong).getByText('Cơ bản')).toBeInTheDocument();
    expect(within(dong).getByText('1')).toBeInTheDocument();
    expect(within(dong).getByRole('link', { name: 'Xem danh sách' })).toHaveAttribute('href', '/ho-tro/lop/lop-zoom-1');
  });

  it('chưa được gắn lớp nào -> hướng dẫn liên hệ Quản trị, không có nút xuất', async () => {
    db.hoTroLop = [];
    render(['/ho-tro/lop']);
    expect(
      await screen.findByText('Thầy/Cô chưa được gắn hỗ trợ lớp nào. Liên hệ Quản trị để được phân công.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Xuất tất cả lớp' })).not.toBeInTheDocument();
  });

  it('Xuất tất cả lớp -> gọi /lop/xuat không lop_id và tải file', async () => {
    const queries = ghiQueryXuat();
    render(['/ho-tro/lop']);
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Xuất tất cả lớp' }));
    await waitFor(() => expect(queries).toEqual(['']));
    await waitFor(() => expect(URL.createObjectURL).toHaveBeenCalled());
  });

  it('Xuất Excel 1 lớp -> gửi lop_id của lớp', async () => {
    const queries = ghiQueryXuat();
    render(['/ho-tro/lop']);
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Xuất Excel lớp Zoom 01' }));
    await waitFor(() => expect(queries).toEqual(['?lop_id=lop-zoom-1']));
  });
});

describe('Người hỗ trợ — Danh sách học viên lớp', () => {
  it('đầu lớp + bảng học viên (ngày sinh, đơn vị, SĐT, email, cụm, giai đoạn); tên dẫn tới chi tiết', async () => {
    render(['/ho-tro/lop/lop-zoom-1']);
    expect(await screen.findByRole('heading', { name: 'Zoom · Zoom 01' })).toBeInTheDocument();
    expect(screen.getByText('KBD-AG-01 · Khóa An Giang')).toBeInTheDocument();
    const bang = screen.getByRole('table');
    const link = within(bang).getByRole('link', { name: 'Lê Thị Zoom' });
    expect(link).toHaveAttribute('href', '/ho-tro/hoc-vien/hv-lop-1');
    const dong = dongChua(link);
    for (const o of [
      '02/03/1988',
      'Trường THCS Mỹ Hòa',
      '0912345678',
      'zoom@gmail.com',
      'Cụm Long Xuyên',
      'Học Zoom',
    ]) {
      expect(within(dong).getByText(o)).toBeInTheDocument();
    }
    const user = userEvent.setup();
    await user.click(link);
    expect(await screen.findByText('Màn hình chi tiết học viên')).toBeInTheDocument();
  });

  it('Xuất Excel lớp này -> gửi lop_id', async () => {
    const queries = ghiQueryXuat();
    render(['/ho-tro/lop/lop-zoom-1']);
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Xuất Excel lớp này' }));
    await waitFor(() => expect(queries).toEqual(['?lop_id=lop-zoom-1']));
  });

  it('lớp không được gắn (404) -> thông báo "Không tìm thấy lớp"', async () => {
    render(['/ho-tro/lop/lop-khac']);
    expect(await screen.findByText('Không tìm thấy lớp')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });
});

// ADR 0008 L7: tab "Theo buổi" — danh sách từng buổi tính đổi buổi đã duyệt.
describe('Người hỗ trợ — Danh sách lớp theo buổi', () => {
  const BUOI_1 = 'GĐ1 – Buổi 1 · 20/10 19:00 · 2 HV';
  const BUOI_2 = 'GĐ1 – Buổi 2 · 27/10 19:00 · 2 HV';

  async function moBuoi(nhan: string) {
    render(['/ho-tro/lop/lop-zoom-1']);
    const user = userEvent.setup();
    await user.click(await screen.findByRole('tab', { name: 'Theo buổi' }));
    await user.click(await screen.findByRole('textbox', { name: 'Buổi học' }));
    await user.click(await screen.findByRole('option', { name: nhan }));
    return user;
  }

  it('liệt kê các buổi của lớp (giai đoạn, buổi, ngày giờ, sĩ số)', async () => {
    render(['/ho-tro/lop/lop-zoom-1']);
    const user = userEvent.setup();
    await user.click(await screen.findByRole('tab', { name: 'Theo buổi' }));
    await user.click(await screen.findByRole('textbox', { name: 'Buổi học' }));
    expect(await screen.findByRole('option', { name: BUOI_1 })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: BUOI_2 })).toBeInTheDocument();
  });

  it('người đổi vào: badge "Đổi vào", ghi chú lớp nguồn, không có link chi tiết; người thường có link', async () => {
    await moBuoi(BUOI_1);
    expect(await screen.findByText('Đặng Văn Vào')).toBeInTheDocument();
    expect(screen.getByText('1 đổi vào')).toBeInTheDocument();
    expect(screen.getByText('1 đổi ra')).toBeInTheDocument();
    const [bangChinh] = screen.getAllByRole('table');
    const dongVao = dongChua(within(bangChinh).getByText('Đặng Văn Vào'));
    expect(within(dongVao).getByText('Đổi vào')).toBeInTheDocument();
    expect(within(dongVao).getByText('Đổi buổi – từ lớp Zoom 02')).toBeInTheDocument();
    expect(within(dongVao).queryByRole('link')).not.toBeInTheDocument();
    expect(within(bangChinh).getByRole('link', { name: 'Lê Thị Zoom' })).toHaveAttribute(
      'href',
      '/ho-tro/hoc-vien/hv-lop-1',
    );
    expect(within(bangChinh).getByRole('columnheader', { name: 'Ghi chú' })).toBeInTheDocument();
    expect(within(bangChinh).queryByText('Phan Thị Ra')).not.toBeInTheDocument();
  });

  it('người đổi ra nằm ở mục "Đã chuyển sang lớp khác" kèm ghi chú', async () => {
    await moBuoi(BUOI_1);
    expect(
      await screen.findByRole('heading', { name: 'Đã chuyển sang lớp khác (không học buổi này)' }),
    ).toBeInTheDocument();
    const bangRa = screen.getAllByRole('table')[1];
    const dongRa = dongChua(within(bangRa).getByText('Phan Thị Ra'));
    expect(within(dongRa).getByText('Đã chuyển sang lớp Zoom 03 – không học buổi này')).toBeInTheDocument();
    expect(within(dongRa).queryByRole('link')).not.toBeInTheDocument();
  });

  it('buổi không có đổi buổi -> không có mục người đổi ra', async () => {
    await moBuoi(BUOI_2);
    expect(await screen.findByRole('link', { name: 'Phan Thị Ra' })).toBeInTheDocument();
    expect(screen.queryByText('Đã chuyển sang lớp khác (không học buổi này)')).not.toBeInTheDocument();
    expect(screen.getAllByRole('table')).toHaveLength(1);
  });

  it('Xuất buổi này -> gửi lich_id; Xuất tất cả buổi -> không lich_id', async () => {
    const goi: string[] = [];
    server.use(
      http.get('/ho-tro-hoc-vien/lop/:lopId/buoi/xuat', ({ request }) => {
        const url = new URL(request.url);
        goi.push(url.pathname + url.search);
        return new HttpResponse(new Blob(['xlsx']));
      }),
    );
    const user = await moBuoi(BUOI_2);
    await user.click(screen.getByRole('button', { name: 'Xuất buổi này' }));
    await waitFor(() => expect(goi).toEqual(['/ho-tro-hoc-vien/lop/lop-zoom-1/buoi/xuat?lich_id=lich-zoom-2']));
    await user.click(screen.getByRole('button', { name: 'Xuất tất cả buổi' }));
    await waitFor(() =>
      expect(goi).toEqual([
        '/ho-tro-hoc-vien/lop/lop-zoom-1/buoi/xuat?lich_id=lich-zoom-2',
        '/ho-tro-hoc-vien/lop/lop-zoom-1/buoi/xuat',
      ]),
    );
    await waitFor(() => expect(URL.createObjectURL).toHaveBeenCalled());
  });
});

// ADR 0008 L5 (sửa 2026-10-17) + L8: mã MOET ở cả 2 tab; điểm danh theo buổi; chuyên cần ở tab Cả lớp.
/** Màu Mantine của Badge chứa el (đọc từ biến --badge-color trong style inline). */
function mauBadge(el: HTMLElement): string | undefined {
  const style = el.closest('.mantine-Badge-root')?.getAttribute('style') ?? '';
  return /--badge-color:\s*var\(--mantine-color-(\w+)-/.exec(style)?.[1];
}

describe('Người hỗ trợ — mã MOET, điểm danh, chuyên cần', () => {
  it('tab Cả lớp: cột Mã MOET (giữ số 0 đầu) và "Có mặt / đã diễn ra" dạng x/y', async () => {
    render(['/ho-tro/lop/lop-zoom-1']);
    const bang = await screen.findByRole('table');
    expect(within(bang).getByRole('columnheader', { name: 'Mã MOET' })).toBeInTheDocument();
    expect(within(bang).getByRole('columnheader', { name: 'Có mặt / đã diễn ra' })).toBeInTheDocument();
    const dong = dongChua(within(bang).getByRole('link', { name: 'Lê Thị Zoom' }));
    expect(within(dong).getByText('0790000123')).toBeInTheDocument();
    expect(within(dong).getByText('3/4')).toBeInTheDocument();
  });

  it('tab Theo buổi: cột Mã MOET + Điểm danh, badge theo trạng thái, dòng tổng hợp', async () => {
    render(['/ho-tro/lop/lop-zoom-1']);
    const user = userEvent.setup();
    await user.click(await screen.findByRole('tab', { name: 'Theo buổi' }));
    await user.click(await screen.findByRole('textbox', { name: 'Buổi học' }));
    await user.click(await screen.findByRole('option', { name: 'GĐ1 – Buổi 1 · 20/10 19:00 · 2 HV' }));
    expect(
      await screen.findByText('Có mặt 1 · Vắng 0 · Có phép 0 · Báo vắng 1 · Chưa điểm danh 0'),
    ).toBeInTheDocument();
    const [bangChinh, bangRa] = screen.getAllByRole('table');
    expect(within(bangChinh).getByRole('columnheader', { name: 'Mã MOET' })).toBeInTheDocument();
    expect(within(bangChinh).getByRole('columnheader', { name: 'Điểm danh' })).toBeInTheDocument();
    const dongThuong = dongChua(within(bangChinh).getByRole('link', { name: 'Lê Thị Zoom' }));
    expect(within(dongThuong).getByText('0790000123')).toBeInTheDocument();
    const coMat = within(dongThuong).getByText('Có mặt – tự điểm danh 19:05');
    expect(mauBadge(coMat)).toBe('green');
    const dongVao = dongChua(within(bangChinh).getByText('Đặng Văn Vào'));
    const baoVang = within(dongVao).getByText('Đã báo vắng: Đi công tác');
    expect(mauBadge(baoVang)).toBe('orange');
    // Người đổi ra: không có điểm danh tại buổi này.
    const dongRa = dongChua(within(bangRa).getByText('Phan Thị Ra'));
    expect(within(dongRa).queryByText(/Có mặt|Vắng|Chưa điểm danh/)).not.toBeInTheDocument();
  });

  it('buổi 2: Vắng (đỏ), Chưa điểm danh (xám), có mặt nhờ học bù ở lớp khác (xanh + "Lớp khác")', async () => {
    render(['/ho-tro/lop/lop-zoom-1']);
    const user = userEvent.setup();
    await user.click(await screen.findByRole('tab', { name: 'Theo buổi' }));
    await user.click(await screen.findByRole('textbox', { name: 'Buổi học' }));
    await user.click(await screen.findByRole('option', { name: 'GĐ1 – Buổi 2 · 27/10 19:00 · 2 HV' }));
    expect(
      await screen.findByText('Có mặt 1 · Vắng 1 · Có phép 0 · Báo vắng 0 · Chưa điểm danh 1'),
    ).toBeInTheDocument();
    expect(mauBadge(screen.getByText('Vắng'))).toBe('red');
    expect(mauBadge(screen.getByText('Chưa điểm danh'))).toBe('gray');
    const dongHocBu = dongChua(screen.getByText('Lý Thị Bù'));
    expect(mauBadge(within(dongHocBu).getByText('Có mặt – ở lớp Trực tiếp 05'))).toBe('green');
    expect(within(dongHocBu).getByText('Lớp khác')).toBeInTheDocument();
    expect(screen.getAllByText('Lớp khác')).toHaveLength(1);
  });
});
