import { Processor } from '@nestjs/bullmq';
import { Provider } from '@nestjs/common';
import { ALL_TRT_DOCUMENT_QUEUES } from 'src/helpers/getTRTQueue';
import { GenericDocumentosWorker } from 'src/modules/pje/queues/wokers/documentos-trt.worker'; // Revertido para o caminho original

// Centraliza configurações globais
const DEFAULT_CONCURRENCY = 2;
const SPECIAL_CONCURRENCY = 1;
const LOCK_DURATION = 300_000;

export function createDynamicDocumentsWorkers(): Provider[] {
  const queues = [...ALL_TRT_DOCUMENT_QUEUES];

  return queues.map((queueName) => {
    // Configura concurrency e rate limiter para TRT15
    const processorOptions = {
      concurrency:
        queueName === 'pje-documentos-trt3'
          ? SPECIAL_CONCURRENCY
          : DEFAULT_CONCURRENCY,
      limiter: {
        max: 1,
        duration: 3000, // 1 request a cada 3s
      },
      lockDuration: LOCK_DURATION,
    };

    @Processor(queueName, processorOptions)
    class WorkerForQueue extends GenericDocumentosWorker {}

    return {
      provide: `Worker_${queueName}`,
      useClass: WorkerForQueue,
    };
  });
}
