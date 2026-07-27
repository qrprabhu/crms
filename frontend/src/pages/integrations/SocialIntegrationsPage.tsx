import { useEffect, useMemo, useState } from "react";
import CRMModalBase from "../../components/crm/CRMModalBase";
import CRMSectionCard from "../../components/crm/CRMSectionCard";
import DashboardLayout from "../../components/layout/DashboardLayout";
import { integrationsApi } from "../../integrations/api";
import {
  automationTriggerOptions,
  integrationsNavTabs,
  socialPlatformOptions,
} from "../../integrations/config";
import BrandForm from "../../integrations/components/BrandForm";
import BrandSettingsSection from "../../integrations/components/BrandSettingsSection";
import IntegrationHeader from "../../integrations/components/IntegrationHeader";
import IntegrationSetupChecklist from "../../integrations/components/IntegrationSetupChecklist";
import SocialAdminSettingsPanel from "../../integrations/components/SocialAdminSettingsPanel";
import SocialAutomationRulesPanel from "../../integrations/components/SocialAutomationRulesPanel";
import SocialLanding from "../../integrations/components/SocialLanding";
import type {
  SocialAccount,
  SocialBrand,
  SocialConnectPayload,
  SocialLeadAutomationRule,
  SocialPermissionSetting,
  SocialPlatform,
  SocialTriggerType,
} from "../../integrations/types";

type Notice = { tone: "success" | "error"; message: string } | null;
type ModalError = string | null;

type AccountDraft = {
  brandId: number;
  platform: SocialPlatform;
  accountId?: number;
  account_name: string;
  handle: string;
  page_id: string;
};

type RuleDraft = {
  platform: SocialPlatform;
  trigger_type: SocialTriggerType;
  action_type: "create_lead" | "create_case";
  is_active: boolean;
  assign_to_user: string;
  assign_to_team: string;
  qualification_logic_text: string;
};

const defaultAccountDraft: AccountDraft = {
  brandId: 0,
  platform: "x",
  account_name: "",
  handle: "",
  page_id: "",
};

const defaultRuleDraft: RuleDraft = {
  platform: "x",
  trigger_type: "mention",
  action_type: "create_lead",
  is_active: true,
  assign_to_user: "",
  assign_to_team: "",
  qualification_logic_text: '{\n  "intent": "high"\n}',
};

function parseQualificationLogic(value: string) {
  try {
    return value.trim() ? JSON.parse(value) : {};
  } catch {
    return { raw: value };
  }
}

function stringifyQualificationLogic(value: Record<string, unknown> | null | undefined) {
  return JSON.stringify(value || {}, null, 2);
}

