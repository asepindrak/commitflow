// frontend/src/components/EditProfileModal.tsx
import React, { useEffect, useRef, useState } from "react";
import { X, Camera, Save } from "lucide-react";
import uploadMultipleFiles from "../utils/uploadFile";
import type { TeamMember } from "../types";
import { toast } from "react-toastify";

function nameToHue(name = "") {
  return name.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360;
}

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

      onSave(updated);
      onClose();
    } catch (err: any) {
      console.error("EditProfile save failed", err);
      toast.dark(err?.message || "Failed to update profile");
    } finally {
      setSaving(false);
    }
  }

  // gradient preview derived from name hue (used only for live preview initials/name)
  const hue = nameToHue(name || "user");
  const nameGradientStyle: React.CSSProperties = {
    background: `linear-gradient(90deg, hsl(${hue} 70% 55%), hsl(${
      (hue + 60) % 360
    } 70% 55%))`,
    WebkitBackgroundClip: "text",
    backgroundClip: "text",
    color: "transparent",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
      <div
        className="absolute inset-0 bg-gradient-to-br from-black/40 via-black/30 to-black/20 backdrop-blur-sm"
        onClick={() => !saving && onClose()}
      />

      <div className="relative z-10 w-full max-w-2xl">
        <div className="bg-slate-100 dark:bg-gray-900 rounded-2xl shadow-2xl overflow-hidden border border-gray-200 dark:border-gray-800">
          <div className="flex items-center justify-between px-6 py-4 bg-white/50 dark:bg-gray-900/40">
            <div>
              <h3
                className="text-lg font-semibold"
                style={{
                  background: "linear-gradient(90deg, #0ea5e9, #7c3aed)",
                  WebkitBackgroundClip: "text",
                  backgroundClip: "text",
                  color: "transparent",
                }}
              >
                Edit Profile
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Update member details
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => !saving && onClose()}
                aria-label="Close edit profile"
                className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition"
              >
                <X className="text-slate-900 dark:text-slate-100" />
              </button>
            </div>
          </div>

          <form
            onSubmit={handleSave}
            className="px-6 py-6 grid grid-cols-1 gap-6"
          >
            <div className="flex gap-5">
              {/* photo area: blue dark gradient when no preview */}
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
                className={`w-28 h-28 rounded-xl flex-shrink-0 flex items-center justify-center overflow-hidden relative cursor-pointer border border-dashed border-gray-200 dark:border-gray-800 ${
                  photoPreview
                    ? ""
                    : "bg-gradient-to-br from-sky-700 to-indigo-700"
                }`}
                aria-label="Change profile photo"
              >
                {photoPreview ? (
                  <img
                    src={photoPreview}
                    alt="preview"
                    className="object-cover w-full h-full"
                  />
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center bg-white/10">
                      <Camera />
                    </div>
                    {/* initials preview with gradient text */}
                    <div
                      className="text-xs text-white/90"
                      style={nameGradientStyle}
                    >
                      {name
                        ? name
                            .split(" ")
                            .map((n) => n[0] ?? "")
                            .slice(0, 2)
                            .join("")
                            .toUpperCase()
                        : "NM"}
                    </div>
                  </div>
                )}

                <input
                  ref={inputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={onFileChange}
                  disabled={saving}
                />

                <div className="absolute inset-x-0 bottom-0 flex justify-center">
                  <div className="bg-black/40 text-xs text-white px-2 py-1 rounded-b-md w-full text-center">
                    Click to change
                  </div>
                </div>
              </div>

              <div className="flex-1 grid grid-cols-1 gap-3">
                {/* Name */}
                <label className="block">
                  <div className="text-xs mb-2">
                    <span className="text-sky-500 font-medium">Full name</span>
                  </div>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Full name"
                    className="w-full px-3 py-2 rounded-lg border bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 outline-none text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-sky-300 dark:focus:ring-sky-600"
                    disabled={saving}
                  />
                </label>

                <div className="grid grid-cols-2 gap-2">
                  <label className="block">
                    <div className="text-xs mb-2">
                      <span className="text-sky-500 font-medium">Phone</span>
                    </div>
                    <input
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="Phone"
                      className="px-3 py-2 rounded-lg border bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-sky-300 dark:focus:ring-sky-600"
                      disabled={saving}
                    />
                  </label>

                  <label className="block">
                    <div className="text-xs mb-2">
                      <span className="text-sky-500 font-medium">Email</span>
                    </div>
                    <input
                      value={email ?? ""}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Email"
                      className="px-3 py-2 rounded-lg border bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-sky-300 dark:focus:ring-sky-600"
                      disabled={saving}
                    />
                  </label>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <label className="block">
                    <div className="text-xs mb-2">
                      <span className="text-sky-500 font-medium">
                        New password
                      </span>
                    </div>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="New password (leave blank to keep)"
                      className="px-3 py-2 rounded-lg border bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-sky-300 dark:focus:ring-sky-600"
                      disabled={saving}
                    />
                  </label>

                  <label className="block">
                    <div className="text-xs mb-2">
                      <span className="text-sky-500 font-medium">
                        Confirm password
                      </span>
                    </div>
                    <input
                      type="password"
                      value={passwordConfirm}
                      onChange={(e) => setPasswordConfirm(e.target.value)}
                      placeholder="Confirm new password"
                      className="px-3 py-2 rounded-lg border bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-sky-300 dark:focus:ring-sky-600"
                      disabled={saving}
                    />
                  </label>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <label className="w-full">
                    <div className="text-xs mb-2">
                      <span className="text-sky-500 font-medium">Role</span>
                    </div>
                    <select
                      value={role ?? "FE"}
                      onChange={(e) => setRole(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-sky-300 dark:focus:ring-sky-600"
                      disabled={saving}
                    >
                      <option value="FE">Frontend</option>
                      <option value="BE">Backend</option>
                      <option value="DevOps">DevOps</option>
                      <option value="PM">Product</option>
                      <option value="DOC">Documentation</option>
                    </select>
                  </label>
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
                className={`group inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold
              bg-gradient-to-r from-sky-500 to-sky-600 text-white
              hover:from-sky-600 hover:to-sky-700
              active:scale-95 transition-all duration-300
              dark:from-sky-600 dark:to-sky-700 dark:hover:from-sky-700 dark:hover:to-sky-800
              ${saving ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}`}
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
                  <>
                    <Save
                      size={16}
                      className="transition-transform duration-300 group-hover:-rotate-6"
                    />
                    <span>Save</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
