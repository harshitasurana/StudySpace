export const createEducationError = (message, statusCode = 500, code = null, extra = {}) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  if (code) {
    error.code = code;
  }
  Object.assign(error, extra);
  return error;
};
