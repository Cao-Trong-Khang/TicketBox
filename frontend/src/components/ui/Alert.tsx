type AlertProps = {
  children: string;
  tone: 'error' | 'success';
};

export function Alert({ children, tone }: AlertProps) {
  return (
    <p className={`alert alert-${tone}`} role={tone === 'error' ? 'alert' : 'status'}>
      {children}
    </p>
  );
}
