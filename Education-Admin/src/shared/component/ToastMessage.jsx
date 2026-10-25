import "./ToastMessage.css";

const TYPE_ICON_MAP = {
  success: "bi-check-circle-fill",
  error: "bi-exclamation-triangle-fill",
  danger: "bi-x-circle-fill",
  warning: "bi-exclamation-triangle-fill",
  info: "bi-info-circle-fill",
};

const normalizeType = (type) => {
  if (!type) return "info";
  const key = String(type).toLowerCase();
  if (key === "danger") return "danger";
  if (key === "error") return "error";
  if (key === "warning") return "warning";
  if (key === "success") return "success";
  return "info";
};

const ToastMessage = ({ toast = null, position = { top: 80, right: 24 }, inline }) => {
  if (!toast || !toast.message) return null;

  const type = normalizeType(toast.type);
  const icon = TYPE_ICON_MAP[type] || TYPE_ICON_MAP.info;

  const className = [
    "hc-toast-message",
    `hc-toast-message--${type}`,
    inline ? "hc-toast-message--inline" : "hc-toast-message--fixed",
  ].join(" ");

  const style = inline ? undefined : position;

  return (
    <div className={className} style={style} role="status" aria-live="polite">
      <i className={`bi ${icon} hc-toast-message__icon`} aria-hidden="true"></i>
      <span className="hc-toast-message__message">{toast.message}</span>
    </div>
  );
};

export default ToastMessage;
