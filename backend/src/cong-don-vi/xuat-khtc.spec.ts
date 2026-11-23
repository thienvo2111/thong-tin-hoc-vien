import * as ExcelJS from 'exceljs';
import { TRUONG_HO_SO } from './ho-so-don-vi.quy-tac';
import {
  COT_CHI_HO_TRO_KHTC,
  COT_GIAO_VIEN_KHTC,
  COT_HOP_DONG_KHTC,
  GiaoVienKhtc,
  HopDongKhtc,
  MUC_CHI_HO_TRO,
  SHEET_KHTC,
  TONG_CONG,
  cheStk,
  dongChiHoTroKhtc,
  dongGiaoVienKhtc,
  dongHopDongKhtc,
  sapXepHopDong,
  tenFileKhtc,
} from './xuat-khtc';
import { taoFileKhtc } from './xuat-khtc.excel';

// Issue #67 / ADR 0015 O1, O4: quy tắc thuần của file KHTC. Mọi tên, MST, STK, SĐT đều BỊA.

const BAN_CHUP = {
  ten_truong: 'Trường THCS Bịa Một',
  dia_chi: 'Ấp Bịa, xã Thử',
  ma_so_thue: '0123456789',
  nguoi_dai_dien: 'Đại Diện Bịa',
  sdt_dai_dien: '0900000001',
  email_hoa_don: 'hoadon@mau.test',
  so_tai_khoan: '0011223344',
  ngan_hang: 'Ngân hàng Giả',
  chi_nhanh: 'CN Giả',
  kho_bac: 'Kho bạc Giả',
  mst_kho_bac: '0123456789-001',
  ma_qhns: '0123456',
  ma_nguon: '013',
  ht_ho_ten: 'Hiệu Trưởng Bịa',
  ht_so_tai_khoan: '0099887766554433',
  ht_ngan_hang: 'Ngân hàng Giả – CN Thử',
  kt_ho_ten: 'Kế Toán Bịa',
  kt_sdt: '0900000002',
  kt_so_tai_khoan: '0055443322',
  kt_ngan_hang: 'Ngân hàng Giả – CN Hai',
  dau_moi_csvc: 'Đầu Mối Bịa',
  muc_dap_ung_csvc: 'Phòng máy Bịa',
  luu_tru: 'Nhà khách Bịa',
  di_chuyen: 'Xe Bịa',
  stk_chuyen_khoan: 'HCMUE0123456',
  don_vi_tiep_nhan: 'Đơn vị tiếp nhận Bịa',
  ngan_hang_tiep_nhan: 'Ngân hàng tiếp nhận Bịa',
};

function hopDong(p: Partial<HopDongKhtc> = {}): HopDongKhtc {
  return {
    ma_truong: '0001',
    ten_don_vi: 'Trường Bịa Một',
    trang_thai_hop_dong: 'da_nop',
    // 23:30 ngày 20/11 UTC = 06:30 ngày 21/11 giờ VN.
    nop_luc: new Date('2026-11-20T23:30:15Z'),
    ban_chup: { ...BAN_CHUP },
    nguoi_nhan: 'Người Nhận Bịa',
    sdt_nguoi_nhan: '0900000009',
    dia_chi_nhan: 'Số 1 đường Bịa',
    ghi_chu: null,
    so_qd: '01/QĐ-BIA',
    ngay_qd: '2026-11-05',
    diem_hoc_truc_tiep: true,
    so_nguoi: 3,
    tong_suat: 2.5,
    don_gia: 1_234_567,
    gia_tri: 3_086_418,
    ...p,
  };
}

const giaTri = (h: HopDongKhtc, key: string) =>
  dongHopDongKhtc(h)[COT_HOP_DONG_KHTC.findIndex((c) => c.key === key)];

describe('cheStk — giống hệt frontend', () => {
  it.each([
    [null, null],
    ['', ''],
    ['1234', '1234'],
    ['12345', '•2345'],
    ['123456789', '•••••6789'],
    ['0099887766554433', '••••••••4433'],
  ])('%p → %p', (vao, ra) => {
    expect(cheStk(vao)).toBe(ra);
  });

  it('không bao giờ lộ phần trước 4 ký tự cuối', () => {
    const che = cheStk('0099887766554433') as string;
    expect(che).not.toContain('00998877');
    expect(che.endsWith('4433')).toBe(true);
  });
});

