var sqlite3 = require('sqlite3')
var util = require('util')
var async = require('async')
var EventEmitter = require('events')

var parallelLimit = 1

var logger = require(__common + '/monax-logger')
var log = logger.getLogger('monax.sqlsol')

// Goal pass a structure definition JS object, a contract and a SQL database (Assumes you are using sqllite3)
function sqlcache (filename, callback) {
  // Sqlcache object is initialized to automatically maintain a table created for that contract
  // under the name contractname
  this.db = new sqlite3.Database(filename, callback)
  this.contracts = {}
  this.tables = {}

  this.emitter = new EventEmitter()
}

module.exports = sqlcache

for (var k in sqlite3.Database.prototype) {
  sqlcache.prototype[k] = function () {
    this.db[k].apply(this.db, arguments)
  }
}

// strip the leading '0x' from the value
function cleanOnlyHex (value) {
  // To convert from weird web3 object that is returned into actual value
  // value = value.valueOf()

  if (typeof (value) === 'string' || value instanceof String) {
		 return (value.slice(0, 2) == '0x') ? value.slice(2) : value
  }
  return value
}

function processField (output) {
  var Pop = {}
  Pop.name = output.name
  Pop.isString = false
  Pop.isBytes = false
  Pop.isBool = false
  Pop.isInt = false

  switch (true) {
    case /bytes/i.test(output.type):
      Pop.type = 'VARCHAR(100)'
      // Pop.isString = true;
      Pop.isBytes = true
      Pop.defaultVal = "\'\'"
      break
    case /int/i.test(output.type):
      Pop.type = 'INT'
      Pop.isInt = true
      Pop.defaultVal = '0'
      break
    case /address/i.test(output.type):
      Pop.type = 'VARCHAR(100)'
      // Pop.isString = true;
      Pop.isBytes = true
      Pop.defaultVal = "\'\'"
      break
    case /bool/i.test(output.type):
      Pop.type = 'BOOLEAN'
      Pop.isBool = true
      Pop.defaultVal = '0'
      break
    case /string/i.test(output.type):
      Pop.type = 'TEXT'
      Pop.isString = true
      Pop.defaultVal = "\'\'"
      break
    default:
      throw new Error('Could not Identify return type: ' + output.type)
  }
  return Pop
}

function useOutput (output) {
  // This might be expanded over time
  // Currently I only know that exists is a special name that can't be used
  if (output.name == 'exists') {
    return false
  }

  return true
}

function getFunc(abi, funcName){
	var funcDefs = abi.filter(function(obj){return (obj.type == 'function' && obj.name == funcName)})

	if (funcDefs.length == 0) throw new Error("No such function found: " + funcName);
	if (funcDefs.length > 1) throw new Error("Function call is not unique: " + funcName);

  return funcDefs[0]
}

