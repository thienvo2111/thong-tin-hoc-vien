import {
  NGUONG_PHAN_4,
  NguCanhNop,
  canPhan4,
  chuanHoaNhapHopDong,
  docDauVaoHopDong,
  kiemTraPhan3,
  lyDoChanNop,
  ngayHienThi,
  truongHopDongThayDoi,
} from './quy-tac-hop-dong';
import { HoSoDonViDuLieu, TEN_TRUONG_HO_SO } from './ho-so-don-vi.quy-tac';

// Issue #64 / ADR 0015 S4, S5, S6, X4, M5: Phần 3–4 + điều kiện Nộp hợp đồng. Mọi giá trị đều BỊA.

const HO_SO_DU: HoSoDonViDuLieu = {
  ...(Object.fromEntries(TEN_TRUONG_HO_SO.map((t) => [t, null])) as Record<
    keyof HoSoDonViDuLieu,
    null
  >),
  ten_truong: 'Trường Bịa',
  dia_chi: 'Ấp Bịa',
  ma_so_thue: '0000000001',
  nguoi_dai_dien: 'Người Bịa',
  sdt_dai_dien: '0900000001',
  email_hoa_don: 'bia@mau.test',
  so_tai_khoan: '0000111122223333',
  ngan_hang: 'Ngân hàng Giả',
  chi_nhanh: 'Chi nhánh Giả',
  kho_bac: 'Kho bạc Giả',
  mst_kho_bac: '0000000001',
  ma_qhns: '7654321',
  ma_nguon: '13',
  ht_ho_ten: 'HT Bịa',
  ht_so_tai_khoan: '111',
  ht_ngan_hang: 'NH Giả',
  kt_ho_ten: 'KT Bịa',
  kt_sdt: '0900000002',
  kt_so_tai_khoan: '222',
  kt_ngan_hang: 'NH Giả',
};
const HAU_CAN = {
  dau_moi_csvc: 'Đầu mối Bịa 0900000003',
  muc_dap_ung_csvc: 'Đủ phòng máy',
  luu_tru: 'Nhà khách Bịa',
  di_chuyen: 'Xe khách Bịa',
};

/** Ngữ cảnh nộp được: dưới ngưỡng Phần 4 (giá trị 10.000.000). */
function nguCanh(them: Partial<NguCanhNop> = {}): NguCanhNop {
  return {
    trangThaiDanhSach: 'da_xac_nhan',
    trangThaiHopDong: 'chua_nop',
    donGia: 10_000_000,
    giaTri: 10_000_000,
    hoSo: HO_SO_DU,
    diemHocTrucTiep: false,
    phan3: {
      nguoi_nhan: 'Người Nhận Bịa',
      sdt_nguoi_nhan: '0900000009',
      dia_chi_nhan: 'Số 1, đường Bịa, xã Thử, tỉnh Giả',
    },
    phan4: { so_qd: null, ngay_qd: null },
    qdTu: '2026-11-01',
    qdDen: '2026-11-30',
    ...them,
  };
}

/** Ngữ cảnh ≥ ngưỡng, Phần 4 hợp lệ. */
const PHAN_4_DU = {
  giaTri: NGUONG_PHAN_4,
  donGia: NGUONG_PHAN_4,
  phan4: { so_qd: '12/QĐ-BIA', ngay_qd: '2026-11-15' },
};

const ma = (ctx: NguCanhNop) => lyDoChanNop(ctx).map((l) => l.ma);

describe('canPhan4 (S5)', () => {
  it('50.000.000 → cần Phần 4', () => {
    expect(canPhan4(50_000_000)).toBe(true);
  });
  it('49.999.999 → không cần', () => {
    expect(canPhan4(49_999_999)).toBe(false);
  });
  it('chưa có giá trị (null) → không cần', () => {
    expect(canPhan4(null)).toBe(false);
  });
});

describe('kiemTraPhan3 (X4 — chỉ lỗi định dạng)', () => {
  it('trống hết → không lỗi (nháp được)', () => {
    expect(kiemTraPhan3({})).toEqual({ loi: {} });
  });
  it('SĐT sai → thông báo SĐT', () => {
    expect(kiemTraPhan3({ sdt_nguoi_nhan: '123' }).loi).toEqual({
      sdt_nguoi_nhan: 'SĐT gồm 10 số, bắt đầu bằng 0',
    });
  });
  it('độ dài: người nhận 256, địa chỉ 2001, số QĐ 101 → lỗi; đúng biên → hợp lệ', () => {
    expect(
      kiemTraPhan3({
        nguoi_nhan: 'a'.repeat(256),
        dia_chi_nhan: 'a'.repeat(2001),
        ghi_chu: 'a'.repeat(2001),
        so_qd: 'a'.repeat(101),
      }).loi,
    ).toEqual({
      nguoi_nhan: 'Tối đa 255 ký tự',
      dia_chi_nhan: 'Tối đa 2000 ký tự',
      ghi_chu: 'Tối đa 2000 ký tự',
      so_qd: 'Tối đa 100 ký tự',
    });
    expect(
      kiemTraPhan3({
        nguoi_nhan: 'a'.repeat(255),
        dia_chi_nhan: 'a'.repeat(2000),
        so_qd: 'a'.repeat(100),
      }).loi,
    ).toEqual({});
  });
  it.each(['2026-02-30', '15/11/2026', '2026-1-5'])(
    'ngày QĐ "%s" sai → lỗi',
    (v) => {
      expect(kiemTraPhan3({ ngay_qd: v }).loi).toEqual({
        ngay_qd: 'Ngày QĐ phải là ngày dạng YYYY-MM-DD',
      });
    },
  );
});

