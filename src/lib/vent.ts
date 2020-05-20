import {EventEmitter} from 'events';
import {TxExecution, TxHeader} from '@hyperledger/burrow/proto/exec_pb';
import {getLogger, Logger} from 'log4js';
import createPostgresSubscriber, {Subscriber} from "pg-listen";

export type Watcher = {
  update(result: TxExecution): TxExecution;
  wait(): Promise<TxExecution>;
}

function heightFromResult(result: TxExecution) {
  if (!result) return undefined;
  else if (!result.getHeader()) return undefined;
  else return result.getHeader().getHeight();
}

export class VentListener {
  connection: string;
  maxWaitTime: number;
  high_water: number;
  emitter: EventEmitter;
  subscriber: Subscriber<Record<'height', { '_height': string }>>;
  log: Logger;

  constructor(connection: string, maxWaitTime: number) {
    this.connection = connection;
    this.maxWaitTime = maxWaitTime || 3000;
    this.high_water = 0;
    this.emitter = new EventEmitter();
    this.log = getLogger('vent-listener');
    this.subscriber = createPostgresSubscriber(
      {connectionString: this.connection},
      {retryTimeout: Infinity});
  }

  NewWatcher(): Watcher {
    const capture = new TxExecution();
    const header = new TxHeader();
    header.setHeight(0);
    capture.setHeader(header);

    return {
      update: (result: TxExecution) => {
        const height = heightFromResult(result);
        if (height !== undefined) {
          if (height > capture.getHeader().getHeight()) {
            capture.getHeader().setHeight(height);
          }
        }
        return result;
      },
      wait: async () => WaitForVent(this)(capture),
    };
  }

  private handleHeight(height: number) {
    // Conditionally update high water mark and emit event
    if (height > this.high_water) {
      this.high_water = height;
      this.emitter.emit('height', this.high_water);
      this.log.trace(`Updated high_water to height: [ ${this.high_water} ]`);
    }
  }

  async listen() {
    this.subscriber.notifications.on("height", msg => this.handleHeight(Number(msg._height)));

    this.subscriber.events.on("error", (error) => {
      // With our retry option this _should_ never happen (pg-listen only errs if retry limit or timeout is exceeded) so
      // we m
      console.error("Fatal database connection error from VentListener (this should not happen - we should reconnect indefinitely):", error)
      process.exit(1)
    })

    process.on("exit", () => {
      this.subscriber.close()
    })

    await this.subscriber.connect();
  }
}

export function WaitForVent(vent: VentListener) {
  return async (result: TxExecution): Promise<TxExecution> => {
    return new Promise<TxExecution>((resolve, reject) => {
      const target = heightFromResult(result);
      if (target === undefined) {
        return reject(new Error(`WaitForVent passed a value that does not look like a Burrow result: '${JSON.stringify(result)}'`));
      }

      if (vent.high_water >= target) {
        vent.log.debug(`Target height [ ${target} ] already surpassed, resolving result promise`);
        return resolve(result);
      }

      // otherwise we need to wait for vent -> return a promise
      let resolved = false;
      vent.log.debug(`Created result promise for target height [ ${target} ]`);

      const registerHeight = (height: number) => {
        // If the height has been reached, remove event listener and resolve promise
        if (!resolved && height >= target) {
          vent.log.debug(`Resolving result promise for target height [ ${target} ]`);
          vent.emitter.removeListener('height', registerHeight);
          resolved = true;
          resolve(result);
        }
      };

      vent.log.debug(`Current high_water in promise: ${vent.high_water}`);
      vent.emitter.on('height', registerHeight);

      setTimeout(() => {
        if (!resolved) {
          vent.log.warn(`>>>>>>> WARNING <<<<<<< ${new Date()}: Target height [ ${target} ] notification not received after ${vent.maxWaitTime}ms, resolving promise anyway`);
          registerHeight(target);
        }
      }, vent.maxWaitTime);

      return null;
    });
  };
}
