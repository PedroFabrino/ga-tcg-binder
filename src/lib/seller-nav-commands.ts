export interface SellerNavCommand {
  label: string;
  path: string;
  keywords: string;
}

const SELLER_NAV_COMMANDS: SellerNavCommand[] = [
  {
    label: "MyP Store (Personal)",
    path: "/collection?view=MYP_STORE",
    keywords: "myp store sales selling binder sync",
  },
];

export function getSellerNavCommands(hasVendorCapability: boolean): SellerNavCommand[] {
  return hasVendorCapability ? SELLER_NAV_COMMANDS : [];
}
