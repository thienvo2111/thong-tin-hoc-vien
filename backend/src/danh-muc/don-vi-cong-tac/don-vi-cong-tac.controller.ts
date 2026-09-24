import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { DonViCongTacService } from './don-vi-cong-tac.service';
import {
  CreateDonViCongTacDto,
  QueryDonViCongTacDto,
  UpdateDonViCongTacDto,
} from '../dto/don-vi-cong-tac.dto';
import { Roles } from '../../auth/decorators/roles.decorator';

@Controller('danh-muc/don-vi-cong-tac')
export class DonViCongTacController {
  constructor(private readonly donViCongTacService: DonViCongTacService) {}

  @Get()
  findAll(@Query() query: QueryDonViCongTacDto) {
    return this.donViCongTacService.findAll(query);
  }

  @Roles('quan_tri')
  @Post()
  create(@Body() dto: CreateDonViCongTacDto) {
    return this.donViCongTacService.create(dto);
  }

  @Roles('quan_tri')
  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDonViCongTacDto,
  ) {
    return this.donViCongTacService.update(id, dto);
  }
}
