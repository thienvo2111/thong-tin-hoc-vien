import { describe, expect, it } from 'vitest';
import {
  canhBaoDaoTen,
  canhBaoThieuDau,
  goiYEmailDomain,
  guiYDaoTen,
  soDienThoaiSchema,
} from './hoSoHocVien';

describe('soDienThoaiSchema', () => {
  it('10 chữ số bắt đầu bằng 0 → hợp lệ', () => {
    expect(soDienThoaiSchema.safeParse('0912345678').success).toBe(true);
  });

  it('dạng +84 → không còn hợp lệ (ô nhập giới hạn maxLength=10, dạng này không thể gõ đủ)', () => {
    expect(soDienThoaiSchema.safeParse('+84912345678').success).toBe(false);
  });

  it('thiếu 1 chữ số (9 số) → không hợp lệ', () => {
    expect(soDienThoaiSchema.safeParse('091234567').success).toBe(false);
  });

  it('thừa 1 chữ số (11 số) → không hợp lệ', () => {
    expect(soDienThoaiSchema.safeParse('09123456789').success).toBe(false);
  });

  it('không bắt đầu bằng 0 → không hợp lệ', () => {
    expect(soDienThoaiSchema.safeParse('1912345678').success).toBe(false);
  });
});

describe('canhBaoThieuDau', () => {
  it('tên toàn ASCII, từ 2 từ trở lên → cảnh báo có thể thiếu dấu', () => {
    expect(canhBaoThieuDau('Nguyen Van An')).toBe(true);
  });

  it('tên có dấu tiếng Việt đầy đủ → không cảnh báo', () => {
    expect(canhBaoThieuDau('Nguyễn Văn An')).toBe(false);
  });

  it('tên 1 từ ASCII (có thể là tên nước ngoài) → không cảnh báo', () => {
    expect(canhBaoThieuDau('John')).toBe(false);
  });

  it('tên rỗng → không cảnh báo', () => {
    expect(canhBaoThieuDau('')).toBe(false);
  });
});

describe('canhBaoDaoTen', () => {
  it('từ cuối là họ phổ biến, từ đầu không phải → cảnh báo đảo ngược', () => {
    expect(canhBaoDaoTen('Văn An Nguyễn')).toBe(true);
  });

  it('từ đầu là họ phổ biến (đúng thứ tự Họ Tên) → không cảnh báo', () => {
    expect(canhBaoDaoTen('Nguyễn Văn An')).toBe(false);
  });

  it('cả 2 từ đầu/cuối đều không phải họ phổ biến → không cảnh báo (tránh false positive)', () => {
    expect(canhBaoDaoTen('Văn An')).toBe(false);
  });

  it('tên 1 từ → không cảnh báo', () => {
    expect(canhBaoDaoTen('Nguyễn')).toBe(false);
  });
});

describe('guiYDaoTen', () => {
  it('đưa từ cuối lên đầu, giữ nguyên thứ tự các từ còn lại', () => {
    expect(guiYDaoTen('Văn An Nguyễn')).toBe('Nguyễn Văn An');
  });

  it('tên 2 từ → hoán đổi vị trí', () => {
    expect(guiYDaoTen('An Nguyễn')).toBe('Nguyễn An');
  });

  it('tên 1 từ → giữ nguyên', () => {
    expect(guiYDaoTen('Nguyễn')).toBe('Nguyễn');
  });
});

describe('goiYEmailDomain', () => {
  it('domain gõ nhầm gần đúng (thiếu 1 ký tự) → gợi ý domain phổ biến đúng', () => {
    expect(goiYEmailDomain('abc@gmai.com')).toBe('gmail.com');
  });

  it('domain đã khớp đúng domain phổ biến → không cảnh báo', () => {
    expect(goiYEmailDomain('abc@gmail.com')).toBeNull();
  });

  it('domain gõ nhầm kiểu đảo chữ cái → vẫn gợi ý đúng (khoảng cách 2)', () => {
    expect(goiYEmailDomain('abc@gmial.com')).toBe('gmail.com');
    expect(goiYEmailDomain('abc@hotmial.com')).toBe('hotmail.com');
  });

  it('domain thừa 1 ký tự so với domain phổ biến → vẫn gợi ý đúng', () => {
    expect(goiYEmailDomain('abc@yahooo.com')).toBe('yahoo.com');
  });

  it('domain thiếu 1 ký tự khác → vẫn gợi ý đúng', () => {
    expect(goiYEmailDomain('abc@outlok.com')).toBe('outlook.com');
  });

  it('domain tổ chức/trường riêng hợp lệ (*.edu.vn) → không cảnh báo, kể cả khi xa mọi domain phổ biến', () => {
    expect(goiYEmailDomain('abc@truonghocXYZ.edu.vn')).toBeNull();
  });

  it('domain lạ không gần domain phổ biến nào (khoảng cách > 2) → không cảnh báo', () => {
    expect(goiYEmailDomain('abc@congty-rieng.vn')).toBeNull();
  });

  it('chuỗi không có "@" → không cảnh báo', () => {
    expect(goiYEmailDomain('khong-phai-email')).toBeNull();
  });
});
