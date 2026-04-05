import { Processor } from '@nestjs/bullmq';
import { Provider } from '@nestjs/common';
import { ALL_TRT_DOCUMENT_QUEUES } from 'src/helpers/getTRTQueue';
import { GenericDocumentosWorker } from 'src/modules/pje/queues/wokers/documentos-trt.worker'; // Revertido para o caminho original

// Centraliza configurações globais
const DEFAULT_CONCURRENCY = 1;
const LOCK_DURATION = 300_000; // 5 minutos

export function createDynamicDocumentsWorkers(): Provider[] {
  const queues = [...ALL_TRT_DOCUMENT_QUEUES];

  return queues.map((queueName) => {
    // Configura concurrency e rate limiter para TRT15
    const processorOptions = {
      concurrency: DEFAULT_CONCURRENCY,
      limiter: {
        max: 2,
        duration: 1000,
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
