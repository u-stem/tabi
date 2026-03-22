"use client";

import type { DiscordEnabledType } from "@sugara/shared";
import { DISCORD_ENABLED_TYPES_DEFAULT } from "@sugara/shared";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Send, Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingBoundary } from "@/components/ui/loading-boundary";
import {
  ResponsiveAlertDialog,
  ResponsiveAlertDialogCancel,
  ResponsiveAlertDialogContent,
  ResponsiveAlertDialogDescription,
  ResponsiveAlertDialogDestructiveAction,
  ResponsiveAlertDialogFooter,
  ResponsiveAlertDialogHeader,
  ResponsiveAlertDialogTitle,
} from "@/components/ui/responsive-alert-dialog";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { api, getApiErrorMessage } from "@/lib/api";
import { formatDateFromISO } from "@/lib/format";
import { QUERY_CONFIG } from "@/lib/query-config";
import { queryKeys } from "@/lib/query-keys";

type DiscordWebhookDialogProps = {
  tripId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canEdit: boolean;
};

type WebhookResponse = {
  id: string;
  name: string | null;
  webhookUrl: string;
  enabledTypes: DiscordEnabledType[];
  isActive: boolean;
  lastSuccessAt: string | null;
  failureCount: number;
};

const ALL_ENABLED_TYPES: DiscordEnabledType[] = [
  "member_added",
  "member_removed",
  "role_changed",
  "schedule_created",
  "schedule_updated",
  "schedule_deleted",
  "poll_started",
  "poll_closed",
  "expense_added",
  "settlement_checked",
];

const TYPE_LABEL_KEYS: Record<DiscordEnabledType, string> = {
  member_added: "typeMemberAdded",
  member_removed: "typeMemberRemoved",
  role_changed: "typeRoleChanged",
  schedule_created: "typeScheduleCreated",
  schedule_updated: "typeScheduleUpdated",
  schedule_deleted: "typeScheduleDeleted",
  poll_started: "typePollStarted",
  poll_closed: "typePollClosed",
  expense_added: "typeExpenseAdded",
  settlement_checked: "typeSettlementChecked",
};

