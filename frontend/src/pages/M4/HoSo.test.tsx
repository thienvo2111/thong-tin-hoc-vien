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

  it('nơi sinh là 3 ô nhập tự do (Tỉnh/Huyện/Xã), gõ được giá trị bất kỳ (không giới hạn theo danh mục)', async () => {
    const user = userEvent.setup();
    renderDaDangNhap();
    const oTinh = await screen.findByLabelText('Tỉnh/Thành nơi sinh');
    const oHuyen = screen.getByLabelText('Quận/Huyện nơi sinh');
    const oXa = screen.getByLabelText('Phường/Xã nơi sinh');
    await user.type(oTinh, 'Tây Ninh (cũ)');
    await user.type(oHuyen, 'Tân Biên');
    await user.type(oXa, 'Tân Bình');
    expect(oTinh).toHaveValue('Tây Ninh (cũ)');
    expect(oHuyen).toHaveValue('Tân Biên');
    expect(oXa).toHaveValue('Tân Bình');
  });

  it('để trống cả 3 ô nơi sinh → không có lỗi validate chặn, mục lục "Nơi sinh" không hiện chấm đỏ "cần bổ sung"', async () => {
    const user = userEvent.setup();
    renderDaDangNhap();

    const mucLucNoiSinh = await screen.findByRole('link', { name: 'Nơi sinh' });
    expect(mucLucNoiSinh.querySelector('[aria-hidden]')).not.toBeInTheDocument();

    const oChucVu = screen.getByLabelText('Chức vụ');
    await user.clear(oChucVu);
    await user.type(oChucVu, 'Tổ trưởng chuyên môn');

    expect(screen.getByLabelText('Tỉnh/Thành nơi sinh')).toHaveValue('');
    expect(screen.getByLabelText('Quận/Huyện nơi sinh')).toHaveValue('');
    expect(screen.getByLabelText('Phường/Xã nơi sinh')).toHaveValue('');
    expect(screen.getByRole('button', { name: 'Lưu' })).toBeEnabled();
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

  it('Cư trú (tỉnh/thành và phường/xã) chỉ tải địa danh HIỆN TẠI → gửi kèm ?phien_ban=hien_tai (Select địa danh phụ trong "Đơn vị công tác" (SelectDonVi) cũng vậy — tránh nhầm địa danh lịch sử trùng tên, xem SelectDonVi.tsx)', async () => {
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

    // Cư trú VÀ bộ lọc Tỉnh/thành+Phường/xã trong "Đơn vị công tác" (SelectDonVi) đều phải lọc
    // phien_ban=hien_tai — không còn request nào thiếu phien_ban cho 2 cấp này.
    await waitFor(() => expect(phienBanNhan.length).toBeGreaterThan(1));
    expect(phienBanNhan.every((v) => v === 'hien_tai')).toBe(true);
  });

  it('nhập SĐT sai định dạng rồi rời ô (blur) → lỗi hiện ngay, không cần bấm Lưu trước', async () => {
    const user = userEvent.setup();
    renderDaDangNhap();

    const oSdt = await screen.findByLabelText('Số điện thoại');
    await user.clear(oSdt);
    await user.type(oSdt, '123');
    await user.tab();

    expect(await screen.findByText(/Số điện thoại phải gồm đúng 10 chữ số/)).toBeInTheDocument();
  });

  it('email domain có khả năng gõ nhầm (gmai.com) → hiện cảnh báo gợi ý, bấm nút để đổi đúng domain', async () => {
    const user = userEvent.setup();
    renderDaDangNhap();

    const oEmail = await screen.findByLabelText('Email');
    await user.clear(oEmail);
    await user.type(oEmail, 'abc@gmai.com');

    expect(await screen.findByText('🟡 Có phải Thầy/Cô muốn nhập "abc@gmail.com"?')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Dùng gợi ý này' }));
    expect(oEmail).toHaveValue('abc@gmail.com');
  });

  it('email domain đã đúng (gmail.com) → không hiện cảnh báo gợi ý domain', async () => {
    const user = userEvent.setup();
    renderDaDangNhap();

    const oEmail = await screen.findByLabelText('Email');
    await user.clear(oEmail);
    await user.type(oEmail, 'abc@gmail.com');

    expect(screen.queryByText(/Có phải Thầy\/Cô muốn nhập/)).not.toBeInTheDocument();
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
    db.hoSo.noi_sinh_xa = 'Xã Long Xuyên';
    db.hoSo.noi_sinh_tinh = 'An Giang (cũ)';
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

  describe('Đối tượng (GV/CBQL, 2026-10-02)', () => {
    function hoSoDuNgoaiDoiTuong() {
      db.hoSo.noi_sinh_xa = 'Xã Long Xuyên';
      db.hoSo.so_dinh_danh_ca_nhan = '111111111111';
      db.hoSo.email_lien_he = 'a@vd.vn';
      db.hoSo.trinh_do_chuyen_mon = 'dai_hoc';
      db.hoSo.chuyen_mon = ['Tin học'];
    }

    it('chọn "Cán bộ quản lý" rồi Lưu -> PATCH chỉ gửi doi_tuong', async () => {
      hoSoDuNgoaiDoiTuong();
      db.hoSo.doi_tuong = null;
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

      const cbql = await screen.findByRole('radio', { name: 'Cán bộ quản lý' });
      expect(cbql).not.toBeChecked();
      expect(screen.getByRole('radio', { name: 'Giáo viên' })).not.toBeChecked();
      await user.click(cbql);
      await user.click(screen.getByRole('button', { name: 'Lưu' }));

      await waitFor(() => expect(thanPatch).not.toBeNull());
      expect(thanPatch).toEqual({ doi_tuong: 'can_bo_quan_ly' });
    });

    it('hồ sơ đã có đối tượng -> radio tương ứng được chọn sẵn', async () => {
      db.hoSo.doi_tuong = 'giao_vien';
      renderDaDangNhap();
      expect(await screen.findByRole('radio', { name: 'Giáo viên' })).toBeChecked();
    });

    it('bổ sung dần: chưa chọn đối tượng vẫn lưu được trường khác; backend báo thiếu -> ô Đối tượng hiện "Cần bổ sung"', async () => {
      hoSoDuNgoaiDoiTuong();
      db.hoSo.doi_tuong = null;
      db.dotXacNhan.day_du = false;
      db.dotXacNhan.thieu = [{ field: 'doi_tuong', message: 'Chưa chọn đối tượng (giáo viên hoặc cán bộ quản lý)' }];
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

      // Mantine đặt thông báo lỗi cạnh nhóm radio, liên kết qua aria-describedby (trình đọc màn hình đọc được).
      const nhom = (await screen.findByRole('radio', { name: 'Giáo viên' })).closest('[role="radiogroup"]') as HTMLElement;
      await waitFor(() => {
        const idLoi = nhom.getAttribute('aria-describedby')?.split(' ').find((id) => id.endsWith('-error'));
        expect(idLoi && document.getElementById(idLoi)).toHaveTextContent('Cần bổ sung');
      });

      const oChucVu = screen.getByLabelText('Chức vụ');
      await user.clear(oChucVu);
      await user.type(oChucVu, 'Tổ trưởng');
      await user.click(screen.getByRole('button', { name: 'Lưu' }));
      await waitFor(() => expect(thanPatch).toEqual({ chuc_vu: 'Tổ trưởng' }));
    });
  });
});