sqlcache.prototype.normalizeStructDef = function (abi, SD) {
  // Check top level structure requirements
  if (!SD.tables) throw new Error("The structure Definition file does not have a \'tables\'' object")
  if (!SD.initSeq) throw new Error("The structure Definition file does not have a \'initSeq\'' object")

  // Normalizes key feilds (init seq)
  // Normalizes the Table fields

  function normalCall (call) {
    if (typeof (call) === 'string' || call instanceof String) {
      // Call is string
      return {call: call}
    } else if (call !== null && typeof call === 'object') {
      // Call is object
      return call
    } else if (call === undefined) {

    } else {
      return {constant: call}
    }
  }

  function validateCall (call, field) {
    // Check if the call and field combo exists in the abi
    if (call.constant != undefined) {
      return // If its constant no need to check
    }
    var callName
    if (call !== null && typeof call === 'object') {
      if (!call.call) throw new Error("Call object has bad form: No \'call\' field")
      callName = call.call
      field = call.field
    } else if (typeof (call) === 'string' || call instanceof String) {
      callName = call
    } else {
      throw new Error('Unexpected call form: ' + JSON.stringify(call))
    }
    var funcDef = getFunc(abi, callName)
    if (field !== undefined && !funcDef.outputs.some(function (obj) { return obj.name == field })) throw new Error('The call ' + callName + ' does not have a return field ' + field)
  }

  // Init Seq
  for (key in SD.initSeq) {
    if (!SD.initSeq[key].min) SD.initSeq[key].min = 0
    if (!SD.initSeq[key].len) throw new Error('The key ' + key + ' does not have a length definition in the structDef')

    // Normalize these three calls
    SD.initSeq[key].min = normalCall(SD.initSeq[key].min)
    SD.initSeq[key].len = normalCall(SD.initSeq[key].len)
    if (SD.initSeq[key].deserialize) SD.initSeq[key].deserialize = normalCall(SD.initSeq[key].deserialize)

    // Validate these three calls
    validateCall(SD.initSeq[key].min)
    validateCall(SD.initSeq[key].len)
    if (SD.initSeq[key].deserialize) validateCall(SD.initSeq[key].deserialize)

    // Validate key dependencies
    if (SD.initSeq[key].dependent) {
      var dep = SD.initSeq[key].dependent
      if (!SD.initSeq[dep]) throw new Error('The key ' + key + ' has a undefined dependency of ' + dep)
      // if (SD.initSeq[dep].dependent) throw new Error("The key " + key + " has a dependency of " + dep + " which has its own dependency. Multi-layer dependency is not supported")
    }
  }

  // Validate initSeq dependancies

  for (TName in SD.tables) {
    if (typeof (SD.tables[TName]) === 'string' || SD.tables[TName] instanceof String) {
      // Replace it with a new object
      SD.tables[TName] = {call: SD.tables[TName]}
    }

    // If not an object at this point its and error
    if (SD.tables[TName] === null || typeof SD.tables[TName] !== 'object') throw new Error('Table defintion error at ' + TName)
    if (!SD.tables[TName].call) throw new Error('Table definition ' + TName + ' does not have a call field')
    if (!SD.tables[TName].keys) SD.tables[TName].keys = getFunc(abi, SD.tables[TName].call).inputs.map(function (obj) { return obj.name })

    // Validate all table keys are known
    for (var i = 0; i < SD.tables[TName].keys.length; i++) {
      if (!SD.initSeq[SD.tables[TName].keys[i]]) throw new Error('The table ' + tabName + ' requires the key ' + SD.tables[TName].keys[i] + ' but it is not defined in the initSeq section')
    };
  }

  // Normalize Table inputs and outputs and initing
  for (TName in SD.tables) {
    var table = SD.tables[TName]
    SD.tables[TName].name = TName
    SD.tables[TName].getRow = table.call
    SD.tables[TName].inputs = getFunc(abi, table.call).inputs.map(processField)
    SD.tables[TName].fields = getFunc(abi, table.call).outputs.map(processField)
    SD.tables[TName].init = table.keys.reduce(function (a, b) { a[b] = SD.initSeq[b]; return a }, {})
    SD.tables[TName].keyOrder = []

    var depTrack = {}
    var leaves = []

    function fillDep (key) {
      if (!depTrack[key]) {
        if (table.init[key].dependent) {
          if (!depTrack[table.init[key].dependent]) fillDep(table.init[key].dependent)
          depTrack[key] = {
            path: depTrack[table.init[key].dependent].path.concat([key]),
            leaf: true
          }
          depTrack[table.init[key].dependent].leaf = false
        } else {
          depTrack[key] = {
            path: [key],
            leaf: true
          }
        }
      }
    }

    for (key in table.init) {
      // Produce the keyOrder lineralize the dependency
      fillDep(key)
    }

    for (key in table.init) {
      if (depTrack[key].leaf) {
        leaves.push(key)
        SD.tables[TName].keyOrder.push(depTrack[key].path)
      }
    }
  }

  return SD
}

sqlcache.prototype.add = function (contract, SD, CName, callback) {
  var self = this
  var P = new Promise(function (resolve, reject) {
    self._addContract(CName, contract, function (err) {
      if (err) return reject(err)
      self._addStructDef(CName, SD, function (err) {
        if (err) return reject(err)
        self._initTables(SD, CName, function (err) {
          if (err) return reject(err)
          return resolve()
        })
      })
    })
  })

  // Backwards compatibility with my tests which still need to be updated
  if (callback == null) {
    return P
  } else {
    P.then(callback, callback)
  }
}

sqlcache.prototype._initTables = function (SD, CName, callback) {
  var self = this

  async.eachOf(SD.tables, function (table, TName, cb) {
    // Create the tables in the cache
    self._initializeTable(TName, CName, cb)
  }, callback)
}

