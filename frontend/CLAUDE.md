# CLAUDE.md — Frontend Hệ thống thu thập thông tin học viên

> Đặt tại `frontend/CLAUDE.md`. Đọc kèm: `../docs/api-contract.md`, `../docs/validation-checklist.md`, `../docs/mo-rong-nls-an-giang.md`, `../docs/dac-ta-cong-hoc-vien.md` (đặc tả màn hình).

## Mục tiêu hiện tại

Cổng học viên cho khóa Bồi dưỡng năng lực số An Giang (~9.000 giáo viên), **phải chạy trước ngày mở đợt 1**, gồm trang giới thiệu công khai ở `/` (M0) làm cửa vào. Chỉ làm các màn hình trong `docs/dac-ta-cong-hoc-vien.md`, theo đúng thứ tự ưu tiên ghi ở đó. **Không** làm giao diện quản trị, Sở, Phòng, Trường ở giai đoạn này (quản trị dùng Swagger).

## Người dùng

- Giáo viên phổ thông, đa số **mở link từ Zalo trên điện thoại** (trình duyệt trong Zalo), mạng di động, không rành công nghệ.
- Hệ quả bắt buộc:
  - **Mobile-first**: thiết kế cho màn hình 360px trước; desktop là phụ.
  - Ô nhập lớn, nhãn rõ, không phụ thuộc hover, không popup mở cửa sổ mới, không tải file.
  - Chạy được trong trình duyệt nhúng của Zalo (không dùng API trình duyệt mới hoặc hiếm).
  - Tổng dung lượng JS lần tải đầu nhỏ (mục tiêu < 300 KB gzip), code-split theo route.

## Stack

- React 18 + TypeScript + Vite.
- React Router (data router).
- TanStack Query cho mọi lời gọi API (không tự viết cache).
- react-hook-form + zod cho form; schema zod **phản ánh đúng** `validation-checklist.md` để báo lỗi ngay khi nhập, nhưng **backend vẫn là nguồn quyết định** — luôn hiển thị lỗi `fields` mà API trả về.
- Mantine (core, form inputs, notifications, dates) — đủ component cho Select phụ thuộc, Autocomplete, TagsInput.
- @mantine/charts (đã duyệt 2026-09-30, dùng cho dashboard admin)
- dayjs (locale `vi`) cho hiển thị ngày giờ.

Không thêm thư viện ngoài danh sách trên nếu chưa hỏi.

## Cấu trúc thư mục

```
frontend/
  src/
    api/          # client fetch + type theo api-contract; mỗi dịch vụ 1 file (auth.ts, hocVien.ts, danhMuc.ts)
    auth/         # quản lý token, guard route, hook useToi()
    content/      # gioiThieu.ts — nội dung trang giới thiệu (M0), không chứa logic
    pages/        # 1 thư mục / màn hình theo mã màn hình trong đặc tả (M0..M6)
    components/   # thành phần dùng chung (FieldError, StatusBanner, SelectDiaDanh, SelectDonVi...)
    schemas/      # zod schema theo validation-checklist
    lib/          # tiện ích: chuẩn hóa NFC, định dạng ngày, map lỗi API → field
```

## Quy ước gọi API

- Base URL lấy từ `import.meta.env.VITE_API_BASE_URL`.
- Mọi request có `Authorization: Bearer <token>` (trừ đăng nhập, kiểm tra trùng CCCD).
- Lỗi theo dạng `{ error: { code, message, fields: [{ field, message }] } }`:
  - `VALIDATION_ERROR` → gắn `fields[].message` vào đúng ô (tên field backend = tên field form, giữ nguyên snake_case).
  - `UNAUTHORIZED` → xóa token, về màn đăng nhập, giữ lại thông báo "Phiên đăng nhập đã hết hạn".
  - `FORBIDDEN` với code `DOT_XAC_NHAN_DONG` → thông báo "Đã hết thời gian chỉnh sửa", chuyển form sang chế độ chỉ xem.
  - `ACCOUNT_LOCKED` (423) → hiện thời điểm mở khóa theo giờ Việt Nam.
  - 429 → "Bạn đã thử quá nhiều lần. Vui lòng chờ 1 phút rồi thử lại.".
  - `CONFLICT` ở CCCD → "Số CCCD này đã được dùng cho một hồ sơ khác. Liên hệ hỗ trợ." (không tiết lộ hồ sơ kia).
- Thời gian từ API là UTC ISO 8601 → luôn hiển thị theo `Asia/Ho_Chi_Minh`, định dạng `dd/mm/yyyy HH:mm`.

## Token & bảo mật

- Lưu token trong **bộ nhớ + `sessionStorage`** (mất khi đóng tab). Không dùng `localStorage`, không cookie tự đặt.
- Đăng xuất: gọi `POST /auth/dang-xuat` rồi xóa token.
- Khi `phai_doi_mat_khau=true`: mọi route (trừ đổi mật khẩu, đăng xuất) chuyển hướng về M2.
- **Không bao giờ** log token, mật khẩu, CCCD, hoặc mật khẩu VLE ra console hay gửi tới dịch vụ bên ngoài. Không dùng analytics bên thứ ba.
- Mật khẩu VLE (M6) chỉ hiển thị khi người dùng bấm "Hiện", không lưu vào state toàn cục, không cache TanStack Query (`gcTime: 0`).

## Nội dung trang giới thiệu (M0)

- Mọi nội dung về chương trình nằm trong `src/content/gioiThieu.ts` (bản nội dung tạm đã có sẵn). **Không tự thêm** số liệu, mô-đun, văn bản pháp lý hay **tên tỉnh** — trang dùng chung cho nhiều tỉnh.
- Không sửa nội dung trong component; chỉ sửa file nội dung.

## Ngôn ngữ & định dạng

- Toàn bộ giao diện tiếng Việt có dấu, xưng hô "Thầy/Cô".
- Chuẩn hóa `normalize('NFC')` mọi chuỗi trước khi gửi.
- Ngày sinh nhập 3 ô Ngày / Tháng / Năm (khớp dữ liệu MOET), không dùng date picker.
- Số: không phân tách hàng nghìn cho CCCD, SĐT, mã MOET.

## Kiểm thử

- Vitest + Testing Library cho component/form; MSW giả lập API theo `api-contract.md`.
- Mỗi màn hình có test cho: trạng thái tải, lỗi field từ API, trạng thái chỉ xem khi đợt đóng.
- Kiểm tra thủ công trên điện thoại thật qua trình duyệt Zalo trước khi phát hành.

## Khi gặp mâu thuẫn

`docs/` là nguồn sự thật. Nếu đặc tả màn hình và `api-contract.md` khác nhau, **dừng lại và hỏi**, không tự đoán.
