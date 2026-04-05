// src/utils/browser-manager.ts
import { Browser, Page, BrowserContext } from 'puppeteer';
import puppeteer from 'puppeteer-extra';

// CommonJS compat
// eslint-disable-next-line @typescript-eslint/no-require-imports
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

export class BrowserManager {
  private static browser: Browser | null = null;
  private static contextPool: BrowserContext[] = [];
  private static maxContexts = 5; // Número máximo de contextos reutilizáveis

  /**
   * Retorna uma instância única do browser.
   */
  static async getBrowser(): Promise<Browser> {
    if (!this.browser) {
      this.browser = await puppeteer.launch({
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--no-zygote',
          '--disable-software-rasterizer',
        ],
        protocolTimeout: 300000,
        timeout: 300000,
      });
      console.log('✅ Browser inicializado');
    }
    return this.browser;
  }

  /**
   * Obtém um contexto reutilizável ou cria um novo se o limite não for atingido.
   */
  static async getContext(): Promise<BrowserContext> {
    if (this.contextPool.length > 0) {
      return this.contextPool.pop()!;
    }

    const browser = await this.getBrowser();
    return browser.createBrowserContext();
  }

  /**
   * Devolve um contexto ao pool para reutilização.
   */
  static releaseContext(context: BrowserContext) {
    if (this.contextPool.length < this.maxContexts) {
      this.contextPool.push(context);
    } else {
      context.close().catch(() => {});
    }
  }

  /**
   * Cria uma nova página dentro de um contexto reutilizável.
   */
  static async createPage(): Promise<{ context: BrowserContext; page: Page }> {
    const browser = await this.getBrowser();

    // 🔥 NOVO: cria contexto isolado SEMPRE
    const context = await browser.createBrowserContext();

    const page = await context.newPage();

    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const blocked = ['image', 'font', 'media'];
      if (blocked.includes(req.resourceType())) {
        req.abort().catch(() => {});
      } else {
        req.continue().catch(() => {});
      }
    });

    return { context, page };
  }

  /**
   * Fecha página e devolve o contexto ao pool.
   */
  static async closeContext(context: BrowserContext): Promise<void> {
    try {
      await context.close(); // 🔥 mata o contexto
    } catch {}
  }
}
