const { Client } = require('pg');
const EventEmitter = require('events');

const MAX_WAIT_TIME_MS = 3000;

class VentHelper {
  constructor(connectionString) {
    this.connectionString = connectionString;
    this.client = new Client({ connectionString });
    this.high_water = 0;
    this.emitter = new EventEmitter();
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
        console.log(`Updated high_water to height: [ ${this.high_water} ]`);
      }
    }
  }

  waitForVent(result) {
    if (result && result.height) {
      const target = Number.parseInt(result.height, 10);
      const self = this;
      // If the height has already been reached return
      if (this.high_water >= target) {
        console.log(`Target height [ ${target} ] already surpassed, resolving result`);
        return new Promise((resolve, reject) => resolve(result));
      }
      // otherwise we need to wait for vent -> return a promise
      const P = new Promise((resolve, reject) => {
        console.log(`Created promise for target height [ ${target} ]`);
        const callback = (height) => {
          // If the height has been reached, clean up listener and resolve promise
          if (height >= target) {
            console.log(`Resolving promise for target height [ ${target} ]`);
            self.emitter.removeListener('height', callback);
            resolve(result);
          }
        };
        console.log(`Current high_water in promise: ${self.high_water}`);
        self.emitter.on('height', callback);
        console.log(`>>>>>>>>> NOTE <<<<<<<<<< ${new Date()}: Data will resolve in ${MAX_WAIT_TIME_MS}ms if target height notification not received`);
        setTimeout(() => {
          console.warn(`>>>>>>> WARNING <<<<<<<<< ${new Date()}: Target height notification not received, resolving response for target height [ ${target} ]`);
          callback(target);
        }, 3000);
      });
      return P;
    }
    return new Promise((resolve, reject) => resolve(result));
  }

  getEmitter() {
    return this.emitter;
  }

  listen() {
    this.client.connect();
    this.client.on('notification', msg => this.handleHeight(msg));
    this.client.query('LISTEN height');
  }
}

module.exports = connectionString => new VentHelper(connectionString);
