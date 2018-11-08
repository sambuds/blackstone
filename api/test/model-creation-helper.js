const chai = require('chai');
const chaiHttp = require('chai-http');
const rid = require('random-id');
const path = require('path');
const fs = require('fs');
const _ = require('lodash');
const {
  parseBpmnModel,
  addProcessesToModel
} = require('../controllers/bpm-controller');
const contracts = require(__controllers + '/contracts-controller');

module.exports.createModel = (author, xml) => {
  return new Promise(async (resolve, reject) => {
    let model;
    try {
      parseBpmnModel(xml)
        .then(async (res) => {
          model = res.model;
          try {
            model.address = await contracts.createProcessModel(model.id, model.name, model.version, author, model.private, '', '');
            const processResponses = await addProcessesToModel(model.address, res.processes);
            return resolve({
              model, processes: processResponses
            });
          } catch (err) {
            return reject(err);
          }
        })
        .catch(err => {
          return reject(err);
        });
    } catch (err) {
      return reject(err);
    }
  });
}
