import { decryptVleMatKhau, encryptVleMatKhau } from './vle-crypto.util';

describe('vle-crypto.util (T15)', () => {
  it('mã hóa rồi giải mã ra đúng chuỗi gốc', () => {
    const plain = 'MatKhauTam123!';
    const encrypted = encryptVleMatKhau(plain);
    expect(decryptVleMatKhau(encrypted)).toBe(plain);
  });

  it('bản mã hóa không chứa chuỗi gốc dạng rõ', () => {
    const plain = 'MatKhauTamRatDeDoan';
    const encrypted = encryptVleMatKhau(plain);
    expect(encrypted.toString('utf8')).not.toContain(plain);
    expect(encrypted.toString('base64')).not.toContain(
      Buffer.from(plain, 'utf8').toString('base64'),
    );
  });

  it('mã hóa 2 lần cùng 1 chuỗi ra 2 bản mã KHÁC NHAU (IV ngẫu nhiên mỗi lần)', () => {
    const plain = 'MatKhauTam123!';
    const a = encryptVleMatKhau(plain);
    const b = encryptVleMatKhau(plain);
    expect(a.equals(b)).toBe(false);
    // Nhưng cả 2 vẫn giải mã đúng.
    expect(decryptVleMatKhau(a)).toBe(plain);
    expect(decryptVleMatKhau(b)).toBe(plain);
  });

  it('sửa 1 byte bản mã -> giải mã ném lỗi (auth tag GCM phát hiện)', () => {
    const encrypted = encryptVleMatKhau('MatKhauTam123!');
    const tampered = Buffer.from(encrypted);
    tampered[tampered.length - 1] ^= 0xff;
    expect(() => decryptVleMatKhau(tampered)).toThrow();
  });

  it('hỗ trợ ký tự Unicode (họ tên/mật khẩu có dấu)', () => {
    const plain = 'Mật khẩu Việt 123!';
    const encrypted = encryptVleMatKhau(plain);
    expect(decryptVleMatKhau(encrypted)).toBe(plain);
  });
});
