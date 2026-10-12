import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { createTestApp } from './utils/test-app';
import {
  prisma,
  taoNguoiDungTest,
  uniqueSuffix,
  xoaNguoiDungTest,
} from './utils/test-data';

// Issue #30 (PRD #29): Quản trị xóa cứng 1 học viên — "xóa là văng hết".
// DELETE /hoc-vien/{id} body { ly_do, xac_nhan }.
describe('Xóa cứng học viên (e2e)', () => {
  let app: INestApplication;
  const suf = uniqueSuffix();
  const SUF = suf.toUpperCase();
  const MIEN = `${suf}@xoahv.vn`;
  const MK = 'MatKhau12345';
  const ROLLBACK_LY_DO = `__ROLLBACK_TEST_${suf}__`;

  const diaDanhIds: string[] = [];
  const donViIds: string[] = [];
  const nguoiDungIds: string[] = [];
  const hocVienIds: string[] = [];
  const khoaIds: string[] = [];
  const dotIds: string[] = [];

  let donViId: string;
  let tenDonVi: string;
  let khoaId: string;
  let khoaXongId: string;
  let giaiDoanId: string;
  let lopId: string;
  let lop2Id: string;
  let lichHocId: string;
  let quanTriId: string;
  const tok: Record<string, string> = {};

  const http = () => request(app.getHttpServer());
  const bearer = (t: string) => ({ Authorization: `Bearer ${t}` });
  const xoa = (id: string, body: Record<string, unknown>, t = tok.quanTri) =>
    http().delete(`/hoc-vien/${id}`).set(bearer(t)).send(body);
  const dangNhap = async (ten: string, mk: string) => {
    const res = await http()
      .post('/auth/dang-nhap')
      .send({ ten_dang_nhap: ten, mat_khau: mk })
      .expect(200);
    return res.body.token as string;
  };

  // 12 chữ số ngẫu nhiên — mã MOET/CCCD không đụng dữ liệu thật.
  const soNgauNhien = () =>
    `9${Date.now().toString().slice(-5)}${Math.floor(100000 + Math.random() * 899999)}`;

  async function taoHocVien(opts: { coMa?: boolean; ho_ten?: string } = {}) {
    const coMa = opts.coMa ?? true;
    const ma = coMa ? soNgauNhien() : null;
    const h = await prisma.hoc_vien.create({
      data: {
        nguon_tao: 'import_moet',
        ma_dinh_danh_moet: ma,
        so_dinh_danh_ca_nhan: coMa ? null : soNgauNhien(),
        ho_ten: opts.ho_ten ?? `Học viên xóa ${suf}`,
        ngay_sinh: 2,
        thang_sinh: 3,
        nam_sinh: 1988,
        don_vi_cong_tac_id: donViId,
        email_lien_he: `hv-${randomUUID().slice(0, 6)}-${MIEN}`,
        so_dien_thoai_lien_he: '0912345678',
      },
    });
    hocVienIds.push(h.id);
    const nd = await prisma.nguoi_dung.create({
      data: {
        ho_ten: h.ho_ten,
        ten_dang_nhap: `xhv-${randomUUID().slice(0, 12)}`,
        vai_tro: 'hoc_vien',
        hoc_vien_id: h.id,
        mat_khau_hash: await bcrypt.hash(MK, 4),
        phai_doi_mat_khau: false,
      },
    });
    nguoiDungIds.push(nd.id);
    return {
      id: h.id,
      ndId: nd.id,
      ma,
      ho_ten: h.ho_ten,
      ten: nd.ten_dang_nhap,
    };
  }

  // Đếm mọi dòng còn tham chiếu tới hoc_vien/nguoi_dung/dang_ky_hoc cũ.
  async function demThamChieu(hvId: string, ndId: string, dkIds: string[]) {
    const hv = { hoc_vien_id: hvId };
    const dk = { dang_ky_hoc_id: { in: dkIds } };
    const nd = { nguoi_dung_id: ndId };
    const dem = {
      hoc_vien: await prisma.hoc_vien.count({ where: { id: hvId } }),
      nguoi_dung: await prisma.nguoi_dung.count({ where: { id: ndId } }),
      dang_ky_hoc: await prisma.dang_ky_hoc.count({ where: hv }),
      phan_lop_giai_doan: await prisma.phan_lop_giai_doan.count({ where: dk }),
      diem_danh: await prisma.diem_danh.count({ where: dk }),
      ket_qua_giai_doan: await prisma.ket_qua_giai_doan.count({ where: dk }),
      bao_vang: await prisma.bao_vang.count({ where: dk }),
      de_nghi_doi_lop: await prisma.de_nghi_doi_lop.count({ where: dk }),
      xac_nhan_ho_so: await prisma.xac_nhan_ho_so.count({ where: hv }),
      lich_su_hv: await prisma.lich_su_thay_doi_ho_so.count({ where: hv }),
      lich_su_nguoi_sua: await prisma.lich_su_thay_doi_ho_so.count({
        where: { nguoi_sua_id: ndId },
      }),
      tai_khoan_vle: await prisma.tai_khoan_vle.count({ where: hv }),
      nhat_ky_thong_bao: await prisma.nhat_ky_thong_bao.count({ where: hv }),
      hang_doi_email: await prisma.hang_doi_email.count({ where: hv }),
      yeu_cau_ho_tro: await prisma.yeu_cau_ho_tro.count({ where: hv }),
      yeu_cau_tra_loi_boi: await prisma.yeu_cau_ho_tro.count({
        where: { OR: [{ tra_loi_boi: ndId }, { sua_tra_loi_boi: ndId }] },
      }),
      hoc_vien_chuyen_mon: await prisma.hoc_vien_chuyen_mon.count({
        where: hv,
      }),
      token_xac_thuc: await prisma.token_xac_thuc.count({
        where: { OR: [hv, nd] },
      }),
      ma_sso_mot_lan: await prisma.ma_sso_mot_lan.count({ where: hv }),
      ket_qua_khao_sat: await prisma.ket_qua_khao_sat.count({ where: hv }),
      token_thu_hoi: await prisma.token_thu_hoi.count({ where: nd }),
      nhat_ky_dlmk: await prisma.nhat_ky_dat_lai_mat_khau.count({
        where: { OR: [nd, { thuc_hien_boi: ndId }] },
      }),
      hoc_vien_created_by: await prisma.hoc_vien.count({
        where: { OR: [{ created_by: ndId }, { nguoi_duyet_id: ndId }] },
      }),
      diem_danh_nguoi_sua: await prisma.diem_danh.count({
        where: { nguoi_sua: ndId },
      }),
    };
    return dem;
  }

  async function dangKy(hvId: string, khoa = khoaId) {
    return prisma.dang_ky_hoc.create({
      data: { hoc_vien_id: hvId, khoa_id: khoa, trang_thai: 'da_duyet' },
    });
  }

  beforeAll(async () => {
    app = await createTestApp({ raiseThrottlerLimit: true });
    const tinh = await prisma.dia_danh.create({
      data: { ma: `T-xhv-${suf}`, ten: `Tỉnh ${suf}`, cap: 'tinh_thanh' },
    });
    const xa = await prisma.dia_danh.create({
      data: {
        ma: `X-xhv-${suf}`,
        ten: `Xã ${suf}`,
        cap: 'phuong_xa_dac_khu',
        parent_id: tinh.id,
      },
    });
    diaDanhIds.push(xa.id, tinh.id);
    tenDonVi = `Trường xóa HV ${suf}`;
    const dv = await prisma.don_vi_cong_tac.create({
      data: {
        ma_don_vi: `DV-xhv-${suf}`,
        ten_don_vi: tenDonVi,
        loai_don_vi: 'truong',
        dia_ban_id: xa.id,
      },
    });
    donViIds.push(dv.id);
    donViId = dv.id;

    for (const vai_tro of [
      'quan_tri',
      'truong',
      'phong_vhxh',
      'so_gddt',
    ] as const) {
      // 1 tài khoản đơn vị / đơn vị (uq_nguoi_dung_don_vi_quan_ly) -> mỗi vai trò 1 đơn vị.
      const dvTk = await prisma.don_vi_cong_tac.create({
        data: {
          ma_don_vi: `DV-xhv-${vai_tro}-${suf}`,
          ten_don_vi: `Đơn vị ${vai_tro} ${suf}`,
          loai_don_vi: 'truong',
          dia_ban_id: xa.id,
        },
      });
      donViIds.push(dvTk.id);
      const u = await taoNguoiDungTest({
        vai_tro,
        don_vi_id: dvTk.id,
        mat_khau: MK,
      });
      nguoiDungIds.push(u.nguoiDung.id);
      tok[vai_tro === 'quan_tri' ? 'quanTri' : vai_tro] = await dangNhap(
        u.ten_dang_nhap,
        MK,
      );
      if (vai_tro === 'quan_tri') quanTriId = u.nguoiDung.id;
    }

    const khoa = await prisma.khoa_boi_duong.create({
      data: {
        ma_khoa: `K-XHV-${SUF}`,
        ten_khoa: `Khóa xóa HV ${suf}`,
        don_vi_dat_hang_id: dv.id,
        thoi_gian_bat_dau: new Date('2026-10-01'),
        thoi_gian_ket_thuc: new Date('2027-02-01'),
        trang_thai: 'da_duyet',
      },
    });
    const khoaXong = await prisma.khoa_boi_duong.create({
      data: {
        ma_khoa: `K-XHV2-${SUF}`,
        ten_khoa: `Khóa đã kết thúc ${suf}`,
        don_vi_dat_hang_id: dv.id,
        thoi_gian_bat_dau: new Date('2025-01-01'),
        thoi_gian_ket_thuc: new Date('2025-03-01'),
        trang_thai: 'dong_dang_ky',
      },
    });
    khoaIds.push(khoa.id, khoaXong.id);
    khoaId = khoa.id;
    khoaXongId = khoaXong.id;
    const gd = await prisma.giai_doan_khoa.create({
      data: {
        khoa_id: khoa.id,
        thu_tu: 1,
        ten_giai_doan: 'Zoom – nhóm 1',
        hinh_thuc: 'truc_tuyen',
        thoi_gian_bat_dau: new Date('2026-10-01'),
        thoi_gian_ket_thuc: new Date('2026-12-01'),
      },
    });
    giaiDoanId = gd.id;
    const lop = await prisma.lop_hoc.create({
      data: { khoa_id: khoa.id, loai_lop: 'zoom', ten_lop: 'Lớp 1' },
    });
    const lop2 = await prisma.lop_hoc.create({
      data: { khoa_id: khoa.id, loai_lop: 'zoom', ten_lop: 'Lớp 2' },
    });
    lopId = lop.id;
    lop2Id = lop2.id;
    const lich = await prisma.lich_hoc_lop.create({
      data: {
        lop_id: lop.id,
        giai_doan_id: gd.id,
        buoi_so: 1,
        thoi_gian_bat_dau: new Date('2026-10-05T01:00:00Z'),
        thoi_gian_ket_thuc: new Date('2026-10-05T03:00:00Z'),
      },
    });
    lichHocId = lich.id;
  });

  afterAll(async () => {
    try {
      await prisma.$executeRawUnsafe(
        'DROP TRIGGER IF EXISTS trg_test_xoa_hv_rollback ON nhat_ky_xoa_hoc_vien',
      );
      await prisma.$executeRawUnsafe(
        'DROP FUNCTION IF EXISTS fn_test_xoa_hv_rollback()',
      );
      // Học viên còn sót (test lỗi giữa chừng / học viên phụ) -> xóa qua chính API.
      const conLai = await prisma.hoc_vien.findMany({
        where: {
          OR: [{ id: { in: hocVienIds } }, { don_vi_cong_tac_id: donViId }],
        },
        select: { id: true, ma_dinh_danh_moet: true, ho_ten: true },
      });
      for (const h of conLai) {
        await xoa(h.id, {
          ly_do: 'Dọn dữ liệu test',
          xac_nhan: h.ma_dinh_danh_moet ?? h.ho_ten,
        });
      }
      await prisma.nhat_ky_xoa_hoc_vien.deleteMany({
        where: { nguoi_xoa_id: quanTriId },
      });
      await prisma.dot_xac_nhan.deleteMany({ where: { id: { in: dotIds } } });
      await prisma.khoa_boi_duong.deleteMany({
        where: { id: { in: khoaIds } },
      });
      // nhat_ky_hoat_dong: bảng chỉ thêm (trigger chặn DELETE) — không dọn được, không FK.
      for (const id of nguoiDungIds) await xoaNguoiDungTest(id);
      await prisma.don_vi_cong_tac.deleteMany({
        where: { id: { in: donViIds } },
      });
      await prisma.dia_danh.deleteMany({ where: { id: { in: diaDanhIds } } });
    } finally {
      await prisma.$disconnect();
      await app.close();
    }
  });

  it('học viên có dữ liệu ở MỌI bảng liên quan -> 200, không còn dòng nào tham chiếu, đúng 1 nhật ký xóa', async () => {
    const hv = await taoHocVien();
    const tokenHv = await dangNhap(hv.ten, MK); // ghi nhat_ky_hoat_dong 'dang_nhap'
    const dk = await dangKy(hv.id);
    await prisma.dang_ky_hoc.update({
      where: { id: dk.id },
      data: { cum_id: null, muc_dau_vao: 'co_ban' },
    });
    // Con của dang_ky_hoc
    await prisma.phan_lop_giai_doan.create({
      data: { dang_ky_hoc_id: dk.id, giai_doan_id: giaiDoanId, lop_id: lopId },
    });
    await prisma.diem_danh.create({
      data: {
        dang_ky_hoc_id: dk.id,
        lich_hoc_id: lichHocId,
        trang_thai: 'co_mat',
        nguon: 'zoom',
      },
    });
    await prisma.ket_qua_giai_doan.create({
      data: { dang_ky_hoc_id: dk.id, giai_doan_id: giaiDoanId, diem: 8 },
    });
    await prisma.bao_vang.create({
      data: {
        dang_ky_hoc_id: dk.id,
        lich_hoc_id: lichHocId,
        ly_do: 'Ốm',
        nguoi_ghi: hv.ndId,
      },
    });
    await prisma.de_nghi_doi_lop.create({
      data: {
        dang_ky_hoc_id: dk.id,
        giai_doan_id: giaiDoanId,
        lop_hien_tai_id: lopId,
        lop_de_nghi_id: lop2Id,
        ly_do: 'Trùng lịch',
        nguoi_tao: hv.ndId,
      },
    });
    // Bảng trỏ thẳng hoc_vien
    const dot = await prisma.dot_xac_nhan.create({
      data: {
        ten: `Đợt đã đóng ${suf}`,
        loai: 'kiem_tra_bo_sung',
        khoa_id: khoaId,
        mo_luc: new Date('2025-01-01'),
        dong_luc: new Date('2025-01-02'),
        created_by: hv.ndId,
      },
    });
    dotIds.push(dot.id);
    await prisma.xac_nhan_ho_so.create({
      data: { dot_id: dot.id, hoc_vien_id: hv.id, du_lieu: { a: 1 } },
    });
    await prisma.lich_su_thay_doi_ho_so.create({
      data: {
        hoc_vien_id: hv.id,
        truong: 'chuc_vu',
        gia_tri_moi: 'GV',
        nguoi_sua_id: hv.ndId,
        vai_tro_nguoi_sua: 'hoc_vien',
      },
    });
    await prisma.tai_khoan_vle.create({
      data: {
        hoc_vien_id: hv.id,
        ten_dang_nhap_vle: `vle-${suf}`,
        duong_dan: 'https://vle.test',
      },
    });
    await prisma.nhat_ky_thong_bao.create({
      data: {
        loai_su_kien: 'hoc_vien_xac_nhan',
        hoc_vien_id: hv.id,
        email_nguoi_nhan: `tb-${MIEN}`,
        tieu_de: 'x',
        trang_thai: 'thanh_cong',
      },
    });
    await prisma.hang_doi_email.create({
      data: {
        loai_su_kien: 'hoc_vien_xac_nhan',
        hoc_vien_id: hv.id,
        email_nguoi_nhan: `hd-${MIEN}`,
        tieu_de: 'x',
        noi_dung_html: '<p>x</p>',
        trang_thai: 'that_bai',
      },
    });
    await prisma.yeu_cau_ho_tro.create({
      data: { hoc_vien_id: hv.id, noi_dung_hoi: 'Hỏi gì đó' },
    });
    await prisma.hoc_vien_chuyen_mon.create({
      data: { hoc_vien_id: hv.id, chuyen_mon: 'Toán' },
    });
    await prisma.token_xac_thuc.create({
      data: {
        hoc_vien_id: hv.id,
        loai: 'xac_minh_email',
        token_hash: randomUUID().replace(/-/g, '').padEnd(64, 'a'),
        het_han_luc: new Date(Date.now() + 3600_000),
      },
    });
    await prisma.token_xac_thuc.create({
      data: {
        nguoi_dung_id: hv.ndId,
        loai: 'dat_lai_mat_khau',
        token_hash: randomUUID().replace(/-/g, '').padEnd(64, 'b'),
        het_han_luc: new Date(Date.now() + 3600_000),
      },
    });
    await prisma.ma_sso_mot_lan.create({
      data: {
        hoc_vien_id: hv.id,
        ma_hash: randomUUID().replace(/-/g, '').padEnd(64, 'c'),
        het_han: new Date(Date.now() + 300_000),
      },
    });
    await prisma.ket_qua_khao_sat.create({
      data: {
        hoc_vien_id: hv.id,
        loai: 'danh-gia',
        trang_thai: 'hoan_thanh',
        nguon: 'import',
      },
    });
    await prisma.nhat_ky_hoat_dong.create({
      data: { hanh_dong: 'test_xoa', hoc_vien_id: hv.id },
    });
    // Con NoAction của tài khoản
    await prisma.token_thu_hoi.create({
      data: {
        jti: randomUUID(),
        nguoi_dung_id: hv.ndId,
        het_han: new Date(Date.now() + 3600_000),
      },
    });
    await prisma.nhat_ky_dat_lai_mat_khau.create({
      data: { nguoi_dung_id: hv.ndId, thuc_hien_boi: quanTriId },
    });
    // Tài khoản học viên là "người thực hiện" trong dữ liệu của người khác.
    const khac = await taoHocVien({ ho_ten: `Học viên khác ${suf}` });
    await prisma.hoc_vien.update({
      where: { id: khac.id },
      data: { created_by: hv.ndId, nguoi_duyet_id: hv.ndId },
    });
    const ycKhac = await prisma.yeu_cau_ho_tro.create({
      data: {
        hoc_vien_id: khac.id,
        noi_dung_hoi: 'Hỏi',
        tra_loi_boi: hv.ndId,
        sua_tra_loi_boi: hv.ndId,
      },
    });
    const dkKhac = await dangKy(khac.id);
    const ddKhac = await prisma.diem_danh.create({
      data: {
        dang_ky_hoc_id: dkKhac.id,
        lich_hoc_id: lichHocId,
        trang_thai: 'vang',
        nguon: 'thu_cong',
        nguoi_sua: hv.ndId,
      },
    });

    const truoc = await demThamChieu(hv.id, hv.ndId, [dk.id]);
    for (const [bang, so] of Object.entries(truoc)) {
      expect({ bang, coDuLieu: so > 0 }).toEqual({ bang, coDuLieu: true });
    }
    const pheuTruoc = await http()
      .get(`/thong-ke/pheu?khoa_id=${khoaId}`)
      .set(bearer(tok.quanTri))
      .expect(200);

    const res = await xoa(hv.id, {
      ly_do: '  Hồ sơ trùng  ',
      xac_nhan: ` ${hv.ma} `,
    });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: hv.id, so_dang_ky_da_xoa: 1 });

    const sau = await demThamChieu(hv.id, hv.ndId, [dk.id]);
    for (const [bang, so] of Object.entries(sau)) {
      expect({ bang, so }).toEqual({ bang, so: 0 });
    }

    // nhat_ky_hoat_dong là bảng chỉ thêm (trigger DB chặn DELETE), không FK —
    // giữ nguyên theo thiết kế, không chặn việc xóa.
    expect(
      await prisma.nhat_ky_hoat_dong.count({ where: { hoc_vien_id: hv.id } }),
    ).toBeGreaterThan(0);

    const nhatKy = await prisma.nhat_ky_xoa_hoc_vien.findMany({
      where: { hoc_vien_id_cu: hv.id },
    });
    expect(nhatKy).toHaveLength(1);
    expect(nhatKy[0]).toMatchObject({
      ho_ten: hv.ho_ten,
      ma_dinh_danh_moet: hv.ma,
      don_vi_cong_tac_id: donViId,
      ten_don_vi: tenDonVi,
      so_dang_ky_da_xoa: 1,
      ten_dang_nhap_vle: `vle-${suf}`,
      ly_do: 'Hồ sơ trùng',
      nguoi_xoa_id: quanTriId,
    });

    // Dữ liệu của người khác vẫn còn, chỉ gỡ tham chiếu người thực hiện.
    const khacSau = await prisma.hoc_vien.findUnique({
      where: { id: khac.id },
    });
    expect(khacSau).toMatchObject({ created_by: null, nguoi_duyet_id: null });
    expect(
      await prisma.yeu_cau_ho_tro.findUnique({ where: { id: ycKhac.id } }),
    ).toMatchObject({ tra_loi_boi: null, sua_tra_loi_boi: null });
    expect(
      await prisma.diem_danh.findUnique({ where: { id: ddKhac.id } }),
    ).toMatchObject({ nguoi_sua: null });
    expect(
      await prisma.dot_xac_nhan.findUnique({ where: { id: dot.id } }),
    ).toMatchObject({ created_by: null });

    // Thống kê không còn đếm học viên đã xóa.
    const pheuSau = await http()
      .get(`/thong-ke/pheu?khoa_id=${khoaId}`)
      .set(bearer(tok.quanTri))
      .expect(200);
    expect(pheuSau.body.tham_gia).toBe(pheuTruoc.body.tham_gia - 1);

    // JWT cũ của học viên -> 401.
    await http().get('/hoc-vien/toi').set(bearer(tokenHv)).expect(401);

    // Xóa lần 2 -> 404.
    expect((await xoa(hv.id, { ly_do: 'Lần 2', xac_nhan: hv.ma })).status).toBe(
      404,
    );

    // Tạo lại học viên cùng mã MOET -> thành công.
    const taoLai = await http()
      .post('/hoc-vien/tao-le')
      .set(bearer(tok.quanTri))
      .send({
        ma_dinh_danh_moet: hv.ma,
        ho_ten: 'Nguyễn Văn Tạo Lại',
        ngay_sinh: 2,
        thang_sinh: 3,
        nam_sinh: 1988,
        don_vi_cong_tac_id: donViId,
      });
    expect({ status: taoLai.status, body: taoLai.body }).toMatchObject({
      status: 201,
    });
    hocVienIds.push(taoLai.body.hoc_vien_id);
  });

  it('học viên "sạch" (không dữ liệu phụ, không tài khoản) -> 200, xác nhận bằng họ tên không phân biệt hoa/thường', async () => {
    const h = await prisma.hoc_vien.create({
      data: {
        nguon_tao: 'import_moet',
        so_dinh_danh_ca_nhan: soNgauNhien(),
        ho_ten: `Trần Thị Sạch ${suf}`,
        ngay_sinh: 1,
        thang_sinh: 1,
        nam_sinh: 1990,
        don_vi_cong_tac_id: donViId,
      },
    });
    hocVienIds.push(h.id);
    const res = await xoa(h.id, {
      ly_do: 'Nhập nhầm',
      xac_nhan: `  trần thị sạch ${suf.toUpperCase()} `,
    });
    expect(res.status).toBe(200);
    expect(await prisma.hoc_vien.count({ where: { id: h.id } })).toBe(0);
    const nk = await prisma.nhat_ky_xoa_hoc_vien.findFirstOrThrow({
      where: { hoc_vien_id_cu: h.id },
    });
    expect(nk).toMatchObject({
      ma_dinh_danh_moet: null,
      so_dang_ky_da_xoa: 0,
      ten_dang_nhap_vle: null,
    });
  });

  it('học viên ghi danh khóa đã kết thúc -> xóa được', async () => {
    const hv = await taoHocVien();
    const dk = await dangKy(hv.id, khoaXongId);
    await prisma.dang_ky_hoc.update({
      where: { id: dk.id },
      data: { ket_qua: 'dat', ngay_hoan_thanh: new Date('2025-03-01') },
    });
    const res = await xoa(hv.id, { ly_do: 'Yêu cầu', xac_nhan: hv.ma });
    expect(res.status).toBe(200);
    expect(await prisma.dang_ky_hoc.count({ where: { id: dk.id } })).toBe(0);
    expect(await prisma.nguoi_dung.count({ where: { id: hv.ndId } })).toBe(0);
  });

  describe('phân quyền & kiểm tra đầu vào', () => {
    let hv: Awaited<ReturnType<typeof taoHocVien>>;
    beforeAll(async () => {
      hv = await taoHocVien();
    });

    it.each(['truong', 'phong_vhxh', 'so_gddt'])('%s -> 403', async (vt) => {
      const res = await xoa(hv.id, { ly_do: 'x', xac_nhan: hv.ma }, tok[vt]);
      expect(res.status).toBe(403);
    });

    it('hoc_vien -> 403', async () => {
      const t = await dangNhap(hv.ten, MK);
      const res = await xoa(hv.id, { ly_do: 'x', xac_nhan: hv.ma }, t);
      expect(res.status).toBe(403);
    });

    it('thiếu lý do / lý do toàn khoảng trắng -> 400', async () => {
      expect((await xoa(hv.id, { xac_nhan: hv.ma })).status).toBe(400);
      expect((await xoa(hv.id, { ly_do: '   ', xac_nhan: hv.ma })).status).toBe(
        400,
      );
    });

    it('lý do quá 1000 ký tự -> 400', async () => {
      const res = await xoa(hv.id, {
        ly_do: 'a'.repeat(1001),
        xac_nhan: hv.ma,
      });
      expect(res.status).toBe(400);
    });

    it('xác nhận sai (hoặc gõ họ tên khi hồ sơ có mã MOET) -> 400', async () => {
      const sai = await xoa(hv.id, { ly_do: 'x', xac_nhan: '000' });
      expect(sai.status).toBe(400);
      expect(sai.body.error.message).toContain('mã định danh MOET');
      expect(
        (await xoa(hv.id, { ly_do: 'x', xac_nhan: hv.ho_ten })).status,
      ).toBe(400);
      expect((await xoa(hv.id, { ly_do: 'x' })).status).toBe(400);
      expect(await prisma.hoc_vien.count({ where: { id: hv.id } })).toBe(1);
    });

    it('id không tồn tại -> 404', async () => {
      const res = await xoa(randomUUID(), { ly_do: 'x', xac_nhan: 'x' });
      expect(res.status).toBe(404);
    });
  });

  it('lỗi giữa transaction -> rollback, không xóa gì', async () => {
    const hv = await taoHocVien();
    const dk = await dangKy(hv.id);
    await prisma.diem_danh.create({
      data: {
        dang_ky_hoc_id: dk.id,
        lich_hoc_id: lichHocId,
        trang_thai: 'co_mat',
        nguon: 'zoom',
      },
    });
    // Trigger chỉ ném lỗi với lý do đặc biệt — bước cuối (ghi nhật ký) thất bại
    // sau khi mọi lệnh xóa đã chạy trong transaction.
    await prisma.$executeRawUnsafe(`
      CREATE OR REPLACE FUNCTION fn_test_xoa_hv_rollback() RETURNS trigger AS $$
      BEGIN
        IF NEW.ly_do = '${ROLLBACK_LY_DO}' THEN
          RAISE EXCEPTION 'buoc rollback test';
        END IF;
        RETURN NEW;
      END $$ LANGUAGE plpgsql`);
    await prisma.$executeRawUnsafe(`
      CREATE TRIGGER trg_test_xoa_hv_rollback BEFORE INSERT ON nhat_ky_xoa_hoc_vien
      FOR EACH ROW EXECUTE FUNCTION fn_test_xoa_hv_rollback()`);
    try {
      const res = await xoa(hv.id, { ly_do: ROLLBACK_LY_DO, xac_nhan: hv.ma });
      expect(res.status).toBe(500);
    } finally {
      await prisma.$executeRawUnsafe(
        'DROP TRIGGER IF EXISTS trg_test_xoa_hv_rollback ON nhat_ky_xoa_hoc_vien',
      );
      await prisma.$executeRawUnsafe(
        'DROP FUNCTION IF EXISTS fn_test_xoa_hv_rollback()',
      );
    }
    expect(await prisma.hoc_vien.count({ where: { id: hv.id } })).toBe(1);
    expect(await prisma.nguoi_dung.count({ where: { id: hv.ndId } })).toBe(1);
    expect(await prisma.dang_ky_hoc.count({ where: { id: dk.id } })).toBe(1);
    expect(
      await prisma.diem_danh.count({ where: { dang_ky_hoc_id: dk.id } }),
    ).toBe(1);
    expect(
      await prisma.nhat_ky_xoa_hoc_vien.count({
        where: { hoc_vien_id_cu: hv.id },
      }),
    ).toBe(0);
  });
});