export function DiscordWebhookDialog({
  tripId,
  open,
  onOpenChange,
  canEdit: canEditProp,
}: DiscordWebhookDialogProps) {
  const locale = useLocale();
  const td = useTranslations("discord");
  const tc = useTranslations("common");
  const queryClient = useQueryClient();
  const cacheKey = queryKeys.discord.webhook(tripId);

  const [webhookUrl, setWebhookUrl] = useState("");
  const [name, setName] = useState("");
  const [enabledTypes, setEnabledTypes] = useState<DiscordEnabledType[]>(
    DISCORD_ENABLED_TYPES_DEFAULT,
  );
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  // Show URL form to reconfigure an inactive webhook
  const [showReactivateForm, setShowReactivateForm] = useState(false);
  const [reactivateUrl, setReactivateUrl] = useState("");

  const {
    data: webhook,
    isLoading,
    error,
  } = useQuery({
    queryKey: cacheKey,
    queryFn: async () => {
      const result = await api<WebhookResponse | null>(`/api/trips/${tripId}/discord-webhook`);
      return result;
    },
    enabled: open,
    ...QUERY_CONFIG.stable,
  });

  // Sync form state when webhook data loads
  useEffect(() => {
    if (webhook) {
      setName(webhook.name ?? "");
      setEnabledTypes(webhook.enabledTypes);
      setShowReactivateForm(false);
      setReactivateUrl("");
    } else {
      setWebhookUrl("");
      setName("");
      setEnabledTypes(DISCORD_ENABLED_TYPES_DEFAULT);
      setShowReactivateForm(false);
      setReactivateUrl("");
    }
  }, [webhook]);

  function toggleType(type: DiscordEnabledType) {
    setEnabledTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type],
    );
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!webhookUrl.trim()) {
      toast.error(td("invalidUrl"));
      return;
    }
    setSaving(true);
    try {
      await api(`/api/trips/${tripId}/discord-webhook`, {
        method: "POST",
        body: JSON.stringify({
          webhookUrl,
          name: name.trim() || undefined,
          enabledTypes,
          locale,
        }),
      });
      toast.success(td("created"));
      queryClient.invalidateQueries({ queryKey: cacheKey });
    } catch (err) {
      const message = getApiErrorMessage(err, td("invalidUrl"), {
        conflict: td("alreadyExists"),
        badRequest: td("unreachableUrl"),
      });
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdate() {
    setSaving(true);
    try {
      await api(`/api/trips/${tripId}/discord-webhook`, {
        method: "PUT",
        body: JSON.stringify({
          name: name.trim() || undefined,
          enabledTypes,
          locale,
        }),
      });
      toast.success(td("updated"));
      queryClient.invalidateQueries({ queryKey: cacheKey });
    } catch (err) {
      const message = getApiErrorMessage(err, td("invalidUrl"));
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  async function handleReactivate(e: React.FormEvent) {
    e.preventDefault();
    if (!reactivateUrl.trim()) {
      toast.error(td("invalidUrl"));
      return;
    }
    setSaving(true);
    try {
      await api(`/api/trips/${tripId}/discord-webhook`, {
        method: "PUT",
        body: JSON.stringify({
          webhookUrl: reactivateUrl,
          locale,
        }),
      });
      toast.success(td("updated"));
      setShowReactivateForm(false);
      setReactivateUrl("");
      queryClient.invalidateQueries({ queryKey: cacheKey });
    } catch (err) {
      const message = getApiErrorMessage(err, td("unreachableUrl"));
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await api(`/api/trips/${tripId}/discord-webhook`, {
        method: "DELETE",
      });
      toast.success(td("deleted"));
      queryClient.invalidateQueries({ queryKey: cacheKey });
    } catch (err) {
      const message = getApiErrorMessage(err, td("delete"));
      toast.error(message);
    } finally {
      setDeleting(false);
      setDeleteOpen(false);
    }
  }

  async function handleTestSend() {
    setTesting(true);
    try {
      await api(`/api/trips/${tripId}/discord-webhook/test`, {
        method: "POST",
      });
      toast.success(td("testSendSuccess"));
    } catch (err) {
      const message = getApiErrorMessage(err, td("unreachableUrl"));
      toast.error(message);
    } finally {
      setTesting(false);
    }
  }

  const hasChanges =
    webhook &&
    (name !== (webhook.name ?? "") ||
      JSON.stringify([...enabledTypes].sort()) !==
        JSON.stringify([...webhook.enabledTypes].sort()));

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent>
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>{td("title")}</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>{td("description")}</ResponsiveDialogDescription>
        </ResponsiveDialogHeader>

        <LoadingBoundary
          isLoading={isLoading}
          skeleton={
            <div className="space-y-3">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          }
        >
          {error ? (
            <p className="text-sm text-destructive">{String(error)}</p>
          ) : webhook ? (
            <ExistingWebhookView
              webhook={webhook}
              canEdit={canEditProp}
              locale={locale}
              name={name}
              enabledTypes={enabledTypes}
              saving={saving}
              testing={testing}
              hasChanges={!!hasChanges}
              showReactivateForm={showReactivateForm}
              reactivateUrl={reactivateUrl}
              td={td}
              tc={tc}
              onNameChange={setName}
              onToggleType={toggleType}
              onUpdate={handleUpdate}
              onTestSend={handleTestSend}
              onDeleteOpen={() => setDeleteOpen(true)}
              onShowReactivateForm={() => setShowReactivateForm(true)}
              onReactivateUrlChange={setReactivateUrl}
              onReactivate={handleReactivate}
            />
          ) : (
            canEditProp && (
              <CreateWebhookForm
                webhookUrl={webhookUrl}
                name={name}
                enabledTypes={enabledTypes}
                saving={saving}
                td={td}
                onWebhookUrlChange={setWebhookUrl}
                onNameChange={setName}
                onToggleType={toggleType}
                onCreate={handleCreate}
              />
            )
          )}
        </LoadingBoundary>
      </ResponsiveDialogContent>

      <ResponsiveAlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <ResponsiveAlertDialogContent>
          <ResponsiveAlertDialogHeader>
            <ResponsiveAlertDialogTitle>{td("delete")}</ResponsiveAlertDialogTitle>
            <ResponsiveAlertDialogDescription>
              {td("deleteConfirm")}
            </ResponsiveAlertDialogDescription>
          </ResponsiveAlertDialogHeader>
          <ResponsiveAlertDialogFooter>
            <ResponsiveAlertDialogCancel>{tc("cancel")}</ResponsiveAlertDialogCancel>
            <ResponsiveAlertDialogDestructiveAction onClick={handleDelete} disabled={deleting}>
              <Trash2 className="h-4 w-4" />
              {td("delete")}
            </ResponsiveAlertDialogDestructiveAction>
          </ResponsiveAlertDialogFooter>
        </ResponsiveAlertDialogContent>
      </ResponsiveAlertDialog>
    </ResponsiveDialog>
  );
}

// --- Sub-components to keep the main component readable ---

type TypeChecklistProps = {
  enabledTypes: DiscordEnabledType[];
  onToggleType: (type: DiscordEnabledType) => void;
  disabled: boolean;
  td: ReturnType<typeof useTranslations<"discord">>;
};

function TypeChecklist({ enabledTypes, onToggleType, disabled, td }: TypeChecklistProps) {
  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">{td("enabledTypes")}</Label>
      <div className="grid grid-cols-2 gap-2">
        {ALL_ENABLED_TYPES.map((type) => (
          <div key={type} className="flex items-center gap-2">
            <Checkbox
              id={`type-${type}`}
              checked={enabledTypes.includes(type)}
              onCheckedChange={() => onToggleType(type)}
              disabled={disabled}
            />
            <Label htmlFor={`type-${type}`} className="text-sm">
              {td(TYPE_LABEL_KEYS[type] as Parameters<typeof td>[0])}
            </Label>
          </div>
        ))}
      </div>
    </div>
  );
}

