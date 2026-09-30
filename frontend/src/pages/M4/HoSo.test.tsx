import { describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/mocks/server';
import { db } from '@/test/mocks/db';
import { renderVoiRouter } from '@/test/testUtils';
import { datToken } from '@/auth/tokenStore';
import HoSo from './HoSo';

const routes = [
  { path: '/toi/ho-so', element: <HoSo /> },
  { path: '/toi/xac-nhan', element: <div>Màn hình xác nhận</div> },
];

function renderDaDangNhap() {
  datToken('token-gia-lap');
  return renderVoiRouter(routes, { initialEntries: ['/toi/ho-so'] });
}

describe('M4 — Hồ sơ: xem & sửa', () => {
  it('trạng thái tải: hiện loader trong lúc chờ hồ sơ', () => {
    renderDaDangNhap();
    expect(document.querySelector('.mantine-Loader-root')).toBeInTheDocument();
  });

  it('lỗi API khi tải hồ sơ: hiện thông báo lỗi', async () => {
    server.use(http.get('/hoc-vien/toi', () => HttpResponse.error()));
    renderDaDangNhap();
    expect(await screen.findByText('Không kết nối được máy chủ. Kiểm tra mạng và thử lại.')).toBeInTheDocument();
  });

  it('tài khoản MOET mới: trường thiếu (theo muc-do-day-du) có nhãn "Cần bổ sung"', async () => {
    renderDaDangNhap();
    const oCccd = await screen.findByLabelText('Số CCCD');
    expect(oCccd.closest('.mantine-TextInput-root')).toHaveTextContent('Cần bổ sung');
  });

  it('đợt đóng (không có đợt đang mở) → mọi ô nhập không sửa được, không có nút Lưu', async () => {
    db.dotXacNhan.dot = null;
    renderDaDangNhap();
    const oHoTen = await screen.findByLabelText('Họ và tên');
    expect(oHoTen).toBeDisabled();
    expect(screen.getByLabelText('Số CCCD')).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Lưu' })).not.toBeInTheDocument();
  });

  it('nơi sinh là ô nhập tự do, gõ được giá trị bất kỳ (không giới hạn theo danh mục)', async () => {
    const user = userEvent.setup();
    renderDaDangNhap();
    const oNoiSinh = await screen.findByLabelText('Nơi sinh');
    await user.clear(oNoiSinh);
    await user.type(oNoiSinh, 'Xã Tân Bình, huyện Tân Biên, tỉnh Tây Ninh (cũ)');
    expect(oNoiSinh).toHaveValue('Xã Tân Bình, huyện Tân Biên, tỉnh Tây Ninh (cũ)');
  });

  it('đổi cư trú (tỉnh/thành) → danh sách phường/xã đổi theo, giá trị phường/xã cũ bị xóa', async () => {
    db.hoSo.cu_tru_tinh_id = 'tinh-2';
    db.hoSo.cu_tru_phuong_xa_id = 'phuong-2';
    db.hoSo.cu_tru_tinh_ten = 'Cần Thơ';
    db.hoSo.cu_tru_phuong_xa_ten = 'Phường Châu Đốc';
    const user = userEvent.setup();
    renderDaDangNhap();

    const oPhuongXa = (await screen.findByLabelText(/^Cư trú \(phường\/xã\)/, { selector: 'input' })) as HTMLInputElement;
    await waitFor(() => expect(oPhuongXa).toHaveValue('Phường Châu Đốc'));

    const oTinh = screen.getByLabelText(/^Cư trú \(tỉnh\/thành\)/, { selector: 'input' });
    await user.click(oTinh);
    await user.click(await screen.findByRole('option', { name: 'An Giang' }));

    await waitFor(() => expect(oPhuongXa).toHaveValue(''));
  });

  it('Cư trú (tỉnh/thành và phường/xã) chỉ tải địa danh HIỆN TẠI → gửi kèm ?phien_ban=hien_tai (các Select địa danh khác trên trang, vd lọc "Đơn vị công tác", KHÔNG bị ảnh hưởng)', async () => {
    db.hoSo.cu_tru_tinh_id = 'tinh-1';
    db.hoSo.cu_tru_phuong_xa_id = 'phuong-1';
    db.hoSo.cu_tru_tinh_ten = 'An Giang';
    db.hoSo.cu_tru_phuong_xa_ten = 'Phường Long Xuyên';
    const phienBanNhan: (string | null)[] = [];
    server.use(
      http.get('/danh-muc/dia-danh', ({ request }) => {
        const url = new URL(request.url);
        phienBanNhan.push(url.searchParams.get('phien_ban'));
        return HttpResponse.json({ data: [] });
      }),
    );
    renderDaDangNhap();

    // Trang còn Select địa danh khác (bộ lọc Tỉnh/thành trong "Đơn vị công tác", qua SelectDonVi) —
    // cố ý KHÔNG truyền phienBan, nên phải thấy CẢ 2 loại: có 'hien_tai' (Cư trú) và có null (nơi khác).
    await waitFor(() => expect(phienBanNhan.length).toBeGreaterThan(1));
    expect(phienBanNhan).toContain('hien_tai');
    expect(phienBanNhan).toContain(null);
  });

  it('nhập CCCD đã có người dùng → báo trùng ngay khi rời ô, không cần bấm Lưu', async () => {
    server.use(http.get('/hoc-vien/kiem-tra-trung', () => HttpResponse.json({ trung: true })));
    const user = userEvent.setup();
    renderDaDangNhap();

    const oCccd = await screen.findByLabelText('Số CCCD');
    await user.type(oCccd, '123456789012');
    await user.tab();

    expect(await screen.findByText('Số CCCD này đã được dùng cho một hồ sơ khác. Liên hệ hỗ trợ.')).toBeInTheDocument();
  });

  it('chỉ gửi các trường đã đổi khi Lưu (PATCH một phần)', async () => {
    db.hoSo.noi_sinh = 'Xã Long Xuyên, Tỉnh An Giang (cũ)';
    db.hoSo.so_dinh_danh_ca_nhan = '111111111111';
    db.hoSo.email_lien_he = 'a@vd.vn';
    db.hoSo.trinh_do_chuyen_mon = 'dai_hoc';
    db.hoSo.chuyen_mon = ['Tin học'];
    db.dotXacNhan.day_du = true;
    db.dotXacNhan.thieu = [];

    let thanPatch: Record<string, unknown> | null = null;
    server.use(
      http.patch('/hoc-vien/toi', async ({ request }) => {
        thanPatch = (await request.json()) as Record<string, unknown>;
        Object.assign(db.hoSo, thanPatch);
        return HttpResponse.json(db.hoSo);
      }),
    );

    const user = userEvent.setup();
    renderDaDangNhap();

    const oChucVu = await screen.findByLabelText('Chức vụ');
    await user.clear(oChucVu);
    await user.type(oChucVu, 'Tổ trưởng chuyên môn');

    await user.click(screen.getByRole('button', { name: 'Lưu' }));

    await waitFor(() => expect(thanPatch).not.toBeNull());
    expect(thanPatch).toEqual({ chuc_vu: 'Tổ trưởng chuyên môn' });
    expect(await screen.findByText('Đã lưu')).toBeInTheDocument();
  });

  it('thêm/xóa chuyên môn gọi ngay POST/DELETE, không đợi nút Lưu', async () => {
    db.dotXacNhan.day_du = true;
    db.dotXacNhan.thieu = [];
    let daGoiThem = false;
    server.use(
      http.post('/hoc-vien/toi/chuyen-mon', async ({ request }) => {
        const body = (await request.json()) as { chuyen_mon: string };
        daGoiThem = body.chuyen_mon === 'Tin học';
        return new HttpResponse(null, { status: 204 });
      }),
    );

    const user = userEvent.setup();
    renderDaDangNhap();

    const oChuyenMon = await screen.findByLabelText(/^Chuyên môn/, { selector: 'input' });
    await user.click(oChuyenMon);
    await user.type(oChuyenMon, 'Tin học{Enter}');

    await waitFor(() => expect(daGoiThem).toBe(true));
    // Chưa bấm Lưu — nút Lưu (nếu tồn tại) vẫn ở trạng thái không bắt buộc phải bấm cho riêng chuyên môn.
  });

  it('chưa có email_lien_he → không hiện badge trạng thái email', async () => {
    db.hoSo.email_lien_he = null;
    renderDaDangNhap();
    await screen.findByLabelText('Số CCCD');
    expect(screen.queryByText('Đã xác minh')).not.toBeInTheDocument();
    expect(screen.queryByText('Chưa xác minh')).not.toBeInTheDocument();
  });

  it('có email nhưng chưa xác minh → badge vàng "Chưa xác minh" + nút gửi lại xác minh', async () => {
    db.hoSo.email_lien_he = 'a@vd.vn';
    db.hoSo.email_da_xac_minh = false;
    renderDaDangNhap();

    expect(await screen.findByText('Chưa xác minh')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Gửi lại email xác minh' })).toBeInTheDocument();
  });

  it('email đã xác minh → badge xanh "Đã xác minh", KHÔNG có nút gửi lại', async () => {
    db.hoSo.email_lien_he = 'a@vd.vn';
    db.hoSo.email_da_xac_minh = true;
    renderDaDangNhap();

    expect(await screen.findByText('Đã xác minh')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Gửi lại email xác minh' })).not.toBeInTheDocument();
  });

  it('bấm "Gửi lại email xác minh" → gọi API, disable nút sau khi gửi thành công', async () => {
    db.hoSo.email_lien_he = 'a@vd.vn';
    db.hoSo.email_da_xac_minh = false;
    let daGoi = false;
    server.use(
      http.post('/hoc-vien/toi/gui-lai-xac-minh-email', () => {
        daGoi = true;
        return HttpResponse.json({ da_gui: true });
      }),
    );
    const user = userEvent.setup();
    renderDaDangNhap();

    const nutGuiLai = await screen.findByRole('button', { name: 'Gửi lại email xác minh' });
    await user.click(nutGuiLai);

    await waitFor(() => expect(daGoi).toBe(true));
    expect(await screen.findByText('Đã gửi lại email xác minh, vui lòng kiểm tra hộp thư.')).toBeInTheDocument();
    await waitFor(() => expect(nutGuiLai).toBeDisabled());
  });

  it('nhập họ tên toàn ASCII 2+ từ → hiện cảnh báo có thể thiếu dấu tiếng Việt', async () => {
    const user = userEvent.setup();
    renderDaDangNhap();
    const oHoTen = await screen.findByLabelText('Họ và tên');
    await user.clear(oHoTen);
    await user.type(oHoTen, 'Nguyen Van An');
    expect(await screen.findByText(/Họ tên có thể đang thiếu dấu tiếng Việt/)).toBeInTheDocument();
  });

  it('họ tên có dấu tiếng Việt đầy đủ → không hiện cảnh báo thiếu dấu', async () => {
    const user = userEvent.setup();
    renderDaDangNhap();
    const oHoTen = await screen.findByLabelText('Họ và tên');
    await user.clear(oHoTen);
    await user.type(oHoTen, 'Nguyễn Văn An');
    expect(screen.queryByText(/Họ tên có thể đang thiếu dấu tiếng Việt/)).not.toBeInTheDocument();
  });

  it('nhập tên có từ cuối là họ phổ biến nhưng từ đầu không phải → hiện cảnh báo đảo ngược, bấm nút gợi ý đổi đúng thứ tự', async () => {
    const user = userEvent.setup();
    renderDaDangNhap();
    const oHoTen = await screen.findByLabelText('Họ và tên');
    await user.clear(oHoTen);
    await user.type(oHoTen, 'Văn An Nguyễn');
    expect(await screen.findByText(/Họ tên có thể bị đảo ngược thứ tự Họ và Tên/)).toBeInTheDocument();

    const nutGoiY = screen.getByRole('button', { name: 'Dùng dạng gợi ý: Nguyễn Văn An' });
    await user.click(nutGoiY);
    expect(oHoTen).toHaveValue('Nguyễn Văn An');
  });

  it('response có xac_nhan_bi_huy:true → hộp thoại yêu cầu xác nhận lại, có nút Xác nhận lại', async () => {
    db.dotXacNhan.day_du = true;
    db.dotXacNhan.thieu = [];
    server.use(
      http.patch('/hoc-vien/toi', async ({ request }) => {
        const patch = (await request.json()) as Record<string, unknown>;
        Object.assign(db.hoSo, patch);
        return HttpResponse.json({ ...db.hoSo, xac_nhan_bi_huy: true });
      }),
    );

    const user = userEvent.setup();
    renderDaDangNhap();

    const oChucVu = await screen.findByLabelText('Chức vụ');
    await user.clear(oChucVu);
    await user.type(oChucVu, 'Hiệu phó');
    await user.click(screen.getByRole('button', { name: 'Lưu' }));

    const hopThoai = await screen.findByRole('dialog');
    expect(within(hopThoai).getByText(/Vui lòng xác nhận lại/)).toBeInTheDocument();
    await user.click(within(hopThoai).getByRole('button', { name: 'Xác nhận lại' }));
    expect(await screen.findByText('Màn hình xác nhận')).toBeInTheDocument();
  });
});