sqlcache.prototype._addStructDef = function (CName, SD, callback) {
  var self = this
  // Function for adding all the tables from a structure definition file
  // CName references the Contract (which should already be in the system) for which calls
  // Will be made to

  if (!this.contracts[CName]) return callback(new Error('Unknown contract ' + CName))
  var abi = this.contracts[CName].abi

  try {
    SD = this.normalizeStructDef(abi, SD)
  } catch (err) {
    return callback(err)
  }

  async.eachOf(SD.tables, function (table, TName, cb) {
    // Create the tables in the cache
    self._addTable(table, cb)
  }, callback)
}

function outputFormatter (abi, data) {
  // Determine if it has already been formatted
  var abiOutputs = abi.outputs
  var raw
  if (data.raw) {
    // Format myself
    raw = data.raw
  } else {
    if (!(data instanceof Array)) {
	        raw = [data]
	    } else {
	    	raw = data
	    }
  }

  // Run formatter
  var output = {raw: raw}
  if (abiOutputs.length !== output.raw.length) {
    log.error('Output array length does not match the length specified by the interface.')
    // return output;
  }
  var values = {}
  for (var i = 0; i < data.length; i++) {
    var name = abiOutputs[i].name
    if (name) {
      values[name] = cleanOnlyHex(data[i])
    }
  }
  output.values = values
  return output
}

sqlcache.prototype._processCall = function (CName, call, inArgs, callback) {
  var self = this
  var CData = this.contracts[CName]
  var contract = CData.contract

  if (call.constant != undefined) {
    return callback(null, call.constant)
  }

  if (!contract[call.call]) return callback(new Error("The contract does not have a function for method \'" + call.call + "\'"))

  var funcABI = getFunc(CData.abi, call.call)

  if (inArgs.length !== funcABI.inputs.length) return callback(new Error("Mis-match of number of input arguments for \'" + call.call + "\' expected: " + funcABI.inputs.length + ' got: ' + inArgs.length))

  var returnProcessor = function (err, data) {
    if (err) return callback(err)
    if (!data) return callback(null)

    // return callback(null);

    if (call.field) {
      return callback(null, data.values[call.field])
    } else {
      return callback(null, data.raw[0])
    }
  }

  // return callback(null);
  var args = inArgs.slice()
  args.push(returnProcessor)

  contract[call.call].sim.apply(contract, args)
}

function matching (aInd, aVals, bInd, bVals) {
  var match = true
  for (var i = 0; i < aInd.length; i++) {
    if (aVals[aInd[i]] != bVals[bInd[i]]) {
      match = false
      break
    }
  };
  return match
}

sqlcache.prototype.joinSets = function (keyOrders, keySets, cb) {
  var keySet = keySets[0]
  var keyOrder = keyOrders[0]
  var inSet = {}
  var setInd = {}

  for (var i = 0; i < keyOrder.length; i++) {
    inSet[keyOrder[i]] = true
    setInd[keyOrder[i]] = i
  };

  for (var i = 1; i < keyOrders.length; i++) {
    // Determine what are the matching keys
    var matched = keyOrders[i].filter(function (v) { return inSet[v] })
    var nonmatched = keyOrders[i].filter(function (v) { return (inSet[v] == undefined) })
    // need to find positions of the matching
    var mInd = matched.map(function (a) { return keyOrders[i].indexOf(a) })
    var nmInd = nonmatched.map(function (a) { return keyOrders[i].indexOf(a) })
    var sInd = matched.map(function (a) { return setInd[a] })
    var tempKeySet = []

    // Execute merge
    // Loop through all keys already existing
    for (var j = 0; j < keySet.length; j++) {
      // Loop through all keys being merged
      for (var k = 0; k < keySets[i].length; k++) {
        // if they agree on the matched keys cross them
        if (sInd.length == 0) {
          var unmatched = nmInd.map(function (a) { return keySets[i][k][a] })
          tempKeySet.push(keySet[j].concat(unmatched))
        } else if (matching(sInd, keySet[j], mInd, keySets[i][k])) {
          // find non matching (new) keys and add them.
          var unmatched = nmInd.map(function (a) { return keySets[i][k][a] })
          tempKeySet.push(keySet[j].concat(unmatched))
        }
      };
    };

    // Add keys to inSet list
    // Add key Indices to the setInd
    for (var j = 0; j < nonmatched.length; j++) {
      inSet[nonmatched[j]] = true
      setInd[nonmatched[j]] = keyOrder.length + j
    };

    // Modify the keyOrder
    keyOrder = keyOrder.concat(nonmatched)
    keySet = tempKeySet
  };

  return [keyOrder, keySet]
}

