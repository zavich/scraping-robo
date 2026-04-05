import { Provider } from '@nestjs/common';
import { Processor } from '@nestjs/bullmq';
import { ALL_TRT_QUEUES } from 'src/helpers/getTRTQueue';
import { GenericProcessoWorker } from '../modules/pje/queues/wokers/processos-trt.worker';
const DEFAULT_CONCURRENCY = 2;
const SPECIAL_CONCURRENCY = 1;
const LOCK_DURATION = 120_000;
export function createDynamicWorkers(): Provider[] {
  const queues = [...ALL_TRT_QUEUES, 'pje-tst'];

  return queues.map((queueName) => {
    const processorOptions = {
      concurrency:
        queueName === 'pje-documentos-trt3'
          ? SPECIAL_CONCURRENCY
          : DEFAULT_CONCURRENCY,
      lockDuration: LOCK_DURATION,
    };

    @Processor(queueName, processorOptions)
    class WorkerForQueue extends GenericProcessoWorker {}

    return {
      provide: `Worker_${queueName}`,
      useClass: WorkerForQueue,
    };
  });
}
