export default class HttpError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.status = statusCode;
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}
