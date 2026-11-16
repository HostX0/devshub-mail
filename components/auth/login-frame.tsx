import type { ReactNode } from "react";
import { withBasePath } from "@/lib/browser-navigation";
import { cn } from "@/lib/cn";

export interface LoginFrameProps {
  /** The card's contents. */
  children: ReactNode;
  /** Above the card: the theme menu in the corner, dialogs. */
  before?: ReactNode;
  /** Under the card: company name, links, version. */
  footer?: ReactNode;
  /** The demo card is a little wider. */
  size?: "default" | "wide";
  className?: string;
  cardClassName?: string;
}

/**
 * The login page's frame: the backdrop, the card and the footer under it.
 * Layout and background follow the admin's settings through app/login.css,
 * so the page and its loading skeleton (components/boot-skeleton/
 * login-skeleton.tsx) share this and come out the same on the first paint.
 */
export function LoginFrame({ children, before, footer, size = "default", className, cardClassName }: LoginFrameProps) {
  return (
    <div className={cn("login-frame", className)}>
      <div aria-hidden="true" className="login-backdrop" />
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-[30rem] bg-cover bg-center opacity-25 dark:opacity-10" style={{ backgroundImage: `url('${withBasePath('/assets/devshub-mail/editorial-banner.jpg')}')`, maskImage: 'linear-gradient(to bottom, black, transparent)' }} />
      {before}
      <div className="login-stage">
        <div className="login-panel" data-size={size === "wide" ? "wide" : undefined}>
          <div className={cn("login-card", cardClassName)}>{children}</div>
          {footer ? <div className="login-footer">{footer}</div> : null}
        </div>
      </div>
    </div>
  );
}
