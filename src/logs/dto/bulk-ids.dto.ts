import { IsArray, IsUUID, ArrayMinSize } from 'class-validator';

export class BulkIdsDto {
  @IsArray({ message: 'ids debe ser un arreglo' })
  @ArrayMinSize(1, { message: 'ids debe contener al menos un elemento' })
  @IsUUID('4', { each: true, message: 'Cada id debe ser un UUID válido' })
  ids: string[];
}
