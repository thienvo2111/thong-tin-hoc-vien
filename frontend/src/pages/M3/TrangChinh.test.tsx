import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { datCauHinhCuaToiMock, datCauHinhKhaoSatMock, datCauHinhKhoaMock } from '@/test/mocks/cauHinhKhaoSat';
import type { CauHinhKhaoSat } from '@/api/cauHinhKhaoSat';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/mocks/server';
import { db } from '@/test/mocks/db';
import { datTinhTrangBai } from '@/test/mocks/sso';
import { renderVoiRouter } from '@/test/testUtils';
import { datToken } from '@/auth/tokenStore';
import TrangChinh from './TrangChinh';

const routes = [
  { path: '/toi', element: <TrangChinh /> },
  { path: '/toi/ho-so', element: <div>Màn hình hồ sơ</div> },
  { path: '/toi/xac-nhan', element: <div>Màn hình xác nhận</div> },
  { path: '/toi/danh-gia-dau-vao', element: <div>Màn hình đánh giá</div> },
  { path: '/toi/lop-hoc', element: <div>Màn hình lớp học</div> },
];

function renderDaDangNhap() {
  datToken('token-gia-lap');
  return renderVoiRouter(routes, { initialEntries: ['/toi'] });
}

describe('M3 — Trang chính', () => {
  it('trạng thái tải: hiện loader trong lúc chờ API', () => {
    renderDaDangNhap();
    expect(document.querySelector('.mantine-Loader-root')).toBeInTheDocument();
  });

  it('lỗi API: hiện thông báo lỗi', async () => {
    server.use(http.get('/hoc-vien/toi/dot-xac-nhan', () => HttpResponse.error()));
    renderDaDangNhap();
    expect(await screen.findByText('Không kết nối được máy chủ. Kiểm tra mạng và thử lại.')).toBeInTheDocument();
  });

  it('đợt đang mở, hồ sơ thiếu → hiện số trường thiếu + hạn + nút Bổ sung thông tin', async () => {
    renderDaDangNhap();
    expect(await screen.findByText(/Còn 2 thông tin cần bổ sung/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Bổ sung thông tin' })).toHaveAttribute('href', '/toi/ho-so');
  });

  it('đợt đang mở, đủ, chưa xác nhận → nút Xem lại & xác nhận', async () => {
    db.dotXacNhan.day_du = true;
    db.dotXacNhan.thieu = [];
    renderDaDangNhap();
    expect(await screen.findByText(/Hồ sơ đã đủ/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Xem lại & xác nhận' })).toHaveAttribute('href', '/toi/xac-nhan');
  });

  it('đợt đang mở, đã xác nhận (không phải đợt đánh giá) → nút Xem hồ sơ, không có khối đánh giá', async () => {
    db.dotXacNhan.day_du = true;
    db.dotXacNhan.thieu = [];
    db.dotXacNhan.da_xac_nhan = true;
    db.dotXacNhan.xac_nhan_luc = '2026-09-20T03:00:00.000Z';
    renderDaDangNhap();
    expect(await screen.findByText(/Đã xác nhận lúc/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Xem hồ sơ' })).toHaveAttribute('href', '/toi/ho-so');
    expect(screen.queryByText('Làm bài đánh giá')).not.toBeInTheDocument();
  });

  it('đợt 2 (xac_nhan_truoc_danh_gia) đã xác nhận → thêm khối đánh giá + nút Làm bài đánh giá', async () => {
    db.dotXacNhan.dot!.loai = 'xac_nhan_truoc_danh_gia';
    db.dotXacNhan.day_du = true;
    db.dotXacNhan.thieu = [];
    db.dotXacNhan.da_xac_nhan = true;
    db.dotXacNhan.xac_nhan_luc = '2026-10-06T03:00:00.000Z';
    renderDaDangNhap();
    expect(await screen.findByText('Làm bài đánh giá')).toBeInTheDocument();
  });

  it('không có đợt mở, có đợt sắp mở → hiện giờ mở + nút Xem hồ sơ (chỉ xem)', async () => {
    db.dotXacNhan.dot = null;
    db.dotXacNhan.dot_sap_mo = { ten: 'Kiểm tra hồ sơ đợt 2', mo_luc: '2026-10-05T00:00:00.000Z' };
    renderDaDangNhap();
    expect(await screen.findByText(/mở lúc/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Xem hồ sơ' })).toBeInTheDocument();
  });

  it('không có đợt nào mở → "Hiện không trong thời gian chỉnh sửa hồ sơ"', async () => {
    db.dotXacNhan.dot = null;
    db.dotXacNhan.dot_sap_mo = null;
    renderDaDangNhap();
    expect(await screen.findByText('Hiện không trong thời gian chỉnh sửa hồ sơ')).toBeInTheDocument();
  });

  it('quá đợt, đã xác nhận trước đó -> hiện thời điểm xác nhận + nút gửi hỗ trợ', async () => {
    db.dotXacNhan.dot = null;
    db.dotXacNhan.dot_sap_mo = null;
    db.dotXacNhan.xac_nhan_gan_nhat = { dot_ten: 'Kiểm tra hồ sơ đợt 1', xac_nhan_luc: '2026-10-03T02:00:00.000Z' };
    renderDaDangNhap();
    expect(await screen.findByText(/đã xác nhận hồ sơ lúc 03\/10\/2026 09:00/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Gửi yêu cầu hỗ trợ' })).toHaveAttribute('href', '/toi/yeu-cau-ho-tro');
  });

  it('đợt mở, xác nhận bị hủy do điều chỉnh -> nhắc xác nhận lại', async () => {
    db.dotXacNhan.day_du = true;
    db.dotXacNhan.thieu = [];
    db.dotXacNhan.can_xac_nhan_lai = true;
    renderDaDangNhap();
    expect(await screen.findByText(/Thông tin hồ sơ đã được điều chỉnh sau lần xác nhận trước/)).toBeInTheDocument();
  });

  it('luôn hiện menu 2 mục: Cập nhật hồ sơ và Thông tin lớp học', async () => {
    renderDaDangNhap();
    expect(await screen.findByRole('link', { name: /Cập nhật hồ sơ/ })).toHaveAttribute('href', '/toi/ho-so');
    expect(screen.getByRole('link', { name: /Thông tin lớp học/ })).toHaveAttribute('href', '/toi/lop-hoc');
  });

  it('có thẻ lối tắt sang Hướng dẫn sử dụng (M9)', async () => {
    renderDaDangNhap();
    expect(await screen.findByRole('link', { name: 'Xem hướng dẫn' })).toHaveAttribute('href', '/huong-dan');
  });
});

describe('M3 — lời chào theo giới tính', () => {
  it.each([
    ['nam', 'Chào mừng Thầy Nguyễn Văn A'],
    ['nu', 'Chào mừng Cô Nguyễn Văn A'],
    [null, 'Chào mừng Thầy/Cô Nguyễn Văn A'],
  ] as const)('gioi_tinh=%s -> "%s"', async (gioiTinh, loiChao) => {
    db.hoSo.gioi_tinh = gioiTinh;
    db.hoSo.ho_ten = 'Nguyễn Văn A';
    renderDaDangNhap();
    expect(await screen.findByRole('heading', { name: new RegExp(loiChao) })).toBeInTheDocument();
  });

  it('chưa tải được hồ sơ -> vẫn chào chung "Thầy/Cô"', async () => {
    server.use(http.get('/hoc-vien/toi', () => HttpResponse.error()));
    renderDaDangNhap();
    expect(await screen.findByRole('heading', { name: /Chào mừng Thầy\/Cô/ })).toBeInTheDocument();
  });
});

describe('M3 — khảo sát đầu vào / đầu ra', () => {
  const locationGoc = window.location;
  const cauHinh = (ghiDe: Partial<CauHinhKhaoSat>): CauHinhKhaoSat => ({
    che_do_hoc_vien: 'dang_nhap',
    danh_gia_dau_vao_trong_cong: false,
    hien_khao_sat: false,
    kenh_danh_gia: 'sso',
    khao_sat_dau_ra_mo: false,
    phieu: [],
    ...ghiDe,
  });
  const datDayDu = () => {
    db.dotXacNhan.day_du = true;
    db.dotXacNhan.thieu = [];
  };

  afterEach(() => {
    Object.defineProperty(window, 'location', { configurable: true, value: locationGoc });
  });

  it('chưa mở khảo sát nào -> không hiện khối khảo sát', async () => {
    datCauHinhKhaoSatMock(cauHinh({}));
    renderDaDangNhap();
    expect(await screen.findByText(/Còn 2 thông tin cần bổ sung/)).toBeInTheDocument();
    expect(screen.queryByText(/Khảo sát đầu vào đã mở/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Khảo sát đầu ra đã mở/)).not.toBeInTheDocument();
  });

  it('đầu vào mở, hồ sơ thiếu -> liệt kê thông tin phải cập nhật + nút về hồ sơ, không có nút làm khảo sát', async () => {
    datCauHinhKhaoSatMock(cauHinh({ danh_gia_dau_vao_trong_cong: true }));
    renderDaDangNhap();
    expect(await screen.findByText('Khảo sát đầu vào đã mở')).toBeInTheDocument();
    expect(screen.getByText(/cần hoàn thành cập nhật các thông tin sau trước khi bắt đầu làm khảo sát/)).toBeInTheDocument();
    expect(screen.getAllByText('Số CCCD').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByRole('link', { name: 'Cập nhật thông tin hồ sơ' })).toHaveAttribute('href', '/toi/ho-so');
    expect(screen.queryByRole('link', { name: 'Làm khảo sát đầu vào' })).not.toBeInTheDocument();
  });

  it('đầu vào mở, hồ sơ đủ -> nút Làm khảo sát đầu vào sang M6', async () => {
    datCauHinhKhaoSatMock(cauHinh({ danh_gia_dau_vao_trong_cong: true }));
    datDayDu();
    renderDaDangNhap();
    expect(await screen.findByRole('link', { name: 'Làm khảo sát đầu vào' })).toHaveAttribute(
      'href',
      '/toi/danh-gia-dau-vao',
    );
  });

  it('đầu ra mở, hồ sơ thiếu -> liệt kê thông tin phải cập nhật, không có nút làm khảo sát', async () => {
    datCauHinhKhaoSatMock(cauHinh({ khao_sat_dau_ra_mo: true }));
    renderDaDangNhap();
    expect(await screen.findByText('Khảo sát đầu ra đã mở')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Cập nhật thông tin hồ sơ' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Làm khảo sát đầu ra' })).not.toBeInTheDocument();
  });

  it('đầu ra mở, hồ sơ đủ -> bấm nút cấp mã target=dau-ra rồi chuyển trang cùng tab', async () => {
    datCauHinhKhaoSatMock(cauHinh({ khao_sat_dau_ra_mo: true }));
    datDayDu();
    const assign = vi.fn();
    Object.defineProperty(window, 'location', { configurable: true, value: { ...locationGoc, assign } });
    const user = userEvent.setup();
    renderDaDangNhap();

    await user.click(await screen.findByRole('button', { name: 'Làm khảo sát đầu ra' }));
    await waitFor(() => expect(assign).toHaveBeenCalledTimes(1));
    expect(new URL(assign.mock.calls[0][0]).searchParams.get('target')).toBe('dau-ra');
  });

  it('đầu ra: cấp mã bị từ chối -> hiện lỗi, không chuyển trang', async () => {
    datCauHinhKhaoSatMock(cauHinh({ khao_sat_dau_ra_mo: true }));
    datDayDu();
    server.use(
      http.post('/sso/cap-ma', () =>
        HttpResponse.json({ error: { code: 'FORBIDDEN', message: 'Khảo sát đầu ra chưa mở' } }, { status: 403 }),
      ),
    );
    const user = userEvent.setup();
    renderDaDangNhap();

    await user.click(await screen.findByRole('button', { name: 'Làm khảo sát đầu ra' }));
    expect(await screen.findByText('Khảo sát đầu ra chưa mở')).toBeInTheDocument();
  });

  it('cấu hình thật: chỉ bật khối khảo sát trên trang chủ + kênh sso, hồ sơ thiếu -> vẫn hiện khối đầu vào + danh sách thiếu', async () => {
    datCauHinhKhaoSatMock(cauHinh({ hien_khao_sat: true, danh_gia_dau_vao_trong_cong: false, kenh_danh_gia: 'sso' }));
    renderDaDangNhap();
    expect(await screen.findByText('Khảo sát đầu vào đã mở')).toBeInTheDocument();
    expect(screen.getByText(/cần hoàn thành cập nhật các thông tin sau/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Cập nhật thông tin hồ sơ' })).toHaveAttribute('href', '/toi/ho-so');
  });

  it('bật khối khảo sát + kênh sso, hồ sơ đủ -> nút sang M6 (dù mục M6 đang ẩn trên menu)', async () => {
    datCauHinhKhaoSatMock(cauHinh({ hien_khao_sat: true, kenh_danh_gia: 'sso' }));
    datDayDu();
    renderDaDangNhap();
    expect(await screen.findByRole('link', { name: 'Làm khảo sát đầu vào' })).toHaveAttribute(
      'href',
      '/toi/danh-gia-dau-vao',
    );
  });

  it('kênh sso, hồ sơ đủ -> tóm tắt tình hình 2 bài (trạng thái, mức khi xong, nhắc kiểm tra)', async () => {
    datCauHinhKhaoSatMock(cauHinh({ hien_khao_sat: true, kenh_danh_gia: 'sso' }));
    datDayDu();
    datTinhTrangBai({ loai: 'khao-sat', trang_thai: 'hoan_thanh', muc: 'nang_cao' });
    datTinhTrangBai({ loai: 'danh-gia', trang_thai: 'da_mo', can_kiem_tra: true });
    renderDaDangNhap();
    const tomTat = await screen.findByLabelText('Tình hình làm khảo sát');
    expect(within(tomTat).getByText('Đã hoàn thành · Nâng cao')).toBeInTheDocument();
    expect(within(tomTat).getByText('Cần kiểm tra lại')).toBeInTheDocument();
    expect(within(tomTat).queryByText('Khảo sát đầu ra')).not.toBeInTheDocument();
  });

  it('đầu ra mở, hồ sơ đủ -> tóm tắt riêng bài đầu ra', async () => {
    datCauHinhKhaoSatMock(cauHinh({ khao_sat_dau_ra_mo: true }));
    datDayDu();
    datTinhTrangBai({ loai: 'dau-ra', trang_thai: 'dang_lam' });
    renderDaDangNhap();
    const tomTat = await screen.findByLabelText('Tình hình làm khảo sát');
    expect(within(tomTat).getByText('Khảo sát đầu ra')).toBeInTheDocument();
    expect(within(tomTat).getByText('Đang làm')).toBeInTheDocument();
  });

  it('bật khối khảo sát + kênh vle, hồ sơ đủ -> hiện phiếu ngoài theo thứ tự; chưa có đường dẫn -> nút khóa', async () => {
    datCauHinhKhaoSatMock(
      cauHinh({
        hien_khao_sat: true,
        kenh_danh_gia: 'vle',
        phieu: [
          { ten: 'Phiếu A', mo_ta: '', lien_ket: [{ nhan: 'Mở phiếu A', url: 'https://forms.example/a' }] },
          { ten: 'Phiếu B', mo_ta: '', lien_ket: [{ nhan: 'Mở phiếu B', url: '' }] },
        ],
      }),
    );
    datDayDu();
    renderDaDangNhap();
    expect(await screen.findByRole('link', { name: 'Mở phiếu A' })).toHaveAttribute('href', 'https://forms.example/a');
    expect(screen.getByRole('button', { name: 'Đường dẫn đang được cập nhật' })).toBeDisabled();
    expect(screen.queryByRole('link', { name: 'Làm khảo sát đầu vào' })).not.toBeInTheDocument();
  });

  it('mở cả hai -> hiện cả 2 khối', async () => {
    datCauHinhKhaoSatMock(cauHinh({ danh_gia_dau_vao_trong_cong: true, khao_sat_dau_ra_mo: true }));
    datDayDu();
    renderDaDangNhap();
    expect(await screen.findByText('Khảo sát đầu vào đã mở')).toBeInTheDocument();
    expect(await screen.findByText('Khảo sát đầu ra đã mở')).toBeInTheDocument();
  });
});

describe('M3 — cấu hình theo khóa học viên đã ghi danh (2026-10-02)', () => {
  it('cấu hình chung chưa mở đầu ra nhưng khóa của học viên mở -> hiện khối khảo sát đầu ra', async () => {
    db.dotXacNhan.day_du = true;
    db.dotXacNhan.thieu = [];
    const chung: CauHinhKhaoSat = {
      che_do_hoc_vien: 'dang_nhap',
      danh_gia_dau_vao_trong_cong: false,
      hien_khao_sat: false,
      kenh_danh_gia: 'sso',
      khao_sat_dau_ra_mo: false,
      phieu: [],
    };
    datCauHinhKhaoSatMock(chung);
    datCauHinhKhoaMock({
      khoa_id: 'k-hv',
      ma_khoa: 'K-HV',
      ten_khoa: 'Khóa của học viên',
      tinh: null,
      cau_hinh: { ...chung, khao_sat_dau_ra_mo: true },
    });
    datCauHinhCuaToiMock('k-hv');
    renderDaDangNhap();
    expect(await screen.findByText('Khảo sát đầu ra đã mở')).toBeInTheDocument();
  });
});

describe('M3 — thẻ Khảo sát đầu vào / Đánh giá đầu ra (khóa có lý do)', () => {
  const cauHinh = (ghiDe: Partial<CauHinhKhaoSat>): CauHinhKhaoSat => ({
    che_do_hoc_vien: 'dang_nhap',
    danh_gia_dau_vao_trong_cong: false,
    hien_khao_sat: false,
    kenh_danh_gia: 'sso',
    khao_sat_dau_ra_mo: false,
    phieu: [],
    ...ghiDe,
  });
  const datDayDu = () => {
    db.dotXacNhan.day_du = true;
    db.dotXacNhan.thieu = [];
  };
  const chuaCoKetQua = () => {
    db.khoaHocToi[0].muc_dau_vao = null;
    db.khoaHocToi[0].muc_dau_ra = null;
  };
  /** Thẻ = Card chứa tiêu đề; chờ ghi chú xuất hiện vì cấu hình/mức độ tải bất đồng bộ. */
  async function theCo(tieuDe: string, ghiChu: RegExp) {
    const layThe = () => screen.getByText(tieuDe).closest('.mantine-Card-root') as HTMLElement;
    await waitFor(() => expect(within(layThe()).getByText(ghiChu)).toBeInTheDocument());
    return layThe();
  }

  it('luôn hiện đủ 4 thẻ', async () => {
    renderDaDangNhap();
    for (const ten of ['Cập nhật hồ sơ', 'Thông tin lớp học', 'Khảo sát đầu vào', 'Đánh giá đầu ra']) {
      expect(await screen.findByText(ten)).toBeInTheDocument();
    }
  });

  it('đầu vào chưa mở -> thẻ khóa (mờ, không phải link) + lý do "Chưa mở"', async () => {
    datCauHinhKhaoSatMock(cauHinh({}));
    chuaCoKetQua();
    renderDaDangNhap();
    const the = await theCo('Khảo sát đầu vào', /Chưa mở/);
    expect(the).toHaveAttribute('aria-disabled', 'true');
    expect(the).not.toHaveAttribute('href');
  });

  it('đầu vào mở nhưng hồ sơ thiếu -> thẻ khóa + lý do chưa cập nhật đủ thông tin', async () => {
    datCauHinhKhaoSatMock(cauHinh({ danh_gia_dau_vao_trong_cong: true }));
    chuaCoKetQua();
    renderDaDangNhap();
    const the = await theCo('Khảo sát đầu vào', /chưa kích hoạt được.*cập nhật đủ 2 thông tin hồ sơ/);
    expect(the).toHaveAttribute('aria-disabled', 'true');
  });

  it('đầu vào mở, hồ sơ đủ, kênh sso -> thẻ là link sang M6', async () => {
    datCauHinhKhaoSatMock(cauHinh({ hien_khao_sat: true, kenh_danh_gia: 'sso' }));
    datDayDu();
    chuaCoKetQua();
    renderDaDangNhap();
    const the = await theCo('Khảo sát đầu vào', /Đã mở — bấm để bắt đầu/);
    expect(the).toHaveAttribute('href', '/toi/danh-gia-dau-vao');
    expect(the).not.toHaveAttribute('aria-disabled');
  });

  it('đầu vào mở, hồ sơ đủ, kênh vle phiếu ngoài -> thẻ cuộn tới khối phiếu trong trang', async () => {
    datCauHinhKhaoSatMock(cauHinh({ hien_khao_sat: true, kenh_danh_gia: 'vle' }));
    datDayDu();
    chuaCoKetQua();
    renderDaDangNhap();
    const the = await theCo('Khảo sát đầu vào', /Đã mở/);
    expect(the).toHaveAttribute('href', '#khao-sat-dau-vao');
    expect(document.getElementById('khao-sat-dau-vao')).toBeInTheDocument();
  });

  it('đã có kết quả đầu vào -> thẻ báo mức + link sang lớp học (dù khảo sát đã đóng)', async () => {
    datCauHinhKhaoSatMock(cauHinh({}));
    renderDaDangNhap();
    const the = await theCo('Khảo sát đầu vào', /Đã có kết quả: Mức Cơ bản/);
    expect(the).toHaveAttribute('href', '/toi/lop-hoc');
  });

  it('đầu ra chưa mở -> thẻ khóa + lý do mở khi hoàn thành khóa', async () => {
    datCauHinhKhaoSatMock(cauHinh({}));
    renderDaDangNhap();
    const the = await theCo('Đánh giá đầu ra', /mở khi Thầy\/Cô hoàn thành khóa bồi dưỡng/);
    expect(the).toHaveAttribute('aria-disabled', 'true');
  });

  it('đầu ra mở, hồ sơ thiếu -> thẻ khóa + lý do thiếu thông tin', async () => {
    datCauHinhKhaoSatMock(cauHinh({ khao_sat_dau_ra_mo: true }));
    renderDaDangNhap();
    const the = await theCo('Đánh giá đầu ra', /cập nhật đủ 2 thông tin hồ sơ/);
    expect(the).toHaveAttribute('aria-disabled', 'true');
  });

  it('đầu ra mở, hồ sơ đủ -> thẻ cuộn tới khối Khảo sát đầu ra', async () => {
    datCauHinhKhaoSatMock(cauHinh({ khao_sat_dau_ra_mo: true }));
    datDayDu();
    renderDaDangNhap();
    const the = await theCo('Đánh giá đầu ra', /Đã mở/);
    expect(the).toHaveAttribute('href', '#khao-sat-dau-ra');
  });

  it('đã có kết quả đầu ra -> thẻ báo mức', async () => {
    db.khoaHocToi[0].muc_dau_ra = 'thanh_thao';
    renderDaDangNhap();
    await theCo('Đánh giá đầu ra', /Đã có kết quả: Mức Thành thạo/);
  });
});

describe('M3 — thông báo kết quả đánh giá / chia lớp đã cập nhật', () => {
  it('có kết quả + lớp chưa xem -> hiện thông báo kèm chi tiết + nhãn Mới trên thẻ lớp học', async () => {
    renderDaDangNhap();
    expect(await screen.findByText('Có cập nhật mới')).toBeInTheDocument();
    expect(screen.getByText('Kết quả đánh giá đầu vào đã được cập nhật:')).toBeInTheDocument();
    expect(screen.getByText('Bồi dưỡng NLS – Mức cơ bản: Mức Cơ bản')).toBeInTheDocument();
    expect(screen.getByText('Danh sách chia lớp đã được cập nhật:')).toBeInTheDocument();
    expect(screen.getByText(/Lớp 01 – Nhóm cơ bản A, Lớp Zoom 01/)).toBeInTheDocument();
    const theLop = screen.getByText('Thông tin lớp học').closest('.mantine-Card-root') as HTMLElement;
    expect(within(theLop).getByText('Mới')).toBeInTheDocument();
  });

  it('bấm "Đã xem" -> ẩn thông báo, mở lại trang vẫn không hiện', async () => {
    const user = userEvent.setup();
    const { unmount } = renderDaDangNhap();
    await user.click(await screen.findByRole('button', { name: 'Đã xem' }));
    expect(screen.queryByText('Có cập nhật mới')).not.toBeInTheDocument();
    expect(screen.queryByText('Mới')).not.toBeInTheDocument();

    unmount();
    renderDaDangNhap();
    expect(await screen.findByText('Thông tin lớp học')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText('Có cập nhật mới')).not.toBeInTheDocument());
  });

  it('bấm "Xem lớp học" -> đánh dấu đã xem và chuyển sang trang lớp học', async () => {
    const user = userEvent.setup();
    const { unmount } = renderDaDangNhap();
    await user.click(await screen.findByRole('link', { name: 'Xem lớp học' }));
    expect(await screen.findByText('Màn hình lớp học')).toBeInTheDocument();

    unmount();
    renderDaDangNhap();
    expect(await screen.findByText('Thông tin lớp học')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText('Có cập nhật mới')).not.toBeInTheDocument());
  });

  it('đã xem rồi, sau đó quản trị đổi lớp -> chỉ báo danh sách chia lớp, không báo lại kết quả', async () => {
    const user = userEvent.setup();
    const { unmount } = renderDaDangNhap();
    await user.click(await screen.findByRole('button', { name: 'Đã xem' }));
    unmount();

    db.khoaHocToi[0].giai_doan[1].lop!.id = 'lop-moi';
    db.khoaHocToi[0].giai_doan[1].lop!.ten_lop = 'Lớp 05 – Nhóm cơ bản E';
    renderDaDangNhap();
    expect(await screen.findByText('Danh sách chia lớp đã được cập nhật:')).toBeInTheDocument();
    expect(screen.getByText(/Lớp 05 – Nhóm cơ bản E/)).toBeInTheDocument();
    expect(screen.queryByText('Kết quả đánh giá đầu vào đã được cập nhật:')).not.toBeInTheDocument();
  });

  it('chưa có kết quả, chưa chia lớp -> không có thông báo; thẻ lớp học ghi "Chưa có danh sách chia lớp"', async () => {
    db.khoaHocToi[0].muc_dau_vao = null;
    db.khoaHocToi[0].giai_doan = db.khoaHocToi[0].giai_doan.map((gd) => ({ ...gd, lop: null }));
    renderDaDangNhap();
    expect(await screen.findByText('Chưa có danh sách chia lớp')).toBeInTheDocument();
    expect(screen.queryByText('Có cập nhật mới')).not.toBeInTheDocument();
  });

  it('lỗi tải khóa học -> trang chính vẫn hoạt động, không có thông báo', async () => {
    server.use(http.get('/hoc-vien/toi/khoa-hoc', () => HttpResponse.error()));
    renderDaDangNhap();
    expect(await screen.findByText(/Còn 2 thông tin cần bổ sung/)).toBeInTheDocument();
    expect(screen.queryByText('Có cập nhật mới')).not.toBeInTheDocument();
  });
});
