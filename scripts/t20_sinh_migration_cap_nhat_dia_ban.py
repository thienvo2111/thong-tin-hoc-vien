"""
T20: Doc 2 file Excel final_don_vi_cong_tac_01_so_gddt.xlsx va
final_don_vi_cong_tac_02_truong.xlsx, lay danh sach (ma_don_vi, dia_ban_ma)
roi sinh migration SQL UPDATE hang loat cho bang don_vi_cong_tac.

Script tam, co the xoa sau khi da sinh xong migration.sql.
"""
import re
import sys
from pathlib import Path

import openpyxl

ROOT = Path(__file__).resolve().parent.parent
FILES = [
    ROOT / "data" / "final_don_vi_cong_tac_01_so_gddt.xlsx",
    ROOT / "data" / "final_don_vi_cong_tac_02_truong.xlsx",
]
OUT_SQL = (
    ROOT
    / "backend"
    / "prisma"
    / "migrations"
    / "20261001060000_t20_cap_nhat_dia_ban_don_vi"
    / "migration.sql"
)

# Chi cho phep ky tu an toan trong ma_don_vi / dia_ban_ma khi nhung vao SQL
# (khong dua ten/chuoi tu do vao cau lenh, chi dua ma).
SAFE_RE = re.compile(r"^[A-Za-z0-9_\-./]+$")


def sql_escape(value: str) -> str:
    return value.replace("'", "''")


