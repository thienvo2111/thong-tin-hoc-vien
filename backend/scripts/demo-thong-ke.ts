// Dữ liệu demo cho dashboard thống kê — CHỈ DB local (từ chối host khác).
//   npx ts-node scripts/demo-thong-ke.ts tao   # sinh dữ liệu demo (+ sao lưu giá trị gốc)
//   npx ts-node scripts/demo-thong-ke.ts xoa   # xóa dữ liệu demo và khôi phục giá trị gốc
// Không in họ tên/SĐT/email — chỉ in số lượng.
import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { Prisma, PrismaClient } from '@prisma/client';
import {
  KeHoachDemo,
  KetQuaHoc,
  NHAN_DEMO_GHI_CHU,
  NHAN_DEMO_NGUON,
  kiemTraDbLocal,
  lapKeHoachDemo,
} from './demo-thong-ke.lib';

const THANG = ['M1', 'M2', 'M3', 'M4'];
const THU_MUC_SAO_LUU = path.join(__dirname, '..', 'backups');
const TIEN_TO = 'demo-thong-ke-';
const CO_BAN_GHI = 1000;
const CO_CAP_NHAT = 500;

interface SaoLuu {
  nguoi_dung: { id: string; dang_nhap_lan_cuoi: string | null }[];
  dang_ky_hoc: { id: string; ket_qua: KetQuaHoc | null; cum_id: string | null }[];
}

const prisma = new PrismaClient();

function chia<T>(ds: T[], n: number): T[][] {
  const kq: T[][] = [];
  for (let i = 0; i < ds.length; i += n) kq.push(ds.slice(i, i + n));
  return kq;
}

