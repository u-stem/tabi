"use client";

import { BOOKMARK_LIST_NAME_MAX_LENGTH, type BookmarkListVisibility } from "@sugara/shared";
import { Check, Plus, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { useBookmarkListOperations } from "@/lib/hooks/use-bookmark-list-operations";
import type { useBookmarkOperations } from "@/lib/hooks/use-bookmark-operations";
import type { useBookmarkSelection } from "@/lib/hooks/use-bookmark-selection";
import { BookmarkFormFields } from "./bookmark-form-fields";

type ListOps = ReturnType<typeof useBookmarkListOperations>;
type BmOps = ReturnType<typeof useBookmarkOperations>;
type Selection = ReturnType<typeof useBookmarkSelection>;

export function EditListDialog({ listOps }: { listOps: ListOps }) {
  const tb = useTranslations("bookmark");
  const tc = useTranslations("common");
  const tlVis = useTranslations("labels.visibility");
  return (
    <ResponsiveDialog
      open={listOps.editingList}
      onOpenChange={(v) => !v && listOps.setEditingList(false)}
    >
      <ResponsiveDialogContent>
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>{tb("editListTitle")}</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>{tb("editListDescription")}</ResponsiveDialogDescription>
        </ResponsiveDialogHeader>
        <form onSubmit={listOps.handleUpdate}>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="edit-list-name">
                {tb("listName")} <span className="text-destructive">*</span>
              </Label>
              <Input
                id="edit-list-name"
                value={listOps.editListName}
                onChange={(e) => listOps.setEditListName(e.target.value)}
                maxLength={BOOKMARK_LIST_NAME_MAX_LENGTH}
                required
              />
              <p className="text-right text-xs text-muted-foreground">
                {listOps.editListName.length}/{BOOKMARK_LIST_NAME_MAX_LENGTH}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-list-visibility">{tb("visibilityLabel")}</Label>
              <Select
                value={listOps.editListVisibility}
                onValueChange={(v) => listOps.setEditListVisibility(v as BookmarkListVisibility)}
              >
                <SelectTrigger id="edit-list-visibility" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="private">{tlVis("private")}</SelectItem>
                  <SelectItem value="friends_only">{tlVis("friends_only")}</SelectItem>
                  <SelectItem value="public">{tlVis("public")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <ResponsiveDialogFooter>
            <Button type="button" variant="outline" onClick={() => listOps.setEditingList(false)}>
              <X className="h-4 w-4" />
              {tc("cancel")}
            </Button>
            <Button type="submit" disabled={!listOps.editListName.trim()}>
              <Check className="h-4 w-4" />
              {tc("save")}
            </Button>
          </ResponsiveDialogFooter>
        </form>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}

export function AddBookmarkDialog({ bmOps, listName }: { bmOps: BmOps; listName: string }) {
  const tb = useTranslations("bookmark");
  const tc = useTranslations("common");
  return (
    <ResponsiveDialog
      open={bmOps.addBookmarkOpen}
      onOpenChange={(v) => {
        if (!v) {
          bmOps.resetForm();
          bmOps.setAddBookmarkOpen(false);
        }
      }}
    >
      <ResponsiveDialogContent>
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>{tb("addBookmarkTitle")}</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            {tb("addBookmarkDescription", { listName })}
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>
        <form onSubmit={bmOps.handleAdd}>
          <BookmarkFormFields
            name={bmOps.bookmarkName}
            memo={bmOps.bookmarkMemo}
            urls={bmOps.bookmarkUrls}
            onNameChange={bmOps.setBookmarkName}
            onMemoChange={bmOps.setBookmarkMemo}
            onUrlsChange={bmOps.setBookmarkUrls}
          />
          <ResponsiveDialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                bmOps.resetForm();
                bmOps.setAddBookmarkOpen(false);
              }}
            >
              <X className="h-4 w-4" />
              {tc("cancel")}
            </Button>
            <Button type="submit" disabled={bmOps.submitting || !bmOps.bookmarkName.trim()}>
              <Plus className="h-4 w-4" />
              {bmOps.submitting ? tb("adding") : tb("add")}
            </Button>
          </ResponsiveDialogFooter>
        </form>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}

export function EditBookmarkDialog({ bmOps }: { bmOps: BmOps }) {
  const tb = useTranslations("bookmark");
  const tc = useTranslations("common");
  return (
    <ResponsiveDialog
      open={bmOps.editingBookmark !== null}
      onOpenChange={(v) => {
        if (!v) {
          bmOps.resetForm();
          bmOps.setEditingBookmark(null);
        }
      }}
    >
      <ResponsiveDialogContent>
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>{tb("editBookmarkTitle")}</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>{tb("editBookmarkDescription")}</ResponsiveDialogDescription>
        </ResponsiveDialogHeader>
        <form onSubmit={bmOps.handleUpdate}>
          <BookmarkFormFields
            name={bmOps.bookmarkName}
            memo={bmOps.bookmarkMemo}
            urls={bmOps.bookmarkUrls}
            onNameChange={bmOps.setBookmarkName}
            onMemoChange={bmOps.setBookmarkMemo}
            onUrlsChange={bmOps.setBookmarkUrls}
          />
          <ResponsiveDialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                bmOps.resetForm();
                bmOps.setEditingBookmark(null);
              }}
            >
              <X className="h-4 w-4" />
              {tc("cancel")}
            </Button>
            <Button type="submit" disabled={bmOps.submitting || !bmOps.bookmarkName.trim()}>
              <Check className="h-4 w-4" />
              {bmOps.submitting ? tb("saving") : tc("save")}
            </Button>
          </ResponsiveDialogFooter>
        </form>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}

export function DeleteListDialog({ listOps, listName }: { listOps: ListOps; listName: string }) {
  const tb = useTranslations("bookmark");
  const tc = useTranslations("common");
  return (
    <ResponsiveAlertDialog
      open={listOps.deletingList}
      onOpenChange={(v) => !v && listOps.setDeletingList(false)}
    >
      <ResponsiveAlertDialogContent>
        <ResponsiveAlertDialogHeader>
          <ResponsiveAlertDialogTitle>{tb("deleteListTitle")}</ResponsiveAlertDialogTitle>
          <ResponsiveAlertDialogDescription>
            {tb("deleteListDescription", { listName })}
          </ResponsiveAlertDialogDescription>
        </ResponsiveAlertDialogHeader>
        <ResponsiveAlertDialogFooter>
          <ResponsiveAlertDialogCancel>
            <X className="h-4 w-4" />
            {tc("cancel")}
          </ResponsiveAlertDialogCancel>
          <ResponsiveAlertDialogDestructiveAction onClick={listOps.handleDelete}>
            {tb("deleteConfirm")}
          </ResponsiveAlertDialogDestructiveAction>
        </ResponsiveAlertDialogFooter>
      </ResponsiveAlertDialogContent>
    </ResponsiveAlertDialog>
  );
}

export function DeleteBookmarkDialog({ bmOps }: { bmOps: BmOps }) {
  const tb = useTranslations("bookmark");
  const tc = useTranslations("common");
  return (
    <ResponsiveAlertDialog
      open={bmOps.deletingBookmark !== null}
      onOpenChange={(v) => !v && bmOps.setDeletingBookmark(null)}
    >
      <ResponsiveAlertDialogContent>
        <ResponsiveAlertDialogHeader>
          <ResponsiveAlertDialogTitle>{tb("deleteBookmarkTitle")}</ResponsiveAlertDialogTitle>
          <ResponsiveAlertDialogDescription>
            {tb("deleteBookmarkDescription", { name: bmOps.deletingBookmark?.name ?? "" })}
          </ResponsiveAlertDialogDescription>
        </ResponsiveAlertDialogHeader>
        <ResponsiveAlertDialogFooter>
          <ResponsiveAlertDialogCancel>
            <X className="h-4 w-4" />
            {tc("cancel")}
          </ResponsiveAlertDialogCancel>
          <ResponsiveAlertDialogDestructiveAction onClick={bmOps.handleDelete}>
            {tb("deleteConfirm")}
          </ResponsiveAlertDialogDestructiveAction>
        </ResponsiveAlertDialogFooter>
      </ResponsiveAlertDialogContent>
    </ResponsiveAlertDialog>
  );
}

export function BatchDeleteDialog({ sel }: { sel: Selection }) {
  const tb = useTranslations("bookmark");
  const tc = useTranslations("common");
  return (
    <ResponsiveAlertDialog
      open={sel.batchDeleteOpen}
      onOpenChange={(v) => !v && sel.setBatchDeleteOpen(false)}
    >
      <ResponsiveAlertDialogContent>
        <ResponsiveAlertDialogHeader>
          <ResponsiveAlertDialogTitle>
            {tb("batchDeleteBookmarkTitle", { count: sel.selectedIds.size })}
          </ResponsiveAlertDialogTitle>
          <ResponsiveAlertDialogDescription>
            {tb("batchDeleteBookmarkDescription")}
          </ResponsiveAlertDialogDescription>
        </ResponsiveAlertDialogHeader>
        <ResponsiveAlertDialogFooter>
          <ResponsiveAlertDialogCancel>
            <X className="h-4 w-4" />
            {tc("cancel")}
          </ResponsiveAlertDialogCancel>
          <ResponsiveAlertDialogDestructiveAction
            onClick={sel.handleBatchDelete}
            disabled={sel.batchLoading}
          >
            {sel.batchLoading ? tb("deleting") : tb("deleteConfirm")}
          </ResponsiveAlertDialogDestructiveAction>
        </ResponsiveAlertDialogFooter>
      </ResponsiveAlertDialogContent>
    </ResponsiveAlertDialog>
  );
}
