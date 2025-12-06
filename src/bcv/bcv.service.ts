import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { BcvRateDto } from './dto/bcv-rate.dto';
import axios from 'axios';
import { load } from 'cheerio';
import https from 'https';

@Injectable()
export class BcvService {
  private readonly logger = new Logger(BcvService.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron('0 5 * * *', {
    timeZone: 'America/Caracas',
  })
  async updateExchangeRates() {
    this.logger.log('Iniciando actualización de tasas BCV (CRON 5am)');

    try {
      const agent = new https.Agent({
        rejectUnauthorized: false,
      });

      const response = await axios.get('https://www.bcv.org.ve', {
        httpsAgent: agent,
        timeout: 30000,
      });

      const html = response.data;
      const $ = load(html);

      const euroText = $('#euro strong').text().trim();
      const usdText = $('#dolar strong').text().trim();

      if (!euroText || !usdText) {
        throw new Error(
          'No se encontraron los elementos #euro o #dolar strong',
        );
      }

      const eurRate = parseFloat(euroText.replace(',', '.'));
      const usdRate = parseFloat(usdText.replace(',', '.'));

      if (isNaN(eurRate) || eurRate <= 0) {
        throw new Error(`Tasa EUR inválida: ${euroText}`);
      }

      if (isNaN(usdRate) || usdRate <= 0) {
        throw new Error(`Tasa USD inválida: ${usdText}`);
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Guardar EUR -> VES
      await this.prisma.exchangeRate.upsert({
        where: {
          fromCurrency_toCurrency_valueDate: {
            fromCurrency: 'EUR',
            toCurrency: 'VES',
            valueDate: today,
          },
        },
        update: { rate: eurRate },
        create: {
          fromCurrency: 'EUR',
          toCurrency: 'VES',
          rate: eurRate,
          valueDate: today,
        },
      });

      // Guardar VES -> EUR
      await this.prisma.exchangeRate.upsert({
        where: {
          fromCurrency_toCurrency_valueDate: {
            fromCurrency: 'VES',
            toCurrency: 'EUR',
            valueDate: today,
          },
        },
        update: { rate: 1 / eurRate },
        create: {
          fromCurrency: 'VES',
          toCurrency: 'EUR',
          rate: 1 / eurRate,
          valueDate: today,
        },
      });

      // Guardar USD -> VES
      await this.prisma.exchangeRate.upsert({
        where: {
          fromCurrency_toCurrency_valueDate: {
            fromCurrency: 'USD',
            toCurrency: 'VES',
            valueDate: today,
          },
        },
        update: { rate: usdRate },
        create: {
          fromCurrency: 'USD',
          toCurrency: 'VES',
          rate: usdRate,
          valueDate: today,
        },
      });

      // Guardar VES -> USD
      await this.prisma.exchangeRate.upsert({
        where: {
          fromCurrency_toCurrency_valueDate: {
            fromCurrency: 'VES',
            toCurrency: 'USD',
            valueDate: today,
          },
        },
        update: { rate: 1 / usdRate },
        create: {
          fromCurrency: 'VES',
          toCurrency: 'USD',
          rate: 1 / usdRate,
          valueDate: today,
        },
      });

      this.logger.log(
        `Tasas actualizadas: EUR=${eurRate} Bs, USD=${usdRate} Bs`,
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Error desconocido';
      this.logger.error('Error actualizando tasas BCV:', errorMessage);
    }
  }

  async getBcvRate(): Promise<BcvRateDto> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const rate = await this.prisma.exchangeRate.findFirst({
      where: {
        fromCurrency: 'EUR',
        toCurrency: 'VES',
        valueDate: today,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (!rate) {
      this.logger.warn('No hay tasa para hoy, ejecutando actualización manual');
      await this.updateExchangeRates();

      const newRate = await this.prisma.exchangeRate.findFirst({
        where: {
          fromCurrency: 'EUR',
          toCurrency: 'VES',
          valueDate: today,
        },
      });

      if (!newRate) {
        throw new Error('No se pudo obtener la tasa del BCV');
      }

      return {
        rate: Number(newRate.rate),
        lastUpdate: newRate.updatedAt,
        source: 'Banco Central de Venezuela',
      };
    }

    return {
      rate: Number(rate.rate),
      lastUpdate: rate.updatedAt,
      source: 'Banco Central de Venezuela',
    };
  }
}
