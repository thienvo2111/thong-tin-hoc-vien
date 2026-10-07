import { TaiKhoanThrottlerGuard } from './tai-khoan-throttler.guard';

describe('TaiKhoanThrottlerGuard.getTracker', () => {
  // getTracker không dùng dependency nào của guard -> gọi trên prototype.
  const getTracker = (req: Record<string, any>) =>
    (TaiKhoanThrottlerGuard.prototype as any).getTracker.call({}, req);

  it('ghép IP (req.ip đã qua trust proxy) với tên đăng nhập', async () => {
    expect(
      await getTracker({ ip: '1.2.3.4', body: { ten_dang_nhap: 'gv01' } }),
    ).toBe('1.2.3.4|gv01');
  });

  it('cùng IP, khác tài khoản -> khác tracker (NAT chung không chặn nhau)', async () => {
    const a = await getTracker({
      ip: '10.0.197.1',
      body: { ten_dang_nhap: 'a' },
    });
    const b = await getTracker({
      ip: '10.0.197.1',
      body: { ten_dang_nhap: 'b' },
    });
    expect(a).not.toBe(b);
  });

  it('không phân biệt hoa/thường, bỏ khoảng trắng 2 đầu', async () => {
    expect(
      await getTracker({ ip: '1.2.3.4', body: { ten_dang_nhap: '  ABC ' } }),
    ).toBe('1.2.3.4|abc');
  });

  it('thiếu body/ten_dang_nhap -> chỉ còn IP, không ném lỗi', async () => {
    expect(await getTracker({ ip: '1.2.3.4' })).toBe('1.2.3.4|');
    expect(await getTracker({ ip: '1.2.3.4', body: {} })).toBe('1.2.3.4|');
  });
});