describe('chuanHoaNhapHopDong / docDauVaoHopDong / truongHopDongThayDoi', () => {
  it('trim, trống → null, SĐT bỏ dấu cách/chấm, khóa vắng → null/false', () => {
    expect(
      chuanHoaNhapHopDong({
        nguoi_nhan: '  Người Bịa ',
        sdt_nguoi_nhan: '0900 000.009',
        ghi_chu: '   ',
      }),
    ).toEqual({
      nguoi_nhan: 'Người Bịa',
      sdt_nguoi_nhan: '0900000009',
      dia_chi_nhan: null,
      ghi_chu: null,
      so_qd: null,
      ngay_qd: null,
      diem_hoc_truc_tiep: false,
    });
  });
  it('khóa lạ, kiểu sai → lỗi theo khóa; không phải đối tượng → lỗi body', () => {
    expect(
      docDauVaoHopDong({
        nguoi_nhan: 1,
        diem_hoc_truc_tiep: 'co',
        trang_thai_hop_dong: 'da_nop',
      }).loi,
    ).toEqual({
      nguoi_nhan: 'Phải là chuỗi ký tự',
      diem_hoc_truc_tiep: 'Phải là true hoặc false',
      trang_thai_hop_dong: 'Trường không hợp lệ',
    });
    expect(docDauVaoHopDong([]).loi).toEqual({
      body: 'Dữ liệu gửi lên phải là đối tượng JSON',
    });
  });
  it('chỉ trả TÊN khóa đổi', () => {
    const cu = chuanHoaNhapHopDong({ nguoi_nhan: 'A' });
    const moi = chuanHoaNhapHopDong({
      nguoi_nhan: 'A',
      so_qd: '1',
      diem_hoc_truc_tiep: true,
    });
    expect(truongHopDongThayDoi(cu, moi)).toEqual([
      'so_qd',
      'diem_hoc_truc_tiep',
    ]);
  });
  it('ngayHienThi không lệch múi giờ', () => {
    expect(ngayHienThi('2026-11-01')).toBe('01/11/2026');
  });
});