function dauThoiGian(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return (
    `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}` +
    `-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
  );
}

function timSaoLuuChuaKhoiPhuc(): string[] {
  if (!fs.existsSync(THU_MUC_SAO_LUU)) return [];
  return fs
    .readdirSync(THU_MUC_SAO_LUU)
    .filter((f) => f.startsWith(TIEN_TO) && f.endsWith('.json') && !f.endsWith('.da-khoi-phuc.json'))
    .sort();
}

async function demDuLieuDemo() {
  const [khaoSat, diemDanh, vle] = await Promise.all([
    prisma.ket_qua_khao_sat.count({ where: { nguon: NHAN_DEMO_NGUON } }),
    prisma.diem_danh.count({ where: { ghi_chu: NHAN_DEMO_GHI_CHU } }),
    prisma.ket_qua_giai_doan.count({ where: { ghi_chu: NHAN_DEMO_GHI_CHU } }),
  ]);
  return { khaoSat, diemDanh, vle };
}

async function docDauVao() {
  const [dangKy, lop, buoi, giaiDoan, cums, khaoSat, diemDanh, vle] = await Promise.all([
    prisma.dang_ky_hoc.findMany({
      select: {
        id: true,
        hoc_vien_id: true,
        cum_id: true,
        ket_qua: true,
        hoc_vien: {
          select: {
            don_vi_cong_tac_id: true,
            nguoi_dung_account: { select: { id: true, dang_nhap_lan_cuoi: true } },
          },
        },
      },
    }),
    prisma.lop_hoc.findMany({ select: { id: true, loai_lop: true } }),
    prisma.lich_hoc_lop.findMany({
      select: { id: true, lop_id: true, giai_doan_id: true, thoi_gian_bat_dau: true },
    }),
    prisma.giai_doan_khoa.findMany({ select: { id: true, thu_tu: true, hinh_thuc: true } }),
    prisma.cum_hoc_vien.findMany({ select: { id: true } }),
    prisma.ket_qua_khao_sat.findMany({ select: { hoc_vien_id: true, loai: true } }),
    prisma.diem_danh.findMany({ select: { dang_ky_hoc_id: true, lich_hoc_id: true } }),
    prisma.ket_qua_giai_doan.findMany({ select: { dang_ky_hoc_id: true, giai_doan_id: true } }),
  ]);
  const goc = {
    nguoiDung: new Map<string, Date | null>(),
    dangKy: new Map(dangKy.map((d) => [d.id, { ket_qua: d.ket_qua, cum_id: d.cum_id }])),
  };
  for (const d of dangKy) {
    const nd = d.hoc_vien.nguoi_dung_account;
    if (nd) goc.nguoiDung.set(nd.id, nd.dang_nhap_lan_cuoi);
  }
  const dauVao = {
    dangKy: dangKy.map((d) => ({
      id: d.id,
      hoc_vien_id: d.hoc_vien_id,
      don_vi_id: d.hoc_vien.don_vi_cong_tac_id,
      nguoi_dung_id: d.hoc_vien.nguoi_dung_account?.id ?? null,
      cum_id: d.cum_id,
      ket_qua: d.ket_qua as KetQuaHoc | null,
    })),
    lop,
    buoi,
    giaiDoan,
    cumIds: cums.map((c) => c.id),
    thang: THANG,
    now: new Date(),
    khaoSatDaCo: khaoSat.map((k) => `${k.hoc_vien_id}|${k.loai}`),
    diemDanhDaCo: diemDanh.map((k) => `${k.dang_ky_hoc_id}|${k.lich_hoc_id}`),
    ketQuaGiaiDoanDaCo: vle.map((k) => `${k.dang_ky_hoc_id}|${k.giai_doan_id}`),
  };
  return { dauVao, goc };
}

function taoSaoLuu(kh: KeHoachDemo, goc: Awaited<ReturnType<typeof docDauVao>>['goc']): string {
  const noiDung: SaoLuu = {
    nguoi_dung: kh.nguoiDung.map((n) => ({
      id: n.id,
      dang_nhap_lan_cuoi: goc.nguoiDung.get(n.id)?.toISOString() ?? null,
    })),
    dang_ky_hoc: kh.dangKy.map((d) => ({ id: d.id, ...goc.dangKy.get(d.id) })),
  };
  fs.mkdirSync(THU_MUC_SAO_LUU, { recursive: true });
  const file = path.join(THU_MUC_SAO_LUU, `${TIEN_TO}${dauThoiGian(new Date())}.json`);
  fs.writeFileSync(file, JSON.stringify(noiDung));
  return file;
}

async function ghiLo<T>(ten: string, ds: T[], ghi: (lo: T[]) => Promise<unknown>) {
  for (const lo of chia(ds, CO_BAN_GHI)) await ghi(lo);
  console.log(`  ${ten}: ${ds.length}`);
}

async function capNhatLo(ds: Prisma.PrismaPromise<unknown>[]) {
  for (const lo of chia(ds, CO_CAP_NHAT)) await prisma.$transaction(lo);
}

async function lenhTao() {
  const dem = await demDuLieuDemo();
  if (dem.khaoSat + dem.diemDanh + dem.vle > 0 || timSaoLuuChuaKhoiPhuc().length > 0) {
    console.log('Đã có dữ liệu demo — chạy `xoa` trước.');
    process.exitCode = 1;
    return;
  }
  const { dauVao, goc } = await docDauVao();
  const kh = lapKeHoachDemo(dauVao);
  kh.ghiChuLog.forEach((m) => console.log(`  ! ${m}`));
  const file = taoSaoLuu(kh, goc);
  console.log(`Đã sao lưu giá trị gốc: ${path.relative(process.cwd(), file)}`);

  await capNhatLo(
    kh.nguoiDung.map((n) =>
      prisma.nguoi_dung.update({
        where: { id: n.id },
        data: { dang_nhap_lan_cuoi: n.dang_nhap_lan_cuoi },
      }),
    ),
  );
  console.log(`  nguoi_dung.dang_nhap_lan_cuoi: ${kh.nguoiDung.length}`);
  await capNhatLo(
    kh.dangKy.map((d) =>
      prisma.dang_ky_hoc.update({
        where: { id: d.id },
        data: { ket_qua: d.ket_qua, cum_id: d.cum_id },
      }),
    ),
  );
  console.log(`  dang_ky_hoc (kết quả/cụm): ${kh.dangKy.length}`);
  await ghiLo('ket_qua_khao_sat', kh.khaoSat, (data) =>
    prisma.ket_qua_khao_sat.createMany({ data, skipDuplicates: true }),
  );
  await ghiLo('diem_danh', kh.diemDanh, (data) =>
    prisma.diem_danh.createMany({ data, skipDuplicates: true }),
  );
  await ghiLo('ket_qua_giai_doan', kh.ketQuaGiaiDoan, (data) =>
    prisma.ket_qua_giai_doan.createMany({ data, skipDuplicates: true }),
  );
}

async function khoiPhuc(file: string) {
  const sl: SaoLuu = JSON.parse(fs.readFileSync(path.join(THU_MUC_SAO_LUU, file), 'utf8'));
  await capNhatLo(
    sl.nguoi_dung.map((n) =>
      prisma.nguoi_dung.update({
        where: { id: n.id },
        data: { dang_nhap_lan_cuoi: n.dang_nhap_lan_cuoi ? new Date(n.dang_nhap_lan_cuoi) : null },
      }),
    ),
  );
  await capNhatLo(
    sl.dang_ky_hoc.map((d) =>
      prisma.dang_ky_hoc.update({
        where: { id: d.id },
        data: { ket_qua: d.ket_qua, cum_id: d.cum_id },
      }),
    ),
  );
  console.log(`  khôi phục nguoi_dung: ${sl.nguoi_dung.length}, dang_ky_hoc: ${sl.dang_ky_hoc.length}`);
  fs.renameSync(
    path.join(THU_MUC_SAO_LUU, file),
    path.join(THU_MUC_SAO_LUU, file.replace(/\.json$/, '.da-khoi-phuc.json')),
  );
}

async function lenhXoa() {
  const [a, b, c] = await Promise.all([
    prisma.ket_qua_khao_sat.deleteMany({ where: { nguon: NHAN_DEMO_NGUON } }),
    prisma.diem_danh.deleteMany({ where: { ghi_chu: NHAN_DEMO_GHI_CHU } }),
    prisma.ket_qua_giai_doan.deleteMany({ where: { ghi_chu: NHAN_DEMO_GHI_CHU } }),
  ]);
  console.log(`  đã xóa ket_qua_khao_sat: ${a.count}, diem_danh: ${b.count}, ket_qua_giai_doan: ${c.count}`);
  const files = timSaoLuuChuaKhoiPhuc();
  if (files.length === 0) {
    console.log('  không có file sao lưu chưa khôi phục.');
    return;
  }
  await khoiPhuc(files[files.length - 1]);
}

async function main() {
  const lenh = process.argv[2];
  if (lenh !== 'tao' && lenh !== 'xoa') {
    console.log('Dùng: demo-thong-ke.ts tao|xoa');
    process.exitCode = 1;
    return;
  }
  kiemTraDbLocal(process.env.DATABASE_URL);
  if (lenh === 'tao') await lenhTao();
  else await lenhXoa();
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
