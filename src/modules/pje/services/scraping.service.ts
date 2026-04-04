import { Injectable, Logger } from '@nestjs/common';
import { ProcessosResponse } from 'src/interfaces';
import { CaptchaService } from 'src/services/captcha.service';
import { BrowserManager } from 'src/utils/browser.manager';

@Injectable()
export class NewScrapingService {
  private readonly logger = new Logger(NewScrapingService.name);

  constructor(private readonly captchaService: CaptchaService) {}

  async execute(processNumber: string, regionTRT: number, instance: number) {
    const { page, context } = await BrowserManager.createPage();

    const urlBase = `https://pje.trt${regionTRT}.jus.br/consultaprocessual/`;
    this.logger.log(`🌐 Acessando URL base: ${urlBase}`);

    await page.goto(urlBase, { waitUntil: 'networkidle0' });

    this.logger.log(
      '🔍 Identificando campo de entrada do número do processo...',
    );
    const inputSelector = '#nrProcessoInput'; // Atualizado para usar o ID correto
    await page.waitForSelector(inputSelector, { visible: true });

    // Simula digitação natural do número do processo
    for (const char of processNumber) {
      await page.type(inputSelector, char);
      await this.delay(100 + Math.random() * 100); // Pausa aleatória entre 100ms e 300ms
    }

    this.logger.log(
      `✅ Número do processo ${processNumber} inserido no campo de forma natural.`,
    );

    // Submete o formulário
    const submitButtonSelector = '#btnPesquisar';
    this.logger.log('🖱 Clicando no botão de submit...');
    await page.waitForSelector(submitButtonSelector, { visible: true });
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle0' }),
      page.click(submitButtonSelector),
    ]);
    this.logger.log('✅ Formulário enviado com sucesso.');

    // Verifica se o painel de escolha de processos existe
    this.logger.log(
      '🔍 Verificando se o painel de escolha de processos está presente...',
    );
    const panelSelector = '#painel-escolha-processo';
    const panelExists = await page.$(panelSelector);
    let multipleInstances: boolean = false;
    if (panelExists) {
      this.logger.log('🔍 Painel de escolha de processos encontrado.');

      const instanceButtonSelector = `button.selecao-processo`;
      this.logger.log(
        `🔍 Aguardando os botões com o seletor: ${instanceButtonSelector}`,
      );
      await page
        .waitForSelector(instanceButtonSelector, {
          visible: true,
          timeout: 5000,
        })
        .catch(() => {
          this.logger.log(
            `⚠️ Nenhum botão encontrado com o seletor: ${instanceButtonSelector}`,
          );
        });

      const buttons = await page.$$(instanceButtonSelector);
      this.logger.log(`🔍 Botões encontrados: ${buttons.length}`);

      let instanceButton: any = null;
      console.log(`🔍 Botões encontrados: ${buttons.length}`);
      multipleInstances = buttons.length > 1;
      for (const button of buttons) {
        const buttonText = await page.evaluate(
          (el) => el.textContent?.split('\n')[0].trim(), // Considera apenas o texto antes da quebra de linha
          button,
        );
        this.logger.log(
          `🔍 Texto inicial do botão encontrado: [${buttonText}]`,
        );
        if (buttonText?.startsWith(`${instance}° Grau`)) {
          instanceButton = button;
          break;
        }
      }

      if (instanceButton) {
        this.logger.log(`🖱 Selecionando a instância: ${instance}° Grau...`);
        await Promise.all([
          page.waitForNavigation({ waitUntil: 'networkidle0' }),
          page.evaluate((button) => {
            if (button instanceof HTMLElement) {
              button.click();
              console.log('✅ Clique executado no botão.');
            } else {
              console.log('⚠️ O elemento não é um HTMLElement.');
            }
          }, instanceButton),
        ]);
        this.logger.log(
          `✅ Instância ${instance}° Grau selecionada com sucesso.`,
        );
      } else {
        this.logger.log(
          `⚠️ Não foi possível encontrar o botão para a instância ${instance}° Grau.`,
        );
      }

      // Verifica se a navegação após a seleção da instância foi concluída
      this.logger.log(
        '🔍 Verificando se a página foi carregada após a seleção da instância...',
      );
      await this.delay(2000); // Aguarda um tempo para garantir o carregamento

      // Aguarda o carregamento do captcha após a seleção da instância
      const captchaSelector = '#imagemCaptcha';
      this.logger.log('🔍 Aguardando o carregamento do captcha...');
      await page
        .waitForSelector(captchaSelector, { visible: true, timeout: 10000 })
        .catch(() => {
          this.logger.log(
            '⚠️ O captcha não foi carregado após a seleção da instância.',
          );
        });

      const captchaElement = await page.$(captchaSelector);
      if (captchaElement) {
        this.logger.log('🔍 Captcha detectado na página.');

        // Obtém a imagem do captcha
        const captchaImage = await page.evaluate((el) => {
          return el.getAttribute('src');
        }, captchaElement);

        if (captchaImage) {
          this.logger.log('🔍 Resolvendo o captcha...');
          const captchaResponse =
            await this.captchaService.resolveCaptcha(captchaImage);

          if (captchaResponse?.resposta) {
            this.logger.log('✅ Captcha resolvido com sucesso.');

            // Insere a resposta do captcha no campo correspondente
            const captchaInputSelector = '#captchaInput';
            await page.type(captchaInputSelector, captchaResponse.resposta);

            // Submete o captcha
            const captchaSubmitSelector = '#btnEnviar';
            await Promise.all([
              page.waitForNavigation({ waitUntil: 'networkidle0' }),
              page.click(captchaSubmitSelector),
            ]);
            this.logger.log('✅ Captcha submetido com sucesso.');
          } else {
            this.logger.log('⚠️ Falha ao resolver o captcha.');
          }
        }
      } else {
        this.logger.log(
          '⚠️ Captcha não detectado na página. Verifique o seletor ou o carregamento da página.',
        );
      }
    } else {
      this.logger.log(
        'ℹ️ Painel de escolha de processos não encontrado. Prosseguindo para a próxima etapa.',
      );
    }

    // Adiciona listeners para capturar requisições e respostas
    this.logger.log(
      '🔍 Adicionando listeners para capturar requisições e respostas...',
    );

    // Listener para requisições
    page.on('request', (request) => {
      const url = request.url();
      if (url.includes('/api/processos/dadosbasicos/')) {
        this.logger.log(`🔍 Requisição capturada: ${url}`);
        this.logger.log(`🔍 Método: ${request.method()}`);
      }
    });

    // Variável para armazenar o ID da resposta anterior
    let previousId: string | null = null;

    // Listener para respostas (captura o ID da resposta anterior e cancela novas requisições após extração)
    page.on('response', (response) => {
      const url = response.url();
      if (url.includes('/api/processos/dadosbasicos/') && !previousId) {
        void (async () => {
          this.logger.log(`🔍 Resposta capturada: ${url}`);
          this.logger.log(`🔍 Status: ${response.status()}`);
          try {
            const responseBody = await response.text();
            this.logger.log(`🔍 Corpo da resposta: ${responseBody}`);

            // Tenta extrair o ID da resposta
            const isProcessoDadosBasicos = (
              obj: unknown,
            ): obj is { id: number } => {
              return (
                typeof obj === 'object' &&
                obj !== null &&
                'id' in obj &&
                typeof (obj as Record<string, unknown>).id === 'number'
              );
            };

            const data: unknown = JSON.parse(responseBody);
            if (
              Array.isArray(data) &&
              data.length > 0 &&
              isProcessoDadosBasicos(data[0])
            ) {
              previousId = data[0].id.toString();
              this.logger.log(`🔍 ID extraído: ${previousId}`);
            } else {
              this.logger.log('⚠️ Estrutura inesperada na resposta.');
            }
          } catch (err) {
            this.logger.log(`⚠️ Erro ao obter o corpo da resposta: ${err}`);
          }
        })();
      }
    });
    const extractedData = await new Promise<ProcessosResponse>((resolve) => {
      const handler = (response: import('puppeteer').HTTPResponse): void => {
        void (async () => {
          const url = response.url();
          if (previousId && url.includes(`/api/processos/${previousId}`)) {
            this.logger.log(`🔍 Resposta subsequente capturada: ${url}`);
            this.logger.log(`🔍 Status: ${response.status()}`);

            const headers = response.headers();
            const contentType = headers['content-type'];
            if (contentType && contentType.includes('application/pdf')) {
              this.logger.log('⚠️ Resposta ignorada: Tipo de conteúdo é PDF.');
              return;
            }

            try {
              const responseJson = (await response.json()) as ProcessosResponse;
              if (
                typeof responseJson === 'object' &&
                responseJson !== null &&
                'id' in responseJson &&
                'numero' in responseJson &&
                'classe' in responseJson &&
                'poloAtivo' in responseJson
              ) {
                page.off('response', handler);

                resolve(responseJson);
              }
            } catch (err) {
              this.logger.log(`⚠️ Erro ao processar a resposta: ${err}`);
            }
          }
        })();
      };

      page.on('response', handler);
    });

    // Finaliza a extensão (fecha a página e o contexto do navegador)
    await page.close();
    await BrowserManager.closeContext(context);

    return { data: extractedData, multipleInstances };
  }

  private async delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
