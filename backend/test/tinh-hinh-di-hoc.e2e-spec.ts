import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import * as bcrypt from 'bcryptjs';
import * as ExcelJS from 'exceljs';
import { createTestApp } from './utils/test-app';
import {
  prisma,
  taoDonViTest,
  uniqueSuffix,
  xoaDonViTest,
  xoaNguoiDungTest,
} from './utils/test-data';

// ADR 0010: Tình hình đi học + điểm danh bổ sung.
// Người hỗ trợ "ht" giữ cụm 1 + lớp A. Lớp A (G1): a1 −10 ngày, a2 −5, a3 +5.
// Lớp B (G1): b2 −6 (buổi 2 — buổi chốt khi An đổi ra a2). Lớp C (G2): c1 −4.
// - An: cụm 1, trường 1, G1→A, G2→C; đổi a2 → b2 (đã duyệt); vắng a1.
// - Bình: không cụm, trường 2, G1→A (trong phạm vi qua lớp). Mã MOET có số 0 đầu.
// - Cường: cụm 1, trường 2, G1→B.
// - Dũng: cụm 2 (không thuộc tôi), G1→B → ngoài phạm vi hỗ trợ; Quản trị thấy.
describe('Tình hình đi học + điểm danh bổ sung (e2e, ADR 0010)', () => {
  let app: INestApplication;
  const suf = uniqueSuffix();
  const SUF = suf.toUpperCase();
  const MAT_KHAU = 'MatKhau123';
  const hocVienIds: string[] = [];
  const dangKyIds: string[] = [];
  const nguoiDungIds: string[] = [];
  const token: Record<string, string> = {};
  const id: Record<string, string> = {};
  let khoaId: string;
  let dv1: Awaited<ReturnType<typeof taoDonViTest>>;
  let dv2: Awaited<ReturnType<typeof taoDonViTest>>;
  const lop = { a: '', b: '', c: '' };
  const cum = { mot: '', hai: '' };
  const lich = { a1: '', a2: '', a3: '', b2: '', c1: '' };
  const dk = { an: '', binh: '', cuong: '', dung: '' };
  const gd = { g1: '', g2: '' };

  const http = () => request(app.getHttpServer());
  const get = (path: string, tk = token.ht) =>
    http()
      .get(path)
      .set({ Authorization: `Bearer ${tk}` });
  const put = (path: string, body: Record<string, unknown>, tk = token.ht) =>
    http()
      .put(path)
      .set({ Authorization: `Bearer ${tk}` })
      .send(body);
  const ds = async (
    qs: string,
    tk = token.ht,
    goc = '/ho-tro-hoc-vien/di-hoc',
  ) => {
    const res = await get(`${goc}?khoa_id=${khoaId}${qs}`, tk);
    expect(res.status).toBe(200);
    return res.body as {
      data: { ho_ten: string; tong: Record<string, number> }[];
      total: number;
      page: number;
      page_size: number;
    };
  };
  const ten = (b: { data: { ho_ten: string }[] }) =>
    b.data.map((x) => x.ho_ten);

  async function taoNguoiDung(
    k: string,
    vaiTro: 'ho_tro_hoc_vien' | 'ho_tro_giang_vien' | 'quan_tri',
  ) {
    const nd = await prisma.nguoi_dung.create({
      data: {
        ho_ten: `THDH ${k}`,
        ten_dang_nhap: `thdh-${k}-${suf}`,
        email: `thdh-${k}-${suf}@thdh.vn`,
        vai_tro: vaiTro,
        mat_khau_hash: await bcrypt.hash(MAT_KHAU, 4),
        phai_doi_mat_khau: false,
      },
    });
    nguoiDungIds.push(nd.id);
    id[k] = nd.id;
    token[k] = (
      await http()
        .post('/auth/dang-nhap')
        .send({ ten_dang_nhap: nd.ten_dang_nhap, mat_khau: MAT_KHAU })
        .expect(200)
    ).body.token as string;
  }

  beforeAll(async () => {
    app = await createTestApp({ raiseThrottlerLimit: true });
    dv1 = await taoDonViTest('thdh1');
    dv2 = await taoDonViTest('thdh2');
    await taoNguoiDung('ht', 'ho_tro_hoc_vien');
    await taoNguoiDung('htgv', 'ho_tro_giang_vien');
    await taoNguoiDung('qt', 'quan_tri');

    khoaId = (
      await prisma.khoa_boi_duong.create({
        data: {
          ma_khoa: `K-THDH-${SUF}`,
          ten_khoa: `Khóa đi học ${suf}`,
          don_vi_dat_hang_id: dv1.donVi.id,
          thoi_gian_bat_dau: new Date('2026-01-01'),
          thoi_gian_ket_thuc: new Date('2027-12-31'),
          trang_thai: 'da_duyet',
        },
      })
    ).id;
    const taoGd = (thuTu: number) =>
      prisma.giai_doan_khoa.create({
        data: {
          khoa_id: khoaId,
          thu_tu: thuTu,
          ten_giai_doan: `Giai đoạn ${thuTu}`,
          hinh_thuc: 'truc_tuyen',
          thoi_gian_bat_dau: new Date('2026-01-01'),
          thoi_gian_ket_thuc: new Date('2027-12-31'),
        },
      });
    const g1 = await taoGd(1);
    const g2 = await taoGd(2);
    gd.g1 = g1.id;
    gd.g2 = g2.id;
    const taoLop = async (t: string) =>
      (
        await prisma.lop_hoc.create({
          data: { khoa_id: khoaId, loai_lop: 'zoom', ten_lop: t },
        })
      ).id;
    lop.a = await taoLop('Zoom A');
    lop.b = await taoLop('Zoom B');
    lop.c = await taoLop('Zoom C');
    cum.mot = (
      await prisma.cum_hoc_vien.create({
        data: { khoa_id: khoaId, ten_cum: 'Cụm 1' },
      })
    ).id;
    cum.hai = (
      await prisma.cum_hoc_vien.create({
        data: { khoa_id: khoaId, ten_cum: 'Cụm 2' },
      })
    ).id;
    await prisma.phan_cong_ho_tro.create({
      data: { nguoi_dung_id: id.ht, cum_id: cum.mot },
    });
    await prisma.phan_cong_ho_tro_lop.create({
      data: { nguoi_dung_id: id.ht, lop_id: lop.a },
    });

    const ngay = (n: number) => new Date(Date.now() + n * 24 * 3600 * 1000);
    const taoBuoi = async (
      k: keyof typeof lich,
      lopId: string,
      gdId: string,
      buoiSo: number,
      n: number,
    ) => {
      lich[k] = (
        await prisma.lich_hoc_lop.create({
          data: {
            lop_id: lopId,
            giai_doan_id: gdId,
            buoi_so: buoiSo,
            thoi_gian_bat_dau: ngay(n),
            thoi_gian_ket_thuc: new Date(ngay(n).getTime() + 3 * 3600000),
          },
        })
      ).id;
    };
    await taoBuoi('a1', lop.a, g1.id, 1, -10);
    await taoBuoi('a2', lop.a, g1.id, 2, -5);
    await taoBuoi('a3', lop.a, g1.id, 3, 5);
    await taoBuoi('b2', lop.b, g1.id, 2, -6);
    await taoBuoi('c1', lop.c, g2.id, 1, -4);

    const hv: [
      keyof typeof dk,
      string,
      string,
      string | null,
      [string, string][],
    ][] = [
      [
        'an',
        'Nguyễn An',
        dv1.donVi.id,
        cum.mot,
        [
          [g1.id, lop.a],
          [g2.id, lop.c],
        ],
      ],
      ['binh', 'Trần Bình', dv2.donVi.id, null, [[g1.id, lop.a]]],
      ['cuong', 'Lê Cường', dv2.donVi.id, cum.mot, [[g1.id, lop.b]]],
      ['dung', 'Phạm Dũng', dv1.donVi.id, cum.hai, [[g1.id, lop.b]]],
    ];
    for (const [k, hoTen, dvId, cumId, cap] of hv) {
      const h = await prisma.hoc_vien.create({
        data: {
          nguon_tao: 'import_moet',
          ma_dinh_danh_moet: `00${k.toUpperCase()}${SUF}`,
          ho_ten: hoTen,
          ngay_sinh: 2,
          thang_sinh: 3,
          nam_sinh: 1988,
          don_vi_cong_tac_id: dvId,
        },
      });
      hocVienIds.push(h.id);
      const d = await prisma.dang_ky_hoc.create({
        data: { hoc_vien_id: h.id, khoa_id: khoaId, cum_id: cumId },
      });
      dk[k] = d.id;
      dangKyIds.push(d.id);
      await prisma.phan_lop_giai_doan.createMany({
        data: cap.map(([gdId, lopId]) => ({
          dang_ky_hoc_id: d.id,
          giai_doan_id: gdId,
          lop_id: lopId,
        })),
      });
    }
    await prisma.doi_buoi_hoc.create({
      data: {
        dang_ky_hoc_id: dk.an,
        lich_nguon_id: lich.a2,
        lich_de_nghi_id: lich.b2,
        lich_chot_id: lich.b2,
        ly_do: 'Trùng lịch',
        trang_thai: 'da_duyet',
      },
    });
    await prisma.diem_danh.create({
      data: {
        dang_ky_hoc_id: dk.an,
        lich_hoc_id: lich.a1,
        trang_thai: 'vang',
        nguon: 'zoom',
      },
    });
  });

  afterAll(async () => {
    await prisma.doi_buoi_hoc.deleteMany({
      where: { dang_ky_hoc_id: { in: dangKyIds } },
    });
    await prisma.diem_danh.deleteMany({
      where: { dang_ky_hoc_id: { in: dangKyIds } },
    });
    await prisma.phan_cong_ho_tro_lop.deleteMany({
      where: { nguoi_dung_id: id.ht },
    });
    await prisma.phan_cong_ho_tro.deleteMany({
      where: { nguoi_dung_id: id.ht },
    });
    await prisma.phan_lop_giai_doan.deleteMany({
      where: { dang_ky_hoc_id: { in: dangKyIds } },
    });
    await prisma.dang_ky_hoc.deleteMany({ where: { id: { in: dangKyIds } } });
    await prisma.khoa_boi_duong.deleteMany({ where: { id: khoaId } });
    for (const n of nguoiDungIds) await xoaNguoiDungTest(n);
    await prisma.hoc_vien.deleteMany({ where: { id: { in: hocVienIds } } });
    await xoaDonViTest(
      [dv1.donVi.id, dv2.donVi.id],
      [
        dv1.diaDanhXa.id,
        dv1.diaDanhTinh.id,
        dv2.diaDanhXa.id,
        dv2.diaDanhTinh.id,
      ],
    );
    await prisma.$disconnect();
    await app.close();
  });

  it('hỗ trợ chỉ thấy học viên trong phạm vi (cụm ∪ lớp gốc); tổng tính buổi chốt, bỏ buổi tương lai', async () => {
    const b = await ds('');
    expect(ten(b)).toEqual(['Lê Cường', 'Nguyễn An', 'Trần Bình']);
    expect(b.total).toBe(3);
    const an = b.data.find((x) => x.ho_ten === 'Nguyễn An')!;
    // a1 vắng, b2 (chốt của a2) chưa điểm danh, c1 chưa điểm danh; a3 tương lai không tính.
    expect(an.tong).toEqual({
      da_dien_ra: 3,
      co_mat: 0,
      vang: 1,
      vang_co_phep: 0,
      da_bao_vang: 0,
      chua_diem_danh: 2,
    });
  });

  it('chi tiết ngoài phạm vi -> 404; trong phạm vi có buổi đổi', async () => {
    const ngoai = await get(`/ho-tro-hoc-vien/di-hoc/${dk.dung}`);
    expect(ngoai.status).toBe(404);
    expect(ngoai.body.error.message).toBe('Không tìm thấy hồ sơ học viên');
    const res = await get(`/ho-tro-hoc-vien/di-hoc/${dk.an}`);
    expect(res.status).toBe(200);
    const buoi = res.body.buoi as {
      lich_hoc_id: string;
      lich_nguon_id: string;
      doi_buoi: unknown;
      bo_sung_duoc: boolean;
    }[];
    expect(buoi.map((x) => x.lich_hoc_id)).toEqual([
      lich.a1,
      lich.b2,
      lich.a3,
      lich.c1,
    ]);
    expect(buoi[1]).toMatchObject({
      lich_nguon_id: lich.a2,
      doi_buoi: {
        tu_lop: { ten_lop: 'Zoom A' },
        sang_lop: { ten_lop: 'Zoom B' },
      },
      bo_sung_duoc: true,
    });
    expect(buoi[2].bo_sung_duoc).toBe(false);
  });

  it('lọc trường, mã MOET thiếu số 0 đầu, họ tên không dấu, cụm, lớp', async () => {
    expect(ten(await ds(`&don_vi_cong_tac_id=${dv2.donVi.id}`))).toEqual([
      'Lê Cường',
      'Trần Bình',
    ]);
    // Mã lưu "00BINH…": gõ thiếu số 0 đầu hoặc thừa số 0 đều thấy (ma-moet.util).
    expect(ten(await ds(`&q=BINH${SUF}`))).toEqual(['Trần Bình']);
    expect(ten(await ds(`&q=000BINH${SUF}`))).toEqual(['Trần Bình']);
    expect(ten(await ds(`&q=${encodeURIComponent('tran binh')}`))).toEqual([
      'Trần Bình',
    ]);
    expect(ten(await ds(`&cum_id=${cum.mot}`))).toEqual([
      'Lê Cường',
      'Nguyễn An',
    ]);
    expect(ten(await ds(`&lop_id=${lop.a}`))).toEqual([
      'Nguyễn An',
      'Trần Bình',
    ]);
    expect(ten(await ds('&co_vang=true'))).toEqual(['Nguyễn An']);
    const cumLa = await get(
      `/ho-tro-hoc-vien/di-hoc?khoa_id=${khoaId}&cum_id=${cum.hai}`,
    );
    expect(cumLa.status).toBe(404);
  });

  it('thiếu khoa_id -> 400; phân trang trả đúng total', async () => {
    expect((await get('/ho-tro-hoc-vien/di-hoc')).status).toBe(400);
    const b = await ds('&page=2&page_size=2');
    expect(b).toMatchObject({ total: 3, page: 2, page_size: 2 });
    expect(ten(b)).toEqual(['Trần Bình']);
  });

  it('ô lọc khóa: chỉ cụm của tôi, lớp có học viên trong phạm vi', async () => {
    const res = await get('/ho-tro-hoc-vien/di-hoc/khoa');
    expect(res.status).toBe(200);
    const k = (
      res.body as {
        khoa_id: string;
        cum: { id: string }[];
        lop: { ten_lop: string }[];
      }[]
    ).find((x) => x.khoa_id === khoaId)!;
    expect(k.cum.map((c) => c.id)).toEqual([cum.mot]);
    expect(k.lop.map((l) => l.ten_lop).sort()).toEqual([
      'Zoom A',
      'Zoom B',
      'Zoom C',
    ]);
  });

  it('xuất Excel: đủ mọi dòng (không phân trang), mã MOET dạng văn bản, ghi nhật ký', async () => {
    const res = await get(
      `/ho-tro-hoc-vien/di-hoc/xuat?khoa_id=${khoaId}&page_size=1`,
    )
      .buffer(true)
      .parse((r, cb) => {
        const chunks: Buffer[] = [];
        r.on('data', (c: Buffer) => chunks.push(c));
        r.on('end', () => cb(null, Buffer.concat(chunks)));
      });
    expect(res.status).toBe(200);
    expect(res.headers['content-disposition']).toMatch(
      /tinh-hinh-di-hoc-\d{8}\.xlsx/,
    );
    expect(res.headers['cache-control']).toBe('no-store');
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(res.body as unknown as ExcelJS.Buffer);
    const ws = wb.worksheets[0];
    expect(ws.rowCount).toBe(2 + 3);
    expect(ws.getRow(2).getCell(3).value).toBe('Mã MOET');
    const an = ws.getRow(4);
    expect(an.getCell(2).value).toBe('Nguyễn An');
    expect(an.getCell(3).value).toBe(`00AN${SUF}`);
    expect(ws.getRow(2).getCell(5).value).toBe('Xã/phường (trường)');
    expect(ws.getRow(2).getCell(6).value).toBe('Tỉnh/thành (trường)');
    expect(an.getCell(5).value).toBe(dv1.diaDanhXa.ten);
    expect(an.getCell(6).value).toBe(dv1.diaDanhTinh.ten);
    expect(an.getCell(8).value).toBe('GĐ1: Zoom A; GĐ2: Zoom C');
    expect(an.getCell(9).value).toBe('0/3');
    const nk = await prisma.nhat_ky_hoat_dong.count({
      where: {
        hanh_dong: 'ho_tro_xuat_tinh_hinh_di_hoc',
        nguoi_dung_id: id.ht,
      },
    });
    expect(nk).toBe(1);
  });

  describe('điểm danh bổ sung (hỗ trợ)', () => {
    const boSung = (dangKy: string, body: Record<string, unknown>) =>
      put(`/ho-tro-hoc-vien/di-hoc/${dangKy}/diem-danh`, body);

    it('buổi cũ (> 3 ngày) -> có mặt, nguon thu_cong, người sửa, ghi chú = lý do, nhật ký', async () => {
      const res = await boSung(dk.an, {
        lich_hoc_id: lich.a1,
        trang_thai: 'co_mat',
        ly_do: '  Có ảnh chụp Zoom  ',
      });
      expect(res.status).toBe(200);
      const o = await prisma.diem_danh.findUnique({
        where: {
          dang_ky_hoc_id_lich_hoc_id: {
            dang_ky_hoc_id: dk.an,
            lich_hoc_id: lich.a1,
          },
        },
      });
      expect(o).toMatchObject({
        trang_thai: 'co_mat',
        nguon: 'thu_cong',
        nguoi_sua: id.ht,
        ghi_chu: 'Có ảnh chụp Zoom',
        tu_diem_danh_luc: null,
      });
      const nk = await prisma.nhat_ky_hoat_dong.findFirst({
        where: { hanh_dong: 'ho_tro_diem_danh_bo_sung', nguoi_dung_id: id.ht },
      });
      expect(nk?.chi_tiet).toMatchObject({
        dang_ky_hoc_id: dk.an,
        lich_hoc_id: lich.a1,
        trang_thai_cu: 'vang',
        trang_thai_moi: 'co_mat',
      });
    });

    it('buổi chốt (đổi vào) -> vắng có phép được', async () => {
      const res = await boSung(dk.an, {
        lich_hoc_id: lich.b2,
        trang_thai: 'vang_co_phep',
        ly_do: 'Ốm',
      });
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        trang_thai: 'vang_co_phep',
        nguon: 'thu_cong',
      });
    });

    it('trạng thái "vắng", thiếu/rỗng lý do -> 400', async () => {
      expect(
        (
          await boSung(dk.an, {
            lich_hoc_id: lich.c1,
            trang_thai: 'vang',
            ly_do: 'x',
          })
        ).status,
      ).toBe(400);
      expect(
        (await boSung(dk.an, { lich_hoc_id: lich.c1, trang_thai: 'co_mat' }))
          .status,
      ).toBe(400);
      expect(
        (
          await boSung(dk.an, {
            lich_hoc_id: lich.c1,
            trang_thai: 'co_mat',
            ly_do: '   ',
          })
        ).status,
      ).toBe(400);
    });

    it('buổi tương lai, buổi nguồn đã đổi ra, buổi lớp khác không đổi vào -> 400', async () => {
      const tuongLai = await boSung(dk.an, {
        lich_hoc_id: lich.a3,
        trang_thai: 'co_mat',
        ly_do: 'x',
      });
      expect(tuongLai.status).toBe(400);
      expect(tuongLai.body.error.message).toBe('Buổi học chưa diễn ra');
      const nguon = await boSung(dk.an, {
        lich_hoc_id: lich.a2,
        trang_thai: 'co_mat',
        ly_do: 'x',
      });
      expect(nguon.status).toBe(400);
      expect(nguon.body.error.message).toBe(
        'Buổi học không thuộc lịch học của học viên',
      );
      expect(
        (
          await boSung(dk.binh, {
            lich_hoc_id: lich.b2,
            trang_thai: 'co_mat',
            ly_do: 'x',
          })
        ).status,
      ).toBe(400);
    });

    it('học viên ngoài phạm vi -> 404', async () => {
      expect(
        (
          await boSung(dk.dung, {
            lich_hoc_id: lich.b2,
            trang_thai: 'co_mat',
            ly_do: 'x',
          })
        ).status,
      ).toBe(404);
    });
  });

  it('vai trò khác gọi route hỗ trợ -> 403; hỗ trợ gọi route Quản trị -> 403', async () => {
    for (const tk of [token.htgv, token.qt]) {
      expect(
        (await get(`/ho-tro-hoc-vien/di-hoc?khoa_id=${khoaId}`, tk)).status,
      ).toBe(403);
    }
    expect(
      (
        await put(
          `/ho-tro-hoc-vien/di-hoc/${dk.an}/diem-danh`,
          { lich_hoc_id: lich.a1, trang_thai: 'co_mat', ly_do: 'x' },
          token.htgv,
        )
      ).status,
    ).toBe(403);
    expect((await get(`/thong-ke/di-hoc?khoa_id=${khoaId}`)).status).toBe(403);
  });

  describe('Quản trị (/thong-ke/di-hoc)', () => {
    it('thấy mọi học viên của khóa, cụm bất kỳ, chi tiết học viên ngoài phạm vi hỗ trợ', async () => {
      const b = await ds('', token.qt, '/thong-ke/di-hoc');
      expect(ten(b)).toEqual([
        'Lê Cường',
        'Nguyễn An',
        'Phạm Dũng',
        'Trần Bình',
      ]);
      expect(
        ten(await ds(`&cum_id=${cum.hai}`, token.qt, '/thong-ke/di-hoc')),
      ).toEqual(['Phạm Dũng']);
      const ct = await get(`/thong-ke/di-hoc/${dk.dung}`, token.qt);
      expect(ct.status).toBe(200);
      expect(ct.body.trang_thai_duoc).toEqual([
        'co_mat',
        'vang',
        'vang_co_phep',
      ]);
    });

    it('PUT "vắng" được (không bắt buộc lý do); vẫn chặn buổi không thuộc lịch', async () => {
      const res = await put(
        `/thong-ke/di-hoc/${dk.dung}/diem-danh`,
        { lich_hoc_id: lich.b2, trang_thai: 'vang' },
        token.qt,
      );
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        trang_thai: 'vang',
        nguon: 'thu_cong',
        ghi_chu: null,
      });
      const sai = await put(
        `/thong-ke/di-hoc/${dk.dung}/diem-danh`,
        { lich_hoc_id: lich.a1, trang_thai: 'vang' },
        token.qt,
      );
      expect(sai.status).toBe(400);
    });
  });

  // ADR 0010 T7: trạng thái mỗi buổi = tinhChuyenCan (ADR 0005 Z8) — học bù
  // ở lớp khác cùng (giai đoạn, buổi số) được tính như dashboard.
  // Bình (G1→A) học bù buổi 1 ở lớp trực tiếp T; Cường (G1→B) có dòng có mặt
  // ở lớp Zoom Z buổi 2 (chỉ tính khi khóa công nhận lớp cũ).
  describe('học bù / lớp khác (T7)', () => {
    const tt = { t1: '', z2: '' };
    const lopT = { t: '', z: '' };
    const ngay = (n: number) => new Date(Date.now() + n * 24 * 3600 * 1000);
    const taoLopBuoi = async (
      loai: 'truc_tiep' | 'zoom',
      ten: string,
      buoiSo: number,
      n: number,
    ) => {
      const l = await prisma.lop_hoc.create({
        data: { khoa_id: khoaId, loai_lop: loai, ten_lop: ten },
      });
      const b = await prisma.lich_hoc_lop.create({
        data: {
          lop_id: l.id,
          giai_doan_id: gd.g1,
          buoi_so: buoiSo,
          thoi_gian_bat_dau: ngay(n),
          thoi_gian_ket_thuc: new Date(ngay(n).getTime() + 3 * 3600000),
        },
      });
      return [l.id, b.id];
    };

    beforeAll(async () => {
      [lopT.t, tt.t1] = await taoLopBuoi('truc_tiep', 'Trực tiếp T', 1, -11);
      [lopT.z, tt.z2] = await taoLopBuoi('zoom', 'Zoom Z', 2, -7);
      await prisma.diem_danh.createMany({
        data: [
          {
            dang_ky_hoc_id: dk.binh,
            lich_hoc_id: tt.t1,
            trang_thai: 'co_mat',
            nguon: 'ky_ten',
            ghi_chu: 'Học bù',
          },
          {
            dang_ky_hoc_id: dk.cuong,
            lich_hoc_id: tt.z2,
            trang_thai: 'co_mat',
            nguon: 'zoom',
          },
        ],
      });
    });

    afterAll(async () => {
      await prisma.khoa_boi_duong.update({
        where: { id: khoaId },
        data: { che_do_chuyen_can: 'theo_lop_hien_tai' },
      });
    });

    it('danh sách: tổng có mặt tính học bù ở lớp trực tiếp khác', async () => {
      const binh = (await ds('')).data.find((x) => x.ho_ten === 'Trần Bình')!;
      // a1 có mặt (học bù ở T), a2 chưa điểm danh.
      expect(binh.tong).toEqual({
        da_dien_ra: 2,
        co_mat: 1,
        vang: 0,
        vang_co_phep: 0,
        da_bao_vang: 0,
        chua_diem_danh: 1,
      });
    });

    it('chi tiết: nhãn kèm lớp, nguon_tinh lop_khac, lop_tinh; hỗ trợ không bổ sung được', async () => {
      const res = await get(`/ho-tro-hoc-vien/di-hoc/${dk.binh}`);
      expect(res.status).toBe(200);
      const a1 = (
        res.body.buoi as {
          lich_hoc_id: string;
          diem_danh: Record<string, unknown>;
          bo_sung_duoc: boolean;
          ly_do_khong: string | null;
        }[]
      ).find((b) => b.lich_hoc_id === lich.a1)!;
      expect(a1.diem_danh).toMatchObject({
        ma: 'co_mat',
        nhan: 'Có mặt – ở lớp Trực tiếp T',
        nguon_tinh: 'lop_khac',
        lop_tinh: { id: lopT.t, ten_lop: 'Trực tiếp T' },
        trang_thai: null,
      });
      expect(a1.bo_sung_duoc).toBe(false);
      expect(a1.ly_do_khong).toBe(
        'Đã có mặt ở lớp Trực tiếp T (học bù/lớp cũ)',
      );
      const qt = await get(`/thong-ke/di-hoc/${dk.binh}`, token.qt);
      const qtA1 = (
        qt.body.buoi as { lich_hoc_id: string; bo_sung_duoc: boolean }[]
      ).find((b) => b.lich_hoc_id === lich.a1)!;
      expect(qtA1.bo_sung_duoc).toBe(true);
    });

    it('PUT bổ sung buổi đã có mặt nhờ học bù: hỗ trợ -> 400, Quản trị -> 200 (ghi vào buổi hiệu dụng)', async () => {
      const body = { lich_hoc_id: lich.a1, trang_thai: 'co_mat', ly_do: 'x' };
      const ht = await put(
        `/ho-tro-hoc-vien/di-hoc/${dk.binh}/diem-danh`,
        body,
      );
      expect(ht.status).toBe(400);
      expect(ht.body.error.message).toBe(
        'Đã có mặt ở lớp Trực tiếp T (học bù/lớp cũ)',
      );
      const qt = await put(
        `/thong-ke/di-hoc/${dk.binh}/diem-danh`,
        body,
        token.qt,
      );
      expect(qt.status).toBe(200);
      expect(qt.body).toMatchObject({
        lich_hoc_id: lich.a1,
        trang_thai: 'co_mat',
      });
      // Hòa trạng thái -> dòng của lớp hiện tại được dùng.
      const ct = await get(`/ho-tro-hoc-vien/di-hoc/${dk.binh}`);
      const a1 = (
        ct.body.buoi as {
          lich_hoc_id: string;
          diem_danh: Record<string, unknown>;
        }[]
      ).find((b) => b.lich_hoc_id === lich.a1)!;
      expect(a1.diem_danh).toMatchObject({
        nguon_tinh: 'lop_hien_tai',
        lop_tinh: { id: lop.a },
      });
    });

    it('có mặt ở lớp Zoom khác: khóa theo lớp hiện tại -> không tính; công nhận lớp cũ -> tính', async () => {
      const cuong = async () =>
        (await ds('')).data.find((x) => x.ho_ten === 'Lê Cường')!.tong;
      // Khóa mới mặc định cong_nhan_cung_muc (ADR 0014) — đặt tường minh.
      await prisma.khoa_boi_duong.update({
        where: { id: khoaId },
        data: { che_do_chuyen_can: 'theo_lop_hien_tai' },
      });
      expect((await cuong()).co_mat).toBe(0);
      await prisma.khoa_boi_duong.update({
        where: { id: khoaId },
        data: { che_do_chuyen_can: 'cong_nhan_lop_cu' },
      });
      expect(await cuong()).toMatchObject({
        da_dien_ra: 1,
        co_mat: 1,
        chua_diem_danh: 0,
      });
      const ct = await get(`/ho-tro-hoc-vien/di-hoc/${dk.cuong}`);
      expect(ct.body.buoi[0].diem_danh).toMatchObject({
        ma: 'co_mat',
        nhan: 'Có mặt – ở lớp Zoom Z',
        lop_tinh: { id: lopT.z },
      });
    });
  });

  // ADR 0011 P1/P4: phạm vi lớp gồm đổi buổi đã duyệt còn hiệu lực VÀO lớp
  // của tôi; lọc pham_vi = tat_ca | cum | lop. Khai báo cuối file để không đổi
  // số liệu các test ở trên.
  // - Em: không cụm, G1→B, đổi b2 → a2 (đã duyệt, còn hiệu lực) → trong phạm vi qua lớp A.
  // - Giang: không cụm, G1→B, đổi b2 → a2 nhưng CHỜ DUYỆT → ngoài phạm vi.
  // - Hà: không cụm, G1→C (đã phân lại), đổi b2 → a2 đã duyệt nhưng HẾT hiệu lực → ngoài.
  describe('ADR 0011: phạm vi theo cụm / lớp + đổi buổi vào lớp', () => {
    const dk2 = { em: '', giang: '', ha: '' };
    const tenSx = (b: { data: { ho_ten: string }[] }) => ten(b).sort();

    beforeAll(async () => {
      const ca: [keyof typeof dk2, string, string, 'da_duyet' | 'cho_duyet'][] =
        [
          ['em', 'Đỗ Em', lop.b, 'da_duyet'],
          ['giang', 'Võ Giang', lop.b, 'cho_duyet'],
          ['ha', 'Lý Hà', lop.c, 'da_duyet'],
        ];
      for (const [k, hoTen, lopG1, trangThai] of ca) {
        const h = await prisma.hoc_vien.create({
          data: {
            nguon_tao: 'import_moet',
            ma_dinh_danh_moet: `PV${k.toUpperCase()}${SUF}`,
            ho_ten: hoTen,
            ngay_sinh: 4,
            thang_sinh: 5,
            nam_sinh: 1990,
            don_vi_cong_tac_id: dv1.donVi.id,
          },
        });
        hocVienIds.push(h.id);
        const d = await prisma.dang_ky_hoc.create({
          data: { hoc_vien_id: h.id, khoa_id: khoaId },
        });
        dk2[k] = d.id;
        dangKyIds.push(d.id);
        await prisma.phan_lop_giai_doan.create({
          data: { dang_ky_hoc_id: d.id, giai_doan_id: gd.g1, lop_id: lopG1 },
        });
        await prisma.doi_buoi_hoc.create({
          data: {
            dang_ky_hoc_id: d.id,
            lich_nguon_id: lich.b2,
            lich_de_nghi_id: lich.a2,
            lich_chot_id: trangThai === 'da_duyet' ? lich.a2 : null,
            ly_do: 'Trùng lịch',
            trang_thai: trangThai,
          },
        });
      }
    });

    it('tat_ca (mặc định) = cụm ∪ lớp, gồm người đổi buổi còn hiệu lực vào lớp của tôi', async () => {
      const ky = ['Lê Cường', 'Nguyễn An', 'Trần Bình', 'Đỗ Em'].sort();
      expect(tenSx(await ds(''))).toEqual(ky);
      expect(tenSx(await ds('&pham_vi=tat_ca'))).toEqual(ky);
    });

    it('pham_vi=cum -> chỉ học viên trong cụm của tôi', async () => {
      expect(tenSx(await ds('&pham_vi=cum'))).toEqual(
        ['Lê Cường', 'Nguyễn An'].sort(),
      );
    });

    it('pham_vi=lop -> phân lớp gốc + đổi buổi còn hiệu lực vào lớp của tôi', async () => {
      expect(tenSx(await ds('&pham_vi=lop'))).toEqual(
        ['Nguyễn An', 'Trần Bình', 'Đỗ Em'].sort(),
      );
    });

    it('pham_vi không hợp lệ -> 400', async () => {
      expect(
        (await get(`/ho-tro-hoc-vien/di-hoc?khoa_id=${khoaId}&pham_vi=khoa`))
          .status,
      ).toBe(400);
    });

    it('chi tiết người đổi vào -> 200; chờ duyệt / hết hiệu lực -> 404', async () => {
      const em = await get(`/ho-tro-hoc-vien/di-hoc/${dk2.em}`);
      expect(em.status).toBe(200);
      for (const k of ['giang', 'ha'] as const)
        expect((await get(`/ho-tro-hoc-vien/di-hoc/${dk2[k]}`)).status).toBe(
          404,
        );
    });

    it('xuất Excel theo pham_vi=lop: đúng số dòng, nhật ký ghi bộ lọc', async () => {
      const res = await get(
        `/ho-tro-hoc-vien/di-hoc/xuat?khoa_id=${khoaId}&pham_vi=lop`,
      )
        .buffer(true)
        .parse((r, cb) => {
          const chunks: Buffer[] = [];
          r.on('data', (c: Buffer) => chunks.push(c));
          r.on('end', () => cb(null, Buffer.concat(chunks)));
        });
      expect(res.status).toBe(200);
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(res.body as unknown as ExcelJS.Buffer);
      expect(wb.worksheets[0].rowCount).toBe(2 + 3);
      const nk = await prisma.nhat_ky_hoat_dong.findFirst({
        where: {
          hanh_dong: 'ho_tro_xuat_tinh_hinh_di_hoc',
          nguoi_dung_id: id.ht,
        },
        orderBy: { thoi_gian: 'desc' },
      });
      expect(nk?.chi_tiet).toMatchObject({
        bo_loc: { pham_vi: 'lop' },
        so_dong: 3,
      });
    });

    it('Quản trị bỏ qua pham_vi (vẫn thấy mọi học viên của khóa)', async () => {
      const b = await ds('&pham_vi=cum', token.qt, '/thong-ke/di-hoc');
      expect(ten(b)).toContain('Phạm Dũng');
      expect(ten(b)).toContain('Đỗ Em');
    });
  });
});
