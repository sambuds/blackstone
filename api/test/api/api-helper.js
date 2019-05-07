/* eslint-disable */
const chai = require('chai');
const path = require('path');
const fs = require('fs');
const _ = require('lodash');
const logger = require(__common + '/logger');
const log = logger.getLogger('tests.api.helper');
const { pool } = require(`${__common}/postgres-db`);

module.exports = (server) => {
  return {
    activateUser: user => pool.connect()
      .then(async (client) => await client.query(`UPDATE ${global.db.schema.app}.users SET activated = true WHERE username = $1`, [user.username]))
      .catch((err) => {
        log.error(`Failed to activate user ${JSON.stringify(user)}: ${err.stack}`);
        throw err;
      }),

    registerUser: (user) => {
      user.firstName = 'firstname';
      user.lastName = 'lastname';
      return new Promise((resolve, reject) => {
        chai
          .request(server)
          .post('/users')
          .send(user)
          .end((err, res) => {
            if (err) return reject(err);
            else return resolve({
              address: res.body.address
            });
          });
      });
    },

    loginUser: (user) => {
      return new Promise((resolve, reject) => {
        chai
          .request(server)
          .put('/users/login')
          .send(user)
          .end((err, res) => {
            if (err) return reject(err);
            if (res.statusCode !== 200) return reject(res.body)
            let cookie = res.headers['set-cookie'][0];
            let token = cookie.split('access_token=')[1].split(';')[0];
            return resolve({
              token,
              loggedInUser: res.body
            });
          });
      })
    },

    createAndDeployModel: (xml, token) => {
      return new Promise((resolve, reject) => {
        chai
          .request(server)
          .post(`/bpm/process-models`)
          .set('Cookie', [`access_token=${token}`])
          .set('content-type', 'application/xml')
          .send(xml)
          .end((err, res) => {
            if (err) return reject(err);
            if (res.status !== 200) return reject(new Error('creating and deploying model NOT OK'));
            return resolve(res.body);
          });
      });
    },

    getDiagram: (modelAddress, accept, token) => {
      return new Promise((resolve, reject) => {
        chai.request(server)
        .get(`/bpm/process-models/${modelAddress}/diagram`)
        .set('Cookie', [`access_token=${token}`])
        .set('Accept', accept)
        .end((err, res) => {
          if (err) return reject(err);
          if (res.status !== 200) return reject(new Error('get diagram NOT OK'));
          return resolve(res.body);
        });
      });
    },

    getProcessDefinition: (processAddress, token) => {
      return new Promise((resolve, reject) => {
        chai.request(server)
        .get(`/bpm/process-definitions/${processAddress}`)
        .set('Cookie', [`access_token=${token}`])
        .end((err, res) => {
          if (err) return reject(err);
          if (res.status !== 200) return reject(new Error('get diagram NOT OK'));
          return resolve(res.body);
        });
      });
    },

    createArchetypePackage: (pkg, token) => {
      return new Promise((resolve, reject) => {
        chai
        .request(server)
          .post('/archetype-packages')
          .set('Cookie', [`access_token=${token}`])
          .send(pkg)
          .end((err, res) => {
            if (err) return reject(err);
            if (res.status !== 200) return reject(new Error('archetype package creation NOT OK'));
            log.debug('Archetype Package id: ' + res.body.id);
            return resolve({ id: res.body.id });
          });
      });
    },

    addArchetypeToPackage: (packageId, archetypeAddress, token) => {
      return new Promise((resolve, reject) => {
        chai
        .request(server)
          .put(`/archetype-packages/${packageId}/archetype/${archetypeAddress}`)
          .set('Cookie', [`access_token=${token}`])
          .end((err, res) => {
            if (err) return reject(err);
            if (res.status !== 200) return reject(new Error('adding archetype to package NOT OK'));
            return resolve();
          });
      });
    },

    getArchetypePackages: (token) => {
      return new Promise((resolve, reject) => {
        chai
          .request(server)
          .get(`/archetype-packages`)
          .set('Cookie', [`access_token=${token}`])
          .end((err, res) => {
            if (err) return reject(err);
            if (res.status !== 200) return reject(new Error('get archetype packages NOT OK'));
            return resolve(res.body);
          });
      });
    },

    activateArchetypePackage: (packageId, token) => {
      return new Promise((resolve, reject) => {
        chai
          .request(server)
          .put(`/archetype-packages/${packageId}/activate`)
          .set('Cookie', [`access_token=${token}`])
          .end((err, res) => {
            if (err) return reject(err);
            if (res.status !== 200) return reject(new Error('activate archetype package NOT OK'));
            return resolve();
          });
      })
    },

    deactivateArchetypePackage: (packageId, token) => {
      return new Promise((resolve, reject) => {
        chai
          .request(server)
          .put(`/archetype-packages/${packageId}/deactivate`)
          .set('Cookie', [`access_token=${token}`])
          .end((err, res) => {
            if (err) return reject(err);
            if (res.status !== 200) return reject(new Error('deactivate archetype package NOT OK'));
            return resolve();
          });

      })
    },

    createArchetype: (archetype, token) => {
      return new Promise((resolve, reject) => {
        chai
          .request(server)
          .post('/archetypes')
          .set('Cookie', [`access_token=${token}`])
          .send(archetype)
          .end((err, res) => {
            if (err) return reject(err);
            if (res.status !== 200) return reject(new Error('archetype creation NOT OK'));
            log.debug('Archetype Address: ' + res.body.address);
            return resolve({ address: res.body.address });
          });
      });
    },

    getArchetypes: (token) => {
      return new Promise((resolve, reject) => {
        chai
          .request(server)
          .get('/archetypes')
          .set('Cookie', [`access_token=${token}`])
          .end((err, res) => {
            if (err) return reject(err);
            if (res.status !== 200) return reject(new Error('get archetypes NOT OK'));
            return resolve(res.body);
          });
      });
    },

    getArchetype: (address, token) => {
      return new Promise((resolve, reject) => {
        chai
          .request(server)
          .get(`/archetypes/${address}`)
          .set('Cookie', [`access_token=${token}`])
          .end((err, res) => {
            if (err) return reject(err);
            if (res.status !== 200) return reject(new Error('get archetype NOT OK'));
            return resolve(res.body);
          });
      });
    },

    activateArchetype: (archetypeAddress, token) => {
      return new Promise((resolve, reject) => {
        chai
          .request(server)
          .put(`/archetypes/${archetypeAddress}/activate`)
          .set('Cookie', [`access_token=${token}`])
          .end((err, res) => {
            if (err) return reject(err);
            if (res.status !== 200) return reject(new Error('activate archetype NOT OK'));
            return resolve();
          });
      })
    },

    deactivateArchetype: (archetypeAddress, token) => {
      return new Promise((resolve, reject) => {
        chai
          .request(server)
          .put(`/archetypes/${archetypeAddress}/deactivate`)
          .set('Cookie', [`access_token=${token}`])
          .end((err, res) => {
            if (err) return reject(err);
            if (res.status !== 200) return reject(new Error('deactivate archetype NOT OK'));
            return resolve();
          });
      })
    },

    setArchetypeSuccessor: (archetypeAddress, successorAddress, token) => {
      return new Promise((resolve, reject) => {
        chai
          .request(server)
          .put(`/archetypes/${archetypeAddress}/successor/${successorAddress}`)
          .set('Cookie', [`access_token=${token}`])
          .end((err, res) => {
            if (err) return reject(err);
            if (res.status !== 200) return reject(new Error('set archetype successor NOT OK'));
            return resolve();
          });
      })
    },

    createAgreementCollection: (collection, token) => {
      return new Promise((resolve, reject) => {
        chai
        .request(server)
          .post('/agreement-collections')
          .set('Cookie', [`access_token=${token}`])
          .send(collection)
          .end((err, res) => {
            if (err) return reject(err);
            if (res.status !== 200) return reject(new Error('agreement collection creation NOT OK'));
            log.debug('Agreement Collection id: ' + res.body.id);
            return resolve({ id: res.body.id });
          });
      });
    },

    getAgreementCollection: (collectionId, token) => {
      return new Promise((resolve, reject) => {
        chai
        .request(server)
          .get('/agreement-collections/' + collectionId)
          .set('Cookie', [`access_token=${token}`])
          .end((err, res) => {
            if (err) return reject(err);
            if (res.status !== 200) return reject(new Error('get agreement collection NOT OK'));
            log.debug('Agreement Collection: ' + res.body);
            return resolve(res.body);
          });
      });
    },

    createAgreement: (agreement, token) => {
      return new Promise((resolve, reject) => {
        chai
          .request(server)
          .post('/agreements')
          .set('Cookie', [`access_token=${token}`])
          .send(agreement)
          .end((err, res) => {
            if (err) return reject(err);
            if (res.status !== 200) return reject(new Error('agreement creation NOT OK'));
            log.debug('Agreement Address: ' + res.body.address);
            return resolve({ address: res.body.address });
          });
      });
    },

    getAgreement: (agreementAddress, token) => {
      return new Promise((resolve, reject) => {
        chai
          .request(server)
          .get(`/agreements/${agreementAddress}`)
          .set('Cookie', [`access_token=${token}`])
          .end((err, res) => {
            if (err) return reject(err);
            if (res.status !== 200) return reject(new Error('getting agreement NOT OK'));
            return resolve(res.body);
          });
      });
    },

    getTasksForUser: (token) => {
      return new Promise((resolve, reject) => {
        chai
          .request(server)
          .get('/tasks')
          .set('Cookie', [`access_token=${token}`])
          .end((err, res) => {
            if (err) return reject(err);
            if (res.status !== 200) return reject(new Error('getting tasks for user NOT OK'));
            log.debug('User Tasks: ' + JSON.stringify(res.body));
            return resolve(res.body);
          });
      });
    },

    getActivityInstance: (activityInstanceId, token) => {
      return new Promise((resolve, reject) => {
        chai
          .request(server)
          .get(`/bpm/activity-instances/${activityInstanceId}`)
          .set('Cookie', [`access_token=${token}`])
          .end((err, res) => {
            if (err) return reject(err);
            if (res.status !== 200) return reject(new Error('Error retrieving ActivityInstance'));
            return resolve(res.body);
          });
      });
    },

    setActivityDataValue: (activityInstanceId, dataMappingId, value, dataType, token) => {
      return new Promise((resolve, reject) => {
        chai
          .request(server)
          .put(`/bpm/activity-instances/${activityInstanceId}/data-mappings/${dataMappingId}`)
          .set('Cookie', [`access_token=${token}`])
          .send({value, dataType})
          .end((err, res) => {
            if (err) return reject(err);
            if (res.status !== 200) return reject(new Error('setActivityDataValue value NOT OK'));
            return resolve();
          });
      });
    },

    setActivityDataValues: (activityInstanceId, data, token) => {
      return new Promise((resolve, reject) => {
        chai
          .request(server)
          .put(`/bpm/activity-instances/${activityInstanceId}/data-mappings`)
          .set('Cookie', [`access_token=${token}`])
          .send(data)
          .end((err, res) => {
            if (err) return reject(err);
            if (res.status !== 200) return reject(new Error('setActivityDataValues value NOT OK'));
            return resolve();
          });
      });
    },

    getActivityDataValue: (activityInstanceId, dataMappingId, token) => {
      return new Promise((resolve, reject) => {
        chai
          .request(server)
          .get(`/bpm/activity-instances/${activityInstanceId}/data-mappings/${dataMappingId}`)
          .set('Cookie', [`access_token=${token}`])
          .end((err, res) => {
            if (err) return reject(err);
            if (res.status !== 200) return reject(new Error('getActivityDataValue value NOT OK'));
            return resolve(res.body);
          });
      });
    },

    getActivityDataValues: (activityInstanceId, token) => {
      return new Promise((resolve, reject) => {
        chai
          .request(server)
          .get(`/bpm/activity-instances/${activityInstanceId}/data-mappings`)
          .set('Cookie', [`access_token=${token}`])
          .end((err, res) => {
            if (err) return reject(err);
            if (res.status !== 200) return reject(new Error('getActivityDataValues NOT OK'));
            return resolve(res.body);
          });
      });
    },

    completeTaskForUser: (activityInstanceId, data, token) => {
      return new Promise((resolve, reject) => {
        chai
          .request(server)
          .put(`/tasks/${activityInstanceId}/complete`)
          .set('Cookie', [`access_token=${token}`])
          .send(data ? { data } : {})
          .end((err, res) => {
            if (err) return reject(err);
            if (res.status !== 200) return reject(new Error('complete task for user NOT OK'));
            return resolve();
          });
      });
    },

    completeAndSignTaskForUser: (activityInstanceId, agreement, token) => {
      return new Promise((resolve, reject) => {
        chai
          .request(server)
          .put(`/tasks/${activityInstanceId}/complete/${agreement}/sign`)
          .set('Cookie', [`access_token=${token}`])
          .send({
            signature: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUAAAAFCAYAAACNbyblAAAADElEQVQImWNgoBMAAABpAAFEI8ARAAAAAElFTkSuQmCC',
            firstName: 'Joe',
            lastName: 'Smith',
            company: 'Joe Smith and Sons and Daughters',
            title: 'CEO',
            email: 'joe@smithandsonsanddaughters.com',
            address: '10 Company St. New York, NY 10018',
            date: 1554326702120,
          })
          .end((err, res) => {
            if (err) return reject(err);
            if (res.status !== 200) return reject(new Error('complete and sign task for user NOT OK'));
            return resolve();
          });
      });
    },

    cancelAgreement: (agreement, token) => {
      return new Promise((resolve, reject) => {
        chai
          .request(server)
          .put(`/agreements/${agreement}/cancel`)
          .set('Cookie', [`access_token=${token}`])
          .end((err, res) => {
            if (err) return reject(err);
            if (res.status !== 200) return reject(new Error('cancel agreement NOT OK'));
            return resolve();
          });
      });
    },

    uploadAttachmentFile: (agreement, token) => {
      return new Promise((resolve, reject) => {
        chai
          .request(server)
          .post(`/agreements/${agreement}/attachments`)
          .set('Cookie', [`access_token=${token}`])
          .attach('attachment', __dirname + '/web-api-test.js')
          .end((err, res) => {
            if (err) return reject(err);
            if (res.status !== 200) return reject(new Error('upload attachment NOT OK'));
            return resolve(res.body);
          });
      });
    },

    uploadAttachmentObject: (agreement, attachment, token) => {
      return new Promise((resolve, reject) => {
        chai
          .request(server)
          .post(`/agreements/${agreement}/attachments`)
          .set('Cookie', [`access_token=${token}`])
          .send(attachment)
          .end((err, res) => {
            if (err) return reject(err);
            if (res.status !== 200) return reject(new Error('upload attachment NOT OK'));
            return resolve(res.body);
          });
      });
    },

    getHoard: (grant) => {
      return new Promise((resolve, reject) => {
        chai
          .request(server)
          .get(`/hoard?grant=${encodeURIComponent(grant)}`)
          .end((err, res) => {
            if (err) return reject(err);
            if (res.status !== 200) return reject(new Error('hoard get NOT OK'));
            return resolve(res.header['content-disposition']);
          });
      });
    },

    generateModelXml: (modelId, modelPath) => {
      let xml = fs.readFileSync(path.resolve(modelPath), 'utf8');
      xml = _.replace(xml, new RegExp('###MODEL_ID###', 'g'), modelId);
      return xml;
    },

    getFromHoard: (fileRefString) => new Promise((resolve, reject) => {
      chai
      .request(server)
      .get(`/hoard?grant=${encodeURIComponent(fileRefString)}`)
      .end((err, res) => {
        if (err) return reject(err);
        if (res.status !== 200) return reject(new Error('get from hoard NOT OK'));
        return resolve(res.text);
      });
    }),

    getUsers: (token) => new Promise((resolve, reject) => {
      chai
      .request(server)
      .get('/users')
      .set('Cookie', [`access_token=${token}`])
      .end((err, res) => {
        if (err) return reject(err);
        if (res.status !== 200) return reject(new Error('get users NOT OK'));
        return resolve(res.body);
      });
    }),

    getProfile: (token) => new Promise((resolve, reject) => {
      chai
      .request(server)
      .get('/users/profile')
      .set('Cookie', [`access_token=${token}`])
      .end((err, res) => {
        if (err) return reject(err);
        if (res.status !== 200) return reject(new Error('get profile NOT OK'));
        return resolve(res.body);
      });
    }),

    updateProfile: (token, profile) => new Promise((resolve, reject) => {
      chai
      .request(server)
      .put('/users/profile')
      .send(profile)
      .set('Cookie', [`access_token=${token}`])
      .end((err, res) => {
        if (err) return reject(err);
        if (res.status !== 200) return reject(new Error('put profile NOT OK'));
        return resolve(res.body);
      });
    }),

    createOrganization: (token, org) => new Promise((resolve, reject) => {
      chai
      .request(server)
      .post('/organizations')
      .send(org)
      .set('Cookie', [`access_token=${token}`])
      .end((err, res) => {
        if (err) return reject(err);
        if (res.status !== 200) return reject(new Error('post organization NOT OK'));
        return resolve(res.body);
      });
    }),

    getOrganizations: (token) => new Promise((resolve, reject) => {
      chai
      .request(server)
      .get('/organizations')
      .set('Cookie', [`access_token=${token}`])
      .end((err, res) => {
        if (err) return reject(err);
        if (res.status !== 200) return reject(new Error('get organizations NOT OK'));
        return resolve(res.body);
      });
    }),

    getOrganization: (token, address) => new Promise((resolve, reject) => {
      chai
      .request(server)
      .get(`/organizations/${address}`)
      .set('Cookie', [`access_token=${token}`])
      .end((err, res) => {
        if (err) return reject(err);
        if (res.status !== 200) return reject(new Error('get organization NOT OK'));
        return resolve(res.body);
      });
    }),

    addOrganizationUsers: (token, address, users) => new Promise((resolve, reject) => {
      chai
      .request(server)
      .put(`/organizations/${address}/users`)
      .send({ users })
      .set('Cookie', [`access_token=${token}`])
      .end((err, res) => {
        if (err) return reject(err);
        if (res.status !== 200) return reject(new Error('put organization users NOT OK'));
        return resolve(res.body);
      });
    }),

    removeOrganizationUser: (token, address, user) => new Promise((resolve, reject) => {
      chai
      .request(server)
      .delete(`/organizations/${address}/users/${user}`)
      .set('Cookie', [`access_token=${token}`])
      .end((err, res) => {
        if (err) return reject(err);
        if (res.status !== 200) return reject(new Error('delete organization users NOT OK'));
        return resolve(res.body);
      });
    }),

    addOrganizationDepartment: (token, address, department) => new Promise((resolve, reject) => {
      chai
      .request(server)
      .put(`/organizations/${address}/departments`)
      .send(department)
      .set('Cookie', [`access_token=${token}`])
      .end((err, res) => {
        if (err) return reject(err);
        if (res.status !== 200) return reject(new Error('put organization departments NOT OK'));
        return resolve(res.body);
      });
    }),

    addOrganizationApprovers: (token, address, users) => new Promise((resolve, reject) => {
      chai
      .request(server)
      .put(`/organizations/${address}/approvers`)
      .send({ users })
      .set('Cookie', [`access_token=${token}`])
      .end((err, res) => {
        if (err) return reject(err);
        if (res.status !== 200) return reject(new Error('put organization approvers NOT OK'));
        return resolve(res.body);
      });
    }),

    removeOrganizationApprover: (token, address, user) => new Promise((resolve, reject) => {
      chai
      .request(server)
      .delete(`/organizations/${address}/approvers/${user}`)
      .set('Cookie', [`access_token=${token}`])
      .end((err, res) => {
        if (err) return reject(err);
        if (res.status !== 200) return reject(new Error('delete organization approvers NOT OK'));
        return resolve(res.body);
      });
    }),
  }
}
