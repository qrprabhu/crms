import CRMSectionCard from "../../components/crm/CRMSectionCard";
import type { SocialAccount, SocialPlatform } from "../types";
import { getPlatformLabel } from "../utils";
import IntegrationStatusBadge from "./IntegrationStatusBadge";

type Props = {
  accounts: SocialAccount[];
  onConnect: (platform: SocialPlatform, account?: SocialAccount) => void;
  onDisconnect: (account: SocialAccount) => void;
  onSync?: (account: SocialAccount) => void;
  onFacebookOAuthConnect?: (account: SocialAccount) => void;
};

export default function SocialAccountsConnectCard({ accounts, onConnect, onDisconnect, onSync, onFacebookOAuthConnect }: Props) {
  const platforms: SocialPlatform[] = ["x", "facebook"];

  return (
    <CRMSectionCard title="Connected Accounts">
      <div className="grid gap-4 md:grid-cols-2">
        {platforms.map((platform) => {
          const account = accounts.find((item) => item.platform === platform);
          return (
            <div key={platform} className="rounded-xl border border-slate-200 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="font-medium text-slate-900">{getPlatformLabel(platform)}</div>
                  <div className="mt-1 text-sm text-slate-500">{account?.handle || "No account connected"}</div>
                </div>
                {account?.is_connected ? <IntegrationStatusBadge label="Connected" value="active" /> : <IntegrationStatusBadge label="Disconnected" value="inactive" />}
              </div>
              <div className="mt-4 flex gap-2">
                <button type="button" onClick={() => onConnect(platform, account)} className="rounded-md border border-slate-200 px-3 py-2 text-xs text-slate-700">
                  {account ? "Edit Account" : `Connect ${getPlatformLabel(platform)}`}
                </button>
                {platform === "facebook" && account ? (
                  <button
                    type="button"
                    onClick={() => onFacebookOAuthConnect?.(account)}
                    className="rounded-md border border-blue-200 px-3 py-2 text-xs text-green-700"
                  >
                    Connect Facebook OAuth
                  </button>
                ) : null}
                {account?.is_connected ? (
                  <button
                    type="button"
                    onClick={() => onSync?.(account)}
                    className="rounded-md border border-emerald-200 px-3 py-2 text-xs text-emerald-700"
                  >
                    Sync Now
                  </button>
                ) : null}
                {account?.is_connected ? (
                  <button type="button" onClick={() => onDisconnect(account)} className="rounded-md border border-rose-200 px-3 py-2 text-xs text-rose-700">Disconnect</button>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </CRMSectionCard>
  );
}
