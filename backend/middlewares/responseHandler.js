
logger.info(`Registering generic response handler to response object`);

// Generic response handler
module.exports = (req, res, next) => {
  res.publish = (success = false, message = '', data = {}, statusCode = 200, cookie = {}) => {
      /*
       * Adding token as a cookie
       */
      if(cookie.name && cookie.value){
          res.cookie(cookie.name, cookie.value);
      }
      return res.status(statusCode).json({
          success,
          message,
          data
      });
  };
  next();
};