export default function SocialIntegrationsPage() {
  const [brands, setBrands] = useState<SocialBrand[]>([]);
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [adminSettings, setAdminSettings] = useState<SocialPermissionSetting[]>([]);
  const [rules, setRules] = useState<SocialLeadAutomationRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<Notice>(null);

  const [brandModalOpen, setBrandModalOpen] = useState(false);
  const [editingBrand, setEditingBrand] = useState<SocialBrand | null>(null);

  const [accountModalOpen, setAccountModalOpen] = useState(false);
  const [accountDraft, setAccountDraft] = useState<AccountDraft>(defaultAccountDraft);
  const [accountError, setAccountError] = useState<ModalError>(null);

  const [ruleModalOpen, setRuleModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<SocialLeadAutomationRule | null>(null);
  const [ruleDraft, setRuleDraft] = useState<RuleDraft>(defaultRuleDraft);
  const [ruleError, setRuleError] = useState<ModalError>(null);

  const load = async () => {
    try {
      setLoading(true);
      const [nextBrands, nextAccounts, nextAdminSettings, nextRules] = await Promise.all([
        integrationsApi.listSocialBrands().catch(() => []),
        integrationsApi.listSocialAccounts().catch(() => []),
        integrationsApi.listSocialAdminSettings().catch(() => []),
        integrationsApi.listSocialAutomationRules().catch(() => []),
      ]);
      setBrands(nextBrands);
      setAccounts(nextAccounts);
      setAdminSettings(nextAdminSettings);
      setRules(nextRules);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const params = new URLSearchParams(window.location.search);
    const oauthStatus = params.get("social_oauth");
    if (!oauthStatus) {
      return;
    }
    const oauthMessage = params.get("social_message");
    setNotice({
      tone: oauthStatus === "facebook_success" ? "success" : "error",
      message:
        oauthMessage ||
        (oauthStatus === "facebook_success"
          ? "Facebook connected successfully."
          : "Facebook connection failed."),
    });
    params.delete("social_oauth");
    params.delete("social_message");
    const nextQuery = params.toString();
    const nextUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ""}`;
    window.history.replaceState({}, "", nextUrl);
    void load();
  }, []);

  const adminSetting = adminSettings[0] || null;
  const connectedAccountsCount = accounts.filter((account) => account.is_connected).length;
  const setupItems = useMemo(
    () => [
      {
        label: "Create Brand",
        description: "Set up the brand or business identity that owns the social channels.",
        done: brands.length > 0,
      },
      {
        label: "Connect Accounts",
        description: "Connect at least one social account so the CRM can capture activity.",
        done: connectedAccountsCount > 0,
      },
      {
        label: "Enable Automation",
        description: "Add rules only after accounts are connected and ownership is clear.",
        done: rules.some((rule) => rule.is_active),
      },
    ],
    [brands.length, connectedAccountsCount, rules]
  );

  const brandsWithAccounts = useMemo(
    () =>
      brands.map((brand) => ({
        ...brand,
        accounts: accounts.filter((account) => account.brand === brand.id),
      })),
    [accounts, brands]
  );

  const setSuccess = (message: string) => setNotice({ tone: "success", message });
  const setError = (error: unknown) =>
    setNotice({
      tone: "error",
      message: error instanceof Error ? error.message : "Action failed.",
    });

  const runAction = async (
    action: () => Promise<unknown>,
    message: string,
    after?: () => void
  ) => {
    try {
      await action();
      setSuccess(message);
      after?.();
      await load();
    } catch (error) {
      setError(error);
    }
  };

  const openCreateBrand = () => {
    setEditingBrand(null);
    setBrandModalOpen(true);
  };

  const startFacebookOAuth = async (accountId: number) => {
    try {
      const response = await integrationsApi.startFacebookSocialOAuth(accountId);
      window.location.assign(response.auth_url);
    } catch (error) {
      setError(error);
    }
  };

  const openConnectModal = (
    brand: SocialBrand,
    platform: SocialPlatform,
    account?: SocialAccount
  ) => {
    setAccountError(null);
    setAccountDraft({
      brandId: brand.id,
      platform,
      accountId: account?.id,
      account_name: account?.account_name || "",
      handle: account?.handle || "",
      page_id: account?.page_id || "",
    });
    setAccountModalOpen(true);
  };

  const openRuleModal = (rule?: SocialLeadAutomationRule) => {
    setRuleError(null);
    setEditingRule(rule || null);
    setRuleDraft(
      rule
        ? {
            platform: rule.platform,
            trigger_type: rule.trigger_type,
            action_type: rule.action_type,
            is_active: rule.is_active,
            assign_to_user: rule.assign_to_user ? String(rule.assign_to_user) : "",
            assign_to_team: rule.assign_to_team || "",
            qualification_logic_text: stringifyQualificationLogic(
              rule.qualification_logic
            ),
          }
        : defaultRuleDraft
    );
    setRuleModalOpen(true);
  };

  const submitAccount = async () => {
    const accountName = accountDraft.account_name.trim();
    const handle = accountDraft.handle.trim();
    const pageId = accountDraft.page_id.trim();

    if (!accountName) {
      setAccountError("Account name is required.");
      return;
    }

    if (!handle && !pageId) {
      setAccountError("Enter either a handle or page ID to identify the social account.");
      return;
    }

    setAccountError(null);
    const payload: SocialConnectPayload = {
      account_name: accountName,
      handle,
      page_id: pageId,
    };

    if (accountDraft.accountId) {
      await runAction(
        () =>
          integrationsApi
            .updateSocialAccount(accountDraft.accountId!, {
              account_name: accountName,
              handle,
              page_id: pageId,
            })
            .then(() =>
              integrationsApi.connectSocialAccount(accountDraft.accountId!, payload)
            ),
        "Social account updated successfully.",
        () => setAccountModalOpen(false)
      );
      return;
    }

    await runAction(
      async () => {
        const account = await integrationsApi.createSocialAccount({
          brand: accountDraft.brandId,
          platform: accountDraft.platform,
          account_name: accountName,
          handle,
          page_id: pageId,
        });
        await integrationsApi.connectSocialAccount(account.id, payload);
      },
      "Social account connected successfully.",
      () => setAccountModalOpen(false)
    );
  };

  const submitRule = async () => {
    const assignToUser = ruleDraft.assign_to_user.trim();
    const assignToTeam = ruleDraft.assign_to_team.trim();
    const qualificationLogicText = ruleDraft.qualification_logic_text.trim();

    if (assignToUser && !/^\d+$/.test(assignToUser)) {
      setRuleError("Assign To User ID must be a number.");
      return;
    }

    if (qualificationLogicText) {
      try {
        JSON.parse(qualificationLogicText);
      } catch {
        setRuleError("Qualification logic must be valid JSON.");
        return;
      }
    }

    setRuleError(null);
    const payload = {
      platform: ruleDraft.platform,
      trigger_type: ruleDraft.trigger_type,
      action_type: ruleDraft.action_type,
      is_active: ruleDraft.is_active,
      assign_to_user: assignToUser ? Number(assignToUser) : null,
      assign_to_team: assignToTeam || null,
      qualification_logic: parseQualificationLogic(qualificationLogicText),
    };

    await runAction(
      () =>
        editingRule
          ? integrationsApi.updateSocialAutomationRule(editingRule.id, payload)
          : integrationsApi.createSocialAutomationRule(payload),
      editingRule
        ? "Automation rule updated successfully."
        : "Automation rule created successfully.",
      () => setRuleModalOpen(false)
    );
  };

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <IntegrationHeader
          title="Social Integrations"
          subtitle="Connect brand accounts, control social admins, and automate lead generation from social activity."
          tabs={integrationsNavTabs}
          activePath="/integrations/social"
          action={
            <button
              type="button"
              onClick={openCreateBrand}
              className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white"
            >
              Create Brand
            </button>
          }
        />

        {notice ? (
          <div
            className={`rounded-xl border px-4 py-3 text-sm ${
              notice.tone === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-rose-200 bg-rose-50 text-rose-700"
            }`}
          >
            {notice.message}
          </div>
        ) : null}

        {loading ? (
          <div className="text-sm text-slate-500">Loading social integrations...</div>
        ) : null}

        <IntegrationSetupChecklist
          title="Setup Progress"
          subtitle="Use this order for social integrations: create a brand, connect the channel, then add permissions and automation."
          items={setupItems}
        />

        <SocialLanding hasBrands={brands.length > 0} onGetStarted={openCreateBrand} />

        <CRMSectionCard title="Step 1: Brand And Accounts">
          <p className="mb-4 text-sm text-slate-600">
            Start by creating a brand, then connect the social accounts that belong to it. Add the public account details here, and keep private platform credentials inside your backend or OAuth flow.
          </p>
          <BrandSettingsSection
            brands={brandsWithAccounts}
            onCreateBrand={openCreateBrand}
            onEditBrand={(brand) => {
              setEditingBrand(brand);
              setBrandModalOpen(true);
            }}
            onConnectAccount={(brand, platform) =>
              openConnectModal(
                brand,
                platform,
                accounts.find(
                  (account) =>
                    account.brand === brand.id && account.platform === platform
                )
              )
            }
            onDisconnectAccount={(accountId) =>
              void runAction(
                () => integrationsApi.disconnectSocialAccount(accountId),
                "Social account disconnected successfully."
              )
            }
            onSyncAccount={(accountId) =>
              void runAction(
                () => integrationsApi.syncSocialAccount(accountId),
                "Social account synced successfully."
              )
            }
            onFacebookOAuthConnect={(accountId) => void startFacebookOAuth(accountId)}
          />
        </CRMSectionCard>

        <CRMSectionCard title="Step 2: Ownership And Visibility">
          <p className="mb-4 text-sm text-slate-600">
            Decide who can see the social area and which internal profiles should manage it.
          </p>
          <SocialAdminSettingsPanel
            setting={adminSetting}
            onSave={(payload) =>
              void runAction(
                () =>
                  adminSetting
                    ? integrationsApi.updateSocialAdminSetting(adminSetting.id, payload)
                    : integrationsApi.createSocialAdminSetting(payload),
                "Social admin settings saved successfully."
              )
            }
          />
        </CRMSectionCard>

        <CRMSectionCard title="Step 3: Lead Automation">
          <p className="mb-4 text-sm text-slate-600">
            After your accounts are connected, add rules to decide when messages or mentions should create leads or cases.
          </p>
          <SocialAutomationRulesPanel
            rules={rules}
            onCreate={() => openRuleModal()}
            onEdit={(rule) => openRuleModal(rule)}
            onDelete={(rule) => {
              if (
                !window.confirm(
                  `Delete ${rule.platform} ${rule.trigger_type} automation rule?`
                )
              ) {
                return;
              }
              void runAction(
                () => integrationsApi.deleteSocialAutomationRule(rule.id),
                "Automation rule deleted successfully."
              );
            }}
          />
        </CRMSectionCard>

        <CRMSectionCard title="Social Overview">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              <div className="font-medium text-slate-900">Brands</div>
              <div className="mt-2 text-2xl font-semibold">{brands.length}</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              <div className="font-medium text-slate-900">Connected Accounts</div>
              <div className="mt-2 text-2xl font-semibold">
                {connectedAccountsCount}
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              <div className="font-medium text-slate-900">Automation Rules</div>
              <div className="mt-2 text-2xl font-semibold">{rules.length}</div>
            </div>
          </div>
        </CRMSectionCard>

        <BrandForm
          open={brandModalOpen}
          initialValue={editingBrand}
          onClose={() => setBrandModalOpen(false)}
          onSubmit={(values) =>
            void runAction(
              () =>
                editingBrand
                  ? integrationsApi.updateSocialBrand(editingBrand.id, values)
                  : integrationsApi.createSocialBrand(values),
              editingBrand
                ? "Brand updated successfully."
                : "Brand created successfully.",
              () => setBrandModalOpen(false)
            )
          }
        />

        <CRMModalBase
          open={accountModalOpen}
          title={accountDraft.accountId ? "Edit Social Account" : "Connect Social Account"}
          footer={
            <>
              <button
                type="button"
                onClick={() => setAccountModalOpen(false)}
                className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void submitAccount()}
                className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white"
              >
                Save
              </button>
            </>
          }
        >
          {accountError ? (
            <div className="mb-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {accountError}
            </div>
          ) : null}
          <div className="mb-4 rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-700">
            Connect the channel using the public account details. Private access tokens stay in the backend integration setup and are not entered here.
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-1 text-sm">
              <span className="text-slate-600">Platform</span>
              <select
                value={accountDraft.platform}
                onChange={(event) =>
                  setAccountDraft((previous) => ({
                    ...previous,
                    platform: event.target.value as SocialPlatform,
                  }))
                }
                className="w-full rounded-md border border-slate-300 px-3 py-2"
              >
                {socialPlatformOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-slate-600">Account Name</span>
              <input
                value={accountDraft.account_name}
                onChange={(event) =>
                  setAccountDraft((previous) => ({
                    ...previous,
                    account_name: event.target.value,
                  }))
                }
                className="w-full rounded-md border border-slate-300 px-3 py-2"
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-slate-600">Handle</span>
              <input
                value={accountDraft.handle}
                onChange={(event) =>
                  setAccountDraft((previous) => ({
                    ...previous,
                    handle: event.target.value,
                  }))
                }
                className="w-full rounded-md border border-slate-300 px-3 py-2"
                placeholder={accountDraft.platform === "x" ? "@brand_handle" : "Optional public handle"}
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-slate-600">Page ID</span>
              <input
                value={accountDraft.page_id}
                onChange={(event) =>
                  setAccountDraft((previous) => ({
                    ...previous,
                    page_id: event.target.value,
                  }))
                }
                className="w-full rounded-md border border-slate-300 px-3 py-2"
                placeholder={
                  accountDraft.platform === "facebook"
                    ? "Facebook page ID"
                    : "Optional platform page ID"
                }
              />
            </label>
          </div>
        </CRMModalBase>

        <CRMModalBase
          open={ruleModalOpen}
          title={editingRule ? "Edit Automation Rule" : "Create Automation Rule"}
          footer={
            <>
              <button
                type="button"
                onClick={() => setRuleModalOpen(false)}
                className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void submitRule()}
                className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white"
              >
                Save
              </button>
            </>
          }
        >
          {ruleError ? (
            <div className="mb-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {ruleError}
            </div>
          ) : null}
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-1 text-sm">
              <span className="text-slate-600">Platform</span>
              <select
                value={ruleDraft.platform}
                onChange={(event) =>
                  setRuleDraft((previous) => ({
                    ...previous,
                    platform: event.target.value as SocialPlatform,
                  }))
                }
                className="w-full rounded-md border border-slate-300 px-3 py-2"
              >
                {socialPlatformOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-slate-600">Trigger Type</span>
              <select
                value={ruleDraft.trigger_type}
                onChange={(event) =>
                  setRuleDraft((previous) => ({
                    ...previous,
                    trigger_type: event.target.value as SocialTriggerType,
                  }))
                }
                className="w-full rounded-md border border-slate-300 px-3 py-2"
              >
                {automationTriggerOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-slate-600">Assign To User ID</span>
              <input
                value={ruleDraft.assign_to_user}
                onChange={(event) =>
                  setRuleDraft((previous) => ({
                    ...previous,
                    assign_to_user: event.target.value,
                  }))
                }
                className="w-full rounded-md border border-slate-300 px-3 py-2"
                placeholder="Internal CRM user ID"
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-slate-600">Assign To Team</span>
              <input
                value={ruleDraft.assign_to_team}
                onChange={(event) =>
                  setRuleDraft((previous) => ({
                    ...previous,
                    assign_to_team: event.target.value,
                  }))
                }
                className="w-full rounded-md border border-slate-300 px-3 py-2"
                placeholder="Sales team, support queue, or owner group"
              />
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700 md:col-span-2">
              <input
                type="checkbox"
                checked={ruleDraft.is_active}
                onChange={(event) =>
                  setRuleDraft((previous) => ({
                    ...previous,
                    is_active: event.target.checked,
                  }))
                }
              />
              Rule active
            </label>
            <label className="space-y-1 text-sm md:col-span-2">
              <span className="text-slate-600">Qualification Logic</span>
              <textarea
                rows={8}
                value={ruleDraft.qualification_logic_text}
                onChange={(event) =>
                  setRuleDraft((previous) => ({
                    ...previous,
                    qualification_logic_text: event.target.value,
                  }))
                }
                className="w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-xs"
              />
            </label>
          </div>
        </CRMModalBase>
      </div>
    </DashboardLayout>
  );
}
