"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PrintButton() {
  return (
    <Button variant="primary" onClick={() => window.print()} icon={<Printer className="size-4" aria-hidden="true" />}>
      Print or save as PDF
    </Button>
  );
}
