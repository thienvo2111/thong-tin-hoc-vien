// src/content/gioiThieu.ts
// Nội dung trang giới thiệu (M0). Dùng chung cho nhiều tỉnh — KHÔNG ghi tên tỉnh.
// Khối có `tam: true` là nội dung tạm, đơn vị tổ chức sẽ thay. Chuỗi bắt đầu bằng "[CHỜ" là thông tin còn thiếu.
// Chỉ sửa file này để đổi nội dung; không sửa component.
// Mục có `cheDo` chỉ hiện khi khớp chế độ triển khai hiện tại ('khao_sat' | 'dang_nhap') — quản trị chọn tại /admin/cau-hinh-khao-sat.

import type { CheDoHocVien } from './trienKhai';

export interface Khoi {
  hien: boolean;
  tam?: boolean;
  cheDo?: CheDoHocVien;
}

export type MaMucNangLuc = 'co_ban' | 'thanh_thao' | 'nang_cao';

export interface NoiDungGioiThieu {
  meta: { tieuDe: string; moTa: string; anhChiaSe: string };
  thongBaoNoiBat: string | null;
  moDau: Khoi & { tenChuongTrinh: string; thongDiep: string; nutChinh: string; nutKhaoSat: string; nutPhu: string; chiTietNhanh: string[] };
  conSo: Khoi & { muc: { so: string; nhan: string }[] };
  viSao: Khoi & {
    tieuDe: string;
    doanMo: string;
  };
  doiTuong: Khoi & { tieuDe: string; nhom: string[]; dieuKienChungNhan: string[] };
  /** Phần chữ của khối khảo sát. Danh sách phiếu, đường dẫn và bật/tắt khối do quản trị cấu hình tại
   * /admin/cau-hinh-khao-sat (mặc định trong content/trienKhai.ts). */
  khaoSatDauVao: { tam?: boolean; tieuDe: string; moTa: string; sauKhaoSat: string[] };
  loTrinh: Khoi & { tieuDe: string; buoc: { ten: string; moTa: string; cheDo?: CheDoHocVien }[] };
  noiDung: Khoi & {
    tieuDe: string;
    tongTietMoiMuc: number;
    tyLeHinhThucMoiMuc: string;
    danhSachMuc: {
      ma: MaMucNangLuc;
      ten: string;
      doiTuongPhuHop: string;
      mucTieu: string[];
      chuyenDe: { ten: string; moTa: string }[];
    }[];
  };
  huongDan: Khoi & { tieuDe: string; buoc: { ten: string; moTa: string }[] };
  hoiDap: Khoi & { tieuDe: string; cau: { hoi: string; dap: string; cheDo?: CheDoHocVien }[] };
  lienHe: Khoi & { tieuDe: string; hotline: string; zalo: string; email: string; gioHoTro: string };
  hopTac: Khoi & { tieuDe: string; moTa: string; hotline: string; email: string };
  donVi: Khoi & {
    toChuc: { ten: string; logo: string; diaChi: string };
    phoiHop: { ten: string; logo: string; hien: boolean }[];
  };
}

