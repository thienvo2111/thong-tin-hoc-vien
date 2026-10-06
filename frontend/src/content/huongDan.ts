// src/content/huongDan.ts
// Nội dung Hướng dẫn sử dụng (M9, công khai, /huong-dan). Mirror của ../../docs/huong-dan-hoc-vien.html,
// dùng chung cho nhiều tỉnh — KHÔNG ghi tên tỉnh nào (bản HTML gốc có nhắc "khóa An Giang", đã bỏ ở đây).
// Component chỉ hiển thị; chỉ sửa file này để đổi nội dung. Markup hỗ trợ trong chuỗi: **đậm**, *nghiêng*,
// [[Nhãn nút/UI]] — hiển thị qua <TextMarkup> (xem src/components/TextMarkup.tsx).

import { EMAIL_HO_TRO } from './hoTro';

export type HinhKey =
  | 'dang-nhap'
  | 'doi-mat-khau'
  | 'trang-chu'
  | 'ho-so'
  | 'khao-sat'
  | 'lop-hoc'
  | 'xac-nhan'
  | 'ho-tro';

export interface GiaiDoanMuc {
  ten: string;
  moTa: string;
  nhan?: string;
}

export interface GhiChu {
  loai: 'info' | 'warning' | 'success';
  tieuDe: string;
  noiDung: string;
}

export interface BangDuLieu {
  cot: string[];
  hang: string[][];
}

export interface MucChuanBi {
  tieuDe: string;
  moTa: string;
}

export interface PhanHuongDan {
  id: string;
  tieuDe: string;
  moTa: string;
  /** Tóm tắt 1 dòng: nội dung phần này dùng để làm gì / đọc khi nào (≤ 25 từ). Dùng cho mục
   * "Cách tìm và tra cứu tài liệu" (bản in Word) — trang web không hiển thị. */
  tomTat?: string;
  hinh?: HinhKey;
  buoc?: string[];
  ghiChu?: GhiChu[];
  bang?: BangDuLieu[];
}

export type NhomLoi = 'truy-cap' | 'dang-nhap' | 'ho-so' | 'khao-sat' | 'email';

export interface TinhHuongLoi {
  nhom: NhomLoi;
  nhanNhom: string;
  tinhHuong: string;
  nguyenNhan: string;
  cachXuLy: string[];
}

export interface LienHeHoTro {
  email: string;
  gioiThieu: string;
  mauEmail: string[];
  anToan: string[];
}

export interface NoiDungHuongDan {
  hero: { tieuDe: string; gioiThieu: string; diaChi: string; email: string };
  giaiDoan: GiaiDoanMuc[];
  zaloNote: GhiChu;
  chuanBi: MucChuanBi[];
  parts: PhanHuongDan[];
  troubleshooting: TinhHuongLoi[];
  contact: LienHeHoTro;
  /** Mục "Cách tìm và tra cứu tài liệu hướng dẫn" — chỉ dùng cho bản in Word (scripts/huong-dan/tao-docx.mjs),
   * trang web /huong-dan không hiển thị mục này. */
  cachTraCuu: { tieuDe: string; buoc: string[] };
}

/** Nhãn nhóm dùng cho bộ lọc (chip/SegmentedControl) ở Phần "Lỗi thường gặp". */
export const NHAN_NHOM_LOI: Record<NhomLoi, string> = {
  'truy-cap': 'Mở trang',
  'dang-nhap': 'Đăng nhập, mật khẩu',
  'ho-so': 'Hồ sơ, xác nhận',
  'khao-sat': 'Khảo sát, Zalo, lớp học',
  email: 'Email',
};

