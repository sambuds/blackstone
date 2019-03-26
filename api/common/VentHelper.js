const { Client } = require('pg');
const EventEmitter = require('events');

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
        console.log(`Updated high_water to: ${this.high_water}`);
      }
    }
  }

  waitForVent(result) {
    const target = Number.parseInt(result.height, 10);
    const self = this;
    // If the height has already been reached return
    if (this.high_water >= target) {
      console.log(`Height ${this.high_water} has already been reached, resolving result`);
      return new Promise((resolve, reject) => resolve(result));
    }
    // otherwise we need to wait for vent -> return a promise
    const P = new Promise((resolve, reject) => {
      console.log(`Created promise for target ${target}`);
      const callback = (height) => {
        console.log(`Entered callback with height ${height}`);
        // If the height has been reached, clean up listener and resolve promise
        if (height >= target) {
          console.log(`Postgres has caught up to height ${target}, resolving result`);
          self.emitter.removeListener('height', callback);
          resolve(result);
        }
      };
      console.log(`Current high_water in promise: ${self.high_water}`);
      self.emitter.on('height', callback);
    });

    return P;
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
