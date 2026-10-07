import { docTrustProxy } from './trust-proxy.util';

describe('docTrustProxy', () => {
  it.each([undefined, '', '   '])(
    'để trống (%p) -> 1, giữ hành vi cũ',
    (raw) => {
      expect(docTrustProxy(raw)).toBe(1);
    },
  );

  it('số nguyên -> số hop tin cậy', () => {
    expect(docTrustProxy('2')).toBe(2);
    expect(docTrustProxy(' 0 ')).toBe(0);
  });

  it('danh sách phân cách dấu phẩy -> mảng đã trim, bỏ phần rỗng', () => {
    expect(docTrustProxy('loopback,10.0.197.1')).toEqual([
      'loopback',
      '10.0.197.1',
    ]);
    expect(docTrustProxy(' loopback , 10.0.197.1 ,')).toEqual([
      'loopback',
      '10.0.197.1',
    ]);
  });

  it('một IP đơn lẻ -> mảng 1 phần tử (không nhầm thành số hop)', () => {
    expect(docTrustProxy('10.0.197.1')).toEqual(['10.0.197.1']);
  });
});
