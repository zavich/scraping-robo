import { Inject, Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

import * as fs from 'fs';
import Redis from 'ioredis';
import * as path from 'path';
import { CaptchaService } from 'src/services/captcha.service';
import { userAgents } from 'src/utils/user-agents';

@Injectable()
export class FetchDocumentoService {
  constructor(
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
    private readonly captchaService: CaptchaService,
  ) {}
  private readonly logger = new Logger(FetchDocumentoService.name);
  async execute(
    processId: number,
    regionTRT: number,
    instancia: string,
    processNumber: string,
  ): Promise<string> {
    try {
      if (!processId || !regionTRT || !instancia) {
        this.logger.error('Parâmetros inválidos fornecidos');
        return '';
      }
      const redisKey = `pje:session:${regionTRT}`;
      const redisTokenCaptchaKey = `captchatoken:${processNumber}:${instancia}`;
      const tokenCaptcha = await this.redis.get(redisTokenCaptchaKey);
      const cookies = (await this.redis.get(redisKey)) as string;

      const redisKeyAWS = `aws-waf-token:${regionTRT}`;
      const aws = await this.redis.get(redisKeyAWS);
      const typeUrl = instancia === '3' ? 'tst' : `trt${regionTRT}`;
      const url = `https://pje.${typeUrl}.jus.br/pje-consulta-api/api/processos/${processId}/integra?tokenCaptcha=${tokenCaptcha}`;

      // 🔹 Extrai access_token_1g do cookie
      const match = cookies.match(/access_token_1g=([^;]+)/);
      const accessToken1g = match ? match[1] : null;

      const response = await axios.get(url, {
        headers: {
          Authorization: `Bearer ${accessToken1g}`,
          Cookie: `${aws}`,
          'x-grau-instancia': instancia,
          referer: `https://pje.${typeUrl}.jus.br/consultaprocessual/detalhe-processo/${processNumber}/${instancia}`,
          'user-agent':
            userAgents[Math.floor(Math.random() * userAgents.length)],
        },
        timeout: 300000,
        // responseType: 'arraybuffer',
        withCredentials: true,
      });

      if (!response.data || response.data.length === 0) {
        throw new Error('Resposta vazia ao baixar PDF');
      }

      const contentType = response.headers['content-type'];

      if (!contentType || !contentType.includes('application/pdf')) {
        const text = Buffer.from(response.data).toString('utf-8');

        this.logger.error('❌ Não é PDF, resposta recebida:');
        this.logger.error(text.slice(0, 500));

        throw new Error('Resposta não é PDF (provável bloqueio)');
      }

      const buffer = Buffer.from(response.data);

      // cria pasta temp se não existir
      const tempDir = path.join(process.cwd(), 'tmp');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      const sanitizedProcessNumber = processNumber.replace(/\D+/g, '');

      const fileName = `proc_${sanitizedProcessNumber}_${instancia}_${processId}_${Date.now()}_${Math.random()
        .toString(36)
        .slice(2, 8)}.pdf`;

      const filePath = path.join(tempDir, fileName);

      // salva no disco
      fs.writeFileSync(filePath, buffer);

      this.logger.log(`PDF salvo em: ${filePath}`);
      await this.redis.del(redisTokenCaptchaKey); // limpa o token do captcha após uso

      // Deleta todas as chaves que possuem captchatoken:${processNumber}
      const keysToDelete = await this.redis.keys(
        `captchatoken:${processNumber}:*`,
      );
      if (keysToDelete.length > 0) {
        await this.redis.del(...keysToDelete);
        this.logger.log(
          `✅ Todas as chaves captchatoken:${processNumber}:* foram deletadas.`,
        );
      }

      return filePath;
    } catch (error) {
      this.logger.error('Erro ao executar DocumentoService', error);
      throw error; // deixa o Nest lançar 500 mas logado corretamente
    }
  }
}
