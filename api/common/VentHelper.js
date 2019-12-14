const { Client } = require('pg');
const EventEmitter = require('events');
const logger = require('./logger');
const log = logger.getLogger('vent-helper');

function heightFromResult(result) {
  if (!result) return undefined;
  if (result.height !== undefined) return result.height;
  if (result.Header && result.Header.Height) return result.Header.Height;
  return undefined;
}

class VentHelper {
  constructor(connectionString, maxWaitTime) {
    this.connectionString = connectionString;
    this.maxWaitTime = maxWaitTime || 3000;
    this.high_water = 0;
    this.emitter = new EventEmitter();
  }

  /**
   * Returns a function that can be passed Burrow results and records the maximum height seen.
   * The function has a `wait()` function that returns a promise waiting for Vent to reach the maximum height recorded
   * when `wait()` was invoked. This makes it possible to defer the `waitForVent` function and string together multiple
   * calls while capturing the high-water-mark of transaction results.
   *
   * @returns {function(*=): *} that can be passed multiple Burrow results (containing height) key
   */
  newVentWaiter() {
    const capture = { height: 0 };

    const max = (result) => {
      if (result && result.height !== undefined) {
        const newHeight = Number.parseInt(result.height, 10);
        if (newHeight > capture.height) {
          capture.height = newHeight;
        }
      }
      return result;
    };

    max.wait = this.waitForVent.bind(this, capture);
    return max;
  }

  waitForVent(result) {
    const self = this;

    return new Promise((resolve, reject) => {
      const targetString = heightFromResult(result);
      if (targetString === undefined) {
        return reject(new Error(`waitForVent passed a value that does not look like a Burrow result: '${JSON.stringify(result)}'`));
      }
      const target = Number.parseInt(targetString, 10);
      // If the height has already been reached return
      if (self.high_water >= target) {
        log.debug(`Target height [ ${target} ] already surpassed, resolving result promise`);
        return resolve(result);
      }
      // otherwise we need to wait for vent -> return a promise
      let resolved = false;
      log.debug(`Created result promise for target height [ ${target} ]`);

      const registerHeight = (height) => {
        // If the height has been reached, remove event listener and resolve promise
        if (!resolved && height >= target) {
          log.debug(`Resolving result promise for target height [ ${target} ]`);
          self.emitter.removeListener('height', registerHeight);
          resolved = true;
          resolve(result);
        }
      };

      log.debug(`Current high_water in promise: ${self.high_water}`);
      self.emitter.on('height', registerHeight);

      setTimeout(() => {
        if (!resolved) {
          log.warn(`>>>>>>> WARNING <<<<<<< ${new Date()}: Target height [ ${target} ] notification not received after ${self.maxWaitTime}ms, resolving promise anyway`);
          registerHeight(target);
        }
      }, self.maxWaitTime);

      return null;
    });
  }

  handleHeight(msg) {
    if (msg.channel === 'height') {
      // Extract height from notification payload
      const payload = JSON.parse(msg.payload);
      const height = Number.parseInt(payload._height, 10);
      // Conditionally update high water mark and emit event
      if (height > this.high_water) {
        this.high_water = height;
        this.emitter.emit('height', this.high_water);
        log.trace(`Updated high_water to height: [ ${this.high_water} ]`);
      }
    }
  }


  async listen() {
    this.client = new Client({ connectionString: this.connectionString });
    await this.client.connect();
    this.client.on('error', (err) => {
      log.error(`Encountered VentHelper pg client error: ${err.stack}`);
    });
    this.client.on('end', () => {
      // Emitted when the client disconnects from the PostgreSQL server
      log.info('VentHelper pg client disconnected. Creating a new client and resuming listening for height notifications...');
      this.listen();
    });
    this.client.on('notification', msg => this.handleHeight(msg));
    this.client.query('LISTEN height');
  }
}

module.exports = VentHelper;
