import { LIEN_HE, boCucEmail, e, laLienKet } from './bo-cuc';
import {
  GiaiDoanTrongEmail,
  gio,
  mauDatLaiMatKhau,
  mauKetQuaHocTap,
  mauLichHoc,
  thuNgay,
} from './mau-email';

// Kịch bản (yêu cầu 2026-10-01 — mẫu email nhận diện HCMUE thay định dạng
// mặc định): khung chung có liên hệ boiduongnls@hcmue.edu.vn; dữ liệu động
// luôn được escape; link lạ không thành href; giờ hiển thị theo giờ Việt Nam;
// lịch gom & sắp theo giai đoạn; đủ 4 trạng thái kết quả học tập.

describe('bo-cuc', () => {
  it('e() escape đủ 5 ký tự đặc biệt, null/undefined -> chuỗi rỗng', () => {
    expect(e(`<a href="x">'&'</a>`)).toBe(
      '&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;',
    );
    expect(e(null)).toBe('');
    expect(e(undefined)).toBe('');
  });

  it('laLienKet chỉ nhận http(s)', () => {
    expect(laLienKet('https://zoom.us/j/1')).toBe(true);
    expect(laLienKet('  http://a.vn ')).toBe(true);
    expect(laLienKet('javascript:alert(1)')).toBe(false);
    expect(laLienKet('Hội trường A')).toBe(false);
    expect(laLienKet(null)).toBe(false);
  });

  it('khung chung có chân trang liên hệ + website và escape tiêu đề', () => {
    const html = boCucEmail({
      xemTruoc: 'xt',
      nhan: 'NHÃN',
      tieuDe: '<script>',
      noiDung: '<p>body</p>',
    });
    expect(html).toContain(`mailto:${LIEN_HE.email}`);
    expect(html).toContain(LIEN_HE.websiteHienThi);
    expect(html).toContain('TRƯỜNG ĐẠI HỌC SƯ PHẠM THÀNH PHỐ HỒ CHÍ MINH');
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<script>');
    expect(html).toContain('<p>body</p>');
  });
});

describe('giờ Việt Nam', () => {
  it('đổi UTC sang UTC+7, kể cả khi qua ngày', () => {
    const d = new Date('2026-10-03T17:30:00Z'); // 00:30 ngày 04/10 giờ VN
    expect(gio(d)).toBe('00:30');
    expect(thuNgay(d)).toBe('Chủ nhật, 04/10/2026');
  });
});

describe('mauDatLaiMatKhau', () => {
  const link = 'https://boiduongnls.hcmue.edu.vn/dat-lai-mat-khau?token=abc';

  it('có nút + link dự phòng + thời hạn, tiêu đề có tiền tố', () => {
    const { tieuDe, html } = mauDatLaiMatKhau({
      hoTen: 'Nguyễn Văn A',
      link,
      thoiHanPhut: 30,
    });
    expect(tieuDe).toBe('[BDNLS] Yêu cầu đặt lại mật khẩu');
    expect(html).toContain('Đặt lại mật khẩu');
    expect(html.split(`href="${link}"`).length - 1).toBe(2);
    expect(html).toContain('30 phút');
    expect(html).toContain('Nguyễn Văn A');
  });

  it('escape họ tên', () => {
    const { html } = mauDatLaiMatKhau({
      hoTen: '<img src=x onerror=1>',
      link,
      thoiHanPhut: 30,
    });
    expect(html).not.toContain('<img src=x');
  });
});