describe('MUC_CHI_HO_TRO', () => {
  it('Hiệu trưởng 1.000.000 đ, Kế toán 500.000 đ', () => {
    expect(MUC_CHI_HO_TRO).toEqual({
      hieu_truong: 1_000_000,
      ke_toan: 500_000,
    });
  });
});

describe('COT_HOP_DONG_KHTC — thứ tự cột Google Form', () => {
  it('đúng thứ tự: Dấu thời gian, Phần 1 → 5, Hậu cần, rồi các cột thêm', () => {
    expect(COT_HOP_DONG_KHTC.map((c) => c.nhan)).toEqual([
      'Dấu thời gian',
      'Tên trường',
      'Địa chỉ',
      'Mã số thuế',
      'Người đại diện trên hợp đồng',
      'SĐT người đại diện',
      'Email nhận hóa đơn',
      'Số tài khoản',
      'Ngân hàng',
      'Chi nhánh',
      'Kho bạc',
      'MST đăng ký tại Kho bạc',
      'Mã QHNS',
      'Mã nguồn',
      'Người nhận bản giấy hợp đồng',
      'SĐT người nhận',
      'Địa chỉ nhận (số, đường, ấp, xã/phường, tỉnh)',
      'Ghi chú cho HCMUE',
      'Số QĐ chỉ định thầu',
      'Ngày QĐ',
      'Họ tên Hiệu trưởng',
      'STK Hiệu trưởng',
      'Ngân hàng – chi nhánh (HT)',
      'Họ tên Kế toán',
      'SĐT Kế toán',
      'STK Kế toán',
      'Ngân hàng – chi nhánh (KT)',
      'Điểm học trực tiếp',
      'Đầu mối CSVC/kỹ thuật (họ tên, SĐT)',
      'Mức đáp ứng CSVC',
      'Lưu trú gần trường (kèm SĐT)',
      'Di chuyển từ TP.HCM (kèm SĐT)',
      'Mã trường',
      'Số người',
      'Tổng suất',
      'Đơn giá',
      'Giá trị hợp đồng',
      'Trạng thái',
      'Ngày nộp',
      'STK chuyển khoản HCMUE',
      'Ngân hàng tiếp nhận',
      'Đơn vị tiếp nhận',
    ]);
  });

  it('mọi trường hồ sơ có đúng 1 cột, nhãn trùng TRUONG_HO_SO; khóa không trùng', () => {
    for (const t of TRUONG_HO_SO) {
      const c = COT_HOP_DONG_KHTC.filter((x) => x.key === t.ma);
      expect(c).toHaveLength(1);
      expect(c[0].nhan).toBe(t.nhan);
    }
    const khoa = COT_HOP_DONG_KHTC.map((c) => c.key);
    expect(new Set(khoa).size).toBe(khoa.length);
  });

  it('MST / QHNS / STK / SĐT / mã là ô Text; tiền, suất, ngày có kiểu riêng', () => {
    const kieu = Object.fromEntries(
      COT_HOP_DONG_KHTC.map((c) => [c.key, c.kieu]),
    );
    for (const k of [
      'ma_so_thue',
      'sdt_dai_dien',
      'so_tai_khoan',
      'mst_kho_bac',
      'ma_qhns',
      'ma_nguon',
      'sdt_nguoi_nhan',
      'ht_so_tai_khoan',
      'kt_sdt',
      'kt_so_tai_khoan',
      'ma_truong',
      'stk_chuyen_khoan',
    ]) {
      expect([k, kieu[k]]).toEqual([k, 'ma']);
    }
    expect(kieu.gia_tri).toBe('tien');
    expect(kieu.don_gia).toBe('tien');
    expect(kieu.tong_suat).toBe('suat');
    expect(kieu.dau_thoi_gian).toBe('ngay_gio');
    expect(kieu.ngay_qd).toBe('ngay');
    expect(kieu.ngay_nop).toBe('ngay');
  });
});

