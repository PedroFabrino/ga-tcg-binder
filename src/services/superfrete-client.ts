export const A4_ENVELOPE_PACKAGE = {
  height: 2,
  width: 21,
  length: 30,
  weight: 0.208,
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

export interface SuperfretePackageDimensions {
  height: number;
  width: number;
  length: number;
  weight: number;
}

export async function fetchSuperfreteQuotes(
  apiToken: string,
  fromCep: string,
  toCep: string,
  insuranceBrl: number,
  customFetch: typeof fetch = fetch,
  packageVolume: SuperfretePackageDimensions = A4_ENVELOPE_PACKAGE
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
    package: packageVolume,
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

export async function cancelSuperfreteOrder(
  apiToken: string,
  orderId: string | number,
  description: string = "Cancelado pelo usuário",
  customFetch: typeof fetch = fetch
): Promise<{ success: boolean; data?: unknown }> {
  const response = await customFetch(`${SUPERFRETE_API_BASE}/api/v0/order/cancel`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiToken}`,
      "User-Agent": SUPERFRETE_USER_AGENT,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      order: {
        id: String(orderId),
        description,
      },
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Superfrete Cancel Order error (${response.status}): ${errText}`);
  }

  const data = await response.json();
  return { success: true, data };
}

export interface SuperfretePrintResponse {
  url: string;
  [key: string]: unknown;
}

export async function fetchSuperfretePrintUrl(
  apiToken: string,
  orderIds: string[],
  customFetch: typeof fetch = fetch,
  layout: "A4" | "A5" | "A6" = "A5"
): Promise<string> {
  const response = await customFetch(`${SUPERFRETE_API_BASE}/api/v0/tag/print`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiToken}`,
      "User-Agent": SUPERFRETE_USER_AGENT,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      orders: orderIds,
      mode: "PDF",
      layout,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Superfrete Tag Print error (${response.status}): ${errText}`);
  }

  const data = (await response.json()) as SuperfretePrintResponse;
  if (!data?.url) {
    throw new Error("Superfrete did not return a printable PDF URL");
  }

  return data.url;
}


