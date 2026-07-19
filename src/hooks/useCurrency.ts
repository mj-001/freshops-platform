import { useState, useEffect } from 'react';

interface CurrencyHook {
  currencyCode: string;
  format: (amountCents: number) => string;
}

export function useCurrency(): CurrencyHook {
  const [currencyCode, setCurrencyCode] = useState<string>('KES');

  useEffect(() => {
    fetch('/api/v1/settings')
      .then(r => r.json())
      .then(d => {
        const code = d?.data?.setup_config?.currency;
        if (code) setCurrencyCode(code);
      })
      .catch(() => {});
  }, []);

  const format = (amountCents: number): string =>
    `${currencyCode} ${(amountCents / 100).toFixed(2)}`;

  return { currencyCode, format };
}
