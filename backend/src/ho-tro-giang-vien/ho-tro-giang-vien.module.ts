import { Module } from '@nestjs/common';
import { TrangLopModule } from '../trang-lop/trang-lop.module';
import { HoTroGiangVienController } from './ho-tro-giang-vien.controller';
import { HoTroGiangVienScopeService } from './ho-tro-giang-vien-scope.service';

// ADR 0004: người hỗ trợ giảng viên (nhóm theo khóa).
@Module({
  imports: [TrangLopModule],
  controllers: [HoTroGiangVienController],
  providers: [HoTroGiangVienScopeService],
  exports: [HoTroGiangVienScopeService],
})
export class HoTroGiangVienModule {}
