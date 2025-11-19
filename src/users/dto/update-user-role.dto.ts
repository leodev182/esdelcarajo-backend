import { IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Role } from '@prisma/client';

/**
 * DTO para cambiar el rol de un usuario
 */
export class UpdateUserRoleDto {
  @ApiProperty({
    description: 'Nuevo rol del usuario',
    enum: Role,
    example: 'ADMIN',
  })
  @IsEnum(Role, { message: 'El rol debe ser USER, ADMIN o SUPER_ADMIN' })
  role: Role;
}
