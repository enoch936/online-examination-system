import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Difficulty, QuestionBankStatus, QuestionType, RoleName } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { CreateQuestionBankDto } from './dto/create-question-bank.dto';
import { BankImportQuestionsDto } from './dto/import-questions.dto';
import { QuestionIdsDto, ReorderQuestionsDto } from './dto/question-ids.dto';
import { UpdateQuestionBankDto } from './dto/update-question-bank.dto';
import { QuestionBanksService } from './question-banks.service';

@ApiBearerAuth()
@ApiTags('Question Banks')
@Controller('question-banks')
@Roles(RoleName.SUPER_ADMIN, RoleName.ADMIN, RoleName.INSTRUCTOR)
export class QuestionBanksController {
  constructor(private readonly banks: QuestionBanksService) {}

  @Get()
  @Permissions('questions.manage')
  @ApiQuery({ name: 'search', type: String, required: false })
  @ApiQuery({ name: 'courseId', type: String, required: false })
  @ApiQuery({ name: 'categoryId', type: String, required: false })
  @ApiQuery({ name: 'status', enum: QuestionBankStatus, required: false })
  @ApiQuery({ name: 'difficulty', enum: Difficulty, required: false })
  findMany(
    @Query('search') search?: string,
    @Query('courseId') courseId?: string,
    @Query('categoryId') categoryId?: string,
    @Query('status') status?: QuestionBankStatus,
    @Query('difficulty') difficulty?: Difficulty,
  ) {
    return this.banks.findMany({ search, courseId, categoryId, status, difficulty });
  }

  @Get(':id')
  @Permissions('questions.manage')
  findOne(@Param('id') id: string) {
    return this.banks.findOne(id);
  }

  @Post()
  @Permissions('questions.manage')
  create(@Body() dto: CreateQuestionBankDto, @CurrentUser() user: AuthenticatedUser) {
    return this.banks.create(dto, user.sub);
  }

  @Patch(':id')
  @Permissions('questions.manage')
  update(@Param('id') id: string, @Body() dto: UpdateQuestionBankDto) {
    return this.banks.update(id, dto);
  }

  @Delete(':id')
  @Permissions('questions.manage')
  remove(@Param('id') id: string) {
    return this.banks.remove(id);
  }

  @Post(':id/duplicate')
  @Permissions('questions.manage')
  duplicate(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.banks.duplicate(id, user.sub);
  }

  @Get(':id/questions')
  @Permissions('questions.manage')
  @ApiQuery({ name: 'search', type: String, required: false })
  @ApiQuery({ name: 'type', enum: QuestionType, required: false })
  @ApiQuery({ name: 'difficulty', enum: Difficulty, required: false })
  @ApiQuery({ name: 'topic', type: String, required: false })
  getQuestions(
    @Param('id') id: string,
    @Query('search') search?: string,
    @Query('type') type?: QuestionType,
    @Query('difficulty') difficulty?: Difficulty,
    @Query('topic') topic?: string,
  ) {
    return this.banks.getQuestions(id, { search, type, difficulty, topic });
  }

  @Post(':id/questions/bulk-delete')
  @Permissions('questions.manage')
  bulkDelete(@Param('id') id: string, @Body() dto: QuestionIdsDto) {
    return this.banks.bulkDeleteQuestions(id, dto.ids);
  }

  @Post(':id/questions/reorder')
  @Permissions('questions.manage')
  reorder(@Param('id') id: string, @Body() dto: ReorderQuestionsDto) {
    return this.banks.reorderQuestions(id, dto.questionIds);
  }

  @Post(':id/questions/duplicate')
  @Permissions('questions.manage')
  @ApiBody({ type: QuestionIdsDto })
  duplicateQuestion(@Param('id') id: string, @Body() dto: QuestionIdsDto) {
    return this.banks.duplicateQuestion(id, dto.ids[0]);
  }

  @Post(':id/import')
  @Permissions('questions.manage')
  importQuestions(@Param('id') id: string, @Body() dto: BankImportQuestionsDto, @CurrentUser() user: AuthenticatedUser) {
    return this.banks.importQuestions(id, dto.questions, user.sub);
  }

  @Get(':id/export')
  @Permissions('questions.manage')
  exportQuestions(@Param('id') id: string) {
    return this.banks.exportQuestions(id);
  }
}
