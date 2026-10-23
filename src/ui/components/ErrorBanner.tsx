export interface AppError {
  id: number;
  message: string;
}

/** Hata durumu arayüzde her zaman görünür olmalı; hatalar asla yutulmaz. */
export function ErrorBanner({
  errors,
  onDismiss,
}: {
  errors: AppError[];
  onDismiss: (id: number) => void;
}) {
  if (errors.length === 0) return null;
  return (
    <div role="alert" data-testid="error-banner">
      {errors.map((error) => (
        <div key={error.id} className="error-banner">
          <span>{error.message}</span>
          <button
            type="button"
            aria-label={`Hatayı kapat: ${error.message}`}
            onClick={() => onDismiss(error.id)}
          >
            Kapat
          </button>
        </div>
      ))}
    </div>
  );
}