sqlcache.prototype._initializeTable = function (TName, CName, callback) {
  var self = this

  if (!this.tables[TName]) {
    return callback(new Error("A table with name \'" + TName + "\' was not found"))
  }

  var table = this.tables[TName]
  // var CName = table.contractName;

  // Start by Getting maxes for the table
  var keySets = []

  async.eachOfSeries(table.keyOrder, function (keySeq, index, cb1) {
    var newKeySet = [[]]

    async.eachOfSeries(keySeq, function (key, index, cb2) {
      var tempKeySet = []
      var keyData = table.init[key]

      async.eachOfSeries(newKeySet, function (m, index, cb3) {
        self._processCall(CName, keyData.min, m, function (err, min) {
          if (err) return cb3(err)

          self._processCall(CName, keyData.len, m, function (err, len) {
            if (err) return cb3(err)
            var i = min
            async.whilst(function () { return (i < min + len) }, function (cb4) {
              if (keyData.deserialize) {
                self._processCall(CName, keyData.deserialize, m.concat([i]), function (err, kval) {
                  if (err) return cb4(err)
                  var mprime = m.slice()
                  mprime.push(kval)
                  tempKeySet.push(mprime)
                  i++
                  return cb4(null)
                })
              } else {
                var mprime = m.slice()
                mprime.push(i)
                tempKeySet.push(mprime)
                i++
                return cb4(null)
              }
            }, cb3)
          })
        })
      }, function (err) {
        if (err) return cb2(err)
        newKeySet = tempKeySet.slice()
        return cb2(null)
      })
    }, function (err) {
      if (err) return cb1(err)
      keySets.push(newKeySet)
      return cb1(null)
    })
  }, function (err) {
    if (table.keyOrder.length > 1) {
      var retData = self.joinSets(table.keyOrder, keySets)
      table.keyOrder = retData[0]
      table.keySet = retData[1]
    } else {
      table.keyOrder = table.keyOrder[0]
      table.keySet = keySets[0]
    }

    var perm = table.keys.map(function (a) { return table.keyOrder.indexOf(a) })
    // At this point keySets should be good for filling tables with

    async.eachOfLimit(table.keySet, parallelLimit, function (set, index, cb) {
      // // Re-arrange set
      set = perm.map(function (a) { return set[a] })
      self.update(TName, CName, set, cb)
      // return cb(null)
    }, callback)
    // return callback(err);
  })
}

sqlcache.prototype.update = function (TName, CName, keys, callback) {
  var self = this

  if (typeof callback !== 'function') {
    throw new Error('Callback function not provided')
  }

  if (!this.tables[TName]) {
    return callback(new Error("A table with name \'" + TName + "\' was not found"))
  }

  var table = this.tables[TName]
  keys = keys.slice(0, table.keys.length).map(cleanOnlyHex)
  var db = this.db

  if (table.inputs.length > keys.length) {
    return callback(new Error('Not enough keys provide for table setting. Required ' + table.inputs.length + ' but got ' + keys.length))
  }

  if (!this.contracts[CName]) {
    return callback(new Error('A contract by name ' + table.contractName + ' was not found and is neede to update table ' + TName))
  }

  var contract = this.contracts[CName].contract

  // Now the meat
  // Processor function for contract return data call
  var processReturn = function (err, data) {
    var fields = table.fields

    if (err) return callback(err)
    if (!data) return callback(null)

    // var output = outputFormatter(getFunc(contract.abi, table.getRow), data);
    var output = data

    self._set(TName, output.values, keys, callback)
  }
  // Call contract to get new data
  keys = keys.map((value, index) => {
    return formatInputField(value, table.inputs[index])
  })
  var args = keys.slice().concat([processReturn])

  contract[table.getRow].sim.apply(contract, args)
}

// Base Operations