type CreateWebhookFormProps = {
  webhookUrl: string;
  name: string;
  enabledTypes: DiscordEnabledType[];
  saving: boolean;
  td: ReturnType<typeof useTranslations<"discord">>;
  onWebhookUrlChange: (url: string) => void;
  onNameChange: (name: string) => void;
  onToggleType: (type: DiscordEnabledType) => void;
  onCreate: (e: React.FormEvent) => void;
};

function CreateWebhookForm({
  webhookUrl,
  name,
  enabledTypes,
  saving,
  td,
  onWebhookUrlChange,
  onNameChange,
  onToggleType,
  onCreate,
}: CreateWebhookFormProps) {
  return (
    <form onSubmit={onCreate} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="webhook-url">{td("webhookUrl")}</Label>
        <Input
          id="webhook-url"
          type="url"
          placeholder={td("webhookUrlPlaceholder")}
          value={webhookUrl}
          onChange={(e) => onWebhookUrlChange(e.target.value)}
          required
        />
        <p className="text-xs text-muted-foreground">{td("webhookUrlHelp")}</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="webhook-name">{td("name")}</Label>
        <Input
          id="webhook-name"
          type="text"
          placeholder={td("namePlaceholder")}
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          maxLength={100}
        />
      </div>

      <TypeChecklist
        enabledTypes={enabledTypes}
        onToggleType={onToggleType}
        disabled={saving}
        td={td}
      />

      <Button type="submit" disabled={saving || enabledTypes.length === 0} className="w-full">
        {td("save")}
      </Button>
    </form>
  );
}

