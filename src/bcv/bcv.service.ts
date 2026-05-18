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

      const usdText = $('#dolar strong').text().trim();

      if (!usdText) {
        throw new Error('No se encontró el elemento #dolar strong');
      }

      const usdRate = parseFloat(usdText.replace(',', '.'));

      if (isNaN(usdRate) || usdRate <= 0) {
        throw new Error(`Tasa USD inválida: ${usdText}`);
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);

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

      this.logger.log(`Tasas actualizadas: USD=${usdRate} Bs`);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Error desconocido';
      this.logger.error('Error actualizando tasas BCV:', errorMessage);
    }
  }

  async getBcvRate(): Promise<BcvRateDto> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 1. Buscar la tasa de hoy
    const todayRate = await this.prisma.exchangeRate.findFirst({
      where: {
        fromCurrency: 'USD',
        toCurrency: 'VES',
        valueDate: today,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (todayRate) {
      return {
        rate: Number(todayRate.rate),
        lastUpdate: todayRate.updatedAt,
        source: 'Banco Central de Venezuela',
      };
    }

    // 2. No hay tasa de hoy: intentar scraping
    this.logger.warn('No hay tasa para hoy, ejecutando actualización manual');
    await this.updateExchangeRates();

    // 3. Volver a buscar la tasa de hoy (puede haber sido guardada por el scraping)
    const newTodayRate = await this.prisma.exchangeRate.findFirst({
      where: {
        fromCurrency: 'USD',
        toCurrency: 'VES',
        valueDate: today,
      },
    });

    if (newTodayRate) {
      return {
        rate: Number(newTodayRate.rate),
        lastUpdate: newTodayRate.updatedAt,
        source: 'Banco Central de Venezuela',
      };
    }

    // 4. Scraping falló: usar la tasa más reciente disponible en DB como fallback
    this.logger.warn(
      'Scraping BCV falló, usando la última tasa disponible como fallback',
    );
    const latestRate = await this.prisma.exchangeRate.findFirst({
      where: {
        fromCurrency: 'USD',
        toCurrency: 'VES',
      },
      orderBy: {
        valueDate: 'desc',
      },
    });

    if (!latestRate) {
      throw new Error(
        'No hay tasas de cambio disponibles en la base de datos',
      );
    }

    return {
      rate: Number(latestRate.rate),
      lastUpdate: latestRate.updatedAt,
      source: 'Banco Central de Venezuela',
    };
  }
}
