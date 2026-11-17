# Nghiên cứu: chạy thêm một tên miền (cổng HSG) trên cùng hệ thống

- Ticket: #50 (map #43). Ngày: 2026-11-17. Chỉ đọc code, không sửa app, không đụng VPS.
- Câu hỏi: phục vụ cổng trường/quản trị của chương trình Bồi dưỡng HSG ở **tên miền riêng**, dùng chung backend + DB + bản build frontend với `boiduongnls.hcmue.edu.vn`. Cần đổi gì ở nginx/TLS, CORS, cookie/JWT, URL tuyệt đối (email, SSO, Zalo), và frontend đổi giao diện/route theo hostname.
- Tên miền HSG chưa có; dưới đây gọi tạm là `HSG_DOMAIN`.

## Tóm tắt

1. **Không có cookie, không có refresh token** → không có việc gì về SameSite/`Domain`. Đăng nhập là JWT Bearer lưu `sessionStorage` (theo origin) → mỗi tên miền đăng nhập riêng, tự nhiên tách biệt.
2. **TLS không nằm trên VPS**: terminate ở proxy HCMUE (10.0.197.1). Phần việc chặn đường găng là **IT HCMUE**: DNS + chứng chỉ + ánh xạ `HSG_DOMAIN` → NAT 2464 → VPS:80, và **giữ nguyên header `Host`**.
3. **Nginx**: thêm 1 `server` block thứ hai (cùng `root`, cùng các `location` proxy API), khác `server_name` và file HTML entry. Vài chục dòng trong `05-install-nginx.sh`.
4. **Bẫy lớn nhất**: build frontend production đang **nhúng cứng** `VITE_API_BASE_URL=https://boiduongnls…` → trang trên `HSG_DOMAIN` sẽ gọi API chéo origin sang tên miền NLS. Cách đơn giản nhất: để `VITE_API_BASE_URL` **rỗng** (gọi tương đối, cùng origin) → CORS không còn liên quan.
5. **Backend chỉ có một `FRONTEND_URL`** dùng cho 13 chỗ dựng link email; khung email gắn cứng thương hiệu "Bồi dưỡng Năng lực số". Link quên mật khẩu/kích hoạt tài khoản trường cho HSG cần chọn đúng tên miền → thêm `FRONTEND_URL_HSG` + chọn theo ngữ cảnh (không tin `Host` thô).
6. **Frontend**: một module `cauHinhCong` đọc `window.location.hostname` → tiêu đề, logo/tên chương trình, danh sách route cho phép, trang chủ theo vai trò. Meta Open Graph (Zalo xem trước link) là tĩnh lúc build → cần **entry HTML thứ hai** (Vite multi-page) để link `HSG_DOMAIN` gửi qua Zalo không hiện "Bồi dưỡng năng lực số".
7. Ước lượng: **~3–4 ngày dev** (+ test) + thời gian chờ IT HCMUE (không kiểm soát được).

---

## 1. Hạ tầng: nginx, TLS, NAT

### Hiện trạng (code)

- `scripts/vps/00-config.sh:10` — `DOMAIN="boiduongnls.hcmue.edu.vn"`, một biến duy nhất; `:14-25` VPS sau NAT HCMUE, nginx nghe **80** thật, ngoài vào qua 2464. `:67-72` HSTS không `includeSubDomains`.
- `scripts/vps/05-install-nginx.sh:1-6` — **không cài certbot/SSL**: TLS terminate ở proxy trung tâm HCMUE.
- `05-install-nginx.sh:29` — file site đặt tên theo `${DOMAIN}`; `:33-81` một `server {}` duy nhất: `server_name ${DOMAIN}` (`:36`), `root ${WEB_ROOT}`, `location ~ ^/(api|auth|…|doi-buoi-hoc)` proxy về `127.0.0.1:3000` (`:52-61`, đặt `Host $host`, chuyển tiếp `X-Forwarded-Proto`), SPA `try_files … /index.html` (`:64-66`), `index.html` no-cache (`:70-73`).
- `05-install-nginx.sh:84` — xóa site `default` → server block NLS hiện là **default server ngầm định** của cổng 80, nên **mọi** `Host` (kể cả `HSG_DOMAIN` nếu IT trỏ vào) hiện đều rơi vào giao diện NLS.
- `scripts/vps/06-deploy.sh:78-93` — kiểm tra đủ prefix proxy trong `/etc/nginx/sites-available/${DOMAIN}`; `backend/src/nginx-prefix.spec.ts:27-37` đọc regex `location ~ ^/(...)` **đầu tiên** trong `05-install-nginx.sh`.

