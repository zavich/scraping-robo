import { Provider } from '@nestjs/common';
import { Processor } from '@nestjs/bullmq';
import { ALL_TRT_QUEUES } from 'src/helpers/getTRTQueue';
import { GenericProcessoWorker } from '../modules/pje/queues/wokers/processos-trt.worker';
const DEFAULT_CONCURRENCY = 10;
const LOCKRENEW_DURATION = 30000; // 1 minuto
const LOCK_DURATION = 600000; // 5 minutos
const STALLED_INTERVAL = 60000; // 1 minuto
export function createDynamicWorkers(): Provider[] {
  const queues = [...ALL_TRT_QUEUES, 'pje-tst'];

  return queues.map((queueName) => {
    const processorOptions = {
      concurrency: DEFAULT_CONCURRENCY,
      lockDuration: LOCK_DURATION,
      lockRenewTime: LOCKRENEW_DURATION,
      stalledInterval: STALLED_INTERVAL,
    };

    @Processor(queueName, processorOptions)
    class WorkerForQueue extends GenericProcessoWorker {}

    return {
      provide: `Worker_${queueName}`,
      useClass: WorkerForQueue,
    };
  });
}
