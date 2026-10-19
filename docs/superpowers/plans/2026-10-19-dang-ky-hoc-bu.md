# Đăng ký học bù — Implementation Plan

> Spec: `docs/superpowers/specs/2026-10-19-dang-ky-hoc-bu-design.md` · ADR: `docs/adr/0012-dang-ky-hoc-bu.md`. Mỗi task: 1 subagent + 1 review.

## Global Constraints
- Migration duy nhất `20261019120000_hoc_bu` đúng SQL spec §1 (chỉ thêm). Mọi dòng cũ = `doi_buoi`; hành vi `doi_buoi` KHÔNG đổi (test cũ phải xanh nguyên).
- Mã lỗi mới `CHUA_DIEN_RA`, `DA_CO_MAT`, `DA_DOI_BUOI` (400) + thông điệp đúng spec §2; `KHOA_TAT`/`HET_LUOT` cho học bù dùng thông điệp học bù.
- Lượt tách theo loại (distinct buổi gốc, cho_duyet|da_duyet, cùng loại).
- Truy vấn cố định, không N+1; mọi kiểm tra ghi trong transaction sau advisory lock như đổi buổi.
- File cũ CRLF + nháy đơn: sửa tối thiểu, không prettier file cũ. Worktree `doi-buoi-hoc` có node_modules riêng (`prisma generate` an toàn), DB dev docker (`migrate deploy` được phép, không reset).
- Commit kết thúc `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`, push `docs/doi-buoi-hoc`, ghi rõ migration hay không.
- Test chạy đúng file, `--forceExit`, `vitest run`, timeout 5 phút.

## Review Focus
1. Đề nghị học bù bị duyệt khi học viên đã được ghi `co_mat` ở buổi gốc sau lúc gửi → phải 400 DA_CO_MAT (T1).
2. Sĩ số buổi gốc của học bù không bị trừ; buổi chốt được cộng (T2).
3. Lịch học viên: học bù THÊM buổi chốt, không thay buổi gốc; đổi buổi vẫn thay (T2).
4. Chốt vắng Zoom không bỏ qua học viên ở buổi gốc của học bù (T2).
5. Hai index unique theo (đăng ký, buổi gốc) chặn học bù khi buổi gốc đã có đổi buổi đã duyệt → 400 DA_DOI_BUOI chứ không 409/500 (T1).

## Task 1 — Migration, quy tắc, API lõi (backend)
Files: migration mới; `schema.prisma` (enum `loai_doi_buoi`, cột `loai`, `so_buoi_hoc_bu_toi_da`); `doi-buoi-hoc.rules.ts` (kiemTraGui/quyetDinhDuyet/soLuotDaDung theo spec §2); `doi-buoi-hoc.service.ts` (gửi/sửa/hủy/duyệt/từ chối/hủy duyệt/đổi lại với `loai`; tổng quan học viên thêm `so_buoi_hoc_bu_toi_da`, `so_luot_hoc_bu_da_dung`, `buoi_co_the_hoc_bu`; `lua-chon?loai=hoc_bu`; danh sách + đếm lọc `loai`; mỗi đề nghị có `loai`; nhật ký có `loai`); DTO (`loai` ở gửi, lọc); khóa DTO/select `so_buoi_hoc_bu_toi_da`; `docs/api-contract.md` §12.
Tests: rules bảng (mỗi mã mới, thứ tự, đổi buổi không đổi); service (đọc diem_danh buổi gốc trong tx, DA_CO_MAT lúc duyệt, lượt tách loại, DA_DOI_BUOI, tổng quan); `jest src/doi-buoi-hoc`.
Commit: "feat(hoc-bu): migration + quy tac + API (CO migration 20261019120000_hoc_bu, chi them)".

## Task 2 — Các chỗ đọc theo buổi + thống kê (backend)
Files: query service (trả `loai`; `siSoBuoi` không trừ ra học bù); `trang-lop`, `diem-danh` (nhãn "Học bù tại/từ"); `khoa-boi-duong.service` (`khoaHocTheoHocVienId`: học bù THÊM buổi, `hoc_bu`, `lich_goc_id`, `lop_goc_ten`, `lop_chot_ten`; `hoc_bu_duoc` trên buổi đã qua; khóa trả `so_buoi_hoc_bu_toi_da`; `resolveDiemDanhRow` không báo học bù ở buổi chốt với cả hai loại); `lichThucTe` (học bù = slot thêm); `chot-vang-zoom.processor` (không bỏ qua buổi gốc học bù); `vao-hoc-zoom`, `van-hanh-hoc-vien` báo vắng, `diem-danh suaO` (cho phép ở buổi chốt cả hai loại — xác nhận); `nap-chuyen-can`, `tinh-hinh-di-hoc` (như nhau — xác nhận + test); `nhac-lich` (buổi gốc không đổi với học bù); `thong-ke-doi-buoi` (lọc `loai[]`, tách số, cột Loại sheet Học viên).
Tests: 1 test nhánh `hoc_bu` mỗi nơi trong bảng spec §5; chạy đúng file từng module.
Commit: "feat(hoc-bu): cac man doc theo buoi + thong ke xu ly loai hoc_bu (khong migration)".

## Task 3 — Giao diện, e2e, tài liệu
Files: `frontend/src/api/doiBuoi.ts`, `api/types.ts`; `M7/ThongTinLopHoc.tsx`, `M3/TheBuoiSapToi.tsx` (link "Đăng ký học bù buổi này?", nhãn Học bù); `HocVien/DeNghiDoiBuoi.tsx` (`loai=hoc_bu`); `HoTro/DuyetDoiBuoi.tsx` (badge, "Buổi đã vắng", lọc Loại); `HoTro/ThongKeDoiBuoi.tsx` (lọc loại); `Admin/CauHinhDoiBuoi.tsx` (ô học bù); e2e `backend/test/doi-buoi-hoc.e2e-spec.ts` (kịch bản spec §7); hướng dẫn học viên + hỗ trợ + docx; runbook `docs/deploy/2026-10-19-hoc-bu.md` (migration chỉ thêm, backup, kiểm `\d doi_buoi_hoc`, đếm `loai`, rollback); ADR 0012 → Đã chấp nhận.
Tests: vitest các file trang + e2e 1 lần.
Commit: "feat(hoc-bu): giao dien + e2e + tai lieu (khong migration)".