export const huongDan: NoiDungHuongDan = {
  hero: {
    tieuDe: 'Hướng dẫn sử dụng hệ thống Bồi dưỡng Năng lực số',
    gioiThieu:
      'Dành cho giáo viên và cán bộ quản lý tham gia khóa bồi dưỡng. Tài liệu đi từng bước, có hình minh họa từng màn hình, và có mục tra cứu khi gặp lỗi. Hình minh họa có hai kiểu, máy tính và điện thoại: Thầy/Cô chọn đúng thiết bị mình đang dùng.',
    diaChi: 'boiduongnls.hcmue.edu.vn',
    email: EMAIL_HO_TRO,
  },

  giaiDoan: [
    {
      ten: 'Đăng nhập, bổ sung hồ sơ',
      moTa: 'Đăng nhập, đổi mật khẩu, bổ sung thông tin còn thiếu, đặc biệt là mục **Đối tượng**.',
      nhan: 'Làm ngay',
    },
    {
      ten: 'Làm khảo sát đầu vào',
      moTa:
        'Hồ sơ đủ thì khối khảo sát mở trên Trang chủ. Làm lần lượt 2 phiếu: khảo sát kĩ năng số, rồi đánh giá năng lực số.',
      nhan: 'Làm ngay',
    },
    {
      ten: 'Học tập',
      moTa: 'Học qua Zoom, trên hệ thống học tập trực tuyến VLE và tập huấn trực tiếp theo lịch lớp.',
    },
    {
      ten: 'Xác nhận thông tin',
      moTa:
        'Cuối khóa, kiểm tra kỹ mã định danh, họ tên, ngày sinh rồi bấm xác nhận. Đây là thông tin in trên giấy chứng nhận.',
    },
    {
      ten: 'Đánh giá đầu ra và chứng nhận',
      moTa: 'Làm bài đánh giá cuối khóa và phiếu khảo sát đánh giá khóa học (bắt buộc để hoàn tất).',
    },
  ],

  zaloNote: {
    loai: 'success',
    tieuDe: 'Nhóm Zalo hỗ trợ theo cụm: tham gia bất cứ lúc nào sau khi đăng nhập',
    noiDung:
      'Việc này không thuộc giai đoạn nào. Ngay khi đăng nhập được, Thầy/Cô vào mục **Lớp học**, bấm [[Vào nhóm Zalo]] để nhận thông báo và được hỗ trợ suốt khóa học (Phần 8). Chưa thấy nút này, Thầy/Cô tra tên trường mình trong **Phụ lục: Nhóm Zalo hỗ trợ theo cụm** ở cuối tài liệu để tham gia đúng nhóm.',
  },

  chuanBi: [
    { tieuDe: 'Thiết bị có mạng', moTa: 'Điện thoại hoặc máy tính. Nên dùng Chrome, Safari, Edge hoặc Cốc Cốc bản mới.' },
    {
      tieuDe: 'Mã định danh',
      moTa:
        'Mã định danh trên cơ sở dữ liệu ngành (MOET), lấy theo danh sách học viên nhà trường gửi để tạo tài khoản. Đây là tên đăng nhập.',
    },
    { tieuDe: 'Ngày tháng năm sinh', moTa: 'Dùng làm mật khẩu lần đầu, viết liền 8 chữ số. Ví dụ: 08121983.' },
    { tieuDe: 'Số CCCD và email', moTa: 'Số căn cước công dân 12 số và một email cá nhân Thầy/Cô thường dùng.' },
    { tieuDe: 'Ứng dụng Zalo', moTa: 'Cài sẵn trên điện thoại để tham gia nhóm Zalo hỗ trợ của cụm.' },
    { tieuDe: 'Khoảng 30–45 phút', moTa: 'Làm ở nơi yên tĩnh, mạng ổn định. Phiếu đánh giá năng lực số cần làm liền một lần.' },
  ],

  parts: [
    {
      id: 'tong-quan',
      tieuDe: 'Tổng quan các giai đoạn',
      tomTat: 'Xem các giai đoạn của khóa học và việc cần làm ngay bây giờ.',
      moTa:
        'Khóa bồi dưỡng đi qua các giai đoạn dưới đây. Ban tổ chức sẽ thông báo (qua nhà trường, nhóm Zalo hoặc email) khi mỗi giai đoạn mở. Thầy/Cô chỉ cần làm đúng việc của giai đoạn đang mở.',
      ghiChu: [
        {
          loai: 'info',
          tieuDe: 'Việc cần làm ngay bây giờ',
          noiDung:
            'Đăng nhập (Phần 3) → bổ sung hồ sơ, chọn đúng Đối tượng (Phần 6) → làm 2 phiếu khảo sát (Phần 7) → kiểm tra cả hai phiếu đã hiện "Đã hoàn thành". Chưa có tên trong danh sách học viên nên không đăng nhập được? Xem Phần 13 hoặc gửi email hỗ trợ.',
        },
      ],
    },
    {
      id: 'chuan-bi',
      tieuDe: 'Chuẩn bị trước khi bắt đầu',
      tomTat: 'Chuẩn bị mã định danh, ngày sinh, CCCD, email và Zalo trước khi bắt đầu.',
      moTa: 'Chuẩn bị sẵn những thứ sau để làm một lần là xong, không bị gián đoạn.',
      ghiChu: [
        {
          loai: 'warning',
          tieuDe: 'Chưa có tên trong danh sách học viên?',
          noiDung: `Tài khoản không tự đăng ký được. Ban tổ chức tạo sẵn tài khoản cho từng người có tên trong **danh sách học viên**, lấy từ cơ sở dữ liệu ngành (CSDL MOET) do Sở/Phòng/nhà trường gửi. Nếu chưa có tên trong danh sách này, Thầy/Cô chưa đăng nhập được, dù nhập đúng thông tin cũng chỉ hiện thông báo lỗi đăng nhập chung (xem Phần 3). Hãy liên hệ cán bộ phụ trách của nhà trường để được bổ sung vào danh sách, hoặc gửi email tới **${EMAIL_HO_TRO}** kèm họ tên, ngày sinh, mã định danh MOET (nếu biết), trường, xã/phường, số điện thoại (mẫu ở Phần 13).`,
        },
        {
          loai: 'warning',
          tieuDe: 'Mở đường dẫn từ Zalo',
          noiDung:
            'Nếu bấm đường dẫn trong Zalo mà trang hiện không đầy đủ, bấm biểu tượng [[⋯]] ở góc trên bên phải, chọn [[Mở bằng trình duyệt]].',
        },
      ],
    },
    {
      id: 'dang-nhap',
      tieuDe: 'Đăng nhập lần đầu',
      tomTat: 'Đăng nhập lần đầu bằng mã định danh và mật khẩu là ngày sinh.',
      moTa:
        'Mở **boiduongnls.hcmue.edu.vn**, bấm [[Đăng nhập cổng học viên]] (hoặc gõ thẳng boiduongnls.hcmue.edu.vn/dang-nhap). Mọi việc tiếp theo, kể cả làm khảo sát, đều thực hiện sau khi đăng nhập.',
      hinh: 'dang-nhap',
      buoc: [
        'Nhập **tên tài khoản hoặc mã định danh MOET**. Mã định danh trên CSDL MOET do nhà trường cung cấp (lấy từ danh sách học viên) — chỉ gồm chữ số, không có dấu cách.',
        'Nhập **mật khẩu**. Lần đầu là ngày sinh viết liền 8 chữ số. Bấm biểu tượng con mắt ở cuối ô để xem lại mình đã gõ đúng chưa.',
        'Bấm [[Đăng nhập]]. Lần đầu, hệ thống sẽ chuyển sang màn hình đổi mật khẩu.',
      ],
      bang: [
        {
          cot: ['Ngày sinh', 'Gõ mật khẩu', 'Gõ sai thường gặp'],
          hang: [
            ['8/12/1983', '08121983', '8121983 (thiếu số 0)'],
            ['25/3/1990', '25031990', '25/03/1990 (có dấu /)'],
            ['1/1/1978', '01011978', '010178 (năm chỉ 2 số)'],
          ],
        },
      ],
      ghiChu: [
        {
          loai: 'warning',
          tieuDe: 'Nhập đúng mà vẫn báo sai?',
          noiDung: `Hai nguyên nhân thường gặp: (1) Thầy/Cô **chưa có tên trong danh sách học viên** nên chưa có tài khoản; (2) **ngày sinh trong danh sách bị sai** nên mật khẩu lần đầu không đúng như Thầy/Cô nghĩ. Cả hai trường hợp, hệ thống đều chỉ hiện cùng một thông báo lỗi, không phân biệt sai phần nào. Đừng thử lại nhiều lần — sai 5 lần liên tiếp sẽ bị khóa 15 phút. Hãy liên hệ cán bộ phụ trách của nhà trường, hoặc gửi email tới **${EMAIL_HO_TRO}** kèm họ tên, ngày sinh, mã định danh MOET (nếu biết), trường, xã/phường, số điện thoại (mẫu ở Phần 13).`,
        },
      ],
    },
    {
      id: 'doi-mat-khau',
      tieuDe: 'Đổi mật khẩu lần đầu',
      tomTat: 'Đổi mật khẩu mới theo yêu cầu bắt buộc ngay sau lần đăng nhập đầu tiên.',
      moTa:
        'Hệ thống bắt buộc đặt mật khẩu mới ngay lần đầu, để người khác không thể đăng nhập bằng ngày sinh của Thầy/Cô.',
      hinh: 'doi-mat-khau',
      buoc: [
        'Gõ **mật khẩu mới**. Gợi ý cách đặt dễ nhớ: một từ quen thuộc kèm vài chữ số, ví dụ **hoahong2026**.',
        'Gõ lại đúng mật khẩu đó vào ô **Nhập lại mật khẩu mới**.',
        'Xem danh sách điều kiện. Khi cả 4 dòng chuyển sang dấu tích xanh, bấm [[Đổi mật khẩu]].',
      ],
      ghiChu: [
        {
          loai: 'warning',
          tieuDe: 'Ghi lại mật khẩu mới',
          noiDung: 'Từ lần sau, Thầy/Cô dùng mật khẩu mới, không dùng ngày sinh nữa. Nên ghi vào sổ tay cá nhân.',
        },
      ],
    },
    {
      id: 'trang-chu',
      tieuDe: 'Trang chủ của tôi',
      tomTat: 'Xem việc cần làm tiếp theo và lối tắt tới Hồ sơ, Lớp học trên Trang chủ.',
      moTa: 'Sau khi đăng nhập, Thầy/Cô vào trang chủ. Khung màu ở trên cùng cho biết việc cần làm tiếp theo.',
      hinh: 'trang-chu',
      buoc: [
        '**Menu**: *Trang chủ*, *Hồ sơ*, *Lớp học*, *Xác nhận*, *Hỗ trợ*. Tùy giai đoạn, có thể có thêm mục *Đánh giá đầu vào*. Trên máy tính, menu nằm ngang trên thanh xanh ở đầu trang; tên Thầy/Cô và nút [[Đăng xuất]] ở góc phải. Trên điện thoại, bấm nút [[☰]] ở góc phải để mở menu và nút Đăng xuất.',
        '**Việc cần làm**. Đọc kỹ mục này mỗi lần đăng nhập. Khung **Khảo sát đầu vào đã mở** màu **vàng** liệt kê thông tin còn thiếu: bổ sung xong thì khung chuyển **xanh** và hiện nút [[Làm khảo sát đầu vào]] (Phần 7). Dưới đó có thể còn khung của đợt xác nhận — bảng đầu tiên dưới đây giải thích các khung hay gặp.',
        '**Các thẻ chức năng**. Ngay dưới mục Việc cần làm là các thẻ *Cập nhật hồ sơ*, *Thông tin lớp học*, *Khảo sát đầu vào*, *Đánh giá đầu ra*. Thẻ khóa (🔒, mờ) nghĩa là chưa làm được, kèm lý do ngay dưới tên thẻ — bảng thứ hai dưới đây giải thích các dòng ghi chú hay gặp ở thẻ **📝 Khảo sát đầu vào**.',
        '**Lối tắt** vào trang Hồ sơ và trang Lớp học. Vào *Thông tin lớp học* để tham gia nhóm Zalo của cụm ngay (Phần 8).',
      ],
      bang: [
        {
          cot: ['Khung trạng thái báo', 'Ý nghĩa', 'Thầy/Cô cần làm'],
          hang: [
            [
              'Khảo sát đầu vào đã mở (khung vàng, có danh sách thông tin cần cập nhật)',
              'Khảo sát đã mở nhưng hồ sơ còn thiếu, nên chưa làm được.',
              'Bấm [[Cập nhật thông tin hồ sơ]], xem Phần 6.',
            ],
            [
              'Khảo sát đầu vào đã mở · Hồ sơ đã đầy đủ (khung xanh)',
              'Đủ điều kiện làm khảo sát.',
              'Bấm [[Làm khảo sát đầu vào]], xem Phần 7.',
            ],
            ['Còn thông tin cần bổ sung · Hạn …', 'Đợt xác nhận đang mở, hồ sơ còn thiếu.', 'Bấm [[Bổ sung thông tin]], xem Phần 6.'],
            [
              'Hồ sơ đã đủ, cần kiểm tra và xác nhận',
              'Đã đủ thông tin nhưng chưa xác nhận.',
              'Bấm [[Xem lại & xác nhận]], xem Phần 9.',
            ],
            ['Đã xác nhận lúc …', 'Đã hoàn tất. Vẫn sửa được tới hạn, nhưng sửa xong phải xác nhận lại.', 'Không cần làm gì thêm.'],
            ['Đợt … mở lúc …', 'Sắp đến thời gian chỉnh sửa hồ sơ.', 'Chờ đến giờ mở rồi quay lại.'],
            ['Hiện không trong thời gian chỉnh sửa hồ sơ', 'Chỉ được xem, chưa được sửa.', 'Xem hồ sơ. Nếu thấy sai, gửi yêu cầu hỗ trợ.'],
            [
              'Khảo sát đầu ra đã mở',
              'Cuối khóa, có phiếu khảo sát đầu ra cần làm.',
              'Nếu hồ sơ đủ, bấm nút làm bài trong khung. Nếu chưa đủ, bổ sung hồ sơ trước.',
            ],
          ],
        },
        {
          cot: ['Thẻ "📝 Khảo sát đầu vào" ghi chú', 'Ý nghĩa', 'Thầy/Cô cần làm'],
          hang: [
            [
              '🔒 Đã mở nhưng chưa kích hoạt được: cần cập nhật đủ … thông tin hồ sơ',
              'Khảo sát đã mở nhưng hồ sơ còn thiếu, thẻ bị khóa.',
              'Xem khung vàng ở mục Việc cần làm, bổ sung hồ sơ (Phần 6).',
            ],
            [
              'Đã mở — bấm để bắt đầu',
              'Hồ sơ đủ, có thể làm khảo sát ngay.',
              'Bấm vào thẻ để sang trang làm khảo sát (Phần 7).',
            ],
            [
              'Đã có kết quả: Mức Cơ bản / Thành thạo / Nâng cao',
              'Đã hoàn thành cả 2 phiếu và đã có kết quả xếp mức.',
              'Không cần làm gì thêm. Bấm vào thẻ để xem lớp học (Phần 8).',
            ],
            [
              '🔒 Chưa mở. Thông báo sẽ hiện tại trang này khi khảo sát được mở',
              'Ban tổ chức chưa mở khảo sát đầu vào.',
              'Chờ thông báo, không cần làm gì.',
            ],
          ],
        },
      ],
      ghiChu: [
        {
          loai: 'success',
          tieuDe: 'Khung "Có cập nhật mới"',
          noiDung:
            'Khung màu xanh này tự hiện ở đầu trang khi có kết quả đánh giá mới hoặc Thầy/Cô vừa được chia lớp. Bấm [[Xem lớp học]] để xem ngay, hoặc [[Đã xem]] để ẩn khung.',
        },
      ],
    },
    {
      id: 'ho-so',
      tieuDe: 'Bổ sung hồ sơ',
      tomTat: 'Bổ sung và kiểm tra thông tin hồ sơ, bắt buộc trước khi làm khảo sát.',
      moTa:
        'Đây là bước **bắt buộc trước khi làm khảo sát**. Khối khảo sát chỉ mở khi hồ sơ đã đủ các thông tin bắt buộc. Hồ sơ sửa được trong thời gian Ban tổ chức mở cập nhật. Ngoài thời gian đó, các ô chỉ để xem, không có nút Lưu.',
      ghiChu: [
        {
          loai: 'warning',
          tieuDe: 'Chọn đúng "Đối tượng": Giáo viên hay Cán bộ quản lý',
          noiDung:
            'Mục **Đối tượng** nằm trong nhóm *Công tác*. Hệ thống dựa vào mục này để mở đúng bộ phiếu khảo sát dành cho Thầy/Cô. Chọn **Cán bộ quản lý** nếu Thầy/Cô là hiệu trưởng, phó hiệu trưởng (hoặc tương đương). Chọn **Giáo viên** nếu Thầy/Cô đang trực tiếp giảng dạy. Chọn sai sẽ phải làm lại phiếu.',
        },
        {
          loai: 'info',
          tieuDe: 'Xác minh email để lấy lại mật khẩu khi quên',
          noiDung:
            'Cạnh ô Email có nhãn *Đã xác minh* hoặc *Chưa xác minh*. Nếu chưa xác minh, mở hộp thư (xem cả mục Thư rác/Quảng cáo), bấm liên kết trong thư. Không thấy thư thì bấm [[Gửi lại email xác minh]].',
        },
      ],
      hinh: 'ho-so',
      buoc: [
        'Bấm **Hồ sơ** trên menu (trên điện thoại, bấm [[☰]] để mở menu). Hồ sơ chia thành các nhóm: Thông tin cá nhân, Nơi sinh và cư trú, Công tác, Liên hệ, Trình độ và chuyên môn. Nhóm nào còn thiếu có dấu chấm đỏ.',
        'Ô có chữ đỏ **Cần bổ sung** là ô bắt buộc còn trống. Điền vào. Ô **Mã định danh trên CSDL MOET** màu xám, không sửa được. Ở nhóm *Công tác*, tích chọn **Đối tượng**.',
        'Kiểm tra thật kỹ **họ tên và ngày sinh**. Đây là thông tin in trên giấy chứng nhận. Viết hoa chữ cái đầu mỗi tiếng, có dấu đầy đủ.',
        'Bấm [[Lưu]] ở cuối màn hình. Góc màn hình hiện chữ *"Đã lưu"* là thành công. Quay về **Trang chủ**: nếu khung khảo sát đã chuyển xanh là hồ sơ đủ, chuyển sang Phần 7.',
      ],
      bang: [
        {
          cot: ['Ô thông tin', 'Cách nhập đúng'],
          hang: [
            ['Ngày / Tháng / Năm sinh', '3 ô riêng, chỉ gõ số. Ví dụ: 8 · 12 · 1983.'],
            ['Số CCCD', 'Đủ 12 chữ số, không dấu cách. Hệ thống báo ngay nếu số đã có người dùng.'],
            ['Nơi sinh, Phường/xã', 'Chọn **tỉnh/thành trước**, sau đó mới chọn được phường/xã.'],
            ['Đơn vị công tác', 'Gõ ít nhất 2 chữ trong tên trường rồi chọn trong danh sách gợi ý.'],
            ['**Đối tượng**', '**Bắt buộc.** Tích chọn *Giáo viên* hoặc *Cán bộ quản lý*. Quyết định bộ phiếu khảo sát Thầy/Cô nhận được. Vừa dạy vừa quản lý: chọn công việc làm thường xuyên nhất.'],
            ['Số điện thoại', '10 chữ số, bắt đầu bằng số 0.'],
            ['Email', 'Email cá nhân đang dùng. Sau khi lưu, mở hộp thư và bấm liên kết xác minh.'],
            ['Chuyên môn', 'Gõ chuyên môn rồi nhấn Enter. Có thể thêm nhiều chuyên môn.'],
            ['Cấp và môn giảng dạy', 'Không bắt buộc. Cán bộ quản lý, nhân viên có thể để trống. Dạy nhiều cấp (trường liên cấp) hoặc nhiều môn: chọn cấp, môn dạy chính (nhiều tiết nhất).'],
          ],
        },
      ],
    },
    {
      id: 'khao-sat',
      tieuDe: 'Làm khảo sát đầu vào',
      tomTat: 'Làm lần lượt 2 phiếu khảo sát đầu vào khi hồ sơ đã đầy đủ.',
      moTa:
        'Khảo sát làm ngay trên hệ thống, sau khi đăng nhập. Khối khảo sát trên Trang chủ **chỉ mở khi hồ sơ đã đủ thông tin** (Phần 6). Làm lần lượt 2 phiếu: khảo sát kĩ năng số trước, rồi đánh giá năng lực số.',
      hinh: 'khao-sat',
      buoc: [
        'Vào **Trang chủ** (boiduongnls.hcmue.edu.vn/toi), tìm khung **Khảo sát đầu vào đã mở**. Nếu khung màu vàng còn liệt kê thông tin cần cập nhật, quay lại Phần 6 để bổ sung hồ sơ trước.',
        'Khi khung chuyển màu xanh với dòng *"Hồ sơ đã đầy đủ. Thầy/Cô có thể bắt đầu làm khảo sát đầu vào."*, bấm [[Làm khảo sát đầu vào]]. Trang hiện ra với 2 phiếu: *"1. Phiếu khảo sát kĩ năng số"* và *"2. Phiếu đánh giá năng lực số"*.',
        'Ở phiếu **"1. Phiếu khảo sát kĩ năng số"**, bấm [[Làm bài]]. Hệ thống khảo sát mở ra ngay, đã đăng nhập sẵn — không cần nhập lại mật khẩu. Trả lời hết các câu rồi bấm nút nộp bài ở cuối phiếu.',
        'Quay lại **boiduongnls.hcmue.edu.vn**, vào **Trang chủ**, bấm lại [[Làm khảo sát đầu vào]]. Ở phiếu **"2. Phiếu đánh giá năng lực số"**, bấm [[Làm bài]] (hoặc [[Làm tiếp]] nếu đã mở trước đó), làm tương tự rồi nộp bài.',
        'Kiểm tra cả hai phiếu đã chuyển sang nhãn **"Đã hoàn thành"**. Trạng thái có thể cập nhật chậm vài phút sau khi nộp — tải lại trang nếu chưa thấy đổi.',
      ],
      bang: [
        {
          cot: ['Nhãn trên phiếu', 'Ý nghĩa', 'Thầy/Cô cần làm'],
          hang: [
            ['Chưa làm', 'Chưa bấm vào làm phiếu này.', 'Bấm [[Làm bài]].'],
            [
              'Đã mở, chưa nộp',
              'Đã mở phiếu nhưng hệ thống chưa nhận được bài nộp.',
              'Bấm [[Làm tiếp]], vào kiểm tra và bấm nộp bài.',
            ],
            ['Đang làm', 'Đang làm phiếu, chưa nộp xong.', 'Bấm [[Làm tiếp]] để làm tiếp và nộp bài.'],
            [
              'Cần kiểm tra lại',
              'Mở phiếu đã lâu nhưng hệ thống vẫn chưa nhận được bài nộp.',
              'Bấm [[Mở lại trang khảo sát]], vào lại kiểm tra và bấm nộp bài.',
            ],
            ['Đã hoàn thành', 'Đã nộp bài thành công.', 'Không cần làm gì thêm.'],
          ],
        },
      ],
      ghiChu: [
        {
          loai: 'info',
          tieuDe: 'Không cần tài khoản khác',
          noiDung:
            'Hệ thống tự mở trang khảo sát và đăng nhập sẵn bằng thông tin đã khai trong hồ sơ (họ tên, đơn vị, đối tượng) — Thầy/Cô không phải đăng ký hay nhập lại mật khẩu. Việc chuyển trang diễn ra ngay trên tab đang mở, không mở cửa sổ mới.',
        },
        {
          loai: 'warning',
          tieuDe: 'Trang khảo sát báo liên kết đã hết hạn?',
          noiDung:
            'Mã truy cập chỉ có giá trị vài phút kể từ lúc bấm nút. Mở chậm hoặc để lâu không bấm, hệ thống khảo sát sẽ báo liên kết hết hạn hoặc không vào được. Quay lại **Trang chủ**, bấm lại [[Làm khảo sát đầu vào]] rồi bấm nút của phiếu ([[Làm bài]]/[[Làm tiếp]]) để lấy mã mới.',
        },
        {
          loai: 'success',
          tieuDe: 'Sau khi làm xong 2 phiếu',
          noiDung:
            'Khi cả hai phiếu đều hiện nhãn "Đã hoàn thành", Ban tổ chức sẽ tổng hợp kết quả, xếp mức năng lực (Cơ bản, Thành thạo hoặc Nâng cao) và chia lớp theo trình độ. Thầy/Cô theo dõi nhóm Zalo của cụm để nhận thông báo (Phần 8).',
        },
      ],
    },
    {
      id: 'lop-hoc',
      tieuDe: 'Nhóm Zalo hỗ trợ và thông tin lớp học',
      tomTat: 'Vào nhóm Zalo hỗ trợ của cụm và xem thông tin, lịch học của lớp.',
      moTa:
        'Mỗi học viên được xếp vào một **cụm hỗ trợ** theo địa bàn. Mỗi cụm có một nhóm Zalo để nhận thông báo và hỏi đáp. Thầy/Cô **tham gia được ngay khi đăng nhập**, không cần chờ làm xong hồ sơ hay khảo sát. Lớp học theo trình độ sẽ được chia sau khi có kết quả khảo sát.',
      hinh: 'lop-hoc',
      buoc: [
        'Bấm **Lớp học** trên menu. Ngay dưới tên khóa là khối **Cụm hỗ trợ Zalo** với tên cụm của Thầy/Cô.',
        'Bấm [[Vào nhóm Zalo]]. Trên điện thoại, Zalo mở ra, bấm [[Tham gia nhóm]]. Trên máy tính, Zalo hiện mã QR: mở Zalo trên điện thoại, chọn biểu tượng quét mã QR để quét.',
        'Bên dưới là **các giai đoạn** của khóa học và thời gian của từng giai đoạn.',
        'Khung *"Danh sách lớp… sẽ được phân chia và cập nhật sau"* cho biết **chưa chia lớp theo trình độ**. Đây là bình thường ở giai đoạn này. Theo dõi nhóm Zalo để biết khi nào có lớp.',
      ],
      ghiChu: [
        {
          loai: 'success',
          tieuDe: 'Khi đã chia lớp',
          noiDung:
            'Mỗi giai đoạn sẽ hiện tên lớp, giảng viên, người hỗ trợ (kèm số điện thoại nếu có), lịch từng buổi và điểm danh. Phần *Kết quả đánh giá* hiện mức đầu vào: Cơ bản, Thành thạo hoặc Nâng cao.',
        },
        {
          loai: 'info',
          tieuDe: 'Mẹo khi dùng nhóm Zalo',
          noiDung:
            'Đặt tên Zalo dễ nhận biết (họ tên, trường) để cán bộ hỗ trợ dễ trao đổi. Đọc tin ghim của nhóm trước khi hỏi. Không gửi mật khẩu hay số CCCD lên nhóm.',
        },
      ],
    },
    {
      id: 'xac-nhan',
      tieuDe: 'Xác nhận thông tin cuối khóa',
      tomTat: 'Kiểm tra và xác nhận thông tin cuối khóa trước khi được cấp chứng nhận.',
      moTa:
        'Thực hiện khi Ban tổ chức mở **đợt xác nhận** (thường ở cuối khóa, trước khi cấp chứng nhận). Xác nhận là lời cam kết thông tin đúng. Phải xác nhận trong thời hạn của đợt thì hồ sơ mới được ghi nhận.',
      hinh: 'xac-nhan',
      buoc: [
        'Bấm **Xác nhận** trên menu. Đọc lại toàn bộ thông tin. Nếu có khung **đỏ** (lỗi), bấm nút [[Sửa]] cạnh lỗi để quay về đúng ô cần sửa. Khung **vàng** chỉ là gợi ý, không bắt buộc.',
        'Tích vào ô cam kết.',
        'Bấm [[Xác nhận]]. Màn hình báo *"Đã xác nhận lúc …"* và hệ thống gửi bản sao hồ sơ vào email của Thầy/Cô.',
      ],
      ghiChu: [
        {
          loai: 'warning',
          tieuDe: 'Sửa hồ sơ sau khi đã xác nhận',
          noiDung:
            'Nếu sửa và lưu lại sau khi xác nhận, lần xác nhận cũ bị hủy. Hệ thống hiện hộp thông báo *"Cần xác nhận lại"*. Thầy/Cô bấm [[Xác nhận lại]] và làm lại các bước trên trước hạn chót.',
        },
      ],
    },
    {
      id: 'quen-mat-khau',
      tieuDe: 'Quên mật khẩu',
      tomTat: 'Lấy lại mật khẩu khi quên, theo email đã xác minh hay chưa.',
      moTa: 'Có hai cách, tùy việc email của Thầy/Cô đã được xác minh hay chưa.',
      bang: [
        {
          cot: ['Trường hợp', 'Cách làm'],
          hang: [
            [
              '**Email đã xác minh**',
              'Ở màn hình đăng nhập, bấm [[Quên mật khẩu?]]. Nhập tên tài khoản hoặc mã định danh MOET, bấm [[Gửi yêu cầu]]. Mở email (xem cả Thư rác), bấm liên kết đặt lại mật khẩu, đặt mật khẩu mới.',
            ],
            [
              '**Email chưa xác minh** hoặc không nhận được thư sau 15 phút',
              `Gửi email tới **${EMAIL_HO_TRO}** theo mẫu ở Phần 13. Sau khi xác minh, cán bộ hỗ trợ đặt lại mật khẩu về ngày sinh để Thầy/Cô đăng nhập và đổi lại.`,
            ],
          ],
        },
      ],
      ghiChu: [
        {
          loai: 'info',
          tieuDe: 'Vì sao màn hình luôn báo đã gửi?',
          noiDung:
            'Để bảo vệ tài khoản, hệ thống luôn hiện cùng một thông báo, kể cả khi mã không đúng hoặc email chưa xác minh. Nếu không nhận được thư, hãy làm theo dòng thứ hai của bảng trên.',
        },
      ],
    },
    {
      id: 'ho-tro',
      tieuDe: 'Gửi yêu cầu hỗ trợ trên hệ thống',
      tomTat: 'Gửi yêu cầu hỗ trợ ngay trên hệ thống khi đã đăng nhập được.',
      moTa: 'Khi đã đăng nhập được, cách nhanh nhất là gửi yêu cầu ngay trên hệ thống. Câu trả lời hiện lại ở cùng trang.',
      hinh: 'ho-tro',
      buoc: [
        'Bấm **Hỗ trợ** trên menu, chọn **loại vấn đề**.',
        'Đọc phần **gợi ý**. Nhiều vấn đề đã có cách giải quyết sẵn.',
        'Nếu chưa giải quyết được, mô tả rõ vấn đề: đang làm gì, màn hình báo gì. Bấm [[Gửi yêu cầu]].',
        'Quay lại trang này sau để xem trạng thái: *Đang chờ xử lý*, *Đã có trả lời* hoặc *Đã đóng*.',
      ],
      ghiChu: [
        {
          loai: 'warning',
          tieuDe: 'Không đăng nhập được?',
          noiDung: `Hãy gửi email tới **${EMAIL_HO_TRO}** theo mẫu ở Phần 13.`,
        },
      ],
    },
  ],

  troubleshooting: [
    {
      nhom: 'truy-cap',
      nhanNhom: 'Mở trang',
      tinhHuong: 'Gõ địa chỉ nhưng không vào được trang, hoặc ra trang khác',
      nguyenNhan: 'Thường do gõ vào ô tìm kiếm Google, gõ sai địa chỉ, hoặc mạng yếu.',
      cachXuLy: [
        'Gõ chính xác **boiduongnls.hcmue.edu.vn** vào **ô địa chỉ** trên cùng của trình duyệt, không có dấu cách.',
        'Kiểm tra Wi-Fi hoặc 4G, thử mở một trang khác (ví dụ báo điện tử).',
        'Thử trình duyệt khác: Chrome, Safari, Edge, Cốc Cốc.',
      ],
    },
    {
      nhom: 'truy-cap',
      nhanNhom: 'Mở trang',
      tinhHuong: 'Mở đường dẫn từ Zalo bị trắng trang, không bấm được nút',
      nguyenNhan: 'Trình duyệt bên trong Zalo đôi khi không hiển thị đầy đủ.',
      cachXuLy: ['Bấm biểu tượng [[⋯]] ở góc trên bên phải.', 'Chọn [[Mở bằng trình duyệt]] (Chrome hoặc Safari).'],
    },
    {
      nhom: 'truy-cap',
      nhanNhom: 'Mở trang',
      tinhHuong: '"Không kết nối được máy chủ. Kiểm tra mạng và thử lại."',
      nguyenNhan: 'Mạng bị ngắt hoặc chập chờn trong lúc thao tác.',
      cachXuLy: [
        'Kiểm tra kết nối mạng.',
        'Chờ 1–2 phút rồi bấm lại nút vừa bấm.',
        'Vẫn lỗi sau 30 phút: gửi email hỗ trợ, ghi rõ thời điểm gặp lỗi.',
      ],
    },
    {
      nhom: 'truy-cap',
      nhanNhom: 'Mở trang',
      tinhHuong: 'Trang hiển thị lộn xộn hoặc vẫn là nội dung cũ',
      nguyenNhan: 'Trình duyệt đang dùng bản lưu tạm cũ.',
      cachXuLy: [
        'Tải lại trang: trên máy tính nhấn [[Ctrl]] + [[F5]]; trên điện thoại kéo màn hình xuống hoặc bấm biểu tượng tải lại.',
        'Nếu chưa được, đóng hẳn trình duyệt rồi mở lại.',
      ],
    },
    {
      nhom: 'dang-nhap',
      nhanNhom: 'Đăng nhập',
      tinhHuong: '"Mã định danh hoặc mật khẩu không đúng"',
      nguyenNhan:
        'Sai mã hoặc sai mật khẩu. Cũng có thể do Thầy/Cô chưa có tên trong danh sách học viên (chưa có tài khoản) hoặc ngày sinh trong danh sách bị sai. Vì lý do bảo mật, hệ thống không nói rõ nguyên nhân nào.',
      cachXuLy: [
        'Kiểm tra mã định danh: chỉ chữ số, không dấu cách, đúng mã nhà trường gửi.',
        'Lần đầu: mật khẩu là ngày sinh đủ 8 số, có số 0 ở đầu ngày/tháng (dùng công cụ ở Phần 3).',
        'Nếu đã đổi mật khẩu trước đó: dùng mật khẩu mới, không dùng ngày sinh.',
        'Bấm biểu tượng con mắt để xem lại mật khẩu đã gõ; chú ý chữ hoa, chữ thường.',
        'Đừng thử quá 5 lần liên tiếp. Nếu vẫn không được, xem Phần 10.',
        `Vẫn không vào được dù chắc chắn đúng: có thể chưa có tên trong danh sách học viên, hoặc ngày sinh trong danh sách bị sai. Liên hệ cán bộ phụ trách của nhà trường, hoặc gửi email tới ${EMAIL_HO_TRO} theo mẫu ở Phần 13.`,
      ],
    },
    {
      nhom: 'dang-nhap',
      nhanNhom: 'Đăng nhập',
      tinhHuong: '"Tài khoản tạm khóa do nhập sai nhiều lần. Thử lại sau …"',
      nguyenNhan: 'Nhập sai mật khẩu 5 lần liên tiếp, tài khoản bị khóa 15 phút để chống người lạ dò mật khẩu.',
      cachXuLy: [
        'Chờ đến giờ ghi trong thông báo. Trong lúc khóa, nhập đúng mật khẩu cũng không vào được.',
        'Kiểm tra lại mật khẩu trước khi thử lần nữa.',
        'Không nhớ mật khẩu: làm theo Phần 10.',
      ],
    },
    {
      nhom: 'dang-nhap',
      nhanNhom: 'Đăng nhập',
      tinhHuong: '"Bạn thao tác quá nhanh, vui lòng thử lại sau ít phút"',
      nguyenNhan: 'Bấm nút đăng nhập quá nhiều lần trong một phút.',
      cachXuLy: ['Chờ khoảng 1 phút rồi thử lại.', 'Mỗi lần chỉ bấm nút một lần và chờ kết quả.'],
    },
    {
      nhom: 'dang-nhap',
      nhanNhom: 'Đăng nhập',
      tinhHuong: 'Không biết mã định danh của mình',
      nguyenNhan: 'Mã định danh là mã của Thầy/Cô trên cơ sở dữ liệu ngành giáo dục.',
      cachXuLy: ['Liên hệ cán bộ phụ trách của nhà trường.', 'Hoặc gửi email hỗ trợ kèm họ tên, ngày sinh, trường công tác.'],
    },
    {
      nhom: 'dang-nhap',
      nhanNhom: 'Đăng nhập',
      tinhHuong: 'Chưa có tên trong danh sách học viên, chưa có mã định danh',
      nguyenNhan:
        'Tài khoản không tự đăng ký được. Ban tổ chức chỉ tạo tài khoản cho người có tên trong danh sách học viên, lấy từ cơ sở dữ liệu ngành (CSDL MOET) do Sở/Phòng/nhà trường gửi. Chưa có tên trong danh sách này thì chưa có tài khoản để đăng nhập.',
      cachXuLy: [
        'Liên hệ cán bộ phụ trách của nhà trường để được bổ sung vào danh sách học viên.',
        `Hoặc gửi email tới ${EMAIL_HO_TRO} kèm họ tên, ngày sinh, mã định danh MOET (nếu biết), trường, xã/phường, số điện thoại (mẫu ở Phần 13).`,
      ],
    },
    {
      nhom: 'dang-nhap',
      nhanNhom: 'Mật khẩu',
      tinhHuong: 'Không đổi được mật khẩu mới, nút không có tác dụng',
      nguyenNhan: 'Mật khẩu mới chưa đạt đủ 4 điều kiện.',
      cachXuLy: [
        'Ít nhất 8 ký tự.',
        'Có cả chữ và số, ví dụ **hoahong2026**.',
        'Không được là ngày sinh và không trùng mật khẩu cũ.',
        'Hai ô mật khẩu mới phải gõ giống hệt nhau.',
      ],
    },
    {
      nhom: 'dang-nhap',
      nhanNhom: 'Đăng nhập',
      tinhHuong: '"Phiên đăng nhập đã hết hạn"',
      nguyenNhan: 'Để trang mở quá lâu không thao tác, hoặc đã đăng xuất ở thẻ khác.',
      cachXuLy: ['Đăng nhập lại.', 'Nếu đang sửa hồ sơ dở, kiểm tra và nhập lại các ô chưa kịp lưu.'],
    },
    {
      nhom: 'ho-so',
      nhanNhom: 'Hồ sơ',
      tinhHuong: '"Hiện không trong thời gian chỉnh sửa hồ sơ" · các ô không sửa được',
      nguyenNhan: 'Ban tổ chức chưa mở đợt xác nhận, hoặc đợt đã kết thúc.',
      cachXuLy: ['Chờ thông báo mở đợt xác nhận.', 'Nếu thông tin sai cần sửa gấp, gửi yêu cầu hỗ trợ kèm thông tin đúng.'],
    },
    {
      nhom: 'ho-so',
      nhanNhom: 'Hồ sơ',
      tinhHuong: 'Số CCCD báo đã có người sử dụng',
      nguyenNhan: 'Số CCCD gõ nhầm, hoặc đã có hồ sơ khác dùng số này.',
      cachXuLy: [
        'Đối chiếu lại từng số với thẻ căn cước, đủ 12 số.',
        'Nếu chắc chắn đúng, gửi yêu cầu hỗ trợ. Không tự tạo thêm tài khoản khác.',
      ],
    },
    {
      nhom: 'ho-so',
      nhanNhom: 'Hồ sơ',
      tinhHuong: 'Số điện thoại báo không hợp lệ',
      nguyenNhan: 'Số điện thoại phải có 10 chữ số và bắt đầu bằng số 0.',
      cachXuLy: ['Gõ liền, không dấu cách hay dấu chấm, ví dụ **0912345678**.', 'Không ghi mã quốc gia +84.'],
    },
    {
      nhom: 'ho-so',
      nhanNhom: 'Hồ sơ',
      tinhHuong: 'Không chọn được phường/xã, hoặc phường/xã bị xóa',
      nguyenNhan: 'Danh sách phường/xã phụ thuộc tỉnh/thành đã chọn. Đổi tỉnh thì phường/xã cũ bị xóa.',
      cachXuLy: ['Chọn tỉnh/thành trước.', 'Sau đó mở ô phường/xã và chọn lại.'],
    },
    {
      nhom: 'ho-so',
      nhanNhom: 'Hồ sơ',
      tinhHuong: 'Không tìm thấy trường công tác trong danh sách',
      nguyenNhan: 'Cần gõ đủ chữ để hệ thống gợi ý. Tên trường có thể khác cách gọi quen thuộc.',
      cachXuLy: [
        'Gõ phần tên riêng của trường, ví dụ "Nguyễn Du" thay vì "Trường THCS".',
        'Gõ có dấu tiếng Việt.',
        'Vẫn không có: gửi yêu cầu hỗ trợ, ghi tên trường và xã/phường.',
      ],
    },
    {
      nhom: 'ho-so',
      nhanNhom: 'Hồ sơ',
      tinhHuong: 'Họ tên hiện cảnh báo vàng về viết hoa',
      nguyenNhan: 'Họ tên chưa viết hoa chữ cái đầu mỗi tiếng.',
      cachXuLy: ['Bấm nút [[Dùng dạng chuẩn]] ngay dưới ô để hệ thống sửa giúp.', 'Kiểm tra lại dấu thanh, rồi bấm Lưu.'],
    },
    {
      nhom: 'ho-so',
      nhanNhom: 'Xác nhận',
      tinhHuong: 'Nút "Xác nhận" bị mờ, không bấm được',
      nguyenNhan: 'Hồ sơ còn lỗi (khung đỏ), hoặc chưa tích ô cam kết.',
      cachXuLy: [
        'Xem khung đỏ, bấm [[Sửa]] cạnh từng lỗi, sửa xong bấm Lưu.',
        'Quay lại trang Xác nhận, tích ô cam kết rồi bấm Xác nhận.',
      ],
    },
    {
      nhom: 'ho-so',
      nhanNhom: 'Xác nhận',
      tinhHuong: 'Hộp thông báo "Cần xác nhận lại"',
      nguyenNhan: 'Thầy/Cô đã sửa hồ sơ sau khi xác nhận, nên lần xác nhận cũ không còn hiệu lực.',
      cachXuLy: ['Bấm [[Xác nhận lại]].', 'Làm lại các bước ở Phần 9 trước hạn chót.'],
    },
    {
      nhom: 'khao-sat',
      nhanNhom: 'Khảo sát',
      tinhHuong: 'Nút phiếu màu xám, ghi "Đường dẫn đang được cập nhật"',
      nguyenNhan: 'Ban tổ chức chưa mở phiếu này.',
      cachXuLy: ['Chờ thông báo, sau đó tải lại trang.'],
    },
    {
      nhom: 'khao-sat',
      nhanNhom: 'Khảo sát',
      tinhHuong: 'Không thấy nút làm khảo sát, chỉ thấy "Thầy/Cô cần hoàn thành cập nhật các thông tin sau…"',
      nguyenNhan: 'Hồ sơ còn thiếu thông tin bắt buộc. Khảo sát chỉ mở khi hồ sơ đầy đủ. Hay thiếu nhất là mục Đối tượng.',
      cachXuLy: [
        'Bấm [[Cập nhật thông tin hồ sơ]].',
        'Bổ sung đúng các mục được liệt kê trong khung vàng, nhớ chọn **Đối tượng**.',
        'Bấm [[Lưu]], quay về Trang chủ và tải lại trang. Khung chuyển xanh là làm được.',
      ],
    },
    {
      nhom: 'khao-sat',
      nhanNhom: 'Khảo sát',
      tinhHuong: 'Đã chọn sai Đối tượng (Giáo viên / Cán bộ quản lý)',
      nguyenNhan: 'Bộ phiếu khảo sát mở theo Đối tượng đã chọn trong hồ sơ.',
      cachXuLy: [
        '**Chưa làm phiếu:** vào Hồ sơ, chọn lại Đối tượng, bấm Lưu rồi mới làm khảo sát.',
        '**Đã làm phiếu:** vẫn sửa lại Đối tượng trong Hồ sơ, sau đó gửi email hỗ trợ ghi rõ họ tên, mã định danh, đối tượng đúng để được hướng dẫn làm lại.',
      ],
    },
    {
      nhom: 'khao-sat',
      nhanNhom: 'Khảo sát',
      tinhHuong: 'Bấm nút làm khảo sát nhưng báo lỗi, không chuyển trang',
      nguyenNhan: 'Mạng chập chờn hoặc phiên đăng nhập đã hết hạn.',
      cachXuLy: [
        'Tải lại trang, đăng nhập lại nếu được yêu cầu.',
        'Bấm lại nút làm khảo sát (mỗi lần chỉ bấm một lần).',
        'Vẫn lỗi: gửi yêu cầu hỗ trợ, chụp màn hình thông báo lỗi.',
      ],
    },
    {
      nhom: 'khao-sat',
      nhanNhom: 'Khảo sát',
      tinhHuong: 'Lỡ làm phiếu 2 trước phiếu 1, hoặc trả lời nhầm trong phiếu',
      nguyenNhan: 'Phiếu đã gửi không tự sửa được.',
      cachXuLy: ['Nếu chưa làm phiếu 1, làm ngay phiếu 1.', 'Gửi email hỗ trợ, ghi rõ đã làm nhầm phiếu nào, lúc nào.'],
    },
    {
      nhom: 'khao-sat',
      nhanNhom: 'Khảo sát',
      tinhHuong: 'Bài khảo sát hiện nhãn "Cần kiểm tra lại"',
      nguyenNhan: 'Thầy/Cô đã mở phiếu khảo sát từ lâu nhưng hệ thống chưa nhận được bài nộp.',
      cachXuLy: [
        'Bấm [[Mở lại trang khảo sát]].',
        'Vào lại phiếu, kiểm tra các câu đã trả lời và bấm nút nộp bài ở cuối phiếu.',
        `Vẫn không hết: gửi yêu cầu hỗ trợ hoặc email tới ${EMAIL_HO_TRO}, ghi rõ đã làm phiếu nào.`,
      ],
    },
    {
      nhom: 'khao-sat',
      nhanNhom: 'Khảo sát',
      tinhHuong: 'Đã làm xong nhưng vẫn hiện "Chưa làm" hoặc "Đã mở, chưa nộp"',
      nguyenNhan:
        'Trạng thái lấy từ hệ thống khảo sát, có thể cập nhật chậm vài phút sau khi nộp bài; hoặc Thầy/Cô chưa bấm nút nộp bài ở cuối phiếu.',
      cachXuLy: [
        'Chờ vài phút rồi tải lại trang.',
        'Bấm [[Làm tiếp]], kiểm tra đã bấm nút nộp bài ở cuối phiếu chưa.',
        'Sau 30 phút vẫn không đổi: gửi yêu cầu hỗ trợ hoặc email, ghi rõ thời điểm đã nộp bài.',
      ],
    },
    {
      nhom: 'khao-sat',
      nhanNhom: 'Khảo sát',
      tinhHuong: 'Trang khảo sát báo liên kết hết hạn, hoặc không vào được sau khi bấm [[Làm bài]]',
      nguyenNhan: 'Mã truy cập chỉ có giá trị vài phút kể từ lúc bấm nút.',
      cachXuLy: [
        'Quay lại Trang chủ trên boiduongnls.hcmue.edu.vn.',
        'Bấm lại [[Làm khảo sát đầu vào]] rồi bấm nút của phiếu để lấy mã mới.',
        'Vẫn lỗi: gửi yêu cầu hỗ trợ, chụp màn hình thông báo lỗi.',
      ],
    },
    {
      nhom: 'khao-sat',
      nhanNhom: 'Zalo',
      tinhHuong: 'Không thấy khối "Cụm hỗ trợ Zalo" trong trang Lớp học',
      nguyenNhan: 'Ban tổ chức chưa xếp Thầy/Cô vào cụm hỗ trợ.',
      cachXuLy: [
        'Tải lại trang sau ít giờ.',
        'Nếu đồng nghiệp cùng trường đã có cụm mà Thầy/Cô chưa có, gửi yêu cầu hỗ trợ.',
      ],
    },
    {
      nhom: 'khao-sat',
      nhanNhom: 'Zalo',
      tinhHuong: 'Bấm "Vào nhóm Zalo" nhưng không mở được nhóm',
      nguyenNhan: 'Máy chưa cài Zalo, hoặc đang mở trên máy tính.',
      cachXuLy: [
        'Trên điện thoại: cài Zalo, đăng nhập Zalo rồi bấm lại nút.',
        'Trên máy tính: Zalo mở trang có mã QR. Mở Zalo trên điện thoại, chọn biểu tượng quét mã QR và quét mã đó.',
        'Nếu nhóm yêu cầu duyệt, chờ trưởng nhóm duyệt.',
      ],
    },
    {
      nhom: 'khao-sat',
      nhanNhom: 'Đánh giá',
      tinhHuong: '"Đã hết thời gian xác nhận để làm bài đánh giá"',
      nguyenNhan: 'Đợt xác nhận đã đóng khi hồ sơ chưa đủ điều kiện.',
      cachXuLy: ['Gửi email hỗ trợ ngay, ghi họ tên, mã định danh, trường công tác để được hướng dẫn.'],
    },
    {
      nhom: 'khao-sat',
      nhanNhom: 'Lớp học',
      tinhHuong: '"Thầy/Cô chưa được ghi danh vào khóa bồi dưỡng nào"',
      nguyenNhan: 'Ban tổ chức chưa xếp lớp xong.',
      cachXuLy: ['Chờ thông báo xếp lớp.', 'Nếu bạn bè cùng trường đã có lớp mà Thầy/Cô chưa có, gửi yêu cầu hỗ trợ.'],
    },
    {
      nhom: 'email',
      nhanNhom: 'Email',
      tinhHuong: 'Không nhận được email từ hệ thống',
      nguyenNhan: 'Thư có thể vào mục Thư rác/Quảng cáo, hoặc email trong hồ sơ bị gõ sai.',
      cachXuLy: [
        'Mở hộp thư, xem cả **Thư rác (Spam)**, **Quảng cáo**, **Cập nhật**.',
        'Kiểm tra lại email trong trang Hồ sơ.',
        'Đánh dấu thư từ hệ thống là "Không phải thư rác" để lần sau nhận bình thường.',
      ],
    },
    {
      nhom: 'email',
      nhanNhom: 'Email',
      tinhHuong: '"Liên kết không hợp lệ hoặc đã hết hạn" khi bấm liên kết trong thư',
      nguyenNhan: 'Liên kết đã dùng rồi, hoặc đã quá thời hạn.',
      cachXuLy: [
        'Xác minh email: vào Hồ sơ, bấm [[Gửi lại email xác minh]], dùng thư mới nhất.',
        'Đặt lại mật khẩu: làm lại bước [[Quên mật khẩu?]].',
      ],
    },
  ],

  contact: {
    email: EMAIL_HO_TRO,
    gioiThieu:
      'Viết email đủ thông tin theo mẫu dưới đây giúp cán bộ hỗ trợ xử lý ngay, không phải hỏi lại. Thầy/Cô **chưa đăng nhập được vì chưa có tên trong danh sách học viên** cũng dùng email này — đây là cách duy nhất để liên hệ trong trường hợp đó, vì mục Hỗ trợ trong hệ thống (Phần 11) cần đăng nhập mới dùng được.',
    mauEmail: [
      'Tiêu đề: [Hỗ trợ BDNLS] Họ tên – vấn đề gặp phải',
      '',
      'Họ và tên:',
      'Ngày sinh:',
      'Mã định danh MOET (nếu biết):',
      'Trường công tác, xã/phường, tỉnh/thành:',
      'Số điện thoại:',
      'Vấn đề gặp phải (đang làm bước nào, màn hình báo gì):',
      'Thời điểm gặp lỗi:',
      '(Đính kèm ảnh chụp màn hình nếu có)',
    ],
    anToan: [
      'Chỉ đăng nhập tại **boiduongnls.hcmue.edu.vn**. Cảnh giác với trang có địa chỉ na ná.',
      'Thư chính thức gửi từ địa chỉ có đuôi **@hcmue.edu.vn**.',
      'Bấm [[Đăng xuất]] khi dùng máy tính chung ở trường hoặc quán.',
      'Không chia sẻ mật khẩu, kể cả với đồng nghiệp làm hộ.',
    ],
  },

  cachTraCuu: {
    tieuDe: 'Cách tìm và tra cứu tài liệu hướng dẫn',
    buoc: [
      'Mở trình duyệt, vào **boiduongnls.hcmue.edu.vn** (trang giới thiệu chương trình).',
      'Bấm nút [[Hướng dẫn sử dụng]] ngay ở phần đầu trang (cũng có trên thanh menu và ở cuối trang). Ở trang đăng nhập có dòng [[Lần đầu sử dụng? Xem hướng dẫn từng bước có hình minh họa]]; sau khi đăng nhập có mục [[Hướng dẫn]] trên menu. Có thể gõ thẳng boiduongnls.hcmue.edu.vn/huong-dan.',
      'Xem **Mục lục**: trên máy tính nằm ở cột bên trái; trên điện thoại dùng ô [[Đi tới phần]] ở đầu trang. Bấm tên mục để nhảy tới mục đó. Chọn kiểu hình [[Máy tính]] hoặc [[Điện thoại]] cho đúng thiết bị đang dùng.',
      'Gặp lỗi: vào mục **Lỗi thường gặp và cách khắc phục**, gõ vài chữ của thông báo trên màn hình vào ô tìm kiếm (gõ không dấu cũng được) hoặc chọn nhóm vấn đề.',
      'Chưa tìm được cách xử lý: xem mục **Liên hệ hỗ trợ** để gửi email theo mẫu, hoặc gửi yêu cầu tại mục [[Hỗ trợ]] sau khi đăng nhập.',
    ],
  },
};

