# -*- coding: utf-8 -*-
# Script TAM (co the xoa sau khi dung xong) - sinh migration SQL T19 tu du lieu
# dia_danh CU da duoc backup o scripts/_backup_before_t19/ (truoc khi bi ghi de
# sang bo ma BNV moi).
from pathlib import Path
import openpyxl

ROOT = Path(__file__).resolve().parent.parent
BACKUP_DIR = ROOT / "scripts" / "_backup_before_t19"
OLD_TINH = BACKUP_DIR / "final_dia_danh_01_tinh_thanh.xlsx"
OLD_PXA = BACKUP_DIR / "final_dia_danh_02_phuong_xa.xlsx"

MIGRATION_DIR = ROOT / "backend" / "prisma" / "migrations" / "20261001010000_t19_dia_danh_lich_su"

# 14 ma tinh GSO cu trung so voi ma tinh BNV moi (01-34) - theo quyet dinh nguoi
# dung da chon: them hau to "-LS" CHI cho 14 ma nay. AG va 19 ma con lai giu nguyen.
COLLIDE_WITH_BNV = {
    "01", "04", "08", "11", "12", "14", "15", "19", "20", "22", "24", "25", "31", "33",
}


def lich_su_ma(old_ma: str) -> str:
    return f"{old_ma}-LS" if old_ma in COLLIDE_WITH_BNV else old_ma


def sql_str(s: str) -> str:
    return "'" + str(s).replace("'", "''") + "'"


def read_rows(path: Path):
    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    ws = wb[wb.sheetnames[0]]
    rows = list(ws.iter_rows(min_row=2, values_only=True))
    wb.close()
    return rows


