import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { hang_doi_email } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ThongBaoService } from './thong-bao.service';
import {
  getTestMessageUrl,
  guiEmail,
  HetHanMucGuiEmailError,
} from './util/mailer.util';

const SO_DONG_MOI_LUOT = 20;
const SO_LAN_THU_TOI_DA = 3;

// M9 (2026-10-01): drain hang_doi_email (làn "hàng loạt" của ThongBaoService)
// mỗi phút — tối đa min(hạn mức còn lại hôm nay, 20) dòng/lượt, FIFO theo
// created_at, để trải việc gửi hàng loạt (phân lớp, duyệt hồ sơ, ...) qua
// nhiều ngày khi vượt EMAIL_DAILY_LIMIT, tránh gửi dồn dập khiến Google tạm
// khóa/quarantine tài khoản Workspace. Gửi qua mailer.util.ts (guiEmail, tự
// xoay vòng tài khoản) — KHÔNG tạo transporter riêng.
//
// 2026-10-07: mọi tài khoản đều hết hạn mức Google -> DỪNG lượt, giữ nguyên
// cho_gui và KHÔNG tăng so_lan_thu — trước đây lỗi 5.4.5 đốt hết 3 lượt thử
// trong 3 phút rồi chuyển that_bai, thư mất hẳn.
//
// NGUYÊN TẮC "email là side effect" (xem comment đầu thong-bao.service.ts):
// xuLyHangDoi() KHÔNG BAO GIỜ throw — mọi lỗi (gửi thất bại, lỗi DB khi
// update/ghi log) đều bị nuốt và log ra console, để cron tiếp tục chạy ở
// lượt kế tiếp thay vì crash.
@Injectable()
export class HangDoiEmailProcessor {
  constructor(
    private readonly prisma: PrismaService,
    private readonly thongBaoService: ThongBaoService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async xuLyHangDoi(): Promise<void> {
    try {
      const hanMucConLai = await this.thongBaoService.tinhHanMucConLaiHomNay();
      if (hanMucConLai <= 0) return;

      const soLuongLay = Math.min(hanMucConLai, SO_DONG_MOI_LUOT);
      const dongChoGui = await this.prisma.hang_doi_email.findMany({
        where: { trang_thai: 'cho_gui' },
        orderBy: { created_at: 'asc' },
        take: soLuongLay,
      });

      for (const dong of dongChoGui) {
        if (!(await this.guiMotDong(dong))) break;
      }
    } catch (e) {
      console.error('[hang-doi-email] Lỗi xử lý hàng đợi', e);
    }
  }

  /** false = mọi tài khoản hết hạn mức, dừng lượt này (thư giữ nguyên cho_gui). */
  private async guiMotDong(dong: hang_doi_email): Promise<boolean> {
    try {
      const { info } = await guiEmail({
        to: dong.email_nguoi_nhan,
        subject: dong.tieu_de,
        html: dong.noi_dung_html,
      });
      const previewUrl = getTestMessageUrl(info);
      if (previewUrl) {
        console.log(
          `[hang-doi-email] Xem trước email (Ethereal, ${dong.loai_su_kien} -> ${dong.email_nguoi_nhan}): ${previewUrl}`,
        );
      }
      await this.ghiKetQua(dong, 'thanh_cong');
    } catch (e) {
      if (e instanceof HetHanMucGuiEmailError) {
        console.warn(
          `[hang-doi-email] ${e.message} — tạm dừng, thư chờ lượt sau`,
        );
        return false;
      }
      const loi =
        e instanceof Error ? e.message : 'Lỗi không xác định khi gửi email';
      console.error(
        `[hang-doi-email] Gửi email thất bại (id=${dong.id}, lần ${dong.so_lan_thu + 1}): ${loi}`,
      );
      await this.ghiLoiThu(dong, loi);
    }
    return true;
  }

  private async ghiKetQua(
    dong: hang_doi_email,
    trangThai: 'thanh_cong',
  ): Promise<void> {
    try {
      const guiLuc = new Date();
      await this.prisma.hang_doi_email.update({
        where: { id: dong.id },
        data: { trang_thai: trangThai, gui_luc: guiLuc },
      });
      await this.prisma.nhat_ky_thong_bao.create({
        data: {
          loai_su_kien: dong.loai_su_kien,
          hoc_vien_id: dong.hoc_vien_id,
          email_nguoi_nhan: dong.email_nguoi_nhan,
          tieu_de: dong.tieu_de,
          trang_thai: trangThai,
          gui_luc: guiLuc,
        },
      });
    } catch (e) {
      console.error(
        `[hang-doi-email] Không ghi được kết quả thành công (id=${dong.id})`,
        e,
      );
    }
  }

  // < 3 lần: tăng so_lan_thu, giữ trang_thai='cho_gui' để lượt cron sau thử
  // lại — KHÔNG ghi nhat_ky_thong_bao (chưa có kết quả cuối). >= 3 lần:
  // chuyển hẳn 'that_bai' + ghi nhat_ky_thong_bao trang_thai='that_bai'.
  private async ghiLoiThu(dong: hang_doi_email, loi: string): Promise<void> {
    const soLanThuMoi = dong.so_lan_thu + 1;
    const thatBaiHan = soLanThuMoi >= SO_LAN_THU_TOI_DA;
    try {
      const guiLuc = thatBaiHan ? new Date() : undefined;
      await this.prisma.hang_doi_email.update({
        where: { id: dong.id },
        data: {
          so_lan_thu: soLanThuMoi,
          loi,
          trang_thai: thatBaiHan ? 'that_bai' : 'cho_gui',
          ...(guiLuc ? { gui_luc: guiLuc } : {}),
        },
      });
      if (thatBaiHan) {
        await this.prisma.nhat_ky_thong_bao.create({
          data: {
            loai_su_kien: dong.loai_su_kien,
            hoc_vien_id: dong.hoc_vien_id,
            email_nguoi_nhan: dong.email_nguoi_nhan,
            tieu_de: dong.tieu_de,
            trang_thai: 'that_bai',
            loi,
            gui_luc: guiLuc,
          },
        });
      }
    } catch (e) {
      console.error(
        `[hang-doi-email] Không ghi được kết quả thất bại (id=${dong.id})`,
        e,
      );
    }
  }
}