sqlcache.prototype._addContract = function (CName, contract, callback) {
  var self = this
  // Function for adding a Contract object into the system

  if (this.contracts[CName]) return callback(new Error('A contract is already registered under the name ' + CName))

  this.contracts[CName] = {
    name: CName,
    contract: contract,
    abi: contract.abi,
    address: contract.address,
    subObjs: []
  }

  // Start the event listeners
  var sub = function (err, subObj) {
    self.contracts[CName].subObjs.push(subObj)
  }

  // Double check this TODO
  function flattenEventArgs (event, eventData) {
    var flat = []
    for (var i = 0; i < event.inputs.length; i++) {
      var input = event.inputs[i].name
      flat.push(eventData.args[input])
    };
    return flat
  };

  var updateHandle = function (event) {
    var updateHandler = function (err, eventData) {
      eventData.raw = flattenEventArgs(event, eventData)
      if (err) {
        log.error('An error occurred in the event handler: ' + err)
      } else {
        var TName = eventData.raw[0].toString()
        var keys = eventData.raw.slice(1)

        self.update(TName, CName, keys, function (err) {
          if (err && !((err.message || '').startsWith('A table with name'))) {
            log.error('An error occurred whilst attempting to update the table ' + TName + '\n' + err)
          }
          self.emitter.emit('update', {'table': TName, 'keys': keys, 'error': err})
        })
      }
    }

    return updateHandler
  }

  var removeHandle = function (event) {
    var removeHandler = function (err, eventData) {
      eventData.raw = flattenEventArgs(event, eventData)
      if (err) {
        log.error('An error occurred in the event handler: ' + err)
      } else {
        var TName = eventData.raw[0].toString()
        var keys = eventData.raw.slice(1)

        self._remove(TName, keys, function (err) {
          self.emitter.emit('remove', {'table': TName, 'keys': keys})
          if (err) log.error('An error occurred whilst attempting to update the table ' + TName + '\n' + err)
          self.emitter.emit('remove', {'table': TName, 'keys': keys, 'error': err})
        })
      }
    }
    return removeHandler
  }

  // Attach a listeners for any event whose name starts with
  // "update" or "remove"

  var updateflag = false
  for (var i = 0; i < contract.abi.length; i++) {
    var element = contract.abi[i]
    if (element.type == 'event' && /update.*/i.test(element.name) && contract[element.name]) {
      // Found an update event
      updateflag = true
      contract[element.name](updateHandle(element))
    } else if (element.type == 'event' && /remove.*/i.test(element.name) && contract[element.name]) {
      // Found a remove event
      contract[element.name](removeHandle(element))
    }
  };

  if (!updateflag) {
    log.info('WARNING: Contract does not have any update events. Tables will not auto update')
  }

  return callback(null)
}

// Remove a contract and all subscriptions to it

sqlcache.prototype._rmContract = function (CName, callback) {
  var self = this

  if (!this.contracts[CName]) {
    return callback(new Error('A contract with name ' + CName + ' was not found'))
  }

  var contract = this.contracts[CName]
  async.each(contract.subObjs, function (subObj, cb) {
    subObj.stop(function (err) {
      if (err) log.error('Warning! An error occurred while attempting to unsubscribe from event : ' + err)
      return cb(null)
    })
  }, function (err) {
    if (err) return callback(err)
    delete self.contracts[CName]
    return callback(null)
  })
}

function formatInputField (value, field) {
  var out

  if (field.isInt) {
    out = parseInt(value.toString())
  } else {
    out = value
  }
  return out
}

function formatField (value, field) {
  var out
  if (field.isBytes) {
    // Strip 0x's
    value = (value.slice(0, 2) == '0x') ? value.slice(2) : value
    out = "\'" + value + "\'"
  } else if (field.isString) {
    // Strip 0x's
    value = (value.slice(0, 2) == '0x') ? value.slice(2) : value
    out = "\'" + value + "\'"
  } else if (field.isBool) {
    out = (/true/i.test(value) ? 1 : 0)
  } else {
    out = value.toString()
  }
  return out
}

sqlcache.prototype._addTable = function (table, callback) {
  var self = this

  // Add the table to the internal tracking
  var TName = table.name
  this.tables[TName] = table

  // sql table creation command
  var cmd = 'CREATE TABLE ' + table.name + '('

  pkeys = 'PRIMARY KEY ('
  for (var i = 0; i < table.inputs.length; i++) {
    if (i != 0) {
      pkeys += ', '
      cmd += ', '
    }
    pkeys += table.keys[i]
    cmd += table.keys[i] + ' ' + table.inputs[i].type
  };
  pkeys += ')'

  for (var i = 0; i < table.fields.length; i++) {
	 	var field = table.fields[i]
	 	cmd += ', ' + field.name + ' ' + field.type + ' DEFAULT ' + field.defaultVal
  };
  cmd += ', ' + pkeys + ')'

  // Create table in sql cache
  this.db.run(cmd, function (err) {
    if (err) return callback(new Error('An Error occured while attempting to create the table ' + table.name + ' with command ' + cmd))
    return callback(null)
  })
}