def main():
    old_tinh_rows = read_rows(OLD_TINH)  # ma, ten, cap, parent_ma
    old_pxa_rows = read_rows(OLD_PXA)  # ma, ten, cap, parent_ma(=old tinh ma)

    assert len(old_tinh_rows) == 34, len(old_tinh_rows)
    assert len(old_pxa_rows) == 2566, len(old_pxa_rows)

    changed = []
    tinh_values = []
    for ma, ten, cap, parent_ma in old_tinh_rows:
        ls_ma = lich_su_ma(ma)
        if ls_ma != ma:
            changed.append((ma, ls_ma, ten))
        tinh_values.append((ls_ma, ten))

    assert len(changed) == 14, f"Ky vong dung 14 ma doi hau to -LS, thuc te {len(changed)}"

    pxa_values = []
    for ma, ten, cap, parent_ma in old_pxa_rows:
        pxa_values.append((ma, ten, lich_su_ma(parent_ma)))

    MIGRATION_DIR.mkdir(parents=True, exist_ok=True)
    out_path = MIGRATION_DIR / "migration.sql"

    lines = []
    lines.append(
        "-- T19 (2026-10-01): luu LAI toan bo du lieu dia_danh CU (truoc khi file"
    )
    lines.append(
        "-- data/final_dia_danh_01_tinh_thanh.xlsx va final_dia_danh_02_phuong_xa.xlsx"
    )
    lines.append(
        "-- duoc ghi de sang bo ma HANH CHINH MOI theo Quyet dinh cua Bo Noi vu (BNV,"
    )
    lines.append(
        "-- 34 tinh/thanh, ma tinh 2 so 01-34, ma phuong/xa moi 8 so) - de tiep tuc tra"
    )
    lines.append(
        "-- cuu duoc dung lich su cong tac/noi sinh cua giao vien theo dia gioi hanh"
    )
    lines.append("-- chinh TRUOC sap nhap 2025 (34 tinh GSO cu + 2566 phuong/xa GSO cu).")
    lines.append("--")
    lines.append(
        "-- CHI INSERT voi phien_ban='lich_su' tuong minh - khong sua/xoa dong dia_danh"
    )
    lines.append(
        "-- nao khac (ke ca cac dong 'hien_tai' se duoc nap rieng qua tinh nang Import"
    )
    lines.append("-- Excel, khong nam trong migration nay).")
    lines.append("--")
    lines.append(
        "-- VAN DE & QUYET DINH: cot \"ma\" co unique constraint TOAN BANG"
    )
    lines.append(
        "-- (uq_dia_danh_ma, khong phan biet cap/phien_ban - xem migration T18 dong"
    )
    lines.append(
        '-- "Giu nguyen ma (91801-91804) de khong pha unique constraint"). Bo ma GSO cu'
    )
    lines.append(
        "-- (2 ky tu, khong lien tuc) va bo ma BNV moi (2 ky tu, 01-34 lien tuc) TRUNG"
    )
    lines.append(
        "-- SO o dung 14 ma (01,04,08,11,12,14,15,19,20,22,24,25,31,33) ung voi 14 tinh"
    )
    lines.append(
        "-- KHAC NHAU (tru '01' Ha Noi la trung ten tinh nhung van la 2 dong dia_danh"
    )
    lines.append(
        "-- khac nhau). De tranh dung unique constraint, 14 dong tinh_thanh LICH SU nay"
    )
    lines.append('-- duoc doi "ma" thanh dang "<ma_cu>-LS" (vi du "04" Cao Bang cu ->')
    lines.append(
        '-- "04-LS"). An Giang ("AG") va 19 ma GSO cu khong trung voi BNV GIU NGUYEN -'
    )
    lines.append(
        "-- rieng An Giang BAT BUOC giu ma='AG' vi migration T18 tra cuu dung chuoi nay"
    )
    lines.append(
        "-- (SELECT ... WHERE cap='tinh_thanh' AND ten='An Giang' AND ma='AG')."
    )
    lines.append("--")
    lines.append(
        "-- parent_id cua tung dong phuong_xa_dac_khu lich su duoc JOIN dung ve dong"
    )
    lines.append(
        '-- tinh_thanh LICH SU tuong ung (theo "ma" ĐÃ áp dung quy tac -LS neu thuoc 14'
    )
    lines.append(
        "-- tinh noi tren), KHONG phai dong tinh_thanh hien_tai (ma BNV moi)."
    )
    lines.append("--")
    lines.append(
        '-- ON CONFLICT ("ma") DO NOTHING (theo uq_dia_danh_ma) de co the chay lai an'
    )
    lines.append("-- toan neu migration da chay 1 phan.")
    lines.append("")
    lines.append("-- (1) 34 dong tinh_thanh LICH SU (14 dong co hau to -LS, xem giai thich tren).")
    lines.append('INSERT INTO "dia_danh" ("id", "ma", "ten", "cap", "parent_id", "phien_ban")')
    lines.append(
        "SELECT gen_random_uuid(), v.ma, v.ten, 'tinh_thanh'::\"cap_dia_danh\", NULL, 'lich_su'::\"phien_ban_dia_danh\""
    )
    lines.append("FROM (VALUES")
    value_lines = [f"  ({sql_str(ma)}, {sql_str(ten)})" for ma, ten in tinh_values]
    lines.append(",\n".join(value_lines))
    lines.append(") AS v(ma, ten)")
    lines.append('ON CONFLICT ("ma") DO NOTHING;')
    lines.append("")
    lines.append(
        "-- (2) 2566 dong phuong_xa_dac_khu LICH SU, parent_id JOIN ve dong tinh_thanh"
    )
    lines.append("-- lich su vua insert o tren (theo ma lich su, xem giai thich tren).")
    lines.append(
        'INSERT INTO "dia_danh" ("id", "ma", "ten", "cap", "parent_id", "phien_ban")'
    )
    lines.append(
        "SELECT gen_random_uuid(), v.ma, v.ten, 'phuong_xa_dac_khu'::\"cap_dia_danh\", p.id, 'lich_su'::\"phien_ban_dia_danh\""
    )
    lines.append("FROM (VALUES")
    pxa_value_lines = [
        f"  ({sql_str(ma)}, {sql_str(ten)}, {sql_str(parent_ma)})" for ma, ten, parent_ma in pxa_values
    ]
    lines.append(",\n".join(pxa_value_lines))
    lines.append(") AS v(ma, ten, parent_ma_lich_su)")
    lines.append(
        'JOIN "dia_danh" p ON p."cap" = \'tinh_thanh\'::"cap_dia_danh" AND p."phien_ban" = \'lich_su\'::"phien_ban_dia_danh" AND p."ma" = v.parent_ma_lich_su'
    )
    lines.append('ON CONFLICT ("ma") DO NOTHING;')
    lines.append("")

    out_path.write_text("\n".join(lines), encoding="utf-8")

    print(f"[write] {out_path}")
    print(f"tinh_thanh VALUES: {len(tinh_values)} dong")
    print(f"phuong_xa VALUES: {len(pxa_values)} dong")
    print(f"So ma doi hau to -LS: {len(changed)}")
    for old_ma, ls_ma, ten in changed:
        print(f"   {old_ma} -> {ls_ma}  ({ten})")


if __name__ == "__main__":
    main()
