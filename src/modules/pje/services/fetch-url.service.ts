/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Inject, Injectable, Logger } from '@nestjs/common';
import Redis from 'ioredis';
import { ProcessosResponse } from 'src/interfaces';
import { CaptchaService } from 'src/services/captcha.service';
import { ScrapingService } from './scraping.service';

@Injectable()
export class FetchUrlMovimentService {
  private readonly logger = new Logger(FetchUrlMovimentService.name);

  constructor(
    private readonly captchaService: CaptchaService,
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
    private readonly scrapingService: ScrapingService,
  ) {}

  private async delay(ms: number) {
    return new Promise((res) => setTimeout(res, ms));
  }

  async execute(
    numeroDoProcesso: string,
    origem?: string,
  ): Promise<ProcessosResponse[]> {
    const regionTRT = numeroDoProcesso?.includes('.')
      ? Number(numeroDoProcesso.split('.')[3])
      : null;
    if (!regionTRT)
      throw new Error(`Invalid process number: ${numeroDoProcesso}`);

    const instances: ProcessosResponse[] = [];

    try {
      const balance = await this.captchaService.getBalance();
      if (balance < 0.001)
        throw new Error(`Saldo insuficiente no 2Captcha: ${balance}`);

      const grauMax = origem === 'TST' ? 3 : 2;
      const initialGrau = origem === 'TST' ? 3 : 1;
      for (let i = initialGrau; i <= grauMax; i++) {
        try {
          const delayMs = 1000;
          await this.delay(delayMs);
          const { data: processoResponse, multipleInstances } =
            await this.scrapingService.execute(numeroDoProcesso, regionTRT, i);

          instances.push(processoResponse);
          if (!multipleInstances) break;
        } catch (err: any) {
          if (i === 1) {
            this.logger.error(
              `Erro ao buscar instância ${i} para o processo ${numeroDoProcesso}: ${err.message}`,
            );
            this.logger.debug(
              `Detalhes do erro: ${JSON.stringify(err.response?.data || err)}`,
            );
            break;
          }
          this.logger.warn(
            `Falha ao buscar instância ${i} para o processo ${numeroDoProcesso}: ${err.message}`,
          );
          continue;
        }
      }

      return instances;
    } catch (error: any) {
      this.logger.error(`Erro ao buscar processo ${numeroDoProcesso}`, error);
      if ([401, 403].includes(error?.response?.status)) {
        this.logger.warn(
          `Sessão expirada ou bloqueada no TRT-${regionTRT}, refazendo login...`,
        );
        // Adiciona lógica para refazer login ou atualizar tokens
        await this.redis.del(`aws-waf-token:${numeroDoProcesso}`);
        return this.execute(numeroDoProcesso, origem); // reprocessa com novo login
      }
      return [];
    }
  }
}
