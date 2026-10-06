import {
  gopTrangThaiNhac,
  ngayVn,
  soanTinNhanCum,
  soanTinNhanGiangVien,
  trangThaiNhac,
} from './nhac-lich.util';

// ADR 0004 G10/G11 (issue #21).
describe('trangThaiNhac (G11)', () => {
  const buoi = { id: 'b1', cap_nhat_luc: new Date('2026-11-01T00:00:00Z') };

  it('chưa có lần gửi nào chứa buổi → chưa nhắc', () => {
    expect(trangThaiNhac(buoi, [])).toBe('chua_nhac');
    expect(
      trangThaiNhac(buoi, [
        { lich_hoc_ids: ['b2'], gui_luc: new Date('2026-11-02') },
      ]),
    ).toBe('chua_nhac');
  });

  it('gửi sau lần sửa cuối → đã nhắc', () => {
    expect(
      trangThaiNhac(buoi, [
        { lich_hoc_ids: ['b1'], gui_luc: new Date('2026-11-02') },
      ]),
    ).toBe('da_nhac');
  });

  it('sửa buổi sau lần gửi cuối → cần nhắc lại; so với lần gửi MỚI NHẤT', () => {
    const nk = [
      { lich_hoc_ids: ['b1'], gui_luc: new Date('2026-10-20') },
      { lich_hoc_ids: ['b1', 'b2'], gui_luc: new Date('2026-10-25') },
    ];
    expect(trangThaiNhac(buoi, nk)).toBe('can_nhac_lai');
    expect(
      trangThaiNhac(buoi, [
        ...nk,
        { lich_hoc_ids: ['b1'], gui_luc: new Date('2026-11-03') },
      ]),
    ).toBe('da_nhac');
  });

  it('gộp: cần nhắc lại > chưa nhắc > đã nhắc; rỗng → đã nhắc', () => {
    expect(gopTrangThaiNhac(['da_nhac', 'chua_nhac'])).toBe('chua_nhac');
    expect(gopTrangThaiNhac(['chua_nhac', 'can_nhac_lai', 'da_nhac'])).toBe(
      'can_nhac_lai',
    );
    expect(gopTrangThaiNhac([])).toBe('da_nhac');
  });
});

describe('soạn tin nhắn (G10)', () => {
  const buoi = {
    buoi_so: 1,
    // 08:00–11:00 giờ VN, thứ ba 10/11/2026.
    thoi_gian_bat_dau: new Date('2026-11-10T01:00:00Z'),
    thoi_gian_ket_thuc: new Date('2026-11-10T04:00:00Z'),
    dia_diem_hoac_link: null,
    phong: 'A1',
    diem_hoc: {
      ten: 'THPT Long Xuyên',
      dia_chi: '1 Trần Hưng Đạo, Long Xuyên',
    },
  };

  it('ngày theo giờ Việt Nam kèm thứ', () => {
    expect(ngayVn(new Date('2026-11-09T18:00:00Z'))).toBe('Thứ ba, 10/11/2026');
  });

  it('tin giảng viên: buổi, điểm học + bản đồ + phòng, chỗ ở, đón, thực địa, nhóm hỗ trợ', () => {
    const s = soanTinNhanGiangVien({
      ho_ten_giang_vien: 'Nguyễn Văn Long',
      ma_khoa: 'AG-1',
      ten_lop: 'Lớp 01',
      ten_giai_doan: 'Trực tiếp',
      buoi: [buoi],
      hau_can: {
        noi_o_ten: 'KS Hoa Sen',
        noi_o_dia_chi: null,
        phuong_tien: 'Xe 7 chỗ',
        don_luc: new Date('2026-11-09T23:00:00Z'),
        diem_don: 'Cổng HCMUE',
        lien_he_don: '0900',
      },
      thuc_dia: [{ ho_ten: 'Lê Đạt', so_dien_thoai: '0911' }],
      nhom_ho_tro_gv: [{ ho_ten: 'Phạm Giảng', email: 'g@x.vn' }],
    });
    expect(s).toContain('Kính gửi Thầy/Cô Nguyễn Văn Long');
    expect(s).toContain('• Buổi 1: Thứ ba, 10/11/2026, 08:00–11:00');
    expect(s).toContain(
      'THPT Long Xuyên – 1 Trần Hưng Đạo, Long Xuyên, phòng A1',
    );
    expect(s).toContain(
      'https://www.google.com/maps/search/?api=1&query=1%20Tr',
    );
    expect(s).toContain('Chỗ ở: KS Hoa Sen');
    expect(s).toContain(
      'Đưa đón: Xe 7 chỗ; đón lúc 06:00 Thứ ba, 10/11/2026; tại Cổng HCMUE; liên hệ 0900',
    );
    expect(s).toContain('Lê Đạt – 0911');
    expect(s).toContain('Phạm Giảng (g@x.vn)');
  });

  it('tin giảng viên không có hậu cần → không có dòng chỗ ở / đưa đón', () => {
    const s = soanTinNhanGiangVien({
      ho_ten_giang_vien: 'A',
      ma_khoa: 'K',
      ten_lop: 'L',
      ten_giai_doan: 'G',
      buoi: [{ ...buoi, diem_hoc: null, dia_diem_hoac_link: 'Hội trường' }],
      hau_can: null,
      thuc_dia: [],
      nhom_ho_tro_gv: [],
    });
    expect(s).not.toContain('Chỗ ở');
    expect(s).not.toContain('Đưa đón');
    expect(s).toContain('Địa điểm: Hội trường');
  });

  it('tin cụm: ngày, từng lớp + giờ + địa điểm + thực địa', () => {
    const s = soanTinNhanCum({
      ten_cum: 'Cụm Long Xuyên',
      ngay: new Date('2026-11-10T01:00:00Z'),
      buoi: [
        {
          ...buoi,
          ten_lop: 'Lớp 01',
          thuc_dia: [{ ho_ten: 'Lê Đạt', so_dien_thoai: '0911' }],
        },
      ],
    });
    expect(s).toContain('nhóm Cụm Long Xuyên');
    expect(s).toContain('Lịch học Thứ ba, 10/11/2026:');
    expect(s).toContain('• Lớp 01 – Buổi 1: 08:00–11:00');
    expect(s).toContain('Hỗ trợ tại điểm học: Lê Đạt – 0911');
  });
});
