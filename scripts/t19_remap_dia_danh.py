# -*- coding: utf-8 -*-
# Script TAM (co the xoa sau khi dung xong) - T19 remap dia_danh theo bo ma BNV moi.
# Xem huong dan trong yeu cau cua nguoi dung (khong luu lai o day).
import re
import shutil
import unicodedata
from pathlib import Path
from collections import defaultdict, Counter

REAL_WARD_MA_RE = re.compile(r"^\d{5}$")

import openpyxl

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
BACKUP_DIR = ROOT / "scripts" / "_backup_before_t19"
BACKUP_DIR.mkdir(exist_ok=True)

NEW_SRC = DATA / "Danh-muc-Phuong-xa_moi_34-tinh-thanh-sau-sat-nhap.xlsx"
OLD_TINH = DATA / "final_dia_danh_01_tinh_thanh.xlsx"
OLD_PXA = DATA / "final_dia_danh_02_phuong_xa.xlsx"
TRUONG = DATA / "final_don_vi_cong_tac_02_truong.xlsx"

PROVINCE_PREFIXES = ["thanh pho", "tp", "tinh"]
WARD_PREFIXES = ["dac khu", "thi tran", "phuong", "xa"]


def strip_accents(s: str) -> str:
    s = s.replace("đ", "d").replace("Đ", "D")
    s = unicodedata.normalize("NFD", s)
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return unicodedata.normalize("NFC", s)


def basic_norm(s: str) -> str:
    s = strip_accents(s or "").lower()
    s = s.replace(".", " ").replace("-", " ")
    s = " ".join(s.split())
    return s


def strip_prefix(s: str, prefixes) -> str:
    for p in sorted(prefixes, key=len, reverse=True):
        if s == p:
            return ""
        if s.startswith(p + " "):
            return s[len(p) + 1 :].strip()
    return s


def norm_province(s: str) -> str:
    return strip_prefix(basic_norm(s), PROVINCE_PREFIXES)


def norm_ward(s: str) -> str:
    return strip_prefix(basic_norm(s), WARD_PREFIXES)


def backup(src: Path):
    dst = BACKUP_DIR / src.name
    if dst.exists():
        return dst  # da backup o lan chay truoc - khong ghi de (src gio la ban DA bi ghi de)
    shutil.copy2(src, dst)
    return dst


def read_rows(path: Path, sheet_index=0, min_row=2):
    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    ws = wb[wb.sheetnames[sheet_index]]
    rows = list(ws.iter_rows(min_row=min_row, values_only=True))
    wb.close()
    return rows


def write_xlsx(path: Path, header, rows):
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "dia_danh" if "dia_danh" in path.stem else ws.title
    ws.append(list(header))
    for r in rows:
        ws.append(list(r))
    wb.save(path)