// Remove a table from the SQL table and records of it
sqlcache.prototype._rmTable = function (TName, callback) {
  var self = this

  if (!this.tables[TName]) {
    return callback(new Error('A table with name ' + name + ' was not found'))
  }

  var table = this.tables[TName]
  var cmd = 'DROP TABLE ' + TName

  this.db.run(cmd, function (err) {
    if (err) return callback(new Error('An Error occurred whilst attempting to drop the table ' + TName + ' : ' + err))
    delete self.tables[TName]
    return callback(null)
  })
}

sqlcache.prototype._get = function (TName, keys, callback) {
  var self = this

  if (typeof callback !== 'function') {
    throw new Error('Callback function not provided')
  }

  var table = this.tables[TName]
  var db = this.db

  if (!table) {
    return cb(new Error('A table with name ' + TName + ' was not found'))
  }

  if (table.inputs.length > keys.length) {
    return cb(new Error('Not enough keys provide for table setting. Required ' + table.inputs.length + ' but got ' + keys.length))
  }

  // Where Statement construction
  var where = ' WHERE '
  for (var i = 0; i < table.inputs.length; i++) {
    if (i != 0) where += ' AND '
    where += table.inputs[i].name + '=' + formatField(keys[i], table.inputs[i])
  };

  var get = 'SELECT * from ' + table.name + where

  db.get(get, callback)
}

sqlcache.prototype._remove = function (TName, keys, cb) {
  var self = this

  if (typeof cb !== 'function') {
    throw new Error('Callback function not provided')
  }

  var table = this.tables[TName]
  var db = this.db

  if (!table) {
    return cb(new Error('A table with name ' + TName + ' was not found'))
  }

  if (table.inputs.length > keys.length) {
    return cb(new Error('Not enough keys provide for table setting. Required ' + table.inputs.length + ' but got ' + keys.length))
  }

  // Where Statement construction
  var where = ' WHERE '
  for (var i = 0; i < table.inputs.length; i++) {
    if (i != 0) where += ' AND '
    where += table.keys[i] + '=' + formatField(keys[i], table.inputs[i])
  };
  var del = 'DELETE from ' + table.name + where

  db.run(del)
  return cb(null)
}

sqlcache.prototype._set = function (TName, data, keys, callback) {
  var self = this

  // At this point the callback should be a function if not its a fatal error
  if (typeof callback !== 'function') {
    throw new Error('Callback function not provided')
  }

  // This function will perform look ups in the table based on values for key1 and optionally key2
  if (!this.tables[TName]) {
    return callback(new Error('A table with name ' + name + ' was not found'))
  }

  var table = this.tables[TName]
  var db = this.db

  // //get the number of required keys from the table definition
  // var tkflag = (table.inputs.length == 2);
  if (table.inputs.length > keys.length) {
    return callback(new Error('Not enough keys provide for table setting. Required ' + table.inputs.length + ' but got ' + keys.length))
  }

  // Construct the sqlite statements
  var where = ' WHERE '
  var cols = '('
  var vals = 'VALUES ('
  for (var i = 0; i < table.inputs.length; i++) {
    if (i != 0) {
      where += ' AND '
      cols += ', '
      vals += ', '
    }
    where += table.keys[i] + '=' + formatField(keys[i], table.inputs[i])
    cols += table.keys[i]
    vals += formatField(keys[i], table.inputs[i])
  };

  var ins = 'INSERT into ' + table.name
  var upd = 'UPDATE ' + table.name + ' SET '

  var fflag = true
  for (var i = 0; i < table.fields.length; i++) {
	 	var field = table.fields[i]

	 	if (data[field.name] != null) {
	 		if (!fflag) upd += ', '
	 		fflag = false
 			cols += ', ' + field.name
		 	vals += ', ' + formatField(data[field.name], field)
		 	upd += field.name + '=' + formatField(data[field.name], field)
	 	}
  };

  cols += ')'
  vals += ')'

  ins += ' ' + cols + ' ' + vals
  upd += where

  var delflag = false

  if (!data || (data.hasOwnProperty('exists') && data.exists == false)) {
    var del = 'DELETE from ' + table.name + where
    delflag = true
  }

  // Check if an entry already exists and then either insert update or delete
  db.get('SELECT * from ' + table.name + where, function (err, row) {
    if (err) return callback(err)
    if (row === undefined && !delflag) {
      log.debug(ins)
      db.run(ins, callback)
    } else if (!delflag) {
      log.debug(upd)
      db.run(upd, callback)
    } else {
      log.debug(del)
      db.run(del, callback)
    }
  })
}
