"use client";

import { BOOKMARK_LIST_NAME_MAX_LENGTH, type BookmarkListVisibility } from "@sugara/shared";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogDestructiveAction,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  return (
    <ResponsiveDialog
      open={listOps.editingList}
      onOpenChange={(v) => !v && listOps.setEditingList(false)}
    >
      <ResponsiveDialogContent>
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>リストを編集</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>リストの設定を変更します。</ResponsiveDialogDescription>
        </ResponsiveDialogHeader>
        <form onSubmit={listOps.handleUpdate}>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="edit-list-name">リスト名</Label>
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
              <Label htmlFor="edit-list-visibility">公開設定</Label>
              <Select
                value={listOps.editListVisibility}
                onValueChange={(v) => listOps.setEditListVisibility(v as BookmarkListVisibility)}
              >
                <SelectTrigger id="edit-list-visibility" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="private">非公開</SelectItem>
                  <SelectItem value="friends_only">フレンド限定</SelectItem>
                  <SelectItem value="public">全体公開</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <ResponsiveDialogFooter>
            <Button type="button" variant="outline" onClick={() => listOps.setEditingList(false)}>
              キャンセル
            </Button>
            <Button type="submit" disabled={!listOps.editListName.trim()}>
              保存
            </Button>
          </ResponsiveDialogFooter>
        </form>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}

export function AddBookmarkDialog({ bmOps, listName }: { bmOps: BmOps; listName: string }) {
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
          <ResponsiveDialogTitle>ブックマークを追加</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            「{listName}」にブックマークを追加します。
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
              キャンセル
            </Button>
            <Button type="submit" disabled={bmOps.submitting || !bmOps.bookmarkName.trim()}>
              {bmOps.submitting ? "追加中..." : "追加"}
            </Button>
          </ResponsiveDialogFooter>
        </form>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}

export function EditBookmarkDialog({ bmOps }: { bmOps: BmOps }) {
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
          <ResponsiveDialogTitle>ブックマークを編集</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            ブックマークの内容を変更します。
          </ResponsiveDialogDescription>
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
              キャンセル
            </Button>
            <Button type="submit" disabled={bmOps.submitting || !bmOps.bookmarkName.trim()}>
              {bmOps.submitting ? "保存中..." : "保存"}
            </Button>
          </ResponsiveDialogFooter>
        </form>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}

export function DeleteListDialog({ listOps, listName }: { listOps: ListOps; listName: string }) {
  return (
    <AlertDialog
      open={listOps.deletingList}
      onOpenChange={(v) => !v && listOps.setDeletingList(false)}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>リストを削除しますか？</AlertDialogTitle>
          <AlertDialogDescription>
            「{listName}
            」とそのブックマークがすべて削除されます。この操作は取り消せません。
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>キャンセル</AlertDialogCancel>
          <AlertDialogDestructiveAction onClick={listOps.handleDelete}>
            削除する
          </AlertDialogDestructiveAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function DeleteBookmarkDialog({ bmOps }: { bmOps: BmOps }) {
  return (
    <AlertDialog
      open={bmOps.deletingBookmark !== null}
      onOpenChange={(v) => !v && bmOps.setDeletingBookmark(null)}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>ブックマークを削除しますか？</AlertDialogTitle>
          <AlertDialogDescription>
            「{bmOps.deletingBookmark?.name}」を削除します。この操作は取り消せません。
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>キャンセル</AlertDialogCancel>
          <AlertDialogDestructiveAction onClick={bmOps.handleDelete}>
            削除する
          </AlertDialogDestructiveAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function BatchDeleteDialog({ sel }: { sel: Selection }) {
  return (
    <AlertDialog
      open={sel.batchDeleteOpen}
      onOpenChange={(v) => !v && sel.setBatchDeleteOpen(false)}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {sel.selectedIds.size}件のブックマークを削除しますか？
          </AlertDialogTitle>
          <AlertDialogDescription>
            選択したブックマークをすべて削除します。この操作は取り消せません。
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>キャンセル</AlertDialogCancel>
          <AlertDialogDestructiveAction onClick={sel.handleBatchDelete} disabled={sel.batchLoading}>
            {sel.batchLoading ? "削除中..." : "削除する"}
          </AlertDialogDestructiveAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
