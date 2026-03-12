import { Test, TestingModule } from '@nestjs/testing';
import { BcvService } from './bcv.service';
import { PrismaService } from '../prisma/prisma.service';
import axios from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

const mockPrisma = {
  exchangeRate: {
    findFirst: jest.fn(),
    upsert: jest.fn(),
  },
};

const mockTodayRate = {
  id: 'rate-1',
  fromCurrency: 'EUR',
  toCurrency: 'VES',
  rate: 52.3,
  valueDate: new Date(),
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockOldRate = {
  ...mockTodayRate,
  id: 'rate-old',
  valueDate: new Date('2024-01-15'),
  updatedAt: new Date('2024-01-15'),
};

describe('BcvService', () => {
  let service: BcvService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BcvService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<BcvService>(BcvService);
    jest.clearAllMocks();
  });

  it('debería estar definido', () => {
    expect(service).toBeDefined();
  });

  describe('getBcvRate', () => {
    it('devuelve la tasa de hoy cuando existe en la DB', async () => {
      mockPrisma.exchangeRate.findFirst.mockResolvedValueOnce(mockTodayRate);

      const result = await service.getBcvRate();

      expect(result.rate).toBe(52.3);
      expect(result.source).toBe('Banco Central de Venezuela');
      expect(result.lastUpdate).toEqual(mockTodayRate.updatedAt);
      expect(mockPrisma.exchangeRate.findFirst).toHaveBeenCalledTimes(1);
    });

    it('intenta scraping cuando no hay tasa de hoy y devuelve la tasa guardada', async () => {
      jest
        .spyOn(service, 'updateExchangeRates')
        .mockResolvedValueOnce(undefined);

      mockPrisma.exchangeRate.findFirst
        .mockResolvedValueOnce(null) // 1ra: no hay tasa de hoy
        .mockResolvedValueOnce(mockTodayRate); // 2da: después del scraping

      const result = await service.getBcvRate();

      expect(service.updateExchangeRates).toHaveBeenCalledTimes(1);
      expect(result.rate).toBe(52.3);
    });

    it('usa la tasa más reciente como fallback cuando el scraping falla', async () => {
      jest
        .spyOn(service, 'updateExchangeRates')
        .mockResolvedValueOnce(undefined);

      mockPrisma.exchangeRate.findFirst
        .mockResolvedValueOnce(null) // 1ra: no hay tasa de hoy
        .mockResolvedValueOnce(null) // 2da: scraping no guardó nada
        .mockResolvedValueOnce(mockOldRate); // 3ra: fallback a tasa antigua

      const result = await service.getBcvRate();

      expect(result.rate).toBe(mockOldRate.rate);
      expect(result.lastUpdate).toEqual(mockOldRate.updatedAt);
    });

    it('lanza un error si no hay ninguna tasa en la DB', async () => {
      jest
        .spyOn(service, 'updateExchangeRates')
        .mockResolvedValueOnce(undefined);

      mockPrisma.exchangeRate.findFirst.mockResolvedValue(null);

      await expect(service.getBcvRate()).rejects.toThrow(
        'No hay tasas de cambio disponibles en la base de datos',
      );
    });
  });

  describe('updateExchangeRates', () => {
    it('guarda las 4 tasas de cambio cuando el scraping es exitoso', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: `
          <html>
            <div id="euro"><strong>57,24</strong></div>
            <div id="dolar"><strong>52,30</strong></div>
          </html>
        `,
      });

      mockPrisma.exchangeRate.upsert.mockResolvedValue({});

      await service.updateExchangeRates();

      // EUR/VES, VES/EUR, USD/VES, VES/USD
      expect(mockPrisma.exchangeRate.upsert).toHaveBeenCalledTimes(4);
    });

    it('no lanza excepción cuando el scraping falla (solo loggea el error)', async () => {
      mockedAxios.get.mockRejectedValueOnce(new Error('Network Error'));

      await expect(service.updateExchangeRates()).resolves.not.toThrow();
      expect(mockPrisma.exchangeRate.upsert).not.toHaveBeenCalled();
    });
  });
});
