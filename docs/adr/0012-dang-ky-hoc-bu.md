# ADR 0012 — Học viên đăng ký học bù buổi đã vắng (dùng chung cơ chế đổi buổi)

- Ngày: 2026-10-19
- Trạng thái: Đề xuất
- Bổ sung: ADR 0007 (đổi buổi học) — mọi quyết định D1–D12 giữ nguyên cho `loai = doi_buoi`
- Đặc tả: [2026-10-19-dang-ky-hoc-bu-design.md](../superpowers/specs/2026-10-19-dang-ky-hoc-bu-design.md)

## Bối cảnh

Đổi buổi (ADR 0007) chỉ dùng được **trước** buổi học (buổi gốc chưa bắt đầu, chưa điểm danh — D2, D12). Học viên đã **vắng** một buổi hiện chỉ học bù được thủ công: người hỗ trợ nhắn học viên vào lớp khác rồi ghi điểm danh bằng import (cảnh báo "học bù", bắt buộc ghi chú). Học viên không tự đăng ký được, lịch không hiện buổi học bù, không bấm "Điểm danh & vào Zoom" ở lớp kia được, người hỗ trợ không kiểm soát sĩ số.

## Quyết định

| # | Quyết định |
|---|---|
| B1 | **Dùng chung bảng `doi_buoi_hoc`**, thêm cột `loai` (`doi_buoi` \| `hoc_bu`, mặc định `doi_buoi`). Học bù đi qua đúng cơ chế đổi buổi: hàng chờ, sĩ số buổi, advisory lock, đổi lại, hủy duyệt, thống kê, chuyên cần, trang lớp, Zoom, nhắc lịch. Bản ghi cũ = `doi_buoi`, không đổi nghĩa. |
| B2 | **Buổi gốc của học bù** = buổi của lớp được phân **đã bắt đầu** mà học viên **không có mặt**: không có dòng `diem_danh`, hoặc `trang_thai` ∈ {`vang`, `vang_co_phep`}. Có `co_mat` → không được học bù. (Ngược với D2/D12 của đổi buổi — chỉ áp cho `loai = hoc_bu`.) |
| B3 | **Buổi học bù** = buổi tương đương (cùng khóa, giai đoạn, `buoi_so`, `loai_lop`, `muc_nang_luc`, lớp khác, lớp đang hoạt động) **chưa bắt đầu**. Cảnh báo trùng lịch như ADR 0007. |
| B4 | **Lượt riêng**: `khoa_boi_duong.so_buoi_hoc_bu_toi_da` (mặc định 0 = tắt), độc lập `so_buoi_doi_toi_da`. Lượt = số buổi gốc khác nhau có học bù `cho_duyet`/`da_duyet`; từ chối/hủy trả lượt. |
| B5 | **Duyệt như đổi buổi** (Quản trị + hỗ trợ cụm, ADR 0007 D3–D6): cùng màn "Đổi buổi", badge **Học bù**, lọc theo loại. Hủy duyệt / đổi lại chỉ khi buổi học bù chưa bắt đầu và học viên chưa điểm danh buổi học bù (D12 áp cho buổi chốt). |
| B6 | **Không học bù buổi gốc đã có đổi buổi đã duyệt** (học viên vắng ở buổi chốt) — bản đầu chặn với thông báo "Buổi này đã được đổi, liên hệ người hỗ trợ". Một (đăng ký, buổi gốc) chỉ có một bản `cho_duyet` và một bản `da_duyet` bất kể loại (giữ 2 index unique hiện có). |
| B7 | **Sau khi duyệt**: buổi học bù hiện **thêm** trong lịch học viên (nhãn "Học bù", điểm danh/vào Zoom được); buổi gốc vẫn hiện trạng thái vắng như cũ (không thay). Trang lớp/bảng điểm danh lớp học bù: học viên vào mục đổi vào với nhãn "Học bù từ {lớp}". Chuyên cần: có mặt ở buổi học bù tính thay buổi gốc (cơ chế `doi_tu` sẵn có); không có mặt → vẫn vắng. Tự chốt vắng Zoom ở buổi học bù như học viên đổi vào. |
| B8 | **Lối vào kín đáo** như D9: dòng chữ nhỏ "Đăng ký học bù buổi này?" dưới buổi đã qua mà không có mặt (khi khóa bật học bù) + trang `/de-nghi-doi-buoi?loai=hoc_bu`. |

## Phương án đã loại

- **Bảng riêng `hoc_bu`** — nhân đôi toàn bộ hàng chờ, sĩ số, khóa, thống kê, chuyên cần; mọi màn đọc theo buổi phải gộp 2 nguồn.
- **Dùng chung lượt đổi buổi** — học viên đã đổi buổi trước đó sẽ hết lượt học bù dù vắng chính đáng.
- **Tự duyệt khi còn chỗ** — mất kiểm soát của người hỗ trợ cụm (người dùng không chọn).
- **Cho học bù khác hình thức (trực tiếp ↔ Zoom)** — điểm danh và chuyên cần phức tạp; để sau.

## Hệ quả

- 1 migration chỉ thêm: enum `loai_doi_buoi`, cột `doi_buoi_hoc.loai` (default `doi_buoi`), cột `khoa_boi_duong.so_buoi_hoc_bu_toi_da` (default 0). Sau deploy học bù **tắt** ở mọi khóa.
- Các màn đọc theo buổi không đổi cấu trúc — chỉ thêm nhãn theo `loai`. Chỗ nào xử lý buổi gốc như "đổi ra" phải bỏ qua bản `hoc_bu` (buổi gốc của học bù đã qua, không trừ sĩ số, không đổi lịch học viên — xem spec §5).
