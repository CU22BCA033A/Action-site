"use client";

import { Eraser, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field, Input } from "@/components/ui/field";
import { deleteAuctionAction, eraseAuctionAction } from "@/lib/admin/actions/auctions";
import { useAdminAction } from "./use-admin-action";

const MODES = {
  delete: {
    button: "Delete auction",
    title: (name: string) => `Delete ${name}?`,
    consequences: [
      "The auction disappears from the site, the admin panel and every public screen.",
      "All team codes stop working and every team owner is signed out.",
      "If it is live, bidding stops at once. The audit log keeps a record of the delete.",
    ],
  },
  erase: {
    button: "Erase permanently",
    title: (name: string) => `Erase ${name} and all its data?`,
    consequences: [
      "Deletes the auction, its teams, access codes, players, bids, registrations and results for good.",
      "Deletes every player photo and team logo it uses from storage.",
      "Cannot be undone, not even by the site owner. Download the results first if you need them.",
    ],
  },
} as const;

/** Delete (hide) or erase the whole auction. The admin types the name to confirm. */
export function DeleteAuction({ auctionId, name, mode = "delete" }: { auctionId: string; name: string; mode?: keyof typeof MODES }) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [mismatch, setMismatch] = useState(false);
  const del = useAdminAction(mode === "erase" ? eraseAuctionAction : deleteAuctionAction);
  const m = MODES[mode];
  return (
    <>
      <Button variant="danger" icon={mode === "erase" ? <Eraser className="size-4" aria-hidden="true" /> : <Trash2 className="size-4" aria-hidden="true" />} onClick={() => setOpen(true)}>
        {m.button}
      </Button>
      <ConfirmDialog
        open={open}
        onClose={() => {
          setOpen(false);
          setTyped("");
          del.reset();
        }}
        title={m.title(name)}
        consequences={[...m.consequences]}
        confirmLabel={m.button}
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
