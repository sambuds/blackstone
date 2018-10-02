"use strict";

var dbm;
var type;
var seed;

/**
 * We receive the dbmigrate dependency from dbmigrate initially.
 * This enables us to not have to rely on NODE_PATH.
 */
exports.setup = function(options, seedLink) {
  dbm = options.dbmigrate;
  type = dbm.dataType;
  seed = seedLink;
};

exports.up = async function(db) {
  await db.runSql(
    "CREATE UNIQUE INDEX users_username_lower_idx ON users ((lower(username)));"
  );
  await db.runSql(
    "CREATE UNIQUE INDEX users_email_lower_idx ON users ((lower(email)));"
  );
  await db.changeColumn("users", "username", {
    unique: false
  });
  await db.changeColumn("users", "email", {
    unique: false
  });
};

exports.down = async function(db) {
  await db.runSql("DROP INDEX ON users users_username_lower_idx;");
  await db.runSql("DROP INDEX ON users users_email_lower_idx;");
  await db.changeColumn("users", "username", {
    unique: true
  });
  await db.changeColumn("users", "email", {
    unique: true
  });
};

exports._meta = {
  version: 1
};