export const gioiThieu: NoiDungGioiThieu = {
  meta: {
    tieuDe: 'Bồi dưỡng năng lực số cho giáo viên',
    moTa: 'Chương trình bồi dưỡng năng lực số cho giáo viên do Trường Đại học Sư phạm Thành phố Hồ Chí Minh tổ chức. Thông tin chương trình, khảo sát đầu vào và cổng thông tin học viên.',
    anhChiaSe: '/og-image.png', // [CHỜ] ảnh 1200×630
  },

  // Dải thông báo trên cùng; null = ẩn. Ví dụ: 'Đợt kiểm tra hồ sơ mở đến 23:59 ngày 04/10/2026.'
  thongBaoNoiBat: null,

  moDau: {
    hien: true,
    tam: true,
    tenChuongTrinh: 'Bồi dưỡng năng lực số cho giáo viên',
    thongDiep: 'Cùng thầy cô làm chủ công nghệ số trong dạy học và công tác chuyên môn.',
    nutChinh: 'Đăng nhập cổng học viên',
    nutKhaoSat: 'Làm khảo sát đầu vào', // dùng khi cheDoHocVien = 'khao_sat'
    nutPhu: 'Tìm hiểu chương trình',
    chiTietNhanh: [
      '100 tiết mỗi mức (70 trực tuyến + 30 trực tiếp)',
      '07 chuyên đề',
      '3 mức: Cơ bản - Thành thạo - Nâng cao, xếp theo kết quả đánh giá đầu vào',
    ],
  },

  conSo: {
    hien: false, // bật khi có số liệu chính thức
    tam: true,
    muc: [
      { so: '[CHỜ]', nhan: 'tỉnh, thành đã triển khai' },
      { so: '[CHỜ]', nhan: 'giáo viên tham gia' },
    ],
  },

  viSao: {
    hien: true,
    tam: false,
    tieuDe: 'Chương trình theo 3 mức năng lực',
    doanMo:
      'Chương trình gồm 3 mức Cơ bản, Thành thạo và Nâng cao, mỗi mức 100 tiết (70 trực tuyến và 30 trực tiếp) với cùng 07 chuyên đề. Việc xếp mức căn cứ trên kết quả khảo sát năng lực số đầu vào do Trường Đại học Sư phạm Thành phố Hồ Chí Minh phối hợp với Sở Giáo dục và Đào tạo địa phương tổ chức trước khi khai giảng — học viên được xếp vào 1 trong 3 mức phù hợp với năng lực hiện có.',
  },

  doiTuong: {
    hien: true,
    tam: false,
    tieuDe: 'Đối tượng người học',
    nhom: [
      'Giáo viên mầm non.',
      'Giáo viên tiểu học.',
      'Giáo viên trung học cơ sở và trung học phổ thông.',
      'Cán bộ quản lí cơ sở giáo dục mầm non và phổ thông.',
    ],
    dieuKienChungNhan: [
      'Học viên hoàn thành chương trình khi đạt tất cả các chuyên đề với kết quả trên 5 điểm (thang điểm 0-10 mỗi chuyên đề).',
      'Học viên hoàn thành chương trình được cấp Chứng nhận của Hiệu trưởng Trường Đại học Sư phạm Thành phố Hồ Chí Minh.',
    ],
  },

  khaoSatDauVao: {
    tam: true,
    tieuDe: 'Khảo sát đầu vào',
    moTa: 'Thầy/Cô không cần đăng nhập. Vui lòng thực hiện lần lượt các phiếu dưới đây theo đúng thứ tự, hoàn thành phiếu trước rồi mới làm phiếu sau. Thông tin cá nhân được kê khai, bổ sung ngay trong phiếu — đề nghị Thầy/Cô điền chính xác theo hướng dẫn.',
    sauKhaoSat: [
      'Ban tổ chức tổng hợp thông tin, kết quả đánh giá; xếp mức năng lực và chia lớp.',
      'Khi có thông báo, Thầy/Cô đăng nhập hệ thống để xem thông tin hồ sơ và lớp học (chỉ xem).',
      'Việc kiểm tra, điều chỉnh thông tin hồ sơ được mở lại ở đợt xác nhận cuối khóa, trước khi cấp chứng nhận.',
    ],
  },

  loTrinh: {
    hien: true,
    tam: true,
    tieuDe: 'Lộ trình học',
    buoc: [
      { ten: 'Khảo sát kĩ năng số', moTa: 'Bổ sung thông tin cá nhân và thực hiện phiếu khảo sát kĩ năng số (không cần đăng nhập).', cheDo: 'khao_sat' },
      { ten: 'Đánh giá năng lực số', moTa: 'Làm phiếu đánh giá năng lực số để xác định mức năng lực và xếp lớp phù hợp.', cheDo: 'khao_sat' },
      { ten: 'Kiểm tra hồ sơ', moTa: 'Đăng nhập, kiểm tra và bổ sung thông tin cá nhân, xác nhận hồ sơ.', cheDo: 'dang_nhap' },
      { ten: 'Đánh giá đầu vào', moTa: 'Làm bài đánh giá trực tuyến để xác định mức năng lực và xếp lớp phù hợp.', cheDo: 'dang_nhap' },
      { ten: 'Học trực tuyến qua Zoom', moTa: 'Các buổi học trực tuyến cùng giảng viên theo lịch của lớp.' },
      { ten: 'Học trực tuyến trên VLE lần 1', moTa: 'Thực hiện các nhiệm vụ trên hệ thống học tập trực tuyến với sự hướng dẫn của giảng viên.' },
      { ten: 'Tập huấn trực tiếp', moTa: 'Học tập, thực hành cùng giảng viên tại điểm học gần nơi công tác.' },
      { ten: 'Học trên VLE lần 2', moTa: 'Thực hiện các nhiệm vụ trên hệ thống học tập trực tuyến với sự hướng dẫn của giảng viên.' },
      { ten: 'Xác nhận thông tin học viên', moTa: 'Kiểm tra kỹ mã định danh trên MOET, họ và tên, ngày tháng năm sinh — đây là những thông tin quan trọng dùng để đối chiếu hồ sơ và in trên giấy chứng nhận.' },
      { ten: 'Đánh giá đầu ra & chứng nhận', moTa: 'Làm bài đánh giá cuối khóa; học viên đạt yêu cầu được cấp giấy chứng nhận điện tử.' },
      { ten: 'Khảo sát đánh giá khóa bồi dưỡng', moTa: 'Thực hiện khảo sát đánh giá về chương trình, giảng viên và công tác tổ chức — đây là hoạt động bắt buộc để hoàn tất khóa bồi dưỡng.' },
    ],
  },

  noiDung: {
    hien: true,
    tam: false,
    tieuDe: 'Chương trình bồi dưỡng theo 3 mức năng lực',
    tongTietMoiMuc: 100,
    tyLeHinhThucMoiMuc: '70 trực tuyến + 30 trực tiếp',
    danhSachMuc: [
      {
        ma: 'co_ban',
        ten: 'Cơ bản',
        doiTuongPhuHop:
          'Giáo viên, cán bộ quản lý cơ sở giáo dục mầm non và phổ thông có kết quả khảo sát năng lực số đầu vào tương ứng mức "Cơ bản" theo Khung năng lực số (Thông tư số 18/2026/TT-BGDĐT); cụ thể là những giáo viên, CBQLCSGD mới bắt đầu tiếp cận, làm quen với việc ứng dụng công nghệ số trong dạy học, giáo dục và quản lý giáo dục.',
        mucTieu: [
          'Trình bày được cấu trúc chung và bước đầu vận dụng được Khung năng lực số đối với giáo viên và CBQL cơ sở giáo dục mầm non, phổ thông theo Thông tư số 18/2026/TT-BGDĐT vào thực tiễn công tác.',
          'Thực hiện được một số hoạt động dạy học, giáo dục cơ bản có ứng dụng công nghệ số theo hướng dẫn, mẫu có sẵn.',
          'Sử dụng được một số công cụ số đơn giản trong kiểm tra, đánh giá người học.',
          'Sử dụng được một số công cụ số cơ bản để tăng cường sự tham gia của người học.',
          'Thực hiện được các kĩ năng công nghệ số nền tảng; bước đầu bảo đảm an toàn số, đạo đức số.',
          'Sử dụng được một số kênh kết nối số cơ bản giữa nhà trường, gia đình.',
          'Làm quen và sử dụng được công cụ trí tuệ nhân tạo (AI) phổ biến hỗ trợ dạy học, giáo dục ở mức cơ bản, đúng quy định.',
        ],
        chuyenDe: [
          {
            ten: 'Tìm hiểu Khung năng lực số đối với giáo viên (GV) và cán bộ quản lý cơ sở giáo dục (CBQLCSGD) mầm non và phổ thông',
            moTa: 'Làm quen cấu trúc Khung năng lực số, tự đánh giá năng lực số cá nhân theo mẫu hướng dẫn.',
          },
          {
            ten: 'Phát triển năng lực tổ chức dạy học, giáo dục trong môi trường số cho GV, CBQLCSGD',
            moTa: 'Làm quen công cụ, nền tảng số phổ biến; thực hiện một hoạt động dạy học đơn giản có ứng dụng công nghệ số.',
          },
          {
            ten: 'Sử dụng công nghệ số trong kiểm tra, đánh giá người học',
            moTa: 'Làm quen công cụ tạo đề, khảo sát trực tuyến đơn giản phục vụ kiểm tra, đánh giá.',
          },
          {
            ten: 'Ứng dụng công nghệ số thúc đẩy sự tích cực của người học',
            moTa: 'Làm quen một số công cụ số đơn giản tăng tương tác, thúc đẩy sự tham gia của người học.',
          },
          {
            ten: 'Phát triển kĩ năng công nghệ số cho GV, CBQLCSGD',
            moTa: 'Tìm kiếm thông tin cơ bản, thiết kế học liệu số đơn giản, thực hiện bảo mật tài khoản cá nhân.',
          },
          {
            ten: 'Sử dụng công nghệ số để kết nối nhà trường, gia đình và xã hội',
            moTa: 'Sử dụng một kênh liên lạc số cơ bản để kết nối với cha mẹ người học.',
          },
          {
            ten: 'Ứng dụng trí tuệ nhân tạo trong dạy học và giáo dục',
            moTa: 'Làm quen khái niệm AI, sử dụng công cụ AI tạo sinh phổ biến hỗ trợ soạn nội dung đơn giản, đúng đạo đức.',
          },
        ],
      },
      {
        ma: 'thanh_thao',
        ten: 'Thành thạo',
        doiTuongPhuHop:
          'Giáo viên, cán bộ quản lý cơ sở giáo dục mầm non và phổ thông có kết quả khảo sát năng lực số đầu vào tương ứng mức "Thành thạo" theo Khung năng lực số (Thông tư số 18/2026/TT-BGDĐT); cụ thể đã có nền tảng sử dụng công nghệ số cơ bản, có nhu cầu thành thạo năng lực thiết kế, tổ chức các hoạt động dạy học, giáo dục và quản lý trong môi trường số.',
        mucTieu: [
          'Hiểu và vận dụng được Khung năng lực số đối với GV và CBQL cơ sở giáo dục mầm non, phổ thông theo Thông tư số 18/2026/TT-BGDĐT của Bộ Giáo dục và Đào tạo vào thực tiễn công tác.',
          'Thiết kế, tổ chức và quản lí hiệu quả các hoạt động dạy học, giáo dục trong môi trường số.',
          'Ứng dụng công nghệ số trong kiểm tra, đánh giá, phân tích dữ liệu học tập và hỗ trợ người học.',
          'Sử dụng công nghệ số để tăng cường sự tham gia tích cực, tự chủ và cá nhân hóa học tập của người học.',
          'Phát triển kĩ năng công nghệ số, bảo đảm an toàn số, đạo đức số và sử dụng dữ liệu số hiệu quả.',
          'Thiết lập và sử dụng hiệu quả các kênh kết nối giữa nhà trường, gia đình và xã hội thông qua công nghệ số.',
          'Khai thác, sử dụng trí tuệ nhân tạo (AI) trong dạy học, giáo dục và quản lý giáo dục một cách hiệu quả, có trách nhiệm và phù hợp với quy định hiện hành.',
        ],
        chuyenDe: [
          {
            ten: 'Tìm hiểu Khung năng lực số đối với giáo viên (GV) và cán bộ quản lý cơ sở giáo dục (CBQLCSGD) mầm non và phổ thông',
            moTa: 'Tìm hiểu cấu trúc chung của khung năng lực số, tự đánh giá mức độ năng lực và lập kế hoạch phát triển năng lực số cá nhân.',
          },
          {
            ten: 'Phát triển năng lực tổ chức dạy học, giáo dục trong môi trường số cho GV, CBQLCSGD',
            moTa: 'Thiết kế, tổ chức các hoạt động dạy học, giáo dục sử dụng các giải pháp, công cụ và nền tảng số phù hợp.',
          },
          {
            ten: 'Sử dụng công nghệ số trong kiểm tra, đánh giá người học',
            moTa: 'Ứng dụng công nghệ để tạo đề, khảo sát trực tuyến, thu thập và phân tích dữ liệu học tập nhằm cải tiến dạy học.',
          },
          {
            ten: 'Ứng dụng công nghệ số thúc đẩy sự tích cực của người học',
            moTa: 'Xây dựng môi trường học tập số, học tập trải nghiệm, học tập dự án và công tác lấy người học làm trung tâm.',
          },
          {
            ten: 'Phát triển kĩ năng công nghệ số cho GV, CBQLCSGD',
            moTa: 'Tìm kiếm, xử lý và quản lý dữ liệu giáo dục, thiết kế học liệu số, đảm bảo an toàn và bảo mật dữ liệu số.',
          },
          {
            ten: 'Sử dụng công nghệ số để kết nối nhà trường, gia đình và xã hội',
            moTa: 'Ứng dụng truyền thông số, xây dựng hệ thống tương tác với cha mẹ học sinh và quản trị cộng đồng học tập trực tuyến.',
          },
          {
            ten: 'Ứng dụng trí tuệ nhân tạo trong dạy học và giáo dục',
            moTa: 'Tổng quan về AI, đạo đức sử dụng AI, kĩ thuật xây dựng câu lệnh và ứng dụng AI hỗ trợ thiết kế học liệu, kiểm tra đánh giá.',
          },
        ],
      },
      {
        ma: 'nang_cao',
        ten: 'Nâng cao',
        doiTuongPhuHop:
          'Giáo viên, cán bộ quản lý cơ sở giáo dục mầm non và phổ thông có kết quả khảo sát năng lực số đầu vào tương ứng mức "Nâng cao" theo Khung năng lực số (Thông tư số 18/2026/TT-BGDĐT); cụ thể là giáo viên cốt cán, CBQLCSGD có năng lực số tốt, có nhu cầu và định hướng dẫn dắt, lan tỏa năng lực số tại tổ chuyên môn/đơn vị công tác.',
        mucTieu: [
          'Phân tích, vận dụng sáng tạo Khung năng lực số đối với giáo viên và CBQL cơ sở giáo dục (Thông tư số 18/2026/TT-BGDĐT) để xây dựng kế hoạch phát triển năng lực số cấp tổ chuyên môn/đơn vị.',
          'Thiết kế, tổ chức và đánh giá, cải tiến có hệ thống các hoạt động dạy học, giáo dục trong môi trường số ở quy mô tổ/khối/nhà trường.',
          'Xây dựng, chuẩn hóa quy trình ứng dụng công nghệ số trong kiểm tra, đánh giá, phân tích dữ liệu học tập ở cấp đơn vị.',
          'Thiết kế, dẫn dắt các hoạt động, dự án học tập số quy mô lớn nhằm thúc đẩy sự tham gia, tự chủ của người học.',
          'Xây dựng, quản trị hệ thống bảo đảm an toàn số, đạo đức số và sử dụng dữ liệu số hiệu quả ở cấp đơn vị; tập huấn, hỗ trợ đồng nghiệp.',
          'Xây dựng chiến lược, quy chế kết nối nhà trường, gia đình và xã hội thông qua công nghệ số ở cấp đơn vị.',
          'Xây dựng chính sách, quy trình khai thác, sử dụng AI có trách nhiệm trong dạy học, giáo dục và quản lý giáo dục; dẫn dắt, tập huấn đồng nghiệp.',
        ],
        chuyenDe: [
          {
            ten: 'Tìm hiểu Khung năng lực số đối với giáo viên (GV) và cán bộ quản lý cơ sở giáo dục (CBQLCSGD) mầm non và phổ thông',
            moTa: 'Đối sánh khung năng lực số, đánh giá năng lực số cấp tổ/đơn vị và xây dựng kế hoạch phát triển năng lực số cấp tổ chuyên môn.',
          },
          {
            ten: 'Phát triển năng lực tổ chức dạy học, giáo dục trong môi trường số cho GV, CBQLCSGD',
            moTa: 'Thiết kế chuỗi bài dạy số tích hợp đa công cụ; xây dựng tiêu chí đánh giá và tập huấn đồng nghiệp thiết kế bài dạy số.',
          },
          {
            ten: 'Sử dụng công nghệ số trong kiểm tra, đánh giá người học',
            moTa: 'Xây dựng ngân hàng đề thi số chuẩn hóa, phân tích dữ liệu học tập nâng cao và chuẩn hóa quy trình kiểm tra đánh giá cấp đơn vị.',
          },
          {
            ten: 'Ứng dụng công nghệ số thúc đẩy sự tích cực của người học',
            moTa: 'Thiết kế dự án học tập số liên môn quy mô tổ/khối; xây dựng bộ tiêu chí đo lường mức độ tích cực của người học.',
          },
          {
            ten: 'Phát triển kĩ năng công nghệ số cho GV, CBQLCSGD',
            moTa: 'Xây dựng kho học liệu số dùng chung và quy trình quản trị an toàn dữ liệu số cấp đơn vị; tập huấn đồng nghiệp.',
          },
          {
            ten: 'Sử dụng công nghệ số để kết nối nhà trường, gia đình và xã hội',
            moTa: 'Xây dựng chiến lược truyền thông số cấp trường và quy chế ứng xử số kết nối nhà trường - gia đình - xã hội.',
          },
          {
            ten: 'Ứng dụng trí tuệ nhân tạo trong dạy học và giáo dục',
            moTa: 'Xây dựng chính sách sử dụng AI có trách nhiệm, tích hợp AI nâng cao vào quản lý dạy học; tập huấn, dẫn dắt đồng nghiệp.',
          },
        ],
      },
    ],
  },

  huongDan: {
    hien: true,
    cheDo: 'dang_nhap', // hướng dẫn đăng nhập — chế độ 'khao_sat' dùng khối khaoSatDauVao thay thế
    tieuDe: 'Bắt đầu trong 4 bước',
    buoc: [
      { ten: 'Nhận mã định danh', moTa: 'Trường sẽ sử dụng mã định danh MOET được cung cấp để làm tên đăng nhập.' },
      { ten: 'Đăng nhập', moTa: 'Đăng nhập bằng mã định danh hoặc số CCCD. Mật khẩu lần đầu là ngày sinh viết liền ngày-tháng-năm, ví dụ 08121983. Hệ thống sẽ yêu cầu đổi mật khẩu mới.' },
      { ten: 'Bổ sung và xác nhận hồ sơ', moTa: 'Kiểm tra thông tin, sửa nếu chưa đúng, bổ sung phần còn thiếu, rồi bấm Xác nhận trong thời gian quy định.' },
      { ten: 'Làm bài đánh giá đầu vào', moTa: 'Khi hồ sơ đã đầy đủ và được xác nhận, đường dẫn làm bài sẽ hiện trên trang của thầy cô.' },
    ],
  },

  hoiDap: {
    hien: true,
    tam: true,
    tieuDe: 'Câu hỏi thường gặp',
    cau: [
      {
        hoi: 'Chương trình có bao nhiêu chuyên đề, thời lượng bao lâu?',
        dap: 'Mỗi mức gồm 07 chuyên đề, tổng 100 tiết (70 tiết trực tuyến và 30 tiết trực tiếp).',
      },
      {
        hoi: 'Tôi được xếp vào mức nào?',
        dap: 'Xếp mức căn cứ trên kết quả bài đánh giá năng lực số đầu vào — học viên làm bài trước khi khai giảng và được xếp vào 1 trong 3 mức Cơ bản, Thành thạo hoặc Nâng cao.',
      },
      {
        hoi: 'Ai là đối tượng tham gia chương trình?',
        dap: 'Giáo viên mầm non, tiểu học, trung học cơ sở và trung học phổ thông, cùng cán bộ quản lí cơ sở giáo dục mầm non và phổ thông.',
      },
      {
        hoi: 'Điều kiện để được cấp giấy chứng nhận là gì?',
        dap: 'Học viên cần đạt tất cả 07 chuyên đề với kết quả trên 5 điểm (thang điểm 0-10) để được cấp Chứng nhận của Hiệu trưởng Trường Đại học Sư phạm Thành phố Hồ Chí Minh.',
      },
      {
        hoi: 'Đơn vị, trường học muốn hợp tác tổ chức bồi dưỡng thì liên hệ thế nào?',
        dap: "Thầy/Cô xem thông tin liên hệ hợp tác ở cuối trang, hoặc điền form 'Hợp tác tổ chức bồi dưỡng' bên dưới.",
      },
      {
        hoi: 'Tôi có cần đăng nhập để làm khảo sát không?',
        dap: 'Không. Thầy/Cô mở đường dẫn ở mục Khảo sát đầu vào trên trang này và làm lần lượt 2 phiếu: Phiếu khảo sát kĩ năng số, sau đó là Phiếu đánh giá năng lực số.',
        cheDo: 'khao_sat',
      },
      {
        hoi: 'Sau khi làm khảo sát, khi nào tôi biết lớp học của mình?',
        dap: 'Sau khi Ban tổ chức tổng hợp kết quả và chia lớp, Thầy/Cô sẽ được thông báo để đăng nhập hệ thống xem thông tin hồ sơ và lớp học.',
        cheDo: 'khao_sat',
      },
      {
        hoi: 'Tôi kê khai sai thông tin trong phiếu thì sao?',
        dap: 'Thầy/Cô liên hệ số hỗ trợ ở cuối trang. Thông tin hồ sơ sẽ được mở để kiểm tra, điều chỉnh ở đợt xác nhận cuối khóa, trước khi cấp chứng nhận.',
        cheDo: 'khao_sat',
      },
      { hoi: 'Tôi không biết mã định danh của mình?', dap: 'Thầy cô liên hệ bộ phận phụ trách của nhà trường hoặc số hỗ trợ ở cuối trang.', cheDo: 'dang_nhap' },
      { hoi: 'Mật khẩu lần đầu là gì?', dap: 'Là ngày sinh viết liền theo dạng ngày-tháng-năm, đủ 8 chữ số. Ví dụ: sinh ngày 8/12/1983 thì nhập 08121983.', cheDo: 'dang_nhap' },
      { hoi: 'Tôi quên mật khẩu mới đã đổi?', dap: 'Thầy cô liên hệ số hỗ trợ. Sau khi xác minh thông tin, cán bộ hỗ trợ sẽ đặt lại mật khẩu về ngày sinh để thầy cô đăng nhập và đổi lại.', cheDo: 'dang_nhap' },
      { hoi: 'Tài khoản báo tạm khóa?', dap: 'Do nhập sai mật khẩu nhiều lần. Vui lòng chờ 15 phút rồi thử lại, hoặc liên hệ số hỗ trợ.', cheDo: 'dang_nhap' },
      { hoi: 'Thông tin của tôi trên hệ thống chưa đúng?', dap: 'Trong thời gian mở đợt kiểm tra, thầy cô tự sửa trực tiếp trên trang Hồ sơ. Họ tên và ngày sinh sẽ in trên giấy chứng nhận, vì vậy cần kiểm tra kỹ.', cheDo: 'dang_nhap' },
      { hoi: 'Vì sao tôi chưa thấy đường dẫn làm bài đánh giá?', dap: 'Đường dẫn chỉ hiện khi hồ sơ đã đầy đủ và thầy cô đã xác nhận trong đợt xác nhận trước đánh giá. Nếu đã sửa hồ sơ sau khi xác nhận, thầy cô cần xác nhận lại.', cheDo: 'dang_nhap' },
      { hoi: 'Tôi có thể làm trên điện thoại không?', dap: 'Có. Trang được thiết kế để dùng tốt trên điện thoại, kể cả khi mở từ Zalo.' },
    ],
  },

  lienHe: {
    hien: true,
    tam: true,
    tieuDe: 'Liên hệ hỗ trợ',
    hotline: '[CHỜ]',
    zalo: '[CHỜ]',
    email: '[CHỜ]',
    gioHoTro: '[CHỜ]',
  },

  hopTac: {
    hien: true,
    tam: true,
    tieuDe: 'Hợp tác tổ chức bồi dưỡng',
    moTa: 'Đơn vị, Sở/Phòng Giáo dục và Đào tạo có nhu cầu triển khai chương trình cho giáo viên, cán bộ quản lý của đơn vị mình vui lòng liên hệ để được tư vấn và hỗ trợ tổ chức.',
    hotline: '[CHỜ]',
    email: '[CHỜ]',
  },

  donVi: {
    hien: true,
    tam: true,
    toChuc: {
      ten: 'Trường Đại học Sư phạm Thành phố Hồ Chí Minh',
      logo: '/logo-hcmue.svg', // [CHỜ] file logo
      diaChi: '[CHỜ]',
    },
    phoiHop: [],
  },
};
