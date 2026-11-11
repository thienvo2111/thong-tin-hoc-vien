import { NguoiDungThrottlerGuard } from './nguoi-dung-throttler.guard';

describe('NguoiDungThrottlerGuard.getTracker', () => {
  // getTracker không dùng dependency nào của guard -> gọi trên prototype.
  const getTracker = (req: Record<string, any>) =>
    (NguoiDungThrottlerGuard.prototype as any).getTracker.call(
      Object.create(NguoiDungThrottlerGuard.prototype),
      req,
    );

  it('có user -> tracker theo user.id', async () => {
    expect(await getTracker({ ip: '10.0.197.1', user: { id: 'u1' } })).toBe(
      'nguoi_dung:u1',
    );
  });

  it('cùng IP (NAT chung), khác tài khoản -> khác tracker', async () => {
    const a = await getTracker({ ip: '10.0.197.1', user: { id: 'u1' } });
    const b = await getTracker({ ip: '10.0.197.1', user: { id: 'u2' } });
    expect(a).not.toBe(b);
  });

  it('không có user -> rơi về IP (hành vi gốc của ThrottlerGuard)', async () => {
    expect(await getTracker({ ip: '10.0.197.1' })).toBe('10.0.197.1');
  });
});
