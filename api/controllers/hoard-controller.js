const {
  addMeta,
  splitMeta,
  decrypt,
} = require(`${global.__common}/controller-dependencies`);
const boom = require('boom');
const Hoard = require('@monax/hoard');
const hoard = new Hoard.Client(global.__settings.monax.hoard);

const hoardPut = (req, res, next) => {
  const meta = {
    name: req.files[0].originalname,
    mime: req.files[0].mimetype,
  };

  const grantIn = {
    Plaintext: {
      Data: addMeta(meta, req.files[0].buffer),
      Salt: req.body.salt ? Buffer.from(req.body.salt) : Buffer.from(process.env.HOARD_SALT)
    },
    GrantSpec: {
        Symmetric: {
          SecretID: req.body.secret ? Buffer.from(req.body.secret) : Buffer.from(process.env.SECRET_ID)
        }
    }
  };

  hoard
    .putseal(grantIn)
    .then((_grant) => {
      const grant = Buffer.from(JSON.stringify(hoard.base64ify(grant))).toString('base64')
      res.status(200).json(grant);
      return next();
    })
    .catch(err => next(boom.badImplementation(err)));
};

const hoardGet = (req, res, next) => {

  const grant = JSON.parse(Buffer.from(req.query.grant, 'base64').toString('ascii'))

  hoard
    .unsealget(grant)
    .then((_data) => {
      const data = splitMeta(_data);

      if (req.query.meta === 'true') {
        res.status(200).send(data);
      } else {
        res.attachment(data.meta.name);
        res.status(200).send(data.data);
      }

      return next();
    })
    .catch(err => next(boom.badImplementation(err)));
};

const getModelFromHoard = ({ address, secretKey }) => new Promise(async (resolve, reject) => {
  try {
    const grant = {
      Spec: { 
        Symmetric: {
          SecretID: Buffer.from(process.env.SECRET_ID)
        }
      },
      EncryptedReference: Buffer.from(req.query.encref, 'base64'),
      Version: 1
    };

    const data = await hoard.unsealget(grant);
    return resolve(data);
  } catch (err) {
    return reject(err);
  }
});

module.exports = {
  hoard,
  hoardPut,
  hoardGet,
  getModelFromHoard,
};
