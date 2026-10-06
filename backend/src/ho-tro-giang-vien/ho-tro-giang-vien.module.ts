import { Module } from '@nestjs/common';
import { HoTroGiangVienController } from './ho-tro-giang-vien.controller';
import { HoTroGiangVienScopeService } from './ho-tro-giang-vien-scope.service';

// ADR 0004: người hỗ trợ giảng viên (nhóm theo khóa).
@Module({
  controllers: [HoTroGiangVienController],
  providers: [HoTroGiangVienScopeService],
  exports: [HoTroGiangVienScopeService],
})
export class HoTroGiangVienModule {}
