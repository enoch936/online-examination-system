import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { IsArray, IsUUID } from 'class-validator';
import { RoleName } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { ClassesService } from './classes.service';
import { CreateClassDto } from './dto/create-class.dto';
import { UpdateClassDto } from './dto/update-class.dto';

class EnrollStudentsDto {
  @IsArray()
  @IsUUID('4', { each: true })
  studentIds: string[];
}

@ApiBearerAuth()
@ApiTags('Classes')
@Controller('classes')
export class ClassesController {
  constructor(private readonly classes: ClassesService) {}

  @Get()
  @Roles(RoleName.SUPER_ADMIN, RoleName.ADMIN, RoleName.INSTRUCTOR)
  @Permissions('classes.manage')
  @ApiQuery({ name: 'courseId', required: false })
  findMany(@CurrentUser() user: AuthenticatedUser, @Query('courseId') courseId?: string) {
    return this.classes.findMany(user, courseId);
  }

  @Get('my')
  @Roles(RoleName.STUDENT)
  findMyClasses(@CurrentUser() user: AuthenticatedUser) {
    return this.classes.findMyClasses(user.sub);
  }

  @Get(':id')
  @Roles(RoleName.SUPER_ADMIN, RoleName.ADMIN, RoleName.INSTRUCTOR)
  @Permissions('classes.manage')
  findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.classes.findOne(id, user);
  }

  @Post()
  @Roles(RoleName.SUPER_ADMIN, RoleName.ADMIN, RoleName.INSTRUCTOR)
  @Permissions('classes.manage')
  create(@Body() dto: CreateClassDto) {
    return this.classes.create(dto);
  }

  @Patch(':id')
  @Roles(RoleName.SUPER_ADMIN, RoleName.ADMIN, RoleName.INSTRUCTOR)
  @Permissions('classes.manage')
  update(@Param('id') id: string, @Body() dto: UpdateClassDto, @CurrentUser() user: AuthenticatedUser) {
    return this.classes.update(id, dto, user);
  }

  @Delete(':id')
  @Roles(RoleName.SUPER_ADMIN, RoleName.ADMIN, RoleName.INSTRUCTOR)
  @Permissions('classes.manage')
  remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.classes.remove(id, user);
  }

  @Post(':id/enroll')
  @Roles(RoleName.SUPER_ADMIN, RoleName.ADMIN, RoleName.INSTRUCTOR)
  @Permissions('classes.manage')
  enrollStudents(
    @Param('id') id: string,
    @Body() body: EnrollStudentsDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.classes.enrollStudents(id, body.studentIds ?? [], user);
  }

  @Delete(':id/enroll/:studentId')
  @Roles(RoleName.SUPER_ADMIN, RoleName.ADMIN, RoleName.INSTRUCTOR)
  @Permissions('classes.manage')
  unenrollStudent(
    @Param('id') id: string,
    @Param('studentId') studentId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.classes.unenrollStudent(id, studentId, user);
  }
}