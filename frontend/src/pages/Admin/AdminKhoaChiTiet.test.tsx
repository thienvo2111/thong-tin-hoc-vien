import { describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/mocks/server';
import { db } from '@/test/mocks/db';
import { renderVoiRouter } from '@/test/testUtils';
import { datToken } from '@/auth/tokenStore';
import AdminKhoaChiTiet from './AdminKhoaChiTiet';

function renderTrang(id: string) {
  datToken('token-gia-lap');
  return renderVoiRouter([{ path: '/admin/khoa-boi-duong/:id', element: <AdminKhoaChiTiet /> }], {
    initialEntries: [`/admin/khoa-boi-duong/${id}`],
  });
}

describe('Admin — Chi tiết khóa bồi dưỡng', () => {
  it('trạng thái tải: hiện skeleton trong lúc chờ API', () => {
    renderTrang('khoa-1');
    expect(document.querySelectorAll('.mantine-Skeleton-root').length).toBeGreaterThan(0);
  });

  it('lỗi API (không tìm thấy khóa): hiện thông báo lỗi', async () => {
    renderTrang('khoa-khong-ton-tai');
    expect(await screen.findByText('Không tìm thấy khóa bồi dưỡng')).toBeInTheDocument();
  });

  it('có dữ liệu: hiện tên khóa, badge trạng thái, danh sách lớp học', async () => {
    renderTrang('khoa-1');
    expect(await screen.findByText('Bồi dưỡng NLS – Mức cơ bản')).toBeInTheDocument();
    expect(screen.getByText('Chờ duyệt')).toBeInTheDocument();
    expect(screen.getByText('Lớp 01 – Nhóm cơ bản A')).toBeInTheDocument();
    expect(screen.getByText('Nguyễn Văn Long')).toBeInTheDocument();
  });

  it('khóa chưa có lớp học → hiện thông báo trống thay vì bảng rỗng im lặng', async () => {
    renderTrang('khoa-2');
    await screen.findByText('Bồi dưỡng NLS – Mức thành thạo');
    expect(screen.getByText('Khóa chưa có lớp học nào.')).toBeInTheDocument();
  });

  it('trang_thai=nhap + vai_tro=truong → hiện nút Nộp duyệt, không hiện nút Duyệt', async () => {
    db.nguoiDung.vai_tro = 'truong';
    renderTrang('khoa-2');
    await screen.findByText('Bồi dưỡng NLS – Mức thành thạo');
    expect(screen.getByRole('button', { name: 'Nộp duyệt' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '✓ Duyệt khóa' })).not.toBeInTheDocument();
  });

  it('trang_thai=cho_duyet + vai_tro=so_gddt → hiện nút Duyệt/Từ chối, click Duyệt gọi API duyệt', async () => {
    db.nguoiDung.vai_tro = 'so_gddt';
    const user = userEvent.setup();
    renderTrang('khoa-1');
    await screen.findByText('Bồi dưỡng NLS – Mức cơ bản');

    expect(screen.getByRole('button', { name: '✓ Duyệt khóa' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Từ chối' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '✓ Duyệt khóa' }));
    expect(await screen.findByText('Đã duyệt')).toBeInTheDocument();
  });

  it('trang_thai=cho_duyet + vai_tro=truong → không hiện nút Duyệt (không đúng vai trò được duyệt)', async () => {
    db.nguoiDung.vai_tro = 'truong';
    renderTrang('khoa-1');
    await screen.findByText('Bồi dưỡng NLS – Mức cơ bản');
    expect(screen.queryByRole('button', { name: '✓ Duyệt khóa' })).not.toBeInTheDocument();
  });

  it('lỗi khi nộp duyệt: hiện thông báo lỗi qua notification', async () => {
    server.use(http.post('/khoa-boi-duong/:id/nop-duyet', () => HttpResponse.error()));
    db.nguoiDung.vai_tro = 'truong';
    const user = userEvent.setup();
    renderTrang('khoa-2');
    await screen.findByText('Bồi dưỡng NLS – Mức thành thạo');

    await user.click(screen.getByRole('button', { name: 'Nộp duyệt' }));
    expect(await screen.findByText('Không kết nối được máy chủ. Kiểm tra mạng và thử lại.')).toBeInTheDocument();
  });

  it('vai_tro=hoc_vien → không hiện nút "+ Tạo lớp mới" (không đúng quyền)', async () => {
    db.nguoiDung.vai_tro = 'hoc_vien';
    renderTrang('khoa-1');
    await screen.findByText('Bồi dưỡng NLS – Mức cơ bản');
    expect(screen.queryByRole('button', { name: '+ Tạo lớp mới' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Sửa' })).not.toBeInTheDocument();
  });

  it('vai_tro=truong → không hiện tab "Đơn vị theo dõi" (chỉ quan_tri)', async () => {
    db.nguoiDung.vai_tro = 'truong';
    renderTrang('khoa-1');
    await screen.findByText('Bồi dưỡng NLS – Mức cơ bản');
    expect(screen.queryByRole('tab', { name: 'Đơn vị theo dõi' })).not.toBeInTheDocument();
  });

  it('tạo lớp mới (Trường): điền form hợp lệ → gọi API, hiện lớp mới trong bảng', async () => {
    db.nguoiDung.vai_tro = 'truong';
    const user = userEvent.setup();
    renderTrang('khoa-1');
    await screen.findByText('Bồi dưỡng NLS – Mức cơ bản');

    await user.click(screen.getByRole('button', { name: '+ Tạo lớp mới' }));
    await user.type(await screen.findByLabelText(/^Tên lớp/), 'Lớp 02 – Nhóm cơ bản B');
    // getByRole('textbox', ...) thay vì getByLabelText: dropdown (role=listbox) của Select cũng mang
    // aria-labelledby trỏ tới đúng label này — getByLabelText khớp cả 2, gây lỗi "multiple elements"
    // (cùng quy ước đã ghi trong AdminHocVienChiTiet.test.tsx).
    await user.click(screen.getByRole('textbox', { name: /^Loại lớp/ }));
    await user.click(await screen.findByRole('option', { name: 'Trực tiếp' }));
    await user.click(screen.getByRole('button', { name: 'Tạo lớp' }));

    expect(await screen.findByText('Lớp 02 – Nhóm cơ bản B')).toBeInTheDocument();
  });

  it('tạo lớp trùng tên trong cùng loại lớp → hiện lỗi field ten_lop, không đóng modal', async () => {
    db.nguoiDung.vai_tro = 'truong';
    const user = userEvent.setup();
    renderTrang('khoa-1');
    await screen.findByText('Bồi dưỡng NLS – Mức cơ bản');

    await user.click(screen.getByRole('button', { name: '+ Tạo lớp mới' }));
    await user.type(await screen.findByLabelText(/^Tên lớp/), 'Lớp 01 – Nhóm cơ bản A');
    await user.click(screen.getByRole('textbox', { name: /^Loại lớp/ }));
    await user.click(await screen.findByRole('option', { name: 'Trực tiếp' }));
    await user.click(screen.getByRole('button', { name: 'Tạo lớp' }));

    expect(await screen.findByText('Đã tồn tại')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tạo lớp' })).toBeInTheDocument();
  });

  it('sửa lớp: đổi tên + đặt nhóm học viên/mức năng lực → lưu thành công, hiện bảng đã cập nhật', async () => {
    db.nguoiDung.vai_tro = 'truong';
    const user = userEvent.setup();
    renderTrang('khoa-1');
    await screen.findByText('Lớp 01 – Nhóm cơ bản A');

    const dong = screen.getByText('Lớp 01 – Nhóm cơ bản A').closest('tr');
    expect(dong).not.toBeNull();
    await user.click(within(dong as HTMLElement).getByRole('button', { name: 'Sửa' }));

    const oTenLop = await screen.findByLabelText(/^Tên lớp/);
    await user.clear(oTenLop);
    await user.type(oTenLop, 'Lớp 01 – Đổi tên');
    await user.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));

    expect(await screen.findByText('Lớp 01 – Đổi tên')).toBeInTheDocument();
  });

  it('vô hiệu hóa lớp: xác nhận → badge chuyển "Đã vô hiệu hóa", nút đổi thành "Kích hoạt lại"', async () => {
    db.nguoiDung.vai_tro = 'truong';
    const user = userEvent.setup();
    renderTrang('khoa-1');
    await screen.findByText('Lớp 01 – Nhóm cơ bản A');

    const dong = screen.getByText('Lớp 01 – Nhóm cơ bản A').closest('tr') as HTMLElement;
    await user.click(within(dong).getByRole('button', { name: 'Vô hiệu hóa' }));
    await user.click(await screen.findByRole('button', { name: 'Xác nhận' }));

    expect(await screen.findByText('Đã vô hiệu hóa')).toBeInTheDocument();
    const dongSauKhi = screen.getByText('Lớp 01 – Nhóm cơ bản A').closest('tr') as HTMLElement;
    expect(within(dongSauKhi).getByRole('button', { name: 'Kích hoạt lại' })).toBeInTheDocument();
  });

  it('xem chi tiết lớp: mở rộng dòng → hiện nhân sự + thêm nhân sự mới thành công', async () => {
    db.nguoiDung.vai_tro = 'truong';
    const user = userEvent.setup();
    renderTrang('khoa-1');
    await screen.findByText('Lớp 01 – Nhóm cơ bản A');

    const dong = screen.getByText('Lớp 01 – Nhóm cơ bản A').closest('tr') as HTMLElement;
    await user.click(within(dong).getByRole('button', { name: 'Xem chi tiết ▾' }));
    expect(await screen.findByText('Nguyễn Văn Long — Giảng viên')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '+ Thêm nhân sự' }));
    await user.type(await screen.findByLabelText(/^Họ tên/), 'Trần Thị Mai');
    await user.click(screen.getByRole('textbox', { name: /^Vai trò/ }));
    await user.click(await screen.findByRole('option', { name: 'Hỗ trợ' }));
    await user.click(screen.getByRole('button', { name: 'Thêm nhân sự' }));

    expect(await screen.findByText('Trần Thị Mai — Hỗ trợ')).toBeInTheDocument();
  });

  it('tạo giai đoạn mới: điền form hợp lệ → gọi API, hiện trong bảng Giai đoạn', async () => {
    db.nguoiDung.vai_tro = 'truong';
    const user = userEvent.setup();
    renderTrang('khoa-1');
    await screen.findByText('Bồi dưỡng NLS – Mức cơ bản');

    await user.click(screen.getByRole('tab', { name: 'Giai đoạn' }));
    await user.click(screen.getByRole('button', { name: '+ Tạo giai đoạn' }));

    // khoa-1 (mock) đã có GĐ1..GĐ4 (phân lớp theo giai đoạn) -> tạo GĐ5 để không trùng thứ tự.
    await user.type(await screen.findByLabelText(/^Thứ tự/), '5');
    await user.type(screen.getByLabelText(/^Tên giai đoạn/), 'Giai đoạn 5 — Tập trung');
    await user.click(screen.getByRole('textbox', { name: /^Hình thức/ }));
    await user.click(await screen.findByRole('option', { name: 'Trực tiếp' }));
    await user.type(screen.getByLabelText(/^Ngày bắt đầu/), '2026-10-05');
    await user.type(screen.getByLabelText(/^Ngày kết thúc/), '2026-10-10');
    await user.click(screen.getByRole('button', { name: 'Tạo giai đoạn' }));

    expect(await screen.findByText('Giai đoạn 5 — Tập trung')).toBeInTheDocument();
  });

  it('tạo cụm hỗ trợ Zalo mới: điền form hợp lệ → gọi API, hiện trong bảng Cụm', async () => {
    db.nguoiDung.vai_tro = 'truong';
    const user = userEvent.setup();
    renderTrang('khoa-1');
    await screen.findByText('Bồi dưỡng NLS – Mức cơ bản');

    await user.click(screen.getByRole('tab', { name: 'Cụm hỗ trợ Zalo' }));
    expect(await screen.findByText('Cụm Long Xuyên')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '+ Tạo cụm' }));
    await user.type(await screen.findByLabelText(/^Tên cụm/), 'Cụm Châu Đốc');
    await user.click(screen.getByRole('button', { name: 'Tạo cụm' }));

    expect(await screen.findByText('Cụm Châu Đốc')).toBeInTheDocument();
  });

  it('vai_tro=quan_tri: thêm đơn vị theo dõi → hiện trong danh sách phiên làm việc, gỡ lại thành công', async () => {
    db.nguoiDung.vai_tro = 'quan_tri';
    const user = userEvent.setup();
    renderTrang('khoa-1');
    await screen.findByText('Bồi dưỡng NLS – Mức cơ bản');

    await user.click(screen.getByRole('tab', { name: 'Đơn vị theo dõi' }));
    await user.click(screen.getByRole('button', { name: '+ Thêm đơn vị theo dõi' }));
    await user.click(await screen.findByRole('textbox', { name: /^Đơn vị/ }));
    await user.click(await screen.findByRole('option', { name: 'THPT Châu Đốc' }));
    await user.click(screen.getByRole('button', { name: 'Thêm' }));

    expect(await screen.findByText('THPT Châu Đốc')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Gỡ' }));
    await user.click(await screen.findByRole('button', { name: 'Xác nhận' }));

    expect(await screen.findByText('Chưa thêm đơn vị theo dõi nào trong phiên này.')).toBeInTheDocument();
  });
});

describe('Admin — Chi tiết khóa: Import Excel trong tab Lớp học', () => {
  // Ghi lại URL rồi trả undefined để MSW chạy tiếp handler mặc định (handlers.ts).
  function ghiLaiUrl(method: 'get' | 'post', path: string, urls: string[]) {
    server.use(
      http[method](path, ({ request }) => {
        urls.push(request.url);
        return undefined;
      }),
    );
  }

  async function moModalVaTaiLen(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole('button', { name: '⇪ Import Excel' }));
    const modal = await screen.findByRole('dialog', { name: 'Import lớp học từ Excel' });
    const oFile = modal.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(oFile, new File(['x'], 'lop.xlsx'));
    await user.click(within(modal).getByRole('button', { name: 'Tải lên & kiểm tra' }));
    return modal;
  }

  it('vai_tro=truong → không hiện nút Import Excel (API import chỉ dành cho quan_tri)', async () => {
    db.nguoiDung.vai_tro = 'truong';
    renderTrang('khoa-1');
    await screen.findByText('Bồi dưỡng NLS – Mức cơ bản');
    expect(screen.getByRole('button', { name: '+ Tạo lớp mới' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '⇪ Import Excel' })).not.toBeInTheDocument();
  });

  it('quan_tri: tải lên lớp & lịch học gửi kèm ?ma_khoa của khóa đang xem, hiện kết quả kiểm tra', async () => {
    db.nguoiDung.vai_tro = 'quan_tri';
    const urls: string[] = [];
    ghiLaiUrl('post', '/import/:loai', urls);
    const user = userEvent.setup();
    renderTrang('khoa-1');
    await screen.findByText('Bồi dưỡng NLS – Mức cơ bản');

    await moModalVaTaiLen(user);

    expect(await screen.findByText('Kết quả kiểm tra')).toBeInTheDocument();
    expect(urls).toHaveLength(1);
    const url = new URL(urls[0]);
    expect(url.pathname).toBe('/import/lop_va_lich_hoc');
    expect(url.searchParams.get('ma_khoa')).toBe('AG-2026-014');
  });

  it('quan_tri: chọn "Nhân sự lớp" → gửi tới /import/nhan_su_lop?ma_khoa=...', async () => {
    db.nguoiDung.vai_tro = 'quan_tri';
    const urls: string[] = [];
    ghiLaiUrl('post', '/import/:loai', urls);
    const user = userEvent.setup();
    renderTrang('khoa-1');
    await screen.findByText('Bồi dưỡng NLS – Mức cơ bản');

    await user.click(screen.getByRole('button', { name: '⇪ Import Excel' }));
    const modal = await screen.findByRole('dialog', { name: 'Import lớp học từ Excel' });
    await user.click(within(modal).getByText('Nhân sự lớp'));
    expect(within(modal).getByText(/Lớp phải được tạo trước/)).toBeInTheDocument();
    await user.upload(modal.querySelector('input[type="file"]') as HTMLInputElement, new File(['x'], 'ns.xlsx'));
    await user.click(within(modal).getByRole('button', { name: 'Tải lên & kiểm tra' }));

    await screen.findByText('Kết quả kiểm tra');
    const url = new URL(urls[0]);
    expect(url.pathname).toBe('/import/nhan_su_lop');
    expect(url.searchParams.get('ma_khoa')).toBe('AG-2026-014');
  });

  it('quan_tri: xác nhận nạp → đóng modal và tải lại chi tiết khóa', async () => {
    db.nguoiDung.vai_tro = 'quan_tri';
    const urlsChiTiet: string[] = [];
    ghiLaiUrl('get', '/khoa-boi-duong/:id', urlsChiTiet);
    const user = userEvent.setup();
    renderTrang('khoa-1');
    await screen.findByText('Bồi dưỡng NLS – Mức cơ bản');
    const soLanTruoc = urlsChiTiet.length;

    await moModalVaTaiLen(user);
    await user.click(await screen.findByRole('button', { name: 'Xác nhận nạp dữ liệu' }));

    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Import lớp học từ Excel' })).not.toBeInTheDocument());
    await waitFor(() => expect(urlsChiTiet.length).toBeGreaterThan(soLanTruoc));
  });
});
