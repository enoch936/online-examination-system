import { PartialType } from '@nestjs/swagger';
import { CreateQuestionBankDto } from './create-question-bank.dto';

export class UpdateQuestionBankDto extends PartialType(CreateQuestionBankDto) {}
