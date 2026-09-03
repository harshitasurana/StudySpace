export const validateBody = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: error.details.map(detail => detail.message)
      });
    }

    // Replace req.body with stripped/coerced value so controllers only see valid fields
    req.body = value;
    next();
  };
};

export const validateQuery = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.query, { abortEarly: false });

    if (error) {
      return res.status(400).json({
        success: false,
        error: 'Query validation failed',
        details: error.details.map(detail => detail.message)
      });
    }

    // req.query is a GETTER on Express 5's request prototype (see
    // node_modules/express/lib/request.js) that RE-PARSES req.url from
    // scratch on every single access — there's no setter, and mutating
    // the object a read returns (Object.assign(req.query, value)) does
    // nothing, since the next access just re-parses and returns a brand
    // new object, discarding that mutation. redefineProperty replaces
    // the getter itself with a static value, so every later access
    // (including the controller's) returns this exact validated/
    // defaulted object instead of re-parsing. Without this, Joi's
    // `.default(...)` values (e.g. pagination's page/limit) never
    // actually reach the controller — req.query keeps re-parsing to
    // whatever the client literally sent (often nothing), which is what
    // caused page/limit to arrive as undefined and produce a NaN offset
    // in site_feedback_service.js's listSiteFeedbackService.
    Object.defineProperty(req, 'query', { value, writable: true, enumerable: true, configurable: true });
    next();
  };
};

export const validateParams = (schema) => {
  return (req, res, next) => {
    const { error } = schema.validate(req.params, { abortEarly: false });

    if (error) {
      return res.status(400).json({
        success: false,
        error: 'Parameter validation failed',
        details: error.details.map(detail => detail.message)
      });
    }

    next();
  };
};
