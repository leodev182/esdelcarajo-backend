import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import { FROM_EMAIL, EMAIL_TEMPLATES } from './mail.constants';

type OrderStatus = 'PAGO_CONFIRMADO' | 'EN_CAMINO' | 'ENTREGADO';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private resend: Resend | null = null;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('RESEND_API_KEY');

    if (!apiKey) {
      this.logger.warn('RESEND_API_KEY no configurado - emails deshabilitados');
      return;
    }

    this.resend = new Resend(apiKey);
    this.logger.log('Resend inicializado correctamente');
  }

  async sendWelcomeEmail(to: string, userName: string) {
    if (!this.resend) {
      this.logger.warn('Email no enviado - Resend no configurado');
      return;
    }

    try {
      const { error } = await this.resend.emails.send({
        from: FROM_EMAIL,
        to,
        subject: EMAIL_TEMPLATES.WELCOME,
        html: this.getWelcomeTemplate(userName),
      });

      if (error) {
        this.logger.error('Error de Resend:', error);
      }

      this.logger.log(`Email de bienvenida enviado a ${to}`);
    } catch (error) {
      this.logger.error('Error enviando email de bienvenida:', error);
    }
  }

  async sendOrderCreatedEmail(
    to: string,
    userName: string,
    orderId: string,
    total: number,
  ) {
    if (!this.resend) {
      this.logger.warn('Email no enviado - Resend no configurado');
      return;
    }

    try {
      const { error } = await this.resend.emails.send({
        from: FROM_EMAIL,
        to: [to, 'esdelcarajo@gmail.com'],
        subject: `${EMAIL_TEMPLATES.ORDER_CREATED} #${orderId.slice(0, 8)}`,
        html: this.getOrderCreatedTemplate(userName, orderId, total),
      });

      if (error) {
        this.logger.error('Error de Resend:', error);
      }

      this.logger.log(`Email de orden creada enviado a ${to}`);
    } catch (error) {
      this.logger.error('Error enviando email de orden:', error);
    }
  }

  async sendOrderStatusEmail(
    to: string,
    userName: string,
    orderId: string,
    status: string,
  ) {
    if (!this.resend) {
      this.logger.warn('Email no enviado - Resend no configurado');
      return;
    }

    const subjects: Record<OrderStatus, string> = {
      PAGO_CONFIRMADO: EMAIL_TEMPLATES.ORDER_PAID,
      EN_CAMINO: EMAIL_TEMPLATES.ORDER_SHIPPED,
      ENTREGADO: EMAIL_TEMPLATES.ORDER_DELIVERED,
    };

    const subject = subjects[status as OrderStatus];
    if (!subject) return;

    try {
      const { error } = await this.resend.emails.send({
        from: FROM_EMAIL,
        to,
        subject: `${subject} #${orderId.slice(0, 8)}`,
        html: this.getOrderStatusTemplate(userName, orderId, status),
      });

      if (error) {
        this.logger.error('Error de Resend:', error);
      }

      this.logger.log(`Email de cambio de estado enviado a ${to}`);
    } catch (error) {
      this.logger.error('Error enviando email de estado:', error);
    }
  }

  private getWelcomeTemplate(userName: string): string {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #FF6501; color: white; padding: 30px; text-align: center; }
            .content { padding: 30px; background: #f9f9f9; }
            .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
            .button { 
              display: inline-block; 
              padding: 12px 30px; 
              background: #FF6501; 
              color: white; 
              text-decoration: none; 
              border-radius: 5px; 
              margin: 20px 0;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>¡Bienvenido a Del Carajo!</h1>
              <p>Devotos del Arte</p>
            </div>
            <div class="content">
              <h2>Hola ${userName},</h2>
              <p>Gracias por unirte a nuestra comunidad. Estamos emocionados de tenerte con nosotros.</p>
              <p>En Del Carajo encontrarás ropa urbana venezolana con actitud. Cada prenda cuenta una historia.</p>
              <a href="${this.configService.get('FRONTEND_URL')}/catalogo" class="button">
                Explorar Catálogo
              </a>
              <p>Si tienes alguna pregunta, no dudes en contactarnos.</p>
            </div>
            <div class="footer">
              <p>Del Carajo - Devotos del Arte</p>
              <p>contacto@esdelcarajo.com</p>
            </div>
          </div>
        </body>
      </html>
    `;
  }

  private getOrderCreatedTemplate(
    userName: string,
    orderId: string,
    total: number,
  ): string {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #FF6501; color: white; padding: 30px; text-align: center; }
            .content { padding: 30px; background: #f9f9f9; }
            .order-box { background: white; padding: 20px; border-radius: 5px; margin: 20px 0; }
            .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>¡Orden Recibida!</h1>
            </div>
            <div class="content">
              <h2>Hola ${userName},</h2>
              <p>Hemos recibido tu orden exitosamente.</p>
              <div class="order-box">
                <p><strong>Número de Orden:</strong> #${orderId.slice(0, 8)}</p>
                <p><strong>Total:</strong> $${total}</p>
              </div>
              <p><strong>Próximos pasos:</strong></p>
              <ol>
                <li>Sube tu comprobante de pago en la página de tu orden</li>
                <li>Verificaremos tu pago (generalmente en 24 horas)</li>
                <li>Prepararemos tu pedido para envío</li>
              </ol>
              <p>Puedes ver el estado de tu orden en tu perfil.</p>
            </div>
            <div class="footer">
              <p>Del Carajo - Devotos del Arte</p>
              <p>contacto@esdelcarajo.com</p>
            </div>
          </div>
        </body>
      </html>
    `;
  }

  private getOrderStatusTemplate(
    userName: string,
    orderId: string,
    status: string,
  ): string {
    const statusMessages: Record<
      OrderStatus,
      { title: string; message: string }
    > = {
      PAGO_CONFIRMADO: {
        title: '¡Pago Confirmado!',
        message:
          'Hemos verificado tu pago. Estamos preparando tu pedido para envío.',
      },
      EN_CAMINO: {
        title: '¡Pedido en Camino!',
        message: 'Tu pedido ha sido despachado y está en camino.',
      },
      ENTREGADO: {
        title: '¡Pedido Entregado!',
        message:
          'Tu pedido ha sido entregado. ¡Disfruta tu nueva ropa Del Carajo!',
      },
    };

    const { title, message } = statusMessages[status as OrderStatus] || {
      title: 'Actualización de Orden',
      message: 'El estado de tu orden ha sido actualizado.',
    };

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #FF6501; color: white; padding: 30px; text-align: center; }
            .content { padding: 30px; background: #f9f9f9; }
            .status-box { background: white; padding: 20px; border-radius: 5px; margin: 20px 0; text-align: center; }
            .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>${title}</h1>
            </div>
            <div class="content">
              <h2>Hola ${userName},</h2>
              <div class="status-box">
                <p><strong>Orden:</strong> #${orderId.slice(0, 8)}</p>
                <p>${message}</p>
              </div>
              <p>Gracias por tu compra en Del Carajo.</p>
            </div>
            <div class="footer">
              <p>Del Carajo - Devotos del Arte</p>
              <p>contacto@esdelcarajo.com</p>
            </div>
          </div>
        </body>
      </html>
    `;
  }
}