type ExistingWebhookViewProps = {
  webhook: WebhookResponse;
  canEdit: boolean;
  locale: string;
  name: string;
  enabledTypes: DiscordEnabledType[];
  saving: boolean;
  testing: boolean;
  hasChanges: boolean;
  showReactivateForm: boolean;
  reactivateUrl: string;
  td: ReturnType<typeof useTranslations<"discord">>;
  tc: ReturnType<typeof useTranslations<"common">>;
  onNameChange: (name: string) => void;
  onToggleType: (type: DiscordEnabledType) => void;
  onUpdate: () => void;
  onTestSend: () => void;
  onDeleteOpen: () => void;
  onShowReactivateForm: () => void;
  onReactivateUrlChange: (url: string) => void;
  onReactivate: (e: React.FormEvent) => void;
};

function ExistingWebhookView({
  webhook,
  canEdit,
  locale,
  name,
  enabledTypes,
  saving,
  testing,
  hasChanges,
  showReactivateForm,
  reactivateUrl,
  td,
  tc,
  onNameChange,
  onToggleType,
  onUpdate,
  onTestSend,
  onDeleteOpen,
  onShowReactivateForm,
  onReactivateUrlChange,
  onReactivate,
}: ExistingWebhookViewProps) {
  return (
    <div className="space-y-4">
      {/* Status + masked URL */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant={webhook.isActive ? "default" : "secondary"}>
            {webhook.isActive ? td("active") : td("inactive")}
          </Badge>
          <span className="text-sm text-muted-foreground">{webhook.webhookUrl}</span>
        </div>
      </div>

      {/* Inactive warning */}
      {!webhook.isActive && (
        <div className="flex items-start gap-2 rounded-md border border-yellow-500/20 bg-yellow-500/10 p-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-yellow-600" />
          <div className="space-y-2">
            <p className="text-sm text-yellow-800 dark:text-yellow-200">{td("inactiveWarning")}</p>
            {canEdit && !showReactivateForm && (
              <Button size="sm" variant="outline" onClick={onShowReactivateForm}>
                {td("reactivate")}
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Reactivate form */}
      {showReactivateForm && canEdit && (
        <form onSubmit={onReactivate} className="space-y-2">
          <Label htmlFor="reactivate-url">{td("webhookUrl")}</Label>
          <Input
            id="reactivate-url"
            type="url"
            placeholder={td("webhookUrlPlaceholder")}
            value={reactivateUrl}
            onChange={(e) => onReactivateUrlChange(e.target.value)}
            required
          />
          <Button type="submit" size="sm" disabled={saving}>
            {td("save")}
          </Button>
        </form>
      )}

      {/* Last success */}
      {webhook.lastSuccessAt && (
        <p className="text-xs text-muted-foreground">
          {td("lastSuccess")}: {formatDateFromISO(webhook.lastSuccessAt, { locale })}
        </p>
      )}

      {/* Name (editable) */}
      {canEdit && (
        <div className="space-y-2">
          <Label htmlFor="edit-webhook-name">{td("name")}</Label>
          <Input
            id="edit-webhook-name"
            type="text"
            placeholder={td("namePlaceholder")}
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            maxLength={100}
          />
        </div>
      )}

      {/* Enabled types */}
      <TypeChecklist
        enabledTypes={enabledTypes}
        onToggleType={onToggleType}
        disabled={!canEdit || saving}
        td={td}
      />

      {/* Actions */}
      {canEdit && (
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            disabled={saving || !hasChanges || enabledTypes.length === 0}
            onClick={onUpdate}
          >
            {td("save")}
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={testing || !webhook.isActive}
            onClick={onTestSend}
          >
            <Send className="h-4 w-4" />
            {td("testSend")}
          </Button>
          <Button size="sm" variant="destructive" onClick={onDeleteOpen}>
            <Trash2 className="h-4 w-4" />
            {td("delete")}
          </Button>
        </div>
      )}
    </div>
  );
}
