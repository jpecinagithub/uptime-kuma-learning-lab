'use strict';

/** Envuelve handlers async para que los errores lleguen al error handler de Express. */
module.exports = function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
