import { afterEach, describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/mocks/server';
import { db } from '@/test/mocks/db';
import { tinhHinhDiHocMock } from '@/test/mocks/tinhHinhDiHoc';
import { renderVoiRouter } from '@/test/testUtils';
import { datToken } from '@/auth/tokenStore';
import HoTroTinhHinhDiHoc, { TinhHinhDiHocQuanTri } from './HoTroTinhHinhDiHoc';

// ADR 0010 — Tình hình đi học: bộ lọc trên URL, phân trang server, xuất Excel, chi tiết buổi, điểm danh bổ sung.
function render(initialEntries: string[], cheDo: 'ho_tro' | 'admin' = 'ho_tro') {
  datToken('token-gia-lap');
  db.nguoiDung.vai_tro = cheDo === 'admin' ? 'quan_tri' : 'ho_tro_hoc_vien';
  const path = cheDo === 'admin' ? '/admin/di-hoc' : '/ho-tro/di-hoc';
  return renderVoiRouter([{ path, element: cheDo === 'admin' ? <TinhHinhDiHocQuanTri /> : <HoTroTinhHinhDiHoc /> }], {
    initialEntries,
  });
}

afterEach(() => server.events.removeAllListeners());

const cuoi = <T,>(ds: T[]): T | undefined => ds[ds.length - 1];

/** Ghi lại query string của mọi GET danh sách (không gồm /khoa, /xuat, chi tiết). */
function ghiQueryDanhSach(goc = '/ho-tro-hoc-vien/di-hoc') {
  const queries: URLSearchParams[] = [];
  server.events.on('request:start', ({ request }) => {
    const url = new URL(request.url);
    if (request.method === 'GET' && url.pathname === goc) queries.push(url.searchParams);
  });
  return queries;
}

function dongChua(el: HTMLElement): HTMLElement {
  const tr = el.closest('tr');
  if (!tr) throw new Error('Không thấy dòng bảng');
  return tr;
}

describe('Tình hình đi học — người hỗ trợ', () => {
  it('mặc định chọn khóa đầu, hiện bảng từ API: cột, tổng, số học viên', async () => {
    const { router } = render(['/ho-tro/di-hoc']);
    const bang = await screen.findByRole('table');
    for (const cot of ['Họ tên', 'Mã MOET', 'Trường', 'Cụm', 'Lớp', 'Có mặt/đã diễn ra', 'Vắng', 'Chưa điểm danh']) {
      expect(within(bang).getByRole('columnheader', { name: cot })).toBeInTheDocument();
    }
    const dong = dongChua(within(bang).getByRole('button', { name: 'Nguyễn Văn An' }));
    expect(within(dong).getByText('01000')).toBeInTheDocument();
    expect(within(dong).getByText('1/3')).toBeInTheDocument();
    expect(within(dong).getByText('GĐ1: Zoom 01')).toBeInTheDocument();
    expect(screen.getByText('25 học viên')).toBeInTheDocument();
    expect(router.state.location.search).toContain('khoa_id=khoa-1');
  });

  it('bộ lọc ghi lên URL và gửi đúng tham số; đổi bộ lọc về trang 1', async () => {
    const queries = ghiQueryDanhSach();
    const { router } = render(['/ho-tro/di-hoc?khoa_id=khoa-1&page=2']);
    await screen.findByRole('table');
    const user = userEvent.setup();
    await user.click(screen.getByLabelText('Có buổi vắng'));
    await waitFor(() => expect(router.state.location.search).toContain('co_vang=true'));
    expect(router.state.location.search).not.toContain('page=');
    await waitFor(() => expect(cuoi(queries)?.get('co_vang')).toBe('true'));
    expect(cuoi(queries)?.get('page')).toBe('1');

    await user.type(screen.getByRole('textbox', { name: 'Tìm kiếm' }), '1003');
    await waitFor(() => expect(router.state.location.search).toContain('q=1003'), { timeout: 2000 });
    await waitFor(() => expect(cuoi(queries)?.get('q')).toBe('1003'));
  });

  it('chọn cụm và lớp từ danh sách khóa -> cum_id, lop_id trên URL', async () => {
    const { router } = render(['/ho-tro/di-hoc?khoa_id=khoa-1']);
    await screen.findByRole('table');
    const user = userEvent.setup();
    await user.click(screen.getByRole('textbox', { name: 'Cụm' }));
    await user.click(await screen.findByRole('option', { name: 'Cụm Long Xuyên' }));
    await waitFor(() => expect(router.state.location.search).toContain('cum_id=cum-1'));
    await user.click(screen.getByRole('textbox', { name: 'Lớp' }));
    await user.click(await screen.findByRole('option', { name: 'Zoom · Zoom 02' }));
    await waitFor(() => expect(router.state.location.search).toContain('lop_id=lop-zoom-2'));
  });

  it('phân trang server: trang 2 gửi page=2 và hiện 5 dòng còn lại', async () => {
    const queries = ghiQueryDanhSach();
    render(['/ho-tro/di-hoc?khoa_id=khoa-1']);
    await screen.findByRole('table');
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: '2' }));
    await waitFor(() => expect(cuoi(queries)?.get('page')).toBe('2'));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Học viên 24' })).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: 'Nguyễn Văn An' })).not.toBeInTheDocument();
  });

  it('Xuất Excel gửi bộ lọc hiện tại, không gửi phân trang', async () => {
    const xuat: string[] = [];
    server.use(
      http.get('/ho-tro-hoc-vien/di-hoc/xuat', ({ request }) => {
        xuat.push(new URL(request.url).search);
        return new HttpResponse(new Blob(['xlsx']));
      }),
    );
    render(['/ho-tro/di-hoc?khoa_id=khoa-1&co_vang=true&page=1']);
    await screen.findByRole('table');
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Xuất Excel' }));
    await waitFor(() => expect(xuat).toEqual(['?khoa_id=khoa-1&co_vang=true']));
    await waitFor(() => expect(URL.createObjectURL).toHaveBeenCalled());
  });

  it('bấm dòng -> drawer từng buổi: trạng thái, nhãn đổi buổi, buổi tương lai không có nút bổ sung', async () => {
    render(['/ho-tro/di-hoc?khoa_id=khoa-1']);
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Nguyễn Văn An' }));
    const dialog = await screen.findByRole('dialog');
    const b1 = await within(dialog).findByTestId('buoi-l-1');
    expect(within(b1).getByText('Vắng')).toBeInTheDocument();
    expect(within(b1).getByRole('button', { name: 'Điểm danh bổ sung' })).toBeInTheDocument();
    const doi = within(dialog).getByTestId('buoi-l-chot');
    expect(within(doi).getByText('Đổi buổi')).toBeInTheDocument();
    expect(within(doi).getByText('Từ lớp Zoom 01 sang lớp Zoom 02')).toBeInTheDocument();
    const tuongLai = within(dialog).getByTestId('buoi-l-3');
    expect(within(tuongLai).getByText('Chưa đến giờ')).toBeInTheDocument();
    expect(within(tuongLai).queryByRole('button', { name: 'Điểm danh bổ sung' })).not.toBeInTheDocument();
  });

  it('ADR 0012: buổi hiệu dụng là học bù -> badge "Học bù", không ghi "Từ lớp … sang lớp …"', async () => {
    const chot = tinhHinhDiHocMock.buoi.find((x) => x.lich_hoc_id === 'l-chot')!;
    chot.doi_buoi = { ...chot.doi_buoi!, hoc_bu: true };
    render(['/ho-tro/di-hoc?khoa_id=khoa-1']);
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Nguyễn Văn An' }));
    const dialog = await screen.findByRole('dialog');
    const doi = await within(dialog).findByTestId('buoi-l-chot');
    expect(within(doi).getByText('Học bù')).toBeInTheDocument();
    expect(within(doi).getByText('Học bù cho lớp Zoom 01 tại lớp Zoom 02')).toBeInTheDocument();
    expect(within(doi).queryByText('Đổi buổi')).not.toBeInTheDocument();
  });

  it('ADR 0010 T7: buổi có mặt nhờ học bù -> nhãn kèm lớp, badge "Lớp khác", lý do thay nút bổ sung', async () => {
    render(['/ho-tro/di-hoc?khoa_id=khoa-1']);
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Nguyễn Văn An' }));
    const hocBu = await within(await screen.findByRole('dialog')).findByTestId('buoi-l-4');
    const nhan = within(hocBu).getByText('Có mặt – ở lớp Trực tiếp 05');
    expect(nhan.closest('.mantine-Badge-root')?.getAttribute('style') ?? '').toContain('green');
    expect(within(hocBu).getByText('Lớp khác')).toBeInTheDocument();
    expect(within(hocBu).getByText('Đã có mặt ở lớp Trực tiếp 05 (học bù/lớp cũ)')).toBeInTheDocument();
    expect(within(hocBu).queryByRole('button', { name: 'Điểm danh bổ sung' })).not.toBeInTheDocument();
    // Buổi của lớp mình không có badge "Lớp khác".
    expect(within(screen.getByTestId('buoi-l-1')).queryByText('Lớp khác')).not.toBeInTheDocument();
  });

  it('modal bổ sung: chỉ Có mặt / Vắng có phép, bắt buộc lý do, gửi PUT rồi tải lại', async () => {
    render(['/ho-tro/di-hoc?khoa_id=khoa-1']);
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Nguyễn Văn An' }));
    const b1 = await screen.findByTestId('buoi-l-1');
    await user.click(within(b1).getByRole('button', { name: 'Điểm danh bổ sung' }));
    const modal = await screen.findByRole('dialog', { name: 'Điểm danh bổ sung' });
    expect(
      within(modal).getByText('Nếu Quản trị nạp lại file điểm danh của buổi này, kết quả bổ sung sẽ bị ghi đè.'),
    ).toBeInTheDocument();
    expect(within(modal).getByText('Có mặt')).toBeInTheDocument();
    expect(within(modal).getByText('Vắng có phép')).toBeInTheDocument();
    expect(within(modal).queryByText('Vắng')).not.toBeInTheDocument();

    await user.click(within(modal).getByRole('button', { name: 'Xác nhận' }));
    expect(await within(modal).findByText('Bắt buộc nhập lý do')).toBeInTheDocument();
    expect(tinhHinhDiHocMock.daGhi).toHaveLength(0);

    await user.type(within(modal).getByRole('textbox', { name: /Lý do/ }), 'Có ảnh chụp Zoom');
    await user.click(within(modal).getByRole('button', { name: 'Xác nhận' }));
    await waitFor(() =>
      expect(tinhHinhDiHocMock.daGhi).toEqual([
        {
          url: '/ho-tro-hoc-vien/di-hoc/dk-dh-0/diem-danh',
          body: { lich_hoc_id: 'l-1', trang_thai: 'co_mat', ly_do: 'Có ảnh chụp Zoom' },
        },
      ]),
    );
    const sau = await screen.findByTestId('buoi-l-1');
    expect(await within(sau).findByText('Có mặt (Thủ công)')).toBeInTheDocument();
    expect(within(sau).getByText(/Lý do: Có ảnh chụp Zoom/)).toBeInTheDocument();
  });
});