def main():
    report_lines = []

    # ---- 0. Backup old files truoc khi ghi de (khong co trong git history) ----
    b1 = backup(OLD_TINH)
    b2 = backup(OLD_PXA)
    b3 = backup(TRUONG)
    print(f"[backup] {b1}\n[backup] {b2}\n[backup] {b3}")

    old_tinh_rows = read_rows(b1)  # ma, ten, cap, parent_ma
    old_pxa_rows = read_rows(b2)  # ma, ten, cap, parent_ma(=old tinh ma)
    truong_rows = read_rows(b3)  # ma_don_vi, ten_don_vi, loai_don_vi, dia_ban_ma, don_vi_cha_ma

    print(f"old tinh: {len(old_tinh_rows)} dong | old phuong_xa: {len(old_pxa_rows)} dong | truong: {len(truong_rows)} dong")

    # ---- 1. Doc file BNV moi ----
    new_wb = openpyxl.load_workbook(NEW_SRC, read_only=True, data_only=True)
    new_ws = new_wb[new_wb.sheetnames[0]]
    new_rows = list(new_ws.iter_rows(min_row=2, values_only=True))
    new_wb.close()
    print(f"new (BNV) rows: {len(new_rows)}")

    new_provinces = {}  # ma(str 2 digit) -> ten
    new_wards = []  # (ma 8 digit str, ten, parent_ma)
    for r in new_rows:
        bnv_ma = str(r[1]).zfill(2)
        bnv_ten = r[2]
        ward_ma = str(r[7]).zfill(8)
        ward_ten = r[8]
        new_provinces[bnv_ma] = bnv_ten
        new_wards.append((ward_ma, ward_ten, bnv_ma))

    assert len(new_provinces) == 34, f"Ky vong 34 tinh BNV, thuc te {len(new_provinces)}"
    assert len(new_wards) == 3321, f"Ky vong 3321 phuong/xa moi, thuc te {len(new_wards)}"

    # ---- 2. Mapping ten tinh cu(GSO) -> ma BNV moi ----
    old_provinces = [(r[0], r[1]) for r in old_tinh_rows]  # (ma, ten)
    assert len(old_provinces) == 34, f"Ky vong 34 tinh cu, thuc te {len(old_provinces)}"

    new_by_norm = defaultdict(list)
    for ma, ten in new_provinces.items():
        new_by_norm[norm_province(ten)].append(ma)

    old_to_new_ma = {}
    mapping_errors = []
    for old_ma, old_ten in old_provinces:
        if old_ma == "AG":
            old_to_new_ma[old_ma] = "32"  # quyet dinh nghiep vu #3 - An Giang -> BNV 32
            continue
        key = norm_province(old_ten)
        candidates = new_by_norm.get(key, [])
        if len(candidates) == 1:
            old_to_new_ma[old_ma] = candidates[0]
        else:
            mapping_errors.append((old_ma, old_ten, key, candidates))

    if mapping_errors:
        report_lines.append("## LOI MAPPING TINH (khong tu dong khop duoc)\n")
        for old_ma, old_ten, key, candidates in mapping_errors:
            report_lines.append(f"- ma cu={old_ma} ten cu={old_ten!r} (norm={key!r}) candidates={candidates}")
        raise SystemExit(
            "DUNG: co loi mapping tinh khong tu dong khop duoc, xem danh sach loi phia tren. "
            "Khong tu doan - can soat lai thu cong."
        )

    assert len(old_to_new_ma) == 34
    assert len(set(old_to_new_ma.values())) == 34, "Mapping tinh khong phai bijective (co trung ma moi)"
    print("Mapping 34 tinh cu -> 34 ma BNV moi: OK (bijective)")
    for old_ma, old_ten in old_provinces:
        print(f"   {old_ma:>4} {old_ten:<22} -> {old_to_new_ma[old_ma]:>2} {new_provinces[old_to_new_ma[old_ma]]}")

    # ---- 3. Ghi de final_dia_danh_01_tinh_thanh.xlsx (34 dong, ma BNV) ----
    tinh_out_rows = []
    for ma, ten in sorted(new_provinces.items(), key=lambda x: x[0]):
        tinh_out_rows.append((str(ma), ten, "tinh_thanh", None))
    write_xlsx(OLD_TINH, ["ma", "ten", "cap", "parent_ma"], tinh_out_rows)
    print(f"[write] {OLD_TINH} -> {len(tinh_out_rows)} dong")

    # ---- 4. Ghi de final_dia_danh_02_phuong_xa.xlsx (3321 dong, ma 8 so) ----
    pxa_out_rows = []
    for ma, ten, parent_ma in new_wards:
        pxa_out_rows.append((str(ma), ten, "phuong_xa_dac_khu", str(parent_ma)))
    write_xlsx(OLD_PXA, ["ma", "ten", "cap", "parent_ma"], pxa_out_rows)
    print(f"[write] {OLD_PXA} -> {len(pxa_out_rows)} dong")

    # ---- 5. Remap final_don_vi_cong_tac_02_truong.xlsx ----
    # old ward lookup: old_ma(5 digit str) -> (ten, old_parent_ma)
    old_ward_by_ma = {}
    for ma, ten, cap, parent_ma in old_pxa_rows:
        old_ward_by_ma[str(ma)] = (ten, str(parent_ma) if parent_ma is not None else None)

    # new wards grouped by province, normalized name -> list of new_ma
    new_ward_by_province_norm = defaultdict(lambda: defaultdict(list))
    for ma, ten, parent_ma in new_wards:
        new_ward_by_province_norm[parent_ma][norm_ward(ten)].append(ma)

    matched = 0
    unmatched = []
    ambiguous = []
    truong_out_rows = []
    for row in truong_rows:
        ma_don_vi, ten_don_vi, loai_don_vi, dia_ban_ma, don_vi_cha_ma = row
        old_tinh_ma = str(don_vi_cha_ma).replace("SO-GDDT-", "", 1)
        new_tinh_ma = old_to_new_ma.get(old_tinh_ma)
        old_ward_ten, old_ward_parent_ma = old_ward_by_ma.get(str(dia_ban_ma), (None, None))

        new_dia_ban_ma = dia_ban_ma  # giu nguyen ma cu neu khong khop duoc
        if old_ward_ten is None:
            unmatched.append((ma_don_vi, ten_don_vi, old_tinh_ma, dia_ban_ma, "khong tim thay dia_ban_ma trong du lieu phuong/xa cu"))
        elif new_tinh_ma is None:
            unmatched.append((ma_don_vi, ten_don_vi, old_tinh_ma, dia_ban_ma, "khong xac dinh duoc tinh moi tu don_vi_cha_ma"))
        else:
            key = norm_ward(old_ward_ten)
            candidates = new_ward_by_province_norm[new_tinh_ma].get(key, [])
            if len(candidates) == 1:
                new_dia_ban_ma = candidates[0]
                matched += 1
            elif len(candidates) == 0:
                unmatched.append((ma_don_vi, ten_don_vi, old_tinh_ma, dia_ban_ma, f"ten cu {old_ward_ten!r} (norm={key!r}) khong khop ten nao trong tinh moi {new_tinh_ma}"))
            else:
                ambiguous.append((ma_don_vi, ten_don_vi, old_tinh_ma, dia_ban_ma, old_ward_ten, key, candidates))

        truong_out_rows.append((ma_don_vi, ten_don_vi, loai_don_vi, new_dia_ban_ma, don_vi_cha_ma))

    write_xlsx(TRUONG, ["ma_don_vi", "ten_don_vi", "loai_don_vi", "dia_ban_ma", "don_vi_cha_ma"], truong_out_rows)
    print(f"[write] {TRUONG} -> {len(truong_out_rows)} dong (match tu dong: {matched}, khong match: {len(unmatched)}, mo ho/nhieu khop: {len(ambiguous)})")

    # ---- 6. Bao cao ----
    report_path = ROOT / "scripts" / "_report_remap_truong.md"
    lines = []
    lines.append("# Bao cao remap dia_ban_ma cho final_don_vi_cong_tac_02_truong.xlsx (T19)\n")
    lines.append(f"- Tong so dong: {len(truong_rows)}")
    lines.append(f"- Match tu dong thanh cong: {matched}")
    lines.append(f"- Khong match (giu nguyen ma cu, CAN SOAT THU CONG): {len(unmatched)}")
    lines.append(f"- Mo ho / nhieu ung vien khop (giu nguyen ma cu, CAN SOAT THU CONG): {len(ambiguous)}\n")

    sentinel_unmatched = [u for u in unmatched if not REAL_WARD_MA_RE.fullmatch(str(u[3]))]
    real_unmatched = [u for u in unmatched if REAL_WARD_MA_RE.fullmatch(str(u[3]))]

    lines.append(
        f"- Trong so khong match: {len(sentinel_unmatched)} dong co dia_ban_ma KHONG o dang 5 chu so "
        "(VD: AG-XA-CHUAXACDINH, 0008201, 14800...) - day la cac ma placeholder/dac biet "
        "(Khu vuc 1/2/2NT/3, Nuoc ngoai, Quan nhan - cong an tai ngu, chua xac dinh...) tuong ung "
        "cac dong phien_ban=dac_biet theo migration T17, KHONG phai dia gioi hanh chinh thuc - "
        "KHONG can remap, giu nguyen la dung.\n"
        f"- Can soat THU CONG thuc su (dia_ban_ma dang 5 chu so GSO hop le nhung khong khop ten): "
        f"{len(real_unmatched)} dong (xem bang duoi).\n"
    )

    if real_unmatched:
        lines.append("## Can soat THU CONG - khong tu khop duoc ten phuong/xa (ma GSO cu hop le)\n")
        lines.append("| ma_don_vi | ten_don_vi | tinh (ma cu) | dia_ban_ma cu | ly do |")
        lines.append("|---|---|---|---|---|")
        for ma_don_vi, ten_don_vi, old_tinh_ma, dia_ban_ma, reason in real_unmatched:
            lines.append(f"| {ma_don_vi} | {ten_don_vi} | {old_tinh_ma} | {dia_ban_ma} | {reason} |")
        lines.append("")

    if ambiguous:
        lines.append("## Can soat THU CONG - mo ho (nhieu ung vien khop ten trong cung tinh moi)\n")
        lines.append("| ma_don_vi | ten_don_vi | tinh (ma cu) | dia_ban_ma cu | ten cu | norm | ung vien moi |")
        lines.append("|---|---|---|---|---|---|---|")
        for ma_don_vi, ten_don_vi, old_tinh_ma, dia_ban_ma, old_ward_ten, key, candidates in ambiguous:
            lines.append(f"| {ma_don_vi} | {ten_don_vi} | {old_tinh_ma} | {dia_ban_ma} | {old_ward_ten} | {key} | {candidates} |")
        lines.append("")

    if sentinel_unmatched:
        lines.append("## Placeholder/dac biet (khong can remap) - liet ke de doi chieu\n")
        lines.append("| ma_don_vi | ten_don_vi | tinh (ma cu) | dia_ban_ma cu |")
        lines.append("|---|---|---|---|")
        for ma_don_vi, ten_don_vi, old_tinh_ma, dia_ban_ma, reason in sentinel_unmatched:
            lines.append(f"| {ma_don_vi} | {ten_don_vi} | {old_tinh_ma} | {dia_ban_ma} |")
        lines.append("")

    report_path.write_text("\n".join(lines), encoding="utf-8")
    print(f"[write] {report_path}")

    print("\n=== TONG KET ===")
    print(f"34 tinh moi, {len(pxa_out_rows)} phuong/xa moi, {len(truong_out_rows)} truong (ghi de).")
    print(f"Truong: match={matched} khong-match={len(unmatched)} mo-ho={len(ambiguous)}")


if __name__ == "__main__":
    main()