describe('dongHopDongKhtc', () => {
  it('1 giá trị / cột, theo đúng thứ tự cột', () => {
    expect(dongHopDongKhtc(hopDong())).toHaveLength(COT_HOP_DONG_KHTC.length);
  });

  it('hồ sơ lấy từ bản chụp (giữ số 0 đầu), Phần 3–4 + điểm học từ hợp đồng, số liệu lúc nộp', () => {
    const h = hopDong();
    expect(giaTri(h, 'ten_truong')).toBe('Trường THCS Bịa Một');
    expect(giaTri(h, 'ma_so_thue')).toBe('0123456789');
    expect(giaTri(h, 'ma_qhns')).toBe('0123456');
    expect(giaTri(h, 'ht_so_tai_khoan')).toBe('0099887766554433');
    expect(giaTri(h, 'nguoi_nhan')).toBe('Người Nhận Bịa');
    expect(giaTri(h, 'so_qd')).toBe('01/QĐ-BIA');
    expect(giaTri(h, 'ngay_qd')).toEqual(new Date('2026-11-05T00:00:00Z'));
    expect(giaTri(h, 'diem_hoc_truc_tiep')).toBe('Có');
    expect(giaTri(h, 'ma_truong')).toBe('0001');
    expect(giaTri(h, 'so_nguoi')).toBe(3);
    expect(giaTri(h, 'tong_suat')).toBe(2.5);
    expect(giaTri(h, 'don_gia')).toBe(1_234_567);
    expect(giaTri(h, 'gia_tri')).toBe(3_086_418);
    expect(giaTri(h, 'trang_thai')).toBe('Đã nộp');
    expect(giaTri(h, 'stk_chuyen_khoan')).toBe('HCMUE0123456');
    expect(giaTri(h, 'ngan_hang_tiep_nhan')).toBe('Ngân hàng tiếp nhận Bịa');
    expect(giaTri(h, 'don_vi_tiep_nhan')).toBe('Đơn vị tiếp nhận Bịa');
  });

  it('Dấu thời gian = nộp lúc theo giờ VN; Ngày nộp = ngày VN (không giờ)', () => {
    const h = hopDong();
    expect(giaTri(h, 'dau_thoi_gian')).toEqual(
      new Date('2026-11-21T06:30:15Z'),
    );
    expect(giaTri(h, 'ngay_nop')).toEqual(new Date('2026-11-21T00:00:00Z'));
  });

  it('không điểm học trực tiếp → "Không"; thiếu ngày QĐ → ô trống', () => {
    const h = hopDong({
      diem_hoc_truc_tiep: false,
      ngay_qd: null,
      so_qd: null,
    });
    expect(giaTri(h, 'diem_hoc_truc_tiep')).toBe('Không');
    expect(giaTri(h, 'ngay_qd')).toBeNull();
    expect(giaTri(h, 'so_qd')).toBeNull();
  });

  it('bản chụp cũ thiếu khóa → ô trống, không lỗi', () => {
    const h = hopDong({ ban_chup: { ten_truong: 'Chỉ Có Tên' } });
    expect(giaTri(h, 'ten_truong')).toBe('Chỉ Có Tên');
    expect(giaTri(h, 'ma_so_thue')).toBeNull();
    expect(giaTri(h, 'stk_chuyen_khoan')).toBeNull();
  });
});

describe('sapXepHopDong', () => {
  it('theo tên trường tiếng Việt (Đ sau D, dấu đúng thứ tự)', () => {
    const ds = ['Trường Đông', 'Trường Bình', 'Trường Dương', 'Trường An'].map(
      (ten_don_vi) => ({ ten_don_vi }),
    );
    expect(sapXepHopDong(ds).map((x) => x.ten_don_vi)).toEqual([
      'Trường An',
      'Trường Bình',
      'Trường Dương',
      'Trường Đông',
    ]);
  });
});

