import {TxExecution, TxHeader} from '@hyperledger/burrow/proto/exec_pb';
import {EventEmitter} from 'events';
import {getLogger} from 'log4js';
import createPostgresSubscriber, {Subscriber} from "pg-listen";

const heightChannel = "height";

export class VentSyncError extends Error {
  public readonly isVentSyncError = true;

  constructor(public readonly targetHeight: number,
              public readonly highWater: number,
              public readonly maxWaitTimeMs: number) {
    super(`VentSyncError: timed out after ${maxWaitTimeMs}ms waiting for target height [ ${targetHeight} ] having only seen up to height ${highWater} (is Vent healthy?) [${new Date()}]`);
  }

  public static isTypeOf(err: Error): err is VentSyncError {
    return (err as VentSyncError).isVentSyncError === true;
  }
}

/**
 * BurrowWatcher observes results from Burrow transactions and uses a VentListener to wait until the transaction's
 * state has reached the database.
 */
export class BurrowWatcher {
  private capture = new TxExecution();
  private header = new TxHeader();

  /**
   * BurrowWatcher observe TxExecution results from Burrows and records their height then uses the VentListener
   * passed to wait until state at the same height as the transaction has been written to the database.
   *
   * @param vent
   */
  constructor(private readonly vent: VentListener) {
    this.header.setHeight(0);
    this.capture.setHeader(this.header);
  }

  /**
   * Returns a promise that resolves when the vent state surpasses the highest height of any Burrow transaction result
   * that was passed to update. Ensures all Burrow transactions registered with update() have reached the database.
   *
   */
  async wait(): Promise<TxExecution> {
    return new Promise<TxExecution>((resolve, reject) => {
      const target = BurrowWatcher.heightFromResult(this.capture);
      if (target === undefined) {
        return reject(new Error(`BurrowWatcher.wait(): could not extract height from previously captured Burrow result: '${JSON.stringify(this.capture)}'`));
      }

      if (this.vent.highWater >= target) {
        this.vent.log.debug(`Target height [ ${target} ] already surpassed, resolving result promise`);
        return resolve(this.capture);
      }

      // otherwise we need to wait for vent to return a promise
      let resolved = false;
      this.vent.log.debug(`Created result promise for target height [ ${target} ]`);

      const registerHeight = (height: number) => {
        // If the height has been reached, remove event listener and resolve promise
        if (!resolved && height >= target) {
          this.vent.log.debug(`Resolving result promise for target height [ ${target} ]`);
          this.vent.emitter.removeListener('height', registerHeight);
          resolved = true;
          resolve(this.capture);
        }
      };

      this.vent.log.debug(`Current highWater in promise: ${this.vent.highWater}`);
      this.vent.emitter.on('height', registerHeight);

      setTimeout(() => {
        if (!resolved) {
          const err = new VentSyncError(target, this.vent.highWater, this.vent.maxWaitTimeMs);
          this.vent.log.error(err);
          if (this.vent.errOnTimeout) {
            reject(err)
          }
        }
      }, this.vent.maxWaitTimeMs);
    });
  }

  /**
   * Use the height from a Burrow transaction result to update the height high watermark that will be awaited by wait()
   * @param result
   */
  update(result: TxExecution) {
    const height = BurrowWatcher.heightFromResult(result);
    if (height !== undefined) {
      if (height > this.capture.getHeader().getHeight()) {
        this.capture.getHeader().setHeight(height);
      }
    }
    return result;
  }


  private static heightFromResult(result: TxExecution): number {
    if (!result) return undefined;
    else if (!result.getHeader()) return undefined;
    else return result.getHeader().getHeight();
  }
}

export class VentListener {
  highWater = 0;
  emitter = new EventEmitter();
  subscriber: Subscriber<Record<'height', { '_height': string }>>;
  log = getLogger('vent-listener');

  /**
   * Create a VentListener that
   *
   * @param connection Database connection string like 'postgres://...'
   * @param maxWaitTimeMs The maximum amount of time to wait for a target height before timing out in milliseconds
   * @param errOnTimeout Whether to throw an error if maxWaitTimeMs is breached
   */
  constructor(private readonly connection: string, public maxWaitTimeMs: number = 3000,
              public readonly errOnTimeout = true) {
    this.subscriber = createPostgresSubscriber(
      {connectionString: this.connection},
      {retryTimeout: Infinity});
  }

  NewWatcher(): BurrowWatcher {
    return new BurrowWatcher(this);
  }

  private handleHeight(height: number) {
    // Conditionally update high water mark and emit event
    if (height > this.highWater) {
      this.highWater = height;
      this.emitter.emit('height', this.highWater);
      this.log.trace(`Updated high_water to height: [ ${this.highWater} ]`);
    }
  }

  async listen() {
    this.subscriber.notifications.on(heightChannel, msg => this.handleHeight(Number(msg._height)));

    this.subscriber.events.on("error", (error) => {
      // With our retry option this _should_ never happen (pg-listen only errs if retry limit or timeout is exceeded) so
      console.error("Fatal database connection error from VentListener (this should not happen - we should reconnect indefinitely):", error)
      process.exit(1)
    })

    process.on("exit", () => {
      this.subscriber.close()
    })

    try {
      await this.subscriber.connect();
      await this.subscriber.listenTo(heightChannel)
    } catch (err) {
      throw new Error(`VentListener: could not start listening: ${err.stack || JSON.stringify(err)}`)
    }
  }

  async close() {
    return this.subscriber.close();
  }
}
