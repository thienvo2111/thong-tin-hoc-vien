# ADR 0004 — Người hỗ trợ giảng viên, phân vai vận hành, Hồ sơ chuẩn bị lớp, Cổng giảng viên, Tin nhắn nhắc lịch

- Ngày: 2026-10-06
- Trạng thái: **Đề xuất** — Q1–Q7 đã chốt 2026-10-06; còn Q8 (chờ mẫu HCMUE)
- Đặc tả: [`docs/superpowers/specs/2026-10-06-ho-tro-giang-vien-design.md`](../superpowers/specs/2026-10-06-ho-tro-giang-vien-design.md)
- Liên quan: ADR 0003 (mẫu `ho_tro_<doi_tuong>`), T10 #2 (`diem_hoc`), T11 #3 (`giang_vien`, `phan_cong_giang_day`, **QĐ5**), T12 (điểm danh/kết quả), T8 #1 (thông báo hàng loạt)

## Bối cảnh

Các đợt học **trực tiếp** ở tỉnh cần HCMUE chuẩn bị nhiều thứ cho giảng viên: điểm học, danh sách điểm danh, danh sách nhập điểm, chỗ ở, phương tiện, người hỗ trợ thực địa. Hiện tất cả nằm ngoài hệ thống (Excel/Zalo) và **mọi thay đổi dữ liệu vận hành đều dồn về Quản trị** (lịch, điểm học, giảng viên, phân lớp, điểm danh, kết quả). Yêu cầu: vai trò hỗ trợ giảng viên, giảng viên xem theo lớp, liên thông với Người hỗ trợ học viên, nhắc lịch, và **giảm tải cho Quản trị**.

Hiện trạng code (2026-10-06): chưa có `giang_vien`, `phan_cong_giang_day`, `diem_hoc`; giảng viên của lớp chỉ là text trong `lop_hoc_nhan_su`. QĐ5 (T11) chốt không làm cổng giảng viên.

## Nguyên tắc phân vai (chốt Q2)

| Vai trò | Vai | Một câu |
|---|---|---|
| **Quản trị** | **Thiết lập + chốt** | Dựng cấu trúc (khóa, giai đoạn, lớp, cụm, phân lớp hàng loạt), cấp tài khoản cán bộ, cấu hình theo khóa (bảng kiểm, mẫu biểu); chốt việc có hệ quả pháp lý/tài chính (kết quả cuối khóa, xác nhận giờ dạy, chứng nhận, duyệt hồ sơ). **Giám sát** thay vì làm thay. |
| **Người hỗ trợ giảng viên** (nhóm theo khóa) | **Vận hành lớp/đợt** | Mọi thứ thuộc buổi học: giờ, điểm học, giảng viên, hậu cần, thực địa, điểm danh, kết quả giai đoạn, nhắc giảng viên; duyệt đề nghị đổi lớp. |
| **Người hỗ trợ học viên** (theo cụm) | **Vận hành con người** | Hồ sơ, tài khoản, hỏi đáp (ADR 0003), **báo vắng**, **đề nghị đổi lớp**, nhắc lịch nhóm Zalo cụm. |
| **Giảng viên** | Chỉ đọc | Lịch dạy, trang lớp, hậu cần của mình, biểu mẫu. |

Leo thang: Người hỗ trợ học viên → Người hỗ trợ giảng viên (việc của lớp) → Quản trị (cấu trúc/cấu hình/chốt). Mọi thao tác vận hành ghi `nhat_ky_hoat_dong`; thay đổi dữ liệu đã công bố (lịch) **bắt buộc lý do**.

## Quyết định

