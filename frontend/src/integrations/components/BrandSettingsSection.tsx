import CRMSectionCard from "../../components/crm/CRMSectionCard";
import type { SocialBrand } from "../types";
import SocialAccountsConnectCard from "./SocialAccountsConnectCard";

type Props = {
  brands: SocialBrand[];
  onCreateBrand: () => void;
  onEditBrand: (brand: SocialBrand) => void;
  onConnectAccount: (brand: SocialBrand, platform: "facebook" | "x") => void;
  onDisconnectAccount: (accountId: number) => void;
  onSyncAccount?: (accountId: number) => void;
  onFacebookOAuthConnect?: (accountId: number) => void;
};

export default function BrandSettingsSection({ brands, onCreateBrand, onEditBrand, onConnectAccount, onDisconnectAccount, onSyncAccount, onFacebookOAuthConnect }: Props) {
  return (
    <div className="space-y-4">
      <CRMSectionCard title="Brand Settings" action={<button type="button" onClick={onCreateBrand} className="rounded-md bg-green-600 px-3 py-2 text-xs font-medium text-white">Create Brand</button>}>
        {!brands.length ? (
          <p className="text-sm text-slate-500">Create a social brand to start connecting X and Facebook accounts.</p>
        ) : (
          <div className="space-y-4">
            {brands.map((brand) => (
              <div key={brand.id} className="space-y-3 rounded-xl border border-slate-200 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-base font-semibold text-slate-900">{brand.brand_name}</div>
                    <p className="mt-1 text-sm text-slate-500">{brand.brand_description || "No brand description provided."}</p>
                  </div>
                  <button type="button" onClick={() => onEditBrand(brand)} className="rounded-md border border-slate-200 px-3 py-2 text-xs text-slate-700">Edit Brand</button>
                </div>
                <SocialAccountsConnectCard
                  accounts={brand.accounts || []}
                  onConnect={(platform) => onConnectAccount(brand, platform)}
                  onDisconnect={(account) => onDisconnectAccount(account.id)}
                  onSync={(account) => onSyncAccount?.(account.id)}
                  onFacebookOAuthConnect={(account) => onFacebookOAuthConnect?.(account.id)}
                />
              </div>
            ))}
          </div>
        )}
      </CRMSectionCard>
    </div>
  );
}
