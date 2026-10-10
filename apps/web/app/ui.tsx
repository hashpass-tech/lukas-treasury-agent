import {
  Children,
  cloneElement,
  isValidElement,
  useId,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactElement,
  type ReactNode,
} from "react";

type IconName =
  | "arrow-up-right"
  | "check"
  | "chevron"
  | "clock"
  | "globe"
  | "lock"
  | "pulse"
  | "receipt"
  | "shield"
  | "sliders"
  | "wallet";

export function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  const paths = {
    "arrow-up-right": (
      <>
        <path d="M7 17 17 7" />
        <path d="M8 7h9v9" />
      </>
    ),
    check: <path d="m5 12 4.5 4.5L19 7" />,
    chevron: <path d="m6 9 6 6 6-6" />,
    clock: (
      <>
        <circle cx="12" cy="12" r="8.5" />
        <path d="M12 7v5l3 2" />
      </>
    ),
    globe: (
      <>
        <circle cx="12" cy="12" r="8.5" />
        <path d="M3.8 12h16.4M12 3.5c2.2 2.3 3.2 5.1 3.2 8.5s-1 6.2-3.2 8.5c-2.2-2.3-3.2-5.1-3.2-8.5S9.8 5.8 12 3.5Z" />
      </>
    ),
    lock: (
      <>
        <rect x="5" y="10" width="14" height="10" rx="2" />
        <path d="M8 10V7.7a4 4 0 0 1 8 0V10M12 14v2" />
      </>
    ),
    pulse: (
      <>
        <path d="M3 12h4l2-6 4 12 2-6h6" />
      </>
    ),
    receipt: (
      <>
        <path d="M6 3.5h12v17l-3-1.8-3 1.8-3-1.8-3 1.8v-17Z" />
        <path d="M9 8h6M9 12h6M9 16h3" />
      </>
    ),
    shield: (
      <>
        <path d="M12 3.5 19 6v5.3c0 4.2-2.5 7.5-7 9.2-4.5-1.7-7-5-7-9.2V6l7-2.5Z" />
        <path d="m9 12 2 2 4-4" />
      </>
    ),
    sliders: (
      <>
        <path d="M4 7h16M4 12h16M4 17h16" />
        <circle cx="9" cy="7" r="1.7" />
        <circle cx="15" cy="12" r="1.7" />
        <circle cx="11" cy="17" r="1.7" />
      </>
    ),
    wallet: (
      <>
        <path d="M4.5 7.5V6.2A2.2 2.2 0 0 1 6.7 4h10.6a2.2 2.2 0 0 1 2.2 2.2v11.6a2.2 2.2 0 0 1-2.2 2.2H6.7a2.2 2.2 0 0 1-2.2-2.2V7.5Z" />
        <path d="M4.5 8h15v4.2h-4.2a2.1 2.1 0 0 1 0-4.2h4.2" />
        <circle cx="15.2" cy="10.1" r=".5" fill="currentColor" stroke="none" />
      </>
    ),
  } satisfies Record<IconName, ReactNode>;

  return <svg {...common}>{paths[name]}</svg>;
}

export function BrandMark({
  homeLabel = "LUKAS Treasury home",
}: {
  homeLabel?: string;
}) {
  return (
    <a className="brand-mark" href="./" aria-label={homeLabel}>
      <span className="brand-mark__glyph">L</span>
      <span className="brand-mark__word">LUKAS</span>
      <span className="brand-mark__suffix">TREASURY</span>
    </a>
  );
}

export function StatusPill({
  children,
  tone = "neutral",
  icon,
}: {
  children: ReactNode;
  tone?: "neutral" | "success" | "warning" | "danger" | "info";
  icon?: IconName;
}) {
  return (
    <span className={`status-pill status-pill--${tone}`}>
      <span className="status-pill__dot" />
      {icon && <Icon name={icon} size={14} />}
      <span>{children}</span>
    </span>
  );
}

export function Button({
  children,
  variant = "primary",
  icon,
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "quiet" | "danger";
  icon?: IconName;
}) {
  return (
    <button className={`button button--${variant} ${className}`} {...props}>
      <span>{children}</span>
      {icon && <Icon name={icon} size={16} />}
    </button>
  );
}

export function SectionHeading({
  title,
  description,
  icon,
  action,
}: {
  title: string;
  description?: string;
  icon?: IconName;
  action?: ReactNode;
}) {
  return (
    <div className="section-heading">
      <div className="section-heading__title-row">
        {icon && (
          <span className="section-heading__icon">
            <Icon name={icon} size={17} />
          </span>
        )}
        <h2>{title}</h2>
        {action}
      </div>
      {description && <p>{description}</p>}
    </div>
  );
}

export function MetricCard({
  label,
  value,
  note,
  tone = "neutral",
  icon,
}: {
  label: string;
  value: ReactNode;
  note: string;
  tone?: "neutral" | "success" | "warning";
  icon: IconName;
}) {
  return (
    <article className={`metric-card metric-card--${tone}`}>
      <div className="metric-card__topline">
        <span className="metric-card__label">{label}</span>
        <Icon name={icon} size={17} />
      </div>
      <p className="metric-card__value">{value}</p>
      <p className="metric-card__note">{note}</p>
    </article>
  );
}

export function Field({
  label,
  hint,
  children,
  className = "",
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  const id = useId();
  const child = Children.only(children);
  const control = isValidElement(child)
    ? cloneElement(child as ReactElement<{ id?: string }>, { id })
    : child;

  return (
    <div className={`field ${className}`}>
      <div className="field__label-row">
        <label htmlFor={id}>{label}</label>
        {hint && <span>{hint}</span>}
      </div>
      {control}
    </div>
  );
}

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input className="control" {...props} />;
}

export function DataList({ children }: { children: ReactNode }) {
  return <dl className="data-list">{children}</dl>;
}

export function DataItem({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="data-item">
      <dt>{label}</dt>
      <dd className={mono ? "mono" : undefined}>{value}</dd>
    </div>
  );
}

export function Panel({
  children,
  className = "",
  tone = "default",
}: {
  children: ReactNode;
  className?: string;
  tone?: "default" | "quiet" | "highlight";
}) {
  return (
    <section className={`panel panel--${tone} ${className}`}>
      {children}
    </section>
  );
}
