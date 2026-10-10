import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import * as bcrypt from 'bcryptjs';
import * as ExcelJS from 'exceljs';
import { createTestApp } from './utils/test-app';
import {
  prisma,
  taoDonViTest,
  uniqueSuffix,
  xoaNguoiDungTest,
  xoaDonViTest,
} from './utils/test-data';

const GIO = 60 * 60 * 1000;
const NGAY = 24 * GIO;
const MAT_KHAU = 'MatKhau123';

async function buildXlsx(rows: string[][]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('data');
  rows.forEach((r) => sheet.addRow(r));
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

// ADR 0005 Z3/Z7 (issue #26): sửa nhanh 1 ô điểm danh + bảng điểm danh lớp;
// import ghi đè nhưng giữ tu_diem_danh_luc. Mốc thời gian tương đối với now.
describe('Sửa nhanh điểm danh — GET/PUT /lop/:id/diem-danh (e2e)', () => {
  let app: INestApplication;
  const suf = uniqueSuffix();
  const MIEN = `@sdd-${suf}.test.local`;
  let dv: Awaited<ReturnType<typeof taoDonViTest>>;
  const nguoiDungIds: string[] = [];
  const hocVienIds: string[] = [];
  const khoaIds: string[] = [];
  const importIds: string[] = [];
  let giangVienId: string;
  const token: Record<string, string> = {};
  const id: Record<string, string> = {};
  let maKhoaA: string;
  let moetHv1: string;

  const http = () => request(app.getHttpServer());
  const tg = (offsetMs: number) => new Date(Date.now() + offsetMs);
  const sua = (
    lopId: string,
    body: Record<string, unknown>,
    tk = token.hoTroGv,
  ) =>
    http()
      .put(`/lop/${lopId}/diem-danh`)
      .set('Authorization', `Bearer ${tk}`)
      .send(body);
  const o = (lichHocId: string, dangKyHocId = id.dk1) =>
    prisma.diem_danh.findUnique({
      where: {
        dang_ky_hoc_id_lich_hoc_id: {
          dang_ky_hoc_id: dangKyHocId,
          lich_hoc_id: lichHocId,
        },
      },
    });

  async function taoNguoiDung(
    ten: string,
    vaiTro: 'quan_tri' | 'ho_tro_giang_vien' | 'ho_tro_hoc_vien' | 'giang_vien',
    giangVien?: string,
  ) {
    const nd = await prisma.nguoi_dung.create({
      data: {
        ho_ten: `SDD ${ten}`,
        ten_dang_nhap: `sdd-${ten}-${suf}`.toLowerCase(),
        email: `${ten}${MIEN}`.toLowerCase(),
        vai_tro: vaiTro,
        giang_vien_id: giangVien,
        mat_khau_hash: await bcrypt.hash(MAT_KHAU, 4),
        phai_doi_mat_khau: false,
      },
    });
    nguoiDungIds.push(nd.id);
    id[ten] = nd.id;
    token[ten] = (
      await http()
        .post('/auth/dang-nhap')
        .send({ ten_dang_nhap: nd.ten_dang_nhap, mat_khau: MAT_KHAU })
        .expect(200)
    ).body.token;
  }

  async function taoKhoa(nhan: string) {
    const khoa = await prisma.khoa_boi_duong.create({
      data: {
        ma_khoa: `SDD-${nhan}-${suf}`,
        ten_khoa: `Khóa sửa điểm danh ${nhan}`,
        don_vi_dat_hang_id: dv.donVi.id,
        thoi_gian_bat_dau: new Date('2026-01-01'),
        thoi_gian_ket_thuc: new Date('2027-12-31'),
        trang_thai: 'da_duyet',
      },
    });
    khoaIds.push(khoa.id);
    const gd = await prisma.giai_doan_khoa.create({
      data: {
        khoa_id: khoa.id,
        thu_tu: 1,
        ten_giai_doan: 'GĐ 1',
        hinh_thuc: 'truc_tuyen',
        thoi_gian_bat_dau: new Date('2026-01-01'),
        thoi_gian_ket_thuc: new Date('2027-12-31'),
      },
    });
    return { khoa, gdId: gd.id };
  }

  async function taoLop(khoaId: string, ten: string) {
    return (
      await prisma.lop_hoc.create({
        data: { khoa_id: khoaId, loai_lop: 'zoom', ten_lop: ten },
      })
    ).id;
  }

  async function taoBuoi(lop: string, gd: string, so: number, batDau: Date) {
    return (
      await prisma.lich_hoc_lop.create({
        data: {
          lop_id: lop,
          giai_doan_id: gd,
          buoi_so: so,
          thoi_gian_bat_dau: batDau,
          thoi_gian_ket_thuc: new Date(batDau.getTime() + 3 * GIO),
          dia_diem_hoac_link: 'https://zoom.us/j/sdd',
          // Khóa không bật Zoom nên cron không chốt; đánh dấu thêm cho chắc.
          chot_diem_danh_luc: new Date(),
        },
      })
    ).id;
  }

  async function taoHocVien(
    nhan: string,
    khoaId: string,
    gd: string,
    lop: string,
  ) {
    const moet = `SDD-${nhan}-${suf}`;
    const hv = await prisma.hoc_vien.create({
      data: {
        nguon_tao: 'import_moet',
        ma_dinh_danh_moet: moet,
        ho_ten: `Học Viên ${nhan}`,
        ngay_sinh: 1,
        thang_sinh: 1,
        nam_sinh: 1990,
        don_vi_cong_tac_id: dv.donVi.id,
      },
    });
    hocVienIds.push(hv.id);
    const dk = await prisma.dang_ky_hoc.create({
      data: { hoc_vien_id: hv.id, khoa_id: khoaId, trang_thai: 'da_duyet' },
    });
    await prisma.phan_lop_giai_doan.create({
      data: { dang_ky_hoc_id: dk.id, giai_doan_id: gd, lop_id: lop },
    });
    return { dkId: dk.id, moet };
  }

  beforeAll(async () => {
    app = await createTestApp({ raiseThrottlerLimit: true });
    dv = await taoDonViTest('sdd');
    giangVienId = (
      await prisma.giang_vien.create({
        data: {
          ho_ten: `GV SDD ${suf}`,
          so_dien_thoai: `09${Date.now().toString().slice(-8)}`,
          email: `gv${MIEN}`,
        },
      })
    ).id;
    await taoNguoiDung('quanTri', 'quan_tri');
    await taoNguoiDung('hoTroGv', 'ho_tro_giang_vien');
    await taoNguoiDung('hoTroGvKhac', 'ho_tro_giang_vien');
    await taoNguoiDung('hoTroHv', 'ho_tro_hoc_vien');
    await taoNguoiDung('giangVien', 'giang_vien', giangVienId);

    const a = await taoKhoa('A');
    const b = await taoKhoa('B');
    maKhoaA = a.khoa.ma_khoa;
    id.gdA = a.gdId;
    await prisma.phan_cong_ho_tro_gv.createMany({
      data: [
        { nguoi_dung_id: id.hoTroGv, khoa_id: a.khoa.id },
        { nguoi_dung_id: id.hoTroGvKhac, khoa_id: b.khoa.id },
      ],
    });
    id.lopA = await taoLop(a.khoa.id, 'Zoom A');
    id.lopC = await taoLop(a.khoa.id, 'Zoom C');
    id.lopB = await taoLop(b.khoa.id, 'Zoom B');
    id.trong = await taoBuoi(id.lopA, a.gdId, 1, tg(-GIO));
    id.haiNgay = await taoBuoi(id.lopA, a.gdId, 2, tg(-2 * NGAY));
    id.quaHan = await taoBuoi(id.lopA, a.gdId, 3, tg(-4 * NGAY));
    id.tuongLai = await taoBuoi(id.lopA, a.gdId, 4, tg(NGAY));
    id.buoiC = await taoBuoi(id.lopC, a.gdId, 1, tg(-GIO));
    id.buoiB = await taoBuoi(id.lopB, b.gdId, 1, tg(-GIO));
    const hv1 = await taoHocVien('1', a.khoa.id, a.gdId, id.lopA);
    id.dk1 = hv1.dkId;
    moetHv1 = hv1.moet;
    id.dk2 = (await taoHocVien('2', a.khoa.id, a.gdId, id.lopC)).dkId;
    id.dkB = (await taoHocVien('B', b.khoa.id, b.gdId, id.lopB)).dkId;
  });

  afterAll(async () => {
    await prisma.dang_ky_hoc.deleteMany({
      where: { khoa_id: { in: khoaIds } },
    });
    await prisma.nhat_ky_import.deleteMany({
      where: {
        OR: [
          { id: { in: importIds } },
          { nguoi_import_id: { in: nguoiDungIds } },
        ],
      },
    });
    await prisma.lich_hoc_lop.deleteMany({
      where: { lop: { khoa_id: { in: khoaIds } } },
    });
    await prisma.lop_hoc.deleteMany({ where: { khoa_id: { in: khoaIds } } });
    await prisma.khoa_boi_duong.deleteMany({ where: { id: { in: khoaIds } } });
    for (const nd of nguoiDungIds) await xoaNguoiDungTest(nd);
    await prisma.giang_vien.deleteMany({ where: { id: giangVienId } });
    await prisma.hoc_vien.deleteMany({ where: { id: { in: hocVienIds } } });
    await xoaDonViTest([dv.donVi.id], [dv.diaDanhXa.id, dv.diaDanhTinh.id]);
    await prisma.$disconnect();
    await app.close();
  });

  it('hỗ trợ GV trong khóa, buổi trong 3 ngày -> 200, ghi thu_cong + nguoi_sua + ghi chú', async () => {
    const res = await sua(id.lopA, {
      dang_ky_hoc_id: id.dk1,
      lich_hoc_id: id.trong,
      trang_thai: 'vang_co_phep',
      ghi_chu: '  Ốm  ',
    }).expect(200);
    expect(res.body).toMatchObject({
      dang_ky_hoc_id: id.dk1,
      lich_hoc_id: id.trong,
      trang_thai: 'vang_co_phep',
      nguon: 'thu_cong',
      ghi_chu: 'Ốm',
      tu_diem_danh_luc: null,
      nguoi_sua: 'SDD hoTroGv',
    });
    const dd = await o(id.trong);
    expect(dd).toMatchObject({
      trang_thai: 'vang_co_phep',
      nguon: 'thu_cong',
      nguoi_sua: id.hoTroGv,
      ghi_chu: 'Ốm',
    });
  });

  it('sửa dòng tự điểm danh Zoom: đổi trạng thái/nguồn, GIỮ tu_diem_danh_luc', async () => {
    const luc = tg(-2 * NGAY + 5 * 60 * 1000);
    await prisma.diem_danh.create({
      data: {
        dang_ky_hoc_id: id.dk1,
        lich_hoc_id: id.haiNgay,
        trang_thai: 'co_mat',
        nguon: 'zoom',
        tu_diem_danh_luc: luc,
      },
    });
    const truocKhi = (await o(id.haiNgay))!.cap_nhat_luc;
    await sua(id.lopA, {
      dang_ky_hoc_id: id.dk1,
      lich_hoc_id: id.haiNgay,
      trang_thai: 'vang',
    }).expect(200);
    const dd = (await o(id.haiNgay))!;
    expect(dd).toMatchObject({
      trang_thai: 'vang',
      nguon: 'thu_cong',
      nguoi_sua: id.hoTroGv,
      ghi_chu: null,
    });
    expect(dd.tu_diem_danh_luc?.toISOString()).toBe(luc.toISOString());
    expect(dd.cap_nhat_luc.getTime()).toBeGreaterThanOrEqual(
      truocKhi.getTime(),
    );
  });

  it('hỗ trợ GV: quá 3 ngày -> 403; Quản trị cùng buổi -> 200', async () => {
    const body = {
      dang_ky_hoc_id: id.dk1,
      lich_hoc_id: id.quaHan,
      trang_thai: 'co_mat',
    };
    const res = await sua(id.lopA, body).expect(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
    expect(await o(id.quaHan)).toBeNull();
    await sua(id.lopA, body, token.quanTri).expect(200);
    expect((await o(id.quaHan))!.nguoi_sua).toBe(id.quanTri);
  });

  it('hỗ trợ GV: buổi chưa diễn ra -> 400; Quản trị -> 200 (mọi lúc)', async () => {
    const body = {
      dang_ky_hoc_id: id.dk1,
      lich_hoc_id: id.tuongLai,
      trang_thai: 'vang_co_phep',
    };
    const res = await sua(id.lopA, body).expect(400);
    expect(res.body.error.message).toBe('Buổi học chưa diễn ra');
    expect(await o(id.tuongLai)).toBeNull();
    await sua(id.lopA, body, token.quanTri).expect(200);
  });

  it('hỗ trợ GV ngoài khóa -> 403 (PUT), 404 (GET)', async () => {
    await sua(
      id.lopB,
      { dang_ky_hoc_id: id.dkB, lich_hoc_id: id.buoiB, trang_thai: 'vang' },
      token.hoTroGv,
    ).expect(403);
    await sua(
      id.lopA,
      { dang_ky_hoc_id: id.dk1, lich_hoc_id: id.trong, trang_thai: 'vang' },
      token.hoTroGvKhac,
    ).expect(403);
    expect(await o(id.buoiB, id.dkB)).toBeNull();
    await http()
      .get(`/lop/${id.lopB}/diem-danh`)
      .set('Authorization', `Bearer ${token.hoTroGv}`)
      .expect(404);
  });

  it('giảng viên, hỗ trợ HV -> 403 cả GET và PUT', async () => {
    for (const tk of [token.giangVien, token.hoTroHv]) {
      await sua(
        id.lopA,
        { dang_ky_hoc_id: id.dk1, lich_hoc_id: id.trong, trang_thai: 'co_mat' },
        tk,
      ).expect(403);
      await http()
        .get(`/lop/${id.lopA}/diem-danh`)
        .set('Authorization', `Bearer ${tk}`)
        .expect(403);
    }
    expect((await o(id.trong))!.trang_thai).toBe('vang_co_phep');
  });

  it('học viên không thuộc lớp của buổi -> 400; buổi của lớp khác -> 404; dữ liệu sai -> 400', async () => {
    const res = await sua(id.lopA, {
      dang_ky_hoc_id: id.dk2,
      lich_hoc_id: id.trong,
      trang_thai: 'co_mat',
    }).expect(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(await o(id.trong, id.dk2)).toBeNull();
    await sua(id.lopA, {
      dang_ky_hoc_id: id.dk2,
      lich_hoc_id: id.buoiC,
      trang_thai: 'co_mat',
    }).expect(404);
    await sua(id.lopA, {
      dang_ky_hoc_id: id.dk1,
      lich_hoc_id: id.trong,
      trang_thai: 'co_mat_nua',
    }).expect(400);
    await sua(id.lopA, {
      dang_ky_hoc_id: id.dk1,
      lich_hoc_id: id.trong,
      trang_thai: 'vang',
      ghi_chu: 'x'.repeat(501),
    }).expect(400);
  });

  it('GET bảng: cờ sua_duoc theo vai trò + ô có nguồn/tự điểm danh/người sửa', async () => {
    const res = await http()
      .get(`/lop/${id.lopA}/diem-danh`)
      .set('Authorization', `Bearer ${token.hoTroGv}`)
      .expect(200);
    expect(res.body.lop).toMatchObject({ id: id.lopA, loai_lop: 'zoom' });
    expect(res.body.giai_doan_id).toBe(id.gdA);
    expect(res.body.giai_doan).toEqual([
      expect.objectContaining({ id: id.gdA, thu_tu: 1 }),
    ]);
    const buoi = Object.fromEntries(
      res.body.buoi.map((b: { id: string }) => [b.id, b]),
    );
    expect(buoi[id.trong]).toMatchObject({ sua_duoc: true, ly_do: null });
    expect(buoi[id.quaHan]).toMatchObject({
      sua_duoc: false,
      ly_do: 'qua_han',
    });
    expect(buoi[id.tuongLai]).toMatchObject({
      sua_duoc: false,
      ly_do: 'chua_dien_ra',
    });
    expect(
      res.body.hoc_vien.map(
        (h: { dang_ky_hoc_id: string }) => h.dang_ky_hoc_id,
      ),
    ).toEqual([id.dk1]);
    const hv = res.body.hoc_vien[0];
    expect(hv.diem_danh[id.haiNgay]).toMatchObject({
      trang_thai: 'vang',
      nguon: 'thu_cong',
      nguoi_sua: 'SDD hoTroGv',
      tu_diem_danh_luc: expect.any(String),
    });

    const qt = await http()
      .get(`/lop/${id.lopA}/diem-danh?giai_doan_id=${id.gdA}`)
      .set('Authorization', `Bearer ${token.quanTri}`)
      .expect(200);
    expect(qt.body.buoi.every((b: { sua_duoc: boolean }) => b.sua_duoc)).toBe(
      true,
    );
    await http()
      .get(
        `/lop/${id.lopA}/diem-danh?giai_doan_id=00000000-0000-4000-8000-000000000000`,
      )
      .set('Authorization', `Bearer ${token.quanTri}`)
      .expect(404);
  });

  it('import Excel ghi đè dòng đã sửa/tự điểm danh: đổi trạng thái/nguồn, giữ tu_diem_danh_luc, xóa nguoi_sua', async () => {
    const luc = (await o(id.haiNgay))!.tu_diem_danh_luc!.toISOString();
    const tai = await http()
      .post('/import/diem_danh')
      .set('Authorization', `Bearer ${token.quanTri}`)
      .attach(
        'file',
        await buildXlsx([
          [
            'so_dinh_danh_ca_nhan',
            'ma_dinh_danh_moet',
            'ma_khoa',
            'ten_lop',
            'loai_lop',
            'giai_doan_thu_tu',
            'buoi_so',
            'trang_thai',
            'nguon',
            'ghi_chu',
          ],
          [
            '',
            moetHv1,
            maKhoaA,
            'Zoom A',
            'zoom',
            '1',
            '2',
            'co_mat',
            'zoom',
            '',
          ],
        ]),
        'diem-danh.xlsx',
      )
      .expect(201);
    importIds.push(tai.body.import_id);
    await http()
      .post(`/import/${tai.body.import_id}/xac-nhan`)
      .set('Authorization', `Bearer ${token.quanTri}`)
      .expect(201);
    const dd = (await o(id.haiNgay))!;
    expect(dd).toMatchObject({
      trang_thai: 'co_mat',
      nguon: 'zoom',
      nguoi_sua: null,
      nguon_import_id: tai.body.import_id,
    });
    expect(dd.tu_diem_danh_luc?.toISOString()).toBe(luc);
  });
});
