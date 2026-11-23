import * as ExcelJS from 'exceljs';
import {
  LOC_TIEN_DO,
  LocTienDo,
  SoLieuTienDo,
  chuaXong,
  khopLoc,
  locTienDo,
  mocMuonHon,
  quaHan,
  tongHopTienDo,
} from './tien-do-dot';
import {
  CHUA_KHAI_HO_SO,
  COT_TIEN_DO,
  DongXuatTienDo,
  TEN_SHEET_TIEN_DO,
  taoFileTienDo,
  tenFileTienDo,
} from './tien-do-dot.excel';
import { soLieuHopDong } from './hop-dong.service';

// Issue #65 / ADR 0015 X7, T5: bộ lọc, "chưa xong", tổng hợp, Excel trường chưa xong. Dữ liệu BỊA.
type Dong = SoLieuTienDo & { ten: string };

const dong = (
  ten: string,
  trang_thai_danh_sach: Dong['trang_thai_danh_sach'],
  trang_thai_hop_dong: Dong['trang_thai_hop_dong'],
  p: Partial<Dong> = {},
): Dong => ({
  ten,
  trang_thai_danh_sach,
  trang_thai_hop_dong,
  so_nguoi: 1,
  tong_suat: 1,
  gia_tri: 1000,
  qua_han: false,
  ...p,
});

// A chờ xác nhận, B báo sai lệch, C đã xác nhận chưa nộp, D đã nộp, E chờ xác nhận (danh sách trống).
const A = dong('A', 'cho_xac_nhan', 'chua_nop', {
  so_nguoi: 3,
  tong_suat: 2.5,
  gia_tri: 2_500_000,
});
const B = dong('B', 'bao_sai_lech', 'chua_nop', {
  so_nguoi: 1,
  tong_suat: 0.5,
  gia_tri: 500_000,
  qua_han: true,
});
const C = dong('C', 'da_xac_nhan', 'chua_nop');
const D = dong('D', 'da_xac_nhan', 'da_nop', {
  so_nguoi: 9,
  tong_suat: 7.5,
  gia_tri: 7_777_777,
});
const E = dong('E', 'cho_xac_nhan', 'chua_nop', {
  so_nguoi: 0,
  tong_suat: 0,
  gia_tri: 0,
});
const TAT_CA = [A, B, C, D, E];
const ten = (ds: Dong[]) => ds.map((d) => d.ten);

describe('locTienDo / khopLoc', () => {
  it.each<[LocTienDo, string[]]>([
    ['tat_ca', ['A', 'B', 'C', 'D', 'E']],
    ['chua_xac_nhan_ds', ['A', 'B', 'E']],
    ['bao_sai_lech', ['B']],
    ['chua_nop_hd', ['A', 'B', 'C', 'E']],
    ['qua_han', ['B']],
  ])('%s → %j (giữ thứ tự)', (loc, mongDoi) => {
    expect(ten(locTienDo(TAT_CA, loc))).toEqual(mongDoi);
  });

  it('danh sách rỗng → rỗng với mọi bộ lọc', () => {
    for (const loc of LOC_TIEN_DO) expect(locTienDo([], loc)).toEqual([]);
  });

  it('LOC_TIEN_DO đúng 5 giá trị, tat_ca đầu tiên', () => {
    expect(LOC_TIEN_DO).toEqual([
      'tat_ca',
      'chua_xac_nhan_ds',
      'bao_sai_lech',
      'chua_nop_hd',
      'qua_han',
    ]);
  });

  it('quaHan: hết hạn ∧ chưa nộp; đã nộp sau hạn không quá hạn', () => {
    expect(quaHan(true, 'chua_nop')).toBe(true);
    expect(quaHan(true, 'da_nop')).toBe(false);
    expect(quaHan(false, 'chua_nop')).toBe(false);
    expect(quaHan(false, 'da_nop')).toBe(false);
  });

  it('đã nộp nhưng (lý thuyết) chưa xác nhận vẫn vào chua_xac_nhan_ds, không vào chua_nop_hd', () => {
    const x = dong('X', 'cho_xac_nhan', 'da_nop');
    expect(khopLoc(x, 'chua_xac_nhan_ds')).toBe(true);
    expect(khopLoc(x, 'chua_nop_hd')).toBe(false);
  });
});

describe('chuaXong', () => {
  it('chưa xong = chưa nộp hợp đồng, bất kể trạng thái danh sách', () => {
    expect(TAT_CA.filter(chuaXong).map((d) => d.ten)).toEqual([
      'A',
      'B',
      'C',
      'E',
    ]);
  });

  it('chưa xong ∧ bộ lọc: chua_xac_nhan_ds → A, B, E; bao_sai_lech → B; chua_nop_hd = tat_ca', () => {
    const xuat = (loc: LocTienDo) =>
      ten(TAT_CA.filter((d) => chuaXong(d) && khopLoc(d, loc)));
    expect(xuat('tat_ca')).toEqual(['A', 'B', 'C', 'E']);
    expect(xuat('chua_xac_nhan_ds')).toEqual(['A', 'B', 'E']);
    expect(xuat('bao_sai_lech')).toEqual(['B']);
    expect(xuat('chua_nop_hd')).toEqual(xuat('tat_ca'));
  });
});