describe('Tình hình đi học — lọc phạm vi cụm / lớp (ADR 0011 P4)', () => {
  it('chọn "Lớp tôi hỗ trợ" -> pham_vi=lop trên URL và request; "Tất cả" bỏ tham số', async () => {
    const queries = ghiQueryDanhSach();
    const { router } = render(['/ho-tro/di-hoc?khoa_id=khoa-1']);
    await screen.findByRole('table');
    const user = userEvent.setup();
    expect(screen.getByRole('radio', { name: 'Cụm của tôi' })).toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: 'Lớp tôi hỗ trợ' }));
    await waitFor(() => expect(router.state.location.search).toContain('pham_vi=lop'));
    await waitFor(() => expect(cuoi(queries)?.get('pham_vi')).toBe('lop'));
    await user.click(screen.getByRole('radio', { name: 'Tất cả' }));
    await waitFor(() => expect(router.state.location.search).not.toContain('pham_vi'));
    await waitFor(() => expect(cuoi(queries)?.has('pham_vi')).toBe(false));
  });

  it('pham_vi trên URL được giữ khi tải lại; xuất Excel gửi kèm pham_vi', async () => {
    const xuat: URLSearchParams[] = [];
    server.events.on('request:start', ({ request }) => {
      const url = new URL(request.url);
      if (url.pathname === '/ho-tro-hoc-vien/di-hoc/xuat') xuat.push(url.searchParams);
    });
    render(['/ho-tro/di-hoc?khoa_id=khoa-1&pham_vi=cum']);
    await screen.findByRole('table');
    expect(screen.getByRole('radio', { name: 'Cụm của tôi' })).toBeChecked();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Xuất Excel' }));
    await waitFor(() => expect(cuoi(xuat)?.get('pham_vi')).toBe('cum'));
  });

  it('không có cụm -> ẩn "Cụm của tôi"; không có lớp -> ẩn "Lớp tôi hỗ trợ"', async () => {
    db.hoTroCum = [];
    render(['/ho-tro/di-hoc?khoa_id=khoa-1']);
    expect(await screen.findByRole('radio', { name: 'Lớp tôi hỗ trợ' })).toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: 'Cụm của tôi' })).not.toBeInTheDocument();
  });

  it('không có cụm lẫn lớp -> không hiện điều khiển phạm vi', async () => {
    db.hoTroCum = [];
    db.hoTroLop = [];
    render(['/ho-tro/di-hoc?khoa_id=khoa-1']);
    await screen.findByRole('table');
    await waitFor(() => expect(screen.queryByRole('radio', { name: 'Tất cả' })).not.toBeInTheDocument());
    expect(screen.queryByRole('radiogroup', { name: 'Phạm vi' })).not.toBeInTheDocument();
  });

  it('ô Lớp: lớp tôi hỗ trợ lên đầu (nhóm "Lớp tôi hỗ trợ"), còn lại ở "Lớp khác"', async () => {
    db.hoTroLop = [{ ...db.hoTroLop[0], lop_id: 'lop-zoom-2', ten_lop: 'Zoom 02' }];
    render(['/ho-tro/di-hoc?khoa_id=khoa-1']);
    await screen.findByRole('table');
    const user = userEvent.setup();
    await user.click(screen.getByRole('textbox', { name: 'Lớp' }));
    expect(await screen.findByText('Lớp tôi hỗ trợ', { selector: '[class*="groupLabel"]' })).toBeInTheDocument();
    expect(screen.getByText('Lớp khác', { selector: '[class*="groupLabel"]' })).toBeInTheDocument();
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['Zoom · Zoom 02', 'Zoom · Zoom 01']);
  });
});

