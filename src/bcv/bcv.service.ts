import {
  Injectable,
  Logger,
  InternalServerErrorException,
} from '@nestjs/common';
import { BcvRateDto } from './dto/bcv-rate.dto';

@Injectable()
export class BcvService {
  private readonly logger = new Logger(BcvService.name);
  private cachedRate: BcvRateDto | null = null;
  private cacheExpiry: Date | null = null;
  private readonly CACHE_DURATION_MS = 1000 * 60 * 60; // 1 hora

  async getBcvRate(): Promise<BcvRateDto> {
    if (this.cachedRate && this.cacheExpiry && new Date() < this.cacheExpiry) {
      this.logger.log('Retornando tasa cacheada');
      return this.cachedRate;
    }

    try {
      this.logger.log('Scrapeando tasa del BCV...');
      const rate = await this.scrapeRate();

      this.cachedRate = {
        rate,
        lastUpdate: new Date(),
        source: 'Banco Central de Venezuela',
      };
      this.cacheExpiry = new Date(Date.now() + this.CACHE_DURATION_MS);

      return this.cachedRate;
    } catch (error) {
      this.logger.error('Error obteniendo tasa BCV:', error);

      if (this.cachedRate) {
        this.logger.warn('Retornando tasa cacheada antigua por error');
        return this.cachedRate;
      }

      throw new InternalServerErrorException(
        'No se pudo obtener la tasa del BCV',
      );
    }
  }

  private async scrapeRate(): Promise<number> {
    try {
      const response = await fetch('https://www.bcv.org.ve/');
      const html = await response.text();

      const rateMatch = html.match(
        /(?:USD|Dólar)[\s\S]*?(\d{1,3}(?:[.,]\d{2,3})?)/i,
      );

      if (rateMatch && rateMatch[1]) {
        const rateString = rateMatch[1].replace(',', '.');
        const rate = parseFloat(rateString);

        if (!isNaN(rate) && rate > 0) {
          this.logger.log(`Tasa obtenida: ${rate} Bs`);
          return rate;
        }
      }

      throw new Error('No se pudo extraer la tasa del HTML');
    } catch (error) {
      this.logger.error('Error scrapeando BCV:', error);
      throw error;
    }
  }
}
