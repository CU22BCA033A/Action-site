"use client";

import { Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field, Input } from "@/components/ui/field";
import { deleteAuctionAction } from "@/lib/admin/actions/auctions";
import { useAdminAction } from "./use-admin-action";

/** Delete the whole auction. The admin types the name to confirm. */
export function DeleteAuction({ auctionId, name }: { auctionId: string; name: string }) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [mismatch, setMismatch] = useState(false);
  const del = useAdminAction(deleteAuctionAction);
  return (
    <>
      <Button variant="danger" icon={<Trash2 className="size-4" aria-hidden="true" />} onClick={() => setOpen(true)}>
        Delete auction
      </Button>
      <ConfirmDialog
        open={open}
        onClose={() => {
          setOpen(false);
          setTyped("");
          del.reset();
        }}
        title={`Delete ${name}?`}
        consequences={[
          "The auction disappears from the site, the admin panel and every public screen.",
          "All team codes stop working and every team owner is signed out.",
          "If it is live, bidding stops at once. The audit log keeps a record of the delete.",
        ]}
        confirmLabel="Delete auction"
        danger
        busy={del.pending}
        error={mismatch ? "Type the auction name exactly as shown." : del.result && !del.result.ok ? del.result.error : null}
        onConfirm={() => {
          if (typed.trim() !== name) {
            setMismatch(true);
            return;
          }
          setMismatch(false);
          del.run({ auctionId, confirmName: typed });
        }}
      >
        <Field name="confirm-name" label={`Type ${name} to confirm`}>
          <Input id="f-confirm-name" value={typed} onChange={(e) => { setTyped(e.target.value); setMismatch(false); }} autoComplete="off" />
        </Field>
      </ConfirmDialog>
    </>
  );
}