| # | Quyết định |
|---|---|
| G1 | **Tiên quyết:** T10 và T11 làm trước, **sửa 2 issue** theo G12 (quyền ghi không còn "chỉ quản trị") và G8 (bỏ QĐ5 phần đăng nhập). |
| G2 | Vai trò **`ho_tro_giang_vien`** — cán bộ HCMUE, `don_vi_id`/`hoc_vien_id` NULL, email bắt buộc, cấp ở `/admin/nguoi-ho-tro` (lọc theo loại). 1 tài khoản = 1 vai trò. |
| G3 | (Q1) **Nhóm hỗ trợ GV theo khóa**: `phan_cong_ho_tro_gv (nguoi_dung_id, khoa_id)`. `HoTroGiangVienScopeService` chỉ lộ API cấp **lớp** (`lopIdsCuaToi`, `whereLopTrongPhamVi`, `damBaoLopTrongPhamVi`, `damBaoKhoaTrongPhamVi`); không nơi nào khác đọc thẳng bảng phân công → thu hẹp về lớp sau này = thêm `lop_id NULL` + sửa đúng service này. Kiểm tra động mỗi request, ngoài phạm vi → 404. |
| G4 | (Q4) **Người hỗ trợ thực địa** theo **đợt – lớp**: bảng `nhan_su_thuc_dia (lop_id, giai_doan_id, ho_ten, so_dien_thoai, nhiem_vu, ghi_chu)`, không tài khoản. Khác trợ giảng `lop_hoc_nhan_su.ho_tro`. |
| G5 | **Hồ sơ chuẩn bị lớp** = 1 trang / (lớp × giai đoạn `truc_tiep`): lịch + điểm học, giảng viên, hậu cần (`hau_can_giang_vien`), thực địa, biểu mẫu, bảng kiểm, nhật ký nhắc. |
| G5b | **Bảng kiểm động theo khóa**: bộ mặc định hệ thống, khóa "Tùy chỉnh" = sao chép rồi sửa (mẫu `cau_hinh_khao_sat_khoa`). Mục **tự động** (chọn quy tắc trong danh mục code) hoặc **thủ công** (đánh dấu + ghi chú), có hạn `N ngày trước buổi đầu`. Quản trị cấu hình. |
| G6 | (Q7) **Mẫu biểu do Quản trị tải lên theo từng khóa** (`mau_bieu_khoa`, file `.xlsx` lưu cột `Bytes`, ≤ 2 MB, 1 mẫu đang dùng / loại / khóa; "Sao chép từ khóa khác"). Mẫu đánh dấu chỗ điền bằng **ký hiệu `{{...}}`** trong ô; hệ thống kiểm tra ký hiệu khi tải lên (ký hiệu lạ → 400), điền dữ liệu giữ nguyên định dạng (`exceljs`). Khóa chưa có mẫu → không có nút tải, cảnh báo cho Quản trị. |
| G7 | **Nạp lại** dùng chính vị trí ký hiệu của mẫu khóa: dòng định danh bằng **cột khóa nội bộ** (`{{hv.ma_noi_bo}}` = id ghi danh, Quản trị nên ẩn cột) — **không** dùng CCCD/tên đăng nhập (giảng viên cũng tải mẫu). Người hỗ trợ GV nạp, chỉ lớp trong phạm vi; ghi bằng phần upsert của import T12. Giảng viên không nạp (Q3). |
| G8 | **Đảo một phần QĐ5:** vai trò **`giang_vien`** chỉ đọc, `nguoi_dung.giang_vien_id`. Phạm vi = lớp có ≥1 `phan_cong_giang_day` của mình. Tài khoản do **người hỗ trợ GV gửi link kích hoạt** (cho GV dạy trong khóa mình) hoặc Quản trị; chỉ Quản trị khóa tài khoản. |
| G9 | **Trang lớp dùng chung**, lọc trường theo vai trò (ma trận đặc tả §3). Hỗ trợ HV thấy điểm học/thực địa/hỗ trợ GV của lớp; hỗ trợ GV thấy cụm + người hỗ trợ HV; giảng viên không thấy SĐT/email/CCCD/ngày sinh học viên; chỉ hỗ trợ GV/QT/GV đó thấy hậu cần. |
| G10 | (Q5, Q6) **Nhắc lịch = tin nhắn soạn sẵn, không gửi email, không cron.** Hệ thống sinh nội dung (giảng viên: lịch + điểm học + hậu cần + thực địa; cụm học viên: buổi sắp tới theo lớp), cán bộ sao chép gửi qua Zalo/SMS rồi bấm **"Đã gửi"** → ghi `nhat_ky_nhac_lich` (ảnh chụp nội dung). Mốc nhắc **không cố định trong code**: là mục bảng kiểm tự động `da_nhac_giang_vien` với hạn do khóa đặt. Email nhắc = để sau (bảng nhật ký đã đủ để thêm cron khi cần). |
| G11 | **Đổi lịch sau khi đã nhắc → "Cần nhắc lại"**: so `lich_hoc_lop.cap_nhat_luc` với lần nhắc cuối; hiện cờ ở Việc cần làm của hỗ trợ GV (giảng viên) **và** ở Lịch học của hỗ trợ HV (các cụm có học viên trong lớp). |
| G12 | (Q2) **Quyền vận hành của người hỗ trợ GV** (trong khóa của nhóm): sửa **giờ / điểm học / phòng** của buổi chưa diễn ra (bắt buộc lý do; buổi đã có điểm danh → 400); **tạo/sửa** điểm học và giảng viên trong danh mục (Quản trị ngưng/gộp trùng); **phân công giảng viên vào buổi** (giữ luật chống trùng giờ T11); nạp điểm danh/kết quả giai đoạn; duyệt đề nghị đổi lớp. **Giữ cho Quản trị:** tạo/xóa lớp, thêm/xóa buổi, phân lớp/ghi danh/cụm hàng loạt, xác nhận giờ dạy, kết quả cuối khóa (`ket_qua`, `muc_dau_ra`), cấu hình bảng kiểm + mẫu biểu. |
| G13 | (Q2) **Báo vắng**: người hỗ trợ HV ghi báo vắng cho học viên cụm mình trước/trong đợt (`bao_vang (dang_ky_hoc_id, lich_hoc_id, ly_do, nguoi_ghi)`); hiện trên trang lớp + điền sẵn "Vắng có phép" trong mẫu điểm danh; khi nạp, `vang` + có báo vắng → `vang_co_phep`, `co_mat` luôn thắng. |
| G14 | (Q2) **Đề nghị đổi lớp** (cùng giai đoạn): người hỗ trợ HV tạo cho học viên cụm mình (lý do bắt buộc) → nhóm hỗ trợ GV của khóa **duyệt/từ chối** (UPDATE có điều kiện `cho_duyet`, như H11; vượt `si_so_toi_da` → cảnh báo, vẫn duyệt được) → duyệt = cập nhật `phan_lop_giai_doan` + nhật ký. Phân lớp hàng loạt vẫn là import của Quản trị. |
| G15 | (Q2) **Quản trị giám sát**: màn "Vận hành" — đợt đỏ, đề nghị chờ > 48 giờ, thay đổi lịch 7 ngày qua (ai, lý do), khóa/cụm chưa có người hỗ trợ, khóa chưa có mẫu biểu. |

