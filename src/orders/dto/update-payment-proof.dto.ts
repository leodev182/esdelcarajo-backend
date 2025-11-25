import { IsUrl, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdatePaymentProofDto {
  @ApiProperty({
    description: 'URL del comprobante de pago en Cloudinary',
    example:
      'https://res.cloudinary.com/xxx/image/upload/v123/delcarajo/payment-proofs/abc.jpg',
  })
  @IsUrl({}, { message: 'paymentProof debe ser una URL válida' })
  @IsNotEmpty({ message: 'paymentProof es obligatorio' })
  paymentProof: string;
}
