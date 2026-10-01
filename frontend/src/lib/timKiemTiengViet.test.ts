import { describe, expect, it } from 'vitest';
import { chuanHoaTimKiem, khopTimKiem, locTiengViet } from './timKiemTiengViet';

describe('chuanHoaTimKiem', () => {
  it('chuỗi rỗng -> rỗng', () => {
    expect(chuanHoaTimKiem('')).toBe('');
  });

  it('gộp khoảng trắng liên tiếp + trim', () => {
    expect(chuanHoaTimKiem('  Xã   Chợ   Mới  ')).toBe('xa cho moi');
  });

  it('đ/Đ -> d/D (trước khi hạ chữ thường)', () => {
    expect(chuanHoaTimKiem('Đăng')).toBe('dang');
  });
});

describe('khopTimKiem', () => {
  it('chuỗi NFD của từ khóa khớp nhãn NFC', () => {
    const nhanNfc = 'Xã Chợ Mới'; // dữ liệu DB là NFC chuẩn
    const tuKhoaNfd = 'Chợ'.normalize('NFD'); // bộ gõ sinh tổ hợp NFD (ơ + dấu móc + dấu nặng rời)
    expect(khopTimKiem(nhanNfc, tuKhoaNfd)).toBe(true);
  });

  it('gõ không dấu khớp nhãn có dấu: "cho moi" khớp "Xã Chợ Mới"', () => {
    expect(khopTimKiem('Xã Chợ Mới', 'cho moi')).toBe(true);
  });

  it('gõ không dấu khớp "Xã Cần Đăng": "can dang"', () => {
    expect(khopTimKiem('Xã Cần Đăng', 'can dang')).toBe(true);
  });

  it('"d" khớp "đ"', () => {
    expect(khopTimKiem('Đăng', 'dang')).toBe(true);
  });

  it('nhiều từ không liền kề vẫn khớp (mỗi từ là chuỗi con riêng): "xa moi" khớp "Xã Chợ Mới"', () => {
    expect(khopTimKiem('Xã Chợ Mới', 'xa moi')).toBe(true);
  });

  it('không khớp -> false', () => {
    expect(khopTimKiem('Xã Chợ Mới', 'long xuyen')).toBe(false);
  });

  it('từ khóa rỗng -> true (không lọc)', () => {
    expect(khopTimKiem('Xã Chợ Mới', '')).toBe(true);
    expect(khopTimKiem('Xã Chợ Mới', '   ')).toBe(true);
  });
});

describe('locTiengViet (OptionsFilter cho Mantine)', () => {
  const options = [
    { value: '1', label: 'Xã Chợ Mới' },
    { value: '2', label: 'Xã Chợ Vàm' },
    { value: '3', label: 'Xã Cần Đăng' },
    { value: '4', label: 'Phường Long Xuyên' },
  ];

  it('lọc theo từ khóa không dấu, giữ đúng thứ tự data gốc', () => {
    const ket = locTiengViet({ options, search: 'cho', limit: Infinity });
    expect(ket.map((o) => ('value' in o ? o.value : null))).toEqual(['1', '2']);
  });

  it('tôn trọng limit', () => {
    const ket = locTiengViet({ options, search: 'xa', limit: 1 });
    expect(ket).toHaveLength(1);
  });

  it('xử lý option group: chỉ giữ item khớp trong từng group (group rỗng vẫn giữ lại, giống defaultOptionsFilter của Mantine)', () => {
    const optionsGroup = [
      { group: 'An Giang', items: [options[0], options[1], options[2]] },
      { group: 'Khác', items: [options[3]] },
    ];
    const ket = locTiengViet({ options: optionsGroup, search: 'cho', limit: Infinity });
    expect(ket).toEqual([
      { group: 'An Giang', items: [options[0], options[1]] },
      { group: 'Khác', items: [] },
    ]);
  });

  it('từ khóa rỗng -> trả về mọi option (trong giới hạn limit)', () => {
    const ket = locTiengViet({ options, search: '', limit: Infinity });
    expect(ket).toHaveLength(options.length);
  });
});
