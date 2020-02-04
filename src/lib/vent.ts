import { Client, Notification } from 'pg';
import { EventEmitter } from 'events';
import { TxExecution, TxHeader } from '@hyperledger/burrow/proto/exec_pb';
import { Logger } from 'log4js';

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
  client: Client;
  log: Logger;

  constructor(connection: string, maxWaitTime: number) {
    this.connection = connection;
    this.maxWaitTime = maxWaitTime || 3000;
    this.high_water = 0;
    this.emitter = new EventEmitter();
  }

  NewWaiter(): {
    (result: TxExecution): TxExecution;
    wait(vent: VentListener, result: TxExecution): Promise<TxExecution>;
  } {
    const capture = new TxExecution();
    const header = new TxHeader();
    header.setHeight(0);
    capture.setHeader(header);

    const max = (result: TxExecution) => {
      const height = heightFromResult(result);
      if (height !== undefined) {
        if (height > capture.getHeader().getHeight()) {     
          capture.getHeader().setHeight(0);
        }
      }
      return result;
    }
    
    max.wait = WaitForVent.bind(this, capture);
    return max;
  }

  private handleHeight(msg: Notification) {
    if (msg.channel === 'height') {
      // Extract height from notification payload
      const payload = JSON.parse(msg.payload);
      const height = Number.parseInt(payload._height, 10);
      // Conditionally update high water mark and emit event
      if (height > this.high_water) {
        this.high_water = height;
        this.emitter.emit('height', this.high_water);
        this.log.trace(`Updated high_water to height: [ ${this.high_water} ]`);
      }
    }
  }

  async listen() {
    this.client = new Client({ connectionString: this.connection });
    await this.client.connect();
    this.client.on('error', (err) => {
      this.log.error(`Encountered VentHelper pg client error: ${err.stack}`);
    });
    this.client.on('end', () => {
      // Emitted when the client disconnects from the PostgreSQL server
      this.log.info('VentHelper pg client disconnected. Creating a new client and resuming listening for height notifications...');
      this.listen();
    });
    this.client.on('notification', msg => this.handleHeight(msg));
    this.client.query('LISTEN height');
  }
}

function WaitForVent(vent: VentListener, result: TxExecution): Promise<TxExecution> {
  return new Promise<TxExecution>((resolve, reject) => {
    const target = heightFromResult(result);
    if (target === undefined) {
      return reject(new Error(`waitForVent passed a value that does not look like a Burrow result: '${JSON.stringify(result)}'`));
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
}