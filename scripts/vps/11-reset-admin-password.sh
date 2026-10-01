#!/usr/bin/env bash
# Dat lai mat khau mot tai khoan quan_tri (hoac bat ky nguoi_dung nao) tren
# VPS that, dung khi quen mat khau va khong dung duoc flow "Quen mat khau"
# qua email (vd. SMTP chua cau hinh, hoac mat luon email).
#
# Chay bang APP_USER (KHONG sudo), tu thu muc backend da duoc "npx prisma
# generate" (06-deploy.sh da lam roi) - script nay tai dung PrismaClient co
# san trong node_modules, khong can cai them goi nao.
#
# Dung:
#   bash 11-reset-admin-password.sh <ten_dang_nhap> [mat_khau_moi]
# Neu bo qua mat_khau_moi, script tu sinh 1 mat khau ngau nhien va in ra
# DUY NHAT 1 LAN (khong luu lai o dau ca) - chep lai ngay.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"
source ./00-config.sh

if [ "$(id -u)" -eq 0 ]; then
  echo "Chay bang user thuong (${APP_USER}), khong dung sudo/root." >&2
  exit 1
fi

TEN_DANG_NHAP="${1:-}"
if [ -z "${TEN_DANG_NHAP}" ]; then
  echo "Dung: bash 11-reset-admin-password.sh <ten_dang_nhap> [mat_khau_moi]" >&2
  echo "Vi du: bash 11-reset-admin-password.sh quantri@thongtinhocvien.local" >&2
  exit 1
fi
MAT_KHAU_MOI="${2:-}"

BACKEND_DIR="${APP_DIR}/backend"
if [ ! -d "${BACKEND_DIR}/node_modules/.prisma/client" ]; then
  echo "LOI: chua thay Prisma Client da generate o ${BACKEND_DIR}." >&2
  echo "Chay 'npx prisma generate' trong ${BACKEND_DIR} truoc (hoac chay 06-deploy.sh)." >&2
  exit 1
fi

cd "${BACKEND_DIR}"

TEN_DANG_NHAP="${TEN_DANG_NHAP}" MAT_KHAU_MOI="${MAT_KHAU_MOI}" node <<'NODE_SCRIPT'
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');

const BCRYPT_SALT_ROUNDS = 10;
const tenDangNhap = process.env.TEN_DANG_NHAP;
const matKhauTuThamSo = (process.env.MAT_KHAU_MOI || '').trim();
const matKhauMoi = matKhauTuThamSo || crypto.randomBytes(12).toString('base64url');

const prisma = new PrismaClient();

async function main() {
  const nguoiDung = await prisma.nguoi_dung.findUnique({
    where: { ten_dang_nhap: tenDangNhap },
  });
  if (!nguoiDung) {
    console.error(`[reset] Khong tim thay tai khoan "${tenDangNhap}".`);
    process.exitCode = 1;
    return;
  }

  const matKhauHash = await bcrypt.hash(matKhauMoi, BCRYPT_SALT_ROUNDS);

  await prisma.nguoi_dung.update({
    where: { id: nguoiDung.id },
    data: {
      mat_khau_hash: matKhauHash,
      phai_doi_mat_khau: true,
      so_lan_dang_nhap_sai: 0,
      khoa_den: null,
    },
  });

  console.log(`[reset] Da dat lai mat khau cho "${tenDangNhap}" (vai_tro=${nguoiDung.vai_tro}).`);
  console.log(`[reset] Da mo khoa dang nhap (khoa_den=NULL, so_lan_dang_nhap_sai=0).`);
  if (!matKhauTuThamSo) {
    console.log(`[reset] Mat khau moi (CHI HIEN 1 LAN, chep lai ngay): ${matKhauMoi}`);
  } else {
    console.log('[reset] Mat khau moi: lay tu tham so dong lenh ban da go.');
  }
  console.log('[reset] phai_doi_mat_khau=true -> he thong se bat doi mat khau ngay sau khi dang nhap.');
}

main()
  .catch((err) => {
    console.error('[reset] Loi:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
NODE_SCRIPT
