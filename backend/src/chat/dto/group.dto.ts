import { ArrayMaxSize, IsArray, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/** Cap on how many people one room holds — keeps the unread fan-out bounded. */
const MAX_GROUP_SIZE = 200;

export class CreateGroupDto {
  @ApiProperty({ example: 'Morning batch' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  name: string;

  @ApiProperty({ required: false, type: [String], description: 'User ids to add; the creator is always included' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_GROUP_SIZE)
  @IsUUID('4', { each: true })
  memberIds?: string[];
}

export class RenameGroupDto {
  @ApiProperty({ example: 'Evening batch' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  name: string;
}

export class AddParticipantsDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMaxSize(MAX_GROUP_SIZE)
  @IsUUID('4', { each: true })
  memberIds: string[];
}
