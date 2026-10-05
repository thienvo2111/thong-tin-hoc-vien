import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/mocks/server';
import { db } from '@/test/mocks/db';
import { datTinhTrangBai } from '@/test/mocks/sso';
import { renderVoiRouter } from '@/test/testUtils';
import { datToken } from '@/auth/tokenStore';
import DanhGiaDauVao from './DanhGiaDauVao';

const routes = [
  { path: '/toi/danh-gia-dau-vao', element: <DanhGiaDauVao /> },
  { path: '/toi/ho-so', element: <div>Màn hình hồ sơ</div> },
  { path: '/toi/xac-nhan', element: <div>Màn hình xác nhận</div> },
];

function renderDaDangNhap() {
  datToken('token-gia-lap');
  return renderVoiRouter(routes, { initialEntries: ['/toi/danh-gia-dau-vao'] });
}

describe('M6 — Làm bài đánh giá đầu vào', () => {
  it('trạng thái tải: hiện loader trong lúc chờ API', () => {
    renderDaDangNhap();
    expect(document.querySelector('.mantine-Loader-root')).toBeInTheDocument();
  });

  it('lỗi API: hiện thông báo lỗi', async () => {
    server.use(http.get('/hoc-vien/toi/danh-gia-dau-vao', () => HttpResponse.error()));
    renderDaDangNhap();
    expect(await screen.findByText('Không kết nối được máy chủ. Kiểm tra mạng và thử lại.')).toBeInTheDocument();
  });

  describe('đủ điều kiện', () => {
    it('hiện link Vào làm bài, tên đăng nhập; mật khẩu ẩn cho tới khi bấm Hiện, rồi Sao chép gọi clipboard', async () => {
      const user = userEvent.setup();
      // userEvent.setup() gắn sẵn 1 clipboard giả (thật, không phải spy) vào navigator — gắn spy
      // lên chính instance đó (sau setup, trước khi bấm) thay vì tự thay navigator.clipboard.
      const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined);
      renderDaDangNhap();

      expect(await screen.findByRole('link', { name: 'Vào làm bài' })).toHaveAttribute(
        'href',
        'https://vle.example.edu.vn/danh-gia-dau-vao',
      );
      expect(screen.getByDisplayValue('9115131060')).toBeInTheDocument();

      // Trước khi bấm "Hiện": mật khẩu thật không được xuất hiện ở đâu trong DOM.
      expect(screen.queryByDisplayValue('Tam123456')).not.toBeInTheDocument();
      expect(screen.queryByText('Tam123456')).not.toBeInTheDocument();
      expect(document.body.innerHTML).not.toContain('Tam123456');
      expect(screen.getByDisplayValue('••••••••')).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Hiện' }));
      expect(screen.getByDisplayValue('Tam123456')).toBeInTheDocument();

      const nutSaoChepMatKhau = screen.getAllByRole('button', { name: 'Sao chép' })[1];
      await user.click(nutSaoChepMatKhau);
      expect(writeText).toHaveBeenCalledWith('Tam123456');
    });

    it('mat_khau_tam null → không hiện ô mật khẩu, chỉ hiện ghi chú', async () => {
      db.danhGiaDauVao = {
        kenh: 'vle',
        du_dieu_kien: true,
        duong_dan: 'https://vle.example.edu.vn/danh-gia-dau-vao',
        ten_dang_nhap_vle: '9115131060',
        mat_khau_tam: null,
      };
      renderDaDangNhap();
      await screen.findByRole('link', { name: 'Vào làm bài' });
      expect(screen.queryByRole('button', { name: 'Hiện' })).not.toBeInTheDocument();
      expect(screen.getByText(/Chưa có mật khẩu tạm/)).toBeInTheDocument();
    });
  });

  describe('chưa đủ điều kiện', () => {
    it('chưa xác nhận đợt 2 → hiện lý do + nút Xem lại & xác nhận, không có thông tin VLE', async () => {
      db.danhGiaDauVao = {
        kenh: 'vle',
        du_dieu_kien: false,
        ly_do: ['Chưa xác nhận hồ sơ ở đợt xác nhận trước đánh giá (đợt 2)'],
        dot: { id: 'dot-2', ten: 'Xác nhận trước đánh giá', loai: 'xac_nhan_truoc_danh_gia', mo_luc: '2026-10-01T00:00:00.000Z', dong_luc: '2026-10-10T16:59:59.000Z' },
      };
      renderDaDangNhap();
      expect(await screen.findByText('Chưa xác nhận hồ sơ ở đợt xác nhận trước đánh giá (đợt 2)')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Xem lại & xác nhận' })).toHaveAttribute('href', '/toi/xac-nhan');
      expect(screen.queryByRole('link', { name: 'Vào làm bài' })).not.toBeInTheDocument();
      expect(document.body.innerHTML).not.toContain('vle.example.edu.vn');
    });

    it('hồ sơ chưa đầy đủ → hiện lý do + nút Bổ sung hồ sơ', async () => {
      db.danhGiaDauVao = {
        kenh: 'vle',
        du_dieu_kien: false,
        ly_do: ['Chưa có email'],
        dot: { id: 'dot-2', ten: 'Xác nhận trước đánh giá', loai: 'xac_nhan_truoc_danh_gia', mo_luc: '2026-10-01T00:00:00.000Z', dong_luc: '2026-10-10T16:59:59.000Z' },
      };
      renderDaDangNhap();
      expect(await screen.findByText('Chưa có email')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Bổ sung hồ sơ' })).toHaveAttribute('href', '/toi/ho-so');
      expect(screen.queryByRole('link', { name: 'Xem lại & xác nhận' })).not.toBeInTheDocument();
    });
  });

  it('het_han → chỉ hiện thông báo cố định, không có ly_do/nút/thông tin VLE', async () => {
    db.danhGiaDauVao = { kenh: 'vle', du_dieu_kien: false, het_han: true };
    renderDaDangNhap();
    expect(await screen.findByText(/Đã hết thời gian xác nhận để làm bài đánh giá/)).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
    await waitFor(() => expect(document.body.innerHTML).not.toContain('vle.example.edu.vn'));
  });
});

describe('M6 — kênh trang khảo sát (SSO, 2026-10-02)', () => {
  const locationGoc = window.location;

  function giaLapChuyenTrang() {
    const assign = vi.fn();
    Object.defineProperty(window, 'location', { configurable: true, value: { ...locationGoc, assign } });
    return assign;
  }

  afterEach(() => {
    Object.defineProperty(window, 'location', { configurable: true, value: locationGoc });
  });

  it('đủ điều kiện: không hiện tài khoản VLE; bấm phiếu đánh giá -> cấp mã target=danh-gia rồi chuyển trang cùng tab', async () => {
    db.danhGiaDauVao = { kenh: 'sso', du_dieu_kien: true };
    const assign = giaLapChuyenTrang();
    const user = userEvent.setup();
    renderDaDangNhap();

    await user.click(within(await screen.findByLabelText('Phiếu đánh giá năng lực số')).getByRole('button', { name: 'Làm bài' }));
    await waitFor(() => expect(assign).toHaveBeenCalledTimes(1));
    const url = new URL(assign.mock.calls[0][0]);
    expect(url.searchParams.get('target')).toBe('danh-gia');
    expect(url.searchParams.get('code')).toBeTruthy();
    expect(screen.queryByText('Tên đăng nhập VLE')).not.toBeInTheDocument();
  });

  it('bấm phiếu khảo sát -> target=khao-sat; "Xem tất cả" -> không có target', async () => {
    db.danhGiaDauVao = { kenh: 'sso', du_dieu_kien: true };
    const assign = giaLapChuyenTrang();
    const user = userEvent.setup();
    renderDaDangNhap();

    await user.click(within(await screen.findByLabelText('Phiếu khảo sát kĩ năng số')).getByRole('button', { name: 'Làm bài' }));
    await waitFor(() => expect(assign).toHaveBeenCalledTimes(1));
    expect(new URL(assign.mock.calls[0][0]).searchParams.get('target')).toBe('khao-sat');

    await user.click(screen.getByRole('button', { name: 'Xem tất cả bài cần làm' }));
    await waitFor(() => expect(assign).toHaveBeenCalledTimes(2));
    expect(new URL(assign.mock.calls[1][0]).searchParams.has('target')).toBe(false);
  });

  it('cấp mã lỗi (vd hồ sơ vừa bị sửa thành thiếu) -> hiện lỗi, KHÔNG chuyển trang', async () => {
    db.danhGiaDauVao = { kenh: 'sso', du_dieu_kien: true };
    server.use(
      http.post('/sso/cap-ma', () =>
        HttpResponse.json(
          { error: { code: 'FORBIDDEN', message: 'Hồ sơ chưa đầy đủ, chưa thể chuyển sang trang khảo sát' } },
          { status: 403 },
        ),
      ),
    );
    const assign = giaLapChuyenTrang();
    const user = userEvent.setup();
    renderDaDangNhap();

    await user.click(within(await screen.findByLabelText('Phiếu đánh giá năng lực số')).getByRole('button', { name: 'Làm bài' }));
    expect(await screen.findByText('Hồ sơ chưa đầy đủ, chưa thể chuyển sang trang khảo sát')).toBeInTheDocument();
    expect(assign).not.toHaveBeenCalled();
  });

  it('chưa đủ điều kiện: liệt kê trường thiếu, chỉ có nút Bổ sung hồ sơ (không cần xác nhận đợt 2)', async () => {
    db.danhGiaDauVao = {
      kenh: 'sso',
      du_dieu_kien: false,
      ly_do: ['Chưa chọn đối tượng (giáo viên hoặc cán bộ quản lý)'],
    };
    renderDaDangNhap();
    expect(await screen.findByText('Chưa chọn đối tượng (giáo viên hoặc cán bộ quản lý)')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Bổ sung hồ sơ' })).toHaveAttribute('href', '/toi/ho-so');
    expect(screen.queryByRole('link', { name: /Xem lại/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Làm bài' })).not.toBeInTheDocument();
  });

  describe('tình trạng từng bài (2026-10-04)', () => {
    it('mặc định: cả 2 bài "Chưa làm" theo thứ tự 1, 2, nút "Làm bài"', async () => {
      db.danhGiaDauVao = { kenh: 'sso', du_dieu_kien: true };
      renderDaDangNhap();
      const khaoSat = await screen.findByLabelText('Phiếu khảo sát kĩ năng số');
      expect(await within(khaoSat).findByText('Chưa làm')).toBeInTheDocument();
      expect(within(khaoSat).getByText('1. Phiếu khảo sát kĩ năng số')).toBeInTheDocument();
      expect(screen.getByText('2. Phiếu đánh giá năng lực số')).toBeInTheDocument();
    });

    it('đang làm -> nút "Làm tiếp"; đã mở quá lâu -> "Cần kiểm tra lại" + lời nhắc nộp bài', async () => {
      db.danhGiaDauVao = { kenh: 'sso', du_dieu_kien: true };
      datTinhTrangBai({ loai: 'khao-sat', trang_thai: 'dang_lam' });
      datTinhTrangBai({ loai: 'danh-gia', trang_thai: 'da_mo', can_kiem_tra: true });
      renderDaDangNhap();

      const khaoSat = await screen.findByLabelText('Phiếu khảo sát kĩ năng số');
      expect(await within(khaoSat).findByText('Đang làm')).toBeInTheDocument();
      expect(within(khaoSat).getByRole('button', { name: 'Làm tiếp' })).toBeInTheDocument();

      const danhGia = screen.getByLabelText('Phiếu đánh giá năng lực số');
      expect(within(danhGia).getByText('Cần kiểm tra lại')).toBeInTheDocument();
      expect(within(danhGia).getByText(/chưa nhận được bài nộp/)).toBeInTheDocument();
    });

    it('hoàn thành -> hiện thời điểm + mức (không có điểm); xong cả 2 -> thông báo đã hoàn thành', async () => {
      db.danhGiaDauVao = { kenh: 'sso', du_dieu_kien: true };
      datTinhTrangBai({ loai: 'khao-sat', trang_thai: 'hoan_thanh', hoan_thanh_luc: '2026-10-04T01:30:00.000Z', muc: 'co_ban' });
      datTinhTrangBai({ loai: 'danh-gia', trang_thai: 'hoan_thanh', hoan_thanh_luc: '2026-10-04T02:00:00.000Z', muc: 'thanh_thao' });
      renderDaDangNhap();

      expect(await screen.findByText('Thầy/Cô đã hoàn thành 2 bài khảo sát đầu vào')).toBeInTheDocument();
      const danhGia = screen.getByLabelText('Phiếu đánh giá năng lực số');
      expect(within(danhGia).getByText('Đã hoàn thành')).toBeInTheDocument();
      expect(within(danhGia).getByText(/Hoàn thành lúc 04\/10\/2026 09:00/)).toBeInTheDocument();
      expect(within(danhGia).getByText('Thành thạo')).toBeInTheDocument();
      expect(within(danhGia).getByRole('button', { name: 'Mở lại trang khảo sát' })).toBeInTheDocument();
    });

    it('có mức gốc của hệ thống khảo sát -> hiện đúng nhãn đó (không quy đổi) + nút xem kết quả chi tiết', async () => {
      db.danhGiaDauVao = { kenh: 'sso', du_dieu_kien: true };
      datTinhTrangBai({
        loai: 'danh-gia',
        trang_thai: 'hoan_thanh',
        muc: 'co_ban',
        muc_goc: 'M1',
        nhan_muc_goc: 'M1 – Chưa đạt',
        url_ket_qua: 'https://khaosat.test/ket-qua/abc',
      });
      renderDaDangNhap();
      const danhGia = await screen.findByLabelText('Phiếu đánh giá năng lực số');
      expect(await within(danhGia).findByText('M1 – Chưa đạt')).toBeInTheDocument();
      expect(within(danhGia).queryByText('Cơ bản')).not.toBeInTheDocument();
      expect(within(danhGia).getByRole('link', { name: 'Xem kết quả chi tiết' })).toHaveAttribute(
        'href',
        'https://khaosat.test/ket-qua/abc',
      );
    });

    it('hoàn thành nhưng chưa có mức -> "Kết quả đang được tổng hợp"', async () => {
      db.danhGiaDauVao = { kenh: 'sso', du_dieu_kien: true };
      datTinhTrangBai({ loai: 'khao-sat', trang_thai: 'hoan_thanh' });
      renderDaDangNhap();
      const khaoSat = await screen.findByLabelText('Phiếu khảo sát kĩ năng số');
      expect(await within(khaoSat).findByText('Kết quả đang được tổng hợp.')).toBeInTheDocument();
    });

    it('không tải được tình trạng -> vẫn cho làm bài, không hiện nhãn trạng thái', async () => {
      db.danhGiaDauVao = { kenh: 'sso', du_dieu_kien: true };
      server.use(
        http.get('/sso/tinh-trang', () => HttpResponse.json({ error: { code: 'X', message: 'lỗi' } }, { status: 500 })),
      );
      renderDaDangNhap();
      const khaoSat = await screen.findByLabelText('Phiếu khảo sát kĩ năng số');
      expect(within(khaoSat).getByRole('button', { name: 'Làm bài' })).toBeEnabled();
      expect(within(khaoSat).queryByText('Chưa làm')).not.toBeInTheDocument();
    });
  });
});
