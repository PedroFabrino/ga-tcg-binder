"use client";

import { Modal } from "@/components/common";
import SignInPanel from "@/components/SignInPanel";

export default function LoginModal({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="Sign in to your Binder" subtitle="Track your collection, build decks and share with your playgroup" onClose={onClose} size="md">
      <SignInPanel callbackUrl={typeof window !== "undefined" ? window.location.href : "/"} onSignedIn={onClose} />
    </Modal>
  );
}