describe('Tình hình đi học — Quản trị', () => {
  it('không có điều khiển phạm vi, không gửi pham_vi, không gọi API của người hỗ trợ', async () => {
    const goi: string[] = [];
    server.events.on('request:start', ({ request }) => goi.push(new URL(request.url).pathname));
    const queries = ghiQueryDanhSach('/thong-ke/di-hoc');
    render(['/admin/di-hoc?khoa_id=khoa-1&pham_vi=lop'], 'admin');
    await screen.findByRole('table');
    expect(screen.queryByRole('radio', { name: 'Lớp tôi hỗ trợ' })).not.toBeInTheDocument();
    expect(cuoi(queries)?.has('pham_vi')).toBe(false);
    expect(goi.some((p) => p.startsWith('/ho-tro-hoc-vien/'))).toBe(false);
  });

  it('gọi API /thong-ke/di-hoc; modal có thêm "Vắng", lý do không bắt buộc', async () => {
    render(['/admin/di-hoc?khoa_id=khoa-1'], 'admin');
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Nguyễn Văn An' }));
    const b = await screen.findByTestId('buoi-l-chot');
    await user.click(within(b).getByRole('button', { name: 'Điểm danh bổ sung' }));
    const modal = await screen.findByRole('dialog', { name: 'Điểm danh bổ sung' });
    await user.click(within(modal).getByText('Vắng'));
    await user.click(within(modal).getByRole('button', { name: 'Xác nhận' }));
    await waitFor(() =>
      expect(tinhHinhDiHocMock.daGhi).toEqual([
        { url: '/thong-ke/di-hoc/dk-dh-0/diem-danh', body: { lich_hoc_id: 'l-chot', trang_thai: 'vang' } },
      ]),
    );
  });
});
