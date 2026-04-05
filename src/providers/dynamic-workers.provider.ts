import { Provider } from '@nestjs/common';
import { Processor } from '@nestjs/bullmq';
import { ALL_TRT_QUEUES } from 'src/helpers/getTRTQueue';
import { GenericProcessoWorker } from '../modules/pje/queues/wokers/processos-trt.worker';
const DEFAULT_CONCURRENCY = 2;
const LOCK_DURATION = 300_000;
export function createDynamicWorkers(): Provider[] {
  const queues = [...ALL_TRT_QUEUES, 'pje-tst'];

  return queues.map((queueName) => {
    const processorOptions = {
      concurrency: DEFAULT_CONCURRENCY,
      limiter: {
        max: 1,
        duration: 5000, // 1 request a cada 5s
      },
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