describe('mocMuonHon', () => {
  const t1 = new Date('2026-11-20T01:00:00Z');
  const t2 = new Date('2026-11-20T02:00:00Z');
  it('lấy mốc muộn hơn, bỏ qua null', () => {
    expect(mocMuonHon(t1, t2)).toBe(t2);
    expect(mocMuonHon(t2, t1)).toBe(t2);
    expect(mocMuonHon(null, t1)).toBe(t1);
    expect(mocMuonHon(t1, null)).toBe(t1);
    expect(mocMuonHon(null, null)).toBeNull();
  });
});

describe('tongHopTienDo', () => {
  it('đếm trạng thái và cộng số người, suất (nửa suất chính xác), giá trị', () => {
    expect(tongHopTienDo(TAT_CA)).toEqual({
      so_truong: 5,
      so_da_xac_nhan_ds: 2,
      so_bao_sai_lech: 1,
      so_da_nop: 1,
      so_qua_han: 1,
      tong_nguoi: 14,
      tong_suat: 11.5,
      tong_gia_tri: 2_500_000 + 500_000 + 1000 + 7_777_777 + 0,
    });
  });

  it('0,5 × 3 + 0,5 = 2 không lệch số thực', () => {
    const ds = [0.5, 0.5, 0.5, 0.5].map((s, i) =>
      dong(String(i), 'cho_xac_nhan', 'chua_nop', { tong_suat: s }),
    );
    expect(tongHopTienDo(ds).tong_suat).toBe(2);
  });

  it('giá trị null (chưa có đơn giá) bỏ qua; mọi dòng null → tong_gia_tri null', () => {
    const ds = [
      dong('x', 'cho_xac_nhan', 'chua_nop', { gia_tri: null }),
      dong('y', 'da_xac_nhan', 'da_nop', { gia_tri: 3000 }),
    ];
    expect(tongHopTienDo(ds).tong_gia_tri).toBe(3000);
    expect(tongHopTienDo([ds[0]]).tong_gia_tri).toBeNull();
  });

  it('đợt chưa có trường nào → mọi số 0, giá trị null', () => {
    expect(tongHopTienDo([])).toEqual({
      so_truong: 0,
      so_da_xac_nhan_ds: 0,
      so_bao_sai_lech: 0,
      so_da_nop: 0,
      so_qua_han: 0,
      tong_nguoi: 0,
      tong_suat: 0,
      tong_gia_tri: null,
    });
  });
});

describe('soLieuHopDong (dùng chung với màn hợp đồng)', () => {
  const lucNop = {
    so_nguoi_luc_nop: 5,
    tong_suat_luc_nop: 4.5 as never,
    don_gia_luc_nop: 1_000_000,
    gia_tri_luc_nop: BigInt(4_500_000),
    ban_chup_ho_so: { ten_truong: 'Bản chụp Bịa' } as never,
  };
  const trucTiep = {
    so_nguoi: 2,
    tong_suat: 1.5,
    don_gia: 1_234_567,
    hoSo: null,
  };

  it('chưa nộp: số trực tiếp, giá trị tạm tính làm tròn nửa lên', () => {
    const sl = soLieuHopDong(
      {
        trang_thai_hop_dong: 'chua_nop',
        so_nguoi_luc_nop: null,
        tong_suat_luc_nop: null,
        don_gia_luc_nop: null,
        gia_tri_luc_nop: null,
        ban_chup_ho_so: null,
      },
      trucTiep,
    );
    expect(sl).toEqual({
      so_nguoi: 2,
      tong_suat: 1.5,
      don_gia: 1_234_567,
      gia_tri: 1_851_851,
      hoSo: null,
    });
  });

  it('chưa nộp, chưa có đơn giá → giá trị null', () => {
    const sl = soLieuHopDong(
      {
        trang_thai_hop_dong: 'chua_nop',
        so_nguoi_luc_nop: null,
        tong_suat_luc_nop: null,
        don_gia_luc_nop: null,
        gia_tri_luc_nop: null,
        ban_chup_ho_so: null,
      },
      { ...trucTiep, don_gia: null },
    );
    expect(sl.gia_tri).toBeNull();
  });

  it('đã nộp: số liệu + hồ sơ lúc nộp, bỏ qua số trực tiếp', () => {
    const sl = soLieuHopDong(
      { trang_thai_hop_dong: 'da_nop', ...lucNop },
      trucTiep,
    );
    expect(sl).toEqual({
      so_nguoi: 5,
      tong_suat: 4.5,
      don_gia: 1_000_000,
      gia_tri: 4_500_000,
      hoSo: { ten_truong: 'Bản chụp Bịa' },
    });
  });
});

