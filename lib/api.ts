import axios from "axios";

const API_URL =
  process.env.NEXT_PUBLIC_GRAPHQL_URL || "http://localhost:4002/graphql";

const TOKEN_KEY = "hotcol_waiter_token";
const WAITER_KEY = "hotcol_waiter_session";

const SESSION_FIELDS = `id name HotelName tin displayName logoUrl phoneNumber waiterPaymentApprovalEnabled recipeStockEnforced`;

export type WaiterSession = {
  id: number;
  name: string;
  HotelName: string;
  tin: string;
  displayName: string;
  logoUrl?: string | null;
  phoneNumber: string;
  waiterPaymentApprovalEnabled: boolean;
  recipeStockEnforced: boolean;
};

export function getWaiterToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function getWaiterSession(): WaiterSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(WAITER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as WaiterSession;
    return {
      ...parsed,
      tin: parsed.tin || parsed.HotelName,
      displayName: parsed.displayName || parsed.tin || parsed.HotelName,
      recipeStockEnforced: Boolean(parsed.recipeStockEnforced),
    };
  } catch {
    return null;
  }
}

export function persistWaiterAuth(token: string, waiter: WaiterSession) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(
    WAITER_KEY,
    JSON.stringify({
      ...waiter,
      tin: waiter.tin || waiter.HotelName,
      displayName: waiter.displayName || waiter.tin || waiter.HotelName,
    }),
  );
}

export function clearWaiterAuth() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(WAITER_KEY);
}

async function gql<T>(
  query: string,
  variables?: Record<string, unknown>,
  auth = true,
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (auth) {
    const token = getWaiterToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  const { data } = await axios.post(
    API_URL,
    { query, variables },
    { headers },
  );
  if (data.errors?.length) {
    throw new Error(data.errors[0]?.message || "Request failed");
  }
  return data.data as T;
}

export async function waiterLogin(passkey: string) {
  const data = await gql<{
    WaiterLogin: { token: string; waiter: WaiterSession };
  }>(
    `mutation($passkey: String!) {
      WaiterLogin(passkey: $passkey) {
        token
        waiter { ${SESSION_FIELDS} }
      }
    }`,
    { passkey },
    false,
  );
  persistWaiterAuth(data.WaiterLogin.token, data.WaiterLogin.waiter);
  return data.WaiterLogin;
}

/** Refresh session (TIN + logo) for an existing token. */
export async function fetchMe() {
  const data = await gql<{ me: WaiterSession | null }>(
    `query { me { ${SESSION_FIELDS} } }`,
  );
  if (!data.me) throw new Error("Not authenticated");
  const token = getWaiterToken();
  if (token) persistWaiterAuth(token, data.me);
  return data.me;
}

export async function fetchMenuItems() {
  const data = await gql<{
    menuItems: {
      id: number;
      name: string;
      price: number;
      category: string;
      type: string;
      imageUrl: string;
      isSuspended?: boolean | null;
      recipeJson?: unknown;
    }[];
  }>(
    `query { menuItems { id name price category type imageUrl isSuspended recipeJson } }`,
  );
  return data.menuItems;
}

export type StationIngredientStock = {
  id: number;
  station: string;
  itemName: string;
  amount: number;
  measuredBy?: string | null;
};

export async function fetchStationIngredientStocks() {
  const data = await gql<{
    stationIngredientStocks: StationIngredientStock[];
  }>(
    `query {
      stationIngredientStocks { id station itemName amount measuredBy }
    }`,
  );
  return data.stationIngredientStocks || [];
}

export async function fetchTables() {
  const data = await gql<{
    tables: {
      id: number;
      tableNo: number;
      capacity: number;
      orderCaption?: string | null;
      inUse: boolean;
      ownedByMe: boolean;
    }[];
  }>(
    `query { tables { id tableNo capacity orderCaption inUse ownedByMe } }`,
  );
  return data.tables;
}

export async function fetchMyOrders() {
  const data = await gql<{
    myOrders: {
      id: number;
      title: string;
      imageUrl: string;
      tableNo: number;
      orderAmount: number;
      category: string;
      type: string;
      price: number;
      status?: string | null;
      payment?: string | null;
      paymentApprovalRequestId?: number | null;
      createdAt: string;
    }[];
  }>(`query {
    myOrders {
      id title imageUrl tableNo orderAmount category type price
      status payment paymentApprovalRequestId createdAt
    }
  }`);
  return data.myOrders;
}

export async function createWaiterOrders(
  orders: {
    title: string;
    imageUrl: string;
    tableNo: number;
    orderAmount: number;
    category: string;
    type: string;
    price: number;
  }[],
  opts?: { addingToExistingTable?: boolean },
) {
  const data = await gql<{ WaiterBatchOrderCreation: unknown[] }>(
    `mutation($orders: [WaiterOrderInput!]!, $addingToExistingTable: Boolean) {
      WaiterBatchOrderCreation(
        orders: $orders
        addingToExistingTable: $addingToExistingTable
      ) { id }
    }`,
    {
      orders: orders.map((o) => ({
        ...o,
        status: "Pending",
        payment: "Unpaid",
      })),
      addingToExistingTable: Boolean(opts?.addingToExistingTable),
    },
  );
  return data.WaiterBatchOrderCreation;
}

export async function updateMyLiveOrder(input: {
  id: number;
  orderAmount?: number;
  tableNo?: number;
}) {
  const data = await gql<{ WaiterUpdateLiveOrder: { id: number } }>(
    `mutation($id: Int!, $orderAmount: Int, $tableNo: Int) {
      WaiterUpdateLiveOrder(id: $id, orderAmount: $orderAmount, tableNo: $tableNo) { id }
    }`,
    input,
  );
  return data.WaiterUpdateLiveOrder;
}

export async function requestPaymentApproval(input: {
  orderIds: number[];
  amountPaid: number;
  paymentMethod: string;
  withBank?: boolean;
  tableNo?: number;
  requestNote?: string;
}) {
  const data = await gql<{ RequestWaiterPaymentApproval: { id: number } }>(
    `mutation(
      $orderIds: [Int!]!
      $amountPaid: Float!
      $paymentMethod: String!
      $withBank: Boolean
      $tableNo: Int
      $requestNote: String
    ) {
      RequestWaiterPaymentApproval(
        orderIds: $orderIds
        amountPaid: $amountPaid
        paymentMethod: $paymentMethod
        withBank: $withBank
        tableNo: $tableNo
        requestNote: $requestNote
      ) { id status }
    }`,
    input,
  );
  return data.RequestWaiterPaymentApproval;
}

export async function changePasskey(currentPasskey: string, newPasskey: string) {
  const data = await gql<{ ChangeWaiterPasskey: WaiterSession }>(
    `mutation($currentPasskey: String!, $newPasskey: String!) {
      ChangeWaiterPasskey(currentPasskey: $currentPasskey, newPasskey: $newPasskey) {
        ${SESSION_FIELDS}
      }
    }`,
    { currentPasskey, newPasskey },
  );
  const token = getWaiterToken();
  if (token) persistWaiterAuth(token, data.ChangeWaiterPasskey);
  return data.ChangeWaiterPasskey;
}
