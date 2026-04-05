import {
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import Redis from 'ioredis';
import { CaptchaService } from 'src/services/captcha.service';
import { BrowserManager } from 'src/utils/browser.manager';
import { userAgents } from 'src/utils/user-agents';

@Injectable()
export class PjeLoginService {
  private readonly logger = new Logger(PjeLoginService.name);
  constructor(
    private readonly captchaService: CaptchaService,
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
  ) {
    // this.pool.init(); // inicializa o pool
  }
  async execute(
    regionTRT: number,
    username: string,
    password: string,
  ): Promise<{ cookies: string }> {
    const cacheKey = `pje:session:${regionTRT}`;
    const cachedCookies = await this.redis.get(cacheKey);

    if (cachedCookies) {
      this.logger.debug(`Sessão cacheada reutilizada para TRT-${regionTRT}`);
      return { cookies: cachedCookies };
    }

    const { context, page } = await BrowserManager.createPage();

    try {
      const loginUrl = `https://pje.trt${regionTRT}.jus.br/consultaprocessual`;

      const randomUA =
        userAgents[Math.floor(Math.random() * userAgents.length)];
      await page.setUserAgent(randomUA);

      this.logger.debug(`Acessando página inicial do TRT-${regionTRT}...`);
      await page.goto(loginUrl, { waitUntil: 'networkidle0' });
      await page
        .waitForFunction(
          () => {
            const iframes = Array.from(document.querySelectorAll('iframe'));
            return iframes.some(
              (f) =>
                f.src.includes('awswaf') ||
                f.src.includes('captcha') ||
                f.src.includes('token'),
            );
          },
          { timeout: 2000 },
        )
        .catch(() => null);

      // Depois que o iframe aparece, busca o frame correspondente
      const wafFrame = page
        .frames()
        .find(
          (f) =>
            f.url().includes('awswaf') ||
            f.url().includes('captcha') ||
            f.url().includes('token'),
        );

      if (!wafFrame) {
        console.log('❌ Nenhum frame AWS WAF encontrado');
      } else {
        console.log('✅ Frame AWS WAF detectado:', wafFrame.url());
      }

      // Detecta se é uma página de WAF
      const wafParams = await page.evaluate(() => {
        const w = window as unknown as {
          gokuProps?: { key?: string; iv?: string; context?: string };
        };

        // Tenta pegar diretamente do objeto gokuProps, se existir
        const key = w.gokuProps?.key || null;
        const iv = w.gokuProps?.iv || null;
        const context = w.gokuProps?.context || null;

        // Se não tiver, tenta extrair do HTML como fallback
        const html = document.documentElement.innerHTML;
        const backupKey =
          (html.match(/"key"\s*:\s*"([^"]+)"/i) || [])[1] ||
          (html.match(/"sitekey"\s*:\s*"([^"]+)"/i) || [])[1];

        const backupIv = (html.match(/"iv"\s*:\s*"([^"]+)"/i) || [])[1];
        const backupContext = (html.match(/"context"\s*:\s*"([^"]+)"/i) ||
          [])[1];

        const scripts = Array.from(document.querySelectorAll('script')).map(
          (s) => s.src,
        );
        const challengeScript = scripts.find((s) => s.includes('challenge'));
        const captchaScript = scripts.find((s) => s.includes('captcha'));

        return {
          websiteKey: key || backupKey,
          iv: iv || backupIv,
          context: context || backupContext,
          challengeScript,
          captchaScript,
        };
      });
      console.log('wafFrame URL:', wafFrame?.url() || '❌ não encontrado');
      const urlObj = new URL(loginUrl);

      const correctDomain = urlObj.hostname;

      if (wafParams?.websiteKey && wafParams?.context && wafParams?.iv) {
        this.logger.warn('⚠️ AWS WAF detectado — iniciando resolução...');

        const client = await page.target().createCDPSession();
        await client.send('Page.stopLoading');

        //
        // 1. EXTRAIR PARÂMETROS DO WAF
        //
        const wafParamsExtracted = await page.evaluate(() => {
          const win = window as Window & {
            gokuProps?: { key?: string; iv?: string; context?: string };
          };
          const goku = win.gokuProps;
          if (!goku) return null;

          const challengeScript =
            (
              document.querySelector(
                'script[src*="token.awswaf.com"]',
              ) as HTMLScriptElement | null
            )?.src || null;

          const captchaScript =
            (
              document.querySelector(
                'script[src*="captcha.awswaf.com"]',
              ) as HTMLScriptElement | null
            )?.src || null;

          return {
            websiteKey: goku.key,
            iv: goku.iv,
            context: goku.context,
            challengeScript,
            captchaScript,
          };
        });

        this.logger.log(
          '🧩 Parâmetros AWS WAF extraídos:',
          JSON.stringify(wafParamsExtracted, null, 2),
        );

        if (!wafParamsExtracted?.websiteKey) {
          throw new Error('Não foi possível extrair parâmetros do AWS WAF');
        }

        //
        // 2. RESOLVER CAPTCHA VIA 2CAPTCHA
        //
        const solved: {
          captcha_voucher?: string;
          existing_token?: string;
        } = await this.captchaService.resolveAwsWaf({
          websiteURL: loginUrl,
          websiteKey: wafParamsExtracted.websiteKey,
          context: wafParamsExtracted.context as string,
          iv: wafParamsExtracted.iv as string,
          challengeScript: wafParamsExtracted.challengeScript || '',
          captchaScript: wafParamsExtracted.captchaScript || '',
        });

        this.logger.log('✅ AWS WAF resolvido via 2Captcha');

        const tokenToUse = solved?.existing_token;
        if (!tokenToUse) {
          throw new Error(
            'existing_token não retornado pelo resolvedor AWS WAF',
          );
        }

        //
        // 3. OBTER /voucher DO WAF
        //
        const voucherBaseUrl = (
          wafParamsExtracted.challengeScript || ''
        ).replace(/\/challenge\.js$/, '');

        this.logger.log(`🔗 Base URL do voucher: ${voucherBaseUrl}`);

        const voucherResponseText = await page.evaluate(
          async (baseUrl, voucherBody) => {
            const res = await fetch(`${baseUrl}/voucher`, {
              method: 'POST',
              headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
              body: JSON.stringify(voucherBody),
            });
            return res.text();
          },
          voucherBaseUrl,
          {
            captcha_voucher: solved.captcha_voucher || '',
            existing_token: solved.existing_token || '',
          },
        );

        let voucherResponse: unknown = null;
        try {
          voucherResponse = JSON.parse(voucherResponseText);
        } catch {
          this.logger.warn('⚠️ Resposta /voucher não é JSON válido');
        }

        let newToken: string | undefined = undefined;
        if (
          voucherResponse &&
          typeof voucherResponse === 'object' &&
          'token' in voucherResponse &&
          typeof (voucherResponse as { token?: unknown }).token === 'string'
        ) {
          newToken = (voucherResponse as { token: string }).token;
        }

        //
        // 4. LIMPAR COOKIES EXISTENTES DO WAF
        //
        const wafCookies = (await page.cookies()).filter((c) =>
          c.name.startsWith('aws-waf'),
        );

        if (wafCookies.length) {
          await page.deleteCookie(
            ...wafCookies.map((c) => ({
              name: c.name,
              domain: c.domain,
              path: c.path || '/',
            })),
          );
          this.logger.log('🧹 Cookies AWS WAF removidos.');
        }

        await page.evaluate(() => {
          localStorage.clear();
          sessionStorage.clear();
        });

        //
        // 5. DEFINIR COOKIE DO TOKEN
        //
        try {
          const originalCookies = await page.cookies();
          const wafOriginal = originalCookies.find((c) =>
            c.name.includes('aws'),
          );
          const finalDomain = wafOriginal?.domain || correctDomain;

          await page.setCookie({
            name: 'aws-waf-token',
            value: newToken as string,
            domain: finalDomain,
            path: '/',
            httpOnly: false,
            secure: true,
            expires: Math.floor(Date.now() / 1000) + 3600,
          });

          this.logger.log(
            '🍪 Cookie aws-waf-token setado com sucesso (via setCookie)',
          );
        } catch (err) {
          this.logger.error(
            '⚠️ Falha no setCookie — usando fallback document.cookie',
          );
          this.logger.error(err);
          this.logger.warn(
            '⚠️ Falha no setCookie — usando fallback document.cookie',
          );
          await page.evaluate((token) => {
            document.cookie = `aws-waf-token=${token}; path=/; max-age=3600; Secure; SameSite=None`;
          }, newToken);
          this.logger.log(
            '🍪 Cookie aws-waf-token setado via fallback document.cookie',
          );
        }

        //
        // 6. RECARREGAR PARA VALIDAR O TOKEN
        //
        const originalCookies = await page.cookies();
        await this.redis.set(
          `aws-waf-token:${regionTRT}`,
          originalCookies.map((c) => `${c.name}=${c.value}`).join('; '),
          'EX',
          3600,
        );
        await new Promise((r) => setTimeout(r, 1500));
        await page.reload({ waitUntil: 'networkidle0' });
        this.logger.log('🔁 Página recarregada — AWS WAF liberado!');
      }
      // Verifica se a página inicial foi carregada corretamente
      const initialPageContent = await page.content();
      if (initialPageContent.includes('Sistema temporariamente indisponível')) {
        this.logger.error(
          'Erro ao acessar a página inicial: Sistema temporariamente indisponível.',
        );
        throw new ServiceUnavailableException(
          'Erro ao acessar a página inicial: Sistema temporariamente indisponível.',
        );
      }

      // Localiza e clica no botão de "Acesso restrito"
      const accessButtonSelector =
        'a[routerlink="/login"][mattooltip="Acesso restrito"]';
      await page.waitForSelector(accessButtonSelector, { visible: true });
      this.logger.debug('Botão "Acesso restrito" localizado.');
      await page.click(accessButtonSelector);

      // Aguarda a navegação para a página de login
      await page.waitForSelector('#usuarioField', { timeout: 15000 });

      this.logger.debug('🟢 Tela de login carregada!');

      this.logger.log('🔍 Verificando se AWS WAF foi realmente removido...');

      const stillWaf = await page
        .waitForSelector('input[name="usuario"]', { timeout: 3000 })
        .then(() => false)
        .catch(() => true);

      if (stillWaf) {
        throw new ServiceUnavailableException(
          'AWS WAF ainda ativo após resolução — necessário retry.',
        );
      }

      this.logger.log('🟢 AWS WAF removido! Prosseguindo com o login...');
      await new Promise((resolve) => setTimeout(resolve, 800));
      // Verifica e insere os valores nos campos de usuário e senha
      const usernameSelector = '#usuarioField';
      const passwordSelector = '#senhaField';

      this.logger.debug('Verificando campo de usuário...');
      await page.waitForSelector(usernameSelector, { visible: true });
      this.logger.debug('Campo de usuário localizado. Inserindo valor...');
      await page.click(usernameSelector);
      await page.type(usernameSelector, username);

      this.logger.debug('Verificando campo de senha...');
      await page.waitForSelector(passwordSelector, { visible: true });
      this.logger.debug('Campo de senha localizado. Inserindo valor...');
      await page.click(passwordSelector);
      await page.type(passwordSelector, password);

      this.logger.debug('Clicando no botão de login...');
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'networkidle0' }),
        page.click('#btnEntrar'),
      ]);

      // Verifica se o login foi bem-sucedido ou se houve algum problema
      const finalUrl = page.url();
      const html = await page.content();

      if (
        finalUrl.includes('login') ||
        html.includes('Usuário ou senha inválidos')
      ) {
        this.logger.error(
          'Erro ao realizar login: Credenciais inválidas ou problema no site.',
        );
        throw new ServiceUnavailableException(
          'Erro ao realizar login: Credenciais inválidas ou problema no site.',
        );
      }

      const cookies = await page.cookies();
      const cookieString = cookies
        .map((c) => `${c.name}=${c.value}`)
        .join('; ');

      await this.redis.set(cacheKey, cookieString, 'EX', 1800);

      this.logger.debug(`✅ Sessão Puppeteer salva em ${cacheKey}`);

      return { cookies: cookieString };
    } finally {
      await BrowserManager.closeContext(context);
    }
  }
}