### Nguồn chính

- nginx chọn server theo header `Host` trong số các server cùng `listen`; không khớp `server_name` (hoặc thiếu `Host`) → về **default server** của cổng đó (mặc định là server đầu tiên, hoặc khai báo `default_server`). `server_name ""` + `return 444` để đóng kết nối không có Host. — https://nginx.org/en/docs/http/request_processing.html

### Cần đổi

1. `00-config.sh`: thêm `DOMAIN_HSG=""` (trống = không tạo block HSG — không phá cài đặt hiện tại).
2. `05-install-nginx.sh`: sinh **server block thứ hai** `server_name ${DOMAIN_HSG}`, cùng `root ${WEB_ROOT}`, **cùng** `location` proxy API (để gọi API tương đối, xem §2), SPA fallback trỏ về entry HTML riêng: `try_files $uri $uri/ /hsg.html;` + `location = /hsg.html` no-cache + HSTS.
   - Giữ block NLS là `listen 80 default_server` rõ ràng (hành vi hiện tại giữ nguyên: Host lạ vẫn vào NLS — never break userspace).
   - Để `nginx-prefix.spec.ts` và cảnh báo của `06-deploy.sh` vẫn đúng: lặp lại **đúng một chuỗi** prefix — gọn nhất là gán prefix vào biến shell `API_PREFIX=…` rồi dùng trong cả 2 heredoc, **nhưng** spec đang regex literal `location ~ \^\/\(([^)]+)\)` trên file script → phải sửa spec đọc biến, hoặc đơn giản lặp literal ở cả 2 block (spec bắt block đầu; thêm 1 assert 2 block giống nhau).
3. `06-deploy.sh:155`: reload nginx đã có; không cần đổi.

### Phụ thuộc bên ngoài (IT HCMUE) — đường găng

- DNS `HSG_DOMAIN` → IP public của gateway HCMUE; chứng chỉ TLS cho `HSG_DOMAIN` **trên proxy HCMUE** (VPS không có cert).
- Proxy HCMUE map `HSG_DOMAIN` → cùng backend VPS (NAT 2464 → :80) **và giữ `Host` gốc**. Hiện chưa có bằng chứng proxy giữ `Host`: hệ thống chạy được dù Host bị đổi vì block NLS là default. **Phải kiểm chứng** (vd. log `$host` trong access log nginx sau khi IT bật domain) trước khi tin vào định tuyến theo `server_name`. Nếu proxy ghi đè Host → cần IT gửi `X-Forwarded-Host` hoặc tách cổng NAT riêng.
- Nếu tên miền **không** thuộc `hcmue.edu.vn` (mua ngoài), vẫn phải qua proxy HCMUE (VPS không có IP public/cổng 443) → IT phải nhận cert ngoài. Nên xin subdomain `*.hcmue.edu.vn` để khỏi vướng.

## 2. API base URL và CORS

### Hiện trạng

- `frontend/src/api/client.ts:20,40` — `BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''`, mọi request `fetch(BASE_URL + path)` kèm `Authorization: Bearer` (`:33-36`), không `credentials`.
- `scripts/vps/06-deploy.sh:130-131` — lần đầu tạo `frontend/.env` đặt `VITE_API_BASE_URL=https://${DOMAIN}` và `VITE_SITE_URL=https://${DOMAIN}`. Biến `VITE_*` được thay **tĩnh lúc build** → một bản build duy nhất gọi API tuyệt đối về tên miền NLS.
- `backend/src/main.ts:36-43` — `app.enableCors({ origin: CORS_ORIGIN.split(',') })`; production thiếu biến → chặn hết. `06-deploy.sh:53` đặt `CORS_ORIGIN=https://${DOMAIN}`.
- `frontend/src/pages/Admin/TheThuSso.tsx:23` — `VITE_API_BASE_URL || window.location.origin` (chỉ để hiển thị lệnh curl mẫu).

