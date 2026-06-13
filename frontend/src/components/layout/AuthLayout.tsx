import { ReactNode } from 'react';

type AuthLayoutProps = {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
};

export function AuthLayout({ eyebrow, title, description, children }: AuthLayoutProps) {
  return (
    <section className="auth-layout">
      <div className="auth-panel" aria-labelledby="auth-title">
        <div className="auth-copy">
          <p className="eyebrow">{eyebrow}</p>
          <h1 id="auth-title">{title}</h1>
          <p>{description}</p>
        </div>
        {children}
      </div>
    </section>
  );
}
