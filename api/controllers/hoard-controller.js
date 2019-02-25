const {
  addMeta,
  splitMeta,
  asyncMiddleware,
} = require(`${global.__common}/controller-dependencies`);
const boom = require('boom');
const Hoard = require('@monax/hoard');
const hoard = new Hoard.Client(global.__settings.monax.hoard);

const hoardPut = (metadata, data) => new Promise((resolve, reject) => {
  const grantIn = {
    Plaintext: {
      Data: addMeta(metadata, data),
      Salt: Buffer.from(process.env.HOARD_SALT),
    },
    GrantSpec: {
      Symmetric: {
        SecretID: Buffer.from(process.env.SECRET_ID),
      },
    },
  };
  hoard
    .putseal(grantIn)
    .then((response) => {
      const grant = Buffer.from(JSON.stringify(hoard.base64ify(response))).toString('base64');
      return resolve(grant);
    })
    .catch(err => reject(boom.badImplementation(err)));
});

const hoardPutApiHandler = asyncMiddleware(async (req, res) => {
  const meta = {
    name: req.files[0].originalname,
    mime: req.files[0].mimetype,
  };
  const grant = await hoardPut(meta, req.files[0].buffer);
  res.status(200).json({ grant });
});

const hoardGet = grant => new Promise((resolve, reject) => {
  const _grant = JSON.parse(Buffer.from(grant, 'base64').toString('ascii'));
  hoard
    .unsealget(_grant)
    .then(response => resolve({ data: response.Data }))
    .catch(err => reject(boom.badImplementation(err)));
});

const hoardGetApiHandler = asyncMiddleware(async (req, res) => {
  const data = await hoardGet(req.query.grant);
  const response = splitMeta(data);
  if (req.query.meta === 'true') {
    res.status(200).send(response);
  } else {
    res.attachment(response.meta.name);
    res.status(200).send(response.data);
  }
});

const getModelFromHoard = grant => new Promise(async (resolve, reject) => {
  try {
    const data = await hoardGet(grant);
    return resolve(data);
  } catch (err) {
    return reject(err);
  }
});

module.exports = {
  hoard,
  hoardPut,
  hoardPutApiHandler,
  hoardGet,
  hoardGetApiHandler,
  getModelFromHoard,
};
