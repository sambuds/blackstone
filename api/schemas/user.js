const Joi = require('joi');

/*

sample user:
{
  username: 'username',
  email: 'myemail@company.com',
  password: 'hello1234',
}
*/

const userSchema = Joi.object().keys({
  username: Joi.string()
    .max(20, 'utf8')
    .regex(/^[a-zA-Z0-9-_.]+$/)
    .required(),
  email: Joi.string()
    .email()
    .required(),
  password: Joi.string()
    .min(6)
    .required(),
  confirmPassword: Joi.string().allow(null),
  isProducer: Joi.boolean().default(false),
});

module.exports = userSchema;