## Hệ quả

- Migration (chỉ thêm): enum vai trò `ho_tro_giang_vien`, `giang_vien` — mỗi giá trị 1 migration riêng; enum mới tạo cùng bảng: `loai_muc_kiem_tra`, `loai_mau_bieu`, `trang_thai_de_nghi`, `doi_tuong_nhac`. Bảng: `phan_cong_ho_tro_gv`, `muc_kiem_tra`, `trang_thai_muc_kiem_tra`, `hau_can_giang_vien`, `nhan_su_thuc_dia`, `mau_bieu_khoa`, `nhat_ky_nhac_lich`, `bao_vang`, `de_nghi_doi_lop`. Cột: `nguoi_dung.giang_vien_id`, `lich_hoc_lop.cap_nhat_luc`, `diem_hoc.tao_boi`, `giang_vien.tao_boi`.
- **Không** cần cron, enum sự kiện email hay NTP cho tính năng này (bỏ khỏi bản trước).
- Mọi nơi cập nhật `lich_hoc_lop` (import `lop_va_lich_hoc`, sửa tay QT, sửa của hỗ trợ GV) phải set `cap_nhat_luc` — gom vào 1 hàm.
- Phân quyền ghi T10/T11 đổi từ "chỉ `quan_tri`" sang "`quan_tri` + `ho_tro_giang_vien` trong khóa" cho các thao tác ở G12.

## Rủi ro / giới hạn

- Tài khoản hỗ trợ GV bị lộ → sửa được lịch cả khóa; giảm thiểu: lý do bắt buộc, nhật ký, màn giám sát G15, Quản trị khóa ngay.
- `exceljs` có thể làm mất một số thành phần của mẫu (ảnh logo, định dạng có điều kiện) → kiểm thử với mẫu thật trước khi chốt L4; nếu mất, yêu cầu mẫu không dùng thành phần đó.
- Nhắc lịch phụ thuộc người bấm "Đã gửi" — hệ thống chỉ biết đã nhắc khi cán bộ xác nhận.
- Giảng viên tải mẫu có cột khóa nội bộ (uuid) — không phải dữ liệu cá nhân.

## Câu hỏi

- ~~Q1~~ Nhóm theo khóa, giữ điểm mở rộng về lớp (G3). ~~Q2~~ Phân vai G12–G15. ~~Q3~~ Giảng viên không nạp. ~~Q4~~ Thực địa theo đợt – lớp (G4). ~~Q5~~ Tin nhắn nhắc, chưa email (G10). ~~Q6~~ Không email học viên. ~~Q7~~ Mẫu theo từng khóa, Quản trị tải lên (G6).
- **Q8** (khi có mẫu) Mẫu nhập điểm có **nhiều cột điểm thành phần** không? `ket_qua_giai_doan` hiện chỉ có `diem`, `ty_le_hoan_thanh`, `ghi_chu` — nếu có thì thêm `diem_thanh_phan jsonb` và ký hiệu `{{kq.tp.<ma>}}`.