/** Tóm tắt 1 dòng của Phụ lục "Nhóm Zalo hỗ trợ theo cụm" (nhomZaloTheoCum.ts) — dùng cho mục
 * "Cách tìm và tra cứu tài liệu hướng dẫn" (bản in Word), cùng vị trí với tomTat của parts[]. */
export const TOM_TAT_PHU_LUC_ZALO =
  'Tra tên trường để tìm đúng nhóm Zalo hỗ trợ của cụm khi chưa thấy nút Vào nhóm Zalo.';

/** Danh sách phần theo đúng thứ tự hiển thị ở trang Hướng dẫn (M9) — nguồn duy nhất cho việc đánh
 * số "Phần N": parts[] rồi tới "Lỗi thường gặp" (Phần 12) và "Liên hệ hỗ trợ" (Phần 13). Dùng để
 * build mục lục (HuongDan.tsx) và để tra id phần cho các mention "Phần N" trong nội dung (xem
 * idPhanTheoSo). Nơi khác không tự đánh số lại. */
export const DANH_SACH_PHAN_THEO_THU_TU: { id: string; tieuDe: string; tomTat?: string }[] = [
  ...huongDan.parts.map((p) => ({ id: p.id, tieuDe: p.tieuDe, tomTat: p.tomTat })),
  {
    id: 'loi',
    tieuDe: 'Lỗi thường gặp và cách khắc phục',
    tomTat: 'Khi gặp thông báo lỗi, tra theo từ khóa hoặc nhóm vấn đề để tìm cách xử lý.',
  },
  {
    id: 'lien-he',
    tieuDe: 'Liên hệ hỗ trợ và an toàn tài khoản',
    tomTat: 'Xem email hỗ trợ, mẫu email gửi yêu cầu và cách giữ an toàn tài khoản.',
  },
];

/** Tra id phần theo số thứ tự "Phần N" (1-based) dùng trong nội dung. Trả về undefined nếu không
 * có phần đó — TextMarkup giữ nguyên văn bản trong trường hợp này (xem lienKetPhan). */
export function idPhanTheoSo(so: number): string | undefined {
  return DANH_SACH_PHAN_THEO_THU_TU[so - 1]?.id;
}
