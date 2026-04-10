"use client";

import { useEffect } from "react";

export function TrackView({ contactId }: { contactId: string }) {
  useEffect(() => {
    fetch(`/api/contacts/${contactId}/view`, { method: "POST" }).catch(() => {});
  }, [contactId]);

  return null;
}
