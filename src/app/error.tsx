"use client";

/**
 * Error boundary global : carte élégante + bouton retry.
 * `unstable_retry` (Next 16.2) re-fetch et re-rend le segment ;
 * on retombe sur `reset` si absent.
 */
import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { RotateCcw, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function Error({
  error,
  reset,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  reset?: () => void;
  unstable_retry?: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const t = useTranslations("common");
  const retry = unstable_retry ?? reset;

  return (
    <div className="flex min-h-svh w-full items-center justify-center px-4 py-12">
      <Card className="w-full max-w-md text-center">
        <CardHeader className="items-center">
          <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-destructive/10">
            <TriangleAlert className="size-6 text-destructive" aria-hidden />
          </div>
          <CardTitle>{t("states.error")}</CardTitle>
        </CardHeader>
        {error.digest && (
          <CardContent>
            <p className="num text-xs text-muted-foreground">{error.digest}</p>
          </CardContent>
        )}
        <CardFooter className="justify-center pb-(--card-spacing)">
          {retry && (
            <Button onClick={() => retry()}>
              <RotateCcw data-icon="inline-start" aria-hidden />
              {t("states.retry")}
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}
