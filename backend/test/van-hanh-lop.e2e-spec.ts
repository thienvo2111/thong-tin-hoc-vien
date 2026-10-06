import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import * as bcrypt from 'bcryptjs';
import { createTestApp } from './utils/test-app';
import {
  prisma,
  taoDonViTest,
  uniqueSuffix,
  xoaNguoiDungTest,
  xoaDonViTest,
} from './utils/test-data';

const GIO = 3600 * 1000;
const NGAY = 24 * GIO;

// ADR 0004 L3 (issue #16): vận hành lớp của người hỗ trợ giảng viên — sửa buổi
// có lý do, phân công GV, danh mục, hậu cần (khóa lạc quan), thực địa.
describe('Vận hành lớp — L3 (e2e)', () => {
  let app: INestApplication;
  const suf = uniqueSuffix();
  let dv: Awaited<ReturnType<typeof taoDonViTest>>;
  const nguoiDungIds: string[] = [];
  const khoaIds: string[] = [];
  let token: string;
  let ndHoTro: { id: string };
  let lopId: string;
  let lopKhacId: string;
  let gdId: string;
  let dhId: string;
  const buoi: Record<string, string> = {};
  let gvA: { id: string };
  let gvB: { id: string };
  let gvKhongPhanCong: { id: string };
  const sdtGoc = String(Date.now()).slice(-7);

  const http = () => request(app.getHttpServer());
  const auth = () => ({ Authorization: `Bearer ${token}` });
  const tg = (offsetMs: number) => new Date(Date.now() + offsetMs);

  beforeAll(async () => {
    app = await createTestApp({ raiseThrottlerLimit: true });
    dv = await taoDonViTest('vhl');
    const taoKhoa = async (ma: string) => {
      const k = await prisma.khoa_boi_duong.create({
        data: {
          ma_khoa: `${ma}-${suf}`.slice(0, 30),
          ten_khoa: ma,
          don_vi_dat_hang_id: dv.donVi.id,
          thoi_gian_bat_dau: new Date('2026-01-01'),
          thoi_gian_ket_thuc: new Date('2027-12-31'),
          trang_thai: 'da_duyet',
        },
      });
      khoaIds.push(k.id);
      return k;
    };
    const khoa = await taoKhoa('K-VHL');
    const khoaKhac = await taoKhoa('K-VHLX');
    gdId = (
      await prisma.giai_doan_khoa.create({
        data: {
          khoa_id: khoa.id,
          thu_tu: 1,
          ten_giai_doan: 'Trực tiếp',
          hinh_thuc: 'truc_tiep',
          thoi_gian_bat_dau: new Date('2026-01-01'),
          thoi_gian_ket_thuc: new Date('2027-12-31'),
        },
      })
    ).id;
    const gdKhac = await prisma.giai_doan_khoa.create({
      data: {
        khoa_id: khoaKhac.id,
        thu_tu: 1,
        ten_giai_doan: 'Trực tiếp',
        hinh_thuc: 'truc_tiep',
        thoi_gian_bat_dau: new Date('2026-01-01'),
        thoi_gian_ket_thuc: new Date('2027-12-31'),
      },
    });
    lopId = (
      await prisma.lop_hoc.create({
        data: { khoa_id: khoa.id, loai_lop: 'truc_tiep', ten_lop: 'Lớp VHL' },
      })
    ).id;
    lopKhacId = (
      await prisma.lop_hoc.create({
        data: {
          khoa_id: khoaKhac.id,
          loai_lop: 'truc_tiep',
          ten_lop: 'Lớp khác',
        },
      })
    ).id;
    dhId = (
      await prisma.diem_hoc.create({
        data: {
          ma_diem_hoc: `VHL-${suf}`.slice(0, 30),
          ten: 'Điểm học VHL',
          dia_chi: 'x',
          dia_ban_id: dv.diaDanhXa.id,
        },
      })
    ).id;
    const taoBuoi = (lop: string, gd: string, so: number, bd: Date) =>
      prisma.lich_hoc_lop.create({
        data: {
          lop_id: lop,
          giai_doan_id: gd,
          buoi_so: so,
          thoi_gian_bat_dau: bd,
          thoi_gian_ket_thuc: new Date(bd.getTime() + 3 * GIO),
          diem_hoc_id: dhId,
        },
      });
    buoi.tuongLai = (await taoBuoi(lopId, gdId, 1, tg(5 * NGAY))).id;
    buoi.quaKhu = (await taoBuoi(lopId, gdId, 2, tg(-2 * NGAY))).id;
    buoi.coDiemDanh = (await taoBuoi(lopId, gdId, 3, tg(6 * NGAY))).id;
    buoi.khacKhoa = (await taoBuoi(lopKhacId, gdKhac.id, 1, tg(8 * NGAY))).id;

    gvA = await prisma.giang_vien.create({
      data: { ho_ten: 'GV A VHL', so_dien_thoai: `071${sdtGoc}` },
    });
    gvB = await prisma.giang_vien.create({
      data: { ho_ten: 'GV B VHL', so_dien_thoai: `072${sdtGoc}` },
    });
    gvKhongPhanCong = await prisma.giang_vien.create({
      data: { ho_ten: 'GV C VHL', so_dien_thoai: `073${sdtGoc}` },
    });
    await prisma.phan_cong_giang_day.create({
      data: {
        lich_hoc_id: buoi.tuongLai,
        giang_vien_id: gvA.id,
        vai_tro: 'giang_vien',
      },
    });
    // GV A còn dạy lớp khóa khác lúc +8 ngày — đổi giờ buổi sang đó sẽ trùng.
    await prisma.phan_cong_giang_day.create({
      data: {
        lich_hoc_id: buoi.khacKhoa,
        giang_vien_id: gvA.id,
        vai_tro: 'giang_vien',
      },
    });

    // Buổi có điểm danh.
    const hv = await prisma.hoc_vien.create({
      data: {
        nguon_tao: 'import_moet',
        ma_dinh_danh_moet: `MOET-VHL-${suf}`,
        ho_ten: 'HV VHL',
        ngay_sinh: 1,
        thang_sinh: 1,
        nam_sinh: 1990,
        don_vi_cong_tac_id: dv.donVi.id,
        trang_thai: 'nhap',
      },
    });
    const dk = await prisma.dang_ky_hoc.create({
      data: { hoc_vien_id: hv.id, khoa_id: khoa.id, trang_thai: 'da_duyet' },
    });
    await prisma.diem_danh.create({
      data: {
        dang_ky_hoc_id: dk.id,
        lich_hoc_id: buoi.coDiemDanh,
        trang_thai: 'co_mat',
        nguon: 'thu_cong',
      },
    });

    const nd = await prisma.nguoi_dung.create({
      data: {
        ho_ten: 'Hỗ trợ VHL',
        ten_dang_nhap: `vhl-${suf}`.toLowerCase(),
        email: `vhl-${suf}@vhl.vn`.toLowerCase(),
        vai_tro: 'ho_tro_giang_vien',
        mat_khau_hash: await bcrypt.hash('MatKhau123', 4),
        phai_doi_mat_khau: false,
      },
    });
    ndHoTro = nd;
    nguoiDungIds.push(nd.id);
    await prisma.phan_cong_ho_tro_gv.create({
      data: { nguoi_dung_id: nd.id, khoa_id: khoa.id },
    });
    token = (
      await http()
        .post('/auth/dang-nhap')
        .send({ ten_dang_nhap: nd.ten_dang_nhap, mat_khau: 'MatKhau123' })
        .expect(200)
    ).body.token;
  });

  afterAll(async () => {
    await prisma.diem_danh.deleteMany({
      where: { lich_hoc: { lop: { khoa_id: { in: khoaIds } } } },
    });
    await prisma.dang_ky_hoc.deleteMany({
      where: { khoa_id: { in: khoaIds } },
    });
    await prisma.hoc_vien.deleteMany({
      where: { ma_dinh_danh_moet: `MOET-VHL-${suf}` },
    });
    await prisma.lich_hoc_lop.deleteMany({
      where: { lop: { khoa_id: { in: khoaIds } } },
    });
    await prisma.khoa_boi_duong.deleteMany({ where: { id: { in: khoaIds } } });
    await prisma.giang_vien.deleteMany({
      where: { so_dien_thoai: { endsWith: sdtGoc } },
    });
    await prisma.diem_hoc.deleteMany({
      where: { dia_ban_id: dv.diaDanhXa.id },
    });
    await prisma.giang_vien.deleteMany({
      where: { tao_boi: { in: nguoiDungIds } },
    });
    for (const id of nguoiDungIds) await xoaNguoiDungTest(id);
    await xoaDonViTest([dv.donVi.id], [dv.diaDanhXa.id, dv.diaDanhTinh.id]);
    await prisma.$disconnect();
    await app.close();
  });

  describe('Sửa buổi (K7, K8, K9)', () => {
    it('K7: buổi chưa diễn ra + lý do → 200; cap_nhat_luc đổi; nhật ký có lý do + vai trò người hỗ trợ GV', async () => {
      const truoc = await prisma.lich_hoc_lop.findUniqueOrThrow({
        where: { id: buoi.tuongLai },
      });
      const bd = tg(5 * NGAY + 2 * GIO);
      await http()
        .patch(`/ho-tro-giang-vien/lich-hoc/${buoi.tuongLai}`)
        .set(auth())
        .send({
          thoi_gian_bat_dau: bd.toISOString(),
          thoi_gian_ket_thuc: new Date(bd.getTime() + 3 * GIO).toISOString(),
          phong: 'P.9',
          ly_do: 'Trường đổi lịch thi',
        })
        .expect(200);
      const sau = await prisma.lich_hoc_lop.findUniqueOrThrow({
        where: { id: buoi.tuongLai },
      });
      expect(sau.phong).toBe('P.9');
      expect(sau.cap_nhat_luc.getTime()).toBeGreaterThan(
        truoc.cap_nhat_luc.getTime(),
      );
      const nk = await prisma.nhat_ky_hoat_dong.findFirst({
        where: { hanh_dong: 'sua_lich_hoc', nguoi_dung_id: ndHoTro.id },
        orderBy: { thoi_gian: 'desc' },
      });
      expect(nk?.vai_tro).toBe('ho_tro_giang_vien');
      expect((nk?.chi_tiet as { ly_do: string }).ly_do).toBe(
        'Trường đổi lịch thi',
      );
    });

    it('K8: thiếu lý do / buổi đã diễn ra / buổi đã có điểm danh → 400', async () => {
      await http()
        .patch(`/ho-tro-giang-vien/lich-hoc/${buoi.tuongLai}`)
        .set(auth())
        .send({ phong: 'P.1' })
        .expect(400);
      await http()
        .patch(`/ho-tro-giang-vien/lich-hoc/${buoi.quaKhu}`)
        .set(auth())
        .send({ phong: 'P.1', ly_do: 'Sửa phòng' })
        .expect(400);
      await http()
        .patch(`/ho-tro-giang-vien/lich-hoc/${buoi.coDiemDanh}`)
        .set(auth())
        .send({ phong: 'P.1', ly_do: 'Sửa phòng' })
        .expect(400);
    });

    it('K9: đổi giờ làm giảng viên trùng giờ buổi khác → 400; buổi khóa ngoài nhóm → 404', async () => {
      const khac = await prisma.lich_hoc_lop.findUniqueOrThrow({
        where: { id: buoi.khacKhoa },
      });
      await http()
        .patch(`/ho-tro-giang-vien/lich-hoc/${buoi.tuongLai}`)
        .set(auth())
        .send({
          thoi_gian_bat_dau: khac.thoi_gian_bat_dau.toISOString(),
          thoi_gian_ket_thuc: khac.thoi_gian_ket_thuc.toISOString(),
          ly_do: 'Thử trùng giờ',
        })
        .expect(400);
      await http()
        .patch(`/ho-tro-giang-vien/lich-hoc/${buoi.khacKhoa}`)
        .set(auth())
        .send({ phong: 'P.1', ly_do: 'Không được' })
        .expect(404);
    });
  });

  describe('Phân công + quyền Quản trị (K10)', () => {
    it('phân công GV B vào buổi trong phạm vi → 200; buổi khóa ngoài → 404', async () => {
      const res = await http()
        .put(`/ho-tro-giang-vien/lich-hoc/${buoi.tuongLai}/giang-vien`)
        .set(auth())
        .send({
          phan_cong: [
            { giang_vien_id: gvA.id, vai_tro: 'giang_vien', so_gio: 3 },
            { giang_vien_id: gvB.id, vai_tro: 'ho_tro' },
          ],
        })
        .expect(200);
      expect(res.body).toHaveLength(2);
      await http()
        .put(`/ho-tro-giang-vien/lich-hoc/${buoi.khacKhoa}/giang-vien`)
        .set(auth())
        .send({ phan_cong: [] })
        .expect(404);
    });

    it('K10: thêm buổi, xác nhận giờ, sửa kết quả khóa → 403 với người hỗ trợ GV', async () => {
      await http()
        .post(`/lop/${lopId}/lich-hoc`)
        .set(auth())
        .send({
          giai_doan_id: gdId,
          thoi_gian_bat_dau: tg(9 * NGAY).toISOString(),
          thoi_gian_ket_thuc: tg(9 * NGAY + GIO).toISOString(),
          diem_hoc_id: dhId,
        })
        .expect(403);
      const pc = await prisma.phan_cong_giang_day.findFirstOrThrow({
        where: { lich_hoc_id: buoi.tuongLai },
      });
      await http()
        .patch(`/giang-vien/phan-cong/${pc.id}/xac-nhan-gio`)
        .set(auth())
        .send({ da_xac_nhan_gio: true })
        .expect(403);
      const dk = await prisma.dang_ky_hoc.findFirstOrThrow({
        where: { khoa_id: khoaIds[0] },
      });
      await http()
        .patch(`/dang-ky-hoc/${dk.id}/ket-qua`)
        .set(auth())
        .send({ ket_qua: 'dat' })
        .expect(403);
    });
  });

  describe('Hậu cần (K11) + thực địa', () => {
    const duongDan = (gv: string) =>
      `/ho-tro-giang-vien/lop/${lopId}/giai-doan/${gdId}/hau-can/${gv}`;

    it('giảng viên không có phân công trong đợt → 400', async () => {
      await http()
        .put(duongDan(gvKhongPhanCong.id))
        .set(auth())
        .send({ noi_o_ten: 'KS' })
        .expect(400);
    });

    it('K11: tạo mới → sửa với cap_nhat_luc đúng → 200; gửi cap_nhat_luc cũ → 409, không ghi đè', async () => {
      const tao = await http()
        .put(duongDan(gvA.id))
        .set(auth())
        .send({
          noi_o_ten: 'KS Hoa Sen',
          phuong_tien: 'Xe HCMUE',
          nhan_phong: '2026-11-01',
          tra_phong: '2026-11-03',
        })
        .expect(200);
      const lan1 = await http()
        .put(duongDan(gvA.id))
        .set(auth())
        .send({ cap_nhat_luc: tao.body.cap_nhat_luc, da_xac_nhan_noi_o: true })
        .expect(200);
      expect(lan1.body.da_xac_nhan_noi_o).toBe(true);
      await http()
        .put(duongDan(gvA.id))
        .set(auth())
        .send({ cap_nhat_luc: tao.body.cap_nhat_luc, noi_o_ten: 'Ghi đè' })
        .expect(409);
      const db = await prisma.hau_can_giang_vien.findFirstOrThrow({
        where: { giang_vien_id: gvA.id },
      });
      expect(db.noi_o_ten).toBe('KS Hoa Sen');
      expect(db.cap_nhat_boi).toBe(ndHoTro.id);
    });

    it('trả phòng trước nhận phòng → 400', async () => {
      await http()
        .put(duongDan(gvB.id))
        .set(auth())
        .send({ nhan_phong: '2026-11-05', tra_phong: '2026-11-01' })
        .expect(400);
    });

    it('thực địa: thay toàn bộ, SĐT chuẩn hóa; hiện trong Hồ sơ chuẩn bị lớp kèm hậu cần', async () => {
      const res = await http()
        .put(`/ho-tro-giang-vien/lop/${lopId}/giai-doan/${gdId}/thuc-dia`)
        .set(auth())
        .send({
          nhan_su: [
            {
              ho_ten: 'Anh Tâm',
              so_dien_thoai: '0933 333 333',
              nhiem_vu: 'Mở phòng',
            },
          ],
        })
        .expect(200);
      expect(res.body[0].so_dien_thoai).toBe('0933333333');
      const trang = await http()
        .get(`/ho-tro-giang-vien/lop/${lopId}/giai-doan/${gdId}`)
        .set(auth())
        .expect(200);
      expect(trang.body.thuc_dia).toEqual([
        expect.objectContaining({ ho_ten: 'Anh Tâm' }),
      ]);
      expect(trang.body.hau_can).toEqual([
        expect.objectContaining({
          giang_vien_id: gvA.id,
          nguoi_sua: 'Hỗ trợ VHL',
        }),
      ]);
    });

    it('thực địa SĐT sai → 400', async () => {
      await http()
        .put(`/ho-tro-giang-vien/lop/${lopId}/giai-doan/${gdId}/thuc-dia`)
        .set(auth())
        .send({ nhan_su: [{ ho_ten: 'X', so_dien_thoai: '123' }] })
        .expect(400);
    });
  });

  describe('Danh mục (tạo/sửa, không ngưng)', () => {
    it('tạo điểm học + giảng viên → ghi tao_boi; ngưng → 403', async () => {
      const dh = await http()
        .post('/ho-tro-giang-vien/diem-hoc')
        .set(auth())
        .send({
          ma_diem_hoc: `VHL2-${suf}`.slice(0, 30),
          ten: 'Điểm mới',
          dia_chi: 'y',
          dia_ban_id: dv.diaDanhXa.id,
        })
        .expect(201);
      expect(dh.body.tao_boi).toBe(ndHoTro.id);
      await http()
        .patch(`/ho-tro-giang-vien/diem-hoc/${dh.body.id}`)
        .set(auth())
        .send({ trang_thai: 'ngung' })
        .expect(403);
      const gv = await http()
        .post('/ho-tro-giang-vien/giang-vien')
        .set(auth())
        .send({ ho_ten: 'GV mới', so_dien_thoai: `074${sdtGoc}` })
        .expect(201);
      await http()
        .patch(`/ho-tro-giang-vien/giang-vien/${gv.body.id}`)
        .set(auth())
        .send({ trang_thai: 'ngung' })
        .expect(403);
      const ds = await http()
        .get('/ho-tro-giang-vien/diem-hoc')
        .query({ q: 'VHL' })
        .set(auth())
        .expect(200);
      expect(ds.body.data.length).toBeGreaterThanOrEqual(2);
    });
  });
});
