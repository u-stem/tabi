"use client";

import { BOOKMARK_LIST_NAME_MAX_LENGTH, type BookmarkListVisibility } from "@sugara/shared";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
    <Dialog open={listOps.editingList} onOpenChange={(v) => !v && listOps.setEditingList(false)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>リストを編集</DialogTitle>
          <DialogDescription>リストの設定を変更します。</DialogDescription>
        </DialogHeader>
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
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => listOps.setEditingList(false)}>
              キャンセル
            </Button>
            <Button type="submit" disabled={listOps.submitting || !listOps.editListName.trim()}>
              {listOps.submitting ? "保存中..." : "保存"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function AddBookmarkDialog({ bmOps, listName }: { bmOps: BmOps; listName: string }) {
  return (
    <Dialog
      open={bmOps.addBookmarkOpen}
      onOpenChange={(v) => {
        if (!v) {
          bmOps.resetForm();
          bmOps.setAddBookmarkOpen(false);
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>ブックマークを追加</DialogTitle>
          <DialogDescription>「{listName}」にブックマークを追加します。</DialogDescription>
        </DialogHeader>
        <form onSubmit={bmOps.handleAdd}>
          <BookmarkFormFields
            name={bmOps.bookmarkName}
            memo={bmOps.bookmarkMemo}
            urls={bmOps.bookmarkUrls}
            onNameChange={bmOps.setBookmarkName}
            onMemoChange={bmOps.setBookmarkMemo}
            onUrlsChange={bmOps.setBookmarkUrls}
          />
          <DialogFooter>
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
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function EditBookmarkDialog({ bmOps }: { bmOps: BmOps }) {
  return (
    <Dialog
      open={bmOps.editingBookmark !== null}
      onOpenChange={(v) => {
        if (!v) {
          bmOps.resetForm();
          bmOps.setEditingBookmark(null);
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>ブックマークを編集</DialogTitle>
          <DialogDescription>ブックマークの内容を変更します。</DialogDescription>
        </DialogHeader>
        <form onSubmit={bmOps.handleUpdate}>
          <BookmarkFormFields
            name={bmOps.bookmarkName}
            memo={bmOps.bookmarkMemo}
            urls={bmOps.bookmarkUrls}
            onNameChange={bmOps.setBookmarkName}
            onMemoChange={bmOps.setBookmarkMemo}
            onUrlsChange={bmOps.setBookmarkUrls}
          />
          <DialogFooter>
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
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
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
          <AlertDialogAction
            onClick={listOps.handleDelete}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            削除する
          </AlertDialogAction>
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
          <AlertDialogAction
            onClick={bmOps.handleDelete}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            削除する
          </AlertDialogAction>
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
          <AlertDialogAction
            onClick={sel.handleBatchDelete}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            disabled={sel.batchLoading}
          >
            {sel.batchLoading ? "削除中..." : "削除する"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