describe('dongGiaoVienKhtc', () => {
  const gv = (p: Partial<GiaoVienKhtc>): GiaoVienKhtc => ({
    ma_truong: '0001',
    ten_truong: 'Trường Bịa B',
    ho_ten: 'GV Bịa',
    ngay_sinh: '1990-01-31',
    lop: '26.01.TOAN',
    giai_doan: 'ca_hai',
    ty_le_suat: 1,
    ...p,
  });

  it('theo trường rồi họ tên, STT từ 1, ngày sinh là ô ngày, nhãn giai đoạn, suất', () => {
    const dong = dongGiaoVienKhtc([
      gv({ ho_ten: 'Lê Văn Bịa', giai_doan: 'chi_gd2', ty_le_suat: 0.5 }),
      gv({ ten_truong: 'Trường Bịa A', ma_truong: '0002', ho_ten: 'Võ Bịa' }),
      gv({ ho_ten: 'Bùi Thị Bịa', giai_doan: 'chi_gd1', ty_le_suat: 0.5 }),
      gv({ ho_ten: 'Đỗ Bịa', ngay_sinh: null, lop: null }),
    ]);
    expect(dong).toEqual([
      [
        1,
        '0002',
        'Trường Bịa A',
        'Võ Bịa',
        new Date('1990-01-31T00:00:00Z'),
        '26.01.TOAN',
        'Cả 2',
        1,
      ],
      [
        2,
        '0001',
        'Trường Bịa B',
        'Bùi Thị Bịa',
        new Date('1990-01-31T00:00:00Z'),
        '26.01.TOAN',
        'Chỉ GĐ1',
        0.5,
      ],
      [3, '0001', 'Trường Bịa B', 'Đỗ Bịa', null, null, 'Cả 2', 1],
      [
        4,
        '0001',
        'Trường Bịa B',
        'Lê Văn Bịa',
        new Date('1990-01-31T00:00:00Z'),
        '26.01.TOAN',
        'Chỉ GĐ2',
        0.5,
      ],
    ]);
    expect(dong[0]).toHaveLength(COT_GIAO_VIEN_KHTC.length);
  });

  it('rỗng → []', () => {
    expect(dongGiaoVienKhtc([])).toEqual([]);
  });
});

describe('dongChiHoTroKhtc', () => {
  it('mỗi trường 2 dòng HT 1.000.000 / KT 500.000, STK ĐẦY ĐỦ, theo tên trường; tổng đúng', () => {
    const b = hopDong({
      ten_don_vi: 'Trường Bịa B',
      ma_truong: '0002',
      ban_chup: { ...BAN_CHUP, ht_ho_ten: 'HT B', kt_ho_ten: 'KT B' },
    });
    const a = hopDong({ ten_don_vi: 'Trường Bịa A' });
    const { dong, tong } = dongChiHoTroKhtc([b, a]);
    expect(dong).toEqual([
      [
        1,
        '0001',
        'Trường Bịa A',
        'Hiệu trưởng',
        'Hiệu Trưởng Bịa',
        '0099887766554433',
        'Ngân hàng Giả – CN Thử',
        1_000_000,
      ],
      [
        2,
        '0001',
        'Trường Bịa A',
        'Kế toán',
        'Kế Toán Bịa',
        '0055443322',
        'Ngân hàng Giả – CN Hai',
        500_000,
      ],
      [
        3,
        '0002',
        'Trường Bịa B',
        'Hiệu trưởng',
        'HT B',
        '0099887766554433',
        'Ngân hàng Giả – CN Thử',
        1_000_000,
      ],
      [
        4,
        '0002',
        'Trường Bịa B',
        'Kế toán',
        'KT B',
        '0055443322',
        'Ngân hàng Giả – CN Hai',
        500_000,
      ],
    ]);
    expect(dong[0]).toHaveLength(COT_CHI_HO_TRO_KHTC.length);
    expect(tong).toBe(3_000_000);
  });

  it('bản chụp thiếu Kế toán → vẫn có dòng (ô trống) để KHTC thấy chỗ hụt', () => {
    const { dong } = dongChiHoTroKhtc([
      hopDong({ ban_chup: { ht_ho_ten: 'HT Bịa' } }),
    ]);
    expect(dong).toHaveLength(2);
    expect(dong[1].slice(3)).toEqual(['Kế toán', null, null, null, 500_000]);
  });

  it('không có hợp đồng → không dòng, tổng 0', () => {
    expect(dongChiHoTroKhtc([])).toEqual({ dong: [], tong: 0 });
  });
});

