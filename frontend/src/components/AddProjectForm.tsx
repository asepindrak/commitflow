import React, { useState } from "react";

export default function AddProjectForm({
  onCreate,
}: {
  onCreate: (name: string) => void;
}) {
  const [val, setVal] = useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (val.trim()) {
          onCreate(val.trim());
          setVal("");
        }
      }}
      className="flex gap-2 mt-2"
    >
      <input
        value={val}
        onChange={(e) => setVal(e.target.value)}
        placeholder="New project"
        className="flex-1 px-2 py-1 border rounded bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-sm"
      />
      <button className="px-2 py-1 bg-sky-500 text-white rounded text-sm">
        Add
      </button>
    </form>
  );
}
