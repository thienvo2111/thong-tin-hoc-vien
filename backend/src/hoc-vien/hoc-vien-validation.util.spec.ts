import {
  matKhauMacDinhTuNgaySinh,
  validateEmail,
  validateHoTen,
  validateNgayThangNamSinh,
  validateSoDienThoai,
  validateSoDinhDanh,
} from './hoc-vien-validation.util';

describe('validateHoTen', () => {
  it('tên hợp lệ, viết hoa đúng chuẩn -> không lỗi, không cảnh báo', () => {
    const r = validateHoTen('Nguyễn Văn An');
    expect(r.loi).toHaveLength(0);
    expect(r.canhBao).toHaveLength(0);
    expect(r.normalized).toBe('Nguyễn Văn An');
  });

  it('chứa số -> lỗi (rule #2)', () => {
    const r = validateHoTen('Nguyễn Văn An2');
    expect(r.loi.some((l) => l.field === 'ho_ten')).toBe(true);
  });

  it('chứa ký tự đặc biệt -> lỗi (rule #2)', () => {
    const r = validateHoTen('Nguyễn Văn @An');
    expect(r.loi.length).toBeGreaterThan(0);
  });

  it('chữ cái đầu không viết hoa -> cảnh báo có gợi ý chuẩn hóa (rule #4)', () => {
    const r = validateHoTen('nguyễn văn an');
    expect(r.loi).toHaveLength(0);
    expect(r.canhBao.some((c) => c.message.includes('Nguyễn Văn An'))).toBe(
      true,
    );
  });

  it('khoảng trắng thừa -> cảnh báo + tự chuẩn hóa gọn lại (rule #5)', () => {
    const r = validateHoTen('  Nguyễn  Văn An  ');
    expect(r.canhBao.length).toBeGreaterThan(0);
    expect(r.normalized).toBe('Nguyễn Văn An');
  });
});

describe('validateSoDinhDanh', () => {
  it('đúng 12 chữ số -> hợp lệ', () => {
    expect(validateSoDinhDanh('123456789012')).toHaveLength(0);
  });

  it('ít hơn 12 chữ số -> lỗi', () => {
    expect(validateSoDinhDanh('12345')).toHaveLength(1);
  });

  it('chứa chữ cái -> lỗi', () => {
    expect(validateSoDinhDanh('12345678901a')).toHaveLength(1);
  });
});

describe('validateNgayThangNamSinh', () => {
  const namHopLe = new Date().getUTCFullYear() - 20;

  it('ngày hợp lệ, tuổi đủ -> không lỗi', () => {
    expect(validateNgayThangNamSinh(15, 6, namHopLe)).toHaveLength(0);
  });

  it('31/04 không tồn tại -> lỗi (rule #11)', () => {
    const loi = validateNgayThangNamSinh(31, 4, namHopLe);
    expect(loi.length).toBeGreaterThan(0);
  });

  it('29/02 năm không nhuận -> lỗi', () => {
    const loi = validateNgayThangNamSinh(29, 2, 2023); // 2023 không nhuận
    expect(loi.length).toBeGreaterThan(0);
  });

  it('29/02 năm nhuận -> hợp lệ (nếu đủ tuổi)', () => {
    const loi = validateNgayThangNamSinh(29, 2, 2000); // nhuận, đủ tuổi
    expect(loi).toHaveLength(0);
  });

  it('tuổi chưa đủ 15 -> lỗi (rule #12)', () => {
    const namQuaTre = new Date().getUTCFullYear() - 10;
    const loi = validateNgayThangNamSinh(1, 1, namQuaTre);
    expect(loi.some((l) => l.field === 'nam_sinh')).toBe(true);
  });

  it('ngay_sinh ngoài 1-31 -> lỗi', () => {
    expect(
      validateNgayThangNamSinh(32, 1, namHopLe).some(
        (l) => l.field === 'ngay_sinh',
      ),
    ).toBe(true);
  });

  it('thang_sinh ngoài 1-12 -> lỗi', () => {
    expect(
      validateNgayThangNamSinh(1, 13, namHopLe).some(
        (l) => l.field === 'thang_sinh',
      ),
    ).toBe(true);
  });
});

describe('validateSoDienThoai', () => {
  it('10 số bắt đầu bằng 0 -> hợp lệ', () => {
    expect(validateSoDienThoai('0912345678')).toHaveLength(0);
  });

  it('+84 theo sau 9 số -> hợp lệ', () => {
    expect(validateSoDienThoai('+84912345678')).toHaveLength(0);
  });

  it('thiếu số / sai định dạng -> lỗi', () => {
    expect(validateSoDienThoai('123')).toHaveLength(1);
    expect(validateSoDienThoai('1912345678')).toHaveLength(1);
  });
});

describe('validateEmail', () => {
  it('email hợp lệ -> không lỗi', () => {
    expect(validateEmail('a@b.com')).toHaveLength(0);
  });

  it('thiếu @ -> lỗi', () => {
    expect(validateEmail('a-b.com')).toHaveLength(1);
  });
});

describe('matKhauMacDinhTuNgaySinh', () => {
  it('sinh đúng định dạng ddmmyyyy, có pad số 0', () => {
    expect(matKhauMacDinhTuNgaySinh(5, 3, 1990)).toBe('05031990');
  });

  it('ngày/tháng 2 chữ số không bị pad thừa', () => {
    expect(matKhauMacDinhTuNgaySinh(25, 12, 2000)).toBe('25122000');
  });
});
