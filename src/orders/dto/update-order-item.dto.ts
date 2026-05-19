import { IsUUID } from 'class-validator';

export class UpdateOrderItemDto {
  @IsUUID()
  variantId: string;
}
