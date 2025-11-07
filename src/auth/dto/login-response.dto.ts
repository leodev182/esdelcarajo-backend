export class LoginResponseDto {
  /**
   * JWT token para autenticar requests futuros
   */
  access_token: string;

  /**
   * Tipo de token (siempre "Bearer")
   */
  token_type: string;

  /**
   * Tiempo de expiración en segundos
   */
  expires_in: number;

  /**
   * Información del usuario autenticado
   */
  user: {
    id: string;
    email: string;
    name: string | null;
    avatar: string | null;
    role: string;
  };
}
