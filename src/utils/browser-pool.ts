// src/utils/browser-pool.ts

import { BrowserContext } from 'puppeteer';
import { BrowserManager } from './browser.manager';

export class BrowserPool {
  private activeCount = 0;
  private maxContexts: number;

  constructor(maxContexts = 5) {
    this.maxContexts = maxContexts;
  }

  init() {
    console.log(
      `🚀 Pool configurado para até ${this.maxContexts} contexts simultâneos`,
    );
  }

  async acquire(): Promise<BrowserContext> {
    // Espera enquanto o limite de contextos ativos for atingido
    while (this.activeCount >= this.maxContexts) {
      await new Promise((r) => setTimeout(r, 200));
    }

    this.activeCount++;
    try {
      const browser = await BrowserManager.getBrowser();
      // Criamos um contexto NOVO e ISOLADO para cada Job
      const context = await browser.createBrowserContext();
      return context;
    } catch (error) {
      this.activeCount--; // Decrementa se falhar ao criar
      throw error;
    }
  }

  /**
   * O segredo está aqui: A função agora é ASYNC.
   * Só libera a vaga no pool DEPOIS que o contexto fechar de verdade.
   */
  async release(context: BrowserContext) {
    try {
      if (context) {
        await context.close(); // Limpa cookies, cache e memória do job
      }
    } catch (err) {
      console.error('⚠️ Erro ao fechar contexto no release:', err.message);
    } finally {
      this.activeCount--; // Libera a vaga para o próximo da fila
      console.log(`♻️ Contexto finalizado. Ativos: ${this.activeCount}`);
    }
  }

  async closeAll() {
    const browser = await BrowserManager.getBrowser();
    await browser.close();
  }
}
