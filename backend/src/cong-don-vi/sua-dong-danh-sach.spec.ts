import {
  DongDanhSachGoc,
  apDungSua,
  khacBiet,
  slugTenDot,
  tenFileXuatDanhSach,
} from './sua-dong-danh-sach';

// Dữ liệu bịa — không có PII thật.
const DONG: DongDanhSachGoc = {
  don_vi_id: 'tr-1',
  ho_ten: 'GV Bịa Một',
  ngay_sinh: '1990-02-01',
  gioi_tinh: 'Nam',
  ma_goc: 'M-1',
  lop: 'Lớp A',
  giai_doan: 'ca_hai',
  ty_le_suat: 1,
  ghi_chu: null,
  y_kien_truong: 'Trường đã xác nhận',
};

describe('apDungSua (issue #59, ADR 0015 S1/S2/S3/X1)', () => {
  it('chỉ đổi trường gửi lên; trường thiếu (undefined) giữ nguyên', () => {
    const moi = apDungSua(DONG, { ho_ten: 'GV Bịa Sửa' });
    expect(moi).toEqual({ ...DONG, ho_ten: 'GV Bịa Sửa', y_kien_truong: null });
  });

  it('gửi null xóa trường cho phép trống (ngày sinh, ghi chú…)', () => {
    const moi = apDungSua(DONG, { ngay_sinh: null, ma_goc: null });
    expect(moi.ngay_sinh).toBeNull();
    expect(moi.ma_goc).toBeNull();
  });

  it('đổi giai đoạn, không gửi suất → suất theo giai đoạn (S1)', () => {
    expect(apDungSua(DONG, { giai_doan: 'chi_gd1' })).toMatchObject({
      giai_doan: 'chi_gd1',
      ty_le_suat: 0.5,
    });
    const nua = {
      ...DONG,
      giai_doan: 'chi_gd2' as const,
      ty_le_suat: 0.5 as const,
    };
    expect(apDungSua(nua, { giai_doan: 'ca_hai' }).ty_le_suat).toBe(1);
  });

  it('gửi suất tường minh → giữ suất đó dù khác giai đoạn (S2 thay giữa chừng)', () => {
    expect(
      apDungSua(DONG, { giai_doan: 'ca_hai', ty_le_suat: 0.5 }),
    ).toMatchObject({ giai_doan: 'ca_hai', ty_le_suat: 0.5 });
    expect(apDungSua(DONG, { ty_le_suat: 0.5 }).ty_le_suat).toBe(0.5);
  });

  it('gửi lại đúng giai đoạn đang có → không ghi đè suất đã sửa tay', () => {
    const daSuaTay = { ...DONG, ty_le_suat: 0.5 as const };
    expect(apDungSua(daSuaTay, { giai_doan: 'ca_hai' })).toEqual(daSuaTay);
  });

  it('có thay đổi → mất ý kiến trường (X1)', () => {
    expect(apDungSua(DONG, { lop: 'Lớp B' }).y_kien_truong).toBeNull();
  });

  it('không thay đổi gì (rỗng hoặc trùng giá trị) → giữ nguyên cả ý kiến trường', () => {
    expect(apDungSua(DONG, {})).toEqual(DONG);
    expect(apDungSua(DONG, { ho_ten: 'GV Bịa Một', ty_le_suat: 1 })).toEqual(
      DONG,
    );
  });

  it('không sửa đối tượng đầu vào', () => {
    const banSao = { ...DONG };
    apDungSua(DONG, { ho_ten: 'Khác' });
    expect(DONG).toEqual(banSao);
  });
});

describe('khacBiet', () => {
  it('chỉ trả các trường đã đổi, cả trước lẫn sau', () => {
    const sau = apDungSua(DONG, { giai_doan: 'chi_gd1' });
    expect(khacBiet(DONG, sau)).toEqual({
      truoc: {
        giai_doan: 'ca_hai',
        ty_le_suat: 1,
        y_kien_truong: 'Trường đã xác nhận',
      },
      sau: { giai_doan: 'chi_gd1', ty_le_suat: 0.5, y_kien_truong: null },
    });
  });

  it('không đổi → null', () => {
    expect(khacBiet(DONG, { ...DONG })).toBeNull();
  });
});

describe('slugTenDot / tenFileXuatDanhSach', () => {
  it.each([
    ['HSG An Giang 2026', 'hsg-an-giang-2026'],
    ['Đợt 1 – Bồi dưỡng HSG (đợt bổ sung)', 'dot-1-boi-duong-hsg-dot-bo-sung'],
    ['  ', 'dot'],
    ['!!!', 'dot'],
  ])('%p → %s', (ten, ky) => {
    expect(slugTenDot(ten)).toBe(ky);
  });

  it('cắt slug tối đa 60 ký tự, không để gạch nối ở cuối', () => {
    const s = slugTenDot(`${'a'.repeat(59)} b`);
    expect(s.length).toBeLessThanOrEqual(60);
    expect(s.endsWith('-')).toBe(false);
  });

  it('tên file theo ngày Việt Nam (UTC+7)', () => {
    // 2026-11-19 17:30Z = 2026-11-20 00:30 giờ VN.
    expect(
      tenFileXuatDanhSach('HSG An Giang', new Date('2026-11-19T17:30:00Z')),
    ).toBe('danh-sach-hsg-an-giang-20261120.xlsx');
  });
});