describe('tenFileKhtc', () => {
  it('khtc-<slug đợt>-<YYYYMMDD giờ VN>.xlsx', () => {
    expect(
      tenFileKhtc(
        'HSG An Giang 2026 – Đợt 1',
        new Date('2026-11-23T18:00:00Z'),
      ),
    ).toBe('khtc-hsg-an-giang-2026-dot-1-20261124.xlsx');
  });
});

describe('taoFileKhtc — cấu trúc file', () => {
  async function doc(buf: Buffer) {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf as unknown as ExcelJS.Buffer);
    return wb;
  }
  const hang = (sh: ExcelJS.Worksheet, r: number) =>
    (sh.getRow(r).values as unknown[]).slice(1);

  it('3 sheet đúng tên + thứ tự; tiêu đề đậm, cố định, có lọc; ô mã giữ số 0 đầu dạng chữ; dòng Tổng cộng', async () => {
    const gv: GiaoVienKhtc[] = [
      {
        ma_truong: '0001',
        ten_truong: 'Trường Bịa Một',
        ho_ten: 'GV Bịa',
        ngay_sinh: '1990-01-31',
        lop: 'Toán',
        giai_doan: 'ca_hai',
        ty_le_suat: 1,
      },
    ];
    const wb = await doc(await taoFileKhtc([hopDong()], gv));
    expect(wb.worksheets.map((s) => s.name)).toEqual([...SHEET_KHTC]);
    expect(SHEET_KHTC).toEqual(['Hợp đồng', 'Danh sách GV', 'Chi hỗ trợ']);
    for (const sh of wb.worksheets) {
      expect(sh.getRow(1).font?.bold).toBe(true);
      expect(sh.views[0]).toMatchObject({ state: 'frozen', ySplit: 1 });
      expect(sh.autoFilter).toBeTruthy();
    }
    const hd = wb.getWorksheet('Hợp đồng') as ExcelJS.Worksheet;
    expect(hang(hd, 1)).toEqual(COT_HOP_DONG_KHTC.map((c) => c.nhan));
    expect(hd.rowCount).toBe(2);
    const cotMst =
      COT_HOP_DONG_KHTC.findIndex((c) => c.key === 'ma_so_thue') + 1;
    expect(hd.getRow(2).getCell(cotMst).value).toBe('0123456789');
    expect(hd.getColumn(cotMst).numFmt).toBe('@');
    const cotGiaTri =
      COT_HOP_DONG_KHTC.findIndex((c) => c.key === 'gia_tri') + 1;
    expect(hd.getRow(2).getCell(cotGiaTri).value).toBe(3_086_418);
    expect(hd.getColumn(cotGiaTri).numFmt).toBe('#,##0');

    const ds = wb.getWorksheet('Danh sách GV') as ExcelJS.Worksheet;
    expect(hang(ds, 1)).toEqual(COT_GIAO_VIEN_KHTC.map((c) => c.nhan));
    expect(ds.getColumn(5).numFmt).toBe('dd/mm/yyyy');
    expect(ds.rowCount).toBe(2);

    const chi = wb.getWorksheet('Chi hỗ trợ') as ExcelJS.Worksheet;
    expect(hang(chi, 1)).toEqual(COT_CHI_HO_TRO_KHTC.map((c) => c.nhan));
    expect(chi.rowCount).toBe(4);
    expect(chi.getRow(4).getCell(1).value).toBe(TONG_CONG);
    expect(chi.getRow(4).getCell(8).value).toBe(1_500_000);
    expect(chi.getRow(4).font?.bold).toBe(true);
  });

  it('không hợp đồng nào → file hợp lệ, cả 3 sheet chỉ có tiêu đề', async () => {
    const wb = await doc(await taoFileKhtc([], []));
    expect(wb.worksheets.map((s) => s.name)).toEqual([...SHEET_KHTC]);
    for (const sh of wb.worksheets) expect(sh.rowCount).toBe(1);
  });
});
