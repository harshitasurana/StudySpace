export const getApiErrorMessage = (error, fallback = "Something went wrong.") => {
  if (!error) return fallback;

  const data = error?.response?.data;

  const isText = (value) => typeof value === "string" && value.trim();

  const prettify = (message) => {
    if (!isText(message)) return "";
    const normalized = String(message)
      .replace(/"([a-zA-Z0-9_]+)"/g, "$1")
      .replace(/\b([a-zA-Z0-9]+)_([a-zA-Z0-9_]+)\b/g, (_, a, b) => `${a} ${b}`)
      .replace(/\s+/g, " ")
      .trim();

    if (!normalized) return "";

    return normalized.charAt(0).toUpperCase() + normalized.slice(1);
  };

  const fromValidationErrors = (errors) => {
    if (!Array.isArray(errors) || errors.length === 0) return "";
    const collected = errors
      .map((item) => {
        if (typeof item === "string") return item;
        if (isText(item?.message)) return item.message;
        if (isText(item?.msg)) return item.msg;
        if (isText(item?.error)) return item.error;
        return "";
      })
      .filter(Boolean);
    return prettify(collected.join(", "));
  };

  const fromObject = (obj) => {
    if (!obj || typeof obj !== "object") return "";

    if (isText(obj.message)) return prettify(obj.message);
    if (isText(obj.error)) return prettify(obj.error);
    if (isText(obj.title)) return prettify(obj.title);
    if (isText(obj.detail)) return prettify(obj.detail);

    if (Array.isArray(obj.message)) {
      const msg = prettify(obj.message.filter(Boolean).join(", "));
      if (msg) return msg;
    }

    const errs = fromValidationErrors(obj.errors);
    if (errs) return errs;

    if (obj.data && typeof obj.data === "object") {
      const nested = fromObject(obj.data);
      if (nested) return nested;
    }

    return "";
  };

  if (isText(data)) {
    return prettify(data);
  }

  const responseMessage = fromObject(data);
  if (responseMessage) {
    return responseMessage;
  }

  if (!error?.response && error?.message) {
    const lower = String(error.message).toLowerCase();
    if (lower.includes("network") || lower.includes("failed to fetch")) {
      return "Network error. Please check your connection and try again.";
    }
  }

  if (isText(error?.message)) {
    return prettify(error.message);
  }

  return fallback;
};