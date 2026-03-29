"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AgreementContent } from "./AgreementContent";

type AgreementType = "seller" | "buyer";

interface AgreementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: AgreementType;
  onAccept: () => Promise<void>;
  onDecline?: () => void;
}

export function AgreementDialog({
  open,
  onOpenChange,
  type,
  onAccept,
  onDecline,
}: AgreementDialogProps) {
  const t = useTranslations("agreements");
  const [isChecked, setIsChecked] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      setIsChecked(false);
      setIsSubmitting(false);
    }
  }, [open]);

  const handleAccept = async () => {
    if (!isChecked || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    try {
      await onAccept();
      onOpenChange(false);
    } catch {
      // Keep dialog open so users can retry after transient failures.
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] max-w-3xl flex-col p-0">
        <DialogHeader className="border-b px-6 pt-6 pb-4">
          <DialogTitle>{t(`${type}.title`)}</DialogTitle>
          <DialogDescription>{t("dialog.reviewAndAccept")}</DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          <AgreementContent type={type} />
        </div>

        <DialogFooter className="border-t px-6 pt-4 pb-6 sm:justify-between">
          <label className="flex items-start gap-3 text-sm text-muted-foreground">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 rounded border border-input"
              checked={isChecked}
              onChange={(e) => setIsChecked(e.target.checked)}
              disabled={isSubmitting}
            />
            <span>{t(`${type}.acceptanceLabel`)}</span>
          </label>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                onOpenChange(false);
                onDecline?.();
              }}
              disabled={isSubmitting}
            >
              {t("dialog.decline")}
            </Button>
            <Button
              onClick={handleAccept}
              disabled={!isChecked || isSubmitting}
            >
              {isSubmitting ? t("dialog.accepting") : t("dialog.accept")}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

