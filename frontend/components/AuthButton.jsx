"use client";

import { signIn, signOut } from "next-auth/react";

export default function AuthButton({ session }) {
  if (!session) {
    return (
      <button
        onClick={() => signIn("github")}
        className="bg-black text-white px-6 py-3 rounded-lg"
      >
        Sign in with GitHub
      </button>
    );
  }

  return (
    <div className="flex items-center gap-4">
      <span>{session.user.name}</span>
      <button
        onClick={() => signOut()}
        className="bg-red-500 text-white px-4 py-2 rounded-lg"
      >
        Sign out
      </button>
    </div>
  );
}
