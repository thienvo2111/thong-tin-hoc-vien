import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/mocks/server';
import { db, taoKhoaHocToiMau, taoKhoaHocToiZoomMau } from '@/test/mocks/db';
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
                    thuc_dia: [{ ho_ten: 'Anh Tâm', so_dien_thoai: '0933333333', nhiem_vu: 'Mở phòng' }],
                    lop: {
                      ...g.lop!,
                      lich_hoc: [
                        {
                          ...buoiDau,
                          phong: 'P.101',
                          giang_vien: [
                            { ho_ten: 'Nguyễn Văn Long', vai_tro: 'giang_vien' },
                            { ho_ten: 'Trần Thị Mai', vai_tro: 'ho_tro' },
                          ],
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
    // T11 (issue #3): giảng viên theo buổi (chỉ họ tên + vai trò).
    expect(within(gd2).getByText(/Nguyễn Văn Long, Trần Thị Mai \(hỗ trợ\)/)).toBeInTheDocument();
    // ADR 0004 G4 (issue #16): người hỗ trợ thực địa của đợt, SĐT gọi được.
    expect(within(gd2).getByText(/Hỗ trợ tại điểm học:/)).toBeInTheDocument();
    expect(within(gd2).getByRole('link', { name: '0933333333' })).toHaveAttribute('href', 'tel:0933333333');
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

  it('cụm Zalo và kết quả đánh giá vẫn hiện', async () => {
    renderDaDangNhap();
    expect(await screen.findByText('Cụm hỗ trợ Zalo: Cụm Long Xuyên')).toBeInTheDocument();
    expect(screen.getByText('Hỗ trợ kỹ thuật trong giờ hành chính')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Vào nhóm Zalo' })).toHaveAttribute(
      'href',
      'https://zalo.me/g/cum-long-xuyen',
    );
    expect(screen.getByText(/Mức chính thức/)).toHaveTextContent('Mức chính thức (xếp lớp): Cơ bản');
    // Khóa không có giai đoạn đánh giá đầu ra + chưa có kết quả đầu ra -> không hiện dòng thừa.
    expect(screen.queryByText(/Đầu ra:/)).not.toBeInTheDocument();
  });

  it('chưa chốt mức đầu vào nhưng đã hoàn thành bài đánh giá -> kết quả hệ thống + link chi tiết, mức chính thức "Chưa chốt"', async () => {
    server.use(
      http.get('/hoc-vien/toi/khoa-hoc', () =>
        HttpResponse.json([
          {
            ...db.khoaHocToi[0],
            muc_dau_vao: null,
            muc_dau_ra: null,
            muc_danh_gia: 'co_ban',
            nguon_muc_danh_gia: 'khao_sat',
            muc_he_thong: 'co_ban',
            nhan_muc_goc_danh_gia: 'M1 – Chưa đạt',
          },
        ]),
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
    expect(await screen.findByText(/Kết quả hệ thống/)).toHaveTextContent('M1 – Chưa đạt');
    expect(screen.getByText(/Mức chính thức/)).toHaveTextContent('Mức chính thức (xếp lớp): Chưa chốt');
    expect(screen.queryByText(/Đầu vào:/)).not.toBeInTheDocument();
    expect(screen.getByText(/Hoàn thành bài đánh giá lúc 05\/10\/2026 14:50/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Xem kết quả chi tiết' })).toHaveAttribute(
      'href',
      'https://khaosat.test/ket-qua/abc',
    );
    expect(screen.queryByText(/Đầu ra:/)).not.toBeInTheDocument();
  });

  it('đã chốt mức đầu vào -> mức chính thức theo chốt, vẫn hiện link bài làm', async () => {
    datTinhTrangBai({
      loai: 'danh-gia',
      trang_thai: 'hoan_thanh',
      muc_goc: 'M1',
      nhan_muc_goc: 'M1 – Chưa đạt',
      url_ket_qua: 'https://khaosat.test/ket-qua/abc',
    });
    renderDaDangNhap();
    expect(await screen.findByText(/Mức chính thức/)).toHaveTextContent('Mức chính thức (xếp lớp): Cơ bản');
    expect(screen.queryByText(/Đầu vào:/)).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Xem kết quả chi tiết' })).toHaveAttribute('href', 'https://khaosat.test/ket-qua/abc');
  });

  it('đang làm (chưa hoàn thành) -> kết quả hệ thống "Chưa có kết quả", không có link', async () => {
    server.use(
      http.get('/hoc-vien/toi/khoa-hoc', () =>
        HttpResponse.json([{ ...db.khoaHocToi[0], muc_dau_vao: null, muc_danh_gia: null, nguon_muc_danh_gia: null }]),
      ),
    );
    datTinhTrangBai({ loai: 'danh-gia', trang_thai: 'dang_lam' });
    renderDaDangNhap();
    expect(await screen.findByText(/Kết quả hệ thống/)).toHaveTextContent('Kết quả hệ thống: Chưa có kết quả');
    expect(screen.queryByRole('link', { name: 'Xem kết quả chi tiết' })).not.toBeInTheDocument();
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

  // 2026-10-08: kết quả đánh giá nằm trong thẻ giai đoạn đánh giá tương ứng, không còn khối cuối trang.
  describe('kết quả đánh giá trong thẻ giai đoạn', () => {
    const khoaCoDauRa = (): KhoaHocDangKy => {
      const goc = db.khoaHocToi[0];
      return {
        ...goc,
        muc_dau_ra: 'thanh_thao',
        giai_doan: [
          ...goc.giai_doan,
          { ...goc.giai_doan[0], id: 'gd-dau-ra', thu_tu: 5, ten_giai_doan: 'Đánh giá đầu ra', link_hoac_dia_diem: null },
        ],
      };
    };

    it('đầu vào + mức lớp học nằm trong thẻ GĐ1, đầu ra nằm trong thẻ đánh giá đầu ra, không có khối cuối trang', async () => {
      server.use(http.get('/hoc-vien/toi/khoa-hoc', () => HttpResponse.json([khoaCoDauRa()])));
      renderDaDangNhap();
      const the = await cacTheGiaiDoan();
      const gd1 = the[0];
      expect(within(gd1).getByText('Kết quả đánh giá đầu vào')).toBeInTheDocument();
      expect(within(gd1).getByText(/Mức chính thức/)).toHaveTextContent('Mức chính thức (xếp lớp): Cơ bản');
      expect(within(gd1).getByText(/Mức chính thức/)).toBeInTheDocument();
      expect(within(gd1).queryByText(/Đầu ra:/)).not.toBeInTheDocument();

      const gd5 = the[4];
      expect(within(gd5).getByText('Kết quả đánh giá đầu ra')).toBeInTheDocument();
      expect(within(gd5).getByText(/Đầu ra: Thành thạo/)).toBeInTheDocument();
      expect(within(gd5).queryByText(/Mức chính thức/)).not.toBeInTheDocument();

      // Các thẻ học không có kết quả đánh giá.
      the.slice(1, 4).forEach((t) => expect(within(t).queryByTestId('ket-qua-giai-doan')).not.toBeInTheDocument());
      expect(screen.queryByTestId('ket-qua-cuoi-trang')).not.toBeInTheDocument();
      expect(screen.getAllByText(/Mức chính thức/)).toHaveLength(1);
      expect(screen.getAllByText(/Đầu ra:/)).toHaveLength(1);
    });

    // 2026-10-09: khối cuối trang chỉ hiện mục có dữ liệu; không còn mục nào -> ẩn cả khối.
    it('chỉ có giai đoạn đánh giá đầu vào, chưa có kết quả đầu ra: ẩn khối cuối trang', async () => {
      renderDaDangNhap();
      const gd1 = (await cacTheGiaiDoan())[0];
      expect(within(gd1).getByText(/Mức chính thức/)).toHaveTextContent('Mức chính thức (xếp lớp): Cơ bản');
      expect(screen.queryByTestId('ket-qua-cuoi-trang')).not.toBeInTheDocument();
      expect(screen.queryByText(/Đầu ra:/)).not.toBeInTheDocument();
    });

    it('chỉ có giai đoạn đánh giá đầu vào, đã chốt mức đầu ra: đầu ra ở khối cuối trang', async () => {
      server.use(
        http.get('/hoc-vien/toi/khoa-hoc', () => HttpResponse.json([{ ...db.khoaHocToi[0], muc_dau_ra: 'nang_cao' }])),
      );
      renderDaDangNhap();
      const cuoi = await screen.findByTestId('ket-qua-cuoi-trang');
      expect(within(cuoi).getByText(/Đầu ra: Nâng cao/)).toBeInTheDocument();
      expect(within(cuoi).queryByText(/Mức chính thức/)).not.toBeInTheDocument();
      expect(within(cuoi).queryByText(/Mức chính thức/)).not.toBeInTheDocument();
    });

    it('chỉ có giai đoạn đánh giá đầu vào, bài đầu ra đã hoàn thành: đầu ra ở khối cuối trang', async () => {
      datTinhTrangBai({ loai: 'dau-ra', trang_thai: 'hoan_thanh', muc_goc: 'M3', nhan_muc_goc: 'M3 – Thành thạo' });
      renderDaDangNhap();
      const cuoi = await screen.findByTestId('ket-qua-cuoi-trang');
      expect(within(cuoi).getByText(/Đầu ra: M3 – Thành thạo/)).toBeInTheDocument();
    });

    it('không có giai đoạn đánh giá, chưa có kết quả nào: ẩn khối cuối trang', async () => {
      const goc = db.khoaHocToi[0];
      server.use(
        http.get('/hoc-vien/toi/khoa-hoc', () =>
          HttpResponse.json([
            {
              ...goc,
              muc_dau_vao: null,
              muc_danh_gia: null,
              nguon_muc_danh_gia: null,
              giai_doan: goc.giai_doan.filter((g) => g.hinh_thuc !== 'danh_gia'),
            },
          ]),
        ),
      );
      renderDaDangNhap();
      await cacTheGiaiDoan();
      expect(screen.queryByTestId('ket-qua-cuoi-trang')).not.toBeInTheDocument();
    });

    it('khóa không có giai đoạn đánh giá nào: giữ khối kết quả cuối trang (đầu vào, đầu ra, mức lớp học)', async () => {
      const goc = db.khoaHocToi[0];
      server.use(
        http.get('/hoc-vien/toi/khoa-hoc', () =>
          HttpResponse.json([{ ...goc, giai_doan: goc.giai_doan.filter((g) => g.hinh_thuc !== 'danh_gia') }]),
        ),
      );
      renderDaDangNhap();
      const the = await cacTheGiaiDoan();
      the.forEach((t) => expect(within(t).queryByTestId('ket-qua-giai-doan')).not.toBeInTheDocument());
      const cuoi = screen.getByTestId('ket-qua-cuoi-trang');
      expect(within(cuoi).getByText(/Mức chính thức/)).toHaveTextContent('Mức chính thức (xếp lớp): Cơ bản');
      expect(within(cuoi).queryByText(/Đầu ra:/)).not.toBeInTheDocument();
      expect(within(cuoi).getByText(/Mức chính thức/)).toBeInTheDocument();
    });

    it('khóa chưa có giai đoạn nào: kết quả vẫn hiện ở khối cuối trang', async () => {
      server.use(http.get('/hoc-vien/toi/khoa-hoc', () => HttpResponse.json([{ ...db.khoaHocToi[0], giai_doan: [] }])));
      renderDaDangNhap();
      const cuoi = await screen.findByTestId('ket-qua-cuoi-trang');
      expect(within(cuoi).getByText(/Mức chính thức/)).toHaveTextContent('Mức chính thức (xếp lớp): Cơ bản');
    });

    it('điều chỉnh nhu cầu mức ngay trong thẻ GĐ1 (chưa chốt), hiện thời điểm điều chỉnh', async () => {
      // ADR 0006: chưa chốt -> điều chỉnh nhu cầu theo mốc hệ thống.
      const dk = db.khoaHocToi[0];
      dk.muc_dau_vao = null;
      dk.muc_he_thong = 'nang_cao';
      dk.muc_danh_gia = 'nang_cao';
      dk.nguon_muc_danh_gia = 'khao_sat';
      dk.muc_hoc_chon = 'thanh_thao';
      dk.muc_hoc_chon_luc = '2026-10-08T03:05:00.000Z';
      dk.khoa.mo_dieu_chinh_muc = true;
      renderDaDangNhap();
      const gd1 = (await cacTheGiaiDoan())[0];
      expect(within(gd1).getByText(/Nhu cầu đã chọn:/)).toHaveTextContent('Nhu cầu đã chọn: Thành thạo');
      expect(within(gd1).getByText('Đã điều chỉnh lúc 08/10/2026 10:05')).toBeInTheDocument();
      expect(within(gd1).getByRole('button', { name: 'Điều chỉnh mức lớp' })).toBeInTheDocument();
    });
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

// ADR 0005 (issue #24): lớp Zoom của khóa đã bật điểm danh — backend giấu link, trả diem_danh_zoom.
describe('M7 — Điểm danh & vào Zoom', () => {
  async function theBuoiZoom() {
    const gd3 = (await cacTheGiaiDoan())[2];
    return within(gd3).getAllByTestId('the-buoi');
  }

  function renderZoom() {
    db.khoaHocToi = taoKhoaHocToiZoomMau();
    return renderDaDangNhap();
  }

  it('nhãn trạng thái từng buổi theo giờ máy chủ (hiển thị giờ VN)', async () => {
    renderZoom();
    const the = await theBuoiZoom();
    expect(within(the[0]).getByText('✅ Đã điểm danh 07:45')).toBeInTheDocument();
    expect(within(the[1]).getByText('Đang mở điểm danh')).toBeInTheDocument();
    expect(within(the[2]).getByText('Điểm danh mở lúc 07:30')).toBeInTheDocument();
    expect(within(the[3]).getByText('Đã đóng điểm danh')).toBeInTheDocument();
    expect(within(the[4]).getByText('Vắng')).toBeInTheDocument();
  });

  it('nút "Điểm danh & vào Zoom" chỉ ở buổi có link; không còn nút "Vào học" thẳng', async () => {
    renderZoom();
    const the = await theBuoiZoom();
    for (const t of the.slice(0, 4)) {
      expect(within(t).getByRole('button', { name: 'Điểm danh & vào Zoom' })).toBeInTheDocument();
    }
    expect(within(the[4]).queryByRole('button', { name: 'Điểm danh & vào Zoom' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Vào học' })).not.toBeInTheDocument();
  });

  it('khung cảnh báo vàng với số phút theo cấu hình khóa (120 phút -> "2 giờ")', async () => {
    renderZoom();
    const canhBao = await screen.findByTestId('canh-bao-diem-danh-zoom');
    expect(canhBao.textContent).toBe(
      '⚠️ Bắt buộc điểm danh từng buổi. Mỗi buổi học, hãy bấm nút Điểm danh & vào Zoom của đúng buổi đó (mở trước giờ học 30 phút, đóng sau giờ bắt đầu 2 giờ). Vào Zoom bằng link khác hoặc ở lại phòng từ buổi trước sẽ không được ghi nhận và bị tính vắng.',
    );
  });

  it('khung cảnh báo: khoảng đóng không tròn giờ -> "N phút"', async () => {
    const mau = taoKhoaHocToiZoomMau();
    const lich = mau[0].giai_doan[2].lop!.lich_hoc;
    lich[0] = {
      ...lich[0],
      diem_danh_zoom: { ...lich[0].diem_danh_zoom!, mo: '2026-10-12T00:45:00.000Z', dong: '2026-10-12T02:30:00.000Z' },
    };
    server.use(http.get('/hoc-vien/toi/khoa-hoc', () => HttpResponse.json(mau)));
    renderDaDangNhap();
    const canhBao = await screen.findByTestId('canh-bao-diem-danh-zoom');
    expect(canhBao.textContent).toContain('(mở trước giờ học 15 phút, đóng sau giờ bắt đầu 90 phút)');
  });

  // ADR 0005 Z8 (issue #27): chuyển lớp — buổi chưa có dòng ở lớp mới nhưng đã có ở lớp cũ (chỉ hiển thị).
  it('buổi có điểm danh ở lớp cũ -> dòng mờ "Buổi N: đã … ở {lớp} (lớp cũ)", không đổi nhãn Zoom', async () => {
    const mau = taoKhoaHocToiZoomMau();
    const lich = mau[0].giai_doan[2].lop!.lich_hoc;
    lich[3] = { ...lich[3], diem_danh_lop_cu: { trang_thai: 'co_mat', ten_lop: 'Lớp Zoom 07' } };
    lich[2] = { ...lich[2], diem_danh_lop_cu: { trang_thai: 'vang_co_phep', ten_lop: 'Lớp Zoom 07' } };
    server.use(http.get('/hoc-vien/toi/khoa-hoc', () => HttpResponse.json(mau)));
    renderDaDangNhap();
    const the = await theBuoiZoom();
    expect(within(the[3]).getByTestId('diem-danh-lop-cu')).toHaveTextContent(
      'Buổi 4: đã có mặt ở Lớp Zoom 07 (lớp cũ)',
    );
    expect(within(the[3]).getByText('Đã đóng điểm danh')).toBeInTheDocument();
    expect(within(the[2]).getByTestId('diem-danh-lop-cu')).toHaveTextContent(
      'Buổi 3: đã vắng có phép ở Lớp Zoom 07 (lớp cũ)',
    );
    expect(within(the[0]).queryByTestId('diem-danh-lop-cu')).not.toBeInTheDocument();
  });

  it('lớp không bật điểm danh Zoom vẫn hiện dòng lớp cũ (vắng)', async () => {
    const mau = taoKhoaHocToiMau();
    const lich = mau[0].giai_doan[1].lop!.lich_hoc;
    lich[1] = { ...lich[1], diem_danh_lop_cu: { trang_thai: 'vang', ten_lop: 'Lớp 02' } };
    server.use(http.get('/hoc-vien/toi/khoa-hoc', () => HttpResponse.json(mau)));
    renderDaDangNhap();
    const gd2 = (await cacTheGiaiDoan())[1];
    expect(within(gd2).getByTestId('diem-danh-lop-cu')).toHaveTextContent('Buổi 2: đã vắng ở Lớp 02 (lớp cũ)');
  });

  it('đã điểm danh buổi khác cùng ngày -> nhắc ở buổi chưa bấm cùng ngày, không nhắc buổi ngày khác', async () => {
    renderZoom();
    const the = await theBuoiZoom();
    const nhac = 'Buổi này cũng cần bấm điểm danh, kể cả khi bạn vẫn đang ở trong phòng Zoom.';
    expect(within(the[1]).getByText(nhac)).toBeInTheDocument();
    expect(within(the[0]).queryByText(nhac)).not.toBeInTheDocument();
    expect(within(the[2]).queryByText(nhac)).not.toBeInTheDocument();
  });

  it('da_ghi_nhan: hộp thoại xác nhận + "Mở phòng Zoom" là link cùng tab; tải lại trang lớp', async () => {
    let soLanTai = 0;
    const mau = taoKhoaHocToiZoomMau();
    server.use(
      http.get('/hoc-vien/toi/khoa-hoc', () => {
        soLanTai++;
        return HttpResponse.json(mau);
      }),
    );
    const user = userEvent.setup();
    renderDaDangNhap();
    const the = await theBuoiZoom();
    await user.click(within(the[1]).getByRole('button', { name: 'Điểm danh & vào Zoom' }));
    const hop = await screen.findByRole('dialog', { name: 'Buổi 2' });
    expect(within(hop).getByText('✅ Đã điểm danh buổi 2 lúc 12:40.')).toBeInTheDocument();
    const mo = within(hop).getByRole('link', { name: 'Mở phòng Zoom' });
    expect(mo).toHaveAttribute('href', 'https://zoom.us/j/999');
    expect(mo).not.toHaveAttribute('target');
    await waitFor(() => expect(soLanTai).toBe(2));
  });

  it('da_co: báo đã điểm danh lúc HH:mm + "Mở phòng Zoom"', async () => {
    db.vaoHocZoom = {
      ket_qua: 'da_co',
      trang_thai: 'co_mat',
      luc: '2026-10-12T05:35:00.000Z',
      link: 'zoom.us/j/999',
      mo: '2026-10-12T05:30:00.000Z',
      dong: '2026-10-12T08:00:00.000Z',
    };
    const user = userEvent.setup();
    renderZoom();
    const the = await theBuoiZoom();
    await user.click(within(the[1]).getByRole('button', { name: 'Điểm danh & vào Zoom' }));
    const hop = await screen.findByRole('dialog', { name: 'Buổi 2' });
    expect(within(hop).getByText('ℹ️ Bạn đã điểm danh buổi này lúc 12:35.')).toBeInTheDocument();
    const mo = within(hop).getByRole('link', { name: 'Mở phòng Zoom' });
    expect(mo).toHaveAttribute('href', 'https://zoom.us/j/999');
    expect(mo).not.toHaveAttribute('target');
  });

  it('qua_gio: cảnh báo không ghi nhận + "Vẫn vào Zoom"', async () => {
    db.vaoHocZoom = {
      ket_qua: 'qua_gio',
      mo: '2026-10-14T00:30:00.000Z',
      dong: '2026-10-14T03:00:00.000Z',
      link: 'https://zoom.us/j/444',
    };
    const user = userEvent.setup();
    renderZoom();
    const the = await theBuoiZoom();
    await user.click(within(the[3]).getByRole('button', { name: 'Điểm danh & vào Zoom' }));
    const hop = await screen.findByRole('dialog', { name: 'Buổi 4' });
    expect(
      within(hop).getByText('⚠️ Đã quá thời gian điểm danh (đóng lúc 10:00) nên lượt vào này không được ghi nhận.'),
    ).toBeInTheDocument();
    const mo = within(hop).getByRole('link', { name: 'Vẫn vào Zoom' });
    expect(mo).toHaveAttribute('href', 'https://zoom.us/j/444');
    expect(mo).not.toHaveAttribute('target');
  });

  it('chua_mo: báo giờ mở, chỉ có nút "Đóng", không link', async () => {
    db.vaoHocZoom = { ket_qua: 'chua_mo', mo: '2026-10-13T00:30:00.000Z', dong: '2026-10-13T03:00:00.000Z' };
    const user = userEvent.setup();
    renderZoom();
    const the = await theBuoiZoom();
    await user.click(within(the[2]).getByRole('button', { name: 'Điểm danh & vào Zoom' }));
    const hop = await screen.findByRole('dialog', { name: 'Buổi 3' });
    expect(within(hop).getByText('⏳ Chưa đến thời gian điểm danh — mở lúc 07:30.')).toBeInTheDocument();
    expect(within(hop).queryByRole('link')).not.toBeInTheDocument();
    await user.click(within(hop).getByRole('button', { name: 'Đóng' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Buổi 3' })).not.toBeInTheDocument());
  });

  it('lỗi API (vd 403 không thuộc lớp) -> hiện thông báo lỗi, không mở hộp thoại', async () => {
    server.use(
      http.post('/lich-hoc/:id/vao-hoc', () =>
        HttpResponse.json(
          { error: { code: 'FORBIDDEN', message: 'Thầy/Cô không thuộc lớp của buổi học này' } },
          { status: 403 },
        ),
      ),
    );
    const user = userEvent.setup();
    renderZoom();
    const the = await theBuoiZoom();
    await user.click(within(the[1]).getByRole('button', { name: 'Điểm danh & vào Zoom' }));
    expect(await within(the[1]).findByRole('alert')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('buổi không áp dụng (khóa chưa bật) vẫn hiện nút "Vào học" cũ, không cảnh báo vàng', async () => {
    renderDaDangNhap();
    const gd3 = (await cacTheGiaiDoan())[2];
    expect(within(gd3).getByRole('link', { name: 'Vào học' })).toHaveAttribute(
      'href',
      'https://vle.example.edu.vn/lop-1/buoi-2',
    );
    expect(within(gd3).queryByRole('button', { name: 'Điểm danh & vào Zoom' })).not.toBeInTheDocument();
    expect(screen.queryByTestId('canh-bao-diem-danh-zoom')).not.toBeInTheDocument();
  });

  describe('đổi buổi học', () => {
    // Lớp học trực tiếp có 1 buổi tương lai (lh-1) + 1 buổi đã đổi sang lớp khác (lh-2).
    function datKhoaDoiBuoi(soBuoi: number) {
      const [dk] = taoKhoaHocToiMau();
      const lop = dk.giai_doan[1].lop!;
      const batDau = (gio: number) => new Date(Date.now() + gio * 3600_000).toISOString();
      lop.lich_hoc = [
        { ...lop.lich_hoc[0], id: 'lh-tl', buoi_so: 1, thoi_gian_bat_dau: batDau(24), thoi_gian_ket_thuc: batDau(27), trang_thai: 'chua_dien_ra', trang_thai_diem_danh: null },
        {
          ...lop.lich_hoc[0],
          id: 'lh-doi',
          buoi_so: 2,
          thoi_gian_bat_dau: batDau(48),
          thoi_gian_ket_thuc: batDau(51),
          trang_thai: 'chua_dien_ra',
          trang_thai_diem_danh: null,
          da_doi_buoi: true,
          lich_goc_id: 'lh-goc',
          lop_goc_ten: 'Lớp 01',
          lop_chot_ten: 'Lớp 05',
        },
      ];
      dk.khoa = { ...dk.khoa, so_buoi_doi_toi_da: soBuoi };
      db.khoaHocToi = [dk];
    }

    it('khóa bật: buổi tương lai có link, buổi đã đổi có nhãn + lớp chốt và không có link', async () => {
      datKhoaDoiBuoi(2);
      renderDaDangNhap();
      const gd2 = (await cacTheGiaiDoan())[1];
      const links = within(gd2).getAllByRole('link', { name: 'Không tham gia được buổi này?' });
      expect(links).toHaveLength(1);
      expect(links[0]).toHaveAttribute('href', '/de-nghi-doi-buoi?khoa=khoa-1&lich=lh-tl');
      expect(within(gd2).getByText('Đã đổi buổi')).toBeInTheDocument();
      expect(within(gd2).getByTestId('lop-chot')).toHaveTextContent('Lớp 05');
      // Buổi đã đổi: link "Đổi lại" trỏ về buổi gốc để mở đề nghị đã duyệt.
      expect(within(gd2).getByRole('link', { name: 'Muốn đổi lại buổi này?' })).toHaveAttribute(
        'href',
        '/de-nghi-doi-buoi?khoa=khoa-1&lich=lh-goc',
      );
    });

    it('buổi đã có điểm danh (Zoom mở trước giờ) → ẩn cả 2 link đổi buổi', async () => {
      datKhoaDoiBuoi(2);
      for (const b of db.khoaHocToi[0].giai_doan[1].lop!.lich_hoc) b.trang_thai_diem_danh = 'co_mat';
      renderDaDangNhap();
      const gd2 = (await cacTheGiaiDoan())[1];
      expect(within(gd2).getByText('Đã đổi buổi')).toBeInTheDocument();
      expect(within(gd2).queryByRole('link', { name: 'Không tham gia được buổi này?' })).not.toBeInTheDocument();
      expect(within(gd2).queryByRole('link', { name: 'Muốn đổi lại buổi này?' })).not.toBeInTheDocument();
    });

    it('khóa tắt (0 lượt): không có link', async () => {
      datKhoaDoiBuoi(0);
      renderDaDangNhap();
      const gd2 = (await cacTheGiaiDoan())[1];
      expect(within(gd2).queryByRole('link', { name: 'Không tham gia được buổi này?' })).not.toBeInTheDocument();
      expect(within(gd2).queryByRole('link', { name: 'Muốn đổi lại buổi này?' })).not.toBeInTheDocument();
    });
  });

  describe('học bù (ADR 0012)', () => {
    // lh-qua: buổi đã qua, vắng, được học bù; lh-hb: ô học bù đã duyệt (tương lai) cho buổi 1 lớp 01.
    function datKhoaHocBu(doiBuoi: number) {
      const [dk] = taoKhoaHocToiMau();
      const lop = dk.giai_doan[1].lop!;
      const luc = (gio: number) => new Date(Date.now() + gio * 3600_000).toISOString();
      lop.lich_hoc = [
        { ...lop.lich_hoc[0], id: 'lh-qua', buoi_so: 1, thoi_gian_bat_dau: luc(-48), thoi_gian_ket_thuc: luc(-45), trang_thai: 'ket_thuc', trang_thai_diem_danh: 'vang', hoc_bu_duoc: true },
        { ...lop.lich_hoc[0], id: 'lh-vang2', buoi_so: 2, thoi_gian_bat_dau: luc(-24), thoi_gian_ket_thuc: luc(-21), trang_thai: 'ket_thuc', trang_thai_diem_danh: 'vang', hoc_bu_duoc: false },
        {
          ...lop.lich_hoc[0],
          id: 'lh-hb',
          buoi_so: 1,
          thoi_gian_bat_dau: luc(24),
          thoi_gian_ket_thuc: luc(27),
          trang_thai: 'chua_dien_ra',
          trang_thai_diem_danh: null,
          hoc_bu: true,
          lich_goc_id: 'lh-qua',
          lop_goc_ten: 'Lớp 01',
          lop_chot_ten: 'Lớp 05',
        },
      ];
      dk.khoa = { ...dk.khoa, so_buoi_doi_toi_da: doiBuoi, so_buoi_hoc_bu_toi_da: 2 };
      db.khoaHocToi = [dk];
    }

    it('buổi đã qua có hoc_bu_duoc → link học bù đúng href (kể cả khóa tắt đổi buổi); buổi không cờ thì không', async () => {
      datKhoaHocBu(0);
      renderDaDangNhap();
      const gd2 = (await cacTheGiaiDoan())[1];
      const links = within(gd2).getAllByRole('link', { name: 'Đăng ký học bù buổi này?' });
      expect(links).toHaveLength(1);
      expect(links[0]).toHaveAttribute('href', '/de-nghi-doi-buoi?khoa=khoa-1&lich=lh-qua&loai=hoc_bu');
    });

    it('ô học bù đã duyệt: nhãn Học bù + "Học bù cho buổi 1 của Lớp 01", không có link Đổi buổi', async () => {
      datKhoaHocBu(2);
      renderDaDangNhap();
      const gd2 = (await cacTheGiaiDoan())[1];
      expect(within(gd2).getByText('Học bù')).toBeInTheDocument();
      expect(within(gd2).getByTestId('hoc-bu-cho')).toHaveTextContent('Học bù cho buổi 1 của Lớp 01 — học tại Lớp 05');
      // Buổi học bù ở tương lai nhưng KHÔNG mời đổi buổi (chỉ buổi gốc mới đổi được).
      expect(within(gd2).queryByRole('link', { name: 'Không tham gia được buổi này?' })).not.toBeInTheDocument();
    });
  });
});
