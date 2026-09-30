import { describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/mocks/server';
import { renderVoiRouter } from '@/test/testUtils';
import { datToken } from '@/auth/tokenStore';
import { db } from '@/test/mocks/db';
import AdminTongQuan from './AdminTongQuan';

function renderTrang() {
  datToken('token-gia-lap');
  return renderVoiRouter(
    [
      { path: '/admin/tong-quan', element: <AdminTongQuan /> },
      { path: '/admin/hoc-vien', element: <div>Màn hình danh sách học viên</div> },
    ],
    { initialEntries: ['/admin/tong-quan'] },
  );
}

describe('Admin — Tổng quan', () => {
  it('trạng thái tải: hiện skeleton trong lúc chờ API', () => {
    renderTrang();
    expect(screen.getByText('Tổng học viên')).toBeInTheDocument();
    expect(document.querySelectorAll('.mantine-Skeleton-root').length).toBeGreaterThan(0);
  });

  it('lỗi API: hiện thông báo lỗi thay vì màn trắng', async () => {
    server.use(http.get('/hoc-vien', () => HttpResponse.error()));
    renderTrang();
    expect((await screen.findAllByText('Không tải được')).length).toBe(2); // Tổng học viên + Hồ sơ chờ duyệt
    expect(await screen.findByText('Không kết nối được máy chủ. Kiểm tra mạng và thử lại.')).toBeInTheDocument();
  });

  it('có dữ liệu: hiện đúng 3 KPI thật + bảng hồ sơ chờ duyệt gần nhất', async () => {
    renderTrang();

    // Scope theo testid: trang có nhiều KPI/chú thích biểu đồ khác cũng có thể hiện số "3".
    expect(await within(screen.getByTestId('kpi-tong-hoc-vien')).findByText('3')).toBeInTheDocument(); // fixture: 3 hồ sơ
    expect(await screen.findByText('Lê Văn Bình')).toBeInTheDocument();
    expect(screen.getByText('Phạm Thu Hà')).toBeInTheDocument();
    // Hồ sơ đã duyệt không xuất hiện trong bảng "chờ duyệt gần nhất"
    expect(screen.queryByText('Võ Minh Khôi')).not.toBeInTheDocument();
    expect(screen.getAllByText('Chờ duyệt').length).toBeGreaterThan(0);
  });

  it('link "Xem tất cả" trỏ đúng sang /admin/hoc-vien?trang_thai=cho_duyet', async () => {
    renderTrang();
    const link = await screen.findByRole('link', { name: 'Xem tất cả →' });
    expect(link).toHaveAttribute('href', '/admin/hoc-vien?trang_thai=cho_duyet');
  });

  it('không có hồ sơ chờ duyệt → hiện thông báo trống, không phải bảng rỗng', async () => {
    server.use(http.get('/hoc-vien', () => HttpResponse.json({ data: [], total: 0, page: 1, page_size: 20 })));
    renderTrang();
    expect(await screen.findByText('Không có hồ sơ nào đang chờ duyệt.')).toBeInTheDocument();
  });
});

// Khối mở rộng (thêm 2026-09-30) — GET /bao-cao/tong-quan, bộ lọc riêng (không đụng 3 KPI cũ ở trên).
describe('Admin — Tổng quan mở rộng (bộ lọc + biểu đồ)', () => {
  it('hiện đủ 3 KPI mới lấy đúng số thật từ API (không bịa)', async () => {
    renderTrang();
    const khoi = within(await screen.findByTestId('khoi-tong-quan-mo-rong'));
    expect(await khoi.findByText('Học viên tham gia')).toBeInTheDocument();
    expect(khoi.getByText('Đã đăng nhập')).toBeInTheDocument();
    expect(khoi.getByText('Đã chỉnh sửa hồ sơ')).toBeInTheDocument();
    // Fixture taoBaoCaoTongQuanMau(): tong_hoc_vien_tham_gia=10, da_dang_nhap=7, da_chinh_sua_ho_so=4.
    // Scope theo testid từng ô KPI — trang còn có chú thích biểu đồ (donut/bar) cũng hiện số trùng.
    expect(await within(screen.getByTestId('kpi-hoc-vien-tham-gia')).findByText('10')).toBeInTheDocument();
    expect(within(screen.getByTestId('kpi-da-dang-nhap')).getByText('7')).toBeInTheDocument();
    expect(within(screen.getByTestId('kpi-da-chinh-sua-ho-so')).getByText('4')).toBeInTheDocument();
    // % trên tổng tham gia: 7/10=70%, 4/10=40%.
    expect(khoi.getByText('70% trên tổng tham gia')).toBeInTheDocument();
    expect(khoi.getByText('40% trên tổng tham gia')).toBeInTheDocument();
  });

  it('đổi bộ lọc "Từ ngày" gọi lại GET /bao-cao/tong-quan với đúng tham số', async () => {
    let thamSoCuoi: URLSearchParams | undefined;
    server.use(
      http.get('/bao-cao/tong-quan', ({ request }) => {
        thamSoCuoi = new URL(request.url).searchParams;
        return HttpResponse.json(db.baoCaoTongQuan);
      }),
    );
    const user = userEvent.setup();
    renderTrang();
    const khoi = within(await screen.findByTestId('khoi-tong-quan-mo-rong'));
    await user.type(khoi.getByLabelText('Từ ngày'), '2026-01-15');
    await waitFor(() => expect(thamSoCuoi?.get('tu_ngay')).toBe('2026-01-15'));
  });

  it('nút "Xuất Excel" gọi đúng endpoint /bao-cao/tong-quan/xuat-excel với đúng bộ lọc', async () => {
    let thamSoCuoi: URLSearchParams | undefined;
    server.use(
      http.get('/bao-cao/tong-quan/xuat-excel', ({ request }) => {
        thamSoCuoi = new URL(request.url).searchParams;
        return new HttpResponse('noi-dung-file-mo-phong', {
          headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
        });
      }),
    );
    const user = userEvent.setup();
    renderTrang();
    const khoi = within(await screen.findByTestId('khoi-tong-quan-mo-rong'));
    await user.type(khoi.getByLabelText('Từ ngày'), '2026-01-15');
    await user.click(khoi.getByTestId('nut-xuat-excel-tong-quan'));
    await waitFor(() => expect(thamSoCuoi?.get('tu_ngay')).toBe('2026-01-15'));
  });

  it('hiện "Chưa có dữ liệu" thay vì biểu đồ rỗng khi số liệu bằng 0', async () => {
    server.use(
      http.get('/bao-cao/tong-quan', () =>
        HttpResponse.json({
          tong_hoc_vien_tham_gia: 5,
          da_dang_nhap: 2,
          da_chinh_sua_ho_so: 1,
          khao_sat: {
            dau_vao: { da_lam: 0, co_ban: 0, thanh_thao: 0, nang_cao: 0 },
            dau_ra: { da_lam: 0, co_ban: 0, thanh_thao: 0, nang_cao: 0 },
          },
          ket_qua_theo_hinh_thuc: [
            { loai_lop: 'truc_tiep', dang_hoc: 0, dat: 0, khong_dat: 0, vang: 0 },
            { loai_lop: 'zoom', dang_hoc: 0, dat: 0, khong_dat: 0, vang: 0 },
            { loai_lop: 'vle', dang_hoc: 0, dat: 0, khong_dat: 0, vang: 0 },
          ],
        }),
      ),
    );
    renderTrang();
    const khoi = within(await screen.findByTestId('khoi-tong-quan-mo-rong'));
    // 2 khối khảo sát (đầu vào + đầu ra) + 1 khối kết quả theo hình thức = 3 chỗ hiện "Chưa có dữ liệu".
    expect(await khoi.findAllByText('Chưa có dữ liệu')).toHaveLength(3);
  });

  it('lỗi API tổng quan: hiện thông báo lỗi thay vì màn trắng', async () => {
    server.use(http.get('/bao-cao/tong-quan', () => HttpResponse.error()));
    renderTrang();
    const khoi = within(await screen.findByTestId('khoi-tong-quan-mo-rong'));
    expect(await khoi.findByText('Không kết nối được máy chủ. Kiểm tra mạng và thử lại.')).toBeInTheDocument();
  });
});
