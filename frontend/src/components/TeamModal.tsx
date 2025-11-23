import React, { useRef, useState, useEffect } from "react";
import { X, Camera, UserPlus } from "lucide-react";
import uploadMultipleFiles from "../utils/uploadFile";
import type { TeamMember } from "../types";
import { toast } from "react-toastify";

function nameToHue(name = "") {
  return name.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360;
}

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
        password,
      };

      onCreate(member);

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

  const hue = nameToHue(name || "user");
  const avatarBg = photoPreview
    ? undefined
    : `linear-gradient(135deg, hsl(${hue} 70% 60%), hsl(${
        (hue + 60) % 360
      } 75% 50%))`;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
    >
      <div
        className="absolute inset-0 bg-gradient-to-br from-black/40 via-black/30 to-black/20 backdrop-blur-sm"
        onClick={() => !uploading && onClose()}
      />

      <div className="relative z-10 w-full max-w-2xl">
        <div className="bg-slate-100 dark:bg-gray-900 rounded-2xl shadow-2xl overflow-hidden border border-gray-200 dark:border-gray-800">
          <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-sky-50 to-white dark:from-sky-900/20 dark:to-gray-900">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Add Team Member
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Create a new team member and assign a role
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => !uploading && onClose()}
                aria-label="Close modal"
                className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition"
              >
                <X />
              </button>
            </div>
          </div>

          <form
            onSubmit={handleSubmit}
            className="px-6 py-6 grid grid-cols-1 gap-6"
          >
            <div className="flex gap-5">
              <div
                role="button"
                tabIndex={0}
                onClick={onClickPhoto}
                onKeyDown={(e) => e.key === "Enter" && onClickPhoto()}
                className={`w-28 h-28 rounded-xl flex-shrink-0 flex items-center justify-center overflow-hidden relative cursor-pointer border border-dashed border-gray-200 dark:border-gray-800 ${
                  photoPreview
                    ? ""
                    : "bg-gradient-to-br from-sky-700 to-indigo-700"
                }`}
                aria-label="Choose photo"
              >
                {photoPreview ? (
                  <img
                    src={photoPreview}
                    alt="preview"
                    className="object-cover w-full h-full"
                  />
                ) : (
                  <div className="flex flex-col items-center gap-2 text-gray-400">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center bg-white/10">
                      <Camera />
                    </div>
                    <div className="text-xs">Upload photo</div>
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

                <div className="absolute inset-x-0 bottom-0 flex justify-center">
                  <div className="bg-black/40 text-xs text-white px-2 py-1 rounded-b-md w-full text-center">
                    Click to choose
                  </div>
                </div>
              </div>

              <div className="flex-1 grid grid-cols-1 gap-3">
                <label className="block">
                  <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                    <span className="text-sky-500 font-medium">Full name</span>
                  </div>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Full name"
                    className="w-full px-3 py-2 rounded-lg border bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 outline-none focus:ring-2 focus:ring-sky-300 dark:focus:ring-sky-600"
                    disabled={uploading}
                    aria-label="Full name"
                  />
                </label>

                <div className="grid grid-cols-2 gap-2">
                  <label className="block">
                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                      <span className="text-sky-500 font-medium">Phone</span>
                    </div>
                    <input
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="Phone"
                      className="w-full px-3 py-2 rounded-lg border bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 outline-none focus:ring-2 focus:ring-sky-300 dark:focus:ring-sky-600"
                      aria-label="Phone"
                    />
                  </label>

                  <label className="block">
                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                      <span className="text-sky-500 font-medium">Email</span>
                    </div>
                    <input
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Email"
                      className="w-full px-3 py-2 rounded-lg border bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 outline-none focus:ring-2 focus:ring-sky-300 dark:focus:ring-sky-600"
                      aria-label="Email"
                    />
                  </label>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <label className="block">
                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                      <span className="text-sky-500 font-medium">Password</span>
                    </div>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Password"
                      className="w-full px-3 py-2 rounded-lg border bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 outline-none focus:ring-2 focus:ring-sky-300 dark:focus:ring-sky-600"
                      aria-label="Password"
                    />
                  </label>

                  <label className="block">
                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                      <span className="text-sky-500 font-medium">
                        Confirm password
                      </span>
                    </div>
                    <input
                      type="password"
                      value={passwordConfirm}
                      onChange={(e) => setPasswordConfirm(e.target.value)}
                      placeholder="Confirm password"
                      className="w-full px-3 py-2 rounded-lg border bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 outline-none focus:ring-2 focus:ring-sky-300 dark:focus:ring-sky-600"
                      aria-label="Confirm password"
                    />
                  </label>
                </div>

                <label className="block">
                  <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                    <span className="text-sky-500 font-medium">Role</span>
                  </div>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 outline-none focus:ring-2 focus:ring-sky-300 dark:focus:ring-sky-600"
                    aria-label="Role"
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

            <div className="flex items-center justify-end gap-3 pt-2 border-t border-gray-100 dark:border-gray-800">
              <button
                type="button"
                onClick={onClose}
                disabled={uploading}
                className="px-4 py-2 rounded-lg border bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800 transition"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={uploading}
                className={`group inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold
              bg-gradient-to-r from-sky-500 to-cyan-500 text-white
              hover:from-sky-600 hover:to-cyan-600
              active:scale-95 transition-all duration-300
              disabled:opacity-60 disabled:cursor-not-allowed`}
              >
                {uploading ? (
                  "Saving…"
                ) : (
                  <>
                    <UserPlus
                      size={16}
                      className="transition-transform duration-300 group-hover:-rotate-6"
                    />
                    <span>Create member</span>
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
