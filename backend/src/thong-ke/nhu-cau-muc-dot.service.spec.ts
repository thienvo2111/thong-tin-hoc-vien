import type { muc_nang_luc } from '@prisma/client';
import { tongHopNhuCauMucDot } from './nhu-cau-muc-dot.service';
import { DongNhuCauMucDot } from './thong-ke.types';

const T1 = { id: 'tr-1', ten: 'Trường B' };
const T2 = { id: 'tr-2', ten: 'Trường A' };

function dong(
  moc: muc_nang_luc | null,
  chon: muc_nang_luc | null,
  truong = T1,
  mucMocLucChon: muc_nang_luc | null = moc,
): DongNhuCauMucDot {
  return {
    dang_ky_hoc_id: `dk-${Math.random()}`,
    hoc_vien: {
      ho_ten: 'HV',
      ma_moet: null,
      so_dien_thoai: null,
      don_vi: truong,
      truong,
    },
    moc_hien_tai: moc
      ? { muc: moc, nguon: 'lop', lop: null, giai_doan: null }
      : null,
    lop_hien_tai: null,
    muc_dau_vao: null,
    muc_hoc_chon: null,
    lua_chon: chon
      ? {
          muc_chon: chon,
          muc_moc: mucMocLucChon ?? 'nang_cao',
          nguon_moc: 'lop',
          lop_luc_chon: null,
          chon_luc: new Date(),
          cap_nhat_luc: new Date(),
        }
      : null,
  };
}

describe('tongHopNhuCauMucDot (hàm thuần)', () => {
  it('3 dòng: 2 đã chọn, 1 chưa chọn → KPI, ma trận, hạ mức', () => {
    const kq = tongHopNhuCauMucDot([
      dong('nang_cao', 'co_ban'),
      dong('thanh_thao', 'thanh_thao'),
      dong('co_ban', null),
    ]);
    expect(kq).toMatchObject({
      tong_du_dieu_kien: 3,
      da_chon: 2,
      chua_chon: 1,
      ty_le_da_chon: 66.7,
    });
    expect(kq.ma_tran).toEqual(
      expect.arrayContaining([
        { muc_moc: 'nang_cao', muc_chon: 'co_ban', so_luong: 1 },
        { muc_moc: 'thanh_thao', muc_chon: 'thanh_thao', so_luong: 1 },
      ]),
    );
    expect(kq.ma_tran).toHaveLength(2);
    expect(kq.theo_truong).toEqual([
      {
        don_vi_id: 'tr-1',
        ten: 'Trường B',
        tong: 3,
        da_chon: 2,
        chua_chon: 1,
        ha_muc: 1,
      },
    ]);
  });

  it('mảng rỗng → 0 hết, không chia cho 0', () => {
    expect(tongHopNhuCauMucDot([])).toEqual({
      tong_du_dieu_kien: 0,
      da_chon: 0,
      chua_chon: 0,
      ty_le_da_chon: 0,
      ma_tran: [],
      theo_truong: [],
    });
  });

  it('moc_hien_tai=null nhưng có lua_chon → vẫn tính vào tong và da_chon', () => {
    const kq = tongHopNhuCauMucDot([dong(null, 'co_ban', T1, 'thanh_thao')]);
    expect(kq).toMatchObject({
      tong_du_dieu_kien: 1,
      da_chon: 1,
      chua_chon: 0,
      ty_le_da_chon: 100,
    });
    expect(kq.theo_truong[0].ha_muc).toBe(1);
  });

  it('ma trận dùng mốc lúc chọn, không dùng mốc hiện tại', () => {
    const kq = tongHopNhuCauMucDot([
      dong('co_ban', 'thanh_thao', T1, 'thanh_thao'),
    ]);
    expect(kq.ma_tran).toEqual([
      { muc_moc: 'thanh_thao', muc_chon: 'thanh_thao', so_luong: 1 },
    ]);
    expect(kq.theo_truong[0].ha_muc).toBe(0);
  });

  it('theo_truong tách theo trường, sắp theo tên; ma trận gộp ô trùng', () => {
    const kq = tongHopNhuCauMucDot([
      dong('nang_cao', 'co_ban', T1),
      dong('nang_cao', 'co_ban', T2),
      dong('nang_cao', null, T2),
    ]);
    expect(kq.theo_truong.map((t) => [t.ten, t.tong, t.da_chon])).toEqual([
      ['Trường A', 2, 1],
      ['Trường B', 1, 1],
    ]);
    expect(kq.ma_tran).toEqual([
      { muc_moc: 'nang_cao', muc_chon: 'co_ban', so_luong: 2 },
    ]);
    expect(kq.ty_le_da_chon).toBe(66.7);
  });

  it('học viên không thuộc trường → nhóm theo đơn vị công tác', () => {
    const r = dong('co_ban', null);
    r.hoc_vien.truong = null;
    r.hoc_vien.don_vi = { id: 'dv-x', ten: 'Phòng X' };
    expect(tongHopNhuCauMucDot([r]).theo_truong[0]).toMatchObject({
      don_vi_id: 'dv-x',
      ten: 'Phòng X',
    });
  });
});