def main() -> None:
    pairs: list[tuple[str, str]] = []
    counts = {}
    for path in FILES:
        if not path.exists():
            print(f"LOI: khong tim thay file {path}", file=sys.stderr)
            sys.exit(1)
        wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
        ws = wb.active
        rows = list(ws.iter_rows(values_only=True))
        header = [str(h).strip() if h is not None else "" for h in rows[0]]
        try:
            idx_ma_don_vi = header.index("ma_don_vi")
            idx_dia_ban_ma = header.index("dia_ban_ma")
        except ValueError as exc:
            print(f"LOI: thieu cot can thiet trong {path}: {exc}", file=sys.stderr)
            sys.exit(1)

        n = 0
        for row in rows[1:]:
            if row is None or all(c is None for c in row):
                continue
            ma_don_vi = row[idx_ma_don_vi]
            dia_ban_ma = row[idx_dia_ban_ma]
            if ma_don_vi is None or dia_ban_ma is None:
                print(f"LOI: dong thieu du lieu trong {path}: {row}", file=sys.stderr)
                sys.exit(1)
            ma_don_vi = str(ma_don_vi).strip()
            dia_ban_ma = str(dia_ban_ma).strip()
            if not ma_don_vi or not dia_ban_ma:
                print(f"LOI: dong co gia tri rong trong {path}: {row}", file=sys.stderr)
                sys.exit(1)
            if not SAFE_RE.match(ma_don_vi):
                print(
                    f"LOI: ma_don_vi chua ky tu khong an toan: {ma_don_vi!r} trong {path}",
                    file=sys.stderr,
                )
                sys.exit(1)
            if not SAFE_RE.match(dia_ban_ma):
                print(
                    f"LOI: dia_ban_ma chua ky tu khong an toan: {dia_ban_ma!r} trong {path}",
                    file=sys.stderr,
                )
                sys.exit(1)
            pairs.append((ma_don_vi, dia_ban_ma))
            n += 1
        counts[path.name] = n

    for name, n in counts.items():
        print(f"{name}: {n} dong")
    print(f"Tong so cap (ma_don_vi, dia_ban_ma): {len(pairs)}")

    # Kiem tra trung ma_don_vi giua 2 file (khong duoc trung)
    seen = {}
    for ma_don_vi, dia_ban_ma in pairs:
        if ma_don_vi in seen and seen[ma_don_vi] != dia_ban_ma:
            print(
                f"CANH BAO: ma_don_vi {ma_don_vi} xuat hien 2 lan voi dia_ban_ma khac nhau",
                file=sys.stderr,
            )
        seen[ma_don_vi] = dia_ban_ma

    header_comment = """-- T20 (2026-10-01): cap nhat dia_ban_id cho cac dong DA TON TAI SAN trong
-- bang "don_vi_cong_tac" (so GD&DT, truong hoc) sang dia_danh MOI theo bo ma
-- hanh chinh moi cua Bo Noi vu (BNV), dua theo mapping da tinh san trong 2
-- file data/final_don_vi_cong_tac_01_so_gddt.xlsx (34 dong) va
-- data/final_don_vi_cong_tac_02_truong.xlsx (4931 dong), xem them T19
-- (migration 20261001010000_t19_dia_danh_lich_su) ve viec tai tao dia_danh
-- theo ma BNV/TMS moi.
--
-- LY DO CAN MIGRATION NAY (khac voi cach lam thong thuong la "import lai
-- Excel"): tinh nang Import Excel cua man Admin "Danh muc don vi" (xem
-- backend/src/danh-muc/don-vi-cong-tac/don-vi-cong-tac.service.ts, ham
-- checkValid) CHI INSERT dong moi - neu ma_don_vi da ton tai se nem loi
-- "Ma don vi da ton tai" va KHONG cap nhat duoc dia_ban_id cua dong da co.
-- Du lieu so GD&DT/truong hoc tren DB (ca local dev lan server that) DA
-- DUOC IMPORT TU TRUOC (dia_ban_id dang tro ve dia_danh theo ma GSO CU), nen
-- import lai file Excel moi se bao loi trung cho hau het 4965 dong va KHONG
-- cap nhat duoc dia_ban_id sang ma moi. Vi vay can 1 migration UPDATE rieng
-- de cap nhat dia_ban_id cho cac dong da ton tai san, khop theo ma_don_vi.
--
-- AN TOAN / IDEMPOTENT:
-- - Khop theo "ma_don_vi" (unique constraint uq_don_vi_ma) - moi cau UPDATE
--   chi anh huong toi da 1 dong.
-- - Dieu kien EXISTS (...) la BAT BUOC: neu dia_danh chua co dong voi ma moi
--   tuong ung (vi du moi truong nao do chua deploy migration T19) thi cau
--   UPDATE se KHONG chay (WHERE false), tranh truong hop subquery tra ve
--   NULL va set dia_ban_id = NULL - vi dia_ban_id la NOT NULL (va co FK toi
--   dia_danh), gan NULL se vi pham constraint va lam that bai ca migration.
-- - Dong nao co ma_don_vi khong ton tai trong don_vi_cong_tac (chua tung
--   duoc import) - UPDATE don gian khong anh huong dong nao, khong loi.
-- - Chay lai nhieu lan cho ket qua giong nhau (cung mot phep gan), nen
--   khong can ON CONFLICT hay dieu kien chan chay lai.
"""

    lines = [header_comment.rstrip("\n"), ""]
    for ma_don_vi, dia_ban_ma in pairs:
        ma_sql = sql_escape(ma_don_vi)
        dia_ban_sql = sql_escape(dia_ban_ma)
        lines.append(
            'UPDATE "don_vi_cong_tac" SET "dia_ban_id" = '
            f"(SELECT \"id\" FROM \"dia_danh\" WHERE \"ma\" = '{dia_ban_sql}'), "
            '"updated_at" = now() '
            f"WHERE \"ma_don_vi\" = '{ma_sql}' "
            f"AND EXISTS (SELECT 1 FROM \"dia_danh\" WHERE \"ma\" = '{dia_ban_sql}');"
        )

    OUT_SQL.parent.mkdir(parents=True, exist_ok=True)
    OUT_SQL.write_text("\n".join(lines) + "\n", encoding="utf-8")

    update_count = sum(1 for l in lines if l.startswith("UPDATE "))
    print(f"Da ghi {OUT_SQL}")
    print(f"So cau UPDATE sinh ra: {update_count}")


if __name__ == "__main__":
    main()