describe('mauLichHoc', () => {
  const coBan = {
    hoTen: 'Trần Thị B',
    tenKhoa: 'NLS An Giang',
    maKhoa: 'AG-01',
    linkLopHoc: 'https://boiduongnls.hcmue.edu.vn/toi/lop-hoc',
  };
  const gd = (
    thuTu: number,
    ten: string,
    buoi: GiaiDoanTrongEmail['buoi'] = [],
  ): GiaiDoanTrongEmail => ({
    thuTu,
    ten,
    hinhThuc: 'truc_tuyen',
    tuNgay: new Date('2026-10-01T00:00:00Z'),
    denNgay: new Date('2026-10-31T00:00:00Z'),
    buoi,
  });

  it('liệt kê lớp, nhân sự (có SĐT), giai đoạn sắp theo thứ tự, buổi theo giờ', () => {
    const { tieuDe, html } = mauLichHoc({
      ...coBan,
      lop: [
        {
          loaiLop: 'truc_tiep',
          tenLop: 'Lớp TT 1',
          nhanSu: [
            { hoTen: 'GV Lê C', vaiTro: 'giang_vien', soDienThoai: '0909' },
          ],
        },
        { loaiLop: 'zoom', tenLop: 'Zoom 2', nhanSu: [] },
      ],
      giaiDoan: [
        gd(2, 'Giai đoạn hai'),
        gd(1, 'Giai đoạn một', [
          {
            loaiLop: 'zoom',
            buoiSo: 2,
            batDau: new Date('2026-10-05T12:00:00Z'),
            ketThuc: new Date('2026-10-05T14:00:00Z'),
            diaDiemHoacLink: 'https://zoom.us/j/9',
          },
          {
            loaiLop: 'truc_tiep',
            buoiSo: 1,
            batDau: new Date('2026-10-04T00:30:00Z'),
            ketThuc: new Date('2026-10-04T04:00:00Z'),
            diaDiemHoacLink: 'Phòng A.101',
          },
        ]),
      ],
    });
    expect(tieuDe).toBe('[BDNLS] Lịch học khóa NLS An Giang');
    expect(html).toContain('Lớp TT 1');
    expect(html).toContain('Zoom 2');
    expect(html).toContain('ĐT: 0909');
    expect(html.indexOf('Giai đoạn một')).toBeLessThan(
      html.indexOf('Giai đoạn hai'),
    );
    expect(html.indexOf('Chủ nhật, 04/10/2026')).toBeLessThan(
      html.indexOf('Thứ Hai, 05/10/2026'),
    );
    expect(html).toContain('07:30 – 11:00 · Buổi 1');
    expect(html).toContain('href="https://zoom.us/j/9"');
    expect(html).toContain('Phòng A.101');
    // giai đoạn 2 không có buổi -> báo chưa có lịch
    expect(html).toContain('Chưa có lịch chi tiết cho giai đoạn này');
  });

  it('khóa chưa có giai đoạn nào -> báo lịch đang cập nhật, không có mục nhân sự', () => {
    const { html } = mauLichHoc({
      ...coBan,
      lop: [{ loaiLop: 'truc_tiep', tenLop: 'L1', nhanSu: [] }],
      giaiDoan: [],
    });
    expect(html).toContain('Lịch học đang được cập nhật');
    expect(html).not.toContain('Giảng viên &amp; hỗ trợ lớp');
  });

  it('địa điểm javascript: không thành link, địa điểm trống -> "Sẽ thông báo sau"', () => {
    const { html } = mauLichHoc({
      ...coBan,
      lop: [{ loaiLop: 'truc_tiep', tenLop: 'L1', nhanSu: [] }],
      giaiDoan: [
        gd(1, 'GĐ', [
          {
            loaiLop: 'truc_tiep',
            buoiSo: 1,
            batDau: new Date('2026-10-04T00:00:00Z'),
            ketThuc: new Date('2026-10-04T01:00:00Z'),
            diaDiemHoacLink: 'javascript:alert(1)',
          },
          {
            loaiLop: 'truc_tiep',
            buoiSo: 2,
            batDau: new Date('2026-10-05T00:00:00Z'),
            ketThuc: new Date('2026-10-05T01:00:00Z'),
            diaDiemHoacLink: null,
          },
        ]),
      ],
    });
    expect(html).not.toContain('href="javascript:');
    expect(html).toContain('Sẽ thông báo sau');
  });
});

describe('mauKetQuaHocTap', () => {
  const coBan = {
    hoTen: 'Phạm D',
    tenKhoa: 'NLS',
    maKhoa: 'K1',
    ngayHoanThanh: null,
    mucDauVao: null,
    mucDauRa: null,
    giaiDoan: [],
    linkCongThongTin: 'https://boiduongnls.hcmue.edu.vn/toi/lop-hoc',
  };

  it.each([
    ['dat', 'Đạt', 'Chúc mừng'],
    ['khong_dat', 'Không đạt', 'chưa đạt yêu cầu'],
    ['vang', 'Vắng', 'ghi nhận Thầy/Cô vắng'],
    ['dang_hoc', 'Đang học', 'vẫn đang diễn ra'],
  ] as const)(
    'ket_qua=%s -> nhãn "%s" + lời nhắn phù hợp',
    (kq, nhan, loiNhan) => {
      const { tieuDe, html } = mauKetQuaHocTap({ ...coBan, ketQua: kq });
      expect(tieuDe).toBe('[BDNLS] Kết quả học tập khóa NLS');
      expect(html).toContain(`>${nhan}</span>`);
      expect(html).toContain(loiNhan);
    },
  );

  it('ket_qua=null -> coi như Đang học', () => {
    const { html } = mauKetQuaHocTap({ ...coBan, ketQua: null });
    expect(html).toContain('>Đang học</span>');
  });

  it('có ngày hoàn thành, mức đầu vào/ra, kết quả từng giai đoạn sắp theo thứ tự', () => {
    const { html } = mauKetQuaHocTap({
      ...coBan,
      ketQua: 'dat',
      ngayHoanThanh: new Date('2026-12-20T00:00:00Z'),
      mucDauVao: 'co_ban',
      mucDauRa: 'nang_cao',
      giaiDoan: [
        { thuTu: 2, ten: 'GĐ hai', tyLeHoanThanh: null, diem: 8.25 },
        { thuTu: 1, ten: 'GĐ một', tyLeHoanThanh: 100, diem: null },
        { thuTu: 3, ten: 'GĐ ba', tyLeHoanThanh: null, diem: null },
      ],
    });
    expect(html).toContain('20/12/2026');
    expect(html).toContain('Cơ bản');
    expect(html).toContain('Nâng cao');
    expect(html.indexOf('1. GĐ một')).toBeLessThan(html.indexOf('2. GĐ hai'));
    expect(html).toContain('Hoàn thành 100%');
    expect(html).toContain('Điểm 8,25');
    expect(html).toContain('>—</td>');
  });

  it('không có giai đoạn/mức năng lực -> bỏ các dòng đó', () => {
    const { html } = mauKetQuaHocTap({ ...coBan, ketQua: 'dat' });
    expect(html).not.toContain('Kết quả theo giai đoạn');
    expect(html).not.toContain('Mức năng lực đầu vào');
    expect(html).not.toContain('Ngày hoàn thành');
  });
});
