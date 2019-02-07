const fs = require('fs');

let dbm;
let type;
let seed;

/**
  * We receive the dbmigrate dependency from dbmigrate initially.
  * This enables us to not have to rely on NODE_PATH.
  */
exports.setup = (options, seedLink) => {
  dbm = options.dbmigrate;
  type = dbm.dataType;
  seed = seedLink;
};

exports.up = async (db) => {
  await db.runSql('CREATE SCHEMA IF NOT EXISTS customers;');
};

exports.down = async (db) => {
  await db.runSql('DROP SCHEMA customers');
};

exports._meta = {
  version: 1,
};