### Nguồn chính

- `cors` (Nest `enableCors` truyền thẳng option xuống package này — https://docs.nestjs.com/security/cors): `origin` nhận mảng String/RegExp; `allowedHeaders` mặc định phản chiếu `Access-Control-Request-Headers`; `exposedHeaders` mặc định **không** lộ header tùy biến. — https://github.com/expressjs/cors#configuration-options
- Request cùng origin không qua cơ chế CORS. — https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CORS

### Hai phương án

| | A. API tương đối (khuyên dùng) | B. Giữ URL tuyệt đối NLS |
|---|---|---|
| Đổi | `frontend/.env` trên VPS: `VITE_API_BASE_URL=` (rỗng) → `fetch('/auth/…')` cùng origin | `CORS_ORIGIN=https://boiduongnls…,https://HSG_DOMAIN` |
| CORS | Không dùng tới | Mỗi request có `Authorization` → preflight OPTIONS |
| Rủi ro | Cần block HSG có đủ `location` proxy API (§1) | Cổng HSG chết theo tên miền NLS; download Excel đọc tên file từ `Content-Disposition` sẽ mất (cần `exposedHeaders`) |

Phương án A khiến `CORS_ORIGIN` chỉ còn ý nghĩa cho dev; vẫn nên thêm `https://HSG_DOMAIN` vào `CORS_ORIGIN` cho chắc (vô hại). Lưu ý `06-deploy.sh` **không** sửa `.env` đã tồn tại → người vận hành phải tự sửa `frontend/.env` trên VPS rồi build lại.

## 3. Cookie / JWT / refresh token

- **Không có cookie**: không có `res.cookie`, `cookie-parser` trong `backend/src`; frontend không gửi `credentials`. Chỉ nhắc "cookie" ở chú thích VLE (`backend/src/sso/vle.service.ts:26-31`, `frontend/src/lib/guiFormVle.ts:1-4`) — đó là cookie của **VLE**, không phải của ta.
- **Không có refresh token**: JWT một loại, hạn `JWT_EXPIRES_IN` mặc định `8h` (`backend/src/auth/auth.module.ts:32`); thu hồi qua bảng `token_thu_hoi`.
- Token lưu bộ nhớ + `sessionStorage` khóa `chv_token` (`frontend/src/auth/tokenStore.ts:1-33`). `sessionStorage` cô lập theo origin (https://developer.mozilla.org/en-US/docs/Web/API/Window/sessionStorage) → đăng nhập ở NLS **không** mang sang HSG và ngược lại. Không cần SameSite/`Domain`.
- JWT không có `aud`/`iss` → token cấp ở tên miền này hợp lệ ở tên miền kia (cùng `JWT_SECRET`). Chấp nhận được vì cùng hệ thống, cùng quyền. Gắn `aud` theo tên miền là YAGNI.
- `localStorage` dùng cho tiện ích (`frontend/src/lib/kieuDangNhap.ts:10,18`, `TrangGioiThieu.tsx:711,719`, `pages/M3/capNhatMoi.ts:47,56`) — cũng tách theo origin, vô hại.

## 4. Mọi chỗ dựng URL tuyệt đối / thương hiệu từ một tên miền

### Backend — link trong email (đều qua `layFrontendUrl()`)

`backend/src/common/utils/token-xac-thuc.util.ts:20-22` — `process.env.FRONTEND_URL ?? 'http://localhost:5173'` (một giá trị; `06-deploy.sh:56` đặt `https://${DOMAIN}`). Nơi gọi:

| File:dòng | Link | Ai nhận | Cần theo HSG? |
|---|---|---|---|
| `auth/auth.service.ts:419` (`quenMatKhau` `:345` → `taoVaGuiTokenDatLaiMatKhau` `:376`) | `/dat-lai-mat-khau` học viên | học viên | Không (học viên chỉ ở NLS) |
| `auth/auth.service.ts:477` (`taoVaGuiTokenDatLaiMatKhauNguoiDung` `:460`) | `/dat-lai-mat-khau` tài khoản người dùng | **trường/Sở/Phòng/quản trị** | **Có** — trường bấm "Quên mật khẩu" trên `HSG_DOMAIN` nên nhận link `HSG_DOMAIN` |
| `nguoi-dung/tai-khoan-don-vi.service.ts:357` | kích hoạt tài khoản đơn vị | **trường** | **Có** — tùy trường được cấp cho HSG hay NLS |
| `nguoi-dung/tai-khoan-ho-tro.service.ts:300` | kích hoạt người hỗ trợ | hỗ trợ NLS | Không |
| `giang-vien/tai-khoan-giang-vien.service.ts:131` | kích hoạt giảng viên | GV NLS | Không (GV HSG không có tài khoản — #43) |
| `hoc-vien/hoc-vien.service.ts:1298` | `/xac-minh-email` | học viên | Không |
| `nhac-lich/email-lich-day.service.ts:392` | `/giang-day` | GV | Không |
| `thong-bao/thong-bao.service.ts:140,186,289,333,370,411` | `/toi/...` | học viên | Không |

Chỗ chạm thật sự cho HSG: **2 luồng** (đặt lại mật khẩu tài khoản người dùng, kích hoạt tài khoản đơn vị) + **email mới** của tính năng hợp đồng (nhắc trường xác nhận danh sách / khai hợp đồng) sẽ viết sau.

Lưu ý: tài khoản `truong` **dùng chung** cho cả 2 chương trình (ADR 0002, #43 "không thêm vai trò") → không thể suy tên miền từ tài khoản. Chọn theo **ngữ cảnh**:

- Quên mật khẩu: theo tên miền người dùng đang đứng. `POST /auth/quen-mat-khau` (`auth/auth.controller.ts:67`) hiện không nhận `Request`. Express `req.hostname` lấy `Host`, hoặc `X-Forwarded-Host` khi `trust proxy` bật (production đang bật: `main.ts:34`, `TRUST_PROXY=loopback,10.0.197.1`) — header này **do client đặt được** (https://expressjs.com/en/4x/api/request.html#req.hostname). → **Không** dựng link từ Host thô (lỗ hổng kinh điển "host header injection" trong email đặt lại mật khẩu). Làm: so `req.hostname` với **allow-list** `{FRONTEND_URL, FRONTEND_URL_HSG}`; không khớp → `FRONTEND_URL`. An toàn hơn nữa: FE gửi field `cong: 'hsg' | 'nls'` trong body, backend map sang URL từ env (không bao giờ nhận URL từ client).
- Kích hoạt tài khoản đơn vị / email hợp đồng: quản trị hoặc tính năng biết chương trình → truyền `cong` tường minh.
- Thêm `FRONTEND_URL_HSG` vào `backend/.env.example` (cạnh `:21`) + `06-deploy.sh` (cạnh `:56`); trống → mọi thứ như cũ.

### Backend — thương hiệu email (gắn cứng NLS)

- `thong-bao/mau-email/bo-cuc.ts:27-31` `LIEN_HE` (website `https://boiduongnls.hcmue.edu.vn`, email `boiduongnls@hcmue.edu.vn`), `:144` header "Bồi dưỡng Năng lực số", `:156` chữ ký "Ban Tổ chức chương trình Bồi dưỡng Năng lực số", `:161-162` chân trang.
- `thong-bao/mau-email/mau-email.ts:126,162` tiền tố tiêu đề `[BDNLS]`/`[HCMUE-BDNLS]`; `:110,149` thân thư "Cổng thông tin Bồi dưỡng Năng lực số".
- `thong-bao/util/mailer.util.ts:131` tên người gửi `SMTP_FROM_NAME` (ví dụ `.env.example:70` "Bồi dưỡng NLS – HCMUE") — một giá trị cho mọi thư.
- → `boCucEmail` cần tham số `thuongHieu` (tên chương trình, website, chữ ký); 2 mẫu kích hoạt/đặt lại nhận `cong`. Tên người gửi: chấp nhận trung tính ("HCMUE") hoặc giữ nguyên — quyết định sản phẩm, không phải kỹ thuật.

### SSO

- Khảo sát (`backend/src/sso/sso.service.ts:27,124`, `ket-qua-khao-sat.service.ts:30`): URL đích là máy chủ khảo sát; máy chủ khảo sát gọi ngược `/sso/doi-ma`, `/sso/ket-qua` (`sso.controller.ts:64,72`) qua tên miền **NLS** đã cấu hình phía họ. Chỉ học viên dùng → **không đổi**, miễn tên miền NLS giữ nguyên.
- VLE (`backend/src/sso/vle.service.ts:39,93,166,199`; `frontend/src/lib/guiFormVle.ts`): form POST top-level từ trình duyệt sang VLE; không có callback về ta. Học viên dùng → không đổi. Nút "Thử vào VLE" của quản trị (`sso.controller.ts:146`) bấm từ `HSG_DOMAIN` có thể bị VLE từ chối nếu VLE kiểm `Origin/Referer` — **không xác minh được** (code VLE của P.CNTT); quản trị dùng trên tên miền NLS là đủ. HSG không có VLE (#43 Out of scope).

### Zalo

- Tin nhắn Zalo dựng ở `backend/src/nhac-lich/nhac-lich.service.ts` (`:343` tin nhóm cụm) và `frontend/src/components/ModalTinNhanNhac.tsx` chỉ chứa link lớp/Zoom (`dia_diem_hoac_link`) và nhóm Zalo — **không** chứa tên miền cổng. Không đổi.
- Tên miền NLS gõ cứng trong **nội dung hướng dẫn**: `frontend/src/content/huongDan.ts:98,189,370,373,550,799,924,934,935`, `huongDanQuanTri.ts:61`, `gioiThieu.ts:361`, `hoTro.ts:2` (`EMAIL_HO_TRO`). Đây là trang NLS → giữ; trang HSG cần nội dung hướng dẫn riêng (hoặc ẩn `/huong-dan`).

## 5. Frontend: đổi giao diện / route theo hostname

### Hiện trạng

- `frontend/index.html:6-12` — `<title>` + `og:*` là placeholder; `frontend/vite.config.ts:9-26` plugin `metaTuNoiDung` thay lúc build từ `src/content/gioiThieu.ts:57-` (`tieuDe: 'Bồi dưỡng năng lực số cho giáo viên'`) và `VITE_SITE_URL`. Zalo/Facebook **không chạy JS** khi xem trước link (chú thích `vite.config.ts:7-8`) → đổi `document.title` bằng JS **không đủ** cho link preview.
- `frontend/src/router.tsx:6-317` — một cây route: `/` trang giới thiệu NLS (`:8-10`), `/huong-dan` (`:14`), `/dang-nhap`… (`:21-36`), `/toi/*` học viên, `/giang-day`, `/ho-tro-gv`, `/ho-tro`, `/admin/*` (`:205-303`).
- `frontend/src/lib/trangChuTheoVaiTro.ts:4-13` — trang chủ sau đăng nhập theo vai trò; `frontend/src/auth/RequireAdmin.tsx:34-39` đẩy học viên/hỗ trợ/GV về trang chủ vai trò.
- Thương hiệu trong khung: `pages/M1/DangNhap.tsx:34-49` (panel trái lấy `gioiThieu.moDau.tenChuongTrinh`), `pages/Admin/AdminLayout.tsx:30` (logo HCMUE — trung tính).
- Vite 6 (`frontend/package.json:47`).

### Nguồn chính

- Vite multi-page: build nhiều file `.html` bằng `build.rollupOptions.input` (Vite 6). — https://v6.vite.dev/guide/build.html#multi-page-app
- `import.meta.env.VITE_*` được thay tĩnh lúc build (https://v6.vite.dev/guide/env-and-mode.html) → **không** dùng env để phân biệt tên miền; phải đọc `window.location.hostname` lúc chạy.

### Đề xuất (KISS)

1. **Một module cấu hình cổng**, ví dụ `frontend/src/lib/congHienTai.ts`:
   ```ts
   export type Cong = 'nls' | 'hsg';
   export const cong: Cong = window.location.hostname === import.meta.env.VITE_HSG_HOSTNAME ? 'hsg' : 'nls';
   ```
   Mặc định `nls` → Host lạ/localhost vẫn như hiện nay. Dev thử HSG: `hsg.localhost:5173` hoặc `?cong=hsg` chỉ ở dev.
2. **Route**: `router.tsx` export 2 cây hoặc lọc theo `cong`. Cây HSG = `/dang-nhap`, `/quen-mat-khau`, `/dat-lai-mat-khau`, `/doi-mat-khau`, `/admin/*` (trang trường + quản trị — trang mới của tính năng hợp đồng), `/` → `Navigate` tới `/dang-nhap` hoặc landing HSG tối giản, `*` → 404. Không có `/toi/*`, `/giang-day`, `/ho-tro*`, `/huong-dan` NLS. Route `lazy` nên chunk NLS không bị tải ở HSG.
3. **Vai trò** trên HSG: `hoc_vien`, `giang_vien`, `ho_tro_*` đăng nhập được (cùng API) → `trangChuTheoVaiTro` trả trang "Tài khoản này dùng tại boiduongnls…" thay vì `/toi`. Chặn ở FE chỉ là UX; **phân quyền thật vẫn ở backend** (role guard) — không có endpoint nào được mở thêm.
4. **Nhãn/tiêu đề**: `DangNhap.tsx` panel, `document.title`, sidebar quản trị đọc từ `cong`. Ẩn mục menu admin thuần NLS (khảo sát, đổi buổi, điểm danh…) ở cổng HSG nếu muốn gọn — tùy sản phẩm.
5. **Meta tĩnh cho link preview**: thêm `frontend/hsg.html` (cùng `src/main.tsx`), mở rộng `metaTuNoiDung` thay placeholder theo file (nội dung HSG từ `src/content/gioiThieuHsg.ts`, `VITE_SITE_URL_HSG`), `build.rollupOptions.input = { main: 'index.html', hsg: 'hsg.html' }`. Nginx block HSG fallback về `/hsg.html` (§1). `06-deploy.sh:148-150` đang copy riêng `index.html` cuối cùng để đổi nguyên tử → thêm `hsg.html` vào bước đó (nếu không, `hsg.html` được copy sớm cùng asset — rủi ro nhỏ trỏ chunk chưa copy xong).

## 6. Backend có cần biết tên miền không?

- Không cho phân quyền: API giữ nguyên, nginx proxy cùng prefix ở cả 2 tên miền. Học viên gọi API qua `HSG_DOMAIN` vẫn chỉ thấy dữ liệu của mình — không mở thêm bề mặt.
- Chỉ cần cho **link email** (§4). Rate-limit theo IP/tài khoản (`TRUST_PROXY`) không đổi; `X-Forwarded-For` đi qua cùng proxy HCMUE.
- Swagger `/api` (`main.ts:63-69`) tắt ở production — không đổi.

## 7. Rủi ro

| # | Rủi ro | Mức | Giảm thiểu |
|---|---|---|---|
| R1 | IT HCMUE chậm cấp DNS/cert/ánh xạ proxy | Cao (lịch) | Xin sớm; xin subdomain `*.hcmue.edu.vn`; trong lúc chờ dev bằng `hsg.localhost` |
| R2 | Proxy HCMUE không giữ `Host` → nginx không tách được block, HSG hiện giao diện NLS | Trung bình | Kiểm `$host` trong access log ngay khi IT bật; phương án dự phòng: IT gửi `X-Forwarded-Host` hoặc NAT cổng riêng + `listen` riêng |
| R3 | Quên đổi `VITE_API_BASE_URL` → HSG gọi API chéo origin, bị CORS chặn hết (production `CORS_ORIGIN` chỉ có NLS) | Cao nếu quên | Phương án A + ghi runbook; smoke test đăng nhập ở `HSG_DOMAIN` |
| R4 | Dựng link email từ `Host`/`X-Forwarded-Host` thô → kẻ xấu gửi "quên mật khẩu" với Host giả, nạn nhân nhận link sang tên miền lạ lộ token | Cao (bảo mật) | Allow-list 2 URL từ env; không bao giờ nhận URL từ client |
| R5 | Thư gửi trường HSG vẫn mang thương hiệu NLS (header, chữ ký, `[BDNLS]`, tên người gửi) | Thấp–TB (uy tín) | Tham số hóa `boCucEmail` theo `cong` |
| R6 | Đổi `05-install-nginx.sh` làm vỡ `nginx-prefix.spec.ts` / cảnh báo `06-deploy.sh` (đọc file site theo `${DOMAIN}`) | Thấp | Cập nhật spec cùng lúc; block NLS giữ file/tên cũ |
| R7 | Link preview Zalo của `HSG_DOMAIN` vẫn hiện "Bồi dưỡng năng lực số" nếu chỉ đổi title bằng JS | TB | Entry `hsg.html` (§5.5) |
| R8 | "Thử vào VLE" của quản trị từ `HSG_DOMAIN` có thể bị VLE từ chối (chưa xác minh) | Thấp | Dùng trên tên miền NLS |
| R9 | HSTS: block HSG cũng gửi HSTS; nếu cert HSG ở proxy chưa sẵn mà đã bật → khóa người dùng khỏi HTTP | Thấp | Chỉ bật block HSG sau khi HTTPS chạy; `HSTS_MAX_AGE` nhỏ lúc đầu (như NLS) |

Không có migration DB, không ảnh hưởng dữ liệu; tên miền NLS giữ nguyên hành vi (block NLS vẫn là default server, `FRONTEND_URL_HSG`/`DOMAIN_HSG` trống = như cũ).

## 8. Khối lượng việc (ước lượng thô)

| Hạng mục | File chính | Ước lượng |
|---|---|---|
| Nginx block thứ 2 + config + spec + runbook deploy | `scripts/vps/00-config.sh`, `05-install-nginx.sh`, `06-deploy.sh`, `backend/src/nginx-prefix.spec.ts`, `docs/deploy/…` | 0,5 ngày |
| Backend: `FRONTEND_URL_HSG`, chọn URL theo `cong` (allow-list), tham số hóa thương hiệu email + test | `token-xac-thuc.util.ts`, `auth.controller.ts`/`auth.service.ts`, `tai-khoan-don-vi.service.ts`, `mau-email/bo-cuc.ts`, `mau-email.ts`, `.env.example` | 1–1,5 ngày |
| Frontend: `congHienTai`, cây route HSG, trang chủ theo vai trò, nhãn/tiêu đề, `hsg.html` + plugin meta + test | `router.tsx`, `lib/trangChuTheoVaiTro.ts`, `auth/RequireAdmin.tsx`, `pages/M1/DangNhap.tsx`, `vite.config.ts`, `content/` | 1,5–2 ngày |
| Thao tác VPS (người vận hành tự chạy): sửa `frontend/.env`, `backend/.env`, chạy lại `05`, `06` | — | 0,5 giờ |
| **Tổng** | | **~3–4 ngày dev** + chờ IT HCMUE |

## 9. Câu hỏi mở cho map #43

- Tên miền cụ thể (subdomain `hcmue.edu.vn`?) và ai liên hệ IT HCMUE.
- `/` của cổng HSG: landing giới thiệu HSG hay vào thẳng `/dang-nhap`?
- Menu quản trị ở cổng HSG: đầy đủ hay chỉ mục HSG/hợp đồng?
- Tên người gửi email chung ("HCMUE") hay tách theo chương trình (cần thêm hộp thư/`SMTP_ACCOUNTS` riêng?).
