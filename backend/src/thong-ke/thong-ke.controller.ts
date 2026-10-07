import { Controller, Get, Query } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { ThongKeScopeService } from './thong-ke-scope.service';
import { ThongKeService } from './thong-ke.service';
import { ThongKeQueryDto } from './dto/thong-ke-query.dto';

// hoc_vien không có phạm vi thống kê -> RolesGuard tự trả 403.
@Roles('truong', 'phong_vhxh', 'so_gddt', 'quan_tri', 'ho_tro_hoc_vien')
@Controller('thong-ke')
export class ThongKeController {
  constructor(
    private readonly scopeService: ThongKeScopeService,
    private readonly service: ThongKeService,
  ) {}

  @Get('bo-loc')
  boLoc(@CurrentUser() user: AuthenticatedUser) {
    return this.scopeService.boLoc(user);
  }

  @Get('pheu')
  pheu(@CurrentUser() user: AuthenticatedUser, @Query() q: ThongKeQueryDto) {
    return this.service.pheu(user, q);
  }

  @Get('khao-sat')
  khaoSat(@CurrentUser() user: AuthenticatedUser, @Query() q: ThongKeQueryDto) {
    return this.service.khaoSat(user, q);
  }

  @Get('chuyen-muc')
  chuyenMuc(
    @CurrentUser() user: AuthenticatedUser,
    @Query() q: ThongKeQueryDto,
  ) {
    return this.service.chuyenMuc(user, q);
  }

  @Get('ket-qua')
  ketQua(@CurrentUser() user: AuthenticatedUser, @Query() q: ThongKeQueryDto) {
    return this.service.ketQuaHoc(user, q);
  }

  @Get('so-sanh-khoa')
  soSanhKhoa(
    @CurrentUser() user: AuthenticatedUser,
    @Query() q: ThongKeQueryDto,
  ) {
    return this.service.soSanhKhoa(user, q);
  }

  @Get('chuyen-can')
  chuyenCan(
    @CurrentUser() user: AuthenticatedUser,
    @Query() q: ThongKeQueryDto,
  ) {
    return this.service.chuyenCan(user, q);
  }
}
