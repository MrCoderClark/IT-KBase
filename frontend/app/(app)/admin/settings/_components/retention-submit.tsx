"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";

export function RetentionSubmit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="outline" className="mt-3" disabled={pending}>
      {pending ? "Running…" : "Run retention now"}
    </Button>
  );
}
