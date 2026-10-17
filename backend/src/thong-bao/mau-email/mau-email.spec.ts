import { LIEN_HE, boCucEmail, e, laLienKet } from './bo-cuc';
import {
  GiaiDoanTrongEmail,
  gio,
  mauDatLaiMatKhau,
  mauKetQuaHocTap,
  mauLichGiangDay,
  MauLichGiangDayInput,
  mauLichHoc,
  mauXacNhanHoSo,
  HoSoTrongEmail,
  anCccd,
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

  it('buổi Zoom điểm danh trên Cổng -> không có link Zoom, dẫn về trang lớp; buổi khác giữ link', () => {
    const { html } = mauLichHoc({
      ...coBan,
      lop: [{ loaiLop: 'zoom', tenLop: 'Z1', nhanSu: [] }],
      giaiDoan: [
        gd(1, 'GĐ', [
          {
            loaiLop: 'zoom',
            buoiSo: 1,
            batDau: new Date('2026-10-04T00:00:00Z'),
            ketThuc: new Date('2026-10-04T01:00:00Z'),
            diaDiemHoacLink: 'https://zoom.us/j/an-di',
            diemDanhTrenCong: true,
          },
          {
            loaiLop: 'zoom',
            buoiSo: 2,
            batDau: new Date('2026-10-05T00:00:00Z'),
            ketThuc: new Date('2026-10-05T01:00:00Z'),
            diaDiemHoacLink: 'https://zoom.us/j/giu-lai',
          },
        ]),
      ],
    });
    expect(html).not.toContain('an-di');
    expect(html).toContain('Vào học và điểm danh bằng nút trên Cổng thông tin');
    expect(html).toContain(`href="${coBan.linkLopHoc}"`);
    expect(html).toContain('href="https://zoom.us/j/giu-lai"');
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

describe('mauXacNhanHoSo', () => {
  const day: HoSoTrongEmail = {
    maDinhDanhMoet: '8912345678',
    hoTen: 'Hà Thị Thanh',
    ngaySinh: 11,
    thangSinh: 9,
    namSinh: 1988,
    gioiTinh: 'nu',
    soDinhDanhCaNhan: '089188001234',
    noiSinh: ['Xã Mỹ Hòa', null, 'Tỉnh An Giang'],
    cuTru: ['Phường Long Xuyên', 'Tỉnh An Giang'],
    donViCongTac: 'Trường THPT Long Xuyên',
    chucVu: 'Giáo viên',
    doiTuong: 'giao_vien',
    soDienThoai: '0979427164',
    email: 'thanh@example.com',
    trinhDo: 'dai_hoc',
    trinhDoKhac: null,
    chuyenMon: ['Công nghệ', 'Tin học'],
    capGiangDay: 'thpt',
    monGiangDay: 'Công nghệ',
  };
  const link = 'https://boiduongnls.hcmue.edu.vn/toi/ho-so';

  it('đủ 16 trường đúng thứ tự trang Xác nhận, nhãn tiếng Việt', () => {
    const { tieuDe, html } = mauXacNhanHoSo({ hoSo: day, linkHoSo: link });
    expect(tieuDe).toBe('[HCMUE-BDNLS] Xác nhận thông tin đã khai báo');
    const nhan = [
      'Mã định danh CSDL ngành',
      'Họ và tên',
      'Ngày sinh',
      'Giới tính',
      'Số CCCD',
      'Nơi sinh',
      'Cư trú',
      'Đơn vị công tác',
      'Chức vụ',
      'Đối tượng',
      'Số điện thoại',
      'Email',
      'Trình độ chuyên môn',
      'Chuyên môn',
      'Cấp giảng dạy',
      'Môn giảng dạy',
    ];
    const viTri = nhan.map((n) => html.indexOf(`>${n}</td>`));
    expect(viTri.every((v) => v > 0)).toBe(true);
    expect([...viTri].sort((a, b) => a - b)).toEqual(viTri);
    for (const giaTri of [
      '8912345678',
      '11/09/1988',
      'Nữ',
      'Xã Mỹ Hòa, Tỉnh An Giang',
      'Phường Long Xuyên, Tỉnh An Giang',
      'Trường THPT Long Xuyên',
      'Giáo viên',
      '0979427164',
      'thanh@example.com',
      'Đại học',
      'Công nghệ, Tin học',
      'THPT',
    ]) {
      expect(html).toContain(giaTri);
    }
    expect(html).not.toContain('(chưa khai báo)');
  });

  it('CCCD chỉ hiện 4 số cuối', () => {
    const { html } = mauXacNhanHoSo({ hoSo: day, linkHoSo: link });
    expect(html).not.toContain('089188001234');
    expect(html).toContain('••••••••1234');
    expect(anCccd('123')).toBe('123');
  });

  it('trường trống/null -> "(chưa khai báo)", không có chuỗi "null"', () => {
    const { html } = mauXacNhanHoSo({
      hoSo: {
        ...day,
        maDinhDanhMoet: null,
        gioiTinh: null,
        soDinhDanhCaNhan: null,
        noiSinh: [null, null, null],
        cuTru: [null, '  '],
        donViCongTac: null,
        chucVu: '',
        soDienThoai: null,
        trinhDo: null,
        chuyenMon: [],
        capGiangDay: null,
        monGiangDay: null,
      },
      linkHoSo: link,
    });
    expect(html.split('(chưa khai báo)').length - 1).toBe(12);
    expect(html).not.toMatch(/>null</);
  });

  it('trình độ "khac" -> hiện mô tả tự nhập; "khac" không mô tả -> "Khác"', () => {
    const coMoTa = mauXacNhanHoSo({
      hoSo: { ...day, trinhDo: 'khac', trinhDoKhac: 'Chuyên khoa I' },
      linkHoSo: link,
    }).html;
    expect(coMoTa).toContain('Chuyên khoa I');
    const khongMoTa = mauXacNhanHoSo({
      hoSo: { ...day, trinhDo: 'khac', trinhDoKhac: null },
      linkHoSo: link,
    }).html;
    expect(khongMoTa).toContain('>Khác</td>');
  });

  it('escape dữ liệu tự nhập', () => {
    const { html } = mauXacNhanHoSo({
      hoSo: { ...day, chucVu: '<b>Tổ trưởng</b>' },
      linkHoSo: link,
    });
    expect(html).toContain('&lt;b&gt;Tổ trưởng&lt;/b&gt;');
  });

  describe('Đối tượng (GV/CBQL)', () => {
    it.each([
      ['giao_vien', 'Giáo viên'],
      ['can_bo_quan_ly', 'Cán bộ quản lý'],
    ] as const)(
      '%s -> "%s", nằm ngay sau Chức vụ, trước Số điện thoại',
      (dt, nhan) => {
        const { html } = mauXacNhanHoSo({
          hoSo: { ...day, doiTuong: dt },
          linkHoSo: link,
        });
        const viTri = ['Chức vụ', 'Đối tượng', 'Số điện thoại'].map((n) =>
          html.indexOf(`>${n}</td>`),
        );
        expect(viTri[0]).toBeGreaterThan(0);
        expect(viTri[0]).toBeLessThan(viTri[1]);
        expect(viTri[1]).toBeLessThan(viTri[2]);
        expect(html).toContain(nhan);
      },
    );

    it('null (chưa chọn) -> "(chưa khai báo)"', () => {
      const { html } = mauXacNhanHoSo({
        hoSo: { ...day, doiTuong: null },
        linkHoSo: link,
      });
      expect(html).toContain('>Đối tượng</td>');
      expect(html.split('(chưa khai báo)').length - 1).toBe(1);
    });
  });
});

// ADR 0009: email lịch giảng dạy theo (khóa × giai đoạn × giảng viên).
describe('mauLichGiangDay', () => {
  const t = (iso: string) => new Date(iso);
  const coBan = (): MauLichGiangDayInput => ({
    hoTen: 'Nguyễn Văn An',
    tenKhoa: 'Bồi dưỡng NLS An Giang',
    maKhoa: 'AG-2026-01',
    giaiDoan: {
      ten: 'Giai đoạn 2',
      hinhThuc: 'truc_tiep',
      tuNgay: t('2026-10-24T00:00:00Z'),
      denNgay: t('2026-10-30T00:00:00Z'),
    },
    lop: [
      {
        tenLop: 'TT-03',
        loaiLop: 'truc_tiep',
        vaiTro: 'giang_vien',
        buoi: [
          // Cố ý đảo thứ tự: hàm phải tự sắp theo giờ bắt đầu.
          {
            buoiSo: 2,
            batDau: t('2026-10-24T06:30:00Z'),
            ketThuc: t('2026-10-24T09:30:00Z'),
            diemHoc: { ten: 'THPT Long Xuyên', diaChi: '12 Trần Hưng Đạo' },
            phong: 'A2.05',
            diaDiemHoacLink: null,
            coThayDoi: false,
          },
          {
            buoiSo: 1,
            batDau: t('2026-10-24T00:30:00Z'),
            ketThuc: t('2026-10-24T04:30:00Z'),
            diemHoc: { ten: 'THPT Long Xuyên', diaChi: '12 Trần Hưng Đạo' },
            phong: 'A2.05',
            diaDiemHoacLink: null,
            coThayDoi: false,
          },
          {
            buoiSo: 3,
            batDau: t('2026-10-25T00:30:00Z'),
            ketThuc: t('2026-10-25T04:30:00Z'),
            diemHoc: null,
            phong: null,
            diaDiemHoacLink: 'Hội trường B',
            coThayDoi: false,
          },
        ],
        hauCan: {
          noiOTen: 'Khách sạn Đông Xuyên',
          noiODiaChi: '9A Lương Văn Cù',
          nhanPhong: t('2026-10-23T00:00:00Z'),
          traPhong: t('2026-10-25T00:00:00Z'),
          phuongTien: 'Xe 7 chỗ',
          donLuc: t('2026-10-22T22:00:00Z'),
          diemDon: '280 An Dương Vương',
          lienHeDon: 'Hùng 0909',
        },
        thucDia: [{ hoTen: 'Trần Thị B', soDienThoai: '0912345678' }],
      },
      {
        tenLop: 'Zoom-07',
        loaiLop: 'zoom',
        vaiTro: 'ho_tro',
        buoi: [
          {
            buoiSo: 1,
            batDau: t('2026-10-28T12:00:00Z'),
            ketThuc: t('2026-10-28T14:00:00Z'),
            diemHoc: null,
            phong: null,
            diaDiemHoacLink: 'https://zoom.us/j/1',
            coThayDoi: false,
          },
          {
            buoiSo: 2,
            batDau: t('2026-10-30T12:00:00Z'),
            ketThuc: t('2026-10-30T14:00:00Z'),
            diemHoc: null,
            phong: null,
            diaDiemHoacLink: null,
            coThayDoi: false,
          },
        ],
        hauCan: null,
        thucDia: [],
      },
    ],
    nhomHoTro: [{ hoTen: 'Lê Văn C', email: 'levanc@hcmue.edu.vn' }],
    linkCongGiangVien: 'https://boiduongnls.hcmue.edu.vn/giang-day',
    capNhat: null,
  });

  it('5a: tiêu đề, nhãn, tổng số buổi/lớp, vai trò theo từng lớp', () => {
    const { tieuDe, html } = mauLichGiangDay(coBan());
    expect(tieuDe).toBe('[BDNLS] Lịch giảng dạy Giai đoạn 2 – khóa AG-2026-01');
    expect(html).toContain('LỊCH GIẢNG DẠY');
    expect(html).not.toContain('CẬP NHẬT LỊCH GIẢNG DẠY');
    expect(html).toContain('5 buổi · 2 lớp');
    expect(html).toContain('Vai trò: Giảng viên');
    expect(html).toContain('Vai trò: Hỗ trợ');
    expect(html).toContain('Trực tiếp · 24/10/2026 – 30/10/2026');
  });

  it('sắp buổi trong lớp theo giờ bắt đầu dù input bị đảo', () => {
    const { html } = mauLichGiangDay(coBan());
    expect(html.indexOf('· Buổi 1<')).toBeLessThan(html.indexOf('· Buổi 2<'));
  });

  it('giờ hiển thị theo giờ Việt Nam, kể cả khi sang ngày mới', () => {
    const p = coBan();
    p.lop[1].buoi[0].batDau = t('2026-10-24T17:30:00Z');
    p.lop[1].buoi[0].ketThuc = t('2026-10-24T19:00:00Z');
    const { html } = mauLichGiangDay(p);
    expect(html).toContain('Chủ nhật, 25/10/2026');
    expect(html).toContain('00:30 – 02:00');
  });

  it('địa điểm: điểm học + bản đồ, Zoom, chữ thường, rỗng', () => {
    const { html } = mauLichGiangDay(coBan());
    expect(html).toContain('THPT Long Xuyên');
    expect(html).toContain('phòng A2.05');
    expect(html).toContain('google.com/maps');
    expect(html).toContain('href="https://zoom.us/j/1"');
    expect(html).toContain('Vào phòng Zoom');
    expect(html).toContain('Hội trường B');
    expect(html).toContain('Đang cập nhật');
  });

  it('link https ở lớp không phải Zoom -> "Mở liên kết"; javascript: không thành href', () => {
    const p = coBan();
    p.lop[0].buoi[2].diaDiemHoacLink = 'https://meet.example/x';
    p.lop[1].buoi[1].diaDiemHoacLink = 'javascript:alert(1)';
    const { html } = mauLichGiangDay(p);
    expect(html).toContain('Mở liên kết');
    expect(html).not.toContain('href="javascript');
  });

  it('hậu cần + thực địa chỉ hiện khi có dữ liệu', () => {
    const { html } = mauLichGiangDay(coBan());
    expect(html).toContain('Khách sạn Đông Xuyên');
    expect(html).toContain('Đưa đón');
    expect(html).toContain('Trần Thị B');
    const p = coBan();
    p.lop[0].hauCan = null;
    p.lop[0].thucDia = [];
    const html2 = mauLichGiangDay(p).html;
    expect(html2).not.toContain('Chỗ ở');
    expect(html2).not.toContain('Đưa đón');
    expect(html2).not.toContain('Hỗ trợ tại điểm học');
  });

  it('nút Cổng giảng viên chỉ hiện khi có link', () => {
    expect(mauLichGiangDay(coBan()).html).toContain(
      'href="https://boiduongnls.hcmue.edu.vn/giang-day"',
    );
    const p = coBan();
    p.linkCongGiangVien = null;
    expect(mauLichGiangDay(p).html).not.toContain(
      'Xem lịch dạy trên Cổng giảng viên',
    );
  });

  it('5b: tiêu đề cập nhật, giờ lần trước, huy hiệu đúng số buổi, khối buổi bị gỡ', () => {
    const p = coBan();
    p.lop[0].buoi[0].coThayDoi = true;
    p.lop[1].buoi[0].coThayDoi = true;
    p.capNhat = {
      guiLucTruoc: t('2026-10-17T02:15:00Z'),
      buoiGo: [
        { tenLop: 'TT-09', buoiSo: 2, batDau: t('2026-10-24T06:30:00Z') },
      ],
    };
    const { tieuDe, html } = mauLichGiangDay(p);
    expect(tieuDe).toBe(
      '[BDNLS] Cập nhật lịch giảng dạy Giai đoạn 2 – khóa AG-2026-01',
    );
    expect(html).toContain('CẬP NHẬT LỊCH GIẢNG DẠY');
    expect(html).toContain('09:15 ngày 17/10/2026');
    // 2 huy hiệu + 1 lần nhắc trong câu giải thích của khối cảnh báo.
    expect(html.split('>Có thay đổi</span>').length - 1).toBe(2);
    expect(html).toContain('Không còn trong lịch của Thầy/Cô');
    expect(html).toContain('TT-09 – Buổi 2');
    p.capNhat.buoiGo = [];
    expect(mauLichGiangDay(p).html).not.toContain(
      'Không còn trong lịch của Thầy/Cô',
    );
  });

  it('escape dữ liệu động', () => {
    const p = coBan();
    p.hoTen = '<script>x</script>';
    const { html } = mauLichGiangDay(p);
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<script>x');
  });

  it('tomTat là text thuần, mỗi buổi 1 dòng', () => {
    const { tomTat } = mauLichGiangDay(coBan());
    expect(tomTat).not.toContain('<');
    expect(tomTat).toContain(
      'TT-03 – Buổi 1: Thứ Bảy, 24/10/2026, 07:30–11:30',
    );
    expect(tomTat.split('\n')).toHaveLength(5);
  });
});
