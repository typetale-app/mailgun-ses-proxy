import logger from "../../lib/core/logger";

export type ItemFn = () => Promise<any>;

type ItemWrapperObj = {
  fn: ItemFn;
  id?: string;
};

type StatsObj = {
  item: ItemWrapperObj | null;
  time: number;
};

type FailedItemsArray = Array<string | undefined>;

type OnFinishListener = ({
  min,
  max,
  avg,
  settledCount,
  totalDuration,
  realRate,
  failedItems,
}: {
  min: StatsObj;
  max: StatsObj;
  avg: number;
  settledCount: number;
  totalDuration: number;
  realRate: number;
  failedItems: FailedItemsArray;
}) => void;

export const createQueue = ({rateLimit = 25}: {rateLimit: number}) => {
  const log = logger.child({ service: "queue" });

  let startTime: number | null = null;
  let min: StatsObj = {
    item: null,
    time: Infinity,
  };
  let max: StatsObj = {
    item: null,
    time: -Infinity,
  };
  let averageSum = 0;
  let settledCount = 0;
  let failedItems: FailedItemsArray = [];

  let queuedItems: Array<ItemWrapperObj> = [];
  let runningItems: Array<ItemWrapperObj> = [];
  let intervalHandle: ReturnType<typeof setInterval> | null = null;
  const onFinishListeners: OnFinishListener[] = [];

  const onFinish = (fn: OnFinishListener) => {
    onFinishListeners.push(fn);
  };

  const addToQueue = (fn: ItemFn, id?: string) => {
    if (!startTime) {
      startTime = performance.now();
    }
    queuedItems.push({
      fn,
      id,
    });
    processQueue();
  };

  const doProcessTick = () => {
    if (queuedItems.length === 0) {
      if (intervalHandle) {
        clearInterval(intervalHandle);
        intervalHandle = null;
      }
      if (runningItems.length === 0) {
        log.debug("queue finished processing");
        onFinishListeners.forEach((fn) => {
          const totalDuration = performance.now() - (startTime || 0);
          fn({
            min,
            max,
            avg: averageSum / settledCount,
            settledCount: settledCount,
            totalDuration,
            realRate: settledCount / (totalDuration / 1000),
            failedItems,
          });
        });
      }
    } else if (runningItems.length === rateLimit) {
      return;
    } else {
      log.debug({ queuedItems: queuedItems.length, runningItems: runningItems.length }, "adding item to running queue");
      const itemWrapper = queuedItems.shift() as ItemWrapperObj;
      runningItems.push(itemWrapper);
      const startItemTime = performance.now();
      itemWrapper
        .fn()
        .catch((reason) => {
          log.warn({ err: reason, itemId: itemWrapper.id }, "queue item failed");
          failedItems.push(itemWrapper.id);
        })
        .finally(() => {
          const finishItemTime = performance.now();
          const timeTaken = finishItemTime - startItemTime;
          log.debug({ itemId: itemWrapper.id, timeTaken }, "queue item completed");

          if (timeTaken < min.time) {
            min = {
              item: itemWrapper,
              time: timeTaken,
            };
          }

          if (timeTaken > max.time) {
            max = {
              item: itemWrapper,
              time: timeTaken,
            };
          }

          averageSum += timeTaken;
          settledCount += 1;
          runningItems = runningItems.filter((i) => i !== itemWrapper);
          processQueue();
        });
    }
  };

  const processQueue = () => {
    if (intervalHandle === null) {
      intervalHandle = setInterval(doProcessTick, 1000 / rateLimit);
    }
  };

  return {
    onFinish,
    addToQueue,
  };
};
