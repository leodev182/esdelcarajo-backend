import { PartialType } from '@nestjs/mapped-types';
import { CreateAddressDto } from './create-address.dto';

/**
 * DTO para actualizar una dirección existente
 * Hereda todos los campos de CreateAddressDto pero los hace opcionales
 */
export class UpdateAddressDto extends PartialType(CreateAddressDto) {}
