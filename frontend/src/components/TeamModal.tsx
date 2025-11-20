// frontend/src/components/TeamModal.tsx
import React, { useRef, useState, useEffect } from "react";
import { X, Camera } from "lucide-react";
import uploadMultipleFiles from "../utils/uploadFile";
import type { TeamMember } from "../types";
import { toast } from "react-toastify";

export default function TeamModal({
  open,
  onClose,
  onCreate,
  dark,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (m: TeamMember & { password?: string }) => void;
  dark?: boolean;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("FE");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");

  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) {
      setName("");
      setPhone("");
      setEmail("");
      setRole("FE");
      setPassword("");
      setPasswordConfirm("");
      setPhotoFile(null);
      setPhotoPreview(null);
      setUploading(false);
    }
  }, [open]);

  if (!open) return null;

  const onClickPhoto = () => {
    if (inputRef.current && !uploading) inputRef.current.click();
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      setPhotoFile(f);
      setPhotoPreview(URL.createObjectURL(f));
    }
  };

  async function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    const trimmed = name.trim();

    if (!trimmed) return toast.dark("Please enter a name");
    if (!password) return toast.dark("Password is required");
    if (password !== passwordConfirm)
      return toast.dark("Passwords do not match");

    setUploading(true);
    try {
      let photoUrl: string | undefined = undefined;

      if (photoFile) {
        const folder = `team/${trimmed.replace(/\s+/g, "_")}`;
        const urls = await uploadMultipleFiles([photoFile], folder);
        if (Array.isArray(urls) && urls[0]) photoUrl = urls[0];
      }

      const member: TeamMember & { password?: string } = {
        id: Math.random().toString(36).slice(2, 9),
        name: trimmed,
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        role: role || undefined,
        photo: photoUrl,
        password, // ← tambahkan ke payload
      };

      onCreate(member);
      toast.dark(`${trimmed} added`);

      setName("");
      setPhone("");
      setEmail("");
      setRole("FE");
      setPassword("");
      setPasswordConfirm("");
      setPhotoFile(null);
      setPhotoPreview(null);
      onClose();
    } catch (err: any) {
      console.error("Upload/create failed", err);
      toast.dark(`Failed: ${err?.message || err}`);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6">
      <div className="w-[520px] bg-white dark:bg-gray-900 rounded-xl shadow-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Add Team Member</h3>
          <button
            onClick={() => !uploading && onClose()}
            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <X />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex gap-3">
            {/* photo */}
            <div
              role="button"
              tabIndex={0}
              onClick={onClickPhoto}
              className="w-28 h-28 rounded-md bg-gray-100 dark:bg-gray-800 flex items-center justify-center overflow-hidden cursor-pointer relative"
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

              <input
                ref={inputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={onFileChange}
                disabled={uploading}
              />

              <div className="absolute inset-0 flex items-end justify-center pointer-events-none">
                <div className="bg-black/30 text-xs text-white px-2 py-1 rounded-b-md w-full text-center">
                  Click to choose
                </div>
              </div>
            </div>

            <div className="flex-1 space-y-2">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Full name"
                className="w-full px-3 py-2 rounded-lg border bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 outline-none"
                disabled={uploading}
              />

              <div className="grid grid-cols-2 gap-2">
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Phone"
                  className="px-3 py-2 rounded-lg border bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700"
                />
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email"
                  className="px-3 py-2 rounded-lg border bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  className="px-3 py-2 rounded-lg border bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700"
                />

                <input
                  type="password"
                  value={passwordConfirm}
                  onChange={(e) => setPasswordConfirm(e.target.value)}
                  placeholder="Confirm password"
                  className="px-3 py-2 rounded-lg border bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700"
                />
              </div>

              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="px-3 py-2 rounded-lg border bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700"
              >
                <option value="FE">Frontend</option>
                <option value="BE">Backend</option>
                <option value="DevOps">DevOps</option>
                <option value="PM">Product</option>
                <option value="DOC">Documentation</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={uploading}
              className="px-4 py-2 rounded-lg border bg-white dark:bg-gray-800"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={uploading}
              className="px-4 py-2 rounded-lg bg-sky-600 text-white flex items-center gap-2"
            >
              {uploading ? "Saving…" : "Create member"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
