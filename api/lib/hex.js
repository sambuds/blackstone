const trimBufferPadding = (buf) => {
  let lo = 0;
  let hi = buf.length;
  for (let i = 0; i < buf.length && buf[i] === 0; i += 1) {
    lo = i + 1;
  }
  for (let i = buf.length - 1; i > 0 && buf[i] === 0; i -= 1) {
    hi = i;
  }
  return buf.slice(lo, hi);
};

module.exports = {
  hexToString: (hex = '') => trimBufferPadding(Buffer.from(hex, 'hex')).toString('utf8'),
  hexFromString: (str = '') => Buffer.from(str, 'utf8').toString('hex'),
};