describe('Excel trường chưa xong', () => {
  const dongXuat = (p: Partial<DongXuatTienDo> = {}): DongXuatTienDo => ({
    ma: '0012345',
    ten: 'Trường THCS Bịa Một',
    so_nguoi: 3,
    tong_suat: 2.5,
    gia_tri: 3_086_418,
    trang_thai_danh_sach: 'bao_sai_lech',
    so_de_nghi_cho: 2,
    ho_so: 'con_thieu',
    trang_thai_hop_dong: 'chua_nop',
    han_hieu_luc_ngay: '2026-12-05',
    co_han_rieng: true,
    thao_tac_cuoi_luc: new Date('2026-11-20T03:04:00Z'),
    lien_he: {
      nguoi: 'Người Liên Hệ Bịa',
      sdt: '0900000001',
      email: 'lienhe@mau.test',
    },
    ...p,
  });

  async function doc(buf: Buffer) {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf as unknown as ExcelJS.Buffer);
    const sh = wb.worksheets[0];
    const rows: unknown[][] = [];
    sh.eachRow((r) => rows.push((r.values as unknown[]).slice(1)));
    return { wb, sh, rows };
  }

  it('1 sheet, tiêu đề đúng thứ tự, đậm, cố định, có autofilter', async () => {
    const { wb, sh, rows } = await doc(await taoFileTienDo([dongXuat()]));
    expect(wb.worksheets.map((s) => s.name)).toEqual([TEN_SHEET_TIEN_DO]);
    expect(rows[0]).toEqual([...COT_TIEN_DO]);
    expect(sh.getRow(1).font?.bold).toBe(true);
    expect(sh.views[0]).toMatchObject({ state: 'frozen', ySplit: 1 });
    expect(sh.autoFilter).toBeTruthy();
  });

  it('dòng dữ liệu: nhãn trạng thái, số, giá trị #,##0, giờ Việt Nam, liên hệ từ hồ sơ', async () => {
    const { sh, rows } = await doc(await taoFileTienDo([dongXuat()]));
    expect(rows[1]).toEqual([
      1,
      '0012345',
      'Trường THCS Bịa Một',
      3,
      2.5,
      3_086_418,
      'Báo sai lệch',
      2,
      'Còn thiếu',
      'Chưa nộp',
      new Date('2026-12-05T00:00:00Z'), // ô ngày hạn hiệu lực 05/12/2026
      'Có',
      new Date('2026-11-20T10:04:00Z'), // 03:04 UTC = 10:04 giờ VN
      'Người Liên Hệ Bịa',
      '0900000001',
      'lienhe@mau.test',
    ]);
    expect(sh.getRow(2).getCell(6).numFmt).toBe('#,##0');
    expect(sh.getRow(2).getCell(11).numFmt).toBe('dd/mm/yyyy');
    expect(sh.getRow(2).getCell(13).numFmt).toBe('dd/mm/yyyy hh:mm');
  });

  it('chưa khai hồ sơ → "Chưa khai hồ sơ" ở Người liên hệ, SĐT/email trống; giá trị null → ô trống', async () => {
    const { rows } = await doc(
      await taoFileTienDo([
        dongXuat({
          lien_he: null,
          ho_so: 'chua_khai',
          gia_tri: null,
          thao_tac_cuoi_luc: null,
          trang_thai_danh_sach: 'cho_xac_nhan',
          co_han_rieng: false,
        }),
      ]),
    );
    const r = rows[1];
    expect(r[5]).toBeUndefined();
    expect(r[6]).toBe('Chờ xác nhận');
    expect(r[8]).toBe('Chưa khai');
    expect(r[10]).toEqual(new Date('2026-12-05T00:00:00Z'));
    expect(r[11]).toBeUndefined(); // không có hạn riêng → ô trống
    expect(r[12]).toBeUndefined();
    expect(r[13]).toBe(CHUA_KHAI_HO_SO);
    expect(r.length).toBe(14); // SĐT, email trống (ô trống cuối dòng không có trong values)
  });

  it('không có trường nào → file hợp lệ chỉ có dòng tiêu đề', async () => {
    const { rows } = await doc(await taoFileTienDo([]));
    expect(rows).toEqual([[...COT_TIEN_DO]]);
  });

  it('tên file: tien-do-<slug>-chua-xong-<YYYYMMDD giờ VN>.xlsx', () => {
    expect(
      tenFileTienDo('HSG Đợt 1 – An Giang', new Date('2026-11-20T17:30:00Z')),
    ).toBe('tien-do-hsg-dot-1-an-giang-chua-xong-20261121.xlsx');
  });
});
