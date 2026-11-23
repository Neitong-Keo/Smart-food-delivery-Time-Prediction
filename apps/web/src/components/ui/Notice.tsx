import { AlertCircle, FlaskConical, Info, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";

type NoticeTone = "info" | "warning" | "error" | "demo";

const ICONS = { info: Info, warning: TriangleAlert, error: AlertCircle, demo: FlaskConical };

interface NoticeProps {
  tone?: NoticeTone;
  title?: string;
  children?: ReactNode;
  action?: ReactNode;
}

export function Notice({ tone = "info", title, children, action }: NoticeProps) {
  const Icon = ICONS[tone];
  return (
    <div className={`notice notice-${tone}`} role={tone === "error" ? "alert" : "status"}>
      <Icon size={17} aria-hidden />
      <div className="notice-body">
        {title && <p className="notice-title">{title}</p>}
        {children && <div>{children}</div>}
        {action && <div className="notice-action">{action}</div>}
      </div>
    </div>
  );
}