describe('lyDoChanNop (X4, S4, S5, S6, M5)', () => {
  it('đủ mọi điều kiện, dưới ngưỡng → []', () => {
    expect(lyDoChanNop(nguCanh())).toEqual([]);
  });

  it('đủ mọi điều kiện, ≥ ngưỡng kèm Phần 4 hợp lệ → []', () => {
    expect(lyDoChanNop(nguCanh(PHAN_4_DU))).toEqual([]);
  });

  it('đã nộp → chỉ da_nop', () => {
    expect(
      lyDoChanNop(
        nguCanh({
          trangThaiHopDong: 'da_nop',
          trangThaiDanhSach: 'cho_xac_nhan',
        }),
      ),
    ).toEqual([{ ma: 'da_nop', thong_diep: 'Hợp đồng đã nộp' }]);
  });

  it.each(['cho_xac_nhan', 'bao_sai_lech'] as const)(
    'danh sách %s → danh_sach_chua_xac_nhan',
    (trangThaiDanhSach) => {
      expect(lyDoChanNop(nguCanh({ trangThaiDanhSach }))).toEqual([
        {
          ma: 'danh_sach_chua_xac_nhan',
          thong_diep: 'Danh sách chưa được xác nhận',
        },
      ]);
    },
  );

  it('chưa có đơn giá → chua_co_don_gia, giá trị null nên không xét Phần 4', () => {
    expect(
      lyDoChanNop(
        nguCanh({ donGia: null, giaTri: null, qdTu: null, qdDen: null }),
      ),
    ).toEqual([
      {
        ma: 'chua_co_don_gia',
        thong_diep: 'Đợt chưa có đơn giá — chờ HCMUE cập nhật',
      },
    ]);
  });

  it('hồ sơ thiếu 2 mục → ho_so_chua_du kèm số mục', () => {
    expect(
      lyDoChanNop(
        nguCanh({ hoSo: { ...HO_SO_DU, ma_qhns: null, kt_sdt: '12' } }),
      ),
    ).toEqual([
      { ma: 'ho_so_chua_du', thong_diep: 'Hồ sơ đơn vị còn thiếu 2 mục' },
    ]);
  });

  it('chưa khai hồ sơ (null) → thiếu đủ 20 mục bắt buộc', () => {
    expect(lyDoChanNop(nguCanh({ hoSo: null }))).toEqual([
      { ma: 'ho_so_chua_du', thong_diep: 'Hồ sơ đơn vị còn thiếu 20 mục' },
    ]);
  });

  it('điểm học trực tiếp, thiếu 1 mục hậu cần → thieu_hau_can', () => {
    const hoSo = { ...HO_SO_DU, ...HAU_CAN, di_chuyen: '  ' };
    expect(ma(nguCanh({ diemHocTrucTiep: true, hoSo }))).toEqual([
      'thieu_hau_can',
    ]);
  });

  it('điểm học trực tiếp, đủ hậu cần → nộp được; không phải điểm học → không xét hậu cần', () => {
    expect(
      ma(nguCanh({ diemHocTrucTiep: true, hoSo: { ...HO_SO_DU, ...HAU_CAN } })),
    ).toEqual([]);
    expect(ma(nguCanh({ diemHocTrucTiep: false, hoSo: HO_SO_DU }))).toEqual([]);
  });

  it.each([
    ['thiếu người nhận', { nguoi_nhan: null }],
    ['thiếu SĐT', { sdt_nguoi_nhan: null }],
    ['SĐT sai', { sdt_nguoi_nhan: '1900000000' }],
    ['thiếu địa chỉ', { dia_chi_nhan: '   ' }],
  ])('Phần 3 %s → phan_3_chua_du', (_, sua) => {
    const ctx = nguCanh();
    expect(lyDoChanNop({ ...ctx, phan3: { ...ctx.phan3, ...sua } })).toEqual([
      {
        ma: 'phan_3_chua_du',
        thong_diep: 'Phần 3 (người nhận bản giấy hợp đồng) còn thiếu hoặc sai',
      },
    ]);
  });

  it('≥ ngưỡng, thiếu số QĐ → thieu_so_qd', () => {
    expect(
      lyDoChanNop(
        nguCanh({
          ...PHAN_4_DU,
          phan4: { so_qd: null, ngay_qd: '2026-11-15' },
        }),
      ),
    ).toEqual([
      {
        ma: 'thieu_so_qd',
        thong_diep: 'Hợp đồng từ 50.000.000 đ cần số QĐ chỉ định thầu',
      },
    ]);
  });

  it('≥ ngưỡng, thiếu ngày QĐ → thieu_ngay_qd', () => {
    expect(
      lyDoChanNop(
        nguCanh({ ...PHAN_4_DU, phan4: { so_qd: '12/QĐ', ngay_qd: null } }),
      ),
    ).toEqual([
      {
        ma: 'thieu_ngay_qd',
        thong_diep: 'Hợp đồng từ 50.000.000 đ cần ngày QĐ chỉ định thầu',
      },
    ]);
  });

  it('≥ ngưỡng, đợt chưa cấu hình khoảng ngày QĐ → dot_chua_cau_hinh_ngay_qd', () => {
    expect(
      lyDoChanNop(nguCanh({ ...PHAN_4_DU, qdTu: null, qdDen: null })),
    ).toEqual([
      {
        ma: 'dot_chua_cau_hinh_ngay_qd',
        thong_diep: 'Đợt chưa cấu hình khoảng ngày QĐ — chờ HCMUE',
      },
    ]);
  });

  it.each([
    ['2026-11-01', true],
    ['2026-11-30', true],
    ['2026-10-31', false],
    ['2026-12-01', false],
  ])('ngày QĐ %s (khoảng 01/11–30/11) → nộp được: %s', (ngay_qd, duoc) => {
    const ld = lyDoChanNop(
      nguCanh({ ...PHAN_4_DU, phan4: { so_qd: '12/QĐ', ngay_qd } }),
    );
    expect(ld).toEqual(
      duoc
        ? []
        : [
            {
              ma: 'ngay_qd_ngoai_khoang',
              thong_diep: 'Ngày QĐ phải từ 01/11/2026 đến 30/11/2026',
            },
          ],
    );
  });

  it('biên: 50.000.000 thiếu Phần 4 → chặn; 49.999.999 thiếu Phần 4 → nộp được', () => {
    expect(ma(nguCanh({ giaTri: 50_000_000, donGia: 50_000_000 }))).toEqual([
      'thieu_so_qd',
      'thieu_ngay_qd',
    ]);
    expect(ma(nguCanh({ giaTri: 49_999_999, donGia: 49_999_999 }))).toEqual([]);
  });

  it('nhiều lý do → đúng thứ tự hiển thị', () => {
    expect(
      ma({
        ...nguCanh({
          trangThaiDanhSach: 'cho_xac_nhan',
          hoSo: null,
          diemHocTrucTiep: true,
          giaTri: 60_000_000,
          qdTu: null,
          qdDen: null,
          phan4: { so_qd: null, ngay_qd: null },
        }),
        phan3: { nguoi_nhan: null, sdt_nguoi_nhan: null, dia_chi_nhan: null },
      }),
    ).toEqual([
      'danh_sach_chua_xac_nhan',
      'ho_so_chua_du',
      'thieu_hau_can',
      'phan_3_chua_du',
      'thieu_so_qd',
      'thieu_ngay_qd',
      'dot_chua_cau_hinh_ngay_qd',
    ]);
  });
});
