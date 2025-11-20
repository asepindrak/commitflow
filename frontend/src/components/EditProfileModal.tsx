// frontend/src/components/EditProfileModal.tsx
import React, { useEffect, useRef, useState } from "react";
import { X, Camera } from "lucide-react";
import uploadMultipleFiles from "../utils/uploadFile";
import type { TeamMember } from "../types";
import { toast } from "react-toastify";

export default function EditProfileModal({
  open,
  onClose,
  member,
  onSave,
  dark,
}: {
  open: boolean;
  onClose: () => void;
  member: TeamMember | null;
  // allow password in saved payload
  onSave: (m: TeamMember & { password?: string }) => void;
  dark?: boolean;
}) {
  const [name, setName] = useState(member?.name ?? "");
  const [phone, setPhone] = useState(member?.phone ?? "");
  const [email, setEmail] = useState(member?.email ?? "");
  const [role, setRole] = useState(member?.role ?? "FE");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(
    member?.photo ?? null
  );
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    // when opening or member changes, prefill fields
    if (open) {
      setName(member?.name ?? "");
      setPhone(member?.phone ?? "");
      setEmail(member?.email ?? "");
      setRole(member?.role ?? "FE");
      setPhotoFile(null);
      setPhotoPreview(member?.photo ?? null);
      setPassword("");
      setPasswordConfirm("");
      setSaving(false);
    }
  }, [open, member]);

  if (!open) return null;

  // handler when user clicks the photo area
  const onClickPhoto = () => {
    if (inputRef.current && !saving) {
      inputRef.current.click();
    }
  };

  // file input change handler
  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      setPhotoFile(f);
      setPhotoPreview(URL.createObjectURL(f));
    }
  };

  async function handleSave(e?: React.FormEvent) {
    e?.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      toast.dark("Please enter a name");
      return;
    }
    if (!member?.id) {
      toast.error("No member id to update");
      return;
    }

    // password validation: only if user provided something
    if (password || passwordConfirm) {
      if (password.length === 0) {
        toast.dark("Password cannot be empty");
        return;
      }
      if (password !== passwordConfirm) {
        toast.dark("Passwords do not match");
        return;
      }
    }

    setSaving(true);
    try {
      let photoUrl: string | undefined = member.photo ?? undefined;
      if (photoFile) {
        const folder = `team/${trimmed.replace(/\s+/g, "_")}`;
        const urls = await uploadMultipleFiles([photoFile], folder);
        if (Array.isArray(urls) && urls[0]) photoUrl = urls[0];
      }

      const payload: any = {
        name: trimmed,
        phone: phone.trim() || null,
        email: email.trim() || null,
        role: role || null,
        photo: photoUrl ?? null,
      };

      // include password only if provided
      if (password) payload.password = password;

      const updated: TeamMember & { password?: string } = {
        ...member,
        name: payload.name,
        phone: payload.phone ?? undefined,
        email: payload.email ?? undefined,
        role: payload.role ?? undefined,
        photo: payload.photo ?? undefined,
      };

      if (payload.password) {
        (updated as any).password = payload.password;
      }

      toast.dark("Profile saved");
      onSave(updated);
      onClose();
    } catch (err: any) {
      console.error("EditProfile save failed", err);
      toast.dark(err?.message || "Failed to update profile");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6">
      {/* container enforces readable text in light mode and dark mode */}
      <div className="w-[520px] bg-white dark:bg-gray-900 rounded-xl shadow-xl p-6 text-slate-900 dark:text-slate-100">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Edit Profile</h3>
          <button
            onClick={() => !saving && onClose()}
            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800"
            aria-label="Close edit profile"
          >
            <X className="text-slate-900 dark:text-slate-100" />
          </button>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          <div className="flex gap-3">
            {/* Photo area: clickable */}
            <div
              role="button"
              tabIndex={0}
              onClick={onClickPhoto}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onClickPhoto();
                }
              }}
              className="w-28 h-28 rounded-md bg-gray-100 dark:bg-gray-800 flex items-center justify-center overflow-hidden cursor-pointer relative"
              aria-label="Change profile photo"
            >
              {photoPreview ? (
                <img
                  src={photoPreview}
                  alt="preview"
                  className="object-cover w-full h-full"
                />
              ) : (
                <div className="text-gray-400">
                  <Camera />
                </div>
              )}

              {/* hidden file input */}
              <input
                ref={inputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={onFileChange}
                disabled={saving}
              />

              {/* subtle overlay hint */}
              <div className="absolute inset-0 flex items-end justify-center pointer-events-none">
                <div className="bg-black/30 text-xs text-white px-2 py-1 rounded-b-md w-full text-center">
                  Click to change
                </div>
              </div>
            </div>

            <div className="flex-1 space-y-2">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Full name"
                className="w-full px-3 py-2 rounded-lg border bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 outline-none text-slate-900 dark:text-slate-100"
                disabled={saving}
              />

              <div className="grid grid-cols-2 gap-2">
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Phone"
                  className="px-3 py-2 rounded-lg border bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-slate-900 dark:text-slate-100"
                  disabled={saving}
                />
                <input
                  value={email ?? ""}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email"
                  className="px-3 py-2 rounded-lg border bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-slate-900 dark:text-slate-100"
                  disabled={saving}
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="New password (leave blank to keep)"
                  className="px-3 py-2 rounded-lg border bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-slate-900 dark:text-slate-100"
                  disabled={saving}
                />
                <input
                  type="password"
                  value={passwordConfirm}
                  onChange={(e) => setPasswordConfirm(e.target.value)}
                  placeholder="Confirm new password"
                  className="px-3 py-2 rounded-lg border bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-slate-900 dark:text-slate-100"
                  disabled={saving}
                />
              </div>

              <div className="flex items-center justify-between gap-2">
                <select
                  value={role ?? "FE"}
                  onChange={(e) => setRole(e.target.value)}
                  className="px-3 py-2 rounded-lg border bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-slate-900 dark:text-slate-100"
                  disabled={saving}
                >
                  <option value="FE">Frontend</option>
                  <option value="BE">Backend</option>
                  <option value="DevOps">DevOps</option>
                  <option value="PM">Product</option>
                  <option value="DOC">Documentation</option>
                </select>

                <div className="text-xs text-gray-500">
                  Click photo to change
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => !saving && onClose()}
              disabled={saving}
              className="px-4 py-2 rounded-lg border bg-white text-slate-900 dark:bg-gray-800 dark:text-slate-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-lg bg-sky-600 text-white flex items-center gap-2"
            >
              {saving ? (
                <>
                  <svg
                    className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                    />
                  </svg>
                  Saving…
                </>
              ) : (
                <span>Save</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
