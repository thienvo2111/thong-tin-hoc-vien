import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/mocks/server';
import { db } from '@/test/mocks/db';
import { datTinhTrangBai, ssoDaYeuCau } from '@/test/mocks/sso';
import { datCauHinhKhaoSatMock } from '@/test/mocks/cauHinhKhaoSat';
import { renderVoiRouter } from '@/test/testUtils';
import { datToken } from '@/auth/tokenStore';
import type { KhoaHocDangKy } from '@/api/types';
import ThongTinLopHoc from './ThongTinLopHoc';

const routes = [{ path: '/toi/lop-hoc', element: <ThongTinLopHoc /> }];

function renderDaDangNhap() {
  datToken('token-gia-lap');
  return renderVoiRouter(routes, { initialEntries: ['/toi/lop-hoc'] });
}

async function cacTheGiaiDoan() {
  return screen.findAllByTestId('the-giai-doan');
}

// Phân lớp theo giai đoạn (spec 2026-10-02 mục 5.2): M7 là dòng thời gian, mỗi giai đoạn 1 thẻ.
describe('M7 — Thông tin lớp học', () => {
  it('trạng thái tải: hiện loader trong lúc chờ API', () => {
    renderDaDangNhap();
    expect(document.querySelector('.mantine-Loader-root')).toBeInTheDocument();
  });

  it('lỗi API: hiện thông báo lỗi', async () => {
    server.use(http.get('/hoc-vien/toi/khoa-hoc', () => HttpResponse.error()));
    renderDaDangNhap();
    expect(await screen.findByText('Không kết nối được máy chủ. Kiểm tra mạng và thử lại.')).toBeInTheDocument();
  });

  it('mảng rỗng → thông báo chưa được ghi danh', async () => {
    server.use(http.get('/hoc-vien/toi/khoa-hoc', () => HttpResponse.json([])));
    renderDaDangNhap();
    expect(await screen.findByText('Thầy/Cô chưa được ghi danh vào khóa bồi dưỡng nào.')).toBeInTheDocument();
  });

  it('hiện mỗi giai đoạn 1 thẻ theo thứ tự, kèm nhãn hình thức', async () => {
    renderDaDangNhap();
    const the = await cacTheGiaiDoan();
    expect(the.map((t) => within(t).getByRole('heading').textContent)).toEqual([
      'GĐ1 · Đánh giá đầu vào',
      'GĐ2 · Học trực tiếp',
      'GĐ3 · Học trực tuyến qua zoom',
      'GĐ4 · Học trực tuyến qua VLE',
    ]);
    expect(within(the[0]).getByText('Đánh giá')).toBeInTheDocument();
    expect(within(the[1]).getByText('Trực tiếp')).toBeInTheDocument();
  });

  it('giai đoạn có lớp: tên lớp, nhân sự đã dịch nhãn, buổi + điểm danh, tiến độ', async () => {
    renderDaDangNhap();
    const gd2 = (await cacTheGiaiDoan())[1];
    expect(within(gd2).getByText('Lớp 01 – Nhóm cơ bản A')).toBeInTheDocument();
    expect(within(gd2).getByText(/Giảng viên: Nguyễn Văn Long — 0909123456/)).toBeInTheDocument();
    expect(within(gd2).getByText(/Hỗ trợ: Trần Thị Mai/)).toBeInTheDocument();
    expect(within(gd2).getAllByText(/^Buổi \d$/)).toHaveLength(2);
    expect(within(gd2).getAllByText('Địa điểm: Hội trường A, THPT Long Xuyên')).toHaveLength(2);
    expect(within(gd2).getByText('Có mặt')).toBeInTheDocument();
    expect(within(gd2).getByText('Hoàn thành: 75%')).toBeInTheDocument();

    const gd3 = (await cacTheGiaiDoan())[2];
    expect(within(gd3).getByText('Lớp Zoom 01')).toBeInTheDocument();
    expect(within(gd3).getByRole('link', { name: 'Vào học' })).toHaveAttribute(
      'href',
      'https://vle.example.edu.vn/lop-1/buoi-2',
    );
    // Buổi chưa điểm danh (null) -> không hiện badge nào, tránh nhầm là "vắng".
    expect(within(gd3).queryByText('Vắng')).not.toBeInTheDocument();
  });

  // T10 (issue #2): buổi trực tiếp kèm điểm học (tên, địa chỉ, người liên hệ + SĐT gọi được) và phòng.
  it('buổi trực tiếp có điểm học: hiện tên + phòng, địa chỉ, người liên hệ với link gọi điện', async () => {
    const khoa = db.khoaHocToi[0];
    const gdCoLop = khoa.giai_doan[1];
    const buoiDau = gdCoLop.lop!.lich_hoc[0];
    server.use(
      http.get('/hoc-vien/toi/khoa-hoc', () =>
        HttpResponse.json([
          {
            ...khoa,
            giai_doan: khoa.giai_doan.map((g, i) =>
              i === 1
                ? {
                    ...g,
                    lop: {
                      ...g.lop!,
                      lich_hoc: [
                        {
                          ...buoiDau,
                          phong: 'P.101',
                          diem_hoc: {
                            id: 'dh-1',
                            ma_diem_hoc: 'AG-LX-01',
                            ten: 'THPT Long Xuyên',
                            dia_chi: '1 Trần Hưng Đạo',
                            nguoi_lien_he: 'Cô Lan',
                            sdt_lien_he: '0901000001',
                          },
                        },
                      ],
                    },
                  }
                : g,
            ),
          },
        ]),
      ),
    );
    renderDaDangNhap();
    const gd2 = (await cacTheGiaiDoan())[1];
    expect(within(gd2).getByText(/THPT Long Xuyên — phòng P\.101/)).toBeInTheDocument();
    expect(within(gd2).getByText('1 Trần Hưng Đạo')).toBeInTheDocument();
    expect(within(gd2).getByText(/Liên hệ: Cô Lan/)).toBeInTheDocument();
    expect(within(gd2).getByRole('link', { name: '0901000001' })).toHaveAttribute('href', 'tel:0901000001');
  });

  it('giai đoạn không lớp: hiện link + hướng dẫn chung của giai đoạn', async () => {
    renderDaDangNhap();
    const gd1 = (await cacTheGiaiDoan())[0];
    expect(within(gd1).getByRole('link', { name: 'Mở liên kết' })).toHaveAttribute(
      'href',
      'https://vle.example/danh-gia',
    );
    expect(within(gd1).getByText('Làm bài trong 60 phút')).toBeInTheDocument();
    expect(within(gd1).queryByText(/sẽ được cập nhật sau/)).not.toBeInTheDocument();
  });

  it('giai đoạn không lớp, không link, không hướng dẫn: chỉ tiêu đề + ngày + dòng nhắc, không lỗi', async () => {
    renderDaDangNhap();
    const gd4 = (await cacTheGiaiDoan())[3];
    expect(within(gd4).queryByRole('link')).not.toBeInTheDocument();
    expect(within(gd4).getByText('Thông tin lớp ở giai đoạn này sẽ được cập nhật sau.')).toBeInTheDocument();
  });

  it('cụm Zalo và kết quả đánh giá vẫn hiện như trước', async () => {
    renderDaDangNhap();
    expect(await screen.findByText('Cụm hỗ trợ Zalo: Cụm Long Xuyên')).toBeInTheDocument();
    expect(screen.getByText('Hỗ trợ kỹ thuật trong giờ hành chính')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Vào nhóm Zalo' })).toHaveAttribute(
      'href',
      'https://zalo.me/g/cum-long-xuyen',
    );
    expect(screen.getByText(/Đầu vào: Cơ bản/)).toBeInTheDocument();
    expect(screen.getByText(/Đầu ra: Chưa có kết quả/)).toBeInTheDocument();
  });

  it('chưa chốt mức đầu vào nhưng đã hoàn thành bài đánh giá trên hệ thống khảo sát -> hiện mức theo thang khảo sát + link chi tiết', async () => {
    server.use(
      http.get('/hoc-vien/toi/khoa-hoc', () =>
        HttpResponse.json([{ ...db.khoaHocToi[0], muc_dau_vao: null, muc_dau_ra: null }]),
      ),
    );
    datTinhTrangBai({
      loai: 'danh-gia',
      trang_thai: 'hoan_thanh',
      hoan_thanh_luc: '2026-10-05T07:50:56.000Z',
      muc_goc: 'M1',
      nhan_muc_goc: 'M1 – Chưa đạt',
      url_ket_qua: 'https://khaosat.test/ket-qua/abc',
    });
    renderDaDangNhap();
    expect(await screen.findByText(/Đầu vào: M1 – Chưa đạt/)).toBeInTheDocument();
    expect(screen.getByText(/hoàn thành lúc 05\/10\/2026 14:50/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Xem kết quả chi tiết' })).toHaveAttribute(
      'href',
      'https://khaosat.test/ket-qua/abc',
    );
    expect(screen.getByText(/Đầu ra: Chưa có kết quả/)).toBeInTheDocument();
  });

  it('đã chốt mức đầu vào -> ưu tiên mức chốt, không lấy kết quả khảo sát', async () => {
    datTinhTrangBai({ loai: 'danh-gia', trang_thai: 'hoan_thanh', muc_goc: 'M1', nhan_muc_goc: 'M1 – Chưa đạt' });
    renderDaDangNhap();
    expect(await screen.findByText(/Đầu vào: Cơ bản/)).toBeInTheDocument();
    expect(screen.queryByText(/M1 – Chưa đạt/)).not.toBeInTheDocument();
  });

  it('đang làm (chưa hoàn thành) -> vẫn "Chưa có kết quả"', async () => {
    server.use(
      http.get('/hoc-vien/toi/khoa-hoc', () => HttpResponse.json([{ ...db.khoaHocToi[0], muc_dau_vao: null }])),
    );
    datTinhTrangBai({ loai: 'danh-gia', trang_thai: 'dang_lam' });
    renderDaDangNhap();
    expect(await screen.findByText(/Đầu vào: Chưa có kết quả/)).toBeInTheDocument();
  });

  it('chưa được phân lớp ở giai đoạn nào → vẫn hiện đủ thẻ giai đoạn + dòng nhắc sau cùng, không có buổi học, không cụm', async () => {
    const dangKy: KhoaHocDangKy = {
      ...db.khoaHocToi[0],
      cum: null,
      giai_doan: db.khoaHocToi[0].giai_doan.map((g) => ({ ...g, lop: null })),
    };
    server.use(http.get('/hoc-vien/toi/khoa-hoc', () => HttpResponse.json([dangKy])));
    renderDaDangNhap();

    expect(await screen.findByText(dangKy.khoa.ten_khoa)).toBeInTheDocument();

    const the = await cacTheGiaiDoan();
    expect(the.map((t) => within(t).getByRole('heading').textContent)).toEqual([
      'GĐ1 · Đánh giá đầu vào',
      'GĐ2 · Học trực tiếp',
      'GĐ3 · Học trực tuyến qua zoom',
      'GĐ4 · Học trực tuyến qua VLE',
    ]);

    const ghiChu = screen.getAllByText(/sẽ được phân chia và cập nhật sau/);
    expect(ghiChu).toHaveLength(1);
    const theCuoi = the[the.length - 1];
    // eslint-disable-next-line no-bitwise
    expect(theCuoi.compareDocumentPosition(ghiChu[0]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    expect(screen.queryByText('Thông tin lớp ở giai đoạn này sẽ được cập nhật sau.')).not.toBeInTheDocument();
    expect(screen.queryByText(/^Buổi/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Cụm hỗ trợ Zalo/)).not.toBeInTheDocument();
  });

  it('chưa được phân lớp và khóa chưa có giai đoạn nào → thông báo lịch sẽ cập nhật sau, không có thẻ nào', async () => {
    const dangKy: KhoaHocDangKy = {
      ...db.khoaHocToi[0],
      cum: null,
      giai_doan: [],
    };
    server.use(http.get('/hoc-vien/toi/khoa-hoc', () => HttpResponse.json([dangKy])));
    renderDaDangNhap();

    expect(await screen.findByText('Lịch các giai đoạn của khóa học sẽ được cập nhật sau.')).toBeInTheDocument();
    expect(screen.queryByTestId('the-giai-doan')).not.toBeInTheDocument();
  });

  describe('giai đoạn đánh giá làm qua trang khảo sát (kênh sso, 2026-10-05)', () => {
    const locationGoc = window.location;
    afterEach(() => {
      Object.defineProperty(window, 'location', { configurable: true, value: locationGoc });
    });
    const datKenhSso = () =>
      datCauHinhKhaoSatMock({
        che_do_hoc_vien: 'dang_nhap',
        danh_gia_dau_vao_trong_cong: false,
        hien_khao_sat: true,
        kenh_danh_gia: 'sso',
        khao_sat_dau_ra_mo: false,
        phieu: [],
      });

    it('chưa làm -> GĐ1 hiện 2 bài với nút "Làm bài" (không còn "Mở liên kết"); bấm -> cấp mã SSO, chuyển cùng tab', async () => {
      datKenhSso();
      const assign = vi.fn();
      Object.defineProperty(window, 'location', { configurable: true, value: { ...locationGoc, assign } });
      const user = userEvent.setup();
      renderDaDangNhap();
      const gd1 = (await cacTheGiaiDoan())[0];
      expect(await within(gd1).findByText('1. Phiếu khảo sát kĩ năng số')).toBeInTheDocument();
      expect(within(gd1).getByText('2. Phiếu đánh giá năng lực số')).toBeInTheDocument();
      expect(within(gd1).queryByRole('link', { name: 'Mở liên kết' })).not.toBeInTheDocument();

      const daGui = ssoDaYeuCau.length;
      await user.click(within(within(gd1).getByLabelText('Phiếu đánh giá năng lực số')).getByRole('button', { name: 'Làm bài' }));
      await waitFor(() => expect(assign).toHaveBeenCalledTimes(1));
      expect(ssoDaYeuCau[daGui]).toBe('danh-gia');
    });

    it('đã làm xong -> GĐ1 chỉ hiện kết quả (mức + link chi tiết), không còn nút làm bài/mở lại', async () => {
      datKenhSso();
      datTinhTrangBai({ loai: 'khao-sat', trang_thai: 'hoan_thanh' });
      datTinhTrangBai({
        loai: 'danh-gia',
        trang_thai: 'hoan_thanh',
        hoan_thanh_luc: '2026-10-05T07:50:56.000Z',
        muc_goc: 'M1',
        nhan_muc_goc: 'M1 – Chưa đạt',
        url_ket_qua: 'https://khaosat.test/ket-qua/abc',
      });
      renderDaDangNhap();
      const gd1 = (await cacTheGiaiDoan())[0];
      const danhGia = await within(gd1).findByLabelText('Phiếu đánh giá năng lực số');
      expect(await within(danhGia).findByText('M1 – Chưa đạt')).toBeInTheDocument();
      expect(within(danhGia).getByRole('link', { name: 'Xem kết quả chi tiết' })).toHaveAttribute(
        'href',
        'https://khaosat.test/ket-qua/abc',
      );
      expect(within(gd1).queryByRole('button')).not.toBeInTheDocument();
      expect(within(gd1).queryByRole('link', { name: 'Mở liên kết' })).not.toBeInTheDocument();
    });

    it('kênh vle -> GĐ1 giữ nút "Mở liên kết" như cũ', async () => {
      renderDaDangNhap();
      const gd1 = (await cacTheGiaiDoan())[0];
      expect(within(gd1).getByRole('link', { name: 'Mở liên kết' })).toBeInTheDocument();
    });
  });
});
