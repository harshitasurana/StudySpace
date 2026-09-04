export const errorHandler = (err, req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }

  if (process.env.NODE_ENV !== 'test') {
    console.error('[Error]', err.message);
    console.error(err.stack);
  }
  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      error: 'Invalid token'
    });
  }

  // Validation errors (e.g., Joi)
  if (err.name === 'ValidationError') {
    return res.status(422).json({
      success: false,
      error: err.message
    });
  }

  // Default: use custom status (from HttpError) or fallback to 500
  const status = err.status || 500;
  res.status(status).json({
    success: false,
    error: (process.env.NODE_ENV === 'development' || status < 500)
      ? err.message
      : 'Internal server error'
  });
};
