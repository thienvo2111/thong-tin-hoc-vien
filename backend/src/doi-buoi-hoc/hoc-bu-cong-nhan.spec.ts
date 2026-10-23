import {
  buoiGocCoMatLopKhac,
  DongCoMatLopKhac,
  napBuoiGocCoMatLopKhac,
} from './hoc-bu-cong-nhan';

const goc = (id: string, buoi_so = 1, muc: string | null = 'co_ban') => ({
  id,
  lop_id: 'lopB',
  giai_doan_id: 'gd1',
  buoi_so,
  lop: { muc_nang_luc: muc },
});

const dong = (
  lop_id: string,
  o: { buoi_so?: number; muc?: string | null; loai_lop?: string; giai_doan_id?: string } = {},
): DongCoMatLopKhac => ({
  lich_hoc_id: `${lop_id}-${o.buoi_so ?? 1}`,
  trang_thai: 'co_mat',
  lich_hoc: {
    lop_id,
    giai_doan_id: o.giai_doan_id ?? 'gd1',
    buoi_so: o.buoi_so ?? 1,
    lop: { loai_lop: o.loai_lop ?? 'zoom', muc_nang_luc: 'muc' in o ? (o.muc ?? null) : 'co_ban' },
  },
});

describe('buoiGocCoMatLopKhac', () => {
  it('khong co dong lop khac -> rong', () => {
    expect(buoiGocCoMatLopKhac([goc('b1')], [], 'cong_nhan_lop_cu').size).toBe(0);
  });

  it('cong_nhan_lop_cu: co mat lop cu khac muc -> cong nhan', () => {
    const kq = buoiGocCoMatLopKhac([goc('b1')], [dong('lopA', { muc: 'nang_cao' })], 'cong_nhan_lop_cu');
    expect([...kq]).toEqual(['b1']);
  });

  it('cong_nhan_cung_muc: cung muc -> cong nhan; khac muc -> khong', () => {
    expect([...buoiGocCoMatLopKhac([goc('b1')], [dong('lopA')], 'cong_nhan_cung_muc')]).toEqual(['b1']);
    expect(buoiGocCoMatLopKhac([goc('b1')], [dong('lopA', { muc: 'nang_cao' })], 'cong_nhan_cung_muc').size).toBe(0);
  });

  it('cong_nhan_cung_muc: ca hai lop khong chia muc -> cong nhan', () => {
    const kq = buoiGocCoMatLopKhac([goc('b1', 1, null)], [dong('lopA', { muc: null })], 'cong_nhan_cung_muc');
    expect([...kq]).toEqual(['b1']);
  });

  it('theo_lop_hien_tai: lop Zoom cu khong tinh -> van duoc hoc bu', () => {
    expect(buoiGocCoMatLopKhac([goc('b1')], [dong('lopA')], 'theo_lop_hien_tai').size).toBe(0);
  });

  it('theo_lop_hien_tai: dong truc tiep luon tinh (nhu tinhChuyenCan)', () => {
    const kq = buoiGocCoMatLopKhac([goc('b1')], [dong('lopT', { loai_lop: 'truc_tiep' })], 'theo_lop_hien_tai');
    expect([...kq]).toEqual(['b1']);
  });

  it('chi danh dau dung buoi khop (giai_doan, buoi_so)', () => {
    const kq = buoiGocCoMatLopKhac(
      [goc('b1', 1), goc('b2', 2)],
      [dong('lopA', { buoi_so: 2 }), dong('lopA', { buoi_so: 1, giai_doan_id: 'gd2' })],
      'cong_nhan_lop_cu',
    );
    expect([...kq]).toEqual(['b2']);
  });
});

describe('napBuoiGocCoMatLopKhac', () => {
  const db = (rows: unknown[]) => ({ diem_danh: { findMany: jest.fn(async () => rows) } });

  it('khong co buoi goc -> khong truy van', async () => {
    const d = db([]);
    expect((await napBuoiGocCoMatLopKhac(d as never, 'dk1', [])).size).toBe(0);
    expect(d.diem_danh.findMany).not.toHaveBeenCalled();
  });

  it('loc co_mat, bo chinh buoi goc, theo (giai_doan, buoi_so); che do lay tu khoa', async () => {
    const r = dong('lopA');
    const d = db([
      { ...r, lich_hoc: { ...r.lich_hoc, lop: { ...r.lich_hoc.lop, khoa: { che_do_chuyen_can: 'cong_nhan_cung_muc' } } } },
    ]);
    const kq = await napBuoiGocCoMatLopKhac(d as never, 'dk1', [goc('b1')]);
    expect([...kq]).toEqual(['b1']);
    expect(d.diem_danh.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          dang_ky_hoc_id: 'dk1',
          trang_thai: 'co_mat',
          lich_hoc_id: { notIn: ['b1'] },
          lich_hoc: { OR: [{ giai_doan_id: 'gd1', buoi_so: 1 }] },
        },
      }),
    );
  });
});
