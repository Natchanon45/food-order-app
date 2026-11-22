import "@/ui/dynamic-field.css";
import React from "react";

// Shared controlled-field presentation for input, select and textarea.
// Native controls remain children, preserving existing validation, onChange,
// accessibility, browser autocomplete and application-specific behaviour.
export function DynamicField({
  id,
  label,
  icon,
  value,
  kind = "input",
  className = "",
  trailing = null,
  description = null,
  inlineHint = null,
  children,
}) {
  const filled = Array.isArray(value)
    ? value.length > 0
    : String(value ?? "").length > 0;
  const classes = [
    "lk-dynamic-field",
    `lk-dynamic-field--${kind}`,
    inlineHint ? "lk-dynamic-field--inline-hint" : "",
    className,
  ].filter(Boolean).join(" ");

  const infoId = description ? `${id}-info` : undefined;
  const control = description && React.isValidElement(children)
    ? React.cloneElement(children, {
        "aria-describedby": [children.props["aria-describedby"], infoId].filter(Boolean).join(" "),
      })
    : children;

  return (
    <div className={classes}>
      <div
        className={`lk-dynamic-control login-input-wrap${filled ? " is-filled" : ""}`}
        data-validation-feedback-host
      >
        {control}
        <label className="lk-dynamic-caption login-field-title" htmlFor={id}>
          {icon && <i className={`lk-dynamic-icon app-icon login-field-icon ${icon}`} aria-hidden="true" />}
          <span className="lk-dynamic-caption-text">{label}</span>
          {inlineHint && <span className="lk-dynamic-caption-inline-hint" title={typeof inlineHint === "string" ? inlineHint : undefined}>{inlineHint}</span>}
        </label>
        {trailing}
      </div>
      {description && (
        <p className="lk-dynamic-help" id={infoId}>
          <i className="bi bi-info-circle" aria-hidden="true" />
          <span>{description}</span>
        </p>
      )}
    </div>
  );
}

// The reference form groups controls under semantic fieldset + legend.
export function DynamicFieldGroup({ legend, icon, children, className = "" }) {
  return (
    <fieldset className={`lk-dynamic-fieldset ${className}`.trim()}>
      <legend className="lk-dynamic-legend">
        {icon && <i className={icon} aria-hidden="true" />}
        <span>{legend}</span>
      </legend>
      {children}
    </fieldset>
  );
}
