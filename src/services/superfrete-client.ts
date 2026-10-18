export const A4_ENVELOPE_PACKAGE = {
  height: 2,
  width: 21,
  length: 30,
  weight: 1,
} as const;

export const SUPERFRETE_API_BASE = "https://api.superfrete.com";
export const SUPERFRETE_USER_AGENT = "GA TCG Binder v1.0 (pfabrino@gmail.com)";

export interface SuperfreteCalculatorQuote {
  id: number;
  name: string;
  price: string | number;
  discount?: string | number;
  currency?: string;
  delivery_time?: number;
  delivery_range?: { min: number; max: number };
  company?: {
    id?: number;
    name?: string;
    picture?: string;
  };
  has_error: boolean;
  error?: string | null;
}

export interface SuperfreteCartResponse {
  id: string | number;
  price?: number | string;
  [key: string]: unknown;
}

export interface SuperfreteOrderInfoResponse {
  id: string | number;
  status: string; // 'pending' | 'released' | 'posted'
  tracking?: string | null;
  print?: {
    url?: string | null;
  };
  [key: string]: unknown;
}

export async function fetchSuperfreteQuotes(
  apiToken: string,
  fromCep: string,
  toCep: string,
  insuranceBrl: number,
  customFetch: typeof fetch = fetch
): Promise<SuperfreteCalculatorQuote[]> {
  const cleanedFrom = fromCep.replace(/\D/g, "");
  const cleanedTo = toCep.replace(/\D/g, "");

  const body = {
    from: { postal_code: cleanedFrom },
    to: { postal_code: cleanedTo },
    services: "1,2,17,3,31",
    options: {
      own_hand: false,
      receipt: false,
      use_insurance_value: true,
      insurance_value: insuranceBrl,
    },
    package: A4_ENVELOPE_PACKAGE,
  };

  const response = await customFetch(`${SUPERFRETE_API_BASE}/api/v0/calculator`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiToken}`,
      "User-Agent": SUPERFRETE_USER_AGENT,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Superfrete Calculator error (${response.status}): ${errText}`);
  }

  const data = await response.json();
  return Array.isArray(data) ? data : [];
}

export async function createSuperfreteCartOrder(
  apiToken: string,
  payload: Record<string, unknown>,
  customFetch: typeof fetch = fetch
): Promise<SuperfreteCartResponse> {
  const response = await customFetch(`${SUPERFRETE_API_BASE}/api/v0/cart`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiToken}`,
      "User-Agent": SUPERFRETE_USER_AGENT,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Superfrete Cart creation error (${response.status}): ${errText}`);
  }

  return response.json();
}

export async function fetchSuperfreteOrderInfo(
  apiToken: string,
  orderId: string | number,
  customFetch: typeof fetch = fetch
): Promise<SuperfreteOrderInfoResponse> {
  const response = await customFetch(`${SUPERFRETE_API_BASE}/api/v0/order/info/${orderId}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${apiToken}`,
      "User-Agent": SUPERFRETE_USER_AGENT,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Superfrete Order Info error (${response.status}): ${errText}`);
  }

  return response.json();
}
