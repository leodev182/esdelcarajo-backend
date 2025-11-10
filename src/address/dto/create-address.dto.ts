import {
  IsString,
  IsNotEmpty,
  IsBoolean,
  IsOptional,
  MaxLength,
} from 'class-validator';

/**
 * DTO para crear una nueva dirección de entrega
 */
export class CreateAddressDto {
  /**
   * Alias de la dirección (ej: "Casa", "Oficina")
   * @example "Casa"
   */
  @IsString({ message: 'alias debe ser un texto' })
  @IsNotEmpty({ message: 'alias es obligatorio' })
  @MaxLength(50, { message: 'alias no puede exceder 50 caracteres' })
  alias: string;

  /**
   * Nombre completo de quien recibe
   * @example "Juan Pérez"
   */
  @IsString({ message: 'fullName debe ser un texto' })
  @IsNotEmpty({ message: 'fullName es obligatorio' })
  @MaxLength(100, { message: 'fullName no puede exceder 100 caracteres' })
  fullName: string;

  /**
   * Teléfono de contacto
   * @example "+58 424-1234567"
   */
  @IsString({ message: 'phone debe ser un texto' })
  @IsNotEmpty({ message: 'phone es obligatorio' })
  @MaxLength(20, { message: 'phone no puede exceder 20 caracteres' })
  phone: string;

  /**
   * Estado/Región
   * @example "Miranda"
   */
  @IsString({ message: 'state debe ser un texto' })
  @IsNotEmpty({ message: 'state es obligatorio' })
  @MaxLength(100, { message: 'state no puede exceder 100 caracteres' })
  state: string;

  /**
   * Ciudad
   * @example "Caracas"
   */
  @IsString({ message: 'city debe ser un texto' })
  @IsNotEmpty({ message: 'city es obligatorio' })
  @MaxLength(100, { message: 'city no puede exceder 100 caracteres' })
  city: string;

  /**
   * Municipio (opcional)
   * @example "Chacao"
   */
  @IsString({ message: 'municipality debe ser un texto' })
  @IsOptional()
  @MaxLength(100, { message: 'municipality no puede exceder 100 caracteres' })
  municipality?: string;

  /**
   * Dirección completa
   * @example "Av. Principal con Calle 5, Edificio Del Carajo, Piso 3, Apto 3-B"
   */
  @IsString({ message: 'address debe ser un texto' })
  @IsNotEmpty({ message: 'address es obligatorio' })
  @MaxLength(500, { message: 'address no puede exceder 500 caracteres' })
  address: string;

  /**
   * Código postal (opcional)
   * @example "1060"
   */
  @IsString({ message: 'zipCode debe ser un texto' })
  @IsOptional()
  @MaxLength(20, { message: 'zipCode no puede exceder 20 caracteres' })
  zipCode?: string;

  /**
   * Punto de referencia (opcional)
   * @example "Frente a la panadería El Pan Nuestro"
   */
  @IsString({ message: 'reference debe ser un texto' })
  @IsOptional()
  @MaxLength(500, { message: 'reference no puede exceder 500 caracteres' })
  reference?: string;

  /**
   * Marcar como dirección predeterminada
   * @example false
   */
  @IsBoolean({ message: 'isDefault debe ser verdadero o falso' })
  @IsOptional()
  isDefault?: boolean;
}
